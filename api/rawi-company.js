import {z} from 'zod';
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
export function installRawiCompany(app,{centralDb,env,query}){
 app.get('/api/admin/company/setup',async c=>{
  const sql=centralDb(c);if(env(c).MIF_APP_SURFACE!=='enterprise'||!sql)return fail(c,404,'Not found');
  const rows=await query(sql,'SELECT p.*,w.name workspace_name FROM rawi_company_profiles p '+
   'JOIN erp_workspaces w ON w.id=p.workspace_id JOIN erp_memberships m ON m.workspace_id=w.id '+
   "WHERE m.admin_id=$1 AND m.role='owner' AND p.completed_at IS NULL LIMIT 1",[c.get('adminId')]);
  return c.json({ok:true,data:rows[0]||null});
 });
 app.post('/api/admin/company/complete',async c=>{
  const sql=centralDb(c);if(env(c).MIF_APP_SURFACE!=='enterprise'||!sql)return fail(c,404,'Not found');
  let body;try{body=await c.req.json()}catch{return fail(c,400,'Invalid company data')}
  const v=companyInput.safeParse(body);if(!v.success)return fail(c,400,'Invalid company details');
  const d=v.data,user=c.get('adminId');
  const stmt='WITH allowed AS( SELECT w.id FROM erp_workspaces w JOIN erp_memberships m ON m.workspace_id=w.id '+
   "JOIN rawi_company_profiles p ON p.workspace_id=w.id WHERE w.id=$1 AND m.admin_id=$2 AND m.role='owner' AND p.completed_at IS NULL ), "+
   'changed AS( UPDATE erp_workspaces w SET name=$3,legal_name=$3,address=$4,vat_number=$6,phone=$7 '+
   'FROM allowed a WHERE w.id=a.id RETURNING w.id ), saved AS( '+
   'UPDATE rawi_company_profiles p SET logo_data=$5,name=$3,address=$4,commercial_registration=$8, '+
   'tax_number=$6,phone=$7,mobile=$9,website=$10,emails=$11,activity=$12,description=$13,completed_at=now() '+
   'FROM changed x WHERE p.workspace_id=x.id RETURNING p.workspace_id ) SELECT workspace_id FROM saved';
  const rows=await query(sql,stmt,[d.workspace_id,user,d.name,d.address,d.logo_data,d.tax_number,
   d.phone||d.mobile,d.commercial_registration,d.mobile,d.website,d.emails,d.activity,d.description]);
  return rows.length?c.json({ok:true,workspace_id:rows[0].workspace_id}):fail(c,404,'Pending company profile was not found');
 });
}
