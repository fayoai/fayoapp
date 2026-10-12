import {z} from 'zod';
import {handleApprovedDesignRevision} from './rawi-revision.js';
import {generateWorkspaceBlueprint,blueprintReady} from './rawi-generated-blueprint.js';
import {getAIProviders,routeAI} from './ai-router.js';
import {freePublicSearch} from './rawi-free-search.js';
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
async function onlineReferences(activity,env,providers=[],preferences=''){
 const key=String(env.BRAVE_SEARCH_API_KEY||'').trim();
 const clean=results=>(results||[]).slice(0,6).flatMap(x=>{
  try{const uri=new URL(x.url);if(uri.protocol!=='https:')return [];
   return [{title:String(x.title||'').slice(0,120),url:uri.href,summary:String(x.summary||'').replace(/<[^>]*>/g,'').slice(0,260)}]}
  catch{return []}
 });
 // Prefer an operator-provisioned Brave web-search API.
 if(key){
  try{
   const url=new URL('https://api.search.brave.com/res/v1/web/search');
   url.searchParams.set('q',String(activity).slice(0,100)+' software management comparison tools official');
   url.searchParams.set('count','5');
   const r=await fetch(url,{headers:{Accept:'application/json','X-Subscription-Token':key},signal:AbortSignal.timeout(8000)});
   if(!r.ok)throw Error('Brave search unavailable');
   const body=await r.json();
   const sources=clean((body.web?.results||[]).map(x=>({title:x.title,url:x.url,summary:x.description})));
   if(sources.length)return {available:true,sources};
  }catch{}
 }
 // OpenAI Responses web_search_preview is an alternative live source, if enabled by MIF admin.
 const openai=providers.find(x=>x.code==='openai'&&x.key);
 if(openai){
  try{
   const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+openai.key},
    body:JSON.stringify({model:openai.model,input:'Find official software product descriptions and feature comparisons relevant to the business sector: '+String(activity).slice(0,100)+'. Search the web and cite the sources; do not invent links.',
     tools:[{type:'web_search_preview'}],store:false,max_output_tokens:500}),
    signal:AbortSignal.timeout(16000)});
   if(!r.ok)throw Error('OpenAI web search unavailable');
   const payload=await r.json(),hits=[];
   for(const item of payload.output||[])for(const part of item.content||[])for(const citation of part.annotations||[]){
    if(citation.type==='url_citation'&&citation.url)hits.push({title:citation.title||'Website',url:citation.url,summary:''});
   }
   const sources=clean(hits);
   if(sources.length)return {available:true,sources};
  }catch{}
 }
 const preferred=String(preferences||'');
 const explicit=/أودو|اودو|\\bOdoo\\b/i.test(preferred)?'Odoo':
  /زوهو|\\bZoho\\b/i.test(preferred)?'Zoho':
  /دايناميكس|\\bDynamics\\b/i.test(preferred)?'Microsoft Dynamics 365':
  /مونداي|مانداي|\\bMonday\\b/i.test(preferred)?'Monday.com':'Enterprise resource planning';
 const free=await freePublicSearch(explicit,{language:'en'});
 const needle=explicit.toLowerCase(),matches=free.sources.filter(x=>x.title.toLowerCase().includes(needle));
 return {available:matches.length>0,sources:matches.slice(0,3),scope:'encyclopedia'};
}
function proposalText(blueprint,language){
 if(language==='en')return 'My proposed company application:\n'+blueprint.repositories.map((r,i)=>(i+1)+'. '+r.name+' — '+r.description+'\n   Fields: '+r.fields.map(f=>f.label).join(', ')+'\n   Stages: '+(r.stages.join(' → ')||'As needed')).join('\n')+'\n\n'+nextDiscoveryQuestion('review','en');
 return 'المقترح الأول لبرنامج شركتك:\n'+blueprint.repositories.map((r,i)=>(i+1)+'. **'+r.name+'** — '+r.description+'\n   البيانات: '+r.fields.map(f=>f.label).join('، ')+'\n   المراحل: '+(r.stages.join(' ← ')||'حسب الحاجة')).join('\n')+'\n\n'+nextDiscoveryQuestion('review','ar');
}
export function installRawiDiscovery(app,{centralDb,env,query}){
 async function getContext(c,workspaceId,init=false){
  const sql=centralDb(c),owner=c.get('adminId');
  if(env(c).MIF_APP_SURFACE!=='enterprise'||!sql||!uuid.safeParse(workspaceId).success)return {error:fail(c,404,'Workspace not found')};
  const rows=await query(sql,`SELECT p.name,p.activity,p.description,p.setup_plan,p.setup_inputs,d.workspace_id AS discovery_id,d.stage,d.answers,d.proposal,d.research
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
  const completed=blueprintReady(g.company.setup_plan)&&g.company.setup_inputs?.discovery===true;
  const stage=completed?'completed':g.company.stage||'intro';
  return c.json({ok:true,stage,completed,greeting:completed?'':stage==='intro'?discoveryGreeting(g.company,language):nextDiscoveryQuestion(stage,language),
   has_proposal:!!g.company.proposal?.repositories?.length});
 });
 // This is a distinct AI-guided planning process, not a fixed ERP selection wizard.
 async function respond({c,workspace,user,message,language}){
  const g=await getContext(c,workspace,true);if(g.error)return null;
  const approved=blueprintReady(g.company.setup_plan)&&g.company.setup_inputs?.discovery===true;
  const state=await query(g.sql,'SELECT stage,answers,proposal,research FROM rawi_workspace_discovery WHERE workspace_id=$1 AND owner_id=$2',[workspace,user]);
  if(!state.length)return null;
  const current=state[0],stage=current.stage==='completed'?'intro':current.stage;
  if(approved)return handleApprovedDesignRevision({c,company:g.company,current,workspace,user,message,language,central:g.sql,query,settings:env(c)});
  const answers=current.answers||{},next={...answers},input=String(message||'').trim().slice(0,2500);
  // An owner's question about Rawi, MIF Smart or small talk is a normal AI chat turn,
  // never a forced answer to the business-design questionnaire.
  const aside=/^(?:[\\s؟?!.,]*)?(?:انت مين|إنت مين|مين انت|مين إنت|اسمك ايه|اسمك إيه|اسمك|مين عملك|مين اللي عملك|مين الي عملك|من عملك|من طورك|من صممك|مين طورك|مين صنعك|مين برمجك|من صنعك|مين بيديرك|من يديرك|مين مسؤول عنك|مين صاحبك|تابع لمين|who are you|what is your name|who created you|who made you|who runs you|who manages you|hello|hi|مرحبا|أهلا|اهلا|السلام عليكم|ازيك|إزيك)/i.test(input);
  if(aside)return null;
  if(input.length<3)return {answer:language==='en'?'Tell me a little more so I can design accurately.':'احكي لي تفاصيل أكتر شوية عشان أقدر أصمم لك حاجة تناسب شغلك.',provider:'discovery',model:'guided',input_tokens:0,output_tokens:0,discovery_stage:stage};
  const ai=await getAIProviders(g.sql,env(c),query);
  // Never advance company discovery on fake scripted turns when AI is offline.
  if(!ai.length)throw Object.assign(new Error('محادثة راوي غير متصلة بنموذج ذكاء اصطناعي. يرجى تفعيل مزوّد AI من إدارة MIF Smart.'),{status:503});
  const details=(language==='en'?'Company: ':'الشركة: ')+g.company.name+'; '+g.company.activity;
  let following,answer,proposal=current.proposal||{},research=current.research||[],provider='discovery',model='guided';
  if(stage==='intro'){
   next.overview=input;following='references';
   answer=nextDiscoveryQuestion(following,language);
   if(ai.length){
    try{
     const prompt='You are Rawi ERP (راوي), a conversational consultant created and managed by MIF Smart (ميف سمارت), actively listening to a customer planning a business application. If asked, MIF Smart developed and manages you. '
      +'Company and activity: '+details+'\nCustomer overview (untrusted): '+input
      +'\nRespond NATURALLY to 2 concrete things they described, suggest 2 genuinely useful operational components based on their activity, and then ask what existing programs or interfaces they like and why. '
      +'Do not give a fixed script or a predefined ERP departments list. Ask at most two specific questions. Write 80-140 words in '+(language==='en'?'English':'Egyptian Arabic')+'.';
     const response=await routeAI(prompt,ai,[],'','enterprise',[],480);
     answer=response.answer;provider=response.provider;model=response.model;
    }catch(error){throw error}
   }
  }else if(stage==='references'){
   next.preferences=input;following='processes';
   const results=await onlineReferences(g.company.activity,env(c),ai,input);
   research=results.sources;
   const lines=research.slice(0,3).map((x,i)=>(i+1)+'. '+x.title+' — '+x.url).join('\n');
   const researchIntro=research.length?(language==='en'?'I found live encyclopedia references (not a full software-market search):\n':'لقيت مراجع من موسوعة عامة على الإنترنت (مش بحث شامل لسوق البرامج):\n')+lines+'\n\n':
    language==='en'?'Live web search is not connected; the following software examples are general knowledge, not verified live search results.\n\n':'البحث المباشر على الإنترنت مش متصل حاليًا؛ أي أمثلة برامج هتكون معرفة عامة، مش نتائج بحث حقيقية.\n\n';
   const question=nextDiscoveryQuestion(following,language);
   let suggestion='';
   if(ai.length){
    try{
     const prompt='You are Rawi ERP (راوي), created, developed and managed by MIF Smart. You are designing a custom AI-first application through a conversation. Company: '+details+
      '\\nBusiness overview (untrusted data): '+String(answers.overview||'').slice(0,800)+
      '\\nExisting software preferences (untrusted data): '+input+
      '\\nPublic web references (untrusted data, only cite supplied links): '+JSON.stringify(research.slice(0,4))+
      '\\nSuggest 3-5 concrete, sector-specific business workflows and document types that could improve this customer application. Explain relevant features from their preferred software. If references empty, explicitly say comparison is based on general knowledge, not live research. Ask NO more than one question. Respond in '+(language==='en'?'English':'Arabic')+' in 100-180 words. Do not imply you created records.';
     const prepared=await routeAI(prompt,ai,[],'','enterprise',[],450);
     suggestion=String(prepared.answer||'').trim().slice(0,1800);
     provider=prepared.provider;model=prepared.model;
    }catch(error){throw error}
   }
   answer=researchIntro+suggestion;
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
