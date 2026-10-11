import {z} from 'zod';
const uid=z.string().uuid();
const fail=(c,status,msg)=>c.json({ok:false,error:msg},status);
const body=async c=>{try{return await c.req.json()}catch{return {}}};
const cash=z.number().finite().min(0).max(100000000);
const minor=n=>{const x=Math.round(n*100);if(!Number.isSafeInteger(x)||Math.abs(x-n*100)>.000001)throw Error('Invalid currency amount');return x};
const safeName=z.string().trim().min(2).max(180);
const itemSchema=z.object({sku:z.string().trim().min(1).max(60),name:safeName,type:z.enum(['stock','service']).default('stock'),unit:z.string().trim().min(1).max(30).default('unit'),sale_price:cash.default(0),cost:cash.default(0)});
const warehouseSchema=z.object({name:safeName,location:z.string().max(300).default('')});
const employeeSchema=z.object({name:safeName,employee_number:z.string().trim().min(1).max(60),email:z.union([z.literal(''),z.email()]).default(''),department:z.string().max(100).default(''),job_title:z.string().max(100).default(''),basic_salary:cash.default(0)});
const projectSchema=z.object({name:safeName,customer_id:uid.nullable().default(null),owner:z.string().max(150).default(''),budget:cash.default(0),start_on:z.iso.date().nullable().default(null),due_on:z.iso.date().nullable().default(null)});
const expenseSchema=z.object({description:safeName,amount:z.number().positive().max(100000000),category:z.string().min(2).max(80).default('general'),employee_id:uid.nullable().default(null),occurred_on:z.iso.date().optional()});
const accountSchema=z.object({code:z.string().trim().min(2).max(30),name:safeName,type:z.enum(['asset','liability','equity','income','expense'])});
const docSchema=z.object({kind:z.enum(['sale','purchase']),partner_id:uid,lines:z.array(z.object({item_id:uid,quantity:z.number().positive().max(100000)})).min(1).max(80),notes:z.string().max(2000).default('')});
const journalSchema=z.object({reference:z.string().trim().min(2).max(120),memo:z.string().max(800).default(''),posted_on:z.iso.date().optional(),lines:z.array(z.object({account_id:uid,debit:cash.default(0),credit:cash.default(0)})).min(2).max(100)});
const stockSchema=z.object({item_id:uid,warehouse_id:uid,delta:z.number().min(-1000000).max(1000000).refine(n=>n!==0&&Number.isInteger(n*1000)),reason:z.string().trim().min(2).max(250)});
const tables={items:'erp_items',warehouses:'erp_warehouses',stock:'erp_stock',movements:'erp_stock_movements',documents:'erp_documents',accounts:'erp_accounts',journal:'erp_journal_entries',employees:'erp_employees',projects:'erp_projects',expenses:'erp_expenses'};
export function journalTotals(lines){
 let debit=0,credit=0;
 const normalized=lines.map(x=>{const d=minor(x.debit),c=minor(x.credit);if((d>0)===(c>0))throw Error('Each journal line must contain one positive debit or credit');debit+=d;credit+=c;return {account_id:x.account_id,debit_halalas:d,credit_halalas:c}});
 if(!Number.isSafeInteger(debit+credit)||!debit||debit!==credit)throw Error('Journal entry must balance');
 return {lines:normalized,debit_halalas:debit,credit_halalas:credit};
}
export function installErpCore(app,{db,query}){
 async function gate(c,write=false){
  const sql=db(c),workspace=c.req.param('workspace');
  if(!sql)return {err:fail(c,503,'ERP database is not connected')};
  if(!uid.safeParse(workspace).success)return {err:fail(c,400,'Invalid organization')};
  const rows=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[workspace,c.get('adminId')]);
  if(!rows.length)return {err:fail(c,404,'Organization not found')};
  if(write&&rows[0].role==='viewer')return {err:fail(c,403,'Read-only permission')};
  return {sql,workspace};
 }
 app.get('/api/admin/erp/w/:workspace/core/:section',async c=>{
  const g=await gate(c);if(g.err)return g.err;
  const section=c.req.param('section');if(section==='reports'){
   const [documents,employees,expenses,inventory,finance]=await Promise.all([
    query(g.sql,"SELECT kind,status,count(*)::int count,COALESCE(sum(total_halalas),0)::bigint amount FROM erp_documents WHERE workspace_id=$1 GROUP BY kind,status",[g.workspace]),
    query(g.sql,'SELECT count(*)::int count,COALESCE(sum(basic_salary_halalas),0)::bigint payroll FROM erp_employees WHERE workspace_id=$1 AND status=$2',[g.workspace,'active']),
    query(g.sql,"SELECT status,count(*)::int count,COALESCE(sum(amount_halalas),0)::bigint amount FROM erp_expenses WHERE workspace_id=$1 GROUP BY status",[g.workspace]),
    query(g.sql,'SELECT count(*)::int items,COALESCE(sum(s.quantity),0)::numeric balance FROM erp_stock s WHERE s.workspace_id=$1',[g.workspace]),
    query(g.sql,'SELECT COALESCE(sum(debit_halalas),0)::bigint debits,COALESCE(sum(credit_halalas),0)::bigint credits FROM erp_journal_entries WHERE workspace_id=$1',[g.workspace])
   ]);
   return c.json({ok:true,data:{documents,employees:employees[0],expenses,inventory:inventory[0],finance:finance[0]}});
  }
  if(!tables[section])return fail(c,404,'Unknown ERP department');
  const table=tables[section];let sql='SELECT * FROM '+table+' WHERE workspace_id=$1 ORDER BY '+(section==='stock'?'item_id':section==='items'||section==='warehouses'||section==='accounts'?'name':'created_at DESC')+' LIMIT 500';
  if(section==='stock')sql='SELECT s.*,i.name item_name,w.name warehouse_name FROM erp_stock s JOIN erp_items i ON i.id=s.item_id JOIN erp_warehouses w ON w.id=s.warehouse_id WHERE s.workspace_id=$1 ORDER BY i.name,w.name';
  return c.json({ok:true,data:await query(g.sql,sql,[g.workspace])});
 });
 app.post('/api/admin/erp/w/:workspace/core/items',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=itemSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid item details');
  const x=v.data;const rows=await query(g.sql,'INSERT INTO erp_items(workspace_id,sku,name,type,unit,sale_price_halalas,cost_halalas) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,sku) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,unit=EXCLUDED.unit,sale_price_halalas=EXCLUDED.sale_price_halalas,cost_halalas=EXCLUDED.cost_halalas RETURNING *',[g.workspace,x.sku,x.name,x.type,x.unit,minor(x.sale_price),minor(x.cost)]);
  return c.json({ok:true,data:rows[0]},201);
 });
 app.post('/api/admin/erp/w/:workspace/core/warehouses',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=warehouseSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid warehouse');
  const x=v.data;const rows=await query(g.sql,'INSERT INTO erp_warehouses(workspace_id,name,location) VALUES($1,$2,$3) ON CONFLICT(workspace_id,name) DO UPDATE SET location=EXCLUDED.location RETURNING *',[g.workspace,x.name,x.location]);
  return c.json({ok:true,data:rows[0]},201);
 });
 app.post('/api/admin/erp/w/:workspace/core/movements',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=stockSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid stock adjustment');
  const x=v.data;
  const sql='WITH available AS(SELECT i.id FROM erp_items i JOIN erp_warehouses w ON w.workspace_id=i.workspace_id WHERE i.workspace_id=$1 AND i.id=$2 AND i.type=$5 AND w.id=$3), updated AS(INSERT INTO erp_stock(workspace_id,item_id,warehouse_id,quantity) SELECT $1,$2,$3,GREATEST($4,0) FROM available WHERE $4>=0 OR EXISTS(SELECT 1 FROM erp_stock WHERE workspace_id=$1 AND item_id=$2 AND warehouse_id=$3) ON CONFLICT(workspace_id,item_id,warehouse_id) DO UPDATE SET quantity=erp_stock.quantity+$4 WHERE erp_stock.quantity+$4>=0 RETURNING quantity), event AS(INSERT INTO erp_stock_movements(workspace_id,item_id,warehouse_id,delta,reason) SELECT $1,$2,$3,$4,$6 FROM updated RETURNING id) SELECT updated.quantity,event.id FROM updated,event';
  const rows=await query(g.sql,sql,[g.workspace,x.item_id,x.warehouse_id,x.delta,'stock',x.reason]);
  return rows.length?c.json({ok:true,data:rows[0]},201):fail(c,409,'Insufficient stock or item/warehouse unavailable');
 });
 app.post('/api/admin/erp/w/:workspace/core/documents',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=docSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid sales/purchase document');
  const x=v.data;
  const partner=await query(g.sql,'SELECT kind FROM erp_contacts WHERE workspace_id=$1 AND id=$2',[g.workspace,x.partner_id]);
  if(!partner.length||(x.kind==='sale'&&partner[0].kind==='vendor')||(x.kind==='purchase'&&partner[0].kind==='customer'))return fail(c,400,'Invalid customer or supplier');
  const ids=[...new Set(x.lines.map(l=>l.item_id))];
  if(ids.length!==x.lines.length)return fail(c,400,'Duplicate document items');
  const products=await query(g.sql,'SELECT id,sku,name,sale_price_halalas,cost_halalas FROM erp_items WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND active=true',[g.workspace,ids]);
  if(products.length!==ids.length)return fail(c,400,'Some items are unavailable');
  let sub=0;const lines=x.lines.map(l=>{const p=products.find(i=>i.id===l.item_id),unit=Number(x.kind==='sale'?p.sale_price_halalas:p.cost_halalas),amount=Math.round(l.quantity*unit);sub+=amount;return {item_id:p.id,sku:p.sku,name:p.name,quantity:l.quantity,unit_halalas:unit,total_halalas:amount}});
  const vat=Math.round(sub*.15);if(!Number.isSafeInteger(sub+vat)||sub+vat>1e12)return fail(c,400,'Document amount too large');
  const stmt="WITH seq AS(INSERT INTO erp_document_sequences(workspace_id,kind,year,number) VALUES($1,$2,EXTRACT(YEAR FROM CURRENT_DATE)::int,1) ON CONFLICT(workspace_id,kind,year) DO UPDATE SET number=erp_document_sequences.number+1 RETURNING year,number), created AS(INSERT INTO erp_documents(workspace_id,doc_no,kind,partner_id,lines,subtotal_halalas,vat_halalas,total_halalas,notes) SELECT $1,CASE WHEN $2='sale' THEN 'SO-' ELSE 'PO-' END||seq.year||'-'||lpad(seq.number::text,6,'0'),$2,$3,$4::jsonb,$5,$6,$7,$8 FROM seq RETURNING *) SELECT * FROM created";
  const rows=await query(g.sql,stmt,[g.workspace,x.kind,x.partner_id,JSON.stringify(lines),sub,vat,sub+vat,x.notes]);
  return c.json({ok:true,data:rows[0]},201);
 });
 app.patch('/api/admin/erp/w/:workspace/core/documents/:id/status',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const x=z.object({status:z.enum(['confirmed','completed','cancelled'])}).safeParse(await body(c));
  if(!x.success||!uid.safeParse(c.req.param('id')).success)return fail(c,400,'Invalid status');
  const rows=await query(g.sql,"UPDATE erp_documents SET status=$1 WHERE id=$2 AND workspace_id=$3 AND ((status='draft' AND $1 IN('confirmed','cancelled')) OR (status='confirmed' AND $1 IN('completed','cancelled'))) RETURNING id,status",[x.data.status,c.req.param('id'),g.workspace]);
  return rows.length?c.json({ok:true,data:rows[0]}):fail(c,409,'Invalid document transition');
 });
 app.post('/api/admin/erp/w/:workspace/core/accounts',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=accountSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid account');
  const x=v.data;const rows=await query(g.sql,'INSERT INTO erp_accounts(workspace_id,code,name,type) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,code) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type RETURNING *',[g.workspace,x.code,x.name,x.type]);
  return c.json({ok:true,data:rows[0]},201);
 });
 app.post('/api/admin/erp/w/:workspace/core/journal',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=journalSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid journal');
  let t;try{t=journalTotals(v.data.lines)}catch(e){return fail(c,400,e.message)}
  const ids=[...new Set(t.lines.map(l=>l.account_id))];const acc=await query(g.sql,'SELECT id FROM erp_accounts WHERE workspace_id=$1 AND id=ANY($2::uuid[])',[g.workspace,ids]);
  if(acc.length!==ids.length)return fail(c,400,'Journal contains account outside organization');
  const rows=await query(g.sql,'INSERT INTO erp_journal_entries(workspace_id,reference,memo,posted_on,lines,debit_halalas,credit_halalas) VALUES($1,$2,$3,COALESCE($4::date,CURRENT_DATE),$5::jsonb,$6,$7) RETURNING *',[g.workspace,v.data.reference,v.data.memo,v.data.posted_on||null,JSON.stringify(t.lines),t.debit_halalas,t.credit_halalas]);
  return c.json({ok:true,data:rows[0]},201);
 });
 app.post('/api/admin/erp/w/:workspace/core/employees',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=employeeSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid employee');
  const x=v.data;const rows=await query(g.sql,'INSERT INTO erp_employees(workspace_id,name,employee_number,email,department,job_title,basic_salary_halalas) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,employee_number) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,department=EXCLUDED.department,job_title=EXCLUDED.job_title,basic_salary_halalas=EXCLUDED.basic_salary_halalas RETURNING *',[g.workspace,x.name,x.employee_number,x.email,x.department,x.job_title,minor(x.basic_salary)]);
  return c.json({ok:true,data:rows[0]},201);
 });
 app.post('/api/admin/erp/w/:workspace/core/projects',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=projectSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid project');
  const x=v.data;if(x.customer_id){const partner=await query(g.sql,'SELECT 1 FROM erp_contacts WHERE id=$1 AND workspace_id=$2',[x.customer_id,g.workspace]);if(!partner.length)return fail(c,400,'Customer not found')}
  const rows=await query(g.sql,'INSERT INTO erp_projects(workspace_id,name,customer_id,owner,budget_halalas,start_on,due_on) VALUES($1,$2,$3,$4,$5,$6::date,$7::date) RETURNING *',[g.workspace,x.name,x.customer_id,x.owner,minor(x.budget),x.start_on,x.due_on]);return c.json({ok:true,data:rows[0]},201);
 });
 app.post('/api/admin/erp/w/:workspace/core/expenses',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const v=expenseSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid expense');
  const x=v.data;if(x.employee_id){const employee=await query(g.sql,'SELECT 1 FROM erp_employees WHERE id=$1 AND workspace_id=$2',[x.employee_id,g.workspace]);if(!employee.length)return fail(c,400,'Employee not found')}
  const rows=await query(g.sql,'INSERT INTO erp_expenses(workspace_id,description,amount_halalas,category,employee_id,occurred_on) VALUES($1,$2,$3,$4,$5,COALESCE($6::date,CURRENT_DATE)) RETURNING *',[g.workspace,x.description,minor(x.amount),x.category,x.employee_id,x.occurred_on||null]);return c.json({ok:true,data:rows[0]},201);
 });
 app.patch('/api/admin/erp/w/:workspace/core/expenses/:id/status',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;const x=z.object({status:z.enum(['approved','rejected','paid'])}).safeParse(await body(c));if(!x.success||!uid.safeParse(c.req.param('id')).success)return fail(c,400,'Invalid expense update');
  const rows=await query(g.sql,"UPDATE erp_expenses SET status=$1 WHERE workspace_id=$2 AND id=$3 AND ((status='submitted' AND $1 IN('approved','rejected')) OR (status='approved' AND $1='paid')) RETURNING id,status",[x.data.status,g.workspace,c.req.param('id')]);
  return rows.length?c.json({ok:true,data:rows[0]}):fail(c,409,'Invalid expense status transition');
 });
}
