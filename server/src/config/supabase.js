import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

// Admin client: creates / updates auth users and verifies access tokens.
// Server-only — the secret key must never reach the browser.
const supabase = createClient(url, secretKey, options);

// Password sign-in stores a session on the client it runs on, so each sign-in
// gets its own throwaway client rather than touching the shared admin one.
export const authClient = () => createClient(url, secretKey, options);

export default supabase;
