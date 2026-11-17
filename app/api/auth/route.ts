import {NextResponse} from 'next/server';
import {authClient,backendConfigured} from '@/lib/supabase';
import {validOrigin,identity} from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:Request){
 if(!validOrigin(req))return NextResponse.json({error:'Request origin rejected'},{status:403});
 if(!backendConfigured())return NextResponse.json({error:'Sign-in is not configured. Follow README.md to connect Supabase.'},{status:503});
 try{
  const body=await req.json();const client=await authClient();
  if(body.action==='logout'){const {error}=await client.auth.signOut();return NextResponse.json(error?{error:'Could not sign out. Please retry.'}:{ok:true},{status:error?500:200})}
  if(typeof body.email!=='string'||body.email.length>254||typeof body.password!=='string'||body.password.length>1024)return NextResponse.json({error:'Enter your email address and password.'},{status:400});
  const {error}=await client.auth.signInWithPassword({email:body.email.trim(),password:body.password});
  if(error)return NextResponse.json({error:'Unable to sign in. Check your email, password and account confirmation.'},{status:401});
  const member=await identity();if(!member){await client.auth.signOut();return NextResponse.json({error:'Your account has not been assigned access. Contact your care coordinator.'},{status:403})}
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Unable to sign in. Please try again.'},{status:500})}
}
