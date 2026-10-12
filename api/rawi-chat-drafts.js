import {findStandardRepository} from './rawi-standard-catalog.js';
import {parseGeneratedJson,validateRepositoryRecord} from './rawi-generated-blueprint.js';
import {routeAI} from './ai-router.js';

// A command can only prepare an unposted, editable standard-repository draft.
// Accounting posting, payment execution, inventory movement and master-data writes
// must continue through their dedicated, validated business workflows.
const patterns=[
 ['purchase_quotes',/(?:طلب\s+عرض\s+سعر|rfq|request for quotation)/i],
 ['quotations',/(?:عرض\s+سعر|quotation|quote\b)/i],
 ['sales_orders',/(?:أمر\s+بيع|طلب\s+بيع|sales?\s+order)/i],
 ['sales_invoices',/(?:فاتورة\s+بيع|فاتورة\s+مبيعات|sales?\s+invoice|invoice)/i],
 ['purchase_orders',/(?:أمر\s+شراء|purchase\s+order)/i],
 ['opportunities',/(?:فرصة\s+بيع|فرصة\s+جديدة|فرصة\s+تجارية|opportunit)/i],
 ['leaves',/(?:طلب\s+إجازة|اجازة\s+موظف|leave\s+request)/i],
 ['contracts',/(?:عقد\s+موظف|عقد\s+عمل|employment\s+contract)/i],
 ['attendance',/(?:حضور\s+وانصراف|سجل\s+حضور|attendance\s+record)/i]
];
const verb=/^\s*(?:من فضلك\s+|لو سمحت\s+|يا راوي[،,\s]+)*(?:اعمل|اعملي|أنشئ|انشئ|أنشئي|سجل|سجّل|جهز|جهّز|حضّر|حضر|أضف|اضف|افتح|create|prepare|draft|add|record)(?=\s|$)/i;
export function plannedRepository(text){
 const source=String(text||'').trim();
 if(!verb.test(source))return null;
 for(const [kind,pattern] of patterns)if(pattern.test(source))return findStandardRepository('std_'+kind);
 return null;
}
const clean=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,' ').trim();
const result=(status,message,extra={})=>({status,message,...extra});
async function matchReference(sql,query,workspace,target,value){
 const references={
  customers:{sql:"SELECT id,name FROM erp_contacts WHERE workspace_id=$1 AND kind IN ('customer','person') ORDER BY name LIMIT 600"},
  vendors:{sql:"SELECT id,name FROM erp_contacts WHERE workspace_id=$1 AND kind IN ('vendor','person') ORDER BY name LIMIT 600"},
  employees:{sql:"SELECT id,name FROM erp_employees WHERE workspace_id=$1 ORDER BY name LIMIT 600"}
 };
 const spec=references[target];
 if(!spec)return null;
 const rows=await query(sql,spec.sql,[workspace]);
 const matches=rows.filter(x=>clean(x.name)===clean(value));
 return matches.length===1?matches[0]:null;
}
function extractValues(schema,proposed){
 if(!proposed||typeof proposed!=='object'||Array.isArray(proposed))return null;
 const source=proposed.values;
 if(!source||typeof source!=='object'||Array.isArray(source))return null;
 const fields=new Set(schema.fields.map(f=>f.key));
 return Object.fromEntries(Object.entries(source).filter(([key,value])=>fields.has(key)&&value!==null&&value!==''));
}
export async function createRawiCommandDraft({app,c,sql,query,workspace,user,threadId,question,providers}){
 const repo=plannedRepository(question);
 if(!repo)return null;
 if(repo.read_only||repo.storage!=='records'||!repo.stages.includes('مسودة'))return result('unsupported','لا يمكن إنشاء مسودة تشغيلية لهذا النوع من الأوامر.');
 const access=await query(sql,'SELECT role FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2',[workspace,user]);
 if(!access.length||access[0].role==='viewer')return result('unauthorized','لا تملك صلاحية إنشاء مسودات لهذه الشركة.');
 const fieldGuide=repo.fields.map(f=>({key:f.key,label:f.label,type:f.type}));
 const prompt='Extract information explicitly supplied by the user into an ERP DRAFT. Output ONLY a valid compact JSON object {"values":{"field_1":"..."},"lines":[{"product":"exact product name or SKU","quantity":1}]}. Required repository: '+repo.name+'. Fields: '+JSON.stringify(fieldGuide)+'. Field keys must match exactly. Relation fields should contain the name spoken by the user, not fabricated IDs. For quotation/order/invoice, lines must list named products and explicit quantities. Do not invent or estimate fields, partners, products, prices, dates or quantities. Leave missing values absent. Never report success. Untrusted user text: '+JSON.stringify(question);
 let generated;
 try{
  const reply=await routeAI(prompt,providers,[],'','enterprise',[],950);
  generated=parseGeneratedJson(reply.answer);
 }catch{
  return result('not_saved','تعذر تحليل الأمر إلى بيانات تشغيلية. لم يتم حفظ مسودة.');
 }
 const values=extractValues(repo,generated);
 if(!values)return result('not_saved','الأمر لا يحتوي على بيانات كافية لإنشاء مسودة. لم يتم حفظ شيء.');
 for(const field of repo.fields.filter(f=>f.type==='relation'&&values[f.key])){
  const reference=await matchReference(sql,query,workspace,field.target,values[field.key]);
  if(!reference)return result('not_saved','لم أجد مرجعًا وحيدًا مطابقًا لـ «'+field.label+'» في بيانات الشركة. أضف السجل أو حدده بدقة.');
  values[field.key]=reference.id;
 }
 const required=repo.fields.filter(f=>f.required);
 if(required.some(f=>values[f.key]===undefined||values[f.key]===''))
  return result('not_saved','الأمر ينقصه حقل مطلوب: '+required.filter(f=>!values[f.key]).map(f=>f.label).join('، ')+'. لم يتم حفظ مسودة.');
 // Only an explicitly named catalogue item can become a line. Server-side
 // repository validation will independently recompute quantity, units and prices.
 const lineKinds=new Set(['quotations','sales_orders','sales_invoices','purchase_quotes','purchase_orders']);
 const request={values,stage:'مسودة'};
 if(lineKinds.has(repo.kind)){
  if(!Array.isArray(generated?.lines)||!generated.lines.length||generated.lines.length>80)
   return result('not_saved','حدد أصناف المستند وكمياتها لإنشاء مسودة قابلة للمراجعة.');
  const products=await query(sql,"SELECT id,name,sku FROM erp_items WHERE workspace_id=$1 AND active=true ORDER BY name LIMIT 1000",[workspace]);
  const lines=[];
  for(const line of generated.lines){
   const item=products.filter(p=>clean(p.name)===clean(line.product)||clean(p.sku)===clean(line.product));
   if(item.length!==1)return result('not_saved','الصنف «'+String(line.product||'').slice(0,100)+'» غير موجود بصورة فريدة في منتجات الشركة.');
   const quantity=Number(line.quantity);
   if(!Number.isFinite(quantity)||quantity<=0||quantity>100000)
    return result('not_saved','الكمية غير صحيحة؛ لم تُحفظ مسودة.');
   lines.push({item_id:item[0].id,quantity});
  }
  request.lines=lines;
 }
 if(!validateRepositoryRecord(repo,values))return result('not_saved','بيانات المستند ناقصة أو غير صالحة. لم يتم حفظ مسودة.');
 const duplicateKey=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user+'|'+threadId+'|'+question));
 const fingerprint=Array.from(new Uint8Array(duplicateKey),x=>x.toString(16).padStart(2,'0')).join('');
 const previous=await query(sql,"SELECT id,repository_key FROM rawi_dynamic_records WHERE workspace_id=$1 AND values_json->>'rawi_command_fingerprint'=$2 LIMIT 1",[workspace,fingerprint]);
 if(previous.length)return result('saved','المسودة محفوظة بالفعل؛ لم يتم إنشاء نسخة مكررة.',{repository_key:previous[0].repository_key,record_id:previous[0].id});
 const url='/api/admin/erp/w/'+encodeURIComponent(workspace)+'/standard/'+encodeURIComponent(repo.key)+'/records';
 let response,body;
 try{
  response=await app.request(url,{method:'POST',headers:{'Content-Type':'application/json',Cookie:c.req.header('cookie')||''},body:JSON.stringify(request)},c.env);
  body=await response.json();
 }catch{return result('not_saved','تعذر الوصول إلى خدمة حفظ المستندات. لم يتم تأكيد إنشاء المسودة.');}
 if(!response.ok||!body?.ok||!body.data?.id)return result('not_saved',String(body?.error||'رفض النظام حفظ المسودة')+'. لم يُؤكد إنشاء المسودة.');
 try{
  await query(sql,"UPDATE rawi_dynamic_records SET values_json=values_json||jsonb_build_object('rawi_source_thread_id',$3::text,'rawi_command_fingerprint',$4::text) WHERE workspace_id=$1 AND id=$2",[workspace,body.data.id,threadId,fingerprint]);
 }catch(e){console.error('RAWI draft source provenance update failed',String(e?.message||e).slice(0,150));}
 return result('saved','أنشأت مسودة «'+repo.name+'» وحفظتها في العمليات للمراجعة. لم يتم اعتمادها أو ترحيلها.',{repository_key:repo.key,record_id:body.data.id,document_number:body.data.values_json?.document_number||null});
}