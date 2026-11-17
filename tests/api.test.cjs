const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');const ts=require('typescript');const {PGlite}=require('@electric-sql/pglite');
process.env.ADMIN_EMAIL='owner@example.test';process.env.DATABASE_URL='postgresql://test.local/test';
const sql=new PGlite();
const schema=fs.readFileSync('supabase/setup.sql','utf8').split('-- Private bucket:')[0].replace(/^REVOKE .*;$/gm,'').replace(/^ALTER DEFAULT PRIVILEGES .*;$/gm,'');
const ready=sql.exec(schema);
let signedIn={userId:'owner',email:'owner@example.test'};
class TestPool {async query(q,args=[]){await ready;const r=await sql.query(q,args);return {...r,rowCount:r.affectedRows??r.rows.length}}async connect(){return {query:this.query.bind(this),release(){}}}}
const bucket=new Map();const store={upload:async(k,file)=>{bucket.set(k,file);return {error:null}},download:async k=>({data:bucket.get(k),error:bucket.has(k)?null:Error('Not found')}),remove:async ids=>{ids.forEach(k=>bucket.delete(k));return {error:null}}};
let configured=true;const supabase={backendConfigured:()=>configured,authConfigured:()=>configured,authClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:signedIn.userId,email:signedIn.email,email_confirmed_at:signedIn.confirmed===false?null:'2026-01-01'}:null},error:null}),signInWithPassword:async({email,password})=>{if(password!=='test-password')return {error:Error('Invalid')};signedIn={userId:email==='owner@example.test'?'owner':'unassigned',email};return {error:null}},signOut:async()=>{signedIn=null;return {error:null}}}}),storageClient:()=>({storage:{from:()=>store}}),storageBucket:()=> 'test'};
const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const src=fs.readFileSync(file,'utf8');const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};cache[file]=module;const localRequire=(id)=>id==='server-only'?{}:id==='pg'?{Pool:TestPool}:id.endsWith('/supabase')||id==='./supabase'?supabase:id.startsWith('@/')?load(path.resolve(id.slice(2)+'.ts')):id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id);vm.runInNewContext(code,{module,exports:module.exports,require:localRequire,process,Response,Request,File,FormData,URL,crypto,console},{filename:file});return module.exports}
const route=load('app/api/data/route.ts'),upload=load('app/api/upload/route.ts'),auth=load('app/api/auth/route.ts');
async function post(body,status=200){const r=await route.POST(new Request('https://test.local/api/data',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test.local'},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
async function get(q=''){const r=await route.GET(new Request('https://test.local/api/data'+q));return {status:r.status,...await r.json()}}
(async()=>{
 signedIn={userId:'stranger',email:'stranger@example.test'};assert.equal((await get()).status,401);signedIn={userId:'owner',email:'owner@example.test'};const boot=await get();assert.equal(boot.member.role,'admin');
 const c1=await post({kind:'case',data:{name:'Test family'}});const c2=await post({kind:'case',data:{name:'Other family'}});
 const task=await post({kind:'task',caseId:c1.id,data:{title:'Arrange reading',status:'To do'}});await post({kind:'task',id:task.id,data:{title:'Arrange reading',status:'Done'}});assert.equal((await get()).records.find(r=>r.id===task.id).status,'Done');
 await post({action:'grant',email:'family@example.test',role:'family',caseId:c1.id});signedIn={userId:'family',email:'family@example.test'};const family=await get();assert.equal(family.member.role,'family');assert(family.records.some(r=>r.id===c1.id));assert(!family.records.some(r=>r.id===c2.id));
 await post({kind:'task',caseId:c2.id,data:{title:'Forbidden'}},403);await post({kind:'settings',data:{brand:'Forbidden'}},403);await post({action:'grant',email:'bad@example.test',role:'coordinator'},403);
 const fm=await post({kind:'memorial',caseId:c1.id,data:{name:'Test memory',visibility:'Public',status:'Published',consent:true}});assert.equal(fm.status,'Draft');assert.equal(fm.visibility,'Private');
 signedIn={userId:'owner',email:'owner@example.test'};const pub=await post({kind:'memorial',id:fm.id,data:{...fm,status:'Published',visibility:'Public',consent:true}});
 await post({kind:'memorial',caseId:c2.id,data:{name:'No consent',status:'Published',visibility:'Public'}},400);
 signedIn=null;const directory=await get('?public=1');assert(directory.records.some(r=>r.id===fm.id));assert(!directory.records.some(r=>r.kind==='case'));assert(!directory.records.find(r=>r.id===fm.id).shareToken);
 const visible=await get('?memorial='+fm.id);assert.equal(visible.status,200);assert(!visible.memorial.shareToken);
 await post({action:'submit',kind:'tribute',data:{name:'A friend',message:'A kind memory',memorialId:fm.id}});assert.equal((await get('?memorial='+fm.id)).tributes.length,0);
 await post({action:'submit',kind:'rsvp',data:{name:'A friend',email:'friend@example.test',count:2,memorialId:fm.id}});await post({action:'submit',kind:'rsvp',data:{name:'A friend',email:'friend@example.test',count:99,memorialId:fm.id}},400);
 await post({action:'submit',kind:'enquiry',data:{name:'Someone',email:'not-an-email'}},400);await post({kind:'task',data:{title:'Unauthorized'}},401);
 signedIn={userId:'owner',email:'owner@example.test'};const tribute=(await get()).records.find(r=>r.kind==='tribute');await post({kind:'tribute',id:tribute.id,data:{...tribute,status:'Approved'}});signedIn=null;const published=(await get('?memorial='+fm.id)).tributes;assert.equal(published.length,1);assert(!published[0].email);
 signedIn={userId:'owner',email:'owner@example.test'};const unlisted=await post({kind:'memorial',id:fm.id,data:{...pub,visibility:'Unlisted'}});signedIn=null;assert.equal((await get('?memorial='+fm.id)).status,404);assert.equal((await get('?memorial='+fm.id+'&token='+unlisted.shareToken)).status,200);assert(!(await get('?public=1')).records.some(r=>r.id===fm.id));
 signedIn={userId:'owner',email:'owner@example.test'};
 await post({kind:'event',caseId:c1.id,data:{title:'First',date:'2027-01-01',time:'10:00',endTime:'11:00',resource:'Room A',status:'Confirmed'}});
 await post({kind:'event',caseId:c2.id,data:{title:'Overlap',date:'2027-01-01',time:'10:30',endTime:'12:00',resource:'Room A',status:'Confirmed'}},409);
 await post({kind:'event',caseId:c2.id,data:{title:'Adjacent',date:'2027-01-01',time:'11:00',endTime:'12:00',resource:'Room A',status:'Confirmed'}});
 const badOrigin=await route.POST(new Request('https://test.local/api/data',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}));assert.equal(badOrigin.status,403);
 const form=new FormData();form.append('file',new File(['private document'],'notes.pdf',{type:'application/pdf'}));form.append('caseId',c1.id);const uploaded=await upload.POST(new Request('https://test.local/api/upload',{method:'POST',body:form}));assert.equal(uploaded.status,200);const file=await uploaded.json();signedIn={userId:'other-family',email:'other@example.test'};assert.equal((await upload.GET(new Request('https://test.local'+file.url))).status,403);signedIn={userId:'family',email:'family@example.test'};const fileRead=await upload.GET(new Request('https://test.local'+file.url));assert.equal(fileRead.status,200);assert.equal(await fileRead.text(),'private document');
 signedIn={userId:'owner',email:'owner@example.test'};await post({kind:'task',id:task.id,data:{},remove:true});assert(!(await get()).records.some(r=>r.id===task.id));assert((await get()).audit.length>0);
 // Disabling a member immediately blocks existing sessions.
 await post({action:'grant',email:'family@example.test',role:'disabled'});
 signedIn={userId:'family',email:'family@example.test'};assert.equal((await get()).status,401);
 signedIn=null;
 const spoofed=await route.GET(new Request('https://test.local/api/data',{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'}}));assert.equal(spoofed.status,401);
 // Reject oversized and unapproved uploads before storing bytes.
 signedIn={userId:'owner',email:'owner@example.test'};
 const oversized=new FormData();oversized.append('file',new File([new Uint8Array(4*1024*1024+1)],'big.pdf',{type:'application/pdf'}));oversized.append('caseId',c1.id);
 assert.equal((await upload.POST(new Request('https://test.local/api/upload',{method:'POST',body:oversized}))).status,400);
 const database=load('lib/database.ts').database;
 await assert.rejects(database.batch([database.prepare('INSERT INTO grants (email,role,case_id) VALUES (?,?,?)').bind('rollback@example.test','family',c1.id),database.prepare('INSERT INTO missing_table (id) VALUES (?)').bind('bad')]));
 assert.equal(await database.prepare('SELECT * FROM grants WHERE email=?').bind('rollback@example.test').first(),null);
 async function login(body,origin='https://test.local'){return auth.POST(new Request('https://test.local/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}))}
 assert.equal((await login({email:'owner@example.test',password:'test-password'},'https://evil.test')).status,403);
 assert.equal((await login({email:'owner@example.test',password:'wrong'})).status,401);
 assert.equal((await login({email:'unassigned@example.test',password:'test-password'})).status,403);assert.equal(signedIn,null);
 assert.equal((await login({email:'owner@example.test',password:'test-password'})).status,200);
 assert.equal((await login({action:'logout'})).status,200);assert.equal(signedIn,null);
 signedIn={userId:'owner',email:'owner@example.test',confirmed:false};assert.equal((await get()).status,401);signedIn=null;
 configured=false;assert.equal((await get('?public=1')).setupRequired,true);await post({action:'submit',kind:'enquiry',data:{name:'Test'}},503);assert.equal((await login({email:'owner@example.test',password:'test-password'})).status,503);
 await sql.close();console.log('PASS: account bootstrap, persisted CRUD, family isolation, role restrictions, memorial consent, privacy and unlisted tokens, public field filtering, tribute moderation, RSVP validation, schedule conflicts, origin checks, protected uploads/downloads, deletion and audit history.');
})().catch(async e=>{console.error(e);await sql.close();process.exitCode=1});
