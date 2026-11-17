import 'server-only';
import {currentUser} from './auth';
import {database} from './database';
import {Member,canRead} from './access';
export const db=()=>database;
export async function identity():Promise<Member|null>{
 const u=await currentUser();if(!u)return null;
 const owner=process.env.ADMIN_EMAIL?.trim().toLowerCase();
 let m=await db().prepare('SELECT * FROM members WHERE id=?').bind(u.userId).first<Member>();
 if(m)return m.role==='disabled'?null:m;
 // Only the explicitly configured, verified owner email can bootstrap administration.
 if(owner&&u.email===owner){
  await db().prepare("INSERT INTO members (id,email,role,case_id) VALUES (?,?,'admin','') ON CONFLICT(id) DO NOTHING").bind(u.userId,u.email).run();
 }else{
  const g=await db().prepare('SELECT * FROM grants WHERE email=?').bind(u.email).first<any>();
  if(!g||g.role==='disabled')return null;
  await db().prepare('INSERT INTO members (id,email,role,case_id) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(u.userId,u.email,g.role,g.case_id||'').run();
 }
 m=await db().prepare('SELECT * FROM members WHERE id=?').bind(u.userId).first<Member>();
 return m?.role==='disabled'?null:m;
}
export function json(data:any,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}})}
export function validOrigin(req:Request){return !req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin}
export async function log(m:Member,action:string,id:string){await db().prepare('INSERT INTO audit (id,actor,action,record_id,date) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),m.email,action,id,new Date().toISOString()).run()}
export function unpack(r:any){return {...JSON.parse(r.data),id:r.id,kind:r.kind,caseId:r.case_id,updated:r.updated}}
export async function visibleMemorial(id:string,token:string|null,m:Member|null){const r=await db().prepare("SELECT * FROM records WHERE id=? AND kind='memorial'").bind(id).first<any>();if(!r)return null;const d=unpack(r);if(m&&canRead(m,r))return d;if(d.status!=='Published')return null;if(d.visibility==='Public'||d.visibility==='Unlisted'&&token&&token===d.shareToken)return d;return null}

export function publicMemorial(r:any){const keys=['id','kind','name','dates','image','bio','date','time','timezone','location','address','programme','livestream','recording','charity','donationURL','visibility','status'];return Object.fromEntries(keys.filter(k=>r[k]!==undefined).map(k=>[k,r[k]]))}
