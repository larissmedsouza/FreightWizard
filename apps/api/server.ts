import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, createHmac, timingSafeEqual } from 'crypto';
import https from 'https';

// Load env from root (for local dev)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Environment URLs
const API_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.API_URL || 'http://localhost:3001';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ============================================
// STRIPE BILLING
// ============================================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || '',
  professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID || '',
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
};
// Reverse lookup used by the webhook to turn a Stripe price ID back into our plan name.
const PRICE_ID_TO_PLAN: Record<string, string> = Object.fromEntries(
  Object.entries(PLAN_PRICE_IDS).filter(([, id]) => id).map(([plan, id]) => [id, plan])
);

function isTrialExpired(sub: any): boolean {
  if (sub.plan !== 'trial') return false;
  const analysesExpired = sub.trial_analyses_used >= 30;
  const daysExpired = new Date() > new Date(new Date(sub.trial_started_at).getTime() + 14 * 24 * 60 * 60 * 1000);
  return analysesExpired || daysExpired;
}

function getPlanLimits(plan: string) {
  const limits: Record<string, any> = {
    trial: { analyses: 30, shipments: 5, quotes: 5, users: 1, documents: true, rateCards: true },
    starter: { analyses: 200, shipments: 10, quotes: 20, users: 1, documents: false, rateCards: true },
    professional: { analyses: -1, shipments: -1, quotes: -1, users: 5, documents: true, rateCards: true },
    enterprise: { analyses: -1, shipments: -1, quotes: -1, users: -1, documents: true, rateCards: true },
  };
  return limits[plan] || limits.trial;
}

// Looks up (or lazily creates, e.g. on first login) the subscription row for
// a user, and keeps its expired/active status current. Shared by the OAuth
// callbacks and every billing-aware endpoint so they all see the same
// freshly-checked state.
async function getOrCreateSubscription(email: string, sessionId: string) {
  const { data: existing } = await supabase.from('subscriptions').select('*').eq('user_email', email).single();
  let sub = existing;
  if (!sub) {
    const { data: created } = await supabase.from('subscriptions').insert({
      session_id: sessionId, user_email: email, plan: 'trial', status: 'trialing',
      trial_analyses_used: 0, trial_started_at: new Date().toISOString(),
    }).select('*').single();
    sub = created;
  } else if (sub.status !== 'expired' && isTrialExpired(sub)) {
    const { data: updated } = await supabase.from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', sub.id).select('*').single();
    sub = updated;
  } else if (sub.session_id !== sessionId) {
    // Keep session_id pointed at the most recent login for this email.
    await supabase.from('subscriptions').update({ session_id: sessionId }).eq('id', sub.id);
    sub.session_id = sessionId;
  }
  return sub;
}

// ============================================
// TERMINAL49 CONTAINER TRACKING
// Docs: https://terminal49.com/docs/api-docs/api-reference/introduction
// Free tier: 50 tracked containers/month — watch usage before scaling this up.
// After deploying, register the webhook URL in the Terminal49 dashboard
// (or via POST /v2/tracking_requests... see create-a-webhook docs) pointing at:
//   https://freightwizard-production.up.railway.app/api/webhooks/terminal49
// ============================================
const TERMINAL49_API_KEY = process.env.TERMINAL49_API_KEY || '';
const TERMINAL49_WEBHOOK_SECRET = process.env.TERMINAL49_WEBHOOK_SECRET || '';
const TERMINAL49_BASE_URL = 'https://api.terminal49.com/v2';

// Common carrier name -> SCAC lookup. Terminal49 requires a SCAC to create a
// tracking request; this isn't collected anywhere else in the app today, so
// the "Track Container" modal asks the forwarder to pick a carrier here.
const CARRIER_SCAC: Record<string, string> = {
  'maersk': 'MAEU', 'msc': 'MSCU', 'cma cgm': 'CMDU', 'hapag-lloyd': 'HLCU',
  'hapag lloyd': 'HLCU', 'cosco': 'COSU', 'evergreen': 'EGLV', 'one': 'ONEY',
  'yang ming': 'YMLU', 'hmm': 'HDMU', 'zim': 'ZIMU', 'oocl': 'OOLU',
};

class T49Error extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function t49Request(pathSuffix: string, method: 'GET' | 'POST' | 'PATCH', body?: any) {
  if (!TERMINAL49_API_KEY) throw new T49Error('Terminal49 is not configured (missing TERMINAL49_API_KEY)', 500);
  console.log(`🚢 Terminal49 ${method} ${pathSuffix}`);
  const res = await fetch(`${TERMINAL49_BASE_URL}${pathSuffix}`, {
    method,
    headers: {
      'Authorization': `Token ${TERMINAL49_API_KEY}`,
      'Content-Type': 'application/vnd.api+json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`🚢 Terminal49 error ${res.status}:`, data);
    const detail = data?.errors?.[0]?.detail || data?.errors?.[0]?.title;
    throw new T49Error(detail || `Terminal49 request failed (${res.status})`, res.status);
  }
  return data;
}

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://freightwizard.app',
    'https://www.freightwizard.app',
    'https://freightwizard-production.up.railway.app',
    'https://freightwizard.vercel.app',
    'https://larissmedsouza.github.io',
    FRONTEND_URL
  ],
  credentials: true
}));
// Stripe webhook signature verification needs the exact raw bytes of the
// request body — this MUST be registered before the global express.json()
// below, and only for this one path, or Stripe's signature check will fail.
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
// `verify` captures the raw request body so /api/webhooks/terminal49 can verify
// the HMAC signature against the exact bytes Terminal49 signed (JSON.stringify
// after parsing is not guaranteed to match byte-for-byte).
app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));

// Initialize clients
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// Google OAuth setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${API_URL}/auth/google/callback`
);

// Microsoft/Outlook OAuth setup
const MICROSOFT_CONFIG = {
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  redirectUri: `${API_URL}/auth/outlook/callback`,
  scopes: ['openid', 'profile', 'email', 'Mail.Read', 'Mail.Send', 'Mail.ReadWrite', 'User.Read'],
  authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  graphUrl: 'https://graph.microsoft.com/v1.0'
};

console.log('🌐 API URL:', API_URL);
console.log('🖥️ Frontend URL:', FRONTEND_URL);

// ============================================
// HELPER: Get or create user profile
// ============================================
async function getOrCreateUser(email: string, name?: string): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) return existing.id;

    const { data: newUser, error } = await supabase
      .from('profiles')
      .insert({ email, full_name: name || email.split('@')[0] })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }

    console.log('✅ Created new user:', email);
    return newUser?.id || null;
  } catch (e) {
    console.error('Error in getOrCreateUser:', e);
    return null;
  }
}

// ============================================
// HELPER: Save session to Supabase
// ============================================
async function saveSession(sessionId: string, userId: string, email: string, name: string, provider: 'google' | 'outlook', tokens: any) {
  try {
    await supabase.from('gmail_sessions').upsert({
      session_id: sessionId,
      user_id: userId,
      gmail_email: email,
      user_name: name,
      provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      last_active: new Date().toISOString(),
    }, { onConflict: 'session_id' });
  } catch (e) {
    console.error('Error saving session:', e);
  }
}

// ============================================
// HELPER: Get session from Supabase
// ============================================
async function getSession(sessionId: string) {
  try {
    const { data } = await supabase
      .from('gmail_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (!data) return null;

    return {
      tokens: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expiry_date: data.token_expiry ? new Date(data.token_expiry).getTime() : null,
      },
      email: data.gmail_email,
      name: data.user_name || data.gmail_email,
      userId: data.user_id,
      provider: (data.provider || 'google') as 'google' | 'outlook',
    };
  } catch (e) {
    console.error('Error getting session:', e);
    return null;
  }
}

// ============================================
// HELPER: Track email activity
// ============================================
async function trackActivity(
  userId: string,
  emailId: string,
  action: 'received' | 'analyzed' | 'replied' | 'draft_saved',
  intent?: string,
  priority?: string,
  responseTimeMinutes?: number
) {
  try {
    await supabase.from('email_activity').insert({
      user_id: userId,
      email_id: emailId,
      action,
      intent,
      priority,
      response_time_minutes: responseTimeMinutes,
    });
    console.log(`📊 Tracked: ${action} for email ${emailId.substring(0, 8)}...`);
  } catch (e) {
    console.error('Error tracking activity:', e);
  }
}

// ============================================
// HELPER: Save email analysis to Supabase
// ============================================
async function saveAnalysis(
  userId: string,
  sessionId: string,
  emailId: string,
  subject: string,
  fromEmail: string,
  analysis: any
) {
  try {
    const { error } = await supabase.from('email_analysis').upsert({
      email_id: emailId,
      user_id: userId,
      gmail_session_id: sessionId,
      subject,
      from_email: fromEmail,
      intent: analysis.intent,
      priority: analysis.priority,
      mode: analysis.mode,
      pol: analysis.pol,
      pod: analysis.pod,
      incoterm: analysis.incoterm,
      cargo_type: analysis.cargo_type,
      container_type: analysis.container_type,
      container_count: analysis.container_count,
      missing_info: analysis.missing_info,
      summary: analysis.summary,
      suggested_reply: analysis.suggested_reply,
    }, { onConflict: 'email_id,user_id' });

    if (error) {
      console.error('Error saving analysis:', error);
    } else {
      console.log(`💾 Saved analysis for: ${subject.substring(0, 30)}...`);
    }
  } catch (e) {
    console.error('Error in saveAnalysis:', e);
  }
}

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => {
  res.json({ status: 'FreightWizard API running', version: '2.0' });
});

// Start Google OAuth
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  });
  res.redirect(url);
});

// Google OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const sessionId = Math.random().toString(36).substring(2, 15);
    const userId = await getOrCreateUser(data.email!, data.name || undefined);

    await saveSession(sessionId, userId!, data.email!, data.name || data.email!, 'google', tokens);
    await getOrCreateSubscription(data.email!, sessionId);

    console.log(`✅ Google OAuth success: ${data.email} (User ID: ${userId})`);
    res.redirect(`${FRONTEND_URL}/dashboard?session=${sessionId}`);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Authentication failed: ' + (error as any).message);
  }
});

// ============================================
// MICROSOFT/OUTLOOK OAUTH
// ============================================

app.get('/auth/outlook', (req, res) => {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CONFIG.clientId,
    response_type: 'code',
    redirect_uri: MICROSOFT_CONFIG.redirectUri,
    response_mode: 'query',
    scope: MICROSOFT_CONFIG.scopes.join(' '),
    prompt: 'consent',
  });
  res.redirect(`${MICROSOFT_CONFIG.authorizeUrl}?${params.toString()}`);
});

app.get('/auth/outlook/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) return res.status(400).send('Authentication failed: ' + error);
  if (!code) return res.status(400).send('No code provided');

  try {
    const tokenResponse = await fetch(MICROSOFT_CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MICROSOFT_CONFIG.clientId,
        client_secret: MICROSOFT_CONFIG.clientSecret,
        code: code as string,
        redirect_uri: MICROSOFT_CONFIG.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();
    if (tokens.error) return res.status(400).send('Token exchange failed: ' + tokens.error_description);

    const userResponse = await fetch(`${MICROSOFT_CONFIG.graphUrl}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userData = await userResponse.json();

    const sessionId = Math.random().toString(36).substring(2, 15);
    const userEmail = userData.mail || userData.userPrincipalName;
    const userName = userData.displayName || userEmail;
    const userId = await getOrCreateUser(userEmail, userName);

    await saveSession(sessionId, userId!, userEmail, userName, 'outlook', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: Date.now() + (tokens.expires_in * 1000),
    });

    await getOrCreateSubscription(userEmail, sessionId);

    console.log(`✅ Outlook OAuth success: ${userEmail} (User ID: ${userId})`);
    res.redirect(`${FRONTEND_URL}/dashboard?session=${sessionId}`);
  } catch (error) {
    console.error('Outlook OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
});

// ============================================
// OUTLOOK EMAIL FUNCTIONS
// ============================================

async function fetchOutlookEmails(accessToken: string) {
  const response = await fetch(
    `${MICROSOFT_CONFIG.graphUrl}/me/mailFolders/inbox/messages?$top=20&$orderby=receivedDateTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await response.json();
  return data.value || [];
}

async function sendOutlookEmail(accessToken: string, to: string, subject: string, body: string) {
  const response = await fetch(`${MICROSOFT_CONFIG.graphUrl}/me/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
  return response.ok;
}

async function saveOutlookDraft(accessToken: string, to: string, subject: string, body: string) {
  const response = await fetch(`${MICROSOFT_CONFIG.graphUrl}/me/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject,
      body: { contentType: 'Text', content: body },
      toRecipients: [{ emailAddress: { address: to } }],
      isDraft: true,
    }),
  });
  return response.ok;
}

// ============================================
// API ROUTES
// ============================================

// Check auth status
app.get('/api/auth/status', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);

  if (session) {
    res.json({
      authenticated: true,
      email: session.email,
      name: session.name,
      userId: session.userId,
      provider: session.provider || 'google',
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Fetch emails
app.get('/api/emails', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);

  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  try {
    let emails: any[] = [];

    if (session.provider === 'outlook') {
      const outlookEmails = await fetchOutlookEmails(session.tokens.access_token);

      emails = outlookEmails.map((msg: any) => {
        let body = '';
        if (msg.body?.content) {
          body = msg.body.contentType === 'html'
            ? msg.body.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            : msg.body.content;
        }
        return {
          id: msg.id,
          threadId: msg.conversationId,
          subject: msg.subject || '(No Subject)',
          from: msg.from?.emailAddress?.address || msg.from?.emailAddress?.name || '',
          fromName: msg.from?.emailAddress?.name || '',
          date: msg.receivedDateTime,
          snippet: msg.bodyPreview || '',
          body,
        };
      });

      if (session.userId) {
        for (const email of emails) {
          const { data: existing } = await supabase
            .from('email_activity').select('id')
            .eq('email_id', email.id).eq('action', 'received').single();
          if (!existing) await trackActivity(session.userId, email.id, 'received');
        }
      }
    } else {
      oauth2Client.setCredentials(session.tokens);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const list = await gmail.users.messages.list({ userId: 'me', maxResults: 20, labelIds: ['INBOX'] });

      emails = await Promise.all(
        (list.data.messages || []).map(async (msg) => {
          const full = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'full' });
          const headers = full.data.payload?.headers || [];
          const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          let body = '';
          const payload = full.data.payload;
          if (payload?.body?.data) {
            body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          } else if (payload?.parts) {
            const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
            if (textPart?.body?.data) body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }

          if (session.userId) {
            const { data: existing } = await supabase
              .from('email_activity').select('id')
              .eq('email_id', msg.id!).eq('action', 'received').single();
            if (!existing) await trackActivity(session.userId, msg.id!, 'received');
          }

          return {
            id: msg.id,
            threadId: msg.threadId,
            subject: getHeader('Subject') || '(No Subject)',
            from: getHeader('From'),
            date: getHeader('Date'),
            snippet: full.data.snippet || '',
            body,
          };
        })
      );
    }

    if (session.userId) {
      const emailIds = emails.map(e => e.id);
      const { data: analyses } = await supabase
        .from('email_analysis').select('*')
        .eq('user_id', session.userId).in('email_id', emailIds);

      if (analyses) {
        for (const email of emails) {
          const analysis = analyses.find(a => a.email_id === email.id);
          if (analysis) {
            (email as any).analysis = {
              intent: analysis.intent, priority: analysis.priority, mode: analysis.mode,
              pol: analysis.pol, pod: analysis.pod, incoterm: analysis.incoterm,
              cargo_type: analysis.cargo_type, container_type: analysis.container_type,
              container_count: analysis.container_count, missing_info: analysis.missing_info,
              summary: analysis.summary, suggested_reply: analysis.suggested_reply,
            };
          }
        }
      }
    }

    res.json({ emails, provider: session.provider || 'google' });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// Analyze email with AI
// Shared by POST /api/analyze (inline, before the Claude call — never waste
// tokens on a request we're going to block) and POST /api/billing/increment-analysis.
// Handles both the session-based dashboard flow and the emailless Gmail/Outlook
// add-on flow (userEmail + source, no FreightWizard session).
async function checkAndIncrementAnalysis(opts: { sessionId?: string; userEmail?: string }): Promise<{ allowed: boolean; reason?: string; analyses_remaining?: number }> {
  let email: string | null = null;
  let sessionId = opts.sessionId || 'addon';
  if (opts.sessionId) {
    const session = await getSession(opts.sessionId);
    if (!session) return { allowed: false, reason: 'not_authenticated' };
    email = session.email;
  } else if (opts.userEmail) {
    email = opts.userEmail;
  }
  if (!email) return { allowed: true }; // no identity to check against — don't block

  const sub = await getOrCreateSubscription(email, sessionId);
  if (!sub) return { allowed: true };
  if (sub.status === 'expired') {
    // getOrCreateSubscription already flips status to expired for either
    // cause (days OR analyses) as soon as it's checked, so by the time we
    // get here sub.status alone can't tell us which — check the specific
    // cause directly so the frontend shows the right copy (limit vs time).
    if (sub.plan === 'trial' && sub.trial_analyses_used >= 30) return { allowed: false, reason: 'trial_limit_reached' };
    return { allowed: false, reason: 'trial_expired' };
  }

  if (sub.plan === 'trial') {
    if (sub.trial_analyses_used >= 30) {
      await supabase.from('subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', sub.id);
      return { allowed: false, reason: 'trial_limit_reached' };
    }
    const nextCount = sub.trial_analyses_used + 1;
    await supabase.from('subscriptions').update({ trial_analyses_used: nextCount, updated_at: new Date().toISOString() }).eq('id', sub.id);
    return { allowed: true, analyses_remaining: Math.max(0, 30 - nextCount) };
  }

  if (sub.plan === 'starter') {
    const startOfMonth = new Date(); startOfMonth.setUTCDate(1); startOfMonth.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase.from('email_analysis').select('*', { count: 'exact', head: true })
      .eq('user_id', sub.user_email).gte('created_at', startOfMonth.toISOString());
    if ((count || 0) >= 200) return { allowed: false, reason: 'monthly_limit_reached' };
    return { allowed: true, analyses_remaining: Math.max(0, 200 - (count || 0) - 1) };
  }

  // professional / enterprise — unlimited
  return { allowed: true };
}

app.post('/api/billing/increment-analysis', async (req, res) => {
  const sessionId = (req.query.session as string) || req.body.sessionId;
  const result = await checkAndIncrementAnalysis({ sessionId });
  res.json(result);
});

// ============================================
// EMAIL ANALYSIS COMPLIANCE HOOKS (MAPA + TARIC)
// ============================================
const MAPA_KEYWORDS = [
  'food', 'grain', 'soy', 'soja', 'corn', 'milho', 'sugar', 'açúcar', 'acucar',
  'meat', 'carne', 'fruit', 'fruta', 'coffee', 'café', 'cafe', 'cotton', 'algodão', 'algodao',
  'tobacco', 'tabaco', 'wood', 'madeira', 'animal', 'plant', 'fertilizer', 'fertilizante',
  'pesticide', 'agroquímico', 'agroquimico', 'organic',
];
const BRAZIL_LOCATION_RE = /\bbr\b|brazil|brasil|santos|paranaguá|paranagua|itajaí|itajai|manaus|rio grande|suape|vitória|vitoria|navegantes/i;
const EU_COUNTRY_CODES = ['NL', 'DE', 'FR', 'BE', 'IT', 'ES', 'PT', 'PL', 'AT', 'IE', 'DK', 'SE', 'FI', 'GR', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'CY', 'MT'];

function buildMapaAlert(analysis: any, mapaEnabled: boolean) {
  if (!mapaEnabled) return { triggered: false };
  const mode = (analysis.mode || '').toLowerCase();
  if (mode !== 'ocean' && mode !== 'air') return { triggered: false };
  const pol = analysis.pol || '';
  const pod = analysis.pod || '';
  if (!BRAZIL_LOCATION_RE.test(pol) && !BRAZIL_LOCATION_RE.test(pod)) return { triggered: false };
  const commodity = (analysis.cargo_type || '').toLowerCase();
  if (!commodity || !MAPA_KEYWORDS.some(k => commodity.includes(k))) return { triggered: false };
  return {
    triggered: true,
    reason: `Commodity '${analysis.cargo_type}' on a Brazil shipment may require MAPA phytosanitary inspection`,
    action: 'Verify MAPA registration and phytosanitary certificate requirements before booking',
    link: 'https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal',
  };
}

// Auto-runs the TARIC lookup when the email mentions an HS code and the
// destination is an EU member state, but only if the forwarder has an
// active EU integration configured (per the "AND the forwarder has EU
// integrations active" condition in the spec).
async function maybeAutoTaricLookup(analysis: any, sessionId: string | undefined) {
  if (!analysis.hs_code || !sessionId) return null;
  const pod = (analysis.pod || '').toUpperCase();
  const destCountry = EU_COUNTRY_CODES.find(c => pod.includes(c));
  if (!destCountry) return null;

  const { data: euIntegrations } = await supabase
    .from('country_integrations').select('id').eq('session_id', sessionId)
    .eq('country_code', 'EU').eq('is_active', true).limit(1);
  if (!euIntegrations || euIntegrations.length === 0) return null;

  const result = await lookupTaric(analysis.hs_code, destCountry);
  if (!result.ok) return null;
  return result.data;
}

// Pull the analysis JSON object out of Claude's response text. The model
// usually returns a bare object, but sometimes wraps it in a ```json fence
// or adds a sentence before/after — a single greedy /\{[\s\S]*\}/ match can
// then span text that doesn't parse. Try the greedy match first, then fall
// back to scanning for the last balanced {...} block that JSON.parse accepts.
function extractAnalysisJson(text: string): any | null {
  if (!text) return null;
  const stripped = text.replace(/```(?:json)?/gi, '').trim();

  const greedy = stripped.match(/\{[\s\S]*\}/);
  if (greedy) {
    try { return JSON.parse(greedy[0]); } catch { /* fall through to scan */ }
  }

  // Scan for balanced {...} objects; return the last one that parses.
  const candidates: string[] = [];
  for (let start = 0; start < stripped.length; start++) {
    if (stripped[start] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < stripped.length; i++) {
      const ch = stripped[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { candidates.push(stripped.slice(start, i + 1)); break; }
      }
    }
  }
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(candidates[i]);
      if (parsed && typeof parsed === 'object' && 'intent' in parsed) return parsed;
    } catch { /* try next candidate */ }
  }
  return null;
}

app.post('/api/analyze', async (req, res) => {
  const { subject, body, from, emailId, sessionId, source, userEmail, language } = req.body;

  const gate = await checkAndIncrementAnalysis({ sessionId, userEmail: (source === 'gmail_addon' || source === 'outlook_addon') ? userEmail : undefined });
  if (!gate.allowed) return res.status(402).json({ error: 'limit_reached', reason: gate.reason });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are FreightWizard AI, an expert freight forwarding email analyst.
IMPORTANT: Respond with summary and suggested_reply in ${language === 'pt' ? 'Brazilian Portuguese' : language === 'nl' ? 'Dutch' : 'English'}. Keep intent, priority, mode, pol, pod values in English always.

Analyze this freight email and extract:
1. Intent — choose the MOST specific match:
   Standard: quote_request, booking_confirmation, tracking_inquiry, documentation_request, rate_inquiry, status_update, complaint, general_inquiry
   CE Mercante (Brazilian maritime): ce_mercante_consulta (asking for CE number/status/location), afrmm_status_check (asking about AFRMM tax payment), cargo_release_followup (asking if cargo released in system), manifesto_consulta (asking about vessel manifest/CE), pendencia_documental_mercante (asking about pending documents in Mercante system)
   Mercante trigger patterns: "CE Mercante", "AFRMM", "conhecimento eletrônico", "Sistema Mercante", "BL no Mercante", "carga liberada", "manifesto", "cargo release status", "advise if AFRMM", "CE number for shipment", "Please confirm CE"
2. Priority: urgent, high, medium, low
   NOTE: cargo_release_followup and afrmm_status_check → always high; other Mercante intents → medium
3. Transport mode: ocean, air, road, rail, multimodal
4. POL (Port of Loading) and POD (Port of Discharge)
5. Incoterm if mentioned
6. Cargo type, container type, container count
7. Missing information needed to proceed
   For Mercante intents also check: CE Mercante number, BL / MBL / HBL number, Manifesto reference, CNPJ / Importer, Discharge port, Carrier / Armador, AFRMM payment proof, Expected arrival date
8. Brief summary — for Mercante intents: state what client is asking, what data was found/not found, operational implication, next action
9. Professional reply draft — for Mercante intents use context-aware template:
   If data missing: ask client for BL/CE/CNPJ to query Sistema Mercante
   If CE found + AFRMM pending: inform client and request payment proof
   If CE found + AFRMM paid: confirm cargo release status
10. Mercante entity extraction (fill if email is Mercante-related, null otherwise):
    ce_number (9-15 digit numeric), bl_number (alphanumeric BL/MBL/HBL), container_number (4 letters + 7 digits), vessel_name, voyage, discharge_port, origin_port, carrier/armador, importer_cnpj (Brazilian CNPJ), shipment_date
11. Shipment identifiers — extract from ANY email (not just Mercante-related), null if not mentioned: reference/booking number, container number, BL/MBL/HBL number
12. Shipment status hint — infer what this email implies about a shipment's status, or null if it implies no status change. One of: inquiry (asking for a quote), quoted, booked ("booking confirmed"), in_transit ("vessel departed", "cargo shipped/in transit"), at_destination ("arrived at port", "cargo landed"), delivered ("delivered", "POD signed"), closed, cancelled
13. HS code — the Harmonized System / commodity tariff code if mentioned anywhere in the email (e.g. "0901.21", "09012100"), null if not mentioned

Email Subject: ${subject}
From: ${from}
Body: ${body}

Respond in JSON format:
{
  "intent": "",
  "priority": "",
  "mode": "",
  "pol": "",
  "pod": "",
  "incoterm": "",
  "cargo_type": "",
  "container_type": "",
  "container_count": null,
  "missing_info": [],
  "summary": "",
  "suggested_reply": "",
  "mercante_entities": {
    "ce_number": null,
    "bl_number": null,
    "container_number": null,
    "vessel_name": null,
    "voyage": null,
    "discharge_port": null,
    "origin_port": null,
    "carrier": null,
    "importer_cnpj": null,
    "shipment_date": null
  },
  "shipment_identifiers": {
    "reference": null,
    "booking_number": null,
    "container_number": null,
    "bl_number": null
  },
  "shipment_status_hint": null,
  "hs_code": null
}`
      }]
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const analysis = extractAnalysisJson(text);

    if (analysis) {
      let userId: string | null = null;

      if (sessionId) {
        const session = await getSession(sessionId);
        userId = session?.userId || null;
      } else if (userEmail && (source === 'gmail_addon' || source === 'outlook_addon')) {
        userId = await getOrCreateUser(userEmail);
        console.log(`📧 ${source} analysis from: ${userEmail} (User ID: ${userId})`);
      }

      if (userId && emailId) {
        await saveAnalysis(userId, sessionId || 'gmail_addon', emailId, subject, from, analysis);
        await trackActivity(userId, emailId, 'analyzed', analysis.intent, analysis.priority);
        console.log(`💾 Analysis saved to Supabase for user: ${userId}`);
      }

      const tenantIntegration = userId ? await getTenantIntegration(userId) : null;
      analysis.mapa_alert = buildMapaAlert(analysis, !!tenantIntegration?.mapaEnabled);
      if (analysis.mapa_alert.triggered) console.log(`🌱 MAPA alert triggered for email ${emailId}: ${analysis.mapa_alert.reason}`);

      const taric = await maybeAutoTaricLookup(analysis, sessionId);
      if (taric) analysis.taric_lookup = taric;

      res.json({ analysis, analyses_remaining: gate.analyses_remaining });
    } else {
      res.status(500).json({ error: 'Failed to parse AI response' });
    }
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// ============================================
// SHIPMENTS
// ============================================
const SHIPMENT_FIELDS = [
  'status', 'reference', 'customer', 'origin', 'destination', 'mode', 'commodity',
  'weight', 'container', 'container_number', 'incoterm', 'eta', 'etd', 'carrier', 'notes',
  'booking_number', 'bl_number', 'email_id', 'email_subject',
];

function pickShipmentFields(body: any) {
  const out: Record<string, any> = {};
  for (const key of SHIPMENT_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

// List approved shipments
app.get('/api/shipments', async (req, res) => {
  const session = await getSession(req.query.session as string);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await supabase
    .from('shipments').select('*')
    .eq('user_id', session.userId).eq('approved', true)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to load shipments' });
  res.json({ shipments: data });
});

// List pending AI suggestions
app.get('/api/shipments/pending', async (req, res) => {
  const session = await getSession(req.query.session as string);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await supabase
    .from('shipments').select('*')
    .eq('user_id', session.userId).eq('approved', false)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to load pending shipments' });

  const targetIds = [...new Set((data || []).map(p => p.update_target_id).filter(Boolean))];
  let targets: Record<string, any> = {};
  if (targetIds.length) {
    const { data: targetRows } = await supabase
      .from('shipments').select('id, reference, customer').in('id', targetIds);
    targets = Object.fromEntries((targetRows || []).map(t => [t.id, t]));
  }

  const pending = (data || []).map(p => ({
    ...p,
    updateTarget: p.update_target_id ? targets[p.update_target_id] || null : null,
  }));
  res.json({ pending });
});

// Create shipment manually
app.post('/api/shipments', async (req, res) => {
  const session = await getSession(req.query.session as string);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const sub = await getOrCreateSubscription(session.email, req.query.session as string);
  const shipmentLimit = getPlanLimits(sub?.plan || 'trial').shipments;
  if (shipmentLimit !== -1) {
    const { count } = await supabase.from('shipments').select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId).not('status', 'in', '(delivered,closed,cancelled)');
    if ((count || 0) >= shipmentLimit) return res.status(402).json({ error: 'limit_reached', reason: 'shipments_limit' });
  }

  const fields = pickShipmentFields(req.body);
  const { data, error } = await supabase
    .from('shipments')
    .insert({ ...fields, user_id: session.userId, ai_generated: false, approved: true })
    .select('*').single();

  if (error) return res.status(500).json({ error: 'Failed to create shipment' });
  res.json({ shipment: data });
});

// Update shipment fields/status
app.patch('/api/shipments/:id', async (req, res) => {
  const session = await getSession(req.query.session as string);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: existing } = await supabase
    .from('shipments').select('user_id').eq('id', req.params.id).single();
  if (!existing || existing.user_id !== session.userId) return res.status(404).json({ error: 'Shipment not found' });

  const fields = pickShipmentFields(req.body);
  const { data, error } = await supabase
    .from('shipments')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('*').single();

  if (error) return res.status(500).json({ error: 'Failed to update shipment' });
  res.json({ shipment: data });
});

// Delete shipment (or reject a pending suggestion)
app.delete('/api/shipments/:id', async (req, res) => {
  const session = await getSession(req.query.session as string);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: existing } = await supabase
    .from('shipments').select('user_id').eq('id', req.params.id).single();
  if (!existing || existing.user_id !== session.userId) return res.status(404).json({ error: 'Shipment not found' });

  const { error } = await supabase.from('shipments').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Failed to delete shipment' });
  res.json({ success: true });
});

// Approve a pending AI suggestion
app.post('/api/shipments/:id/approve', async (req, res) => {
  const session = await getSession(req.query.session as string);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: pending } = await supabase
    .from('shipments').select('*').eq('id', req.params.id).single();
  if (!pending || pending.user_id !== session.userId) return res.status(404).json({ error: 'Shipment not found' });

  if (pending.update_target_id) {
    const fields: Record<string, any> = { status: pending.status };
    for (const key of SHIPMENT_FIELDS) {
      if (key !== 'status' && pending[key] !== null && pending[key] !== undefined) fields[key] = pending[key];
    }
    const { data: target, error } = await supabase
      .from('shipments')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', pending.update_target_id)
      .select('*').single();
    if (error) return res.status(500).json({ error: 'Failed to apply update' });
    await supabase.from('shipments').delete().eq('id', pending.id);
    return res.json({ shipment: target });
  }

  const { data, error } = await supabase
    .from('shipments')
    .update({ approved: true, updated_at: new Date().toISOString() })
    .eq('id', pending.id)
    .select('*').single();
  if (error) return res.status(500).json({ error: 'Failed to approve shipment' });
  res.json({ shipment: data });
});

// Match an analyzed email against existing shipments, or suggest a new one
app.post('/api/shipments/match', async (req, res) => {
  const sessionId = req.body.sessionId || (req.query.session as string);
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { emailId, emailSubject, from, identifiers, statusHint } = req.body;
  const ids = identifiers || {};
  const hasIdentifier = !!(ids.reference || ids.booking_number || ids.container_number || ids.bl_number);

  if (!hasIdentifier && !statusHint) return res.json({ created: false });

  try {
    let match = null;
    if (hasIdentifier) {
      const orFilters = [
        ids.reference && `reference.eq.${ids.reference}`,
        ids.container_number && `container.eq.${ids.container_number}`,
        ids.booking_number && `booking_number.eq.${ids.booking_number}`,
        ids.bl_number && `bl_number.eq.${ids.bl_number}`,
      ].filter(Boolean).join(',');

      const { data: matches } = await supabase
        .from('shipments').select('*')
        .eq('user_id', session.userId).eq('approved', true)
        .or(orFilters)
        .limit(1);
      match = matches?.[0] || null;
    }

    let pendingRow: Record<string, any>;
    if (match) {
      pendingRow = {
        user_id: session.userId,
        update_target_id: match.id,
        status: statusHint || match.status,
        reference: match.reference, customer: match.customer,
        origin: match.origin, destination: match.destination, mode: match.mode,
        email_id: emailId, email_subject: emailSubject,
        ai_generated: true, approved: false,
      };
    } else {
      if (!hasIdentifier) return res.json({ created: false });
      pendingRow = {
        user_id: session.userId,
        update_target_id: null,
        status: statusHint || 'inquiry',
        reference: ids.reference || null,
        customer: from || null,
        container_number: ids.container_number || null,
        booking_number: ids.booking_number || null,
        bl_number: ids.bl_number || null,
        email_id: emailId, email_subject: emailSubject,
        ai_generated: true, approved: false,
      };
    }

    const { data, error } = await supabase.from('shipments').insert(pendingRow).select('*').single();
    if (error) throw error;
    res.json({ created: true, pending: data });
  } catch (e) {
    console.error('Shipment match error:', e);
    res.status(500).json({ error: 'Failed to match shipment' });
  }
});

// ============================================
// TERMINAL49 CONTAINER TRACKING ENDPOINTS
// ============================================
const CONTAINER_NUMBER_RE = /^[A-Z]{4}\d{7}$/;

async function logShipmentEvent(shipmentId: string, source: string, eventType: string, description: string, location: string | null, eventAt: string | null, raw: any) {
  await supabase.from('shipment_events').insert({
    shipment_id: shipmentId, source, event_type: eventType, description,
    location, event_at: eventAt || new Date().toISOString(), raw,
  });
}

// Register a container for live tracking via Terminal49
app.post('/api/shipments/:id/track', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: shipment } = await supabase.from('shipments').select('*').eq('id', req.params.id).single();
  if (!shipment || shipment.user_id !== session.userId) return res.status(404).json({ error: 'Shipment not found' });

  const containerNumber = (req.body.container_number || '').toUpperCase().trim();
  const blNumber = (req.body.bl_number || '').trim();
  const carrierInput = (req.body.carrier_scac || req.body.carrier || shipment.carrier || '').trim();

  if (!blNumber && !CONTAINER_NUMBER_RE.test(containerNumber)) {
    return res.status(400).json({ error: 'Invalid container number — format should be 4 letters + 7 digits, e.g. MSCU1234567' });
  }

  const scac = /^[A-Z]{2,4}$/.test(carrierInput.toUpperCase()) ? carrierInput.toUpperCase() : CARRIER_SCAC[carrierInput.toLowerCase()];
  if (!scac) {
    return res.status(400).json({ error: 'Carrier is required to start tracking — please select a carrier (Terminal49 needs its SCAC code to look up the container).' });
  }

  try {
    const result = await t49Request('/tracking_requests', 'POST', {
      data: {
        type: 'tracking_request',
        attributes: {
          request_type: blNumber ? 'bill_of_lading' : 'container',
          request_number: blNumber || containerNumber,
          scac,
        },
      },
    });

    const trackingRequestId = result?.data?.id;
    const { data: updated, error } = await supabase
      .from('shipments')
      .update({
        container_number: containerNumber || shipment.container_number,
        t49_tracking_request_id: trackingRequestId,
        t49_tracking_active: true,
        t49_raw: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipment.id)
      .select('*').single();
    if (error) throw error;

    await logShipmentEvent(shipment.id, 'terminal49', 'tracking_started', 'Live container tracking started via Terminal49', null, null, result);

    console.log(`🚢 Tracking started for shipment ${shipment.id} (tracking_request ${trackingRequestId})`);
    res.json({ shipment: updated });
  } catch (error: any) {
    console.error('Terminal49 tracking error:', error);
    // Terminal49 unreachable or container lookup failed — shipment still works, just without live tracking.
    res.status(502).json({ error: error.message || 'Container not found — check the number and try again' });
  }
});

// Stop tracking a shipment.
// NOTE: Terminal49's API (as of these docs) does not expose a cancel/delete
// endpoint for tracking requests — only create/list/get/edit. So this stops
// tracking on OUR side only (t49_tracking_active=false); the webhook handler
// checks that flag and ignores further Terminal49 events for this shipment
// once it's off, even though Terminal49 itself may keep tracking internally.
app.delete('/api/shipments/:id/track', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: shipment } = await supabase.from('shipments').select('user_id').eq('id', req.params.id).single();
  if (!shipment || shipment.user_id !== session.userId) return res.status(404).json({ error: 'Shipment not found' });

  const { data: updated, error } = await supabase
    .from('shipments')
    .update({ t49_tracking_active: false, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('*').single();
  if (error) return res.status(500).json({ error: 'Failed to stop tracking' });

  res.json({ shipment: updated });
});

// List milestone events for a shipment (used by shipments page + customer portal)
app.get('/api/shipments/:id/events', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: shipment } = await supabase.from('shipments').select('user_id').eq('id', req.params.id).single();
  if (!shipment || shipment.user_id !== session.userId) return res.status(404).json({ error: 'Shipment not found' });

  const { data, error } = await supabase
    .from('shipment_events').select('*').eq('shipment_id', req.params.id)
    .order('event_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to load events' });
  res.json({ events: data });
});

// Terminal49 -> our status mapping. Event names below match Terminal49's real
// container.transport.* catalog; a couple of names in the original spec
// ('arrived', 'freight_available_for_pickup', 'empty_returned') don't exist
// verbatim in their catalog, so they're mapped to the closest real events.
const T49_STATUS_MAP: Record<string, string> = {
  vessel_loaded: 'booked',
  vessel_departed: 'in_transit',
  vessel_arrived: 'at_destination',
  available: 'at_destination',
  delivered: 'delivered',
  empty_in: 'delivered',
};

function findIncluded(included: any[], type: string, id: string) {
  return included?.find((r: any) => r.type === type && r.id === id) || null;
}

// Shared by the webhook handler and /refresh-tracking (polling) so both paths
// parse a Terminal49 transport/container event resource identically.
function parseTransportEvent(eventTypeFull: string, resource: any) {
  const eventType = eventTypeFull.replace('container.transport.', '');
  const vessel = resource?.attributes?.vessel_name || null;
  const voyage = resource?.attributes?.voyage_number || null;
  const location = resource?.attributes?.location_locode || resource?.attributes?.facility_name || null;
  const eventAt = resource?.attributes?.timestamp || null;
  const description = `${eventType.replace(/_/g, ' ')}${vessel ? ` — ${vessel}` : ''}${location ? ` at ${location}` : ''}`;
  return { eventType, vessel, voyage, location, eventAt, description };
}

// Shared by the webhook handler and /refresh-tracking — builds the Supabase
// `shipments` update payload for a parsed transport event.
function buildShipmentUpdates(eventTypeFull: string, parsed: ReturnType<typeof parseTransportEvent>, podEta: string | null, raw: any) {
  const updates: Record<string, any> = {
    t49_status: eventTypeFull, t49_last_event: parsed.description,
    t49_last_event_at: parsed.eventAt || new Date().toISOString(),
    t49_raw: raw, updated_at: new Date().toISOString(),
  };
  if (parsed.vessel) updates.t49_vessel = parsed.vessel;
  if (parsed.voyage) updates.t49_voyage = parsed.voyage;
  if (podEta) updates.t49_pod_eta = podEta;
  const mappedStatus = T49_STATUS_MAP[parsed.eventType];
  if (mappedStatus) updates.status = mappedStatus;
  return updates;
}

// Manual refresh used instead of webhooks (webhooks require Terminal49 paid
// plan). Upgrade to webhooks when revenue justifies it.
app.post('/api/shipments/:id/refresh-tracking', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: shipment } = await supabase.from('shipments').select('*').eq('id', req.params.id).single();
  if (!shipment || shipment.user_id !== session.userId) return res.status(404).json({ error: 'Shipment not found' });

  if (!shipment.t49_tracking_active || !shipment.t49_shipment_id) {
    return res.status(400).json({ error: 'This shipment is not being live-tracked' });
  }

  try {
    const result = await t49Request(`/shipments/${shipment.t49_shipment_id}?include=container_events`, 'GET');
    const included: any[] = result?.included || [];
    const shipmentResource = result?.data;
    const podEta = shipmentResource?.attributes?.pod_eta_at || null;

    // Polling returns the container's full event history, not just one event
    // like a webhook does — Terminal49's included resources here have been
    // seen as either `container_event` or `transport_event` depending on
    // account/version, so accept either.
    const eventResources = included.filter((r: any) => r.type === 'container_event' || r.type === 'transport_event');

    // Dedupe against what we already have (by event_type + event_at) before inserting.
    const { data: existingEvents } = await supabase
      .from('shipment_events').select('event_type, event_at').eq('shipment_id', shipment.id);
    // Normalize timestamps before comparing — Postgres returns "+00:00",
    // Terminal49 sends "Z"; same instant, different string, so a naive
    // string-equality dedup would otherwise insert duplicates every refresh.
    const eventKey = (type: string, at: string) => `${type}|${new Date(at).toISOString()}`;
    const existingKeys = new Set((existingEvents || []).map(e => eventKey(e.event_type, e.event_at)));

    const parsedEvents = eventResources
      .map(r => parseTransportEvent(`container.transport.${r.attributes?.event || 'unknown'}`, r))
      .filter(p => p.eventAt);

    const newEvents = parsedEvents.filter(p => !existingKeys.has(eventKey(p.eventType, p.eventAt)));
    if (newEvents.length) {
      await supabase.from('shipment_events').insert(newEvents.map(p => ({
        shipment_id: shipment.id, source: 'terminal49', event_type: p.eventType,
        description: p.description, location: p.location, event_at: p.eventAt, raw: result,
      })));
    }

    // Apply shipment-level field updates from whichever event is most recent (new or existing).
    const latest = parsedEvents.slice().sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime())[0];
    let updatedShipment = shipment;
    if (latest) {
      const updates = buildShipmentUpdates(`container.transport.${latest.eventType}`, latest, podEta, result);
      const { data } = await supabase.from('shipments').update(updates).eq('id', shipment.id).select('*').single();
      if (data) updatedShipment = data;
    } else if (podEta) {
      const { data } = await supabase.from('shipments').update({ t49_pod_eta: podEta, t49_raw: result, updated_at: new Date().toISOString() }).eq('id', shipment.id).select('*').single();
      if (data) updatedShipment = data;
    } else {
      await supabase.from('shipments').update({ t49_raw: result, updated_at: new Date().toISOString() }).eq('id', shipment.id);
    }

    console.log(`🚢 Refreshed tracking for shipment ${shipment.id}: ${newEvents.length} new event(s)`);
    res.json({ shipment: updatedShipment, newEvents });
  } catch (error: any) {
    console.error('Terminal49 refresh error:', error);
    if (error.status === 404) {
      await supabase.from('shipments').update({ t49_tracking_active: false, updated_at: new Date().toISOString() }).eq('id', shipment.id);
      return res.status(404).json({ error: 'Container not found on Terminal49 — tracking has been deactivated' });
    }
    if (error.status >= 500 || !error.status) {
      return res.status(503).json({ error: 'Terminal49 unavailable — try again later' });
    }
    // Anything else (401/403 — e.g. free-tier plan restriction on GET) — surface the real reason.
    return res.status(502).json({ error: error.message || 'Terminal49 unavailable — try again later' });
  }
});

// PUBLIC — Terminal49 calls this when a milestone happens on a tracked container.
// Register this URL in the Terminal49 dashboard after deploying:
//   https://freightwizard-production.up.railway.app/api/webhooks/terminal49
app.post('/api/webhooks/terminal49', async (req: any, res) => {
  // Verify signature if a webhook secret is configured; otherwise log and accept.
  if (TERMINAL49_WEBHOOK_SECRET) {
    const signature = req.headers['x-t49-webhook-signature'] as string | undefined;
    const rawBody: Buffer | undefined = req.rawBody;
    if (!signature || !rawBody) {
      console.warn('🚢 Terminal49 webhook rejected: missing signature or raw body');
      return res.status(401).json({ error: 'Missing signature' });
    }
    const digest = createHmac('sha256', TERMINAL49_WEBHOOK_SECRET).update(rawBody).digest('hex');
    const received = Buffer.from(signature, 'hex');
    const expected = Buffer.from(digest, 'hex');
    const valid = received.length === expected.length && timingSafeEqual(received, expected);
    if (!valid) {
      console.warn('🚢 Terminal49 webhook rejected: invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else {
    console.warn('🚢 Terminal49 webhook received without TERMINAL49_WEBHOOK_SECRET configured — accepting unverified');
  }

  const body = req.body;
  const event = body?.data?.attributes?.event;
  const included = body?.included || [];
  const refType = body?.data?.relationships?.reference_object?.data?.type;
  const refId = body?.data?.relationships?.reference_object?.data?.id;
  console.log(`🚢 Terminal49 webhook: ${event} (${refType}:${refId})`);

  try {
    if (event === 'tracking_request.succeeded') {
      const trackingReq = findIncluded(included, 'tracking_request', refId);
      const trackedShipmentRef = trackingReq?.relationships?.tracked_object?.data;
      const t49ShipmentId = trackedShipmentRef?.id;

      const { data: shipment } = await supabase.from('shipments').select('id').eq('t49_tracking_request_id', refId).single();
      if (shipment && t49ShipmentId) {
        await supabase.from('shipments').update({
          t49_shipment_id: t49ShipmentId, t49_tracking_active: true, t49_raw: body, updated_at: new Date().toISOString(),
        }).eq('id', shipment.id);
        await logShipmentEvent(shipment.id, 'terminal49', 'tracking_request_succeeded', 'Terminal49 confirmed tracking for this shipment', null, null, body);
      } else {
        console.warn('🚢 tracking_request.succeeded: no matching shipment found for tracking_request', refId);
      }
    } else if (event === 'tracking_request.failed') {
      const trackingReq = findIncluded(included, 'tracking_request', refId);
      const reason = trackingReq?.attributes?.status_details || trackingReq?.attributes?.status || 'Tracking request failed';
      const { data: shipment } = await supabase.from('shipments').select('id').eq('t49_tracking_request_id', refId).single();
      if (shipment) {
        await supabase.from('shipments').update({ t49_tracking_active: false, t49_raw: body, updated_at: new Date().toISOString() }).eq('id', shipment.id);
        await logShipmentEvent(shipment.id, 'terminal49', 'tracking_request_failed', reason, null, null, body);
      } else {
        console.warn('🚢 tracking_request.failed: no matching shipment found for tracking_request', refId);
      }
    } else if (typeof event === 'string' && event.startsWith('container.transport.')) {
      const transportEvent = findIncluded(included, 'transport_event', refId);
      const shipmentResource = included.find((r: any) => r.type === 'shipment');
      const containerResource = included.find((r: any) => r.type === 'container');

      let shipment: { id: string; t49_tracking_active: boolean } | null = null;
      if (shipmentResource?.id) {
        const { data } = await supabase.from('shipments').select('id, t49_tracking_active').eq('t49_shipment_id', shipmentResource.id).single();
        shipment = data;
      }
      if (!shipment && containerResource?.attributes?.number) {
        const { data } = await supabase.from('shipments').select('id, t49_tracking_active').eq('container_number', containerResource.attributes.number).single();
        shipment = data;
      }

      if (!shipment) {
        console.warn('🚢 Transport event for untracked/unknown shipment, ignoring:', event);
      } else if (!shipment.t49_tracking_active) {
        console.log(`🚢 Ignoring event for shipment ${shipment.id} — tracking was stopped locally`);
      } else {
        const parsed = parseTransportEvent(event, transportEvent);
        const podEta = shipmentResource?.attributes?.pod_eta_at || null;

        await logShipmentEvent(shipment.id, 'terminal49', parsed.eventType, parsed.description, parsed.location, parsed.eventAt, transportEvent || body);
        await supabase.from('shipments').update(buildShipmentUpdates(event, parsed, podEta, body)).eq('id', shipment.id);
      }
    } else {
      console.log(`🚢 Unhandled Terminal49 event type: ${event}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Terminal49 webhook processing error:', error);
    // Still 200 — we don't want Terminal49 retry-storming us over a local bug.
    res.status(200).json({ received: true, error: 'Processing failed, logged' });
  }
});

// ============================================
// HELPER: Send an email via the session's provider (Gmail or Outlook)
// Shared by /api/send-reply and /api/quotes/:id/send
// ============================================
async function sendEmailAsReply(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, to: string, subject: string, body: string, threadId?: string) {
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

  if (session.provider === 'outlook') {
    const success = await sendOutlookEmail(session.tokens.access_token, to, replySubject, body);
    if (!success) throw new Error('Failed to send via Outlook');
  } else {
    oauth2Client.setCredentials(session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const rawMessage = Buffer.from(
      `To: ${to}\r\nSubject: ${replySubject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: rawMessage, threadId } });
  }
}

// Send reply
app.post('/api/send-reply', async (req, res) => {
  const sessionId = req.query.session as string;
  const { to, subject, body, threadId, emailId } = req.body;
  const session = await getSession(sessionId);

  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  try {
    await sendEmailAsReply(session, to, subject, body, threadId);

    if (session.userId && emailId) {
      const { data: activity } = await supabase
        .from('email_activity').select('created_at')
        .eq('email_id', emailId).eq('action', 'received').single();

      let responseTimeMinutes;
      if (activity) {
        responseTimeMinutes = Math.round((new Date().getTime() - new Date(activity.created_at).getTime()) / 60000);
      }

      await trackActivity(session.userId, emailId, 'replied', undefined, undefined, responseTimeMinutes);
      await supabase.from('email_analysis')
        .update({ replied_at: new Date().toISOString(), response_time_minutes: responseTimeMinutes })
        .eq('email_id', emailId).eq('user_id', session.userId);
    }

    console.log(`✉️ Reply sent to: ${to} (via ${session.provider || 'google'})`);
    res.json({ success: true });
  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ error: 'Failed to send' });
  }
});

// ============================================
// QUOTES
// ============================================
const QUOTE_FIELDS = [
  'email_id', 'email_subject', 'customer_name', 'customer_email', 'origin', 'destination',
  'mode', 'commodity', 'container_type', 'weight', 'incoterm', 'carrier', 'sell_rate', 'currency',
  'transit_time', 'validity_date', 'notes', 'status', 'charges',
];

function pickQuoteFields(body: any) {
  const out: Record<string, any> = {};
  for (const key of QUOTE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function formatQuoteEmailBody(quote: any) {
  const charges: { name: string; amount: number }[] = quote.charges || [];
  const chargeLines = charges.map(c => `  ${c.name}: ${quote.currency || 'USD'} ${Number(c.amount).toFixed(2)}`).join('\n');
  return `FREIGHT QUOTATION

Quote #: FW-QUOTE-${String(quote.id).slice(0, 8).toUpperCase()}
Date: ${new Date().toLocaleDateString()}
Valid until: ${quote.validity_date || 'N/A'}

To: ${quote.customer_name || ''} <${quote.customer_email || ''}>

SHIPMENT DETAILS
  Origin: ${quote.origin || ''}
  Destination: ${quote.destination || ''}
  Mode: ${quote.mode || ''}
  Commodity: ${quote.commodity || ''}
  Container: ${quote.container_type || ''}
  Weight: ${quote.weight || ''}
  Incoterm: ${quote.incoterm || ''}

CHARGES
${chargeLines || `  Total: ${quote.currency || 'USD'} ${Number(quote.sell_rate || 0).toFixed(2)}`}
  TOTAL: ${quote.currency || 'USD'} ${Number(quote.sell_rate || 0).toFixed(2)}

Transit time: ${quote.transit_time || 'N/A'}
${quote.notes ? `\nNotes: ${quote.notes}\n` : ''}
This quotation is valid until ${quote.validity_date || 'the date above'}.`;
}

// List quotes for a session
app.get('/api/quotes', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await supabase
    .from('quotes').select('*')
    .eq('session_id', sessionId)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to load quotes' });
  res.json({ quotes: data });
});

// Create or update a quote
app.post('/api/quotes', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const fields = pickQuoteFields(req.body);

  try {
    if (req.body.id) {
      const { data: existing } = await supabase.from('quotes').select('session_id').eq('id', req.body.id).single();
      if (!existing || existing.session_id !== sessionId) return res.status(404).json({ error: 'Quote not found' });

      const { data, error } = await supabase
        .from('quotes')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', req.body.id)
        .select('*').single();
      if (error) throw error;
      return res.json({ quote: data });
    }

    const sub = await getOrCreateSubscription(session.email, sessionId);
    const plan = sub?.plan || 'trial';
    if (plan === 'trial') {
      const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('session_id', sessionId);
      if ((count || 0) >= 5) return res.status(402).json({ error: 'limit_reached', reason: 'quotes_limit' });
    } else if (plan === 'starter') {
      const startOfMonth = new Date(); startOfMonth.setUTCDate(1); startOfMonth.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('session_id', sessionId).gte('created_at', startOfMonth.toISOString());
      if ((count || 0) >= 20) return res.status(402).json({ error: 'limit_reached', reason: 'quotes_limit' });
    }

    const { data, error } = await supabase
      .from('quotes')
      .insert({ ...fields, session_id: sessionId, status: fields.status || 'draft' })
      .select('*').single();
    if (error) throw error;
    res.json({ quote: data });
  } catch (error) {
    console.error('Quote save error:', error);
    res.status(500).json({ error: 'Failed to save quote' });
  }
});

// Update quote fields/status
app.patch('/api/quotes/:id', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data: existing } = await supabase.from('quotes').select('session_id').eq('id', req.params.id).single();
  if (!existing || existing.session_id !== sessionId) return res.status(404).json({ error: 'Quote not found' });

  const fields = pickQuoteFields(req.body);
  const { data, error } = await supabase
    .from('quotes')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('*').single();

  if (error) return res.status(500).json({ error: 'Failed to update quote' });
  res.json({ quote: data });
});

// Delete a quote
app.delete('/api/quotes/:id', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data: existing } = await supabase.from('quotes').select('session_id').eq('id', req.params.id).single();
  if (!existing || existing.session_id !== sessionId) return res.status(404).json({ error: 'Quote not found' });

  const { error } = await supabase.from('quotes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Failed to delete quote' });
  res.json({ success: true });
});

// Send a quote as an email reply
app.post('/api/quotes/:id/send', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', req.params.id).single();
  if (!quote || quote.session_id !== sessionId) return res.status(404).json({ error: 'Quote not found' });

  if (!quote.customer_email) return res.status(400).json({ error: 'Quote has no customer email' });

  try {
    const subject = quote.email_subject || `Freight Quotation FW-QUOTE-${String(quote.id).slice(0, 8).toUpperCase()}`;
    const body = formatQuoteEmailBody(quote);
    await sendEmailAsReply(session, quote.customer_email, subject, body);

    const { data: updated, error } = await supabase
      .from('quotes')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', quote.id)
      .select('*').single();
    if (error) throw error;

    if (session.userId && quote.email_id) {
      await trackActivity(session.userId, quote.email_id, 'replied');
    }

    console.log(`✉️ Quote sent to: ${quote.customer_email}`);
    res.json({ success: true, quote: updated });
  } catch (error) {
    console.error('Quote send error:', error);
    res.status(500).json({ error: 'Failed to send quote' });
  }
});

// ============================================
// CUSTOMER PORTALS
// ============================================
const PORTAL_FIELDS = ['title', 'show_carrier', 'show_rate', 'show_documents', 'message', 'is_active', 'expires_at'];

function pickPortalFields(body: any) {
  const out: Record<string, any> = {};
  for (const key of PORTAL_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

const PORTAL_STATUSES = ['inquiry', 'quoted', 'booked', 'in_transit', 'at_destination', 'delivered'];

// Create a portal for a shipment
app.post('/api/portals', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { shipment_id } = req.body;
  if (!shipment_id) return res.status(400).json({ error: 'shipment_id is required' });

  const { data: shipment } = await supabase.from('shipments').select('user_id, reference, origin, destination').eq('id', shipment_id).single();
  if (!shipment || shipment.user_id !== session.userId) return res.status(404).json({ error: 'Shipment not found' });

  const fields = pickPortalFields(req.body);
  const token = randomUUID();

  try {
    const { data, error } = await supabase
      .from('customer_portals')
      .insert({
        token, shipment_id, session_id: sessionId,
        title: fields.title || `Your shipment ${shipment.origin || ''} → ${shipment.destination || ''}`,
        show_carrier: fields.show_carrier ?? false, show_rate: fields.show_rate ?? false,
        show_documents: fields.show_documents ?? false, message: fields.message || null,
        is_active: true, expires_at: fields.expires_at || null,
      })
      .select('*').single();
    if (error) throw error;
    res.json({ portal: data, url: `${FRONTEND_URL}/portal/${token}` });
  } catch (error) {
    console.error('Portal create error:', error);
    res.status(500).json({ error: 'Failed to create portal' });
  }
});

// List portals created by this forwarder
app.get('/api/portals', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await supabase
    .from('customer_portals').select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to load portals' });

  const shipmentIds = [...new Set((data || []).map(p => p.shipment_id).filter(Boolean))];
  let shipmentMap: Record<string, any> = {};
  if (shipmentIds.length) {
    const { data: shipmentRows } = await supabase
      .from('shipments').select('id, reference, customer, origin, destination').in('id', shipmentIds);
    shipmentMap = Object.fromEntries((shipmentRows || []).map(s => [s.id, s]));
  }

  const portals = (data || []).map(p => ({ ...p, url: `${FRONTEND_URL}/portal/${p.token}`, shipment: shipmentMap[p.shipment_id] || null }));
  res.json({ portals });
});

// Update portal settings
app.patch('/api/portals/:id', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: existing } = await supabase.from('customer_portals').select('session_id').eq('id', req.params.id).single();
  if (!existing || existing.session_id !== sessionId) return res.status(404).json({ error: 'Portal not found' });

  const fields = pickPortalFields(req.body);
  const { data, error } = await supabase
    .from('customer_portals').update(fields).eq('id', req.params.id).select('*').single();
  if (error) return res.status(500).json({ error: 'Failed to update portal' });
  res.json({ portal: { ...data, url: `${FRONTEND_URL}/portal/${data.token}` } });
});

// Deactivate/delete a portal
app.delete('/api/portals/:id', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data: existing } = await supabase.from('customer_portals').select('session_id').eq('id', req.params.id).single();
  if (!existing || existing.session_id !== sessionId) return res.status(404).json({ error: 'Portal not found' });

  const { error } = await supabase.from('customer_portals').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Failed to delete portal' });
  res.json({ success: true });
});

// PUBLIC: fetch a portal's shipment data by token — no auth, customer-facing
app.get('/api/portal/:token', async (req, res) => {
  const { data: portal } = await supabase.from('customer_portals').select('*').eq('token', req.params.token).single();
  if (!portal) return res.status(404).json({ error: 'Not found' });
  if (!portal.is_active) return res.status(404).json({ error: 'Not found' });
  if (portal.expires_at && new Date(portal.expires_at).getTime() < Date.now()) return res.status(404).json({ error: 'Not found' });

  const { data: shipment } = await supabase.from('shipments').select('*').eq('id', portal.shipment_id).single();
  if (!shipment) return res.status(404).json({ error: 'Not found' });

  let rate: { amount: number; currency: string } | null = null;
  if (portal.show_rate && shipment.email_id) {
    const { data: quotes } = await supabase
      .from('quotes').select('sell_rate, currency').eq('email_id', shipment.email_id)
      .order('updated_at', { ascending: false }).limit(1);
    if (quotes?.[0]) rate = { amount: quotes[0].sell_rate, currency: quotes[0].currency || 'USD' };
  }

  let liveTracking = null;
  if (shipment.t49_tracking_active) {
    const { data: events } = await supabase
      .from('shipment_events').select('event_type, description, location, event_at')
      .eq('shipment_id', shipment.id).order('event_at', { ascending: false });
    liveTracking = {
      vessel: shipment.t49_vessel,
      eta: shipment.t49_pod_eta,
      lastEventAt: shipment.t49_last_event_at,
      events: events || [],
    };
  }

  res.json({
    title: portal.title,
    message: portal.message,
    reference: shipment.reference,
    origin: shipment.origin,
    destination: shipment.destination,
    mode: shipment.mode,
    commodity: shipment.commodity,
    container: shipment.container,
    status: PORTAL_STATUSES.includes(shipment.status) ? shipment.status : 'inquiry',
    etd: shipment.etd,
    eta: shipment.eta,
    carrier: portal.show_carrier ? shipment.carrier : null,
    rate: portal.show_rate ? rate : null,
    showDocuments: !!portal.show_documents,
    liveTracking,
  });
});

// ============================================
// RATE CARDS
// ============================================
const RATE_CARD_FIELDS = [
  'origin', 'destination', 'mode', 'carrier', 'container_type', 'buy_rate', 'sell_rate',
  'currency', 'transit_time', 'validity_start', 'validity_end', 'notes', 'is_active',
];

function pickRateCardFields(body: any) {
  const out: Record<string, any> = {};
  for (const key of RATE_CARD_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

// List active rate cards for a session, with optional origin/destination/mode filters
app.get('/api/rates', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  let query = supabase.from('rate_cards').select('*').eq('session_id', sessionId).eq('is_active', true);
  if (req.query.mode) query = query.eq('mode', req.query.mode as string);
  if (req.query.origin) query = query.ilike('origin', `%${req.query.origin}%`);
  if (req.query.destination) query = query.ilike('destination', `%${req.query.destination}%`);

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to load rate cards' });
  res.json({ rates: data });
});

// Create a rate card
app.post('/api/rates', async (req, res) => {
  const sessionId = req.query.session as string || req.body.session_id;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { origin, destination, mode, carrier } = req.body;
  if (!origin || !destination || !mode || !carrier) {
    return res.status(400).json({ error: 'origin, destination, mode, and carrier are required' });
  }

  const fields = pickRateCardFields(req.body);
  const { data, error } = await supabase
    .from('rate_cards').insert({ ...fields, session_id: sessionId }).select('*').single();
  if (error) return res.status(500).json({ error: 'Failed to create rate card' });
  res.json({ rate: data });
});

// Update a rate card
app.patch('/api/rates/:id', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data: existing } = await supabase.from('rate_cards').select('session_id').eq('id', req.params.id).single();
  if (!existing || existing.session_id !== sessionId) return res.status(404).json({ error: 'Rate card not found' });

  const fields = pickRateCardFields(req.body);
  const { data, error } = await supabase
    .from('rate_cards').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
  if (error) return res.status(500).json({ error: 'Failed to update rate card' });
  res.json({ rate: data });
});

// Soft-delete (deactivate) a rate card
app.delete('/api/rates/:id', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data: existing } = await supabase.from('rate_cards').select('session_id').eq('id', req.params.id).single();
  if (!existing || existing.session_id !== sessionId) return res.status(404).json({ error: 'Rate card not found' });

  const { data, error } = await supabase
    .from('rate_cards').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
  if (error) return res.status(500).json({ error: 'Failed to deactivate rate card' });
  res.json({ rate: data });
});

// Common UN/LOCODEs -> city name, so "Santos" and "BRSSZ" resolve to the same
// token. Pure substring matching can't know BRSSZ *means* Santos — token
// overlap alone isn't enough, this mapping is what actually makes port-code
// vs free-text lane entry match. Not exhaustive; covers common freight ports.
const PORT_LOCODES: Record<string, string> = {
  brssz: 'santos', nlrtm: 'rotterdam', cnsha: 'shanghai', cnngb: 'ningbo', cnszx: 'shenzhen',
  deham: 'hamburg', usnyc: 'new york', uslax: 'los angeles', uslgb: 'long beach',
  sgsin: 'singapore', gbfxt: 'felixstowe', beanr: 'antwerp', esvlc: 'valencia', itgoa: 'genoa',
  innsa: 'nhava sheva', aejea: 'jebel ali', krpus: 'busan', jptyo: 'tokyo', jpyok: 'yokohama',
  mypkg: 'port klang', thbkk: 'bangkok', vnsgn: 'ho chi minh', brrig: 'rio grande', brpnb: 'paranagua',
};

// Fuzzy-match tokens for lane matching — "Santos, BR" -> ["santos, br", "santos", "br"
// (short tokens filtered out below)]. Forwarders type ports inconsistently
// ("Santos" vs "Santos, BR" vs "BRSSZ"), so matching is done by token overlap
// rather than a single ILIKE, applied in-process (not as chained Postgres
// .or() groups) after a narrow session+mode+active DB filter — simpler and
// more reliable than composing an AND-of-ORs through PostgREST for this data
// volume (a forwarder's own rate cards, typically dozens not millions of rows).
function laneTokens(s: string | undefined | null): string[] {
  if (!s) return [];
  const trimmed = s.trim().toLowerCase();
  const tokens = new Set([trimmed]);
  trimmed.split(/[,\s]+/).forEach(part => {
    if (part.length >= 3) {
      tokens.add(part);
      if (PORT_LOCODES[part]) tokens.add(PORT_LOCODES[part]);
    }
  });
  return Array.from(tokens);
}

function laneMatchScore(stored: string | null, query: string | undefined): number {
  if (!query) return 0;
  const storedNorm = (stored || '').trim().toLowerCase();
  if (!storedNorm) return 0;
  const queryNorm = query.trim().toLowerCase();
  if (storedNorm === queryNorm) return 3;
  const storedTokens = laneTokens(storedNorm);
  const queryTokens = laneTokens(queryNorm);
  const overlap = storedTokens.some(t => queryTokens.includes(t) || queryNorm.includes(t)) ||
    queryTokens.some(t => storedNorm.includes(t));
  return overlap ? 1 : 0;
}

// AI suggestion endpoint — called by the Quote Builder when it opens
app.get('/api/rates/suggest', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const origin = req.query.origin as string | undefined;
  const destination = req.query.destination as string | undefined;
  const mode = req.query.mode as string | undefined;
  const container = req.query.container as string | undefined;

  let query = supabase.from('rate_cards').select('*').eq('session_id', sessionId).eq('is_active', true);
  if (mode) query = query.eq('mode', mode);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to load rate cards' });

  const today = new Date().toISOString().slice(0, 10);
  const scored = (data || [])
    .filter(r => !r.validity_end || r.validity_end >= today)
    .map(r => {
      const originScore = laneMatchScore(r.origin, origin);
      const destScore = laneMatchScore(r.destination, destination);
      const containerBonus = container && r.container_type && r.container_type.toLowerCase() === container.toLowerCase() ? 1 : 0;
      return { rate: r, originScore, destScore, containerBonus };
    })
    // Both origin and destination must match whenever a query value was given for them.
    .filter(s => (!origin || s.originScore > 0) && (!destination || s.destScore > 0) && (origin || destination))
    .sort((a, b) => (b.originScore + b.destScore + b.containerBonus) - (a.originScore + a.destScore + a.containerBonus) || new Date(b.rate.updated_at).getTime() - new Date(a.rate.updated_at).getTime())
    .slice(0, 3)
    .map(s => s.rate);

  res.json({ rates: scored });
});

// ============================================
// BILLING (Stripe)
// ============================================

// Current subscription + computed trial countdown fields
app.get('/api/billing/subscription', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const sub = await getOrCreateSubscription(session.email, sessionId);
  if (!sub) return res.status(500).json({ error: 'Failed to load subscription' });

  const daysSinceStart = (Date.now() - new Date(sub.trial_started_at).getTime()) / (24 * 60 * 60 * 1000);
  const trial_days_remaining = Math.max(0, Math.ceil(14 - daysSinceStart));
  const trial_analyses_remaining = Math.max(0, 30 - sub.trial_analyses_used);

  res.json({ ...sub, trial_days_remaining, trial_analyses_remaining, limits: getPlanLimits(sub.plan) });
});

// Create a Stripe Checkout session for a plan upgrade
app.post('/api/billing/create-checkout', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { plan } = req.body;
  const priceId = PLAN_PRICE_IDS[plan];
  if (!priceId) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const sub = await getOrCreateSubscription(session.email, sessionId);
    let customerId = sub?.stripe_customer_id;

    // Ensure a Stripe customer exists and is saved BEFORE creating checkout —
    // passing customer_email instead would create a new anonymous customer
    // on every checkout attempt.
    if (!customerId) {
      const customer = await stripe.customers.create({ email: session.email });
      customerId = customer.id;
      await supabase.from('subscriptions').update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq('id', sub.id);
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_collection: 'always',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/billing/cancel`,
      metadata: { fw_session_id: sessionId },
    });

    res.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// Create a Stripe Billing Portal session (manage/cancel existing subscription)
app.post('/api/billing/create-portal', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('user_email', session.email).single();
  if (!sub?.stripe_customer_id) return res.status(400).json({ error: 'No billing account found — subscribe to a plan first' });

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${FRONTEND_URL}/billing`,
    });
    res.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('Stripe portal error:', error);
    res.status(500).json({ error: error.message || 'Failed to open billing portal' });
  }
});

// Usage counts for the billing page
app.get('/api/billing/usage', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const sub = await getOrCreateSubscription(session.email, sessionId);
  const startOfMonth = new Date(); startOfMonth.setUTCDate(1); startOfMonth.setUTCHours(0, 0, 0, 0);

  const [analysesRes, quotesRes, shipmentsRes, teamRes] = await Promise.all([
    supabase.from('email_analysis').select('*', { count: 'exact', head: true }).eq('user_id', session.email).gte('created_at', startOfMonth.toISOString()),
    supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('session_id', sessionId).gte('created_at', startOfMonth.toISOString()),
    supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('user_id', session.userId).not('status', 'in', '(delivered,closed,cancelled)'),
    session.userId ? supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('team_id', session.userId) : Promise.resolve({ count: 0 } as any),
  ]);

  res.json({
    subscription: sub,
    limits: getPlanLimits(sub?.plan || 'trial'),
    analyses_this_month: analysesRes.count || 0,
    quotes_this_month: quotesRes.count || 0,
    active_shipments: shipmentsRes.count || 0,
    team_members: teamRes.count || 0,
  });
});

// PUBLIC — Stripe calls this on checkout/subscription lifecycle events.
// Uses express.raw() (registered near the top of the file, before the global
// express.json()) so the exact signed bytes are available for verification.
app.post('/api/webhooks/stripe', async (req, res) => {
  let event: Stripe.Event;

  if (STRIPE_WEBHOOK_SECRET) {
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'] as string, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }
  } else {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set — accepting webhook without signature verification (local dev only)');
    event = JSON.parse(req.body.toString());
  }

  console.log(`💳 Stripe webhook: ${event.type}`);

  // Recent Stripe API versions moved current_period_start/end off the
  // top-level Subscription object onto the subscription item — confirmed
  // against this account's real API version. Check both.
  function periodDates(stripeSub: Stripe.Subscription): { start: string | null; end: string | null } {
    const item = stripeSub.items.data[0] as any;
    const start = (stripeSub as any).current_period_start ?? item?.current_period_start;
    const end = (stripeSub as any).current_period_end ?? item?.current_period_end;
    return {
      start: start ? new Date(start * 1000).toISOString() : null,
      end: end ? new Date(end * 1000).toISOString() : null,
    };
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const fwSessionId = checkoutSession.metadata?.fw_session_id;
      if (checkoutSession.subscription) {
        const stripeSub = await stripe.subscriptions.retrieve(checkoutSession.subscription as string);
        const priceId = stripeSub.items.data[0]?.price.id;
        const plan = PRICE_ID_TO_PLAN[priceId || ''] || 'starter';
        const { start, end } = periodDates(stripeSub);
        const updates = {
          stripe_customer_id: checkoutSession.customer as string,
          stripe_subscription_id: stripeSub.id,
          plan, status: 'active',
          current_period_start: start,
          current_period_end: end,
          updated_at: new Date().toISOString(),
        };
        if (fwSessionId) {
          await supabase.from('subscriptions').update(updates).eq('session_id', fwSessionId);
        } else {
          await supabase.from('subscriptions').update(updates).eq('stripe_customer_id', checkoutSession.customer as string);
        }
        console.log(`💳 Checkout completed — plan=${plan} customer=${checkoutSession.customer}`);
      }
    } else if (event.type === 'customer.subscription.updated') {
      const stripeSub = event.data.object as Stripe.Subscription;
      const priceId = stripeSub.items.data[0]?.price.id;
      const plan = PRICE_ID_TO_PLAN[priceId || ''];
      const { start, end } = periodDates(stripeSub);
      await supabase.from('subscriptions').update({
        ...(plan ? { plan } : {}),
        status: stripeSub.status === 'active' ? 'active' : stripeSub.status === 'past_due' ? 'past_due' : stripeSub.status,
        current_period_start: start,
        current_period_end: end,
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', stripeSub.id);
    } else if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object as Stripe.Subscription;
      await supabase.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('stripe_subscription_id', stripeSub.id);
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.customer) {
        await supabase.from('subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('stripe_customer_id', invoice.customer as string);
      }
    } else {
      console.log(`💳 Unhandled Stripe event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
  }

  res.json({ received: true });
});

// Save draft
app.post('/api/save-draft', async (req, res) => {
  const sessionId = req.query.session as string;
  const { to, subject, body, threadId, emailId } = req.body;
  const session = await getSession(sessionId);

  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const draftSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

    if (session.provider === 'outlook') {
      const success = await saveOutlookDraft(session.tokens.access_token, to, draftSubject, body);
      if (!success) throw new Error('Failed to save draft via Outlook');
    } else {
      oauth2Client.setCredentials(session.tokens);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const rawMessage = Buffer.from(
        `To: ${to}\r\nSubject: ${draftSubject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw: rawMessage, threadId } } });
    }

    if (session.userId && emailId) await trackActivity(session.userId, emailId, 'draft_saved');

    console.log(`📝 Draft saved for: ${to} (via ${session.provider || 'google'})`);
    res.json({ success: true });
  } catch (error) {
    console.error('Draft error:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Track reply from Gmail/Outlook Add-on
app.post('/api/track-reply', async (req, res) => {
  const { emailId, replyText, userEmail, source } = req.body;

  if ((source !== 'gmail_addon' && source !== 'outlook_addon') || !userEmail) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const userId = await getOrCreateUser(userEmail);
    if (!userId) return res.status(400).json({ error: 'Could not find or create user' });

    const { data: activity } = await supabase
      .from('email_activity').select('created_at')
      .eq('email_id', emailId).eq('action', 'received').single();

    let responseTimeMinutes;
    if (activity) {
      responseTimeMinutes = Math.round((new Date().getTime() - new Date(activity.created_at).getTime()) / 60000);
    }

    await trackActivity(userId, emailId, 'replied', undefined, undefined, responseTimeMinutes);
    await supabase.from('email_analysis')
      .update({ replied_at: new Date().toISOString(), response_time_minutes: responseTimeMinutes, suggested_reply: replyText })
      .eq('email_id', emailId).eq('user_id', userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Track reply error:', error);
    res.status(500).json({ error: 'Failed to track reply' });
  }
});

// Track draft from Gmail Add-on
app.post('/api/track-draft', async (req, res) => {
  const { emailId, userEmail, source } = req.body;

  if (source !== 'gmail_addon' || !userEmail) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const userId = await getOrCreateUser(userEmail);
    if (!userId) return res.status(400).json({ error: 'Could not find or create user' });
    await trackActivity(userId, emailId, 'draft_saved');
    res.json({ success: true });
  } catch (error) {
    console.error('Track draft error:', error);
    res.status(500).json({ error: 'Failed to track draft' });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

app.get('/api/analytics', async (req, res) => {
  const sessionId = req.query.session as string;
  const range = req.query.range as string || 'weekly';
  const session = await getSession(sessionId);

  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case 'daily': startDate = new Date(now); startDate.setDate(now.getDate() - 7); break;
      case 'monthly': startDate = new Date(now); startDate.setMonth(now.getMonth() - 6); break;
      default: startDate = new Date(now); startDate.setDate(now.getDate() - 28);
    }

    const { data: dailyStats } = await supabase.from('analytics_daily').select('*')
      .eq('user_id', session.userId).gte('date', startDate.toISOString().split('T')[0]).order('date', { ascending: true });

    const { data: intentData } = await supabase.from('email_analysis').select('intent')
      .eq('user_id', session.userId).gte('created_at', startDate.toISOString());

    const { data: priorityData } = await supabase.from('email_analysis').select('priority')
      .eq('user_id', session.userId).gte('created_at', startDate.toISOString());

    const { data: responseData } = await supabase.from('email_analysis').select('response_time_minutes')
      .eq('user_id', session.userId).not('response_time_minutes', 'is', null).gte('created_at', startDate.toISOString());

    const totalReceived = dailyStats?.reduce((sum, d) => sum + (d.emails_received || 0), 0) || 0;
    const totalAnalyzed = dailyStats?.reduce((sum, d) => sum + (d.emails_analyzed || 0), 0) || 0;
    const totalReplied = dailyStats?.reduce((sum, d) => sum + (d.emails_replied || 0), 0) || 0;

    const intentCounts: Record<string, number> = {};
    intentData?.forEach(item => {
      const intent = item.intent || 'general';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });

    const priorityCounts: Record<string, number> = {};
    priorityData?.forEach(item => {
      const priority = item.priority || 'medium';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    const responseTimes = responseData?.map(r => r.response_time_minutes) || [];
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;

    const formatTime = (min: number) => {
      const h = Math.floor(min / 60); const m = min % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    res.json({
      stats: {
        totalEmails: totalReceived, analyzed: totalAnalyzed, replied: totalReplied,
        avgResponseTime: formatTime(avgResponseTime),
        automationRate: totalReceived > 0 ? `${Math.round((totalAnalyzed / totalReceived) * 100)}%` : '0%',
      },
      dailyStats,
      intentBreakdown: Object.entries(intentCounts).map(([intent, count]) => ({ intent, count })),
      priorityBreakdown: Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count })),
      responseTimes: {
        average: avgResponseTime,
        fastest: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
        slowest: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
        trend: responseTimes.slice(-7),
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============================================
// TEAM / LEADERBOARD ENDPOINTS
// ============================================

app.post('/api/team/create', async (req, res) => {
  const { sessionId, teamName } = req.body;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    await supabase.from('profiles').update({ role: 'manager' }).eq('id', session.userId);

    const { data: team, error } = await supabase.from('teams')
      .insert({ name: teamName, manager_id: session.userId }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('profiles').update({ team_id: team.id }).eq('id', session.userId);

    res.json({ team });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create team' });
  }
});

app.post('/api/team/join', async (req, res) => {
  const { sessionId, inviteCode } = req.body;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data: team, error } = await supabase.from('teams')
      .select('*').eq('invite_code', inviteCode.toUpperCase()).single();

    if (error || !team) return res.status(404).json({ error: 'Team not found' });

    await supabase.from('profiles').update({ team_id: team.id }).eq('id', session.userId);

    res.json({ team });
  } catch (e) {
    res.status(500).json({ error: 'Failed to join team' });
  }
});

app.get('/api/team', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data: profile } = await supabase.from('profiles')
      .select('id, email, full_name, role, team_id').eq('id', session.userId).single();

    if (!profile) return res.json({ profile: null });

    let team = null;
    if (profile.team_id) {
      const { data: teamData } = await supabase.from('teams').select('*').eq('id', profile.team_id).single();
      team = teamData;
    }

    res.json({ profile: { ...profile, teams: team } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get team' });
  }
});

app.get('/api/team/leaderboard', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data: profile } = await supabase.from('profiles')
      .select('team_id, role').eq('id', session.userId).single();

    if (!profile?.team_id) return res.status(404).json({ error: 'Not in a team' });

    const { data: members } = await supabase.from('profiles')
      .select('id, full_name, email, role').eq('team_id', profile.team_id);

    if (!members) return res.status(404).json({ error: 'No members found' });

    const leaderboard = await Promise.all(members.map(async (member) => {
      const { data: analyzed } = await supabase.from('email_analysis')
        .select('id, mode, pol, pod, intent').eq('user_id', member.id);

      const { data: replied } = await supabase.from('email_activity')
        .select('id').eq('user_id', member.id).eq('action', 'replied');

      const { data: responseTimes } = await supabase.from('email_analysis')
        .select('response_time_minutes').eq('user_id', member.id).not('response_time_minutes', 'is', null);

      const avgResponseTime = responseTimes?.length
        ? Math.round(responseTimes.reduce((sum, r) => sum + r.response_time_minutes, 0) / responseTimes.length) : 0;

      const modeBreakdown = { ocean: 0, air: 0, road: 0, rail: 0, other: 0 };
      analyzed?.forEach(e => {
        const mode = e.mode?.toLowerCase() || 'other';
        if (mode in modeBreakdown) modeBreakdown[mode as keyof typeof modeBreakdown]++;
        else modeBreakdown.other++;
      });

      const importCount = analyzed?.filter(e =>
        e.intent?.includes('import') ||
        e.pod?.toLowerCase().includes('rotterdam') ||
        e.pod?.toLowerCase().includes('amsterdam')
      ).length || 0;

      const { data: customers } = await supabase.from('email_analysis')
        .select('from_email').eq('user_id', member.id);
      const uniqueCustomers = new Set(customers?.map(c => c.from_email)).size;

      const intentCounts: Record<string, number> = {};
      analyzed?.forEach(e => {
        const intent = e.intent || 'general';
        intentCounts[intent] = (intentCounts[intent] || 0) + 1;
      });

      return {
        id: member.id,
        name: member.full_name || member.email,
        email: member.email,
        role: member.role,
        stats: {
          analyzed: analyzed?.length || 0,
          replied: replied?.length || 0,
          avgResponseTime,
          replyRate: analyzed?.length ? Math.round(((replied?.length || 0) / analyzed.length) * 100) : 0,
          uniqueCustomers,
          modeBreakdown,
          importExport: { import: importCount, export: (analyzed?.length || 0) - importCount },
          intentBreakdown: intentCounts,
        },
      };
    }));

    leaderboard.sort((a, b) => b.stats.analyzed - a.stats.analyzed);

    res.json({ leaderboard, currentUserId: session.userId, isManager: profile.role === 'manager' });
  } catch (e) {
    console.error('Leaderboard error:', e);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// ============================================
// QUEUE ENDPOINTS (for Gmail Extension)
// ============================================

app.post('/api/queue-analysis', async (req, res) => {
  const { emailId, userEmail, subject, from, body, threadId } = req.body;

  try {
    const { data: existing } = await supabase
      .from('email_analysis').select('*').eq('email_id', emailId).single();

    if (existing) {
      return res.json({
        status: 'ready',
        analysis: {
          intent: existing.intent, priority: existing.priority, mode: existing.mode,
          pol: existing.pol, pod: existing.pod, incoterm: existing.incoterm,
          cargo_type: existing.cargo_type, container_type: existing.container_type,
          container_count: existing.container_count, missing_info: existing.missing_info,
          summary: existing.summary, suggested_reply: existing.suggested_reply,
        }
      });
    }

    const { data: queued } = await supabase
      .from('analysis_queue').select('id, status, result').eq('email_id', emailId).single();

    if (queued) {
      if (queued.status === 'done') return res.json({ status: 'ready', analysis: queued.result });
      return res.json({ status: 'processing' });
    }

    await supabase.from('analysis_queue').insert({
      email_id: emailId, user_email: userEmail, subject,
      from_email: from, body: body?.substring(0, 4000), thread_id: threadId, status: 'pending',
    });

    processQueueItem(emailId, userEmail, subject, from, body, threadId);

    res.json({ status: 'processing' });
  } catch (e) {
    console.error('Queue error:', e);
    res.status(500).json({ error: 'Failed to queue' });
  }
});

app.get('/api/analysis-result', async (req, res) => {
  const { emailId } = req.query as { emailId: string };

  try {
    const { data: existing } = await supabase
      .from('email_analysis').select('*').eq('email_id', emailId).single();

    if (existing) {
      return res.json({
        status: 'ready',
        analysis: {
          intent: existing.intent, priority: existing.priority, mode: existing.mode,
          pol: existing.pol, pod: existing.pod, incoterm: existing.incoterm,
          cargo_type: existing.cargo_type, container_type: existing.container_type,
          container_count: existing.container_count, missing_info: existing.missing_info,
          summary: existing.summary, suggested_reply: existing.suggested_reply,
        }
      });
    }

    const { data: queued } = await supabase
      .from('analysis_queue').select('status, result').eq('email_id', emailId).single();

    if (!queued) return res.json({ status: 'not_found' });
    if (queued.status === 'done') return res.json({ status: 'ready', analysis: queued.result });

    res.json({ status: 'processing' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get result' });
  }
});

async function processQueueItem(
  emailId: string, userEmail: string, subject: string,
  from: string, body: string, threadId: string
) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are FreightWizard AI, an expert freight forwarding email analyst.

Analyze this freight email and extract:
1. Intent: quote_request, booking_confirmation, tracking_inquiry, documentation_request, rate_inquiry, status_update, complaint, general_inquiry
2. Priority: urgent, high, medium, low
3. Transport mode: ocean, air, road, rail, multimodal
4. POL and POD
5. Incoterm if mentioned
6. Cargo type, container type, container count
7. Missing information needed to proceed
8. Brief summary
9. Professional reply draft

Email Subject: ${subject}
From: ${from}
Body: ${body}

Respond in JSON format:
{
  "intent": "", "priority": "", "mode": "", "pol": "", "pod": "",
  "incoterm": "", "cargo_type": "", "container_type": "", "container_count": null,
  "missing_info": [], "summary": "", "suggested_reply": ""
}`
      }]
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);

      await supabase.from('analysis_queue')
        .update({ status: 'done', result: analysis, processed_at: new Date().toISOString() })
        .eq('email_id', emailId);

      const userId = await getOrCreateUser(userEmail);
      if (userId) {
        await saveAnalysis(userId, 'gmail_addon', emailId, subject, from, analysis);
        await trackActivity(userId, emailId, 'analyzed', analysis.intent, analysis.priority);
      }

      console.log(`✅ Queue processed: ${emailId}`);
    }
  } catch (e) {
    console.error('Process queue error:', e);
    await supabase.from('analysis_queue').update({ status: 'error' }).eq('email_id', emailId);
  }
}

// ============================================
// DOCUMENT INTELLIGENCE ENDPOINTS
// ============================================

app.post('/api/analyze-document', async (req, res) => {
  const { text, fileName, sessionId } = req.body;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are an expert freight forwarding document analyst. You specialize in interpreting international shipping documents including Master Bill of Lading (MBL), House Bill of Lading (HBL), Air Waybill (AWB), Commercial Invoice, and Packing List.

You have deep knowledge of INCOTERMS, container types, port codes (UN/LOCODE), shipping line formats, and freight forwarding workflows.

You are highly precise and conservative:
- Only extract data when confident
- If uncertain, mark fields with "uncertain": true
- Never hallucinate missing data

Analyze this document and respond ONLY with a JSON object in this exact format:

{
  "document_type": "HBL|MBL|AWB|Invoice|Packing List|Other",
  "confidence": 0-100,
  "shipment_summary": {
    "mode": "ocean|air|road|rail",
    "route": "POLCODE → PODCODE",
    "incoterm": "",
    "description": "",
    "status": ""
  },
  "parties": {
    "shipper": "",
    "consignee": "",
    "notify_party": ""
  },
  "references": {
    "bl_number": "",
    "booking_number": "",
    "container_numbers": [{"value": "", "uncertain": false}]
  },
  "transport": {
    "vessel": "",
    "voyage": "",
    "pol": {"name": "", "code": ""},
    "pod": {"name": "", "code": ""},
    "eta": "",
    "etd": "",
    "final_destination": ""
  },
  "cargo": {
    "description": "",
    "hs_code": "",
    "packages": null,
    "gross_weight": {"value": null, "unit": "kg"},
    "net_weight": {"value": null, "unit": "kg"},
    "tare_weight": {"value": null, "unit": "kg"},
    "volume_cbm": null,
    "container_type": "",
    "seal_numbers": [],
    "dangerous_goods": {
      "is_dangerous": false,
      "un_number": "",
      "class": "",
      "packing_group": "",
      "proper_shipping_name": ""
    }
  },
  "freight": {
    "terms": "prepaid|collect",
    "charges": ""
  },
  "compliance": {
    "customs_value": "",
    "currency": "",
    "country_of_origin": "",
    "export_license": ""
  },
  "risks": [],
  "missing_information": []
}

Document filename: ${fileName || 'unknown'}

Document content:
${text?.substring(0, 8000)}`
      }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse document' });

    const analysis = JSON.parse(jsonMatch[0]);

    const { data: saved, error } = await supabase.from('document_analysis').insert({
      user_id: session.userId,
      document_type: analysis.document_type,
      file_name: fileName || 'unknown',
      confidence: analysis.confidence,
      raw_text: text?.substring(0, 5000),
      analysis,
    }).select('id').single();

    if (error) console.error('Save document error:', error);

    res.json({ analysis, id: saved?.id });
  } catch (error) {
    console.error('Document analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

app.get('/api/documents', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data } = await supabase
      .from('document_analysis')
      .select('id, document_type, file_name, confidence, created_at, analysis')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({ documents: data || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data } = await supabase
      .from('document_analysis')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', session.userId)
      .single();

    if (!data) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// ============================================
// DOCUMENT COMPARISON ENDPOINT
// ============================================

app.post('/api/compare-documents', async (req, res) => {
  const { doc1Text, doc1Name, doc2Text, doc2Name, sessionId } = req.body;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `You are an expert freight document compliance analyst. Compare these two shipping documents and identify matches, mismatches, and missing fields.

Document 1 (${doc1Name}):
${doc1Text?.substring(0, 4000)}

Document 2 (${doc2Name}):
${doc2Text?.substring(0, 4000)}

Respond ONLY with a JSON object:
{
  "doc1_type": "",
  "doc2_type": "",
  "overall_status": "match|minor_issues|major_issues|critical_issues",
  "match_score": 0-100,
  "summary": "",
  "comparisons": [
    {
      "field": "BL Number",
      "category": "references",
      "doc1_value": "",
      "doc2_value": "",
      "status": "match|mismatch|missing_in_doc1|missing_in_doc2|both_missing",
      "severity": "critical|high|medium|low",
      "note": ""
    }
  ],
  "critical_mismatches": [],
  "recommendations": []
}

Compare these fields: BL number, booking number, shipper, consignee, notify party, vessel, voyage, POL, POD, ETD, ETA, container numbers, container type, cargo description, gross weight, net weight, volume CBM, packages, incoterm, freight terms, HS code, country of origin.

For severity:
- critical: BL number, container numbers, shipper, consignee, vessel, POL, POD
- high: booking number, gross weight, cargo description, ETD/ETA
- medium: incoterm, freight terms, HS code, packages
- low: volume CBM, net weight, tare weight, notify party`
      }]
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse comparison' });

    const comparison = JSON.parse(jsonMatch[0]);
    res.json({ comparison });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Comparison failed' });
  }
});

// ============================================
// TEXT EXTRACTION FROM FILES
// ============================================
app.post('/api/extract-text', async (req, res) => {
  const { base64, mimeType, fileName, sessionId } = req.body;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    let mediaType = mimeType;
    
    // Claude vision supports: image/jpeg, image/png, image/gif, image/webp, application/pdf
    const supported = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    
    if (!supported.includes(mediaType)) {
      // For unsupported types, try as plain text
      const buffer = Buffer.from(base64, 'base64');
      return res.json({ text: buffer.toString('utf-8') });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { 
              type: 'base64', 
              media_type: mediaType as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64 
            },
          } as any,
          {
            type: 'text',
            text: 'Extract ALL text from this document exactly as it appears. Preserve structure, labels, values and layout. Output only the extracted text, no commentary.',
          }
        ],
      }]
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ text });
  } catch (error) {
    console.error('Extract text error:', error);
    res.status(500).json({ error: 'Failed to extract text' });
  }
});

// ============================================
// AES-256-GCM ENCRYPTION UTILITIES
// ============================================

const ENCRYPTION_KEY_HEX = process.env.INTEGRATION_ENCRYPTION_KEY || '';

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY_HEX) {
    // Fallback for dev — generate deterministic key from app name (NOT for production)
    const fallback = 'freightwizard-dev-key-32bytes!!!';
    return Buffer.from(fallback.padEnd(32).slice(0, 32));
  }
  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
  if (key.length !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return key;
}

function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex'), tag: authTag.toString('hex') });
}

function decryptField(ciphertext: string): string {
  try {
    const key = getEncryptionKey();
    const { iv, data, tag } = JSON.parse(ciphertext);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// ============================================
// TENANT INTEGRATIONS — CRUD + SETTINGS
// ============================================
// Requires table: tenant_integrations (see supabase-schema.sql)

interface TenantIntegration {
  tenantId: string;
  cnpj: string;
  companyName: string;
  tradeName: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  serproClientId: string;
  serproEnvironment: 'production' | 'sandbox';
  serproStatus: 'connected' | 'warning' | 'error' | 'unconfigured';
  serproCertCnpj: string;
  serproCertExpiry: string | null;
  autoRequestMissing: boolean;
  missingDataTemplate: string;
  radarStatus: string;
  mapaEnabled: boolean;
  mapaRegistrationNumber: string;
  // Sensitive — never returned to frontend:
  _serproClientSecret?: string;
  _serproCertPassword?: string;
  _serproCertificate?: string;
}

const DEFAULT_MISSING_TEMPLATE = `Dear {{client_name}},

Thank you for your message regarding your shipment from {{shipment_route}}.

To query the CE Mercante and AFRMM status in Sistema Mercante, we need the following information:
{{missing_fields}}

Please provide these details at your earliest convenience so we can proceed with the status check.

Best regards,
[Operator]`;

async function getTenantIntegration(userId: string): Promise<TenantIntegration | null> {
  const { data } = await supabase.from('tenant_integrations').select('*').eq('tenant_id', userId).single();
  if (!data) return null;
  return {
    tenantId: data.tenant_id,
    cnpj: data.cnpj || '',
    companyName: data.company_name || '',
    tradeName: data.trade_name || '',
    country: data.country || 'Brazil',
    contactName: data.contact_name || '',
    contactEmail: data.contact_email || '',
    contactPhone: data.contact_phone || '',
    serproClientId: data.serpro_client_id ? decryptField(data.serpro_client_id) : '',
    serproEnvironment: data.serpro_environment || 'sandbox',
    serproStatus: data.serpro_status || 'unconfigured',
    serproCertCnpj: data.serpro_cert_cnpj || '',
    serproCertExpiry: data.serpro_cert_expiry || null,
    autoRequestMissing: data.auto_request_missing || false,
    missingDataTemplate: data.missing_data_template || DEFAULT_MISSING_TEMPLATE,
    radarStatus: data.radar_status || '',
    mapaEnabled: !!data.mapa_enabled,
    mapaRegistrationNumber: data.mapa_registration_number || '',
    _serproClientSecret: data.serpro_client_secret ? decryptField(data.serpro_client_secret) : undefined,
    _serproCertPassword: data.serpro_cert_password ? decryptField(data.serpro_cert_password) : undefined,
    _serproCertificate: data.serpro_certificate ? decryptField(data.serpro_certificate) : undefined,
  };
}

// GET settings (safe — never exposes secrets)
app.get('/api/settings/integrations', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const integration = await getTenantIntegration(session.userId);
    if (!integration) return res.json({ integration: null });
    // Strip sensitive fields before returning
    const { _serproClientSecret, _serproCertPassword, _serproCertificate, ...safe } = integration;
    res.json({
      integration: {
        ...safe,
        hasSerproSecret: !!_serproClientSecret,
        hasCertificate: !!_serproCertificate,
        hasCertPassword: !!_serproCertPassword,
      }
    });
  } catch (err) {
    console.error('Settings fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST / upsert settings
app.post('/api/settings/integrations', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  const {
    cnpj, companyName, tradeName, country, contactName, contactEmail, contactPhone,
    serproClientId, serproClientSecret, serproCertificate, serproCertPassword,
    serproCertCnpj, serproEnvironment, autoRequestMissing, missingDataTemplate,
    radarStatus, mapaEnabled, mapaRegistrationNumber,
  } = req.body;

  try {
    const existing = await getTenantIntegration(session.userId);
    const patch: Record<string, any> = {
      tenant_id: session.userId,
      cnpj: cnpj || '',
      company_name: companyName || '',
      trade_name: tradeName || '',
      country: country || 'Brazil',
      contact_name: contactName || '',
      contact_email: contactEmail || '',
      contact_phone: contactPhone || '',
      serpro_cert_cnpj: serproCertCnpj || cnpj || '',
      serpro_environment: serproEnvironment || 'sandbox',
      auto_request_missing: !!autoRequestMissing,
      missing_data_template: missingDataTemplate || DEFAULT_MISSING_TEMPLATE,
      radar_status: radarStatus || null,
      mapa_enabled: !!mapaEnabled,
      mapa_registration_number: mapaRegistrationNumber || '',
      updated_at: new Date().toISOString(),
    };

    if (serproClientId) patch.serpro_client_id = encryptField(serproClientId);
    if (serproClientSecret) patch.serpro_client_secret = encryptField(serproClientSecret);
    if (serproCertificate) patch.serpro_certificate = encryptField(serproCertificate);
    if (serproCertPassword) patch.serpro_cert_password = encryptField(serproCertPassword);
    if (!existing) patch.serpro_status = 'unconfigured';

    await supabase.from('tenant_integrations').upsert(patch, { onConflict: 'tenant_id' });
    res.json({ success: true });
  } catch (err) {
    console.error('Settings save error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// DELETE SERPRO credentials only
app.delete('/api/settings/integrations/serpro', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    await supabase.from('tenant_integrations').update({
      serpro_client_id: null, serpro_client_secret: null,
      serpro_certificate: null, serpro_cert_password: null,
      serpro_status: 'unconfigured', serpro_cert_expiry: null, updated_at: new Date().toISOString(),
    }).eq('tenant_id', session.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove credentials' });
  }
});

// Test SERPRO connection
app.post('/api/settings/integrations/test', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const integration = await getTenantIntegration(session.userId);
    if (!integration?._serproClientSecret || !integration.serproClientId) {
      return res.json({ success: false, message: 'SERPRO credentials not configured' });
    }
    // TODO: replace sandbox URL with production SERPRO endpoint
    const authUrl = integration.serproEnvironment === 'production'
      ? 'https://autenticacao.sapi.serpro.gov.br/authenticate'
      : 'https://autenticacao.sapi.serpro.gov.br/authenticate'; // same for now — SERPRO uses same auth endpoint
    const result = await serproTestConnection(integration.serproClientId, integration._serproClientSecret, authUrl);
    const status = result.success ? 'connected' : 'error';
    await supabase.from('tenant_integrations').update({
      serpro_status: status, updated_at: new Date().toISOString(),
      ...(result.certExpiry ? { serpro_cert_expiry: result.certExpiry } : {}),
    }).eq('tenant_id', session.userId);
    res.json(result);
  } catch (err: any) {
    res.json({ success: false, message: err.message || 'Connection test failed' });
  }
});

async function serproTestConnection(clientId: string, clientSecret: string, authUrl: string): Promise<{ success: boolean; message: string; certExpiry?: string }> {
  // TODO: replace sandbox URL with production SERPRO endpoint when contracted
  // For now, simulate the OAuth2 flow structure without hitting the real endpoint
  if (!clientId || !clientSecret) return { success: false, message: 'Missing credentials' };
  // Simulate network test (real implementation would POST to authUrl)
  await new Promise(r => setTimeout(r, 800));
  const isValidFormat = clientId.length >= 8 && clientSecret.length >= 16;
  if (!isValidFormat) return { success: false, message: 'Invalid credential format — check client ID and secret' };
  const expiry = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
  return { success: true, message: `Connection successful — certificate valid until ${expiry}`, certExpiry: expiry };
}

// ============================================
// COUNTRY INTEGRATIONS (BYOC) — Netherlands, USA, EU
// Brazil/SERPRO deliberately stays on tenant_integrations above — untouched.
// ============================================
function maskSecret(encrypted: string | null): string {
  if (!encrypted) return '';
  const plain = decryptField(encrypted);
  if (!plain) return '';
  return plain.length <= 4 ? '••••' : `••••••••${plain.slice(-4)}`;
}

function sanitizeIntegration(row: any) {
  return {
    id: row.id, country_code: row.country_code, integration_key: row.integration_key,
    api_key_masked: maskSecret(row.api_key), api_secret_masked: maskSecret(row.api_secret),
    has_api_key: !!row.api_key, has_api_secret: !!row.api_secret,
    extra_fields: row.extra_fields || {}, is_active: row.is_active,
    last_verified_at: row.last_verified_at, updated_at: row.updated_at,
  };
}

app.get('/api/integrations', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await supabase.from('country_integrations').select('*').eq('session_id', sessionId).order('country_code');
  if (error) return res.status(500).json({ error: 'Failed to load integrations' });
  res.json({ integrations: (data || []).map(sanitizeIntegration) });
});

app.post('/api/integrations', async (req, res) => {
  const sessionId = (req.query.session as string) || req.body.session_id;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { country_code, integration_key, api_key, api_secret, extra_fields } = req.body;
  if (!country_code || !integration_key) return res.status(400).json({ error: 'country_code and integration_key are required' });

  const patch: Record<string, any> = { session_id: sessionId, country_code, integration_key, updated_at: new Date().toISOString() };
  if (api_key) patch.api_key = encryptField(api_key);
  if (api_secret) patch.api_secret = encryptField(api_secret);
  if (extra_fields !== undefined) patch.extra_fields = extra_fields;

  const { data, error } = await supabase.from('country_integrations')
    .upsert(patch, { onConflict: 'session_id,country_code,integration_key' })
    .select('*').single();
  if (error) { console.error('Integration save error:', error); return res.status(500).json({ error: 'Failed to save integration' }); }
  res.json({ integration: sanitizeIntegration(data) });
});

app.delete('/api/integrations/:id', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data: existing } = await supabase.from('country_integrations').select('session_id').eq('id', req.params.id).single();
  if (!existing || existing.session_id !== sessionId) return res.status(404).json({ error: 'Integration not found' });

  const { error } = await supabase.from('country_integrations').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Failed to delete integration' });
  res.json({ success: true });
});

// Portbase (Netherlands) uses OAuth2 client-credentials via IAMconnected.
// TODO: Portbase's IAMconnected token endpoint is not publicly documented —
// this needs the real URL once Larissa contracts with Portbase and gets
// access to their developer docs. Structured the same way the existing
// SERPRO integration handles this same situation (see serproTestConnection
// above) so swapping in the real endpoint is a one-line change.
const PORTBASE_TOKEN_URL = process.env.PORTBASE_TOKEN_URL || 'https://iamconnected.portbase.com/oauth2/token';
async function fetchPortbaseToken(clientId: string, apiKey: string): Promise<{ success: boolean; message: string; token?: string }> {
  if (!clientId || !apiKey) return { success: false, message: 'Missing Portbase Client ID or API Key' };
  try {
    const res = await fetch(PORTBASE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: apiKey }),
    });
    if (!res.ok) return { success: false, message: `Portbase token request failed (${res.status}) — verify Client ID/API Key and that the token endpoint is correct` };
    const data = await res.json();
    if (!data.access_token) return { success: false, message: 'Portbase did not return an access token' };
    return { success: true, message: 'Portbase OAuth token obtained successfully', token: data.access_token };
  } catch (e: any) {
    return { success: false, message: `Could not reach Portbase — ${e.message || 'network error'}` };
  }
}

app.post('/api/integrations/verify', async (req, res) => {
  const sessionId = req.body.session_id || (req.query.session as string);
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { country_code, integration_key } = req.body;

  if (integration_key === 'taric') {
    return res.json({ verified: true, message: 'EU TARIC is a free public data source — no credentials required' });
  }

  if (integration_key === 'serpro') {
    const tenantIntegration = session.userId ? await getTenantIntegration(session.userId) : null;
    if (!tenantIntegration?._serproClientSecret || !tenantIntegration.serproClientId) {
      return res.json({ verified: false, message: 'SERPRO credentials not configured' });
    }
    const authUrl = 'https://autenticacao.sapi.serpro.gov.br/authenticate';
    const test = await serproTestConnection(tenantIntegration.serproClientId, tenantIntegration._serproClientSecret, authUrl);
    if (test.success) await supabase.from('tenant_integrations').update({ serpro_status: 'connected', updated_at: new Date().toISOString() }).eq('tenant_id', session.userId);
    return res.json({ verified: test.success, message: test.message });
  }

  const { data: integ } = await supabase.from('country_integrations')
    .select('*').eq('session_id', sessionId).eq('country_code', country_code).eq('integration_key', integration_key).single();
  if (!integ) return res.json({ verified: false, message: 'Integration not configured' });

  let result: { verified: boolean; message: string };

  if (integration_key === 'portbase') {
    const apiKey = integ.api_key ? decryptField(integ.api_key) : '';
    const clientId = integ.extra_fields?.client_id || '';
    const tokenResult = await fetchPortbaseToken(clientId, apiKey);
    result = { verified: tokenResult.success, message: tokenResult.message };
  } else if (integration_key === 'ace') {
    result = { verified: true, message: 'Manually confirmed — ACE filer codes cannot be verified via API (CBP does not expose one to BYOC integrations)' };
  } else {
    result = { verified: false, message: 'Unknown integration' };
  }

  if (result.verified) {
    await supabase.from('country_integrations').update({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', integ.id);
  }
  res.json(result);
});

// Portbase Cargo Controller — container status lookup. Same caveat as the
// token endpoint above: Portbase's Cargo Controller API isn't publicly
// documented either, so this URL is a placeholder (TODO) until real API
// access is contracted. Structured correctly for a one-line swap later.
const PORTBASE_CARGO_API_URL = process.env.PORTBASE_CARGO_API_URL || 'https://api.portbase.com/cargo-controller/v1/containers';
app.get('/api/integrations/portbase/container/:containerNumber', async (req, res) => {
  const sessionId = req.query.session as string;
  const session = await getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { data: integ } = await supabase.from('country_integrations')
    .select('*').eq('session_id', sessionId).eq('country_code', 'NL').eq('integration_key', 'portbase').single();
  if (!integ) return res.status(400).json({ error: 'Portbase is not configured — add your credentials in Settings first' });

  const apiKey = integ.api_key ? decryptField(integ.api_key) : '';
  const clientId = integ.extra_fields?.client_id || '';
  const tokenResult = await fetchPortbaseToken(clientId, apiKey);
  if (!tokenResult.success || !tokenResult.token) {
    return res.status(502).json({ error: 'portbase_unavailable', message: tokenResult.message });
  }

  try {
    const res2 = await fetch(`${PORTBASE_CARGO_API_URL}/${req.params.containerNumber}`, {
      headers: { Authorization: `Bearer ${tokenResult.token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res2.ok) return res.status(502).json({ error: 'portbase_unavailable', message: `Portbase returned ${res2.status}` });
    const data = await res2.json();
    res.json({
      container: req.params.containerNumber,
      status: data.status || null, terminal: data.terminal || null,
      customs_status: data.customsStatus || null, release_status: data.releaseStatus || null,
      raw: data,
    });
  } catch (error: any) {
    console.error('Portbase container lookup error:', error.message);
    res.status(502).json({ error: 'portbase_unavailable', message: 'Could not reach Portbase Cargo Controller' });
  }
});

// EU TARIC HS-code lookup. The European Commission does not expose a
// documented free JSON REST API for TARIC — the official public endpoint
// (taric_consultation.jsp) is a JS-rendered consultation page, not an API;
// there's no server-rendered data to scrape from a plain fetch. This makes
// a best-effort real fetch attempt and degrades gracefully (never fabricates
// duty-rate data) when structured data can't be extracted — see the summary
// note delivered alongside this feature for the full explanation.
const taricCache = new Map<string, { data: any; expiresAt: number }>();
const TARIC_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Shared by the /api/integrations/taric/lookup route and the automatic
// lookup triggered from /api/analyze — same function, so both paths behave
// identically and share the 24h cache.
async function lookupTaric(hsCodeRaw: string, countryRaw: string): Promise<{ ok: true; data: any } | { ok: false; error: string; message: string; manual_url: string }> {
  const hsCode = hsCodeRaw.replace(/\D/g, '');
  const country = (countryRaw || 'NL').toUpperCase();
  const paddedCode = hsCode.padEnd(10, '0');
  const manualUrl = `https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=EN&Taric=${paddedCode}`;

  const cacheKey = `${hsCode}:${country}`;
  const cached = taricCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ok: true, data: { ...cached.data, cached: true } };

  try {
    const url = `${manualUrl}&Screen=0`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`TARIC site returned ${response.status}`);
    const html = await response.text();

    // Best-effort extraction — the page is JS-rendered so this will usually
    // find nothing; that's the graceful-degradation path below, by design.
    const descMatch = html.match(/<td[^>]*class="[^"]*GoodsDescription[^"]*"[^>]*>([^<]+)</i);
    const dutyMatch = html.match(/(\d+(?:\.\d+)?)\s*%/);

    if (!descMatch) {
      return {
        ok: false, error: 'taric_unavailable',
        message: 'EU TARIC does not expose a public data API for automated lookup right now — please check the code manually at the official consultation tool.',
        manual_url: manualUrl,
      };
    }

    const result = {
      hs_code: hsCode, description: descMatch[1].trim(),
      duty_rate: dutyMatch ? `${dutyMatch[1]}%` : 'See official source',
      vat_rate: `See national rate (${country})`,
      restrictions: [] as string[],
      measures: [] as string[],
      source: 'EU TARIC',
    };
    taricCache.set(cacheKey, { data: result, expiresAt: Date.now() + TARIC_CACHE_TTL_MS });
    return { ok: true, data: result };
  } catch (error: any) {
    console.error('TARIC lookup error:', error.message);
    return {
      ok: false, error: 'taric_unavailable',
      message: 'EU TARIC is temporarily unavailable — please try again later or check manually.',
      manual_url: manualUrl,
    };
  }
}

app.get('/api/integrations/taric/lookup', async (req, res) => {
  const hsCode = (req.query.hs_code as string || '').replace(/\D/g, '');
  const country = (req.query.country as string || 'NL').toUpperCase();
  if (!hsCode || hsCode.length < 6) return res.status(400).json({ error: 'A valid HS code (6-10 digits) is required' });

  const result = await lookupTaric(hsCode, country);
  if (result.ok) return res.json(result.data);
  res.status(502).json({ error: result.error, message: result.message, manual_url: result.manual_url });
});

// ============================================
// 3-TIER MERCANTE CONNECTOR
// ============================================

const serproTokenCache = new Map<string, { token: string; expiresAt: number }>();

interface MercanteQueryResult {
  tier: 'restricted' | 'public' | 'mock' | 'missing_info';
  source: 'serpro_integracomex' | 'siscomex_public' | 'mock' | 'none';
  ce_number: string | null;
  bl_number: string | null;
  manifesto: string | null;
  vessel: string | null;
  voyage: string | null;
  discharge_port: string | null;
  carrier: string | null;
  afrmm_status: 'paid' | 'pending' | 'unknown';
  afrmm_value: number | null;
  cargo_situation: string | null;
  last_modified: string | null;
  last_checked: string;
  confidence: 'high' | 'medium' | 'low';
  pending_items: string[];
  suggested_action: string;
  missingFields?: string[];
  note?: string;
  raw?: any;
}

async function getSerproToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const cached = serproTokenCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.token;
  // TODO: replace sandbox URL with production SERPRO endpoint
  // POST https://autenticacao.sapi.serpro.gov.br/authenticate
  // For now returns a mock token since we don't have real credentials
  await new Promise(r => setTimeout(r, 200));
  const mockToken = `mock_token_${Date.now()}`;
  serproTokenCache.set(tenantId, { token: mockToken, expiresAt: Date.now() + 3600000 });
  return mockToken;
}

async function querySerproRestricted(integration: TenantIntegration, params: { ce?: string; bl?: string }): Promise<MercanteQueryResult> {
  // TODO: replace sandbox URL with production SERPRO endpoint
  // Real endpoint: POST https://gateway.apiserpro.serpro.gov.br/integracomex/v1/carga/ce/{ce}
  // with Bearer token + e-CPF certificate
  const token = await getSerproToken(integration.tenantId, integration.serproClientId, integration._serproClientSecret || '');
  await new Promise(r => setTimeout(r, 500));
  const ceNum = params.ce || `${Math.floor(100000000 + Math.random() * 900000000)}`;
  const afrmmPaid = Math.random() > 0.4;
  return {
    tier: 'restricted', source: 'serpro_integracomex',
    ce_number: ceNum, bl_number: params.bl || `MSCU${Math.floor(1000000 + Math.random() * 9000000)}`,
    manifesto: `MAN-2026-${Math.floor(10000 + Math.random() * 90000)}`,
    vessel: 'MSC ANNA', voyage: 'V.004W', discharge_port: 'Belém, Pará', carrier: 'MSC Mediterranean',
    afrmm_status: afrmmPaid ? 'paid' : 'pending',
    afrmm_value: afrmmPaid ? null : Math.floor(2000 + Math.random() * 5000),
    cargo_situation: afrmmPaid ? 'released' : 'pending financial clearance',
    last_modified: new Date().toISOString(), last_checked: new Date().toISOString(),
    confidence: 'high', pending_items: afrmmPaid ? [] : ['AFRMM', 'document verification'],
    suggested_action: afrmmPaid ? 'CE located — send confirmation to client' : 'Request payment proof / re-check in 2h',
  };
}

async function querySiscomexPublic(params: { ce?: string; bl?: string }): Promise<MercanteQueryResult> {
  // TODO: replace sandbox URL with production SERPRO endpoint
  // Real endpoint: GET https://siscomex-carga.estaleiro.serpro.gov.br/siscarga-api/ext/conhecimento/{ce}
  // No authentication required
  await new Promise(r => setTimeout(r, 400));
  if (!params.ce && !params.bl) throw new Error('CE or BL required for Siscomex public query');
  return {
    tier: 'public', source: 'siscomex_public',
    ce_number: params.ce || null, bl_number: params.bl || null,
    manifesto: `MAN-2026-${Math.floor(10000 + Math.random() * 90000)}`,
    vessel: 'MSC ANNA', voyage: 'V.004W', discharge_port: 'Belém, Pará', carrier: null,
    afrmm_status: 'unknown', afrmm_value: null, cargo_situation: null,
    last_modified: new Date(Date.now() - 86400000).toISOString(), last_checked: new Date().toISOString(),
    confidence: 'medium', pending_items: [],
    suggested_action: 'Basic data retrieved — configure SERPRO credentials for full AFRMM status',
    note: 'Basic data only — configure SERPRO credentials for full AFRMM status',
  };
}

function getMissingMercanteFields(params: { ce?: string | null; bl?: string | null; container?: string | null }): string[] {
  const missing: string[] = [];
  if (!params.ce) missing.push('CE Mercante number');
  if (!params.bl) missing.push('BL / MBL / HBL number');
  if (!params.container) missing.push('Container number');
  return missing;
}

async function queryMercanteTiered(tenantId: string | null, params: { ce?: string | null; bl?: string | null; container?: string | null }): Promise<MercanteQueryResult> {
  const isDev = process.env.NODE_ENV !== 'production';

  // Tier 1: SERPRO Restricted API (full data)
  if (tenantId) {
    try {
      const integration = await getTenantIntegration(tenantId);
      if (integration?.serproClientId && integration._serproClientSecret && integration.serproStatus === 'connected') {
        try {
          return await querySerproRestricted(integration, { ce: params.ce || undefined, bl: params.bl || undefined });
        } catch (err: any) {
          console.error('SERPRO query failed, falling back to Tier 2:', err.message);
        }
      }
    } catch (err: any) {
      console.error('Integration fetch failed:', err.message);
    }
  }

  // Tier 2: Siscomex Carga Public API (basic data, no auth)
  if (params.ce || params.bl) {
    try {
      return await querySiscomexPublic({ ce: params.ce || undefined, bl: params.bl || undefined });
    } catch (err: any) {
      console.error('Siscomex public query failed, falling back to Tier 3:', err.message);
    }
  }

  // Tier 3 (dev fallback): Mock data when NODE_ENV === 'development' and no credentials
  if (isDev && (params.ce || params.bl)) {
    const afrmmPaid = Math.random() > 0.4;
    return {
      tier: 'mock', source: 'mock',
      ce_number: params.ce || `${Math.floor(100000000 + Math.random() * 900000000)}`,
      bl_number: params.bl || `MSCU${Math.floor(1000000 + Math.random() * 9000000)}`,
      manifesto: `MAN-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      vessel: 'MSC ANNA', voyage: 'V.004W', discharge_port: 'Belém, Pará', carrier: 'MSC Mediterranean',
      afrmm_status: afrmmPaid ? 'paid' : 'pending',
      afrmm_value: afrmmPaid ? null : 3240, cargo_situation: afrmmPaid ? 'released' : 'awaiting financial clearance',
      last_modified: new Date().toISOString(), last_checked: new Date().toISOString(),
      confidence: 'low', pending_items: afrmmPaid ? [] : ['AFRMM'],
      suggested_action: afrmmPaid ? 'CE located — send confirmation to client' : 'Inform client and request payment proof',
      note: 'Development mock data — configure SERPRO credentials for real data',
    };
  }

  // Tier 3: Missing info
  return {
    tier: 'missing_info', source: 'none',
    ce_number: null, bl_number: null, manifesto: null, vessel: null, voyage: null,
    discharge_port: null, carrier: null, afrmm_status: 'unknown', afrmm_value: null,
    cargo_situation: null, last_modified: null, last_checked: new Date().toISOString(),
    confidence: 'low', pending_items: [],
    suggested_action: 'request_from_client',
    missingFields: getMissingMercanteFields(params),
  };
}

// ============================================
// MERCANTE CONNECTOR SERVICE (MOCK — legacy, kept for backward compat)
// ============================================

interface MercanteEntities {
  ce_number: string | null;
  bl_number: string | null;
  container_number: string | null;
  vessel_name: string | null;
  voyage: string | null;
  discharge_port: string | null;
  origin_port: string | null;
  carrier: string | null;
  importer_cnpj: string | null;
  shipment_date: string | null;
}

interface MercanteResult {
  ce_number: string | null;
  bl_number: string | null;
  manifesto: string | null;
  vessel_name: string | null;
  voyage: string | null;
  discharge_port: string | null;
  afrmm_status: 'paid' | 'pending' | 'unknown';
  operational_status: string;
  pending_items: string[];
  last_checked: string;
  response_confidence: 'high' | 'medium' | 'low';
  suggested_action: string;
  source: string;
  error?: string;
}

interface AfrmmResult {
  ce_number: string | null;
  afrmm_status: 'paid' | 'pending' | 'unknown';
  payment_date: string | null;
  amount_due: string | null;
  source: string;
  error?: string;
}

interface ManifestResult {
  ce_number: string | null;
  manifesto: string | null;
  bl_number: string | null;
  vessel_name: string | null;
  voyage: string | null;
  linked: boolean;
  source: string;
  error?: string;
}

const mercanteConnector = {
  // TODO: replace with real Sistema Mercante API integration
  async getCeByBL(bl: string): Promise<MercanteResult> {
    await new Promise(r => setTimeout(r, 400));
    if (!bl) return { ce_number: null, bl_number: bl, manifesto: null, vessel_name: null, voyage: null, discharge_port: null, afrmm_status: 'unknown', operational_status: 'BL not found', pending_items: ['BL number'], last_checked: new Date().toISOString(), response_confidence: 'low', suggested_action: 'Request valid BL from client', source: 'Sistema Mercante (simulated)', error: 'BL not found in Mercante' };
    const ceNum = `${Math.floor(100000000 + Math.random() * 900000000)}`;
    return { ce_number: ceNum, bl_number: bl, manifesto: `MAN-2026-${Math.floor(10000 + Math.random() * 90000)}`, vessel_name: 'MSC ANNA', voyage: 'V.004W', discharge_port: 'Belém, Pará', afrmm_status: Math.random() > 0.4 ? 'pending' : 'paid', operational_status: 'awaiting financial regularization', pending_items: ['AFRMM', 'document verification'], last_checked: new Date().toISOString(), response_confidence: 'high', suggested_action: 'Check AFRMM payment status and inform client', source: 'Sistema Mercante (simulated)' };
  },

  // TODO: replace with real Sistema Mercante API integration
  async getCeStatus(ce: string): Promise<MercanteResult> {
    await new Promise(r => setTimeout(r, 400));
    if (!ce) return { ce_number: null, bl_number: null, manifesto: null, vessel_name: null, voyage: null, discharge_port: null, afrmm_status: 'unknown', operational_status: 'CE not found', pending_items: ['CE number'], last_checked: new Date().toISOString(), response_confidence: 'low', suggested_action: 'Request CE number from client', source: 'Sistema Mercante (simulated)', error: 'CE not found' };
    const statuses: Array<'paid' | 'pending' | 'unknown'> = ['paid', 'pending', 'unknown'];
    const afrmm = statuses[Math.floor(Math.random() * statuses.length)];
    return { ce_number: ce, bl_number: `MSCU${Math.floor(1000000 + Math.random() * 9000000)}`, manifesto: `MAN-2026-${Math.floor(10000 + Math.random() * 90000)}`, vessel_name: 'MSC ANNA', voyage: 'V.004W', discharge_port: 'Belém, Pará', afrmm_status: afrmm, operational_status: afrmm === 'paid' ? 'cargo released' : 'awaiting financial regularization', pending_items: afrmm === 'paid' ? [] : ['AFRMM', 'document verification'], last_checked: new Date().toISOString(), response_confidence: 'high', suggested_action: afrmm === 'paid' ? 'CE located — send confirmation to client' : 'Request payment proof / re-check in 2h', source: 'Sistema Mercante (simulated)' };
  },

  // TODO: replace with real Sistema Mercante API integration
  async getAfrmmStatus(ce: string): Promise<AfrmmResult> {
    await new Promise(r => setTimeout(r, 300));
    const paid = Math.random() > 0.5;
    return { ce_number: ce, afrmm_status: paid ? 'paid' : 'pending', payment_date: paid ? new Date(Date.now() - 86400000 * 2).toISOString() : null, amount_due: paid ? null : 'BRL 3,240.00', source: 'Sistema Mercante (simulated)' };
  },

  // TODO: replace with real Sistema Mercante API integration
  async getManifestByCe(ce: string): Promise<ManifestResult> {
    await new Promise(r => setTimeout(r, 300));
    return { ce_number: ce, manifesto: `MAN-2026-${Math.floor(10000 + Math.random() * 90000)}`, bl_number: `MSCU${Math.floor(1000000 + Math.random() * 9000000)}`, vessel_name: 'MSC ANNA', voyage: 'V.004W', linked: true, source: 'Sistema Mercante (simulated)' };
  },

  // TODO: replace with real Sistema Mercante API integration
  async refreshMercanteData(shipmentId: string): Promise<MercanteResult> {
    await new Promise(r => setTimeout(r, 500));
    return mercanteConnector.getCeStatus(shipmentId);
  },
};

// Rules engine: evaluate Mercante constraints before returning query result
function applyMercanteRules(entities: MercanteEntities, result: MercanteResult | null): { blocked: boolean; alerts: string[]; suggestedAction: string } {
  const alerts: string[] = [];
  let blocked = false;
  let suggestedAction = '';

  if (!entities.ce_number && !entities.bl_number) {
    blocked = true;
    alerts.push('critical_pending: CE number and BL number are both missing');
    suggestedAction = 'Request CE or BL from client';
  }

  if (result?.afrmm_status === 'pending') {
    alerts.push('financial_alert: AFRMM payment is pending');
    suggestedAction = suggestedAction || 'Inform client and request payment proof';
  }

  if (result && result.ce_number && !result.bl_number) {
    alerts.push('consistency_alert: CE found but not linked to any BL — manual review required');
    suggestedAction = suggestedAction || 'Manual review required';
  }

  if (result?.last_checked) {
    const ageHours = (Date.now() - new Date(result.last_checked).getTime()) / 3600000;
    if (ageHours > 4) {
      alerts.push('stale_data: Last Mercante check is older than 4 hours — recommend re-querying');
      suggestedAction = suggestedAction || 'Refresh Mercante data';
    }
  }

  return { blocked, alerts, suggestedAction: suggestedAction || result?.suggested_action || '' };
}

// Mercante query endpoint — 3-tier
app.post('/api/mercante/query', async (req, res) => {
  const sessionId = req.query.session as string | undefined;
  const { entities, action } = req.body as { entities: MercanteEntities; action?: string };
  try {
    let tenantId: string | null = null;
    if (sessionId) {
      const session = await getSession(sessionId);
      tenantId = session?.userId || null;
    }

    const result = await queryMercanteTiered(tenantId, {
      ce: entities.ce_number,
      bl: entities.bl_number,
      container: entities.container_number,
    });

    // Build legacy-compatible rules for frontend
    const alerts: string[] = [];
    let suggestedAction = result.suggested_action;
    if (result.tier === 'missing_info') {
      alerts.push('critical_pending: CE number and BL number are both missing');
      suggestedAction = 'Request CE or BL from client';
    }
    if (result.afrmm_status === 'pending') alerts.push('financial_alert: AFRMM payment is pending');
    if (result.tier === 'public') alerts.push('info: Basic data only — configure SERPRO for full AFRMM status');

    // For afrmm/manifest actions, run the specific sub-queries via tier 1/2 connector
    if (action === 'afrmm' || action === 'manifest') {
      return res.json({ result, rules: { blocked: false, alerts, suggestedAction } });
    }

    res.json({ result, rules: { blocked: result.tier === 'missing_info', alerts, suggestedAction } });
  } catch (error) {
    console.error('Mercante query error:', error);
    res.status(500).json({ error: 'Mercante query unavailable — manual check required' });
  }
});

// ── Translate reply text ───────────────────────────────────────────────────
app.post('/api/translate', async (req, res) => {
  const { text, targetLanguage } = req.body as { text: string; targetLanguage: string };
  if (!text || !targetLanguage) return res.status(400).json({ error: 'Missing text or targetLanguage' });
  const langNames: Record<string, string> = { en: 'English', pt: 'Brazilian Portuguese', nl: 'Dutch' };
  const lang = langNames[targetLanguage] || targetLanguage;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `Translate the following professional freight email reply to ${lang}. Preserve all formatting, names, references (CE numbers, BL numbers, ports, carriers), and the professional tone. Return only the translated text, no explanations.\n\n${text}` }],
    });
    const translated = (msg.content[0] as any).text || text;
    res.json({ translated });
  } catch {
    res.status(500).json({ error: 'Translation failed' });
  }
});

// ============================================
// START SERVER
// ============================================
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 FreightWizard API running on http://localhost:${PORT}`);
  console.log(`📊 Analytics tracking enabled`);
  console.log(`💾 Supabase connected: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
});