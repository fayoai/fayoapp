import {Hono} from 'hono';
import {getCookie,setCookie,deleteCookie} from 'hono/cookie';
import {neon} from '@neondatabase/serverless';
import {SignJWT,jwtVerify} from 'jose';
import {z} from 'zod';
import {installAiErp} from './ai-erp.js';
import {installErpCore} from './erp-core.js';
import {installMifChat} from './mif-chat.js';
const app=new Hono(),encoder=new TextEncoder();
const env=c=>c.env||{};
const db=c=>env(c).DATABASE_URL?neon(env(c).DATABASE_URL):null;
const query=(sql,text,args=[])=>sql.query(text,args);
const secret=c=>{const s=env(c).SESSION_SECRET;return s?.length>=32?encoder.encode(s):null};
const fail=(c,status,message)=>c.json({ok:false,error:message},status);
const parse=async c=>{try{return await c.req.json()}catch{return {}}};
const loginData=z.object({email:z.email().max(180),password:z.string().min(1).max(200)});
async function hashed(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:220000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')}
async function equal(a,b){const x=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(a)));const y=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(b)));return x.every((n,i)=>n===y[i])}
function originOK(c){const origin=c.req.header('origin');if(!origin)return true;try{const src=new URL(origin),dst=new URL(c.req.url);return src.origin===dst.origin||(['localhost','127.0.0.1'].includes(src.hostname)&&['localhost','127.0.0.1'].includes(dst.hostname))}catch{return false}}
app.onError((e,c)=>{console.error('ERP request failed',e?.message);return fail(c,500,'Server operation failed')});
app.use('/api/*',async(c,next)=>{c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');c.header('X-Frame-Options','DENY');c.header('Referrer-Policy','strict-origin-when-cross-origin');if(!['GET','HEAD','OPTIONS'].includes(c.req.method)&&!originOK(c))return fail(c,403,'Cross-origin request rejected');await next()});
app.get('/api/health',async c=>{const sql=db(c);if(!sql)return c.json({ok:false,service:'MIF Smart',database:'not_configured'},503);try{await query(sql,'SELECT 1');return c.json({ok:true,service:'MIF Smart AI ERP',database:'connected'})}catch{return fail(c,503,'Database unavailable')}});
app.post('/api/admin/bootstrap',async c=>{const sql=db(c),key=secret(c),bootstrap=env(c).ADMIN_BOOTSTRAP_TOKEN;if(!sql||!key||!bootstrap||bootstrap.length<24)return fail(c,503,'Administrator setup unavailable');const input=await parse(c),v=loginData.safeParse(input);if(!v.success||input.password.length<12||typeof input.token!=='string'||!(await equal(input.token,bootstrap)))return fail(c,403,'Administrator setup denied');const count=await query(sql,'SELECT count(*)::int n FROM admins');if(count[0].n)return fail(c,409,'Administrator already exists');const salt=crypto.randomUUID(),password_hash=await hashed(v.data.password,salt);await query(sql,'INSERT INTO admins(email,password_hash,salt) VALUES($1,$2,$3)',[v.data.email.toLowerCase(),password_hash,salt]);return c.json({ok:true})});
// Customer accounts are independent from the platform operator's OpenAI settings.
app.post('/api/admin/register',async c=>{
 const sql=db(c),key=secret(c),settings=env(c);
 if(!sql||!key)return fail(c,503,'Registration is unavailable');
 if(settings.REGISTRATION_ENABLED!=='true')return fail(c,503,'Account registration is not open yet');
 const schema=z.object({email:z.email().max(180),password:z.string().min(12).max(200),name:z.string().trim().min(2).max(160),organization:z.string().trim().min(2).max(150)});
 const v=schema.safeParse(await parse(c));if(!v.success)return fail(c,400,'Enter valid account and organization details');
 const ip=c.req.header('CF-Connecting-IP')||c.req.header('X-Real-IP');
 if(!ip)return fail(c,403,'Unable to verify registration source');
 const digest=await crypto.subtle.digest('SHA-256',encoder.encode(settings.SESSION_SECRET+'|'+ip));
 const clientKey=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 const attempts=await query(sql,"WITH claim AS(SELECT count(*)::int n FROM mif_registration_attempts WHERE client_key=$1 AND created_at>now()-interval '1 hour'), pushed AS(INSERT INTO mif_registration_attempts(client_key) SELECT $1 WHERE (SELECT n FROM claim)<5 RETURNING id) SELECT (SELECT count(*) FROM pushed)::int AS allowed",[clientKey]);
 if(attempts[0]?.allowed!==1)return fail(c,429,'Too many account registrations; try later');
 const user=v.data,salt=crypto.randomUUID(),passwordHash=await hashed(user.password,salt),email=user.email.toLowerCase();
 // The single statement creates all account records atomically.
 const stmt="WITH account AS(INSERT INTO admins(email,password_hash,salt) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id,email), workspace AS(INSERT INTO erp_workspaces(name,owner_id,currency) SELECT $4,id,'SAR' FROM account RETURNING id,owner_id), member AS(INSERT INTO erp_memberships(workspace_id,admin_id,role) SELECT id,owner_id,'owner' FROM workspace RETURNING workspace_id), templ AS(INSERT INTO erp_invoice_templates(workspace_id,name) SELECT id,'MIF Smart' FROM workspace RETURNING id) SELECT account.id,account.email FROM account JOIN workspace ON workspace.owner_id=account.id JOIN member ON member.workspace_id=workspace.id JOIN templ ON TRUE";
 const rows=await query(sql,stmt,[email,passwordHash,salt,user.organization]);
 if(!rows.length)return fail(c,409,'Email address is already registered');
 const row=rows[0],token=await new SignJWT({email:row.email}).setProtectedHeader({alg:'HS256'}).setSubject(row.id).setIssuer('mif-smart').setAudience('mif-console').setIssuedAt().setExpirationTime('8h').sign(key);
 setCookie(c,'mif_session',token,{httpOnly:true,sameSite:'Strict',secure:new URL(c.req.url).protocol==='https:',path:'/',maxAge:28800});
 return c.json({ok:true,email:row.email},201);
});
app.post('/api/admin/login',async c=>{const sql=db(c),key=secret(c);if(!sql||!key)return fail(c,503,'Admin login unavailable');const v=loginData.safeParse(await parse(c));if(!v.success)return fail(c,400,'Invalid credentials');const found=await query(sql,'SELECT id,email,password_hash,salt FROM admins WHERE email=$1',[v.data.email.toLowerCase()]);const row=found[0];const hash=await hashed(v.data.password,row?.salt||'invalid-salt');if(!row||!(await equal(hash,row.password_hash)))return fail(c,401,'Invalid credentials');const token=await new SignJWT({email:row.email}).setProtectedHeader({alg:'HS256'}).setSubject(row.id).setIssuer('mif-smart').setAudience('mif-console').setIssuedAt().setExpirationTime('8h').sign(key);setCookie(c,'mif_session',token,{httpOnly:true,sameSite:'Strict',secure:new URL(c.req.url).protocol==='https:',path:'/',maxAge:28800});return c.json({ok:true,email:row.email})});
app.use('/api/admin/*',async(c,next)=>{if(['login','bootstrap','register'].includes(c.req.path.split('/').pop()))return next();const key=secret(c);if(!key)return fail(c,503,'Authentication unavailable');const token=getCookie(c,'mif_session');if(!token)return fail(c,401,'Sign-in required');try{const {payload}=await jwtVerify(token,key,{issuer:'mif-smart',audience:'mif-console'});c.set('adminId',payload.sub);await next()}catch{return fail(c,401,'Session expired')}});
app.post('/api/admin/logout',c=>{deleteCookie(c,'mif_session',{path:'/'});return c.json({ok:true})});
app.get('/api/admin/me',async c=>{const sql=db(c);if(!sql)return fail(c,503,'Database unavailable');const rows=await query(sql,'SELECT id,email FROM admins WHERE id=$1',[c.get('adminId')]);return rows.length?c.json({ok:true,id:rows[0].id,email:rows[0].email,platform_owner:!!env(c).PLATFORM_OWNER_EMAIL&&rows[0].email.toLowerCase()===env(c).PLATFORM_OWNER_EMAIL.trim().toLowerCase()}):fail(c,401,'Account not found')});
installAiErp(app,{db,env,query});
installErpCore(app,{db,env,query});
installMifChat(app,{db,env,query});
export default app;
