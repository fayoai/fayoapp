import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {api,useSite,tr} from './App.jsx';
import AiErpWorkspace from './AiErpWorkspace.jsx';
import MifSchedule from './MifSchedule.jsx';
import {RawiTeamPanel,RawiNotificationsPanel} from './RawiPanels.jsx';

import {MessageCircle,Grid2X2,Plus,CalendarDays,UsersRound,Bell,UserRound,Send,Download,PlugZap,LogOut,ChevronLeft,ChevronRight,Menu,X,Check,Smartphone,Monitor,Loader2,ArrowRight,Trash2,Building2} from 'lucide-react';
import './mif-smart-shell.css';
const initialLogin={name:'',email:'',password:'',account_type:'enterprise'};
const welcomeText={ar:'كيف أقدر أساعدك اليوم؟',en:'How can I help you today?'};
function RawiGreeting({lang}){
 const text=welcomeText[lang==='en'?'en':'ar'];
 const [visible,setVisible]=useState('');
 useEffect(()=>{
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){setVisible(text);return}
  setVisible('');let index=0;
  const timer=window.setInterval(()=>{index++;setVisible(text.slice(0,index));if(index>=text.length)window.clearInterval(timer)},55);
  return()=>window.clearInterval(timer);
 },[text]);
 return <article className="mif-bubble assistant mif-welcome-message"><img src="/rawi-erp-mark.svg" alt="راوي ERP"/><div><p aria-label={text}><span aria-hidden="true">{visible}</span><span className="mif-writing-caret" aria-hidden="true"/></p></div></article>
}

const localId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
function platform(){
 const ua=navigator.userAgent||'',ios=/iPhone|iPad|iPod/i.test(ua)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 if(ios)return {name:'iOS',kind:'ios'};
 if(/Android/i.test(ua))return {name:'Android',kind:'android'};
 if(/Windows/i.test(ua))return {name:'Windows',kind:'desktop'};
 if(/Macintosh|Mac OS X/i.test(ua))return {name:'macOS',kind:'desktop'};
 if(/Linux/i.test(ua))return {name:'Linux',kind:'desktop'};
 return {name:'device',kind:'unknown'};
}
const protectedTabs=['chats','operations','team','schedule','alerts','account','integrations'];
const nav=[['chats','المحادثات','Chats',MessageCircle],['operations','العمليات','Operations',Grid2X2],['schedule','الجدولة','Schedule',CalendarDays],['new','جديد','New',Plus],['team','الفريق','Team',UsersRound],['alerts','التنبيهات','Alerts',Bell],['account','حسابي','Account',UserRound]];
const isInstalled=()=>{try{return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||window.localStorage.getItem('rawi-erp-installed')==='1'}catch{return false}};
export default function MifSmartShell(){
 const {lang,setLang}=useSite(),L=(a,e)=>tr(lang,a,e);
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true),[tab,setTab]=useState('new'),[signup,setSignup]=useState(false),[form,setForm]=useState(initialLogin),[authError,setAuthError]=useState(''),[authBusy,setAuthBusy]=useState(false);
 const [workspaces,setWorkspaces]=useState([]),[workspaceId,setWorkspaceId]=useState('');
 const [registrationEnabled,setRegistrationEnabled]=useState(null),[subscriptions,setSubscriptions]=useState([]);
 const [tenantSetup,setTenantSetup]=useState(null),[tenantGeneration,setTenantGeneration]=useState(0);
 const [threads,setThreads]=useState([]),[active,setActive]=useState(''),[messages,setMessages]=useState([]),[question,setQuestion]=useState(''),[asking,setAsking]=useState(false),[chatError,setChatError]=useState('');
 const [installPrompt,setInstallPrompt]=useState(null),[installOpen,setInstallOpen]=useState(false),[installing,setInstalling]=useState(false),[installed,setInstalled]=useState(isInstalled);
 const [integrationOpen,setIntegrationOpen]=useState(false),[notice,setNotice]=useState('');
 const areaRef=useRef(null),questionRef=useRef(null),requestRef=useRef(null);
 const device=useMemo(platform,[]),authed=!!session;
 const refreshSession=useCallback(async()=>{try{const r=await api('/api/admin/me');setSession(r);return true}catch{setSession(null);return false}finally{setChecking(false)}},[]);
 
 useEffect(()=>{api('/api/public/rawi/status').then(x=>setRegistrationEnabled(!!x.registration_enabled)).catch(()=>setRegistrationEnabled(false))},[]);
 useEffect(()=>{if(!authed){setSubscriptions([]);return}api('/api/admin/my-subscription').then(x=>setSubscriptions(x.data||[])).catch(()=>setSubscriptions([]))},[authed,session?.email]);
 useEffect(()=>{refreshSession();const before=e=>{e.preventDefault();setInstallPrompt(e);setInstalled(false)};const onInstalled=()=>{setInstallPrompt(null);setInstallOpen(false);setInstalled(true);try{window.localStorage.setItem('rawi-erp-installed','1')}catch{}};const display=window.matchMedia('(display-mode: standalone)');const onDisplay=()=>{if(display.matches)setInstalled(true)};display.addEventListener?.('change',onDisplay);window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',onInstalled);return()=>{display.removeEventListener?.('change',onDisplay);window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',onInstalled)}},[refreshSession]);
 useEffect(()=>{if(!authed){setWorkspaces([]);setWorkspaceId('');return}api('/api/admin/erp/workspaces').then(r=>{const list=r.data||[];setWorkspaces(list);setWorkspaceId(prev=>list.some(w=>w.id===prev)?prev:(list[0]?.id||''))}).catch(()=>setWorkspaces([]))},[authed,tenantGeneration]);
 useEffect(()=>{
  if(!authed){setTenantSetup(null);return}
  let active=true;
  const run=async()=>{
   try{
    const status=await api('/api/admin/tenant/status');
    const pending=(status.data||[]).find(x=>x.status!=='ready');
    if(!pending||!active)return;
    for(let attempt=0;attempt<12&&active;attempt++){
     setTenantSetup({status:'migrating',step:attempt+1});
     const answer=await api('/api/admin/tenant/initialize',{method:'POST',body:'{}'});
     if(!active)return;
     if(answer.status==='ready'){setTenantSetup(null);setTenantGeneration(n=>n+1);return}
    }
    if(active)setTenantSetup({status:'pending'});
   }catch(e){if(active)setTenantSetup({status:'failed'})}
  };
  run();return()=>{active=false};
 },[authed,session?.email]);
 useEffect(()=>{if(!authed){setThreads([]);setActive('');setMessages([]);return}
  if(!workspaceId){setThreads([]);return}
  api('/api/admin/chat/threads?workspace_id='+encodeURIComponent(workspaceId)).then(r=>setThreads(r.data||[])).catch(()=>{})
 },[authed,workspaceId]);
 useEffect(()=>{if(messages.length||asking)areaRef.current?.scrollTo({top:areaRef.current.scrollHeight,behavior:'smooth'})},[messages,asking,tab]);
 // Start with a fresh chat on every launch. History is a separate protected view.
 useEffect(()=>{const url=new URL(window.location.href);url.searchParams.set('view','new');window.history.replaceState({},'',url)},[]);
 useEffect(()=>{if((tab==='new'||tab==='thread')&&typeof window!=='undefined'&&window.matchMedia?.('(pointer:fine)').matches)questionRef.current?.focus({preventScroll:true})},[checking,tab]);
 useEffect(()=>{const handler=()=>{const view=new URL(window.location.href).searchParams.get('view');setTab([...protectedTabs,'new','thread'].includes(view)?view:'new')};window.addEventListener('popstate',handler);return()=>window.removeEventListener('popstate',handler)},[]);
 const navigate=key=>{setIntegrationOpen(false);setChatError('');setTab(key);const url=new URL(window.location.href);url.searchParams.set('view',key);window.history.pushState({},'',url)};
 const selectTab=key=>{if(key==='new'){startNew();return}navigate(key)};
 const startNew=()=>{if(requestRef.current)requestRef.current.abort();requestRef.current=null;setAsking(false);setActive('');setMessages([]);setQuestion('');setChatError('');navigate('new')};
 const openThread=async id=>{if(!authed)return;if(requestRef.current)requestRef.current.abort();requestRef.current=null;setAsking(false);setActive('');setMessages([]);setQuestion('');navigate('thread');try{const r=await api('/api/admin/chat/threads/'+encodeURIComponent(id));setActive(id);setMessages(r.data||[])}catch(e){setChatError(e.message)}};
 const submitAuth=async e=>{e.preventDefault();setAuthBusy(true);setAuthError('');try{if(signup){if(registrationEnabled===false)throw new Error(L('التسجيل غير متاح الآن. يرجى التواصل مع الإدارة.','Registration is currently closed. Contact the platform operator.'));await api('/api/admin/register',{method:'POST',body:JSON.stringify({...form})})}else{await api('/api/admin/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})})}if(!await refreshSession())throw new Error(L('تعذر بدء الجلسة، حاول مرة أخرى.','Could not start a session. Try again.'));setForm(initialLogin);setSignup(false)}catch(e){setAuthError(e.message)}finally{setAuthBusy(false)}};
 const logout=async()=>{try{await api('/api/admin/logout',{method:'POST'})}catch{}setSession(null);startNew();setThreads([]);setIntegrationOpen(false)};
 const ask=async e=>{
  e?.preventDefault?.();const text=question.trim();if(!text||asking||text.length>2500)return;
  const privateChat=authed&&!!workspaceId;
  if(tab!=='new'&&tab!=='thread')return;
  setQuestion('');if(questionRef.current)questionRef.current.style.height='auto';setChatError('');setAsking(true);setMessages(m=>[...m,{role:'user',content:text,at:new Date().toISOString()}]);
  const ctl=new AbortController();requestRef.current=ctl;
  try{
   const endpoint=privateChat?'/api/admin/chat/send':'/api/chat/public';
   const history=messages.slice(-12).filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:String(m.content).slice(0,2500)}));
   const r=await api(endpoint,{method:'POST',signal:ctl.signal,body:JSON.stringify(privateChat?{thread_id:active||null,workspace_id:workspaceId,question:text}:{question:text,history})});
   if(ctl.signal.aborted)return;
   if(privateChat&&r.thread_id){setActive(r.thread_id);api('/api/admin/chat/threads?workspace_id='+encodeURIComponent(workspaceId)).then(t=>setThreads(t.data||[])).catch(()=>{})}
   setMessages(m=>[...m,{role:'assistant',content:r.answer,at:new Date().toISOString()}]);
  }catch(err){if(ctl.signal.aborted)return;setMessages(m=>m.slice(0,-1));setQuestion(text);setChatError(err.message)}finally{setAsking(false);requestRef.current=null}
 };
 const install=async()=>{if(installed)return;if(installPrompt){setInstalling(true);try{await installPrompt.prompt();const result=await installPrompt.userChoice;if(result?.outcome==='accepted'){setInstalled(true);try{window.localStorage.setItem('rawi-erp-installed','1')}catch{}}setInstallPrompt(null);setInstallOpen(false)}finally{setInstalling(false)}}else setInstallOpen(true)};
 const deleteThread=async id=>{if(!authed)return;try{await api('/api/admin/chat/threads/'+encodeURIComponent(id),{method:'DELETE'});setThreads(t=>t.filter(x=>x.id!==id));if(id===active)startNew()}catch(e){setNotice(e.message)}};
const authPanel=<section className="mif-login-page rawi-login-compact" aria-label={L('الدخول أو إنشاء حساب','Sign in or sign up')}>
  <div className="rawi-auth-heading"><img src="/rawi-erp-mark.svg" alt="" width="32" height="32" style={{width:32,height:32,maxWidth:32,maxHeight:32,flex:"0 0 32px"}}/><strong>{signup?L('إنشاء حساب جديد','Create an account'):L('تسجيل الدخول','Sign in')}</strong></div>
  <div className="rawi-auth-tabs" role="group" aria-label={L('الحساب','Account')}>
   <button type="button" className={!signup?'selected':''} aria-pressed={!signup} onClick={()=>{setSignup(false);setAuthError('')}}>{L('دخول','Sign in')}</button>
   <button type="button" className={signup?'selected':''} aria-pressed={signup} onClick={()=>{setSignup(true);setAuthError('')}}>{L('حساب جديد','New account')}</button>
  </div>
  <form className="rawi-account-form" onSubmit={submitAuth}>
   {signup&&<label>{L('الاسم','Name')}<input required autoComplete="name" minLength={2} maxLength={160} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label>}
   <label>{L('البريد الإلكتروني','Email')}<input type="email" autoComplete="username" inputMode="email" required value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))}/></label>
   <label>{L('كلمة المرور','Password')}<input type="password" autoComplete={signup?'new-password':'current-password'} minLength={signup?12:1} required value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))}/></label>
   {authError&&<p role="alert" className="mif-form-error">{authError}</p>}
   <button type="submit" disabled={authBusy||(signup&&registrationEnabled===false)}>{authBusy&&<Loader2 size={17} className="mif-spinner"/>}{signup?L('إنشاء الحساب','Create account'):L('تسجيل الدخول','Sign in')}</button>
  </form>
 </section>;
 return <div className="mif-app" dir={lang==='ar'?'rtl':'ltr'}>
  <main className={'mif-body mif-body-'+((tab==='new'||tab==='thread')?'chats':tab)+(!authed&&!checking&&protectedTabs.includes(tab)?' mif-body-auth':'')}>
   {(tab==='new'||tab==='thread')&&<section className="mif-chat-page">
    <div className="rawi-chat-tools rawi-enterprise-tools">
     {tenantSetup&&<span role="status" className="rawi-setup-state">{tenantSetup.status==='failed'?L('تعذر تهيئة القاعدة','Database setup failed'):L('تهيئة Neon','Preparing Neon')} {tenantSetup.step||''}</span>}
     {authed&&workspaces.length>0&&<label className="rawi-workspace-picker">{L('المؤسسة','Organization')}<select aria-label={L('المؤسسة النشطة','Active organization')} value={workspaceId} onChange={e=>{setWorkspaceId(e.target.value);setActive('');setMessages([]);setChatError('');navigate('new')}}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
     {authed&&<span className="rawi-identity-label" title={session?.email}>{workspaces.find(w=>w.id===workspaceId)?.name||session?.email}</span>}
     {!installed&&<button type="button" className="rawi-install-in-account rawi-install-mini" onClick={install} aria-label={L('تنزيل التطبيق','Install app')}><Download size={13}/>{L('تنزيل','Install')}</button>}
    </div>
    <div className={'mif-chat-scroll'+(!messages.length?' is-empty':'')} ref={areaRef} aria-live="polite">
     {!messages.length?<RawiGreeting lang={lang}/>:<div className="mif-chat-messages">{messages.map((m,i)=><article className={'mif-bubble '+m.role} key={i}>{m.role==='assistant'&&<img src="/rawi-erp-mark.svg" alt="RAWI"/>}<div><p>{m.content}</p></div></article>)}{asking&&<div className="mif-typing"><img src="/rawi-erp-mark.svg" alt="RAWI"/><Loader2 className="mif-spinner" size={17}/></div>}</div>}
     {chatError&&<div className="mif-chat-error" role="alert">{chatError}</div>}
    </div>
    <form className="mif-composer" onSubmit={ask}><div className="mif-composer-field"><textarea ref={questionRef} rows={1} aria-label={L('رسالتك إلى راوي','Message RAWI')} value={question} placeholder={L('اكتب رسالتك...','Write a message...')} onChange={e=>setQuestion(e.target.value)} onInput={e=>{const node=e.currentTarget;node.style.height='auto';node.style.height=Math.min(node.scrollHeight,150)+'px'}} maxLength={2500} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent?.isComposing&&e.keyCode!==229){e.preventDefault();ask()}}}/></div><button type="submit" className="rawi-send" aria-label={L('إرسال','Send')} disabled={asking||!question.trim()}>{asking?<Loader2 size={18} className="mif-spinner"/>:<Send size={19}/>}</button></form>

   </section>}
   {tab==='chats'&&authed&&<section className="mif-chats-history" aria-label={L('سجل المحادثات','Conversation history')}>
    <div className="mif-chats-history-heading"><MessageCircle size={22}/><h1>{L('المحادثات','Conversations')}</h1><span>{threads.length}</span></div>
    {workspaces.length>1&&<label className="rawi-workspace-picker">{L('المؤسسة','Organization')}<select value={workspaceId} onChange={e=>{setWorkspaceId(e.target.value);setThreads([])}}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
    <div className="mif-chats-history-list">
     {threads.length?threads.map(t=><article className="mif-history-item" key={t.id}><button onClick={()=>openThread(t.id)}><MessageCircle size={17}/><span>{t.title}</span></button><button title={L('حذف المحادثة','Delete chat')} aria-label={L('حذف المحادثة','Delete chat')} onClick={()=>deleteThread(t.id)}><Trash2 size={17}/></button></article>):<p className="mif-chats-empty">{L('لا توجد محادثات محفوظة بعد.','No saved conversations yet.')}</p>}
    </div>
   </section>}
   {!checking&&!authed&&protectedTabs.includes(tab)&&<div className="mif-protected-auth">{authPanel}</div>}
   {(tab==='operations'||tab==='integrations')&&!checking&&authed&&<AiErpWorkspace key={tab} mode={tab} notify={setNotice}/>}
   {tab==='schedule'&&!checking&&authed&&<MifSchedule notify={setNotice}/>}
   {tab==='team'&&!checking&&authed&&<RawiTeamPanel workspaceId={workspaceId} workspace={workspaces.find(w=>w.id===workspaceId)} notify={setNotice}/>}
   {tab==='alerts'&&!checking&&authed&&<RawiNotificationsPanel workspaceId={workspaceId} onSchedule={()=>navigate('schedule')}/>}
   {tab==='account'&&(checking?null:authed?<section className="mif-account"><div className="mif-account-avatar"><UserRound size={32}/></div><h2>{L('حسابي','My account')}</h2><div className="mif-account-detail"><span>{L('البريد الإلكتروني','Email')}</span><strong>{session.email||'—'}</strong></div><div className="mif-account-detail"><span>{L('نوع الحساب','Account type')}</span><strong>RAWI ERP</strong></div>{subscriptions.map(sub=><div className="mif-account-detail" key={sub.workspace_id}><span>{sub.workspace_name} — {L('الاشتراك / الرسائل المتبقية','Subscription / remaining messages')}</span><strong>{sub.plan_name||L('غير مفعّل','Not activated')} · {Number(sub.messages_remaining||0).toLocaleString()} / {Number(sub.message_limit||0).toLocaleString()} · {sub.status||'—'}</strong></div>)}<div className="mif-account-detail"><span>{L('اللغة','Language')}</span><button onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'العربية':'English'}</button></div>{!installed&&<button type="button" className="rawi-install-in-account" onClick={install}><Download size={15}/>{L('تنزيل التطبيق','Install app')}</button>}<button className="mif-logout" onClick={logout}><LogOut size={18}/>{L('تسجيل الخروج','Sign out')}</button></section>:null)}


  </main>
  <nav className="mif-bottom-nav" aria-label={L('التنقل الرئيسي','Main navigation')}>{nav.map(([id,ar,en,Icon])=><button key={id} onClick={()=>selectTab(id)} aria-label={L(ar,en)} aria-current={(tab===id||(tab==='thread'&&id==='chats'))?'page':undefined} className={'mif-bottom-item '+((tab===id||(tab==='thread'&&id==='chats'))?'active ':'')+(id==='new'?'new':'')}><span className="mif-bottom-icon"><Icon size={id==='new'?29:23} strokeWidth={id==='new'?2.6:1.9}/></span><span className="mif-bottom-label">{L(ar,en)}</span></button>)}</nav>
  {installOpen&&<div className="mif-dialog-wrap" onMouseDown={e=>{if(e.target===e.currentTarget)setInstallOpen(false)}}><section className="mif-dialog mif-install-dialog" role="dialog" aria-modal="true"><button className="mif-close" onClick={()=>setInstallOpen(false)}><X size={19}/></button>{device.kind==='desktop'?<Monitor size={33}/>:<Smartphone size={33}/>}<h2>{L('تثبيت راوي ERP','Install RAWI ERP')}</h2><p>{device.kind==='ios'?L('على iPhone أو iPad: اضغط زر مشاركة في Safari، ثم «إضافة إلى الشاشة الرئيسية».','On iPhone or iPad, open in Safari, choose Share, then Add to Home Screen.'):device.kind==='android'?L('من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة للشاشة الرئيسية».','In your browser menu choose Install app or Add to Home Screen.'):device.kind==='desktop'?L('افتح التطبيق في Chrome أو Edge، ثم اختر «تثبيت RAWI».','In Chrome or Edge, choose Install RAWI.'):L('استخدم خيار تثبيت التطبيق من قائمة المتصفح، إن كان متاحًا.','Use your browser Install app option if available.')}</p><small>{L('التثبيت من المتصفح متاح على الأجهزة المدعومة. نسخ المتاجر الأصلية لا تظهر حتى تصبح جاهزة وموقعة.','Browser installation is available on supported devices. Native store packages appear only after they are built and signed.')}</small></section></div>}
  {integrationOpen&&authed&&<div className="mif-dialog-wrap" onMouseDown={e=>{if(e.target===e.currentTarget)setIntegrationOpen(false)}}><section className="mif-dialog mif-integration-dialog" role="dialog" aria-modal="true"><button className="mif-close" onClick={()=>setIntegrationOpen(false)}><X size={19}/></button><PlugZap size={29}/><h2>{L('التكاملات','Integrations')}</h2><p>{L('ربط الأنظمة الخارجية بحسابك يحتاج صلاحيات ومفاتيح معتمدة. إعداد الذكاء الاصطناعي تديره MIF Smart مركزيًا.','Connect external systems with authorized credentials. MIF Smart manages its AI service centrally.')}</p><button onClick={()=>{setIntegrationOpen(false);navigate('operations');setNotice(L('افتح قسم التكاملات داخل العمليات لإعداد الربط.','Open the Integrations section under Operations.'))}}>{L('إدارة التكاملات','Manage integrations')}</button></section></div>}
  {notice&&<button className="mif-toast" onClick={()=>setNotice('')}>{notice}<X size={14}/></button>}
 </div>;
}
