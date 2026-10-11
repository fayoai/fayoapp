import {z} from 'zod';
const uid=z.string().uuid(),fail=(c,status,error)=>c.json({ok:false,error},status);
const body=async c=>{try{return await c.req.json()}catch{return {}}};
export const activityInput=z.object({
 sector:z.string().regex(/^[a-z0-9-]{2,64}$/),title:z.string().trim().min(2).max(240),
 customer_id:uid.nullable().optional(),assigned_to:z.string().max(160).default(''),
 priority:z.enum(['low','normal','high','urgent']).default('normal'),
 due_on:z.iso.date().nullable().optional(),description:z.string().max(3000).default(''),
 reference:z.string().max(100).default(''),estimated_halalas:z.number().int().min(0).max(1000000000000).default(0),
 details:z.record(z.string().max(64),z.union([z.string().max(500),z.number(),z.boolean()])).default({})
});
export function installRawiActivities(app,{db,query}){
 async function access(c,write=false){
  const sql=db(c),w=c.req.param('workspace');
  if(!sql)return {error:fail(c,503,'Database unavailable')};
  if(!uid.safeParse(w).success)return {error:fail(c,400,'Invalid workspace')};
  const rows=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[w,c.get('adminId')]);
  if(!rows.length)return {error:fail(c,404,'Workspace not found')};
  if(write&&rows[0].role==='viewer')return {error:fail(c,403,'Read-only access')};
  return {sql,w};
 }
 app.get('/api/admin/erp/w/:workspace/activities',async c=>{
  const g=await access(c);if(g.error)return g.error;
  const sector=c.req.query('sector')||'';
  if(sector&&!/^[a-z0-9-]{2,64}$/.test(sector))return fail(c,400,'Invalid business sector');
  const [records,summary,contacts]=await Promise.all([
   query(g.sql,'SELECT a.*,c.name customer_name FROM rawi_activity_cases a LEFT JOIN erp_contacts c ON c.id=a.customer_id AND c.workspace_id=a.workspace_id WHERE a.workspace_id=$1 AND ($2::text=\'\' OR a.sector=$2) ORDER BY a.created_at DESC LIMIT 500',[g.w,sector]),
   query(g.sql,'SELECT sector,status,count(*)::int count FROM rawi_activity_cases WHERE workspace_id=$1 GROUP BY sector,status ORDER BY sector,status',[g.w]),
   query(g.sql,'SELECT id,name FROM erp_contacts WHERE workspace_id=$1 ORDER BY name LIMIT 500',[g.w])
  ]);
  return c.json({ok:true,records,summary,contacts});
 });
 app.post('/api/admin/erp/w/:workspace/activities',async c=>{
  const g=await access(c,true);if(g.error)return g.error;
  const v=activityInput.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid work order');
  const x=v.data;const r=await query(g.sql,`INSERT INTO rawi_activity_cases(workspace_id,sector,title,customer_id,assigned_to,priority,due_on,description,reference,estimated_halalas,details)
   SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb
   WHERE $4::uuid IS NULL OR EXISTS(SELECT 1 FROM erp_contacts WHERE workspace_id=$1 AND id=$4) RETURNING id`,
   [g.w,x.sector,x.title,x.customer_id||null,x.assigned_to,x.priority,x.due_on||null,x.description,x.reference,x.estimated_halalas,JSON.stringify(x.details)]);
  return r.length?c.json({ok:true,id:r[0].id},201):fail(c,400,'Customer does not belong to this organization');
 });
 app.patch('/api/admin/erp/w/:workspace/activities/:id',async c=>{
  const g=await access(c,true);if(g.error)return g.error;
  if(!uid.safeParse(c.req.param('id')).success)return fail(c,400,'Invalid work order');
  const v=z.object({status:z.enum(['planned','in_progress','done','cancelled'])}).safeParse(await body(c));
  if(!v.success)return fail(c,400,'Invalid status');
  const r=await query(g.sql,'UPDATE rawi_activity_cases SET status=$1,updated_at=now() WHERE workspace_id=$2 AND id=$3 RETURNING id',[v.data.status,g.w,c.req.param('id')]);
  return r.length?c.json({ok:true}):fail(c,404,'Work order not found');
 });
}
