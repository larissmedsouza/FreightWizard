// The API's address. Set NEXT_PUBLIC_API_URL per environment
// (local: http://localhost:3001 in .env.local); production defaults to the
// API's own domain, so a future host move only changes one DNS record.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.freightwizard.app';
