import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export function authConfigured() { return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY); }
export function backendConfigured() { return !!(authConfigured() && process.env.DATABASE_URL); }
export async function authClient() {
  if (!authConfigured()) throw new Error('Sign-in setup required. Add the Supabase environment variables.');
  const store = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookieOptions:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'},
    cookies: {getAll() {return store.getAll();}, setAll(values) {values.forEach(({name,value,options}) => store.set(name,value,options));}}
  });
}
export function storageClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Private storage setup required.');
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
export const storageBucket = () => process.env.SUPABASE_STORAGE_BUCKET || 'stillwater-private';
