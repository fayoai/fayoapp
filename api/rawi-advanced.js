import {z} from 'zod';
const uuid=z.string().uuid();
const err=(c,status,message)=>c.json({ok:false,error:message},status);
const body=async c=>{try{return await c.req.json()}catch{return {}}};
const small=z.string().trim().min(2).max(180);
const stageSchema=z.object({name:small,sort_order:z.number().int().min(0).max(9999).default(100)});
const opportunitySchema=z.object({title:small,contact_id:uuid.nullable().optional(),stage_id:uuid.nullable().optional(),expected_halalas:z.number().int().min(0).max(1000000000000),probability:z.number().int().min(0).max(100).default(0),deadline:z.iso.date().nullable().optional(),notes:z.string().max(2000).default(''),status:z.enum(['open','won','lost']).default('open')});
const paymentSchema=z.object({direction:z.enum(['incoming','outgoing']),method:z.enum(['bank','cash']),amount_halalas:z.number().int().min(1).max(1000000000000),reference:small,details:z.string().max(1500).default(''),invoice_id:uuid.nullable().optional(),recorded_at:z.iso.date().optional()});
export function installRawiAdvanced(app,{db,query}){
 async function gate(c,write=false){
  const sql=db(c),workspace=c.req.param('workspace');
  if(!sql)return {error:err(c,503,'RAWI database is not connected')};
  if(!uuid.safeParse(workspace).success)return {error:err(c,400,'Invalid workspace')};
  const rows=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[workspace,c.get('adminId')]);
  if(!rows.length)return {error:err(c,404,'Workspace not found')};
  if(write&&rows[0].role==='viewer')return {error:err(c,403,'Insufficient permission')};
  return {sql,workspace};
 }
 app.get('/api/admin/erp/w/:workspace/advanced/:section',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const section=c.req.param('section'),sql=g.sql,w=g.workspace;
  if(section==='crm'){const [stages,opportunities,contacts]=await Promise.all([query(sql,'SELECT * FROM rawi_crm_stages WHERE workspace_id=$1 ORDER BY sort_order,name',[w]),query(sql,'SELECT o.*,c.name contact_name,s.name stage_name FROM rawi_opportunities o LEFT JOIN erp_contacts c ON c.id=o.contact_id AND c.workspace_id=o.workspace_id LEFT JOIN rawi_crm_stages s ON s.id=o.stage_id WHERE o.workspace_id=$1 ORDER BY o.created_at DESC LIMIT 500',[w]),query(sql,'SELECT id,name FROM erp_contacts WHERE workspace_id=$1 ORDER BY name',[w])]);return c.json({ok:true,stages,opportunities,contacts})}
  if(section==='payroll'){const [runs,employees]=await Promise.all([query(sql,'SELECT * FROM rawi_payroll_runs WHERE workspace_id=$1 ORDER BY period DESC LIMIT 100',[w]),query(sql,"SELECT id,name,employee_number,basic_salary_halalas FROM erp_employees WHERE workspace_id=$1 AND status='active' ORDER BY name",[w])]);return c.json({ok:true,runs,employees})}
  if(section==='payments'){const [payments,invoices]=await Promise.all([query(sql,'SELECT p.*,i.invoice_no FROM rawi_payments p LEFT JOIN erp_invoices i ON i.id=p.invoice_id WHERE p.workspace_id=$1 ORDER BY p.created_at DESC LIMIT 500',[w]),query(sql,'SELECT id,invoice_no,total_halalas,status FROM erp_invoices WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200',[w])]);return c.json({ok:true,payments,invoices})}
  return err(c,404,'Unknown advanced department');
 });
 app.post('/api/admin/erp/w/:workspace/advanced/stages',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const v=stageSchema.safeParse(await body(c));if(!v.success)return err(c,400,'Invalid CRM stage');
  const x=v.data;
  const row=await query(g.sql,'INSERT INTO rawi_crm_stages(workspace_id,name,sort_order) VALUES($1,$2,$3) ON CONFLICT(workspace_id,name) DO UPDATE SET sort_order=EXCLUDED.sort_order RETURNING id',[g.workspace,x.name,x.sort_order]);
  return c.json({ok:true,id:row[0].id},201);
 });
 app.post('/api/admin/erp/w/:workspace/advanced/opportunities',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const v=opportunitySchema.safeParse(await body(c));if(!v.success)return err(c,400,'Invalid opportunity');
  const x=v.data;
  const row=await query(g.sql,`INSERT INTO rawi_opportunities(workspace_id,title,contact_id,stage_id,expected_halalas,probability,deadline,status,notes)
 SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9 WHERE
 ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM erp_contacts WHERE id=$3 AND workspace_id=$1))
 AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM rawi_crm_stages WHERE id=$4 AND workspace_id=$1))
 RETURNING id`,[g.workspace,x.title,x.contact_id||null,x.stage_id||null,x.expected_halalas,x.probability,x.deadline||null,x.status,x.notes]);
  return row.length?c.json({ok:true,id:row[0].id},201):err(c,400,'Contact or stage is outside your workspace');
 });
 app.patch('/api/admin/erp/w/:workspace/advanced/opportunities/:id',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  if(!uuid.safeParse(c.req.param('id')).success)return err(c,400,'Invalid opportunity');
  const v=z.object({status:z.enum(['open','won','lost']),stage_id:uuid.nullable().optional(),probability:z.number().int().min(0).max(100)}).safeParse(await body(c));if(!v.success)return err(c,400,'Invalid opportunity status');
  const x=v.data;
  const row=await query(g.sql,`UPDATE rawi_opportunities SET status=$1,stage_id=$2,probability=$3,updated_at=now()
 WHERE workspace_id=$4 AND id=$5 AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM rawi_crm_stages WHERE workspace_id=$4 AND id=$2)) RETURNING id`,[x.status,x.stage_id||null,x.probability,g.workspace,c.req.param('id')]);
  return row.length?c.json({ok:true}):err(c,404,'Opportunity or stage not found');
 });
 app.post('/api/admin/erp/w/:workspace/advanced/payroll',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const v=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)}).safeParse(await body(c));if(!v.success)return err(c,400,'Invalid payroll month');
  const period=v.data.period+'-01';
  const row=await query(g.sql,`WITH staff AS(
   SELECT jsonb_agg(jsonb_build_object('employee_id',id,'name',name,'employee_number',employee_number,'basic_salary_halalas',basic_salary_halalas) ORDER BY name) AS items,
   sum(basic_salary_halalas)::bigint AS gross,count(*)::int AS total
   FROM erp_employees WHERE workspace_id=$1 AND status='active'
  ),created AS(INSERT INTO rawi_payroll_runs(workspace_id,period,employees,gross_halalas)
    SELECT $1,$2::date,staff.items,staff.gross FROM staff WHERE staff.total>0
    ON CONFLICT(workspace_id,period) DO NOTHING RETURNING *)
    SELECT * FROM created`,[g.workspace,period]);
  return row.length?c.json({ok:true,data:row[0]},201):err(c,409,'No active employees or a payroll already exists for this month');
 });
 app.patch('/api/admin/erp/w/:workspace/advanced/payroll/:id/approve',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  if(!uuid.safeParse(c.req.param('id')).success)return err(c,400,'Invalid payroll');
  const row=await query(g.sql,"UPDATE rawi_payroll_runs SET status='approved',approved_at=now() WHERE id=$1 AND workspace_id=$2 AND status='draft' RETURNING id",[c.req.param('id'),g.workspace]);
  return row.length?c.json({ok:true}):err(c,409,'Payroll already approved or not found');
 });
 app.post('/api/admin/erp/w/:workspace/advanced/payments',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const v=paymentSchema.safeParse(await body(c));if(!v.success)return err(c,400,'Invalid payment');
  const x=v.data;
  if(x.invoice_id&&x.direction==='outgoing')return err(c,400,'Customer invoice receipts must be incoming');
  const row=await query(g.sql,`INSERT INTO rawi_payments(workspace_id,direction,method,amount_halalas,reference,details,invoice_id,recorded_at)
 SELECT $1,$2,$3,$4,$5,$6,$7,$8::date WHERE
 ($7::uuid IS NULL OR EXISTS(SELECT 1 FROM erp_invoices WHERE workspace_id=$1 AND id=$7 AND status IN('issued','paid')))
 RETURNING id`,[g.workspace,x.direction,x.method,x.amount_halalas,x.reference,x.details,x.invoice_id||null,x.recorded_at||new Date().toISOString().slice(0,10)]);
  return row.length?c.json({ok:true,id:row[0].id},201):err(c,404,'Invoice unavailable or outside your workspace');
 });
}
