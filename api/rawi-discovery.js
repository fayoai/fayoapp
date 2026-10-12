import {z} from 'zod';
import {generateWorkspaceBlueprint,blueprintReady} from './rawi-generated-blueprint.js';
import {getAIProviders,routeAI} from './ai-router.js';
const uuid=z.string().uuid();
const fail=(c,status,error)=>c.json({ok:false,error},status);
export function discoveryGreeting(company,language='ar'){
 return language==='en'
  ?'Welcome to '+company.name+'! Before I build your business workspace, tell me in your own words what your company does, what you sell or deliver, and how a typical job starts and ends. We will design your application together over a few minutes.'
  :'أهلًا بك في '+company.name+'! قبل ما أصمم مساحة عملك، احكي لي بنبذة عن شغلك: الشركة بتقدم إيه بالضبط؟ بتتعامل مع مين؟ والشغل عندك بيبدأ وينتهي إزاي؟ هنصمم البرنامج سوا خطوة بخطوة.';
}
export function nextDiscoveryQuestion(stage,language='ar'){
 if(language==='en')return {
  references:'Which business programs have you used or liked (for example Odoo, Zoho, Dynamics, Monday or others)? What do you wish yours looked like? I can compare real web sources when a search service is connected.',
  processes:'Describe the actual workflow and what you need inside each part. For instance: customer → pricing and quotation → sales order → purchasing → costs/accounts → project or delivery. Which steps apply to you, and what should Rawi automate?',
  review:'Here is my proposed structure, including its repositories, fields and stages. Tell me what to change, or explicitly say “Approve the design” to build your application.'
 }[stage]||'';
 return {
  references:'تمام. إيه البرامج اللي اشتغلت عليها أو عجبتك، زي أودو أو زوهو أو دايناميكس أو أي برامج تانية؟ تحب برنامجك شكله وطريقة عمله يبقوا شبه إيه؟ ولو البحث على الإنترنت متصل، هقارن لك بمصادر حقيقية.',
  processes:'جميل. خلّينا نحدد الشغل بالتفصيل: مثلًا العميل → التسعير وعرض السعر → أمر البيع → المشتريات → التكاليف والحسابات → المشروع أو التسليم. إيه المراحل الموجودة عندك فعلًا؟ وإيه اللي تحب راوي يعمله تلقائيًا؟',
  review:'دي مسودة البرنامج بالمستودعات والحقول والمراحل. قول لي التعديلات اللي تحتاجها أو قول صراحة «اعتمد التصميم» عشان أنشئ المساحة بالشكل ده.'
 }[stage]||'';
}
export const approvalMessage=(text,language='ar')=>/^(?:اعتمد(?: التصميم)?|موافق(?: على التصميم)?|وافق|نفذ(?: التصميم)?|ابدأ التنفيذ|تمام اعتمد|approve(?: the design)?|approved|confirm(?: design)?|build it|yes approve)[.!\s]*$/i.test(String(text||'').trim());
async function onlineReferences(activity,env){
 const key=String(env.BRAVE_SEARCH_API_KEY||'').trim();
 if(!key)return {available:false,sources:[]};
 try{
  // Search is about the sector only; no user messages, credentials, financial or tenant data leave the platform.
  const q=(String(activity).slice(0,100)+' business management software features comparison').trim();
  const url=new URL('https://api.search.brave.com/res/v1/web/search');url.searchParams.set('q',q);url.searchParams.set('count','5');
  const response=await fetch(url,{headers:{Accept:'application/json','X-Subscription-Token':key},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('search provider unavailable');
  const body=await response.json();
  return {available:true,sources:(body.web?.results||[]).slice(0,5).flatMap(x=>{
   try{const uri=new URL(x.url);if(uri.protocol!=='https:')return [];return [{title:String(x.title||'').slice(0,120),url:uri.href,summary:String(x.description||'').replace(/<[^>]*>/g,'').slice(0,260)}]}catch{return []}
  })};
 }catch{return {available:false,sources:[]}}
}
function proposalText(blueprint,language){
 if(language==='en')return 'My proposed company application:\n'+blueprint.repositories.map((r,i)=>(i+1)+'. '+r.name+' — '+r.description+'\n   Fields: '+r.fields.map(f=>f.label).join(', ')+'\n   Stages: '+(r.stages.join(' → ')||'As needed')).join('\n')+'\n\n'+nextDiscoveryQuestion('review','en');
 return 'المقترح الأول لبرنامج شركتك:\n'+blueprint.repositories.map((r,i)=>(i+1)+'. **'+r.name+'** — '+r.description+'\n   البيانات: '+r.fields.map(f=>f.label).join('، ')+'\n   المراحل: '+(r.stages.join(' ← ')||'حسب الحاجة')).join('\n')+'\n\n'+nextDiscoveryQuestion('review','ar');
}
export function installRawiDiscovery(app,{centralDb,env,query}){
 async function getContext(c,workspaceId,init=false){
  const sql=centralDb(c),owner=c.get('adminId');
  if(env(c).MIF_APP_SURFACE!=='enterprise'||!sql||!uuid.safeParse(workspaceId).success)return {error:fail(c,404,'Workspace not found')};
  const rows=await query(sql,`SELECT p.name,p.activity,p.setup_plan,d.workspace_id AS discovery_id,d.stage,d.answers,d.proposal,d.research
   FROM rawi_company_profiles p JOIN erp_memberships m ON m.workspace_id=p.workspace_id
   LEFT JOIN rawi_workspace_discovery d ON d.workspace_id=p.workspace_id AND d.owner_id=$2
   WHERE p.workspace_id=$1 AND m.admin_id=$2 AND m.role='owner' AND p.completed_at IS NOT NULL`,[workspaceId,owner]);
  if(!rows.length)return {error:fail(c,403,'Only company owner can configure the workspace')};
  if(init&&!rows[0].discovery_id){
   await query(sql,`INSERT INTO rawi_workspace_discovery(workspace_id,owner_id) VALUES($1,$2) ON CONFLICT(workspace_id) DO NOTHING`,[workspaceId,owner]);
  }
  return {sql,owner,workspace:workspaceId,company:rows[0]};
 }
 app.get('/api/admin/company/discovery/:id',async c=>{
  const g=await getContext(c,c.req.param('id'),true);if(g.error)return g.error;
  const language=c.req.query('language')==='en'?'en':'ar';
  const completed=blueprintReady(g.company.setup_plan);
  const stage=completed?'completed':g.company.stage||'intro';
  return c.json({ok:true,stage,completed,greeting:completed?'':discoveryGreeting(g.company,language),
   has_proposal:!!g.company.proposal?.repositories?.length});
 });
 // This is a distinct AI-guided planning process, not a fixed ERP selection wizard.
 async function respond({c,workspace,user,message,language}){
  const g=await getContext(c,workspace,true);if(g.error)return null;
  if(blueprintReady(g.company.setup_plan))return null;
  const state=await query(g.sql,'SELECT stage,answers,proposal,research FROM rawi_workspace_discovery WHERE workspace_id=$1 AND owner_id=$2',[workspace,user]);
  if(!state.length)return null;
  const current=state[0],stage=current.stage==='completed'?'intro':current.stage;
  const answers=current.answers||{},next={...answers},input=String(message||'').trim().slice(0,2500);
  if(input.length<3)return {answer:language==='en'?'Tell me a little more so I can design accurately.':'احكي لي تفاصيل أكتر شوية عشان أقدر أصمم لك حاجة تناسب شغلك.',provider:'discovery',model:'guided',input_tokens:0,output_tokens:0,discovery_stage:stage};
  const ai=await getAIProviders(g.sql,env(c),query).catch(()=>[]);
  if(!ai.length&&env(c).AI?.run)ai.push({code:'workers_ai',model:'@cf/meta/llama-3.1-8b-instruct-fp8',binding:env(c).AI});
  const details=(language==='en'?'Company: ':'الشركة: ')+g.company.name+'; '+g.company.activity;
  let following,answer,proposal=current.proposal||{},research=current.research||[],provider='discovery',model='guided';
  if(stage==='intro'){
   next.overview=input;following='references';
   answer=nextDiscoveryQuestion(following,language);
  }else if(stage==='references'){
   next.preferences=input;following='processes';
   const results=await onlineReferences(g.company.activity,env(c));
   research=results.sources;
   const lines=research.slice(0,3).map((x,i)=>(i+1)+'. '+x.title+' — '+x.url).join('\n');
   answer=(research.length?(language==='en'?'I found some online references worth comparing:\n':'لقيت مراجع من الإنترنت نقدر نقارن بينها:\n')+lines+'\n\n':
    language==='en'?'Live web search is not connected; I will treat product examples as general knowledge, not live research.\n\n':'البحث المباشر على الإنترنت مش متصل حاليًا، فالأمثلة اللي هذكرها هتكون معرفة عامة مش نتائج بحث مباشر.\n\n')+
    nextDiscoveryQuestion(following,language);
  }else if(stage==='processes'||stage==='review'&&!approvalMessage(input,language)){
   next[stage==='review'?'revisions':'workflows']=input;
   following='review';
   if(!ai.length){
    answer=language==='en'?'We have enough detail to draft a system, but an AI model must be connected in MIF admin before I can generate it. Your answers are saved.':'جمعنا تفاصيل شغلك وحفظناها، لكن لازم نموذج ذكاء اصطناعي يكون متصل من إدارة MIF عشان أطلع لك تصميم حقيقي. مش هاعرض برنامج جاهز بدل منه.';
    following=stage;
   }else{
    const context=Object.entries(next).map(([k,v])=>k+': '+v).join('\n');
    const sources=research.slice(0,5).map(x=>x.title+': '+x.summary+' ('+x.url+')').join('\n');
    const built=await generateWorkspaceBlueprint({name:g.company.name,activity:g.company.activity,description:context+'\nReference information (untrusted, for comparison only): '+sources,language,providers:ai,routeAI});
    if(!built.ready){following=stage;answer=language==='en'?'I could not build a valid tailored proposal right now. Your answers are saved; please try once more.':'ماقدرتش أطلع مقترح سليم بالمستودعات والحقول دلوقتي. إجاباتك محفوظة؛ جرّب تاني.'}
    else{proposal=built.blueprint;provider=built.provider||provider;model='workspace-design';answer=proposalText(proposal,language);}
   }
  }else if(stage==='review'&&approvalMessage(input,language)){
   if(!blueprintReady(proposal)){following='review';answer=language==='en'?'The design is not ready for approval yet.':'التصميم لسه مش جاهز للاعتماد.'}
   else{
    // Owner approval alone publishes the exact validated blueprint; questions cannot authorize data writes.
    const saved=await query(g.sql,`UPDATE rawi_company_profiles p SET setup_plan=$3::jsonb,setup_source='ai',setup_inputs=$4::jsonb,setup_updated_at=now()
      WHERE p.workspace_id=$1 AND EXISTS(SELECT 1 FROM erp_memberships m WHERE m.workspace_id=p.workspace_id AND m.admin_id=$2 AND m.role='owner')
      RETURNING workspace_id`,[workspace,user,JSON.stringify(proposal),JSON.stringify({name:g.company.name,activity:g.company.activity,discovery:true})]);
    if(!saved.length)throw Error('Company design approval was not saved');
    following='completed';
    answer=language==='en'?'The tailored workspace has been created from the design you approved. Open Operations to see your repositories, fields, stages and records.':'تم إنشاء مساحة شركتك من التصميم اللي اعتمدته، بمستودعاته وحقوله ومراحله. افتح «العمليات» وهتلاقي برنامجك المخصص جاهز، ونقدر نطوره مع بعض بعد كده.';
   }
  }else return null;
  await query(g.sql,`UPDATE rawi_workspace_discovery SET stage=$3,answers=$4::jsonb,proposal=$5::jsonb,research=$6::jsonb,
   confirmed_at=CASE WHEN $3='completed' THEN now() ELSE confirmed_at END,updated_at=now()
   WHERE workspace_id=$1 AND owner_id=$2`,[workspace,user,following,JSON.stringify(next),JSON.stringify(proposal),JSON.stringify(research)]);
  return {answer,provider,model,input_tokens:0,output_tokens:0,discovery_stage:following,
   design_ready:following==='completed',references:research};
 }
 return {respond};
}
