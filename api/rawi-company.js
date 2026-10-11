import {z} from 'zod';
import {getAIProviders,routeAI} from './ai-router.js';
import {basicBusinessPlan,generateBusinessPlan} from './rawi-business-setup.js';
const fail=(c,status,error)=>c.json({ok:false,error},status);
export const companyInput=z.object({
 workspace_id:z.string().uuid(),
 logo_data:z.string().max(250000).refine(v=>!v||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v),'Invalid logo'),
 name:z.string().trim().min(2).max(150),address:z.string().trim().min(5).max(450),
 commercial_registration:z.string().trim().max(50).default(''),tax_number:z.string().trim().max(50).default(''),
 phone:z.string().trim().max(35).default(''),mobile:z.string().trim().max(35).default(''),
 website:z.union([z.literal(''),z.url().max(250)]).default(''),
 emails:z.string().trim().max(450).default(''),activity:z.string().trim().min(2).max(200),
 description:z.string().trim().max(2000).default('')
}).refine(v=>!!v.phone||!!v.mobile,{message:'At least one contact number is required',path:['phone']});
const businessInput=z.object({workspace_id:z.string().uuid(),name:z.string().trim().min(2).max(150),
 activity:z.string().trim().min(2).max(200),language:z.enum(['ar','en']).default('ar')});
export function installRawiCompany(app,{centralDb,env,query}){
 app.get('/api/admin/company/setup',async c=>{
  const sql=centralDb(c);if(env(c).MIF_APP_SURFACE!=='enterprise'||!sql)return fail(c,404,'Not found');
  const rows=await query(sql,'SELECT p.*,w.name workspace_name FROM rawi_company_profiles p '+
   'JOIN erp_workspaces w ON w.id=p.workspace_id JOIN erp_memberships m ON m.workspace_id=w.id '+
   "WHERE m.admin_id=$1 AND m.role='owner' AND p.completed_at IS NULL LIMIT 1",[c.get('adminId')]);
  return c.json({ok:true,data:rows[0]||null});
 });
 app.post('/api/admin/company/plan',async c=>{
  const sql=centralDb(c);if(env(c).MIF_APP_SURFACE!=='enterprise'||!sql)return fail(c,404,'Not found');
  let json;try{json=await c.req.json()}catch{return fail(c,400,'Invalid business details')}
  const v=businessInput.safeParse(json);if(!v.success)return fail(c,400,'Enter company name and business activity');
  const d=v.data,user=c.get('adminId');
  const rows=await query(sql,"SELECT p.setup_plan,p.setup_inputs,p.setup_source,p.setup_updated_at "+
   "FROM rawi_company_profiles p JOIN erp_memberships m ON m.workspace_id=p.workspace_id "+
   "WHERE p.workspace_id=$1 AND m.admin_id=$2 AND m.role='owner' AND p.completed_at IS NULL",[d.workspace_id,user]);
  if(!rows.length)return fail(c,404,'Company setup unavailable');
  const existing=rows[0],inputs={name:d.name,activity:d.activity,language:d.language};
  if(existing.setup_plan?.sections?.length&&existing.setup_inputs?.name===d.name&&
   existing.setup_inputs?.activity===d.activity&&existing.setup_inputs?.language===d.language)
   return c.json({ok:true,plan:existing.setup_plan,source:existing.setup_source});
  // Avoid model charges for rapid successive keystrokes even from malicious clients.
  const wait=existing.setup_updated_at?8000-(Date.now()-new Date(existing.setup_updated_at).getTime()):0;
  if(wait>0)return c.json({ok:true,retry_after_ms:Math.ceil(wait),pending:true});
  let providers=[];try{providers=await getAIProviders(sql,env(c),query)}catch{}
  const plan=await generateBusinessPlan(d.name,d.activity,d.language,providers,routeAI);
  const saved=await query(sql,"UPDATE rawi_company_profiles p SET setup_plan=$3::jsonb,setup_inputs=$4::jsonb,"+
   "setup_source=$5,setup_updated_at=now() WHERE p.workspace_id=$1 AND p.completed_at IS NULL AND EXISTS "+
   "(SELECT 1 FROM erp_memberships m WHERE m.workspace_id=p.workspace_id AND m.admin_id=$2 AND m.role='owner') RETURNING workspace_id",
   [d.workspace_id,user,JSON.stringify(plan),JSON.stringify(inputs),plan.source]);
  return saved.length?c.json({ok:true,plan,source:plan.source}):fail(c,404,'Company setup unavailable');
 });
 app.get('/api/admin/company/workspace-plan/:id',async c=>{
  const sql=centralDb(c);if(env(c).MIF_APP_SURFACE!=='enterprise'||!sql)return fail(c,404,'Not found');
  const id=c.req.param('id');if(!z.string().uuid().safeParse(id).success)return fail(c,400,'Invalid company');
  const rows=await query(sql,"SELECT p.setup_plan,p.setup_source,p.name,p.activity FROM rawi_company_profiles p "+
   "JOIN erp_memberships m ON m.workspace_id=p.workspace_id WHERE p.workspace_id=$1 AND m.admin_id=$2",
   [id,c.get('adminId')]);
  return rows.length?c.json({ok:true,data:{...rows[0].setup_plan,source:rows[0].setup_source,name:rows[0].name,activity:rows[0].activity}}):fail(c,404,'Company not found');
 });
 app.post('/api/admin/company/complete',async c=>{
  const sql=centralDb(c);if(env(c).MIF_APP_SURFACE!=='enterprise'||!sql)return fail(c,404,'Not found');
  let body;try{body=await c.req.json()}catch{return fail(c,400,'Invalid company data')}
  const v=companyInput.safeParse(body);if(!v.success)return fail(c,400,'Invalid company details');
  const d=v.data,user=c.get('adminId'),basic=basicBusinessPlan(d.name,d.activity,'ar');
  const stmt='WITH allowed AS( SELECT w.id FROM erp_workspaces w JOIN erp_memberships m ON m.workspace_id=w.id '+
   "JOIN rawi_company_profiles p ON p.workspace_id=w.id WHERE w.id=$1 AND m.admin_id=$2 AND m.role='owner' AND p.completed_at IS NULL ), "+
   'changed AS( UPDATE erp_workspaces w SET name=$3,legal_name=$3,address=$4,vat_number=$6,phone=$7 '+
   'FROM allowed a WHERE w.id=a.id RETURNING w.id ), saved AS( '+
   'UPDATE rawi_company_profiles p SET logo_data=$5,name=$3,address=$4,commercial_registration=$8, '+
   'tax_number=$6,phone=$7,mobile=$9,website=$10,emails=$11,activity=$12,description=$13,completed_at=now(), '+
   'setup_plan=CASE WHEN p.setup_inputs @> jsonb_build_object(\'name\',$3::text,\'activity\',$12::text) AND p.setup_plan ? \'sections\' THEN p.setup_plan ELSE $14::jsonb END, '+
   'setup_source=CASE WHEN p.setup_inputs @> jsonb_build_object(\'name\',$3::text,\'activity\',$12::text) AND p.setup_plan ? \'sections\' THEN p.setup_source ELSE \'basic\' END, '+
   'setup_inputs=jsonb_build_object(\'name\',$3::text,\'activity\',$12::text),setup_updated_at=now() '+
   'FROM changed x WHERE p.workspace_id=x.id RETURNING p.workspace_id ) SELECT workspace_id FROM saved';
  const rows=await query(sql,stmt,[d.workspace_id,user,d.name,d.address,d.logo_data,d.tax_number,
   d.phone||d.mobile,d.commercial_registration,d.mobile,d.website,d.emails,d.activity,d.description,JSON.stringify(basic)]);
  return rows.length?c.json({ok:true,workspace_id:rows[0].workspace_id}):fail(c,404,'Pending company profile was not found');
 });
}
