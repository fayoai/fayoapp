import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Activity,ArrowLeft,ArrowRight,BookOpen,CheckCircle2,Code2,Database,Download,FileCode2,FolderKanban,KeyRound,Layers,LogOut,MessageSquare,Plus,RefreshCw,Send,Settings2,ShieldCheck,TerminalSquare,UserRound,Wrench,X} from 'lucide-react';
import {api,useSite,tr} from './App.jsx';
import RawiDevelopers from './RawiDevelopers.jsx';
import './rawi-developer-app.css';
const image='/developers/rawi-dev-mark.svg';
const defaultForm={email:'',password:'',name:'',organization:''};
const navigation=[['home','لوحة التحكم','Overview',Activity],['studio','استوديو أودو','Odoo Studio',Code2],['assistant','مساعد التطوير','AI Engineer',MessageSquare],['account','حساب المطوّر','Account',UserRound]];
const sections=[['connections','ربط قواعد أودو','Connect Odoo databases',Database],['modules','تطوير الموديولات','Build Odoo addons',FileCode2],['implementation','مشاريع التنفيذ','Implementation projects',FolderKanban],['diagnostics','فحص المشكلات','Diagnostics',Wrench]];
export default function RawiDeveloperApp(){
 const {lang,setLang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true),[mode,setMode]=useState('signin'),[form,setForm]=useState(defaultForm),[allowRegister,setAllowRegister]=useState(null),[authBusy,setAuthBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [tab,setTab]=useState('home'),[workspaces,setWorkspaces]=useState([]),[workspace,setWorkspace]=useState(''),[subscriptions,setSubscriptions]=useState([]),[threads,setThreads]=useState([]),[thread,setThread]=useState(null),[messages,setMessages]=useState([]),[question,setQuestion]=useState(''),[asking,setAsking]=useState(false);
 const messageArea=useRef(null);
 const refresh=useCallback(async()=>{try{const data=await api('/api/admin/me');setSession(data)}catch{setSession(null)}finally{setChecking(false)}},[]);
 useEffect(()=>{refresh();api('/api/public/rawi/status').then(s=>setAllowRegister(!!s.registration_enabled)).catch(()=>setAllowRegister(false))},[refresh]);
 const isDeveloper=session?.account_type==='developer';
 const reload=useCallback(async()=>{if(!isDeveloper)return;try{
  const [w,p]=await Promise.all([api('/api/admin/developer/workspaces'),api('/api/admin/my-subscription')]);
  const list=w.data||[];setWorkspaces(list);setSubscriptions(p.data||[]);
  setWorkspace(old=>list.some(x=>x.id===old)?old:list[0]?.id||'');
 }catch(e){setError(e.message)}},[isDeveloper]);
 useEffect(()=>{reload()},[reload]);
 useEffect(()=>{if(!isDeveloper||!workspace){setThreads([]);setThread(null);setMessages([]);return}
  let cancelled=false;api('/api/admin/chat/threads?workspace_id='+encodeURIComponent(workspace)).then(r=>{if(!cancelled)setThreads(r.data||[])}).catch(()=>{});
  setThread(null);setMessages([]);return()=>{cancelled=true}},[isDeveloper,workspace]);
 useEffect(()=>{messageArea.current?.scrollTo({top:messageArea.current.scrollHeight,behavior:'smooth'})},[messages,asking]);
 const submitAuth=async e=>{e.preventDefault();setAuthBusy(true);setError('');try{
  if(mode==='signup'){
   if(allowRegister!==true)throw Error(L('تسجيل حسابات جديدة مغلق حاليًا حتى يفعّله المالك.','Registration is disabled until enabled by the operator.'));
   await api('/api/admin/register',{method:'POST',body:JSON.stringify({...form,account_type:'developer'})});
  }else await api('/api/admin/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})});
  await refresh();setForm(defaultForm);setNotice(L('تم تسجيل الدخول','Signed in'));
 }catch(e){setError(e.message)}finally{setAuthBusy(false)}};
 const signout=async()=>{try{await api('/api/admin/logout',{method:'POST'})}catch{}
  setSession(null);setThreads([]);setMessages([]);setWorkspace('');setThread(null);setTab('home');setNotice('')};
 const send=async e=>{e.preventDefault();const text=question.trim();if(!text||!workspace||asking)return;
  setError('');setAsking(true);setQuestion('');setMessages(old=>[...old,{role:'user',content:text}]);
  try{const r=await api('/api/admin/chat/send',{method:'POST',body:JSON.stringify({question:text,workspace_id:workspace,thread_id:thread})});
   if(r.thread_id)setThread(r.thread_id);
   setMessages(old=>[...old,{role:'assistant',content:r.answer}]);
   api('/api/admin/chat/threads?workspace_id='+encodeURIComponent(workspace)).then(x=>setThreads(x.data||[])).catch(()=>{});
  }catch(e){setError(e.message);setQuestion(text);setMessages(old=>old.slice(0,-1))}
  finally{setAsking(false)}};
 const openThread=async id=>{try{const r=await api('/api/admin/chat/threads/'+id);setThread(id);setMessages(r.data||[]);setTab('assistant')}catch(e){setError(e.message)}};
 const freshThread=()=>{setThread(null);setMessages([]);setQuestion('');setTab('assistant')};
 const current=subscriptions.find(s=>s.workspace_id===workspace);
 const workspaceName=workspaces.find(w=>w.id===workspace)?.name||L('مساحة التطوير','Developer workspace');
 const toast=(value,failed)=>{if(failed)setError(value);else setNotice(value)};
 if(checking)return <main className="rawi-dev-app rawi-dev-loading"><img src={image} alt="RAWI Developers"/><p>{L('جارٍ فتح راوي للمطورين...','Opening RAWI Developers...')}</p></main>;
 if(!isDeveloper)return <main className="rawi-dev-app rawi-dev-onboarding">
  <div className="rawi-dev-auth-layout">
   <section className="rawi-dev-auth-intro"><img src={image} alt="RAWI Developers"/><div className="rawi-dev-brand"><span>RAWI <strong>DEVELOPERS</strong></span><small>BY MIF SMART</small></div>
    <h1>{L('استوديو التطوير الذكي','Intelligent development studio')}</h1><p>{L('تطبيق مستقل لتطوير وربط أنظمة Odoo، إنشاء الموديولات، إدارة التنفيذ وفحص قواعد البيانات. دعم أنظمة أخرى سيُضاف لاحقًا دون تغيير التطبيق الأساسي.','A separate development application for Odoo connections, module engineering, implementations and diagnostics. Other systems can be supported later.')}</p>
    <div className="rawi-dev-auth-capabilities">{sections.map(([id,ar,en,Icon])=><div key={id}><Icon size={17}/><span>{L(ar,en)}</span></div>)}</div>
    <small>{L('Enterprise تطبيق منفصل بهويته البرتقالية الأصلية.','Enterprise remains a separate app with its original orange identity.')}</small>
   </section>
   <section className="rawi-dev-auth-panel">{session?.account_type==='enterprise'?<><h2>{L('هذا حساب Enterprise','Enterprise account detected')}</h2><p>{L('حسابك الحالي خاص بتطبيق المؤسسات. يمكنك فتح التطبيق المناسب أو تسجيل الخروج والدخول بحساب Developers.','Your session belongs to Enterprise. Open that application or sign out to use a Developers account.')}</p><a href="/">{L('فتح راوي Enterprise','Open RAWI Enterprise')} <ArrowLeft size={16}/></a><button onClick={signout}><LogOut size={15}/>{L('تسجيل الخروج','Sign out')}</button></>:<>
    <header><img src={image} alt=""/><div><small>RAWI DEVELOPERS</small><h2>{mode==='signup'?L('حساب مطوّر جديد','Create Developer account'):L('تسجيل دخول المطورين','Developer sign in')}</h2></div></header>
    <form onSubmit={submitAuth}>{mode==='signup'&&<><label>{L('الاسم','Name')}<input required minLength={2} maxLength={160} autoComplete="name" value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label><label>{L('اسم فريق التطوير','Development team')}<input required minLength={2} maxLength={150} value={form.organization} onChange={e=>setForm(v=>({...v,organization:e.target.value}))}/></label></>}
     <label>{L('البريد الإلكتروني','Email')}<input required type="email" maxLength={180} autoComplete="username" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))}/></label>
     <label>{L('كلمة المرور','Password')}<input required type="password" minLength={mode==='signup'?12:1} autoComplete={mode==='signup'?'new-password':'current-password'} value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))}/></label>
     {mode==='signup'&&allowRegister===false&&<p role="status">{L('التسجيل غير مفعّل على الخادم بعد.','Registration is currently disabled by the server.')}</p>}
     {error&&<p className="rawi-dev-app-error" role="alert">{error}</p>}
     <button type="submit" disabled={authBusy||(mode==='signup'&&allowRegister!==true)}>{authBusy?L('جارٍ التحقق...','Verifying...'):mode==='signup'?L('إنشاء حساب Developers','Create Developers account'):L('دخول استوديو المطورين','Enter Developer Studio')} <ArrowLeft size={17}/></button>
    </form><button className="rawi-dev-auth-switch" onClick={()=>{setMode(mode==='signin'?'signup':'signin');setError('')}}>{mode==='signin'?L('إنشاء حساب مطوّر جديد','Create a Developers account'):L('عندي حساب بالفعل','I already have an account')}</button>
    <a className="rawi-dev-enterprise-link" href="/">{L('الذهاب إلى راوي للمؤسسات','Go to RAWI Enterprise')} <ArrowLeft size={14}/></a>
   </>}</section>
  </div>
 </main>;
 return <div className="rawi-dev-app rawi-dev-shell">
  <aside className="rawi-dev-sidebar">
   <a className="rawi-dev-logo" href="/developers/"><img src={image} alt="RAWI Developers"/><div><strong>RAWI <span>DEV</span></strong><small>MIF SMART / ENGINEERING</small></div></a>
   <div className="rawi-dev-menu-label">{L('مساحة العمل','WORKSPACE')}</div>
   <nav aria-label={L('التنقل','Navigation')}>{navigation.map(([key,ar,en,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon size={18}/><span>{L(ar,en)}</span></button>)}</nav>
   <div className="rawi-dev-sidebar-bottom"><div><ShieldCheck size={16}/>{L('صلاحيات منفصلة ومحمية','Separated, secured access')}</div><button onClick={signout}><LogOut size={17}/>{L('تسجيل الخروج','Sign out')}</button></div>
  </aside>
  <div className="rawi-dev-main"><header className="rawi-dev-topbar"><div><span>RAWI / DEVELOPERS</span><strong>{tab==='home'?L('نظرة عامة','Overview'):tab==='studio'?L('استوديو Odoo','Odoo Studio'):tab==='assistant'?L('مهندس AI','AI Engineer'):L('حساب المطور','Developer account')}</strong></div><div className="rawi-dev-top-actions"><select aria-label={L('فريق التطوير','Development workspace')} value={workspace} onChange={e=>setWorkspace(e.target.value)}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button title={L('اللغة','Language')} onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'EN':'عربي'}</button><img src={image} alt=""/></div></header>
   <main className="rawi-dev-content">
    {tab==='home'&&<><section className="rawi-dev-banner"><div><small>RAWI DEVELOPERS / ODOO</small><h1>{L('طوّر أودو بذكاء.','Build Odoo intelligently.')}</h1><p>{L('بيئة مستقلة لإدارة الربط والتطوير والتنفيذ والفحص، وواجهة قابلة لتوسعة الأنظمة مستقبلًا.','Independent Odoo development, integration, implementation and diagnostics, built to support more platforms in future.')}</p><button onClick={()=>setTab('studio')}><TerminalSquare size={17}/>{L('فتح استوديو Odoo','Open Odoo Studio')}</button></div><img src={image} alt="" aria-hidden="true"/></section>
      <div className="rawi-dev-overview-cards">{sections.map(([key,ar,en,Icon])=><button key={key} onClick={()=>setTab('studio')}><Icon size={23}/><strong>{L(ar,en)}</strong><small>{L('إدارة من الاستوديو','Manage in Studio')}</small><ArrowLeft size={15}/></button>)}</div>
      <section className="rawi-dev-info"><div><Activity size={20}/><h3>{L('حالة التجربة','Evaluation status')}</h3></div><p>{current?.plan_name||L('لا توجد باقة مفعّلة','No active plan')} · {L('رسائل متبقية','Messages remaining')}: {Number(current?.messages_remaining||0).toLocaleString()} · {L('المؤسسة','Workspace')}: {workspaceName}</p><p>{L('وظائف اختبار Odoo تعتمد على رابط حقيقي ومفتاح API صالح؛ لا تُنفّذ تغييرات على قواعد العملاء بمجرد محادثة AI.','Live Odoo tests require a real service account. AI conversation alone does not modify any customer database.')}</p></section>
    </>}
    {tab==='studio'&&<RawiDevelopers notify={toast} workspaceId={workspace} onWorkspaceChange={setWorkspace}/>}
    {tab==='assistant'&&<div className="rawi-dev-chat-layout"><section className="rawi-dev-chat-history"><div><strong>{L('محادثات التطوير','Engineering threads')}</strong><button onClick={freshThread}><Plus size={17}/></button></div>{threads.map(t=><button key={t.id} className={thread===t.id?'active':''} onClick={()=>openThread(t.id)}>{t.title}</button>)}{!threads.length&&<small>{L('ابدأ أول محادثة تطوير','Start your first engineering thread')}</small>}</section><section className="rawi-dev-ai-chat"><header><img src={image} alt=""/><div><strong>RAWI AI ENGINEER</strong><small>{L('متخصص حاليًا في Odoo 17–20','Currently specialized in Odoo 17–20')}</small></div><button onClick={freshThread}><Plus size={17}/>{L('محادثة جديدة','New')}</button></header><div className="rawi-dev-chat-messages" ref={messageArea}>{messages.length?messages.map((m,i)=><article className={m.role==='user'?'user':'assistant'} key={i}><strong>{m.role==='user'?L('أنت','You'):'RAWI DEV'}</strong><p>{m.content}</p></article>):<div className="rawi-dev-chat-empty"><TerminalSquare size={40}/><h2>{L('المهندس الذكي جاهز','Your AI engineering assistant')}</h2><p>{L('اسأل عن إنشاء موديول أودو، تصحيح RPC_ERROR، XML وOWL، أو خطط التنفيذ والترقية.','Ask about Odoo addons, RPC errors, XML, OWL, implementation and migrations.')}</p></div>}{asking&&<p>{L('راوي بيحلل السؤال...','Analyzing...')}</p>}</div><form onSubmit={send}><textarea rows={2} required maxLength={2500} value={question} onChange={e=>setQuestion(e.target.value)} placeholder={L('اكتب سؤالك التقني عن Odoo...','Ask an Odoo engineering question...')}/><button disabled={asking||!question.trim()||!workspace} aria-label={L('إرسال','Send')}><Send size={19}/></button></form></section></div>}
    {tab==='account'&&<section className="rawi-dev-account"><img src={image} alt=""/><h1>{L('حساب راوي للمطورين','RAWI Developers account')}</h1><div><span>{L('البريد الإلكتروني','Email')}</span><strong>{session.email}</strong></div><div><span>{L('نوع التطبيق','Application')}</span><strong>RAWI Developers</strong></div><div><span>{L('مساحة العمل','Workspace')}</span><strong>{workspaceName}</strong></div><div><span>{L('الاشتراك','Subscription')}</span><strong>{current?.plan_name||L('غير مفعّل','Not active')} / {Number(current?.messages_remaining||0)} {L('رسالة','messages')}</strong></div><button onClick={reload}><RefreshCw size={16}/>{L('تحديث البيانات','Refresh data')}</button><button onClick={signout}><LogOut size={16}/>{L('تسجيل الخروج','Sign out')}</button></section>}
    {error&&<p className="rawi-dev-app-error" role="alert" onClick={()=>setError('')}>{error} <X size={15}/></p>}
    {notice&&<p className="rawi-dev-app-notice" role="status" onClick={()=>setNotice('')}>{notice}<CheckCircle2 size={15}/></p>}
   </main>
  </div>
 </div>;
}
