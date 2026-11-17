import 'server-only';
import {authClient, authConfigured} from './supabase';
export async function currentUser() {
  if (!authConfigured()) return null;
  const client = await authClient();
  // Verify with the auth server. Never trust client-supplied identity headers.
  const {data:{user},error} = await client.auth.getUser();
  if (error || !user || !user.email || !user.email_confirmed_at) return null;
  return {userId:user.id,email:user.email.toLowerCase()};
}
