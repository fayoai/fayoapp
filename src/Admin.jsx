import React,{useEffect,useState} from 'react';
import {BrainCircuit,LogOut,Languages,LockKeyhole,ShieldCheck,ArrowUpLeft,Menu,X} from 'lucide-react';
import {api,useSite,tr} from './App.jsx';
import AiErpWorkspace from './AiErpWorkspace.jsx';
import './erp-shell.css';
function Login({onSuccess}){
 const {lang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[setup,setSetup]=useState(false),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const submit=async e=>{e.preventDefault();setMessage('');setBusy(true);try{
  if(setup){await api('/api/admin/bootstrap',{method:'POST',body:JSON.stringify({email,password,token})});setSetup(false);setPassword('');setToken('');setMessage(L('تم إنشاء المدير. سجّل الدخول الآن.','Administrator created. Please sign in.'))}
  else{await api('/api/admin/login',{method:'POST',body:JSON.stringify({email,password})});onSuccess()}
 }catch(err){setMessage(err.message)}finally{setBusy(false)}};
 return <div className="mif-auth"><div className="mif-auth-card"><div className="mif-auth-mark"><img src="/mif-symbol.png" alt="MIF Smart"/><span>MIF SMART <b>AI ERP</b></span></div><div className="mif-auth-orbit"><BrainCircuit size={42}/></div><h1>{setup?L('تهيئة مدير النظام','Administrator setup'):L('إدارة أعمالك تبدأ من هنا','Your business starts here')}</h1><p>{L('كل إدارات مؤسستك في مساحة عمل واحدة يقودها الذكاء الاصطناعي.','One AI-native workspace for your entire organization.')}</p><form onSubmit={submit}><label>{L('البريد الإلكتروني','Email')}<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>{L('كلمة المرور','Password')}<input type="password" required minLength={setup?12:1} autoComplete={setup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>{setup&&<label>{L('رمز إنشاء المدير','Administrator bootstrap token')}<input type="password" required value={token} onChange={e=>setToken(e.target.value)} autoComplete="off"/></label>}<button disabled={busy} type="submit"><LockKeyhole size={16}/>{setup?L('إنشاء المدير','Create administrator'):L('الدخول إلى AI ERP','Sign in to AI ERP')}<ArrowUpLeft size={16}/></button></form>{message&&<p className="mif-auth-error" role="alert">{message}</p>}<button className="mif-auth-setup" onClick={()=>{setSetup(!setup);setMessage('')}}>{setup?L('العودة لتسجيل الدخول','Back to sign in'):L('إعداد المدير الأول','First administrator setup')}</button><small><ShieldCheck size={13}/>{L('الاتصال والبيانات محميان بصلاحيات مساحة العمل','Workspace-secured access')}</small></div></div>;
}
export default function Admin(){
 const {lang,setLang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [user,setUser]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[menu,setMenu]=useState(false);
 const check=()=>api('/api/admin/me').then(()=>setUser(true)).catch(()=>setUser(false)).finally(()=>setLoading(false));
 useEffect(()=>{check()},[]);
 const logout=async()=>{try{await api('/api/admin/logout',{method:'POST'})}catch{}setUser(false)};
 if(loading)return <div className="mif-startup"><img src="/mif-symbol.png" alt=""/><BrainCircuit size={24}/></div>;
 if(!user)return <Login onSuccess={check}/>;
 return <div className="mif-erp-app"><header className="mif-erp-bar"><div className="mif-erp-brand"><img src="/mif-symbol.png" alt=""/><div><strong>MIF Smart <em>AI ERP</em></strong><small>{L('نظام إدارة الأعمال الذكي','Intelligent business operating system')}</small></div></div><div className="mif-erp-toolbar"><button title={L('تغيير اللغة','Language')} onClick={()=>setLang(lang==='ar'?'en':'ar')}><Languages size={18}/><span>{lang==='ar'?'EN':'عربي'}</span></button><button title={L('تسجيل الخروج','Sign out')} onClick={logout}><LogOut size={18}/><span>{L('خروج','Sign out')}</span></button></div></header><main className="mif-erp-main"><AiErpWorkspace notify={setNotice}/></main>{notice&&<div className="mif-notice" role="status" onClick={()=>setNotice('')}>{notice} <X size={14}/></div>}</div>;
}
