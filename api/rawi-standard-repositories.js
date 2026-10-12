import {z} from 'zod';
import {STANDARD_GROUPS,STANDARD_REPOSITORIES,findStandardRepository} from './rawi-standard-catalog.js';
import {validateRepositoryRecord} from './rawi-generated-blueprint.js';

const uuid=z.string().uuid();
const fail=(c,status,error)=>c.json({ok:false,error},status);
const parse=async c=>{try{return await c.req.json()}catch{return {}}};
const input=z.object({values:z.record(z.string(),z.unknown()),stage:z.string().max(85).optional()}).strict();
const docKinds=new Set(['quotations','sales_orders','sales_invoices','sales_credit_note','sales_debit_note','sales_receipts','purchase_quotes','purchase_orders','purchase_expenses','purchase_credit_note','purchase_debit_note','internal_transfer','external_transfer','stock_count','journal_entries','accounting_receipts','payment_vouchers','contracts','leaves','payroll','custody','attendance']);
const prefixes={quotations:'QT',sales_orders:'SO',sales_invoices:'INV',sales_credit_note:'SCN',sales_debit_note:'SDN',sales_receipts:'SR',purchase_quotes:'RFQ',purchase_orders:'PO',purchase_expenses:'PE',purchase_credit_note:'PCN',purchase_debit_note:'PDN',internal_transfer:'IT',external_transfer:'ET',stock_count:'SC',journal_entries:'JE',accounting_receipts:'AR',payment_vouchers:'PV',contracts:'CON',leaves:'LV',payroll:'PAY',custody:'CUS',attendance:'ATT'};
const minor=value=>Math.round(Number(value||0)*100);
const common=(row,values)=>({id:row.id,stage:row.stage||'',values_json:values,created_at:row.created_at,updated_at:row.updated_at||row.created_at,document_number:row.values_json?.document_number||null});
function masterSpec(kind){
 if(kind==='customers'||kind==='vendors')return {
  table:'erp_contacts',where:"kind=$2",kind:kind==='vendors'?'vendor':'customer',
  columns:['name','phone','email','tax_number','address'],
  render:x=>[x.name,x.phone,x.email,x.tax_number,x.address||''],
  create:"INSERT INTO erp_contacts(workspace_id,kind,name,phone,email,tax_number,address) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
  update:"UPDATE erp_contacts SET name=$3,phone=$4,email=$5,tax_number=$6,address=$7,updated_at=now() WHERE workspace_id=$1 AND kind=$2 AND id=$8 RETURNING *"
 };
 if(kind==='products')return {table:'erp_items',where:'TRUE',columns:['sku','name','unit','sale_price_halalas','cost_halalas'],render:x=>[x.sku,x.name,x.unit,Number(x.sale_price_halalas||0)/100,Number(x.cost_halalas||0)/100],
  create:"INSERT INTO erp_items(workspace_id,sku,name,type,unit,sale_price_halalas,cost_halalas) VALUES($1,$2,$3,'stock',$4,$5,$6) RETURNING *",
  update:"UPDATE erp_items SET sku=$2,name=$3,unit=$4,sale_price_halalas=$5,cost_halalas=$6 WHERE workspace_id=$1 AND id=$7 RETURNING *"};
 if(kind==='warehouses')return {table:'erp_warehouses',where:'TRUE',columns:['name','location'],render:x=>[x.name,x.location],
  create:'INSERT INTO erp_warehouses(workspace_id,name,location) VALUES($1,$2,$3) RETURNING *',
  update:'UPDATE erp_warehouses SET name=$2,location=$3 WHERE workspace_id=$1 AND id=$4 RETURNING *'};
 if(kind==='chart_accounts')return {table:'erp_accounts',where:'TRUE',columns:['code','name','type'],render:x=>[x.code,x.name,x.type],
  create:'INSERT INTO erp_accounts(workspace_id,code,name,type) VALUES($1,$2,$3,$4) RETURNING *',
  update:'UPDATE erp_accounts SET code=$2,name=$3,type=$4 WHERE workspace_id=$1 AND id=$5 RETURNING *'};
 if(kind==='employee_file')return {table:'erp_employees',where:'TRUE',columns:['name','employee_number','email','department','job_title','basic_salary_halalas'],render:x=>[x.name,x.employee_number,x.email,x.department,x.job_title,Number(x.basic_salary_halalas||0)/100],
  create:'INSERT INTO erp_employees(workspace_id,name,employee_number,email,department,job_title,basic_salary_halalas) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
  update:'UPDATE erp_employees SET name=$2,employee_number=$3,email=$4,department=$5,job_title=$6,basic_salary_halalas=$7 WHERE workspace_id=$1 AND id=$8 RETURNING *'};
 return null;
}
function checkMaster(kind,values){
 const at=i=>values['field_'+i];
 if(['customers','vendors'].includes(kind))return [at(1),at(2)||'',at(3)||'',at(4)||'',at(5)||''];
 if(kind==='products')return [at(1),at(2)||'',at(3)||'unit',minor(at(4)),minor(at(5))];
 if(kind==='warehouses')return [at(1),at(2)||''];
 if(kind==='chart_accounts'){
  const type=String(at(3)||'').toLowerCase();
  if(!['asset','liability','equity','income','expense'].includes(type))throw Error('Account type must be asset, liability, equity, income or expense');
  return [at(1),at(2)||'',type];
 }
 if(kind==='employee_file')return [at(1),at(2)||'',at(3)||'',at(4)||'',at(5)||'',minor(at(6))];
 return [];
}
const moneySafe=amount=>Number.isSafeInteger(amount)&&amount>=0&&amount<=1e13;
export function zatcaTlv({seller,vatNumber,timestamp,total,vat}){
 const entries=[seller,vatNumber,timestamp,total,vat];
 const bytes=[];
 entries.forEach((value,index)=>{
  const encoded=new TextEncoder().encode(String(value));
  if(encoded.length>255)throw Error('QR TLV value exceeds 255 bytes');
  bytes.push(index+1,encoded.length,...encoded);
 });
 return btoa(String.fromCharCode(...bytes));
}
export function installRawiStandardRepositories(app,{db,centralDb,query,env}){
 async function gate(c,write=false){
  if(env(c).MIF_APP_SURFACE!=='enterprise')return {error:fail(c,404,'Not found')};
  const sql=db(c),workspace=c.req.param('workspace'),actor=c.get('adminId');
  if(!sql||!uuid.safeParse(workspace).success)return {error:fail(c,503,'Company database unavailable')};
  const rows=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[workspace,actor]);
  if(!rows.length)return {error:fail(c,404,'Company not found')};
  if(write&&rows[0].role==='viewer')return {error:fail(c,403,'Read-only workspace')};
  return {sql,workspace,actor,role:rows[0].role};
 }
 function definition(c){return findStandardRepository(c.req.param('repository'))}
 app.get('/api/admin/erp/w/:workspace/standard/catalog',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  return c.json({ok:true,groups:STANDARD_GROUPS,version:1});
 });
 app.get('/api/admin/erp/w/:workspace/standard/:repository/records',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const repo=definition(c);if(!repo)return fail(c,404,'Unknown repository');
  if(repo.read_only)return c.json({ok:true,repository:repo,data:[],report_only:true});
  if(repo.kind==='document_sequences'){
   const [current,invoice]=await Promise.all([
    query(g.sql,"SELECT kind,year,number FROM erp_document_sequences WHERE workspace_id=$1 ORDER BY kind,year DESC LIMIT 200",[g.workspace]),
    query(g.sql,"SELECT year,last_number FROM erp_invoice_sequences WHERE workspace_id=$1 ORDER BY year DESC LIMIT 20",[g.workspace])
   ]);
   return c.json({ok:true,repository:repo,data:[
    ...current.map(x=>({id:x.kind+'_'+x.year,stage:'',values_json:{field_1:x.kind,field_2:prefixes[x.kind.replace(/^std_/, '')]||x.kind,field_3:Number(x.number)+1},updated_at:null})),
    ...invoice.map(x=>({id:'invoice_'+x.year,stage:'',values_json:{field_1:'invoice',field_2:'MIF',field_3:Number(x.last_number)+1},updated_at:null}))
   ],read_only:true});
  }
  const master=masterSpec(repo.kind);
  if(master){
   const args=repo.kind==='customers'||repo.kind==='vendors'?[g.workspace,master.kind]:[g.workspace];
   const rows=await query(g.sql,'SELECT * FROM '+master.table+' WHERE workspace_id=$1 AND '+master.where+' ORDER BY '+(repo.kind==='products'||repo.kind==='warehouses'||repo.kind==='chart_accounts'?'name':'created_at DESC')+' LIMIT 300',args);
   return c.json({ok:true,repository:repo,data:rows.map(row=>common(row,Object.fromEntries(master.render(row).map((value,i)=>['field_'+(i+1),value]))))});
  }
  const rows=await query(g.sql,"SELECT id,repository_key,values_json,stage,created_at,updated_at FROM rawi_dynamic_records WHERE workspace_id=$1 AND repository_key=$2 ORDER BY updated_at DESC LIMIT 300",[g.workspace,repo.key]);
  return c.json({ok:true,repository:repo,data:rows});
 });
 async function save(c,isUpdate=false){
  const g=await gate(c,true);if(g.error)return g.error;
  const repo=definition(c);if(!repo||repo.read_only||repo.kind==='document_sequences')return fail(c,404,'Repository is not editable');
  const target=c.req.param('id');
  if(isUpdate&&!uuid.safeParse(target).success)return fail(c,400,'Invalid record');
  const req=input.safeParse(await parse(c));if(!req.success)return fail(c,400,'Invalid fields');
  const values=validateRepositoryRecord(repo,req.data.values);
  if(!values)return fail(c,400,'Check required fields and data types');
  const stage=req.data.stage??repo.stages[0]??'';
  if(stage&&!repo.stages.includes(stage))return fail(c,400,'Invalid status');
  const master=masterSpec(repo.kind);
  if(master){
   let data;try{data=checkMaster(repo.kind,values)}catch(e){return fail(c,400,e.message)}
   if(isUpdate)data.push(target);
   let rows;try{rows=await query(g.sql,isUpdate?master.update:master.create,[g.workspace,...(master.kind?[master.kind]:[]),...data]);}
   catch(e){console.error('Master data save failed',String(e?.message||e).slice(0,150));return fail(c,409,'Conflicting reference or invalid company master data')}
   return rows.length?c.json({ok:true,data:common(rows[0],Object.fromEntries(master.render(rows[0]).map((v,i)=>['field_'+(i+1),v])))},isUpdate?200:201):fail(c,404,'Record not found');
  }
  if(isUpdate){
   const rows=await query(g.sql,"UPDATE rawi_dynamic_records SET values_json=$4::jsonb||(CASE WHEN values_json ? 'document_number' THEN jsonb_build_object('document_number',values_json->>'document_number') ELSE '{}'::jsonb END),stage=$5,updated_by=$6,updated_at=now() WHERE workspace_id=$1 AND repository_key=$2 AND id=$3 RETURNING *",[g.workspace,repo.key,target,JSON.stringify(values),stage,g.actor]);
   return rows.length?c.json({ok:true,data:rows[0]}):fail(c,404,'Record not found');
  }
  if(docKinds.has(repo.kind)){
   const kind='std_'+repo.kind;
   const sql="WITH seq AS(INSERT INTO erp_document_sequences(workspace_id,kind,year,number) VALUES($1,$2,EXTRACT(YEAR FROM CURRENT_DATE)::int,1) ON CONFLICT(workspace_id,kind,year) DO UPDATE SET number=erp_document_sequences.number+1 RETURNING year,number), inserted AS(INSERT INTO rawi_dynamic_records(workspace_id,repository_key,values_json,stage,created_by,updated_by) SELECT $1,$3,$4::jsonb||jsonb_build_object('document_number',$5::text||'-'||seq.year||'-'||lpad(seq.number::text,6,'0')),$6,$7,$7 FROM seq RETURNING *) SELECT * FROM inserted";
   const rows=await query(g.sql,sql,[g.workspace,kind,repo.key,JSON.stringify(values),prefixes[repo.kind]||'DOC',stage,g.actor]);
   return c.json({ok:true,data:rows[0]},201);
  }
  const rows=await query(g.sql,"INSERT INTO rawi_dynamic_records(workspace_id,repository_key,values_json,stage,created_by,updated_by) VALUES($1,$2,$3::jsonb,$4,$5,$5) RETURNING *",[g.workspace,repo.key,JSON.stringify(values),stage,g.actor]);
  return c.json({ok:true,data:rows[0]},201);
 }
 app.post('/api/admin/erp/w/:workspace/standard/:repository/records',c=>save(c));
 app.patch('/api/admin/erp/w/:workspace/standard/:repository/records/:id',c=>save(c,true));
 app.get('/api/admin/erp/w/:workspace/system/settings',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const rows=await query(centralDb(c),"SELECT p.setup_inputs,p.name,p.tax_number,w.currency FROM rawi_company_profiles p JOIN erp_workspaces w ON w.id=p.workspace_id JOIN erp_memberships m ON m.workspace_id=w.id WHERE p.workspace_id=$1 AND m.admin_id=$2",[g.workspace,g.actor]);
  if(!rows.length)return fail(c,404,'Company profile not found');
  const finance=rows[0].setup_inputs?.finance||{};
  return c.json({ok:true,data:{country:finance.country||'',currency:finance.currency||String(rows[0].currency).trim()||'SAR',sales_tax_rate:finance.sales_tax_rate??15,purchases_tax_rate:finance.purchases_tax_rate??15,zatca_mode:finance.zatca_mode||'none',environment:finance.environment||'simulation',egs_unit_id:finance.egs_unit_id||'',name:rows[0].name,tax_number:rows[0].tax_number,phase2_connected:false}});
 });
 app.put('/api/admin/erp/w/:workspace/system/settings',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  if(g.role!=='owner')return fail(c,403,'Only company owner may update tax settings');
  const schema=z.object({
   country:z.string().regex(/^[A-Z]{2}$/),currency:z.string().regex(/^[A-Z]{3}$/),
   sales_tax_rate:z.number().min(0).max(100),purchases_tax_rate:z.number().min(0).max(100),
   zatca_mode:z.enum(['none','qr','phase2']),environment:z.enum(['sandbox','simulation','production']).default('simulation'),
   egs_unit_id:z.string().max(80).default('')
  }).strict();
  const valid=schema.safeParse(await parse(c));if(!valid.success)return fail(c,400,'Invalid company tax or currency settings');
  const x=valid.data;
  if(x.country!=='SA'&&x.zatca_mode!=='none')return fail(c,400,'ZATCA is only selectable for Saudi companies');
  // Save the actual currency and sales tax in the operational tenant. No fake CSID / onboarding.
  const tenant=await query(g.sql,"UPDATE erp_workspaces SET currency=$2,vat_rate=$3 WHERE id=$1 RETURNING id",[g.workspace,x.currency,x.sales_tax_rate/100]);
  if(!tenant.length)return fail(c,404,'Company operational settings are unavailable');
  const rows=await query(centralDb(c),"UPDATE rawi_company_profiles p SET setup_inputs=jsonb_set(COALESCE(setup_inputs,'{}'::jsonb),'{finance}',$3::jsonb,true),setup_updated_at=now() WHERE p.workspace_id=$1 AND EXISTS (SELECT 1 FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2 AND role='owner') RETURNING workspace_id",
   [g.workspace,g.actor,JSON.stringify(x)]);
  if(!rows.length)return fail(c,403,'Company owner permission required');
  await query(centralDb(c),"UPDATE erp_workspaces SET currency=$2 WHERE id=$1",[g.workspace,x.currency]);
  return c.json({ok:true,data:x,phase2_connected:false});
 });
 app.get('/api/admin/erp/w/:workspace/system/invoices/:id/qr',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  if(!uuid.safeParse(c.req.param('id')).success)return fail(c,400,'Invalid invoice');
  const company=await query(centralDb(c),"SELECT name,tax_number,setup_inputs FROM rawi_company_profiles WHERE workspace_id=$1",[g.workspace]);
  const finance=company[0]?.setup_inputs?.finance;
  if(!company.length||(finance?.country&&finance.country!=='SA')||finance?.zatca_mode==='none')return fail(c,409,'Saudi electronic invoicing QR is not enabled');
  if(!company[0].tax_number)return fail(c,409,'Company VAT number is required');
  const invoice=await query(g.sql,"SELECT invoice_no,issued_on,created_at,total_halalas,vat_halalas,status FROM erp_invoices WHERE workspace_id=$1 AND id=$2",[g.workspace,c.req.param('id')]);
  if(!invoice.length||!['issued','paid'].includes(invoice[0].status))return fail(c,409,'Only issued invoices have a QR payload');
  const inv=invoice[0],total=Number(inv.total_halalas),vat=Number(inv.vat_halalas);
  if(!moneySafe(total)||!moneySafe(vat))return fail(c,409,'Invoice totals cannot be verified');
  const payload=zatcaTlv({seller:company[0].name,vatNumber:company[0].tax_number,
   timestamp:new Date(inv.created_at||inv.issued_on).toISOString(),total:(total/100).toFixed(2),vat:(vat/100).toFixed(2)});
  return c.json({ok:true,invoice_no:inv.invoice_no,tlv_base64:payload,phase:'qr_basic',phase2_compliant:false});
 });

 app.get('/api/admin/erp/w/:workspace/system/report/:kind',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const kind=c.req.param('kind');
  const repo=STANDARD_REPOSITORIES.find(x=>x.kind===kind&&x.read_only);
  if(!repo)return fail(c,404,'Report not found');
  if(kind==='cash_flow')return c.json({ok:true,data:[],columns:[],notice:'لا يمكن إعداد تدفقات نقدية معتمدة قبل تصنيف النقد وما يعادله وربط حركات السداد الفعلية.'});
  if(kind==='tax_report'){
   const summary=await query(g.sql,"SELECT COUNT(*)::int invoices,COALESCE(SUM(subtotal_halalas),0)::bigint taxable_sales_halalas,COALESCE(SUM(vat_halalas),0)::bigint output_vat_halalas FROM erp_invoices WHERE workspace_id=$1 AND status IN('issued','paid')",[g.workspace]);
   return c.json({ok:true,data:summary,columns:['invoices','taxable_sales_halalas','output_vat_halalas'],
    notice:'إجمالي ضريبة المخرجات من الفواتير الصادرة فقط. لا يشمل ضريبة المدخلات أو إقرارات ضريبية معتمدة.'});
  }
  const ledger=await query(g.sql,"SELECT a.code,a.name,a.type,COALESCE(SUM(l.debit_halalas),0)::bigint debit_halalas,COALESCE(SUM(l.credit_halalas),0)::bigint credit_halalas FROM erp_accounts a LEFT JOIN erp_journal_entries j ON j.workspace_id=a.workspace_id LEFT JOIN LATERAL jsonb_to_recordset(COALESCE(j.lines,'[]'::jsonb)) AS l(account_id uuid,debit_halalas bigint,credit_halalas bigint) ON l.account_id=a.id WHERE a.workspace_id=$1 GROUP BY a.id,a.code,a.name,a.type ORDER BY a.code",[g.workspace]);
  let selected=ledger;
  if(kind==='income_statement')selected=ledger.filter(x=>['income','expense'].includes(x.type));
  if(kind==='balance_sheet')selected=ledger.filter(x=>['asset','liability','equity'].includes(x.type));
  const data=selected.map(x=>({code:x.code,name:x.name,type:x.type,debit_halalas:Number(x.debit_halalas||0),credit_halalas:Number(x.credit_halalas||0),balance_halalas:Number(x.debit_halalas||0)-Number(x.credit_halalas||0)}));
  return c.json({ok:true,data,columns:['code','name','type','debit_halalas','credit_halalas','balance_halalas'],
   notice:'عرض مباشر من قيود اليومية المسجلة؛ يحتاج مراجعة المحاسب وإقفال الفترات قبل اعتماد القوائم المالية.'});
 });
 app.put('/api/admin/erp/w/:workspace/system/sequences/:kind',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  if(g.role!=='owner')return fail(c,403,'Only company owner may manage numbering');
  const kind=c.req.param('kind');
  if(!docKinds.has(kind))return fail(c,400,'Unsupported document sequence');
  const v=z.object({next_number:z.number().int().min(1).max(999999999)}).safeParse(await parse(c));
  if(!v.success)return fail(c,400,'Invalid next number');
  // The last allocated number is monotonically increasing; never duplicate or rewind.
  const rows=await query(g.sql,"INSERT INTO erp_document_sequences(workspace_id,kind,year,number) VALUES($1,$2,EXTRACT(YEAR FROM CURRENT_DATE)::int,$3) ON CONFLICT(workspace_id,kind,year) DO UPDATE SET number=GREATEST(erp_document_sequences.number,EXCLUDED.number) RETURNING year,number",
   [g.workspace,'std_'+kind,v.data.next_number-1]);
  return c.json({ok:true,data:{kind,year:rows[0].year,next_number:Number(rows[0].number)+1}});
 });

 app.get('/api/admin/erp/w/:workspace/system/sequences',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const rows=await query(g.sql,"SELECT kind,year,number FROM erp_document_sequences WHERE workspace_id=$1 ORDER BY kind,year DESC",[g.workspace]);
  const inv=await query(g.sql,"SELECT year,last_number FROM erp_invoice_sequences WHERE workspace_id=$1",[g.workspace]);
  return c.json({ok:true,data:{documents:rows,invoices:inv}});
 });
}
