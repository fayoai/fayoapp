import React,{useCallback,useEffect,useRef,useState} from 'react';
import {MessageCircle,Code2,Plus,UserRound,Download,Send,Menu,X,Trash2,LogOut} from 'lucide-react';
import {api,useSite,tr} from './App.jsx';
import RawiDevelopers from './RawiDevelopers.jsx';
import './rawi-developer-app.css';
const initial={name:'',organization:'',email:'',password:'',invitation:''};
const tabs=[['chats','المحادثات','Chats',MessageCircle],['studio','أودو','Odoo',Code2],['new','جديدة','New',Plus],['account','حسابي','Account',UserRound]];
export default function RawiDeveloperApp(){
 const {lang,setLang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [view,setView]=useState('chats'),[session,setSession]=useState(null),[checking,setChecking]=useState(true);
 const [signup,setSignup]=useState(false),[form,setForm]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [registration,setRegistration]=useState(false),[workspaces,setWorkspaces]=useState([]),[workspace,setWorkspace]=useState(''),[subscriptions,setSubscriptions]=useState([]);
 const [threads,setThreads]=useState([]),[historyOpen,setHistoryOpen]=useState(false),[activeThread,setActiveThread]=useState('');
 const [messages,setMessages]=useState([]),[question,setQuestion]=useState(''),[sending,setSending]=useState(false),[installPrompt,setInstallPrompt]=useState(null),[installInfo,setInstallInfo]=useState(false);
 const scroll=useRef(null),composer=useRef(null);
 const developer=!!session&&session.account_type==='developer';
 const refresh=useCallback(async()=>{try{const r=await api('/api/admin/me');setSession(r);return r}catch{setSession(null);return null}finally{setChecking(false)}},[]);
 useEffect(()=>{refresh();api('/api/public/rawi/status').then(r=>setRegistration(!!r.registration_enabled)).catch(()=>setRegistration(false));
  const onInstall=e=>{e.preventDefault();setInstallPrompt(e)};window.addEventListener('beforeinstallprompt',onInstall);
  return()=>window.removeEventListener('beforeinstallprompt',onInstall)
 },[refresh]);
 useEffect(()=>{if(!developer){setWorkspaces([]);setWorkspace('');setSubscriptions([]);setThreads([]);return}
  Promise.all([api('/api/admin/erp/workspaces'),api('/api/admin/my-subscription')]).then(([w,s])=>{
   const xs=w.data||[];setWorkspaces(xs);setWorkspace(old=>xs.some(x=>x.id===old)?old:xs[0]?.id||'');
   setSubscriptions(s.data||[])
  }).catch(e=>setError(e.message))
 },[developer]);
 useEffect(()=>{if(!developer||!workspace){setThreads([]);return}
  api('/api/admin/chat/threads?workspace_id='+encodeURIComponent(workspace)).then(r=>setThreads(r.data||[])).catch(e=>setError(e.message))
 },[developer,workspace]);
 useEffect(()=>{setMessages([]);setActiveThread('');setHistoryOpen(false)},[workspace]);
 useEffect(()=>{if(messages.length)scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'})},[messages,sending]);
 useEffect(()=>{if(view==='chats'&&window.matchMedia?.('(pointer:fine)').matches)composer.current?.focus({preventScroll:true})},[view,checking]);
 const navigate=key=>{setError('');setHistoryOpen(false);setView(key)};
 const fresh=()=>{setMessages([]);setActiveThread('');setQuestion('');navigate('chats')};
 const selectTab=key=>key==='new'?fresh():navigate(key);
 const authenticate=async e=>{e.preventDefault();setBusy(true);setError('');try{
  const path=signup?'/api/admin/register':'/api/admin/login';
  await api(path,{method:'POST',body:JSON.stringify(signup?{...form,account_type:'developer'}:{email:form.email,password:form.password})});
  const identity=await refresh();
  if(identity?.account_type!=='developer')throw Error('Developer session not available');
  setForm(initial);setSignup(false);setView('chats')
 }catch(e){setError(e.message)}finally{setBusy(false)}};
 const logout=async()=>{try{await api('/api/admin/logout',{method:'POST'})}catch{}setSession(null);setWorkspaces([]);setThreads([]);setWorkspace('');fresh()};
 const send=async e=>{e?.preventDefault?.();if(!question.trim()||sending)return;
  if(developer&&!workspace){setError(L('لم تُحدد مساحة العمل','Workspace is not selected'));return}
  const q=question.trim();setQuestion('');setError('');setSending(true);setMessages(m=>[...m,{role:'user',content:q}]);
  try{
   const endpoint=developer?'/api/admin/chat/send':'/api/chat/public';
   const r=await api(endpoint,{method:'POST',body:JSON.stringify(developer?{question:q,thread_id:activeThread||null,workspace_id:workspace}:{question:q})});
   setMessages(m=>[...m,{role:'assistant',content:r.answer}]);
   if(developer&&r.thread_id)setActiveThread(r.thread_id);
   if(developer)api('/api/admin/chat/threads?workspace_id='+encodeURIComponent(workspace)).then(x=>setThreads(x.data||[])).catch(()=>{})
  }catch(e){setMessages(m=>m.slice(0,-1));setQuestion(q);setError(e.message)}finally{setSending(false)}
 };
 const openThread=async id=>{setHistoryOpen(false);setView('chats');setError('');
  try{const r=await api('/api/admin/chat/threads/'+id+'?workspace_id='+encodeURIComponent(workspace));setActiveThread(id);setMessages(r.data||[])}catch(e){setError(e.message)}
 };
 const deleteThread=async id=>{try{await api('/api/admin/chat/threads/'+id+'?workspace_id='+encodeURIComponent(workspace),{method:'DELETE'});setThreads(t=>t.filter(x=>x.id!==id));if(activeThread===id)fresh()}catch(e){setError(e.message)}};
 const install=async()=>{if(installPrompt){try{await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null)}catch(e){setError(e.message)}}else setInstallInfo(true)};
 return <div className="rd-app rd-chat-first" dir={lang==='ar'?'rtl':'ltr'}>
  <main className={'rd-primary rd-primary-'+view}>
   {view==='chats'&&<section className="rd-chat-page">
    <div className="rd-chat-tools">
     {developer&&<><button type="button" onClick={()=>setHistoryOpen(v=>!v)} aria-label={L('المحادثات السابقة','Previous chats')}><Menu size={18}/></button>
      {workspaces.length>0&&<select aria-label={L('مساحة العمل','Workspace')} value={workspace} onChange={e=>setWorkspace(e.target.value)}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}</>}
     <button className="rd-download" type="button" onClick={install} aria-label={L('تنزيل التطبيق','Install app')}><Download size={18}/><span>{L('تنزيل التطبيق','Install app')}</span></button>
    </div>
    {historyOpen&&developer&&<div className="rd-history-layer"><aside className="rd-history-panel"><div className="rd-history-header"><strong>{L('المحادثات','Chats')}</strong><button onClick={()=>setHistoryOpen(false)} aria-label={L('إغلاق','Close')}><X size={19}/></button></div><button onClick={fresh}><Plus size={16}/>{L('جديدة','New')}</button>{threads.map(t=><div className="rd-history-item" key={t.id}><button onClick={()=>openThread(t.id)}>{t.title}</button><button onClick={()=>deleteThread(t.id)} aria-label={L('حذف','Delete')}><Trash2 size={15}/></button></div>)}</aside><button className="rd-history-dismiss" aria-label={L('إغلاق','Close')} onClick={()=>setHistoryOpen(false)}/></div>}
    <div className="rd-chat-stream" ref={scroll} aria-live="polite">
     {!messages.length&&<div className="rd-chat-greeting"><div className="rd-identity"><img src="/rawi-developer-mark.svg" alt="RAWI Developer"/><strong>RAWI <span>Developer</span></strong></div><h1>{L('كيف أستطيع مساعدتك اليوم؟','How can I help you today?')}</h1></div>}
     {messages.map((m,i)=><article key={i} className={'rd-message '+m.role}>{m.role==='assistant'&&<img src="/rawi-developer-mark.svg" alt="RAWI"/>}<p>{m.content}</p></article>)}
     {sending&&<p className="rd-processing">{L('جارٍ المعالجة…','Processing…')}</p>}
    </div>
    {error&&<p className="rd-error" role="alert">{error}</p>}
    <form className="rd-composer" onSubmit={send}><textarea ref={composer} rows={1} maxLength={2500} value={question} onChange={e=>setQuestion(e.target.value)} placeholder={L('اسأل راوي…','Ask RAWI…')} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e)}}}/><button type="submit" disabled={!question.trim()||sending} aria-label={L('إرسال','Send')}><Send size={20}/></button></form>
   </section>}
   {view==='studio'&&(developer&&workspace?<section className="rd-studio-shell"><div className="rd-studio-tools"><h1>Odoo</h1><select aria-label={L('مساحة العمل','Workspace')} value={workspace} onChange={e=>setWorkspace(e.target.value)}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div><RawiDevelopers key={workspace} selectedWorkspace={workspace} notify={x=>setError(x)}/></section>:<section className="rd-access-shortcut"><button type="button" onClick={()=>navigate('account')}>{L('حسابي','My Account')}</button></section>)}
   {view==='account'&&(developer?<section className="rd-account"><img src="/rawi-developer-mark.svg" alt="RAWI Developer"/><h2>{session.email}</h2>{subscriptions.map(s=><div key={s.workspace_id}><span>{s.workspace_name}</span><strong>{s.plan_name||'—'} · {s.status||'—'} · {s.messages_remaining||0}</strong></div>)}<button onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'English':'العربية'}</button><button onClick={logout}><LogOut size={16}/>{L('تسجيل الخروج','Sign out')}</button></section>:
    <section className="rd-auth rd-account-entry"><img src="/rawi-developer-mark.svg" alt="RAWI Developer" className="rd-entry-mark"/><h2>{signup?L('إنشاء حساب','Create account'):L('تسجيل الدخول','Sign in')}</h2><form onSubmit={authenticate}>{signup&&<><label>{L('الاسم','Name')}<input minLength={2} required value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))}/></label><label>{L('الفريق','Team')}<input minLength={2} required value={form.organization} onChange={e=>setForm(x=>({...x,organization:e.target.value}))}/></label></>}<label>{L('البريد الإلكتروني','Email')}<input type="email" autoComplete="username" required value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))}/></label>{signup&&<label>{L('رمز الدعوة','Invitation code')}<input pattern="[0-9a-fA-F]{64}" required maxLength={64} value={form.invitation} onChange={e=>setForm(x=>({...x,invitation:e.target.value.trim()}))}/></label>}<label>{L('كلمة المرور','Password')}<input type="password" autoComplete={signup?'new-password':'current-password'} minLength={signup?12:1} required value={form.password} onChange={e=>setForm(x=>({...x,password:e.target.value}))}/></label>{error&&<p className="rd-error" role="alert">{error}</p>}<button disabled={busy||(signup&&!registration)} type="submit">{signup?L('إنشاء حساب','Create account'):L('دخول','Sign in')}</button></form><button className="rd-text-button" type="button" onClick={()=>{setSignup(v=>!v);setError('')}}>{signup?L('تسجيل الدخول','Sign in'):L('إنشاء حساب','Create account')}</button><button className="rd-language" type="button" onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'English':'العربية'}</button></section>)}
  </main>
  <nav className="rd-bottom-nav" aria-label={L('التنقل الرئيسي','Main navigation')}>{tabs.map(([id,ar,en,Icon])=><button key={id} type="button" onClick={()=>selectTab(id)} className={view===id?'selected':''} aria-current={view===id?'page':undefined}><Icon size={id==='new'?26:21}/><span>{L(ar,en)}</span></button>)}</nav>
  {installInfo&&<div className="rd-install-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setInstallInfo(false)}}><section className="rd-install-dialog" role="dialog" aria-modal="true"><button onClick={()=>setInstallInfo(false)} aria-label={L('إغلاق','Close')}><X size={20}/></button><h2>{L('تنزيل RAWI Developer','Install RAWI Developer')}</h2><p>{L('من قائمة المتصفح اختر تثبيت التطبيق.','Choose Install app in the browser menu.')}</p></section></div>}
 </div>
}
