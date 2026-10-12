import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {api,useSite,tr} from './App.jsx';
import AiErpWorkspace from './AiErpWorkspace.jsx';
import RawiGeneratedWorkspace from './RawiGeneratedWorkspace.jsx';
import RawiCustomerAccount from './RawiCustomerAccount.jsx';
import MifSchedule from './MifSchedule.jsx';
import {RawiTeamPanel,RawiNotificationsPanel} from './RawiPanels.jsx';

import {MessageCircle,Grid2X2,Plus,CalendarDays,UsersRound,Bell,UserRound,ArrowUp,Paperclip,Mic,Square,FileText,BrainCircuit,Download,PlugZap,LogOut,ChevronLeft,ChevronRight,Menu,X,Check,Smartphone,Monitor,Loader2,ArrowRight,Trash2,Building2} from 'lucide-react';
import './mif-smart-shell.css';
const initialLogin={name:'',email:'',password:'',account_type:'enterprise'};
const blankCompany={workspace_id:'',logo_data:'',name:'',address:'',commercial_registration:'',tax_number:'',phone:'',mobile:'',website:'',emails:'',activity:''};
const documentMimeByExtension=Object.freeze({pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',md:'text/markdown',csv:'text/csv',json:'application/json',rtf:'application/rtf'});
const maxDocumentSize=1572864,maxDocumentTotal=2621440,maxDocuments=2;
const welcomeText={ar:'كيف أقدر أساعدك اليوم؟',en:'How can I help you today?'};
function RawiGreeting({lang,customText=''}){
 const text=customText||welcomeText[lang==='en'?'en':'ar'];
 const [visible,setVisible]=useState('');
 useEffect(()=>{
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){setVisible(text);return}
  setVisible('');let index=0;
  const timer=window.setInterval(()=>{index++;setVisible(text.slice(0,index));if(index>=text.length)window.clearInterval(timer)},55);
  return()=>window.clearInterval(timer);
 },[text]);
 return <article className="mif-bubble assistant mif-welcome-message"><img src="/rawi-erp-mark.svg" alt={lang==='ar'?'نظام راوي':'Rawi ERP'}/><div><p aria-label={text}><span aria-hidden="true">{visible}</span><span className="mif-writing-caret" aria-hidden="true"/></p></div></article>
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
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true),[tab,setTab]=useState('new'),[signup,setSignup]=useState(false),[form,setForm]=useState(initialLogin),[authError,setAuthError]=useState(''),[authBusy,setAuthBusy]=useState(false),[signupStep,setSignupStep]=useState('auth'),[verificationCode,setVerificationCode]=useState(''),[company,setCompany]=useState(blankCompany),[companyBusy,setCompanyBusy]=useState(false),[companyError,setCompanyError]=useState(''),[discovery,setDiscovery]=useState(null);
 const [workspaces,setWorkspaces]=useState([]),[workspaceId,setWorkspaceId]=useState('');
 const [registrationEnabled,setRegistrationEnabled]=useState(null),[subscriptions,setSubscriptions]=useState([]);
 const [tenantSetup,setTenantSetup]=useState(null),[tenantGeneration,setTenantGeneration]=useState(0);
 const [threads,setThreads]=useState([]),[active,setActive]=useState(''),[messages,setMessages]=useState([]),[question,setQuestion]=useState(''),[asking,setAsking]=useState(false),[chatError,setChatError]=useState(''),[documents,setDocuments]=useState([]),[filesBusy,setFilesBusy]=useState(false),[recording,setRecording]=useState(false),[transcribing,setTranscribing]=useState(false);
 const [installPrompt,setInstallPrompt]=useState(null),[installOpen,setInstallOpen]=useState(false),[installing,setInstalling]=useState(false),[installed,setInstalled]=useState(isInstalled);
 const [integrationOpen,setIntegrationOpen]=useState(false),[notice,setNotice]=useState('');
 const areaRef=useRef(null),questionRef=useRef(null),requestRef=useRef(null),fileRef=useRef(null),speechRef=useRef(null),recorderRef=useRef(null),recordTimeoutRef=useRef(null);
 const device=useMemo(platform,[]),authed=!!session;
 const refreshSession=useCallback(async()=>{try{const r=await api('/api/admin/me');setSession(r);if(r.company_setup_required){setSignupStep('company');setTab('company')}return true}catch{setSession(null);return false}finally{setChecking(false)}},[]);
 useEffect(()=>{if(signupStep!=='company'||!authed)return;
  api('/api/admin/company/setup').then(r=>{if(r.data)setCompany(old=>({...old,...r.data,workspace_id:r.data.workspace_id,name:r.data.name||''}))}).catch(()=>setCompanyError(L('تعذر تحميل بيانات الشركة','Could not load company details')))
 },[signupStep,authed]);
 
 // A company is registered first. Rawi learns the business from the first private chat.
 useEffect(()=>{
  if(!authed||!workspaceId||session?.company_setup_required){setDiscovery(null);return}
  let active=true;
  api('/api/admin/company/discovery/'+encodeURIComponent(workspaceId)+'?language='+lang)
   .then(r=>{if(active)setDiscovery(r.completed?null:{...r,workspace_id:workspaceId})})
   .catch(()=>{if(active)setDiscovery(null)});
  return()=>{active=false};
 },[authed,workspaceId,session?.company_setup_required,lang]);
 useEffect(()=>{api('/api/public/rawi/status').then(x=>setRegistrationEnabled(!!x.registration_enabled)).catch(()=>setRegistrationEnabled(false))},[]);
 useEffect(()=>{if(!authed){setSubscriptions([]);return}api('/api/admin/my-subscription').then(x=>setSubscriptions(x.data||[])).catch(()=>setSubscriptions([]))},[authed,session?.email]);
 useEffect(()=>{refreshSession();const before=e=>{e.preventDefault();setInstallPrompt(e);setInstalled(false)};const onInstalled=()=>{setInstallPrompt(null);setInstallOpen(false);setInstalled(true);try{window.localStorage.setItem('rawi-erp-installed','1')}catch{}};const display=window.matchMedia('(display-mode: standalone)');const onDisplay=()=>{if(display.matches)setInstalled(true)};display.addEventListener?.('change',onDisplay);window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',onInstalled);return()=>{display.removeEventListener?.('change',onDisplay);window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',onInstalled)}},[refreshSession]);
 useEffect(()=>{if(!authed){setWorkspaces([]);setWorkspaceId('');return}api('/api/admin/erp/workspaces').then(r=>{const list=r.data||[];setWorkspaces(list);setWorkspaceId(prev=>list.some(w=>w.id===prev)?prev:(list[0]?.id||''))}).catch(()=>setWorkspaces([]))},[authed,tenantGeneration,session?.company_setup_required]);
 useEffect(()=>{
  // Company details must be saved before tenant provisioning is permitted.
  if(!authed||session?.company_setup_required){setTenantSetup(null);return}
  let active=true,timer;
  const run=async()=>{
   try{
    const state=await api('/api/admin/tenant/status');
    const pending=(state.data||[]).find(x=>x.status!=='ready');
    if(!active)return;
    if(!pending){setTenantSetup(null);return}
    for(let attempt=0;attempt<12&&active;attempt++){
     setTenantSetup({status:'migrating',step:attempt+1});
     try{
      const next=await api('/api/admin/tenant/initialize',{method:'POST',body:'{}'});
      if(!active)return;
      if(next.status==='ready'){setTenantSetup(null);setTenantGeneration(n=>n+1);return}
     }catch(e){if(!active)return;if(!/already running/i.test(e.message))throw e}
     await new Promise(resolve=>{timer=setTimeout(resolve,650)});
    }
    if(active)setTenantSetup({status:'pending',error:L('إعداد قاعدة الشركة لم يكتمل؛ اضغط إعادة المحاولة','Company database setup is incomplete; press retry')});
   }catch(e){if(active)setTenantSetup({status:'failed',error:e.message})}
  };
  run();return()=>{active=false;clearTimeout(timer)};
 },[authed,session?.email,session?.company_setup_required,tenantGeneration]);
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
 const selectTab=key=>{if(session?.company_setup_required){navigate('company');return}if(key==='new'){startNew();return}navigate(key)};
 const startNew=()=>{if(requestRef.current)requestRef.current.abort();requestRef.current=null;setAsking(false);setActive('');setMessages([]);setQuestion('');setDocuments([]);setChatError('');navigate('new')};
 const openThread=async id=>{if(!authed)return;if(requestRef.current)requestRef.current.abort();requestRef.current=null;setAsking(false);setActive('');setMessages([]);setQuestion('');navigate('thread');try{const r=await api('/api/admin/chat/threads/'+encodeURIComponent(id));setActive(id);setMessages(r.data||[])}catch(e){setChatError(e.message)}};
 const submitAuth=async e=>{e.preventDefault();setAuthBusy(true);setAuthError('');try{
  if(signup){if(registrationEnabled===false)throw new Error(L('التسجيل غير متاح الآن. يرجى التواصل مع الإدارة.','Registration is currently closed. Contact the platform operator.'));
   const result=await api('/api/admin/register',{method:'POST',body:JSON.stringify({...form,language:lang})});
   if(!result.verification_required)throw new Error(L('لم يتم بدء التحقق من البريد','Email verification could not be started'));
   setSignupStep('verify');setVerificationCode('');return;
  }
  await api('/api/admin/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})});
  if(!await refreshSession())throw new Error(L('تعذر بدء الجلسة، حاول مرة أخرى.','Could not start a session. Try again.'));
  setForm(initialLogin);setSignup(false);
 }catch(e){setAuthError(e.message)}finally{setAuthBusy(false)}};
 const confirmEmail=async e=>{e.preventDefault();setAuthBusy(true);setAuthError('');try{
  const result=await api('/api/admin/verify-email',{method:'POST',body:JSON.stringify({email:form.email,code:verificationCode})});
  if(!result.company_setup_required)throw new Error(L('تعذر التحقق من الحساب','Account verification failed'));
  setCompany({...blankCompany,workspace_id:result.workspace_id});
  setSignupStep('company');setForm(initialLogin);setSignup(false);
  await refreshSession();navigate('company');
 }catch(e){setAuthError(e.message)}finally{setAuthBusy(false)}};
 const resendCode=async()=>{setAuthBusy(true);setAuthError('');try{await api('/api/admin/register',{method:'POST',body:JSON.stringify({...form,language:lang})})}catch(e){setAuthError(e.message)}finally{setAuthBusy(false)}};
 const submitCompany=async e=>{e.preventDefault();setCompanyBusy(true);setCompanyError('');try{
  await api('/api/admin/company/complete',{method:'POST',body:JSON.stringify(company)});
  const ok=await refreshSession();if(!ok)throw new Error(L('تعذر تحديث الجلسة','Could not refresh session'));
  setWorkspaceId(company.workspace_id);
  setWorkspaces(old=>old.some(w=>w.id===company.workspace_id)?old:[...old,{id:company.workspace_id,name:company.name,role:'owner'}]);
  setSignupStep('auth');startNew();
 }catch(e){setCompanyError(e.message)}finally{setCompanyBusy(false)}};
 const selectCompanyLogo=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>175000){setCompanyError(L('الشعار يجب أن يكون PNG أو JPG أو WebP وأقل من 175 كيلوبايت.','Use a PNG, JPG or WebP logo under 175 KB.'));return}
  const reader=new FileReader();reader.onload=()=>setCompany(v=>({...v,logo_data:String(reader.result||'')}));reader.onerror=()=>setCompanyError(L('تعذر قراءة الشعار','Could not read logo'));reader.readAsDataURL(file);
 };
 const logout=async()=>{try{await api('/api/admin/logout',{method:'POST'})}catch{}setSession(null);setSignupStep('auth');startNew();setThreads([]);setIntegrationOpen(false)};
 const ask=async e=>{
  e?.preventDefault?.();const text=question.trim()||(documents.length?L('حلل المستندات المرفقة','Analyze the attached documents'):'');if(!text||asking||filesBusy||text.length>2500)return;
  const pendingDocs=documents.map(({name,mime_type,data})=>({name,mime_type,data}));
  const privateChat=authed&&!!workspaceId;
  if(tab!=='new'&&tab!=='thread')return;
  // Server validates tenant readiness; stale progress indicators must not block chat.
  if(authed&&!workspaceId){setChatError(L('مساحة الشركة قيد التجهيز. انتظر اكتمال قاعدة البيانات في أعلى الشاشة.','Your company workspace is being prepared. Wait for database setup at the top.'));return}
  setQuestion('');setDocuments([]);if(questionRef.current)questionRef.current.style.height='auto';setChatError('');setAsking(true);setMessages(m=>[...m,{role:'user',content:text+(pendingDocs.length?'\n📎 '+pendingDocs.map(d=>d.name).join('، '):''),at:new Date().toISOString()}]);
  const ctl=new AbortController();requestRef.current=ctl;
  try{
   const endpoint=privateChat?'/api/admin/chat/send':'/api/chat/public';
   const history=messages.slice(-12).filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:String(m.content).slice(0,2500)}));
   const r=await api(endpoint,{method:'POST',signal:ctl.signal,body:JSON.stringify(privateChat?{thread_id:active||null,workspace_id:workspaceId,question:text,documents:pendingDocs}:{question:text,history,documents:pendingDocs}),headers:{'Accept-Language':lang}});
   if(ctl.signal.aborted)return;
   if(privateChat&&r.thread_id){setActive(r.thread_id);api('/api/admin/chat/threads?workspace_id='+encodeURIComponent(workspaceId)).then(t=>setThreads(t.data||[])).catch(()=>{})}
   if(r.discovery_stage){setDiscovery(previous=>r.discovery_stage==='completed'?null:{...(previous||{}),workspace_id:workspaceId,stage:r.discovery_stage})}
   setMessages(m=>[...m,{role:'assistant',content:r.answer,sources:r.sources||[],at:new Date().toISOString()}]);
  }catch(err){if(ctl.signal.aborted)return;setMessages(m=>m.slice(0,-1));setQuestion(question.trim());setDocuments(pendingDocs);setChatError(err.message)}finally{setAsking(false);requestRef.current=null}
 };
 const addDocuments=async event=>{
  const files=Array.from(event.target.files||[]);event.target.value='';
  if(!files.length)return;
  setChatError('');setFilesBusy(true);
  try{
   if(documents.length+files.length>maxDocuments)throw new Error(L('الحد الأقصى مرفقان لكل رسالة.','You can attach up to two files per message.'));
   let bytes=documents.reduce((total,doc)=>total+doc.size,0);const batch=[];
   for(const file of files){
    const name=file.name.slice(0,120),extension=name.split('.').pop()?.toLowerCase(),mime_type=documentMimeByExtension[extension];
    if(!mime_type||file.name.length>120)throw new Error(L('نوع الملف غير مدعوم.','Unsupported document format.'));
    if(file.size<1||file.size>maxDocumentSize||bytes+file.size>maxDocumentTotal)throw new Error(L('حجم المستندات كبير. الحد 1.5 ميجابايت للملف و2.5 ميجابايت للإجمالي.','Documents are limited to 1.5 MB each and 2.5 MB total.'));
    const raw=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Could not read document'));reader.readAsDataURL(file)});
    const encoded=raw.slice(raw.indexOf(',')+1);if(!encoded)throw new Error(L('تعذر قراءة الملف.','Could not read document.'));
    batch.push({name,mime_type,data:'data:'+mime_type+';base64,'+encoded,size:file.size});bytes+=file.size;
   }
   setDocuments(old=>[...old,...batch]);
  }catch(error){setChatError(error.message)}finally{setFilesBusy(false)}
 };
 const appendTranscript=text=>setQuestion(old=>(old.trim()?old.trim()+' ':'')+text);
 const toggleMicrophone=async()=>{
  if(recording){
   if(speechRef.current){speechRef.current.stop();return}
   if(recorderRef.current?.state==='recording'){recorderRef.current.stop();return}
  }
  setChatError('');
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(Recognition){
   try{
    const speech=new Recognition();speech.lang=lang==='ar'?'ar-SA':'en-US';speech.interimResults=false;speech.continuous=false;
    speech.onresult=event=>{const transcript=Array.from(event.results).map(result=>result[0]?.transcript||'').join(' ').trim();if(transcript)appendTranscript(transcript)};
    speech.onerror=event=>{if(event.error!=='aborted'&&event.error!=='no-speech')setChatError(L('تعذر التعرف على الصوت. تحقق من إذن الميكروفون.','Could not recognize speech. Check microphone permission.'))};
    speech.onend=()=>{speechRef.current=null;setRecording(false)};
    speechRef.current=speech;speech.start();setRecording(true);return;
   }catch{speechRef.current=null;setRecording(false)}
  }
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setChatError(L('الميكروفون غير متاح في هذا المتصفح.','Microphone recording is not supported by this browser.'));return}
  let stream;
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:true});
   const types=['audio/webm;codecs=opus','audio/mp4','audio/ogg'];
   const type=types.find(t=>MediaRecorder.isTypeSupported?.(t));
   const recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined),chunks=[];
   recorderRef.current=recorder;
   recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
   recorder.onerror=()=>setChatError(L('تعذر تسجيل الصوت.','Audio recording failed.'));
   recorder.onstop=async()=>{
    if(recordTimeoutRef.current)window.clearTimeout(recordTimeoutRef.current);
    recorderRef.current=null;stream.getTracks().forEach(track=>track.stop());setRecording(false);
    if(!chunks.length)return;
    const audio=new Blob(chunks,{type:recorder.mimeType||type||'audio/webm'});
    if(audio.size>1500000){setChatError(L('التسجيل كبير جدًا.','The recording is too large.'));return}
    setTranscribing(true);
    try{
     const formData=new FormData();formData.append('audio',audio,'voice.webm');
     const response=await fetch('/api/chat/transcribe',{method:'POST',credentials:'same-origin',body:formData});
     const result=await response.json();if(!response.ok)throw new Error(result.error||'Speech transcription failed');
     if(result.text)appendTranscript(String(result.text).slice(0,2500));
    }catch(error){setChatError(error.message)}finally{setTranscribing(false)}
   };
   recorder.start();setRecording(true);
   recordTimeoutRef.current=window.setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},25000);
  }catch(error){stream?.getTracks().forEach(track=>track.stop());setRecording(false);setChatError(L('لا يمكن استخدام الميكروفون. تحقق من أذونات المتصفح.','Microphone access is unavailable. Check browser permissions.'))}
 };
 const install=async()=>{if(installed)return;if(installPrompt){setInstalling(true);try{await installPrompt.prompt();const result=await installPrompt.userChoice;if(result?.outcome==='accepted'){setInstalled(true);try{window.localStorage.setItem('rawi-erp-installed','1')}catch{}}setInstallPrompt(null);setInstallOpen(false)}finally{setInstalling(false)}}else setInstallOpen(true)};
 const deleteThread=async id=>{if(!authed)return;try{await api('/api/admin/chat/threads/'+encodeURIComponent(id),{method:'DELETE'});setThreads(t=>t.filter(x=>x.id!==id));if(id===active)startNew()}catch(e){setNotice(e.message)}};
const authPanel=<section className="mif-login-page rawi-login-compact" aria-label={L('الدخول أو إنشاء حساب','Sign in or sign up')}>
  <div className="rawi-auth-heading"><img src="/rawi-erp-mark.svg" alt="" width="32" height="32" style={{width:32,height:32,maxWidth:32,maxHeight:32,flex:"0 0 32px"}}/><strong>{signupStep==='verify'?L('تأكيد البريد الإلكتروني','Verify your email'):signup?L('إنشاء حساب جديد','Create account'):L('تسجيل الدخول','Sign in')}</strong></div>
  {signupStep==='verify'?<>
   <p className="rawi-verify-help">{L('أرسلنا رمزًا مكونًا من 6 أرقام إلى','A six-digit code was sent to')} <b dir="ltr">{form.email}</b></p>
   <form className="rawi-account-form" onSubmit={confirmEmail}>
    <label>{L('رمز التأكيد','Verification code')}<input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={e=>setVerificationCode(e.target.value.replace(/[^0-9]/g,''))}/></label>
    {authError&&<p role="alert" className="mif-form-error">{authError}</p>}
    <button type="submit" disabled={authBusy||verificationCode.length!==6}>{L('تأكيد البريد','Verify email')}</button>
   </form>
   <button type="button" className="rawi-resend" disabled={authBusy} onClick={resendCode}>{L('إعادة إرسال الرمز','Resend code')}</button>
   <button type="button" className="rawi-resend" onClick={()=>{setSignupStep('auth');setAuthError('')}}>{L('تعديل البريد','Change email')}</button>
  </>:<>
   <div className="rawi-auth-tabs" role="group" aria-label={L('الحساب','Account')}>
    <button type="button" className={!signup?'selected':''} aria-pressed={!signup} onClick={()=>{setSignup(false);setAuthError('')}}>{L('دخول','Sign in')}</button>
    <button type="button" className={signup?'selected':''} aria-pressed={signup} onClick={()=>{setSignup(true);setAuthError('')}}>{L('حساب جديد','New account')}</button>
   </div>
   <form className="rawi-account-form" onSubmit={submitAuth}>
    {signup&&<label>{L('الاسم','Name')}<input required autoComplete="name" minLength={2} maxLength={160} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label>}
    <label>{L('البريد الإلكتروني','Email')}<input type="email" autoComplete="username" inputMode="email" required value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))}/></label>
    <label>{L('كلمة المرور','Password')}<input type="password" autoComplete={signup?'new-password':'current-password'} minLength={signup?12:1} required value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))}/></label>
    {authError&&<p role="alert" className="mif-form-error">{authError}</p>}
    {signup&&registrationEnabled===false&&<p className="rawi-signup-unavailable">{L('إنشاء الحسابات متوقف مؤقتًا حتى يتم تفعيل إرسال رموز البريد الإلكتروني.','Sign-up is temporarily unavailable until verification email delivery is configured.')}</p>}
    <button type="submit" disabled={authBusy||(signup&&registrationEnabled===false)}>{authBusy&&<Loader2 size={17} className="mif-spinner"/>}{signup?L('إرسال رمز التأكيد','Send verification code'):L('تسجيل الدخول','Sign in')}</button>
   </form>
  </>}
 </section>;
 return <div className="mif-app" dir={lang==='ar'?'rtl':'ltr'}>
  <main className={'mif-body mif-body-'+((tab==='new'||tab==='thread')?'chats':tab)+(!authed&&!checking&&protectedTabs.includes(tab)?' mif-body-auth':'')}>
   {(tab==='new'||tab==='thread')&&<section className="mif-chat-page">
    <div className="rawi-chat-tools rawi-enterprise-tools">
     {tenantSetup&&<span role="status" className="rawi-setup-state">{tenantSetup.status==='failed'?L('تعذر إعداد مساحة الشركة','Company setup failed'):tenantSetup.status==='pending'?L('إعداد مساحة الشركة مستمر','Company setup pending'):L('جاري إعداد مساحة الشركة','Preparing company workspace')} {tenantSetup.step||''}{tenantSetup.error&&<span title={tenantSetup.error}> · {tenantSetup.error.slice(0,100)}</span>}{tenantSetup.status!=='migrating'&&<button type="button" onClick={()=>setTenantGeneration(n=>n+1)}>{L('إعادة المحاولة','Retry')}</button>}</span>}
     {authed&&<span className="rawi-identity-label" title={session?.email}>{workspaces.find(w=>w.id===workspaceId)?.name||session?.email}</span>}
     {!installed&&<button type="button" className="rawi-install-in-account rawi-install-mini" onClick={install} aria-label={L('تنزيل التطبيق','Install app')}><Download size={13}/>{L('تنزيل','Install')}</button>}
    </div>
    <div className={'mif-chat-scroll'+(!messages.length?' is-empty':'')} ref={areaRef} aria-live="polite">
     {!messages.length?<RawiGreeting lang={lang} customText={authed&&discovery?.workspace_id===workspaceId?discovery.greeting:''}/>:<div className="mif-chat-messages">{messages.map((m,i)=><article className={'mif-bubble '+m.role} key={i}>{m.role==='assistant'&&<img src="/rawi-erp-mark.svg" alt={L('نظام راوي','Rawi ERP')}/>}<div><p>{m.content}</p>{Array.isArray(m.sources)&&m.sources.length>0&&<div className="rawi-answer-sources">{m.sources.map((source,index)=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" title={source.summary||''}>{index+1}. {source.title}</a>)}</div>}</div></article>)}{asking&&<div className="mif-typing"><img src="/rawi-erp-mark.svg" alt={L('نظام راوي','Rawi ERP')}/><Loader2 className="mif-spinner" size={17}/></div>}</div>}
     {chatError&&<div className="mif-chat-error" role="alert">{chatError}</div>}
    </div>
    <form className="mif-composer" onSubmit={ask}>
     <div className="mif-composer-field">
      {documents.length>0&&<div className="rawi-chat-files">{documents.map((file,index)=><span className="rawi-chat-file" key={file.name+'-'+index}><FileText size={15}/><span title={file.name}>{file.name}</span><button type="button" onClick={()=>setDocuments(old=>old.filter((_,i)=>i!==index))} aria-label={L('إزالة المرفق','Remove attachment')}><X size={14}/></button></span>)}</div>}
      <textarea ref={questionRef} rows={1} aria-label={L('رسالتك إلى نظام راوي','Message Rawi ERP')} value={question} placeholder={L('اسأل نظام راوي...','Ask Rawi ERP...')} onChange={e=>setQuestion(e.target.value)} onInput={e=>{const node=e.currentTarget;node.style.height='auto';node.style.height=Math.min(node.scrollHeight,150)+'px'}} maxLength={2500} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent?.isComposing&&e.keyCode!==229){e.preventDefault();ask()}}}/>
      <div className="rawi-composer-toolbar">
       <input ref={fileRef} type="file" className="rawi-file-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.rtf" multiple aria-label={L('اختيار المستندات','Choose documents')} onChange={addDocuments}/>
       <button type="button" className="rawi-composer-tool" title={L('إرفاق مستند','Attach documents')} aria-label={L('إرفاق مستند','Attach documents')} disabled={filesBusy||asking||documents.length>=maxDocuments} onClick={()=>fileRef.current?.click()}>{filesBusy?<Loader2 size={19} className="mif-spinner"/>:<Paperclip size={19}/>}</button>
       <button type="button" className={'rawi-composer-tool'+(recording?' is-recording':'')} title={recording?L('إيقاف التسجيل','Stop recording'):L('إملاء صوتي','Voice dictation')} aria-label={recording?L('إيقاف التسجيل','Stop recording'):L('إملاء صوتي','Voice dictation')} aria-pressed={recording} disabled={transcribing||asking} onClick={toggleMicrophone}>{transcribing?<Loader2 size={19} className="mif-spinner"/>:recording?<Square size={17}/>:<Mic size={19}/>}</button>
       {authed&&workspaces.length>0&&<label className="rawi-composer-company"><Building2 size={15}/><select aria-label={L('الشركة','Company')} title={L('الشركة','Company')} value={workspaceId} onChange={e=>{if(requestRef.current)requestRef.current.abort();setWorkspaceId(e.target.value);setActive('');setMessages([]);setChatError('');navigate('new')}}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
       <button type="submit" className="rawi-send" aria-label={L('إرسال','Send')} disabled={asking||filesBusy||transcribing||(!question.trim()&&!documents.length)}>{asking?<Loader2 size={18} className="mif-spinner"/>:<ArrowUp size={19} strokeWidth={2.5}/>}</button>
      </div>
     </div>

    </form>

   </section>}
   {tab==='company'&&authed&&session?.company_setup_required&&<section className="rawi-company-setup" aria-label={L('بيانات الشركة','Company details')}>
    <div className="rawi-company-head"><img src="/rawi-erp-mark.svg" alt=""/><div><h1>{L('إعداد الشركة','Set up your company')}</h1><p>{L('أكمل بيانات الشركة للبدء باستخدام نظام راوي.','Complete company details to start using Rawi ERP.')}</p></div></div>
    <form className="rawi-company-form" onSubmit={submitCompany}>
     <label className="rawi-company-logo">{company.logo_data?<img src={company.logo_data} alt={L('شعار الشركة','Company logo')}/>:<Building2 size={31}/>}<span>{L('شعار الشركة','Company logo')}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectCompanyLogo}/></label>
     <div className="rawi-company-grid">
      <label>{L('اسم الشركة','Company name')}<input required maxLength={150} value={company.name} onChange={e=>setCompany(v=>({...v,name:e.target.value}))}/></label>
      <label>{L('النشاط','Business activity')}<input required maxLength={200} value={company.activity} onChange={e=>setCompany(v=>({...v,activity:e.target.value}))}/></label>
      <label className="rawi-company-wide">{L('العنوان','Address')}<input required minLength={5} maxLength={450} value={company.address} onChange={e=>setCompany(v=>({...v,address:e.target.value}))}/></label>
      <label>{L('السجل التجاري','Commercial registration')}<input maxLength={50} value={company.commercial_registration} onChange={e=>setCompany(v=>({...v,commercial_registration:e.target.value}))}/></label>
      <label>{L('الرقم الضريبي','Tax number')}<input maxLength={50} value={company.tax_number} onChange={e=>setCompany(v=>({...v,tax_number:e.target.value}))}/></label>
      <label>{L('رقم الهاتف','Phone number')}<input type="tel" maxLength={35} value={company.phone} onChange={e=>setCompany(v=>({...v,phone:e.target.value}))}/></label>
      <label>{L('رقم الجوال','Mobile number')}<input type="tel" maxLength={35} value={company.mobile} onChange={e=>setCompany(v=>({...v,mobile:e.target.value}))}/></label>
      <label>{L('الموقع الإلكتروني','Website')}<input type="url" placeholder="https://" value={company.website} onChange={e=>setCompany(v=>({...v,website:e.target.value}))}/></label>
      <label>{L('إيميلات التواصل','Contact emails')}<input maxLength={450} placeholder={L('افصل بينها بفاصلة','Separate with commas')} value={company.emails} onChange={e=>setCompany(v=>({...v,emails:e.target.value}))}/></label>
      
     </div>
     {companyError&&<p role="alert" className="mif-form-error">{companyError}</p>}
     <button type="submit" disabled={companyBusy||!company.workspace_id}>{companyBusy?<Loader2 className="mif-spinner" size={17}/>:<Check size={18}/>} {L('حفظ وبدء استخدام النظام','Save and start using Rawi ERP')}</button>
    </form>
   </section>}
   {tab==='chats'&&authed&&<section className="mif-chats-history" aria-label={L('سجل المحادثات','Conversation history')}>
    <div className="mif-chats-history-heading"><MessageCircle size={22}/><h1>{L('المحادثات','Conversations')}</h1><span>{threads.length}</span></div>
    {workspaces.length>1&&<label className="rawi-workspace-picker">{L('المؤسسة','Organization')}<select value={workspaceId} onChange={e=>{setWorkspaceId(e.target.value);setThreads([])}}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
    <div className="mif-chats-history-list">
     {threads.length?threads.map(t=><article className="mif-history-item" key={t.id}><button onClick={()=>openThread(t.id)}><MessageCircle size={17}/><span>{t.title}</span></button><button title={L('حذف المحادثة','Delete chat')} aria-label={L('حذف المحادثة','Delete chat')} onClick={()=>deleteThread(t.id)}><Trash2 size={17}/></button></article>):<p className="mif-chats-empty">{L('لا توجد محادثات محفوظة بعد.','No saved conversations yet.')}</p>}
    </div>
   </section>}
   {!checking&&!authed&&protectedTabs.includes(tab)&&<div className="mif-protected-auth">{authPanel}</div>}
   {tab==='operations'&&!checking&&authed&&<RawiGeneratedWorkspace onOpenThread={openThread} onNewChat={startNew}/>}
   {tab==='integrations'&&!checking&&authed&&<AiErpWorkspace mode="integrations" notify={setNotice}/>}
   {tab==='schedule'&&!checking&&authed&&<MifSchedule notify={setNotice}/>}
   {tab==='team'&&!checking&&authed&&<RawiTeamPanel workspaceId={workspaceId} workspace={workspaces.find(w=>w.id===workspaceId)} notify={setNotice}/>}
   {tab==='alerts'&&!checking&&authed&&<RawiNotificationsPanel workspaceId={workspaceId} onSchedule={()=>navigate('schedule')}/>}
   {tab==='account'&&!checking&&authed&&<RawiCustomerAccount installed={installed} onLogout={logout} onInstall={install}/>}



  </main>
  <nav className="mif-bottom-nav" aria-label={L('التنقل الرئيسي','Main navigation')}>{nav.map(([id,ar,en,Icon])=><button key={id} onClick={()=>selectTab(id)} aria-label={L(ar,en)} aria-current={(tab===id||(tab==='thread'&&id==='chats'))?'page':undefined} className={'mif-bottom-item '+((tab===id||(tab==='thread'&&id==='chats'))?'active ':'')+(id==='new'?'new':'')}><span className="mif-bottom-icon"><Icon size={id==='new'?29:23} strokeWidth={id==='new'?2.6:1.9}/></span><span className="mif-bottom-label">{L(ar,en)}</span></button>)}</nav>
  {installOpen&&<div className="mif-dialog-wrap" onMouseDown={e=>{if(e.target===e.currentTarget)setInstallOpen(false)}}><section className="mif-dialog mif-install-dialog" role="dialog" aria-modal="true"><button className="mif-close" onClick={()=>setInstallOpen(false)}><X size={19}/></button>{device.kind==='desktop'?<Monitor size={33}/>:<Smartphone size={33}/>}<h2>{L('تثبيت نظام راوي','Install Rawi ERP')}</h2><p>{device.kind==='ios'?L('على iPhone أو iPad: اضغط زر مشاركة في Safari، ثم «إضافة إلى الشاشة الرئيسية».','On iPhone or iPad, open in Safari, choose Share, then Add to Home Screen.'):device.kind==='android'?L('من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة للشاشة الرئيسية».','In your browser menu choose Install app or Add to Home Screen.'):device.kind==='desktop'?L('افتح التطبيق في Chrome أو Edge، ثم اختر «تثبيت RAWI».','In Chrome or Edge, choose Install RAWI.'):L('استخدم خيار تثبيت التطبيق من قائمة المتصفح، إن كان متاحًا.','Use your browser Install app option if available.')}</p><small>{L('التثبيت من المتصفح متاح على الأجهزة المدعومة. نسخ المتاجر الأصلية لا تظهر حتى تصبح جاهزة وموقعة.','Browser installation is available on supported devices. Native store packages appear only after they are built and signed.')}</small></section></div>}
  {integrationOpen&&authed&&<div className="mif-dialog-wrap" onMouseDown={e=>{if(e.target===e.currentTarget)setIntegrationOpen(false)}}><section className="mif-dialog mif-integration-dialog" role="dialog" aria-modal="true"><button className="mif-close" onClick={()=>setIntegrationOpen(false)}><X size={19}/></button><PlugZap size={29}/><h2>{L('التكاملات','Integrations')}</h2><p>{L('ربط الأنظمة الخارجية بحسابك يحتاج صلاحيات ومفاتيح معتمدة. إعداد الذكاء الاصطناعي تديره MIF Smart مركزيًا.','Connect external systems with authorized credentials. MIF Smart manages its AI service centrally.')}</p><button onClick={()=>{setIntegrationOpen(false);navigate('operations');setNotice(L('افتح قسم التكاملات داخل العمليات لإعداد الربط.','Open the Integrations section under Operations.'))}}>{L('إدارة التكاملات','Manage integrations')}</button></section></div>}
  {notice&&<button className="mif-toast" onClick={()=>setNotice('')}>{notice}<X size={14}/></button>}
 </div>;
}
