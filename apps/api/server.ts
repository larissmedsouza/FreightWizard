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

// In-memory session store (in production, use Redis or database)
const sessions: Map<string, { tokens: any; email: string; name: string; userId?: string; provider: 'google' | 'outlook' }> = new Map();

// ============================================
// HELPER: Get or create user profile
// ============================================
async function getOrCreateUser(email: string, name?: string): Promise<string | null> {
  try {
    // Check if user exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return existing.id;
    }

    // Create new user
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

app.get('/debug', (req, res) => {
  res.json({
    API_URL: API_URL,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID ? '✅ set' : '❌ missing',
    MICROSOFT_CONFIG_clientId: MICROSOFT_CONFIG.clientId ? '✅ set' : '❌ EMPTY',
    RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN || 'not set',
    API_URL_ENV: process.env.API_URL || 'not set',
  });
});


// OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const sessionId = Math.random().toString(36).substring(2, 15);
    
    // Get or create user in Supabase
    const userId = await getOrCreateUser(data.email!, data.name || undefined);
    
    sessions.set(sessionId, {
      tokens,
      email: data.email!,
      name: data.name || data.email!,
      userId: userId || undefined,
      provider: 'google',
    });

    // Save Gmail session to Supabase
    if (userId) {
      await supabase.from('gmail_sessions').upsert({
        session_id: sessionId,
        user_id: userId,
        gmail_email: data.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      }, { onConflict: 'session_id' });
    }

    console.log(`✅ Google OAuth success: ${data.email} (User ID: ${userId})`);
    res.redirect(`${FRONTEND_URL}/dashboard?session=${sessionId}`);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
});

// ============================================
// MICROSOFT/OUTLOOK OAUTH
// ============================================

// Start Outlook OAuth
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

// Outlook OAuth callback
app.get('/auth/outlook/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    console.error('Outlook OAuth error:', error);
    return res.status(400).send('Authentication failed: ' + error);
  }
  
  if (!code) return res.status(400).send('No code provided');

  try {
    // Exchange code for tokens
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
    
    if (tokens.error) {
      console.error('Token error:', tokens);
      return res.status(400).send('Token exchange failed: ' + tokens.error_description);
    }

    // Get user info from Microsoft Graph
    const userResponse = await fetch(`${MICROSOFT_CONFIG.graphUrl}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    
    const userData = await userResponse.json();
    
    const sessionId = Math.random().toString(36).substring(2, 15);
    const userEmail = userData.mail || userData.userPrincipalName;
    const userName = userData.displayName || userEmail;
    
    // Get or create user in Supabase
    const userId = await getOrCreateUser(userEmail, userName);
    
    sessions.set(sessionId, {
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Date.now() + (tokens.expires_in * 1000),
      },
      email: userEmail,
      name: userName,
      userId: userId || undefined,
      provider: 'outlook',
    });

    // Save Outlook session to Supabase
    if (userId) {
      await supabase.from('gmail_sessions').upsert({
        session_id: sessionId,
        user_id: userId,
        gmail_email: userEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
      }, { onConflict: 'session_id' });
    }

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

// Fetch Outlook emails
async function fetchOutlookEmails(accessToken: string) {
  const response = await fetch(
    `${MICROSOFT_CONFIG.graphUrl}/me/mailFolders/inbox/messages?$top=20&$orderby=receivedDateTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  const data = await response.json();
  return data.value || [];
}

// Send Outlook email
async function sendOutlookEmail(accessToken: string, to: string, subject: string, body: string) {
  const response = await fetch(`${MICROSOFT_CONFIG.graphUrl}/me/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
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

// Save Outlook draft
async function saveOutlookDraft(accessToken: string, to: string, subject: string, body: string) {
  const response = await fetch(`${MICROSOFT_CONFIG.graphUrl}/me/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject,
      body: { contentType: 'Text', content: body },
      toRecipients: [{ emailAddress: { address: to } }],
      isDraft: true,
    }),
  });
  
  return response.ok;
}

// Check auth status
app.get('/api/auth/status', (req, res) => {
  const sessionId = req.query.session as string;
  const session = sessions.get(sessionId);
  
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
  const session = sessions.get(sessionId);

  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  try {
    let emails: any[] = [];
    
    // Check provider and fetch emails accordingly
    if (session.provider === 'outlook') {
      // Fetch Outlook emails
      const outlookEmails = await fetchOutlookEmails(session.tokens.access_token);
      
      emails = outlookEmails.map((msg: any) => {
        // Extract body text
        let body = '';
        if (msg.body?.content) {
          // Remove HTML tags if contentType is HTML
          if (msg.body.contentType === 'html') {
            body = msg.body.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          } else {
            body = msg.body.content;
          }
        }
        
        return {
          id: msg.id,
          threadId: msg.conversationId,
          subject: msg.subject || '(No Subject)',
          from: msg.from?.emailAddress?.address || msg.from?.emailAddress?.name || '',
          fromName: msg.from?.emailAddress?.name || '',
          date: msg.receivedDateTime,
          snippet: msg.bodyPreview || '',
          body: body,
        };
      });
      
      // Track as received
      if (session.userId) {
        for (const email of emails) {
          const { data: existing } = await supabase
            .from('email_activity')
            .select('id')
            .eq('email_id', email.id)
            .eq('action', 'received')
            .single();
          
          if (!existing) {
            await trackActivity(session.userId, email.id, 'received');
          }
        }
      }
    } else {
      // Fetch Gmail emails (existing code)
      oauth2Client.setCredentials(session.tokens);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const list = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 20,
        labelIds: ['INBOX'],
      });

      emails = await Promise.all(
        (list.data.messages || []).map(async (msg) => {
          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'full',
          });

          const headers = full.data.payload?.headers || [];
          const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          // Extract body
          let body = '';
          const payload = full.data.payload;
          if (payload?.body?.data) {
            body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          } else if (payload?.parts) {
            const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            }
          }

          // Track as received (only if we have a userId)
          if (session.userId) {
            const { data: existing } = await supabase
              .from('email_activity')
              .select('id')
              .eq('email_id', msg.id!)
              .eq('action', 'received')
              .single();
            
            if (!existing) {
              await trackActivity(session.userId, msg.id!, 'received');
            }
          }

          return {
            id: msg.id,
            threadId: msg.threadId,
            subject: getHeader('Subject') || '(No Subject)',
            from: getHeader('From'),
            date: getHeader('Date'),
            snippet: full.data.snippet || '',
            body: body,
          };
        })
      );
    }

    // Load existing analyses from Supabase
    if (session.userId) {
      const emailIds = emails.map(e => e.id);
      const { data: analyses } = await supabase
        .from('email_analysis')
        .select('*')
        .eq('user_id', session.userId)
        .in('email_id', emailIds);

      // Attach analyses to emails
      if (analyses) {
        for (const email of emails) {
          const analysis = analyses.find(a => a.email_id === email.id);
          if (analysis) {
            (email as any).analysis = {
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
  const { subject, body, from, emailId, sessionId, source, userEmail, threadId } = req.body;

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
      
      // Determine user ID - either from session or from userEmail (Gmail/Outlook Add-on)
      let userId: string | null = null;
      
      if (sessionId) {
        // From dashboard
        const session = sessions.get(sessionId);
        userId = session?.userId || null;
      } else if (userEmail && (source === 'gmail_addon' || source === 'outlook_addon')) {
        // From Gmail/Outlook Add-on - get or create user by email
        userId = await getOrCreateUser(userEmail);
        console.log(`📧 ${source} analysis from: ${userEmail} (User ID: ${userId})`);
      }
      
      // Save to Supabase if we have user info
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
  const session = sessions.get(sessionId);

  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    
    if (session.provider === 'outlook') {
      // Send via Outlook/Microsoft Graph
      const success = await sendOutlookEmail(session.tokens.access_token, to, replySubject, body);
      if (!success) throw new Error('Failed to send via Outlook');
    } else {
      // Send via Gmail
      oauth2Client.setCredentials(session.tokens);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const rawMessage = Buffer.from(
        `To: ${to}\r\nSubject: ${replySubject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: rawMessage, threadId },
      });
    }

    // Track reply activity
    if (session.userId && emailId) {
      // Calculate response time
      const { data: activity } = await supabase
        .from('email_activity')
        .select('created_at')
        .eq('email_id', emailId)
        .eq('action', 'received')
        .single();

      let responseTimeMinutes;
      if (activity) {
        const receivedAt = new Date(activity.created_at);
        const now = new Date();
        responseTimeMinutes = Math.round((now.getTime() - receivedAt.getTime()) / 60000);
      }

      await trackActivity(session.userId, emailId, 'replied', undefined, undefined, responseTimeMinutes);

      // Update email_analysis with replied_at
      await supabase
        .from('email_analysis')
        .update({ replied_at: new Date().toISOString(), response_time_minutes: responseTimeMinutes })
        .eq('email_id', emailId)
        .eq('user_id', session.userId);
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
  const session = sessions.get(sessionId);

  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const draftSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    
    if (session.provider === 'outlook') {
      // Save draft via Outlook/Microsoft Graph
      const success = await saveOutlookDraft(session.tokens.access_token, to, draftSubject, body);
      if (!success) throw new Error('Failed to save draft via Outlook');
    } else {
      // Save draft via Gmail
      oauth2Client.setCredentials(session.tokens);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const rawMessage = Buffer.from(
        `To: ${to}\r\nSubject: ${draftSubject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmail.users.drafts.create({
        userId: 'me',
        requestBody: { message: { raw: rawMessage, threadId } },
      });
    }

    // Track draft activity
    if (session.userId && emailId) {
      await trackActivity(session.userId, emailId, 'draft_saved');
    }

    console.log(`📝 Draft saved for: ${to} (via ${session.provider || 'google'})`);
    res.json({ success: true });
  } catch (error) {
    console.error('Draft error:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Track reply from Gmail/Outlook Add-on
app.post('/api/track-reply', async (req, res) => {
  const { emailId, threadId, subject, replyText, userEmail, source } = req.body;

  if ((source !== 'gmail_addon' && source !== 'outlook_addon') || !userEmail) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    // Get or create user by email
    const userId = await getOrCreateUser(userEmail);
    
    if (!userId) {
      return res.status(400).json({ error: 'Could not find or create user' });
    }

    // Calculate response time if we have the original email tracked
    let responseTimeMinutes;
    const { data: activity } = await supabase
      .from('email_activity')
      .select('created_at')
      .eq('email_id', emailId)
      .eq('action', 'received')
      .single();

    if (activity) {
      const receivedAt = new Date(activity.created_at);
      const now = new Date();
      responseTimeMinutes = Math.round((now.getTime() - receivedAt.getTime()) / 60000);
    }

    // Track reply activity
    await trackActivity(userId, emailId, 'replied', undefined, undefined, responseTimeMinutes);

    // Update email_analysis with replied_at
    await supabase
      .from('email_analysis')
      .update({ 
        replied_at: new Date().toISOString(), 
        response_time_minutes: responseTimeMinutes,
        suggested_reply: replyText // Update with the reply that was used
      })
      .eq('email_id', emailId)
      .eq('user_id', userId);

    console.log(`📧 Gmail Add-on reply tracked for: ${userEmail} (Email: ${emailId})`);
    res.json({ success: true });
  } catch (error) {
    console.error('Track reply error:', error);
    res.status(500).json({ error: 'Failed to track reply' });
  }
});

// Track draft from Gmail Add-on
app.post('/api/track-draft', async (req, res) => {
  const { emailId, threadId, subject, userEmail, source } = req.body;

  if (source !== 'gmail_addon' || !userEmail) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const userId = await getOrCreateUser(userEmail);
    
    if (!userId) {
      return res.status(400).json({ error: 'Could not find or create user' });
    }

    // Track draft activity
    await trackActivity(userId, emailId, 'draft_saved');

    console.log(`📝 Gmail Add-on draft tracked for: ${userEmail} (Email: ${emailId})`);
    res.json({ success: true });
  } catch (error) {
    console.error('Track draft error:', error);
    res.status(500).json({ error: 'Failed to track draft' });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

// Get analytics data
app.get('/api/analytics', async (req, res) => {
  const sessionId = req.query.session as string;
  const range = req.query.range as string || 'weekly'; // daily, weekly, monthly
  const session = sessions.get(sessionId);

  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (range) {
      case 'daily':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 6);
        break;
      default: // weekly
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 28);
    }

    // Get daily analytics
    const { data: dailyStats } = await supabase
      .from('analytics_daily')
      .select('*')
      .eq('user_id', session.userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Get intent breakdown from email_analysis
    const { data: intentData } = await supabase
      .from('email_analysis')
      .select('intent')
      .eq('user_id', session.userId)
      .gte('created_at', startDate.toISOString());

    // Get priority breakdown
    const { data: priorityData } = await supabase
      .from('email_analysis')
      .select('priority')
      .eq('user_id', session.userId)
      .gte('created_at', startDate.toISOString());

    // Get response time stats
    const { data: responseData } = await supabase
      .from('email_analysis')
      .select('response_time_minutes')
      .eq('user_id', session.userId)
      .not('response_time_minutes', 'is', null)
      .gte('created_at', startDate.toISOString());

    // Calculate stats
    const totalReceived = dailyStats?.reduce((sum, d) => sum + (d.emails_received || 0), 0) || 0;
    const totalAnalyzed = dailyStats?.reduce((sum, d) => sum + (d.emails_analyzed || 0), 0) || 0;
    const totalReplied = dailyStats?.reduce((sum, d) => sum + (d.emails_replied || 0), 0) || 0;

    // Intent breakdown
    const intentCounts: Record<string, number> = {};
    intentData?.forEach(item => {
      const intent = item.intent || 'general';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });

    // Priority breakdown
    const priorityCounts: Record<string, number> = {};
    priorityData?.forEach(item => {
      const priority = item.priority || 'medium';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    // Response time stats
    const responseTimes = responseData?.map(r => r.response_time_minutes) || [];
    const avgResponseTime = responseTimes.length > 0 
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
    const fastestResponse = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const slowestResponse = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    res.json({
      stats: {
        totalEmails: totalReceived,
        analyzed: totalAnalyzed,
        replied: totalReplied,
        avgResponseTime: `${avgResponseTime} min`,
        automationRate: totalReceived > 0 ? `${Math.round((totalAnalyzed / totalReceived) * 100)}%` : '0%',
      },
      dailyStats,
      intentBreakdown: Object.entries(intentCounts).map(([intent, count]) => ({ intent, count })),
      priorityBreakdown: Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count })),
      responseTimes: {
        average: avgResponseTime,
        fastest: fastestResponse,
        slowest: slowestResponse,
        trend: responseTimes.slice(-7),
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
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