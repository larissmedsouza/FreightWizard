import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root (for local dev)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Environment URLs
const API_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.API_URL || 'http://localhost:3001';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const app = express();
app.use(cors({ 
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    'https://freightwizard.vercel.app',
    'https://larissmedsouza.github.io',
    FRONTEND_URL
  ], 
  credentials: true 
}));
app.use(express.json());

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
app.post('/api/analyze', async (req, res) => {
  const { subject, body, from, emailId, sessionId, source, userEmail } = req.body;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are FreightWizard AI, an expert freight forwarding email analyst.
        
Analyze this freight email and extract:
1. Intent: quote_request, booking_confirmation, tracking_inquiry, documentation_request, rate_inquiry, status_update, complaint, general_inquiry
2. Priority: urgent, high, medium, low
3. Transport mode: ocean, air, road, rail, multimodal
4. POL (Port of Loading) and POD (Port of Discharge)
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
  "suggested_reply": ""
}`
      }]
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
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

      res.json({ analysis });
    } else {
      res.status(500).json({ error: 'Failed to parse AI response' });
    }
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Send reply
app.post('/api/send-reply', async (req, res) => {
  const sessionId = req.query.session as string;
  const { to, subject, body, threadId, emailId } = req.body;
  const session = await getSession(sessionId);

  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  try {
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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
// START SERVER
// ============================================
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 FreightWizard API running on http://localhost:${PORT}`);
  console.log(`📊 Analytics tracking enabled`);
  console.log(`💾 Supabase connected: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
});