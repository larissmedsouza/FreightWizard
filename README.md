# 🚢 FreightWizard

AI-Powered Email Management for Freight Forwarding

## Features

- ✅ Gmail OAuth Integration
- ✅ AI Email Analysis (Claude)
- ✅ Smart Reply Generation
- ✅ Send Reply via Gmail
- ✅ Save as Draft
- ✅ Dark/Light Mode
- ✅ Multi-language (EN, PT-BR, NL)
- ✅ Beautiful Landing Page

## Project Structure

```
freightwizard/
├── .env                    # Root environment variables
├── apps/
│   ├── api/               # Express API (Port 3001)
│   │   ├── package.json
│   │   └── server.ts
│   └── web/               # Next.js Frontend (Port 3000)
│       ├── package.json
│       ├── .env.local
│       └── app/
│           ├── page.tsx           # Landing page
│           └── dashboard/
│               └── page.tsx       # Dashboard
└── supabase-schema.sql    # Database schema
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Install API dependencies
cd apps/api
npm install

# Install Web dependencies
cd ../web
npm install
```

### 2. Setup Supabase (Optional)

1. Go to https://supabase.com
2. Open your project's SQL Editor
3. Run the contents of `supabase-schema.sql`

### 3. Google Cloud Console

Make sure your Google Cloud project has:
- Gmail API enabled
- OAuth 2.0 credentials configured
- Redirect URI: `http://localhost:3001/auth/google/callback`

### 4. Start the Servers

**Terminal 1 - API Server:**
```bash
cd apps/api
npm start
```

**Terminal 2 - Web Server:**
```bash
cd apps/web
npm run dev
```

### 5. Open the App

- Landing Page: http://localhost:3000
- Dashboard: http://localhost:3000/dashboard

## Environment Variables

### Root `.env`
```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
ANTHROPIC_API_KEY=your_anthropic_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Troubleshooting

### "Analyze All" button is grayed out
- Clear localStorage: F12 → Application → Local Storage → Clear
- Disconnect and reconnect Gmail

### API not responding
- Make sure API is running on port 3001
- Check terminal for errors
- Kill existing Node processes: `taskkill /F /IM node.exe`

### OAuth errors
- Verify redirect URI in Google Cloud Console
- Check API terminal for OAuth messages

## License

MIT
