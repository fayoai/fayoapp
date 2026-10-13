import {z} from 'zod';
import {findStandardRepository} from './rawi-standard-catalog.js';
import {validateRepositoryRecord} from './rawi-generated-blueprint.js';
import {resolveItemUnit} from './rawi-uom.js';
import {standardDocumentPrefix} from './rawi-standard-repositories.js';

const uuid=z.string().uuid();
const fail=(c,status,error)=>c.json({ok:false,error},status);
const queueKey='rawi_ai_approvals';
const lineKinds=new Set(['quotations','sales_orders','sales_invoices','purchase_quotes','purchase_orders']);
const relations={
 customers:['erp_contacts',"kind IN ('customer','person')"],
 vendors:['erp_contacts',"kind IN ('vendor','person')"],
 employees:['erp_employees','TRUE'],
 warehouses:['erp_warehouses','TRUE'],
 products:['erp_items','active=true'],
 accounts:['erp_accounts','TRUE'],
 purchase_orders:['rawi_dynamic_records',"repository_key='std_purchase_orders'"]
};
export function installRawiApprovals(app,{db,env,query,centralDb}){
 async function gate(c,write=false){
  if(env(c).MIF_APP_SURFACE!=='enterprise')return {error:fail(c,404,'Not found')};
  const sql=db(c),workspace=c.req.param('workspace'),actor=c.get('adminId');
  if(!sql||!uuid.safeParse(workspace).success)return {error:fail(c,503,'Company database unavailable')};
  const members=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[workspace,actor]);
  if(!members.length)return {error:fail(c,404,'Company not found')};
  if(write&&!['owner','admin'].includes(members[0].role))return {error:fail(c,403,'Approval permission required')};
  return {sql,workspace,actor,role:members[0].role};
 }
 app.get('/api/admin/erp/w/:workspace/approvals',async c=>{
  const g=await gate(c);if(g.error)return g.error;
  const records=await query(g.sql,"SELECT id,repository_key,values_json,stage,source_thread_id,created_at,updated_at FROM rawi_dynamic_records WHERE workspace_id=$1 AND (repository_key=$2 OR values_json ? 'rawi_ai_approved_at') ORDER BY updated_at DESC LIMIT 150",[g.workspace,queueKey]);
  const data=records.map(r=>{
   const queued=r.repository_key===queueKey,payload=r.values_json||{};
   const key=queued?payload.target_repository_key:r.repository_key;
   const repo=findStandardRepository(key);
   if(!repo||repo.storage!=='records')return null;
   return {
    id:r.id,repository_key:key,repository_name:repo.name,group:repo.group,
    status:queued?(r.stage==='مرفوض'?'rejected':'pending'):'approved',
    created_at:r.created_at,updated_at:r.updated_at,
    source_thread_id:r.source_thread_id||payload.source_thread_id||payload.rawi_source_thread_id||null,
    values:queued?payload.request?.values||{}:payload,
    lines:queued?payload.request?.lines||[]:payload.document_lines||[],
    instruction:queued?payload.original_instruction||'':'',
    document_number:payload.document_number||null
   };
  }).filter(Boolean);
  return c.json({ok:true,data});
 });
 app.post('/api/admin/erp/w/:workspace/approvals/:id/reject',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const id=c.req.param('id');if(!uuid.safeParse(id).success)return fail(c,400,'Invalid approval');
  const rows=await query(g.sql,"UPDATE rawi_dynamic_records SET stage='مرفوض',updated_by=$3,updated_at=now(),values_json=values_json||jsonb_build_object('rawi_rejected_by',$3::text,'rawi_rejected_at',now()::text) WHERE workspace_id=$1 AND id=$2 AND repository_key=$4 AND stage='بانتظار الموافقة' RETURNING id",[g.workspace,id,g.actor,queueKey]);
  return rows.length?c.json({ok:true,status:'rejected',id}):fail(c,409,'This request is not pending approval');
 });
 app.post('/api/admin/erp/w/:workspace/approvals/:id/approve',async c=>{
  const g=await gate(c,true);if(g.error)return g.error;
  const id=c.req.param('id');if(!uuid.safeParse(id).success)return fail(c,400,'Invalid approval');
  const records=await query(g.sql,'SELECT id,repository_key,stage,values_json,source_thread_id FROM rawi_dynamic_records WHERE workspace_id=$1 AND id=$2',[g.workspace,id]);
  const record=records[0];
  if(!record)return fail(c,404,'Approval not found');
  if(record.repository_key!==queueKey)return fail(c,409,'This request was already moved to its repository');
  if(record.stage!=='بانتظار الموافقة')return fail(c,409,'This request is not pending approval');
  const target=record.values_json?.target_repository_key,request=record.values_json?.request;
  const repo=findStandardRepository(target);
  if(!repo||repo.read_only||repo.storage!=='records'||!repo.stages.includes('مسودة')||!request)
   return fail(c,422,'The proposed operation is invalid');
  const values=validateRepositoryRecord(repo,request.values);
  if(!values)return fail(c,422,'The proposed fields are not valid');
  // Verify all foreign keys belong to the current company at approval time.
  for(const field of repo.fields.filter(f=>f.type==='relation'&&values[f.key])){
   const relation=relations[field.target];
   if(!relation)return fail(c,422,'Unsupported reference');
   const found=await query(g.sql,'SELECT id FROM '+relation[0]+' WHERE workspace_id=$1 AND id=$2 AND '+relation[1]+' LIMIT 1',[g.workspace,values[field.key]]);
   if(!found.length)return fail(c,409,'The associated record is no longer available');
  }
  if(lineKinds.has(repo.kind)){
   if(!Array.isArray(request.lines)||request.lines.length<1||request.lines.length>80)
    return fail(c,422,'At least one product line is required');
   let subtotal=0;const normalized=[];
   for(const line of request.lines){
    if(!uuid.safeParse(line.item_id).success||line.unit_id&&!uuid.safeParse(line.unit_id).success||!Number.isFinite(line.quantity)||line.quantity<=0||line.quantity>100000)
     return fail(c,422,'Invalid product line');
    let u;
    try{u=await resolveItemUnit({sql:g.sql,query,workspace:g.workspace,itemId:line.item_id,unitId:line.unit_id||null,quantity:line.quantity})}
    catch{return fail(c,409,'A product or unit changed; please review the request')}
    const price=repo.kind.startsWith('purchase_')?u.purchase_price_halalas:u.sale_price_halalas;
    const amount=Math.round(line.quantity*price);
    if(!Number.isSafeInteger(amount)||amount<0)return fail(c,422,'Invalid product pricing');
    subtotal+=amount;
    normalized.push({item_id:line.item_id,unit_id:line.unit_id||null,quantity:line.quantity,base_quantity:u.baseQuantity,unit_code:u.unit_code,unit_price_halalas:price,total_halalas:amount});
   }
   const settings=await query(g.sql,'SELECT vat_rate FROM erp_workspaces WHERE id=$1',[g.workspace]);
   let rate=Number(settings[0]?.vat_rate??0.15);
   if(repo.kind.startsWith('purchase_')){
    const profile=await query(centralDb(c),'SELECT setup_inputs FROM rawi_company_profiles WHERE workspace_id=$1',[g.workspace]);
    rate=Number(profile[0]?.setup_inputs?.finance?.purchases_tax_rate??15)/100;
   }
   const vat=Math.round(subtotal*rate);
   if(!Number.isFinite(rate)||rate<0||rate>1||!Number.isSafeInteger(subtotal+vat)||subtotal+vat>1e12)
    return fail(c,422,'Company tax or amount is invalid');
   values.document_lines=normalized;
   values.subtotal_halalas=subtotal;
   values.vat_halalas=vat;
   values.total_halalas=subtotal+vat;
  }
  // Approval is administrative only; financial posting, stock transfer and payment
  // still require their dedicated validated ERP transaction endpoints.
  const finalData={
   ...values,
   rawi_source_thread_id:record.source_thread_id,
   rawi_command_fingerprint:record.values_json.rawi_command_fingerprint,
   rawi_ai_approved_by:g.actor,
   rawi_ai_approved_at:new Date().toISOString(),
   rawi_original_instruction:record.values_json.original_instruction
  };
  const prefix=standardDocumentPrefix(repo.kind);
  let updated;
  if(prefix){
   // All-or-nothing move from the private queue and reserve the document sequence
   // within the same PostgreSQL statement. Competing approvals cannot create copies.
   const stmt="WITH candidate AS (SELECT id FROM rawi_dynamic_records WHERE workspace_id=$1 AND id=$2 AND repository_key=$4 AND stage='بانتظار الموافقة' FOR UPDATE), seq AS (INSERT INTO erp_document_sequences(workspace_id,kind,year,number) SELECT $1,$7,EXTRACT(YEAR FROM CURRENT_DATE)::int,1 FROM candidate WHERE TRUE ON CONFLICT(workspace_id,kind,year) DO UPDATE SET number=erp_document_sequences.number+1 RETURNING year,number) UPDATE rawi_dynamic_records r SET repository_key=$5,stage='مسودة',values_json=$6::jsonb||jsonb_build_object('document_number',$8::text||'-'||seq.year::text||'-'||lpad(seq.number::text,6,'0')),updated_by=$3,updated_at=now() FROM candidate,seq WHERE r.id=candidate.id AND r.workspace_id=$1 AND r.repository_key=$4 AND r.stage='بانتظار الموافقة' RETURNING r.id,r.repository_key,r.stage,r.values_json";
   updated=await query(g.sql,stmt,[g.workspace,id,g.actor,queueKey,repo.key,JSON.stringify(finalData),'std_'+repo.kind,prefix]);
  }else{
   updated=await query(g.sql,"UPDATE rawi_dynamic_records SET repository_key=$4,stage='مسودة',values_json=$5::jsonb,updated_by=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND repository_key=$6 AND stage='بانتظار الموافقة' RETURNING id,repository_key,stage,values_json",[g.workspace,id,g.actor,repo.key,JSON.stringify(finalData),queueKey]);
  }
  if(!updated.length)return fail(c,409,'The request has already been processed');
  return c.json({ok:true,status:'approved',data:{id:updated[0].id,repository_key:repo.key,document_number:updated[0].values_json?.document_number||null}});
 });
}