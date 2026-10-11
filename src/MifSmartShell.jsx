import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {api,useSite,tr} from './App.jsx';
import AiErpWorkspace from './AiErpWorkspace.jsx';
import {MessageCircle,Grid2X2,Plus,CalendarDays,UserRound,Send,Download,PlugZap,LogOut,ChevronLeft,ChevronRight,Menu,X,Check,Smartphone,Monitor,Loader2,ArrowRight,Trash2} from 'lucide-react';
import './mif-smart-shell.css';
const initialLogin={email:'',password:'',name:'',organization:''};
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
const nav=[['chats','المحادثات','Chats',MessageCircle],['operations','العمليات','Operations',Grid2X2],['new','جديدة','New',Plus],['schedule','الجدول','Schedule',CalendarDays],['account','حسابي','Account',UserRound]];
function AccountGate({L,onLogin}){return <section className="mif-access-gate"><img src="/mif-mark.svg" alt="MIF Smart"/><h2>{L('سجّل دخولك للمتابعة','Sign in to continue')}</h2><p>{L('بياناتك وعملياتك ومواعيدك خاصة بحسابك.','Your records, operations and scheduled events are private to your account.')}</p><button onClick={onLogin}>{L('تسجيل الدخول','Sign in')} <ChevronLeft size={17}/></button></section>}
export default function MifSmartShell(){
 const {lang,setLang}=useSite(),L=(a,e)=>tr(lang,a,e);
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true),[tab,setTab]=useState('chats'),[authOpen,setAuthOpen]=useState(false),[signup,setSignup]=useState(false),[form,setForm]=useState(initialLogin),[authError,setAuthError]=useState(''),[authBusy,setAuthBusy]=useState(false);
 const [threads,setThreads]=useState([]),[active,setActive]=useState(''),[messages,setMessages]=useState([]),[question,setQuestion]=useState(''),[asking,setAsking]=useState(false),[chatError,setChatError]=useState(''),[showHistory,setShowHistory]=useState(false);
 const [installPrompt,setInstallPrompt]=useState(null),[installOpen,setInstallOpen]=useState(false),[installing,setInstalling]=useState(false);
 const [integrationOpen,setIntegrationOpen]=useState(false),[notice,setNotice]=useState('');
 const areaRef=useRef(null),requestRef=useRef(null);
 const device=useMemo(platform,[]),authed=!!session;
 const refreshSession=useCallback(async()=>{try{const r=await api('/api/admin/me');setSession(r);return true}catch{setSession(null);return false}finally{setChecking(false)}},[]);
 useEffect(()=>{refreshSession();const before=e=>{e.preventDefault();setInstallPrompt(e)};const onInstalled=()=>{setInstallPrompt(null);setInstallOpen(false)};window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',onInstalled);return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',onInstalled)}},[refreshSession]);
 useEffect(()=>{if(!authed){setThreads([]);setActive('');setMessages([]);return;}api('/api/admin/chat/threads').then(r=>setThreads(r.data||[])).catch(()=>{})},[authed]);
 useEffect(()=>{areaRef.current?.scrollTo({top:areaRef.current.scrollHeight,behavior:'smooth'})},[messages,asking,tab]);
 useEffect(()=>{const handler=()=>{const url=new URL(window.location.href);setTab(['chats','operations','schedule','account'].includes(url.searchParams.get('view'))?url.searchParams.get('view'):'chats')};window.addEventListener('popstate',handler);return()=>window.removeEventListener('popstate',handler)},[]);
 const navigate=key=>{setIntegrationOpen(false);setChatError('');setShowHistory(false);setTab(key);const url=new URL(window.location.href);url.searchParams.set('view',key);window.history.pushState({},'',url)};
 const selectTab=key=>{if(key==='new'){startNew();return}navigate(key);if(!authed&&key!=='chats')setAuthOpen(true)};
 const startNew=()=>{if(requestRef.current)requestRef.current.abort();requestRef.current=null;setActive('');setMessages([]);setQuestion('');setChatError('');navigate('chats')};
 const openThread=async id=>{if(!authed)return;setShowHistory(false);navigate('chats');setActive(id);setChatError('');try{const r=await api('/api/admin/chat/threads/'+id);setMessages(r.data||[])}catch(e){setChatError(e.message)}};
 const submitAuth=async e=>{e.preventDefault();setAuthBusy(true);setAuthError('');try{if(signup){await api('/api/admin/register',{method:'POST',body:JSON.stringify({...form})})}else{await api('/api/admin/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})})}await refreshSession();setAuthOpen(false);setForm(initialLogin);setSignup(false)}catch(e){setAuthError(e.message)}finally{setAuthBusy(false)}};
 const logout=async()=>{try{await api('/api/admin/logout',{method:'POST'})}catch{}setSession(null);startNew();setThreads([]);setIntegrationOpen(false)};
 const ask=async e=>{
  e?.preventDefault?.();const text=question.trim();if(!text||asking||text.length>2500)return;
  setQuestion('');setChatError('');setAsking(true);setMessages(m=>[...m,{role:'user',content:text,at:new Date().toISOString()}]);
  const ctl=new AbortController();requestRef.current=ctl;
  try{
   const endpoint=authed?'/api/admin/chat/send':'/api/chat/public';
   const r=await api(endpoint,{method:'POST',signal:ctl.signal,body:JSON.stringify(authed?{thread_id:active||null,question:text}:{question:text})});
   if(ctl.signal.aborted)return;
   if(r.thread_id){setActive(r.thread_id);api('/api/admin/chat/threads').then(t=>setThreads(t.data||[])).catch(()=>{})}
   setMessages(m=>[...m,{role:'assistant',content:r.answer,at:new Date().toISOString()}]);
  }catch(err){if(ctl.signal.aborted)return;setMessages(m=>m.slice(0,-1));setQuestion(text);setChatError(err.message)}finally{setAsking(false);requestRef.current=null}
 };
 const install=async()=>{if(installPrompt){setInstalling(true);try{await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null);setInstallOpen(false)}finally{setInstalling(false)}}else setInstallOpen(true)};
 const deleteThread=async id=>{if(!authed)return;try{await api('/api/admin/chat/threads/'+id,{method:'DELETE'});setThreads(t=>t.filter(x=>x.id!==id));if(id===active)startNew()}catch(e){setChatError(e.message)}};
 return <div className="mif-app" dir={lang==='ar'?'rtl':'ltr'}>
  <header className="mif-topbar">
   <button type="button" className="mif-head-logo" aria-label="MIF Smart" onClick={()=>navigate('chats')}><img src="/mif-logo.svg" alt="MIF Smart"/></button>
   <div className="mif-head-actions">
    {authed&&<button className="mif-head-control" onClick={()=>setIntegrationOpen(true)}><PlugZap size={18}/><span>{L('التكاملات','Integrations')}</span></button>}
    <button className="mif-head-control mif-download" onClick={install}><Download size={18}/><span>{L('تنزيل التطبيق','Get app')}</span></button>
    {!authed&&<button className="mif-head-signin" onClick={()=>setAuthOpen(true)}>{L('دخول','Sign in')}</button>}
   </div>
  </header>
  <main className={'mif-body mif-body-'+tab}>
   {tab==='chats'&&<section className="mif-chat-page">
    {authed&&<button className="mif-history-toggle" onClick={()=>setShowHistory(v=>!v)}><Menu size={17}/>{L('محادثاتي','My chats')}{threads.length>0&&<span>{threads.length}</span>}</button>}
    {showHistory&&authed&&<div className="mif-history-overlay"><div className="mif-history-panel"><div className="mif-history-head"><strong>{L('المحادثات','Conversations')}</strong><button onClick={()=>setShowHistory(false)} aria-label={L('إغلاق','Close')}><X size={19}/></button></div><button className="mif-history-new" onClick={startNew}><Plus size={16}/>{L('محادثة جديدة','New conversation')}</button>{threads.length?threads.map(t=><div className="mif-history-item" key={t.id}><button onClick={()=>openThread(t.id)}>{t.title}</button><button title={L('حذف المحادثة','Delete chat')} onClick={()=>deleteThread(t.id)}><Trash2 size={15}/></button></div>):<p>{L('لا توجد محادثات محفوظة بعد.','No saved conversations yet.')}</p>}</div><button className="mif-history-dismiss" aria-label="Close" onClick={()=>setShowHistory(false)}/></div>}
    <div className={'mif-chat-scroll'+(!messages.length?' is-empty':'')} ref={areaRef} aria-live="polite">
     {!messages.length?<div className="mif-chat-welcome"><img src="/mif-mark.svg" alt="MIF Smart"/><h1>{L('كيف أقدر أساعدك؟','How can I help?')}</h1><p>{L('اسأل عن أعمالك، أو اطلب تنظيم مهمة أو فاتورة.','Ask a question, plan a task or discuss an invoice.')}</p></div>:<div className="mif-chat-messages">{messages.map((m,i)=><article className={'mif-bubble '+m.role} key={i}>{m.role==='assistant'&&<img src="/mif-mark.svg" alt="MIF Smart"/>}<div><p>{m.content}</p></div></article>)}{asking&&<div className="mif-typing"><img src="/mif-mark.svg" alt=""/><Loader2 className="mif-spinner" size={17}/></div>}</div>}
    </div>
    {chatError&&<div className="mif-chat-error" role="alert">{chatError}</div>}
    <form className="mif-composer" onSubmit={ask}><textarea rows={1} value={question} placeholder={L('اكتب رسالتك هنا...','Message MIF Smart...')} onChange={e=>setQuestion(e.target.value)} maxLength={2500} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(e)}}}/><button type="submit" aria-label={L('إرسال','Send')} disabled={asking||!question.trim()}><Send size={21}/></button></form>
    <div className="mif-chat-footnote">{authed?L('محادثاتك محفوظة في حسابك.','Your chats are saved to your account.'):L('سجّل الدخول لحفظ محادثاتك واستخدام بيانات أعمالك.','Sign in to save chats and use your business records.')}</div>
   </section>}
   {tab==='operations'&&(authed?<AiErpWorkspace key="operations" mode="operations" notify={setNotice}/>:<AccountGate L={L} onLogin={()=>setAuthOpen(true)}/>)}
   {tab==='schedule'&&(authed?<AiErpWorkspace key="schedule" mode="schedule" notify={setNotice}/>:<AccountGate L={L} onLogin={()=>setAuthOpen(true)}/>)}
   {tab==='account'&&(authed?<section className="mif-account"><div className="mif-account-avatar"><UserRound size={32}/></div><h2>{L('حسابي','My account')}</h2><div className="mif-account-detail"><span>{L('البريد الإلكتروني','Email')}</span><strong>{session.email||'—'}</strong></div><div className="mif-account-detail"><span>{L('اللغة','Language')}</span><button onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'العربية':'English'}</button></div><button className="mif-logout" onClick={logout}><LogOut size={18}/>{L('تسجيل الخروج','Sign out')}</button></section>:<AccountGate L={L} onLogin={()=>setAuthOpen(true)}/>)}
  </main>
  <nav className="mif-bottom-nav" aria-label={L('التنقل الرئيسي','Main navigation')}>{nav.map(([id,ar,en,Icon])=><button key={id} onClick={()=>selectTab(id)} aria-label={L(ar,en)} aria-current={tab===id?'page':undefined} className={'mif-bottom-item '+(tab===id?'active ':'')+(id==='new'?'new':'')}><span className="mif-bottom-icon"><Icon size={id==='new'?29:23} strokeWidth={id==='new'?2.6:1.9}/></span><span className="mif-bottom-label">{L(ar,en)}</span></button>)}</nav>
  {authOpen&&<div className="mif-dialog-wrap" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setAuthOpen(false)}}><section className="mif-dialog" role="dialog" aria-modal="true" aria-labelledby="mif-auth-title"><button className="mif-close" onClick={()=>setAuthOpen(false)} aria-label={L('إغلاق','Close')}><X size={20}/></button><img src="/mif-mark.svg" alt="MIF Smart"/><h2 id="mif-auth-title">{signup?L('إنشاء حساب','Create account'):L('تسجيل الدخول','Sign in')}</h2><form onSubmit={submitAuth}>{signup&&<><label>{L('الاسم','Name')}<input required minLength={2} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label><label>{L('اسم المؤسسة','Organization')}<input required minLength={2} value={form.organization} onChange={e=>setForm(v=>({...v,organization:e.target.value}))}/></label></>}<label>{L('البريد الإلكتروني','Email')}<input type="email" required autoComplete="username" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))}/></label><label>{L('كلمة المرور','Password')}<input type="password" required minLength={signup?12:1} autoComplete={signup?'new-password':'current-password'} value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))}/></label>{authError&&<div role="alert" className="mif-form-error">{authError}</div>}<button type="submit" disabled={authBusy}>{authBusy?<Loader2 size={17} className="mif-spinner"/>:null}{signup?L('إنشاء الحساب','Create account'):L('دخول','Sign in')}</button></form><button className="mif-auth-switch" onClick={()=>{setSignup(v=>!v);setAuthError('')}}>{signup?L('لديك حساب؟ تسجيل الدخول','Already have an account? Sign in'):L('ليس لديك حساب؟ أنشئ حسابًا','New here? Create an account')}</button></section></div>}
  {installOpen&&<div className="mif-dialog-wrap" onMouseDown={e=>{if(e.target===e.currentTarget)setInstallOpen(false)}}><section className="mif-dialog mif-install-dialog" role="dialog" aria-modal="true"><button className="mif-close" onClick={()=>setInstallOpen(false)}><X size={19}/></button>{device.kind==='desktop'?<Monitor size={33}/>:<Smartphone size={33}/>}<h2>{L('تثبيت MIF Smart','Install MIF Smart')}</h2><p>{device.kind==='ios'?L('على iPhone أو iPad: اضغط زر مشاركة في Safari، ثم «إضافة إلى الشاشة الرئيسية».','On iPhone or iPad, open in Safari, choose Share, then Add to Home Screen.'):device.kind==='android'?L('من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة للشاشة الرئيسية».','In your browser menu choose Install app or Add to Home Screen.'):device.kind==='desktop'?L('افتح التطبيق في Chrome أو Edge، ثم من قائمة المتصفح اختر «تثبيت MIF Smart».','In Chrome or Edge, open the browser menu and choose Install MIF Smart.'):L('استخدم خيار تثبيت التطبيق من قائمة المتصفح، إن كان متاحًا.','Use your browser Install app option if available.')}</p><small>{L('التثبيت من المتصفح متاح على الأجهزة المدعومة. نسخ المتاجر الأصلية لا تظهر حتى تصبح جاهزة وموقعة.','Browser installation is available on supported devices. Native store packages appear only after they are built and signed.')}</small></section></div>}
  {integrationOpen&&authed&&<div className="mif-dialog-wrap" onMouseDown={e=>{if(e.target===e.currentTarget)setIntegrationOpen(false)}}><section className="mif-dialog mif-integration-dialog" role="dialog" aria-modal="true"><button className="mif-close" onClick={()=>setIntegrationOpen(false)}><X size={19}/></button><PlugZap size={29}/><h2>{L('التكاملات','Integrations')}</h2><p>{L('ربط الأنظمة الخارجية بحسابك يحتاج صلاحيات ومفاتيح معتمدة. إعداد الذكاء الاصطناعي تديره MIF Smart مركزيًا.','Connect external systems with authorized credentials. MIF Smart manages its AI service centrally.')}</p><button onClick={()=>{setIntegrationOpen(false);navigate('operations');setNotice(L('افتح قسم التكاملات داخل العمليات لإعداد الربط.','Open the Integrations section under Operations.'))}}>{L('إدارة التكاملات','Manage integrations')}</button></section></div>}
  {notice&&<button className="mif-toast" onClick={()=>setNotice('')}>{notice}<X size={14}/></button>}
 </div>;
}
