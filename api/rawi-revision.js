import {generateWorkspaceBlueprint,blueprintReady} from './rawi-generated-blueprint.js';
import {getAIProviders,routeAI} from './ai-router.js';

// A published company design is never silently replaced by an AI response.
export const designChangeRequested=input=>{
 const text=String(input||'');
 const action=/(?:عدل|عدّل|تعديل|غير|غيّر|تغيير|حدث|حدّث|تحديث|ضيف|أضف|اضف|إضافة|احذف|حذف|انشئ|أنشئ|صمم|صمّم|اعمل|إنشاء|ابني|عايز|أريد|غلط|قديمة|مش صحيحة|redesign|rebuild|modify|update|change|add|remove|create|design|wrong|outdated)/i;
 const target=/(?:مستودع|مستودعات|حقول|حقل|تصميم|هيكل|سير العمل|برنامج الشركة|النظام|repository|repositories|field|fields|workflow|schema|workspace)/i;
 return action.test(text)&&target.test(text);
};
const cancelled=input=>/^(?:الغ(?:ي|اء) التعديل|إلغاء التعديل|تراجع عن التعديل|cancel(?: revision)?|discard(?: changes)?)[.!؟\s]*$/i.test(String(input||'').trim());
const approval=input=>/^(?:اعتمد(?: التصميم)?|موافق(?: على التصميم)?|وافق|نفذ(?: التصميم)?|ابدأ التنفيذ|تمام اعتمد|approve(?: the design)?|approved|confirm(?: design)?|build it|yes approve)[.!\s]*$/i.test(String(input||'').trim());
const reply=(answer,model,extra={})=>({answer,model,provider:'discovery',input_tokens:0,output_tokens:0,...extra});
// The production database restricts discovery.stage to intro/references/processes/review/completed.
// Use an explicit flag in the existing JSONB answers instead of inventing a SQL-invalid stage.
export const revisionPending=current=>current?.stage==='revision_review'||(current?.stage==='completed'&&current?.answers?.revision_pending===true);

export async function handleApprovedDesignRevision({c,company,current,workspace,user,message,language,central,query,settings,design=generateWorkspaceBlueprint,providers=getAIProviders}){
 const input=String(message||'').trim().slice(0,2500);
 if(!revisionPending(current)&&!designChangeRequested(input))return null;
 if(revisionPending(current)&&cancelled(input)){
  await query(central,"UPDATE rawi_workspace_discovery SET stage='completed',proposal='{}'::jsonb,answers=answers-'revision_pending',updated_at=now() WHERE workspace_id=$1 AND owner_id=$2",[workspace,user]);
  return reply(language==='en'?'The proposed changes were cancelled. Your published repositories and data are unchanged.':'تم إلغاء مسودة التعديل. مستودعاتك الحالية وسجلاتها لم تتغير.','revision-cancelled');
 }
 if(revisionPending(current)&&approval(input)){
  if(!blueprintReady(current.proposal))return reply(language==='en'?'No valid design revision is waiting for approval.':'لا توجد مسودة تعديل سليمة لاعتمادها.','revision-invalid');
  const tenant=c.get('tenantSQL');
  if(!tenant)throw Object.assign(new Error('Customer database is unavailable for safe design approval'),{status:503});
  const used=await query(tenant,"SELECT DISTINCT repository_key,jsonb_object_keys(values_json) AS field_key FROM rawi_dynamic_records WHERE workspace_id=$1",[workspace]);
  const candidate=current.proposal;
  const incompatible=used.find(row=>{
   const repo=candidate.repositories.find(r=>r.key===row.repository_key);
   return !repo||!repo.fields.some(field=>field.key===row.field_key);
  });
  if(incompatible)return reply(language==='en'?'Revision blocked: existing saved records require their original repository keys and populated fields. Please request a compatible revision.':'تم إيقاف الاعتماد لحماية البيانات المحفوظة. لازم التعديل يحتفظ بأسماء المفاتيح والحقول المستخدمة في السجلات القديمة.','revision-protected');
  const saved=await query(central,"UPDATE rawi_company_profiles SET setup_plan=$3::jsonb,setup_source='ai',setup_updated_at=now() WHERE workspace_id=$1 AND setup_plan=$4::jsonb AND EXISTS (SELECT 1 FROM erp_memberships WHERE workspace_id=$1 AND admin_id=$2 AND role='owner') RETURNING workspace_id",
   [workspace,user,JSON.stringify(candidate),JSON.stringify(company.setup_plan)]);
  if(!saved.length)throw Object.assign(new Error('The company design changed; reload the latest version before approval'),{status:409});
  await query(central,"UPDATE rawi_workspace_discovery SET stage='completed',proposal='{}'::jsonb,updated_at=now() WHERE workspace_id=$1 AND owner_id=$2",[workspace,user]);
  return reply(language==='en'?'Approved. Open Operations to see the revised repositories and your retained records.':'اعتمدت التعديل وحفظته. افتح «العمليات» وشوف مستودعاتك الجديدة، وسجلاتك السابقة محفوظة.','revision-approved',{discovery_stage:'completed',design_ready:true});
 }
 if(input.length<3)return null;
 const ai=await providers(central,settings,query);
 if(!ai.length)throw Object.assign(new Error('AI design provider is not available'),{status:503});
 const prior=revisionPending(current)&&blueprintReady(current.proposal)?current.proposal:company.setup_plan;
 const tenant=c.get('tenantSQL');
 let recent=[];
 if(tenant)recent=await query(tenant,"SELECT m.content FROM mif_chat_messages m JOIN mif_chat_threads t ON t.id=m.thread_id WHERE t.workspace_id=$1 AND t.owner_id=$2 AND m.role='user' ORDER BY m.created_at DESC LIMIT 8",[workspace,user]).catch(()=>[]);
 const old=JSON.stringify(prior.repositories.map(r=>({key:r.key,name:r.name,fields:r.fields.map(f=>({key:f.key,label:f.label}))})));
 const details=[
  'MOST RECENT OWNER REQUEST: '+input,
  'PREVIOUSLY DESIGNED REPOSITORIES (preserve keys used by saved records): '+old,
  'INITIAL OWNER BUSINESS REQUIREMENTS: '+JSON.stringify(current.answers||{}).slice(0,1300),
  'RECENT USER MESSAGES (newest first): '+recent.map(x=>String(x.content).slice(0,220)).join(' | ').slice(0,1000),
  'COMPANY DESCRIPTION: '+String(company.description||'').slice(0,450)
 ].join('\n');
 const generated=await design({name:company.name,activity:company.activity,description:details,language,providers:ai,routeAI});
 if(!generated.ready)return reply(language==='en'?'I could not generate a reliable revision. Your current repositories remain unchanged; please clarify the records and workflow you need.':'ماقدرتش أطلع تعديل موثوق. التصميم الحالي لم يتغير. وضّح السجلات ومراحل العمل المطلوبة وجرّب تاني.','revision-unavailable');
 await query(central,"UPDATE rawi_workspace_discovery SET stage='completed',proposal=$3::jsonb,answers=jsonb_set(answers,'{revision_pending}','true'::jsonb,true),updated_at=now() WHERE workspace_id=$1 AND owner_id=$2",[workspace,user,JSON.stringify(generated.blueprint)]);
 const plan=generated.blueprint;
 const detail=plan.repositories.map((r,i)=>(i+1)+'. '+r.name+' — '+r.description+'\n  '+(language==='en'?'Fields: ':'الحقول: ')+r.fields.map(x=>x.label).join('، ')+'\n  '+(language==='en'?'Stages: ':'المراحل: ')+(r.stages.join(' ← ')||'—')).join('\n');
 return reply((language==='en'?'Proposed design revision (NOT published):\n':'مقترح تعديل المستودعات (لم يُنشر بعد):\n')+detail+
  (language==='en'?'\n\nReply "Approve the design" to publish or describe adjustments.':'\n\nقول «اعتمد التصميم» للنشر، أو اكتب التعديلات المطلوبة.'),'revision-proposal');
}
