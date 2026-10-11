import React,{useState} from 'react';
import {api,useSite,tr} from './App.jsx';
export default function MifOwnerSetup(){
 const {lang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [form,setForm]=useState({email:'',password:'',token:''}),[pending,setPending]=useState(false),[error,setError]=useState('');
 const submit=async e=>{
  e.preventDefault();setPending(true);setError('');
  try{
   await api('/api/admin/bootstrap',{method:'POST',body:JSON.stringify(form)});
   await api('/api/admin/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})});
   window.location.replace('/mif/console');
  }catch(e){setError(e.message||'Unable to create platform owner')}finally{setPending(false)}
 };
 return <section className="mif-company-login">
  <img src="/mif-logo.svg" alt="MIF Smart"/>
  <h1>{L('تهيئة مالك منصة MIF Smart','Initialize the MIF Smart platform owner')}</h1>
  <p>{L('للتهيئة الأولى فقط. استخدم بريد مدير المنصة ورمز التهيئة السري المحفوظ في Cloudflare، وليس مفتاح Cloudflare API.','First setup only. Use the operator email and private bootstrap token configured in Cloudflare, not your Cloudflare API token.')}</p>
  <form onSubmit={submit}>
   <label>{L('بريد المالك','Owner email')}<input type="email" autoComplete="email" required value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))}/></label>
   <label>{L('كلمة المرور','Password')}<input type="password" autoComplete="new-password" minLength={12} required value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))}/></label>
   <label>{L('رمز تهيئة المالك','Owner bootstrap token')}<input type="password" minLength={24} required autoComplete="off" value={form.token} onChange={e=>setForm(v=>({...v,token:e.target.value}))}/></label>
   {error&&<p role="alert">{error}</p>}
   <button type="submit" disabled={pending}>{pending?L('جارٍ إعداد المنصة...','Initializing...'):L('إنشاء مدير المنصة','Create platform administrator')}</button>
  </form>
  <a href="/mif/console">{L('العودة لتسجيل الدخول','Back to SaaS login')}</a>
 </section>
}
