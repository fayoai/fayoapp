import {z} from 'zod';
import {resolveItemUnit} from './rawi-uom.js';
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
const docSchema=z.object({kind:z.enum(['sale','purchase']),partner_id:uid,lines:z.array(z.object({item_id:uid,unit_id:uid.optional(),quantity:z.number().positive().max(100000)})).min(1).max(80),notes:z.string().max(2000).default('')});
const journalSchema=z.object({reference:z.string().trim().min(2).max(120),memo:z.string().max(800).default(''),posted_on:z.iso.date().optional(),lines:z.array(z.object({account_id:uid,debit:cash.default(0),credit:cash.default(0)})).min(2).max(100)});
const stockSchema=z.object({item_id:uid,warehouse_id:uid,unit_id:uid.optional(),delta:z.number().min(-1000000).max(1000000).refine(n=>n!==0&&Number.isInteger(n*1000)),reason:z.string().trim().min(2).max(250),expected_quantity:z.number().finite().min(0).max(1000000000).optional()});
const transferSchema=z.object({item_id:uid,source_warehouse_id:uid,target_warehouse_id:uid,unit_id:uid.optional(),quantity:z.number().positive().max(1000000),reference:z.string().trim().min(2).max(120)}).refine(x=>x.source_warehouse_id!==x.target_warehouse_id,{message:'Warehouses must be distinct'});
const tables={items:'erp_items',warehouses:'erp_warehouses',stock:'erp_stock',movements:'erp_stock_movements',documents:'erp_documents',accounts:'erp_accounts',journal:'erp_journal_entries',employees:'erp_employees',projects:'erp_projects',expenses:'erp_expenses'};
export function journalTotals(lines){
 let debit=0,credit=0;
 const normalized=lines.map(x=>{const d=minor(x.debit),c=minor(x.credit);if((d>0)===(c>0))throw Error('Each journal line must contain one positive debit or credit');debit+=d;credit+=c;return {account_id:x.account_id,debit_halalas:d,credit_halalas:c}});
 if(!Number.isSafeInteger(debit+credit)||!debit||debit!==credit)throw Error('Journal entry must balance');
 return {lines:normalized,debit_halalas:debit,credit_halalas:credit};
}
export function installErpCore(app,{db,centralDb,query}){
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
  let converted=null;
  if(x.unit_id){try{converted=await resolveItemUnit({sql:g.sql,query,workspace:g.workspace,itemId:x.item_id,unitId:x.unit_id,quantity:Math.abs(x.delta)})}catch(e){return fail(c,400,e.message)}}
  const delta=converted?Math.sign(x.delta)*converted.baseQuantity:x.delta;
  const sql='WITH available AS(SELECT i.id FROM erp_items i JOIN erp_warehouses w ON w.workspace_id=i.workspace_id WHERE i.workspace_id=$1 AND i.id=$2 AND i.type=$5 AND w.id=$3), updated AS(INSERT INTO erp_stock(workspace_id,item_id,warehouse_id,quantity) SELECT $1,$2,$3,GREATEST($4,0) FROM available WHERE $4>=0 OR EXISTS(SELECT 1 FROM erp_stock WHERE workspace_id=$1 AND item_id=$2 AND warehouse_id=$3) ON CONFLICT(workspace_id,item_id,warehouse_id) DO UPDATE SET quantity=erp_stock.quantity+$4 WHERE erp_stock.quantity+$4>=0 AND ($7::numeric IS NULL OR erp_stock.quantity=$7) RETURNING quantity), event AS(INSERT INTO erp_stock_movements(workspace_id,item_id,warehouse_id,delta,reason) SELECT $1,$2,$3,$4,$6 FROM updated RETURNING id) SELECT updated.quantity,event.id FROM updated,event';
  const rows=await query(g.sql,sql,[g.workspace,x.item_id,x.warehouse_id,delta,'stock',x.unit_id?x.reason+' ('+converted.unit_code+')':x.reason,x.expected_quantity??null]);
  return rows.length?c.json({ok:true,data:rows[0]},201):fail(c,409,'Insufficient stock or item/warehouse unavailable');
 });
 app.post('/api/admin/erp/w/:workspace/core/transfers',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const v=transferSchema.safeParse(await body(c));if(!v.success)return fail(c,400,'Invalid stock transfer');
  const x=v.data;
  let qty;try{qty=(await resolveItemUnit({sql:g.sql,query,workspace:g.workspace,itemId:x.item_id,unitId:x.unit_id,quantity:x.quantity})).baseQuantity}
  catch(e){return fail(c,400,e.message)}
  if(!Number.isFinite(qty)||qty<=0)return fail(c,400,'Invalid transfer quantity');
  // All effects are in ONE PostgreSQL statement. A missing/insufficient source does not
  // debit, credit, or write movements. Destination and movement failures roll back source.
  const statement=`WITH allowed AS(
   SELECT i.id FROM erp_items i
   JOIN erp_warehouses src ON src.workspace_id=i.workspace_id AND src.id=$3
   JOIN erp_warehouses dst ON dst.workspace_id=i.workspace_id AND dst.id=$4
   WHERE i.workspace_id=$1 AND i.id=$2 AND i.type='stock' AND src.id<>dst.id
  ), withdrawn AS(
   UPDATE erp_stock s SET quantity=s.quantity-$5::numeric FROM allowed
   WHERE s.workspace_id=$1 AND s.item_id=$2 AND s.warehouse_id=$3 AND s.quantity>=$5::numeric
   RETURNING s.item_id
  ), deposited AS(
   INSERT INTO erp_stock(workspace_id,item_id,warehouse_id,quantity)
   SELECT $1,item_id,$4,$5::numeric FROM withdrawn
   ON CONFLICT(workspace_id,item_id,warehouse_id) DO UPDATE SET quantity=erp_stock.quantity+EXCLUDED.quantity
   RETURNING item_id
  ), movements AS(
   INSERT INTO erp_stock_movements(workspace_id,item_id,warehouse_id,delta,reason)
   SELECT $1,$2,$3,-$5::numeric,$6::text||' (OUT)' FROM deposited
   UNION ALL
   SELECT $1,$2,$4,$5::numeric,$6::text||' (IN)' FROM deposited
   RETURNING id
  ) SELECT (SELECT COUNT(*)::int FROM deposited) moved,
     (SELECT COUNT(*)::int FROM movements) movement_count`;
  const data=await query(g.sql,statement,[g.workspace,x.item_id,x.source_warehouse_id,x.target_warehouse_id,qty,x.reference]);
  if(data[0]?.moved!==1||data[0]?.movement_count!==2)return fail(c,409,'Insufficient source stock, unavailable item or invalid warehouses');
  return c.json({ok:true,moved_quantity:qty,reference:x.reference},201);
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
  let sub=0,lines=[];
  try{for(const l of x.lines){
   const p=products.find(i=>i.id===l.item_id);
   const conversion=await resolveItemUnit({sql:g.sql,query,workspace:g.workspace,itemId:l.item_id,unitId:l.unit_id,quantity:l.quantity});
   const price=x.kind==='sale'?conversion.sale_price_halalas:conversion.purchase_price_halalas;
   const amount=Math.round(l.quantity*price);sub+=amount;
   lines.push({item_id:p.id,sku:p.sku,name:p.name,quantity:l.quantity,base_quantity:conversion.baseQuantity,unit_id:l.unit_id||null,unit_code:conversion.unit_code,unit_halalas:price,total_halalas:amount});
  }}catch(e){return fail(c,400,e.message)}
  const settings=await query(g.sql,'SELECT vat_rate FROM erp_workspaces WHERE id=$1',[g.workspace]);
  const finance=x.kind==='purchase'&&centralDb?await query(centralDb(c),'SELECT setup_inputs FROM rawi_company_profiles WHERE workspace_id=$1',[g.workspace]):[];
  const rate=x.kind==='purchase'?Number(finance[0]?.setup_inputs?.finance?.purchases_tax_rate??15)/100:Number(settings[0]?.vat_rate??.15);
  if(!Number.isFinite(rate)||rate<0||rate>1)return fail(c,400,'Invalid company tax configuration');
  const vat=Math.round(sub*rate);if(!Number.isSafeInteger(sub+vat)||sub+vat>1e12)return fail(c,400,'Document amount too large');
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
 // A confirmed purchase order can be received fully into a verified company warehouse.
 // The status change, positive stock balances and audit movements share one SQL transaction.
 app.post('/api/admin/erp/w/:workspace/core/documents/:id/receive',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const id=c.req.param('id');
  const v=z.object({warehouse_id:uid}).strict().safeParse(await body(c));
  if(!uid.safeParse(id).success||!v.success)return fail(c,400,'Choose a valid purchase order and receiving warehouse');
  const statement=`WITH received AS(
    UPDATE erp_documents d SET status='completed'
    FROM erp_warehouses w
    WHERE d.workspace_id=$1 AND d.id=$2 AND d.kind='purchase' AND d.status='confirmed'
      AND w.workspace_id=$1 AND w.id=$3
    RETURNING d.id,d.doc_no,d.lines
  ), goods AS(
    SELECT (line->>'item_id')::uuid item_id,(line->>'base_quantity')::numeric quantity
    FROM received d CROSS JOIN LATERAL jsonb_array_elements(d.lines) line
    JOIN erp_items i ON i.id=(line->>'item_id')::uuid AND i.workspace_id=$1 AND i.type='stock'
  ), added AS(
    INSERT INTO erp_stock(workspace_id,item_id,warehouse_id,quantity)
    SELECT $1,item_id,$3,quantity FROM goods
    ON CONFLICT(workspace_id,item_id,warehouse_id) DO UPDATE
     SET quantity=erp_stock.quantity+EXCLUDED.quantity
    RETURNING item_id
  ), movement AS(
    INSERT INTO erp_stock_movements(workspace_id,item_id,warehouse_id,delta,reason)
    SELECT $1,a.item_id,$3,g.quantity,'Purchase receipt: '||d.doc_no
    FROM added a JOIN goods g ON g.item_id=a.item_id CROSS JOIN received d
    RETURNING id
  ) SELECT r.id,r.doc_no,(SELECT COUNT(*)::int FROM movement) AS movement_count
    FROM received r`;
  const rows=await query(g.sql,statement,[g.workspace,id,v.data.warehouse_id]);
  return rows.length?c.json({ok:true,data:rows[0]}):fail(c,409,'Purchase order must be confirmed, unreceived and assigned to a company warehouse');
 });
 app.post('/api/admin/erp/w/:workspace/core/documents/:id/invoice',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const id=c.req.param('id');if(!uid.safeParse(id).success)return fail(c,400,'Invalid sales document');
  const docs=await query(g.sql,"SELECT * FROM erp_documents WHERE workspace_id=$1 AND id=$2 AND kind='sale' AND status IN('confirmed','completed')",[g.workspace,id]);
  if(!docs.length)return fail(c,409,'Confirm a sales order before creating its invoice');
  const d=docs[0];
  const previous=await query(g.sql,'SELECT id,invoice_no FROM erp_invoices WHERE workspace_id=$1 AND source_document_id=$2',[g.workspace,id]);
  if(previous.length)return c.json({ok:true,data:previous[0],existing:true});
  const lines=(d.lines||[]).map(x=>({description:x.name,quantity:Number(x.quantity),unit_price:Number(x.unit_halalas)/100,amount_halalas:Number(x.total_halalas),vat_halalas:Math.round(Number(x.total_halalas)*(Number(d.vat_halalas)||0)/Math.max(1,Number(d.subtotal_halalas)))}));
  const stmt="WITH seq AS(INSERT INTO erp_invoice_sequences(workspace_id,year,last_number) VALUES($1,EXTRACT(YEAR FROM CURRENT_DATE)::int,1) ON CONFLICT(workspace_id,year) DO UPDATE SET last_number=erp_invoice_sequences.last_number+1 RETURNING year,last_number), created AS(INSERT INTO erp_invoices(workspace_id,invoice_no,customer_id,lines,subtotal_halalas,vat_halalas,total_halalas,source_document_id,notes,currency) SELECT $1,'MIF-'||seq.year||'-'||lpad(seq.last_number::text,6,'0'),$2,$3::jsonb,$4,$5,$6,$7,$8,w.currency FROM seq JOIN erp_workspaces w ON w.id=$1 ON CONFLICT(source_document_id) DO NOTHING RETURNING id,invoice_no) SELECT * FROM created";
  const rows=await query(g.sql,stmt,[g.workspace,d.partner_id,JSON.stringify(lines),d.subtotal_halalas,d.vat_halalas,d.total_halalas,id,'Generated from '+d.doc_no]);
  if(!rows.length){const existing=await query(g.sql,'SELECT id,invoice_no FROM erp_invoices WHERE workspace_id=$1 AND source_document_id=$2',[g.workspace,id]);return existing.length?c.json({ok:true,data:existing[0],existing:true}):fail(c,409,'Invoice could not be created')}
  return c.json({ok:true,data:rows[0]},201);
 });
 // Optional starter chart; the owner explicitly chooses to install it.
 // Preserve user-maintained accounts and account types under conflicting codes.
 app.post('/api/admin/erp/w/:workspace/core/accounts/seed',async c=>{
  const g=await gate(c,true);if(g.err)return g.err;
  const owner=await query(g.sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[g.workspace,c.get('adminId')]);
  if(owner[0]?.role!=='owner')return fail(c,403,'Only a company owner may install starter accounts');
  const rows=await query(g.sql,`INSERT INTO erp_accounts(workspace_id,code,name,type)
   SELECT $1,v.code,v.name,v.type FROM (VALUES
    ('1000','الصندوق','asset'),('1010','البنوك','asset'),
    ('1100','الذمم المدينة - العملاء','asset'),('1150','ضريبة المدخلات','asset'),
    ('1300','المخزون','asset'),('2000','الذمم الدائنة - الموردون','liability'),
    ('2100','ضريبة المخرجات','liability'),('3000','رأس المال','equity'),
    ('4000','إيرادات المبيعات','income'),('5000','تكلفة المبيعات','expense')
   ) AS v(code,name,type) ON CONFLICT(workspace_id,code) DO NOTHING
   RETURNING id,code,name,type`,[g.workspace]);
  return c.json({ok:true,inserted:rows.length,data:rows,
   note:'Optional starter chart only; pre-existing accounts and account types were preserved'});
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
