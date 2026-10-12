import React,{useEffect,useState} from 'react';
import {UserRound,Building2,ShieldCheck,KeyRound,Save,Loader2,LogOut,Download,CalendarDays,Pencil,CheckCircle2} from 'lucide-react';
import {api,useSite,tr} from './App.jsx';
import './rawi-customer-account.css';
const emptyPasswords={current_password:'',new_password:'',confirm:''};
const editFields=[
 ['name','اسم الشركة','Company name'],['address','العنوان','Address'],
 ['commercial_registration','السجل التجاري','Commercial registration'],['tax_number','الرقم الضريبي','Tax number'],
 ['phone','الهاتف','Phone'],['mobile','الجوال','Mobile'],
 ['website','الموقع الإلكتروني','Website'],['emails','البريد الإلكتروني للتواصل','Contact email']
];
export default function RawiCustomerAccount({onLogout=()=>{},onInstall=()=>{},installed=false}){
 const {lang,setLang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [profile,setProfile]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [password,setPassword]=useState(emptyPasswords),[changing,setChanging]=useState(false),[editing,setEditing]=useState(''),[companyDraft,setCompanyDraft]=useState(null),[displayName,setDisplayName]=useState('');
 const refresh=async()=>{setLoading(true);setError('');try{const r=await api('/api/admin/account/profile');setProfile(r);setDisplayName(r.account?.display_name||'')}catch(e){setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{refresh()},[]);
 const date=t=>t?new Date(t).toLocaleDateString(lang==='ar'?'ar-SA':'en-GB',{day:'numeric',month:'long',year:'numeric'}):'—';
 const changePassword=async e=>{e.preventDefault();setError('');setNotice('');
  if(password.new_password!==password.confirm){setError(L('تأكيد كلمة المرور غير مطابق','Passwords do not match'));return}
  setBusy(true);try{await api('/api/admin/account/password',{method:'POST',body:JSON.stringify({current_password:password.current_password,new_password:password.new_password})});setPassword(emptyPasswords);setChanging(false);setNotice(L('تم تغيير كلمة المرور بنجاح','Password updated successfully'))}catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const saveDisplay=async e=>{e.preventDefault();setBusy(true);setError('');try{
  await api('/api/admin/account/profile',{method:'PATCH',body:JSON.stringify({display_name:displayName})});
  setNotice(L('تم تحديث اسم الحساب','Account name updated'));await refresh()
 }catch(e){setError(e.message)}finally{setBusy(false)}};
 const startEdit=company=>{setEditing(company.workspace_id);setCompanyDraft({...company});setError('')};
 const saveCompany=async e=>{e.preventDefault();setBusy(true);setError('');try{
  const id=companyDraft.workspace_id,fields=Object.fromEntries(['name','address','commercial_registration','tax_number','phone','mobile','website','emails','logo_data'].map(k=>[k,companyDraft[k]||'']));
  await api('/api/admin/account/company/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(fields)});
  setEditing('');setCompanyDraft(null);setNotice(L('تم حفظ بيانات الشركة','Company details saved'));await refresh()
 }catch(e){setError(e.message)}finally{setBusy(false)}};
 const updateLogo=e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>175000){setError(L('الشعار يجب أن يكون صورة أقل من 175 كيلوبايت','Logo must be an image smaller than 175 KB'));return}
  const r=new FileReader();r.onload=()=>setCompanyDraft(old=>({...old,logo_data:String(r.result||'')}));r.readAsDataURL(file);
 };
 return <section className="rawi-customer-account" aria-label={L('حساب العميل','Customer account')}>
  <div className="rawi-customer-account-title"><UserRound size={25}/><div><h1>{L('حساب العميل','Customer account')}</h1><p>{L('حساب الدخول والاشتراكات وملفات شركاتك في مكان واحد','Your login, subscriptions and company profiles in one place')}</p></div></div>
  {loading&&<div className="rawi-customer-account-loading"><Loader2 size={20} className="mif-spinner"/>{L('جاري تحميل الملف','Loading account')}</div>}
  {error&&<p role="alert" className="rawi-customer-account-error">{error}</p>}
  {notice&&<p role="status" className="rawi-customer-account-notice"><CheckCircle2 size={17}/>{notice}</p>}
  {profile&&<><section className="rawi-customer-account-card"><h2><UserRound size={19}/>{L('بيانات الحساب','Account information')}</h2>
    <form className="rawi-customer-display-form" onSubmit={saveDisplay}><label>{L('اسم المستخدم','Display name')}<input required minLength={2} maxLength={150} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><button type="submit" disabled={busy||displayName===(profile.account.display_name||'')}><Save size={15}/>{L('حفظ','Save')}</button></form>
    <div className="rawi-customer-account-pair"><span>{L('اسم الدخول (البريد الإلكتروني)','Login username (email)')}</span><strong dir="ltr">{profile.account.username}</strong></div>
    <div className="rawi-customer-account-pair"><span>{L('كلمة المرور','Password')}</span><strong>•••••••• <button type="button" onClick={()=>setChanging(!changing)}><KeyRound size={15}/>{L('تغيير','Change')}</button></strong></div>
    {changing&&<form className="rawi-customer-password-form" onSubmit={changePassword}><label>{L('كلمة المرور الحالية','Current password')}<input type="password" required value={password.current_password} autoComplete="current-password" onChange={e=>setPassword(v=>({...v,current_password:e.target.value}))}/></label><label>{L('كلمة المرور الجديدة','New password')}<input type="password" required minLength={12} value={password.new_password} autoComplete="new-password" onChange={e=>setPassword(v=>({...v,new_password:e.target.value}))}/></label><label>{L('تأكيد كلمة المرور','Confirm password')}<input type="password" required minLength={12} value={password.confirm} autoComplete="new-password" onChange={e=>setPassword(v=>({...v,confirm:e.target.value}))}/></label><button type="submit" disabled={busy}>{L('تغيير كلمة المرور','Update password')}</button></form>}
   </section>
   <section className="rawi-customer-account-card"><h2><CalendarDays size={19}/>{L('اشتراكاتي','Subscriptions')}</h2>
    {(profile.subscriptions||[]).map(x=><article key={x.workspace_id} className="rawi-customer-subscription"><strong>{profile.companies?.find(c=>c.workspace_id===x.workspace_id)?.name||'—'}</strong><span>{x.plan_name||L('بدون باقة','No plan')} · {x.status||'—'}</span><div>{L('من','From')} {date(x.period_starts_at)} · {L('إلى','Until')} {date(x.period_ends_at)}</div><small>{L('الرسائل المستخدمة','Messages used')}: {Number(x.messages_used||0).toLocaleString()} / {Number(x.message_limit||0).toLocaleString()}</small></article>)}
   </section>
   <section className="rawi-customer-account-card"><h2><Building2 size={19}/>{L('شركاتي','My companies')}</h2>
    {(profile.companies||[]).map(company=><article key={company.workspace_id} className="rawi-customer-company">
      <div className="rawi-customer-company-heading">{company.logo_data?<img src={company.logo_data} alt=""/>:<Building2 size={24}/>}<div><strong>{company.name||'—'}</strong><small>{company.activity||'—'}</small></div>{company.role==='owner'&&editing!==company.workspace_id&&<button type="button" onClick={()=>startEdit(company)}><Pencil size={16}/>{L('تعديل','Edit')}</button>}</div>
      {editing===company.workspace_id&&companyDraft?<form className="rawi-customer-company-form" onSubmit={saveCompany}>
       <label className="rawi-customer-logo-input">{L('شعار الشركة','Company logo')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={updateLogo}/></label>
       {editFields.map(([key,ar,en])=><label key={key}>{L(ar,en)}<input required={key==='name'||key==='address'} type={key==='website'?'url':'text'} value={companyDraft[key]||''} onChange={e=>setCompanyDraft(v=>({...v,[key]:e.target.value}))}/></label>)}
       <div className="rawi-customer-company-actions"><button type="submit" disabled={busy}><Save size={16}/>{L('حفظ الشركة','Save company')}</button><button type="button" onClick={()=>{setEditing('');setCompanyDraft(null)}}>{L('إلغاء','Cancel')}</button></div>
       </form>:<div className="rawi-customer-company-info">
        <div><span>{L('العنوان','Address')}</span><strong>{company.address||'—'}</strong></div>
        <div><span>{L('السجل التجاري','Commercial registration')}</span><strong>{company.commercial_registration||'—'}</strong></div>
        <div><span>{L('الرقم الضريبي','Tax number')}</span><strong>{company.tax_number||'—'}</strong></div>
        <div><span>{L('التواصل','Contact')}</span><strong>{[company.phone,company.mobile].filter(Boolean).join(' · ')||'—'}</strong></div>
        <div><span>{L('الموقع والبريد','Website and emails')}</span><strong>{[company.website,company.emails].filter(Boolean).join(' · ')||'—'}</strong></div>
       </div>}
    </article>)}
   </section>
  </>}
  <div className="rawi-customer-account-actions"><button onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'English':'العربية'}</button>{!installed&&<button onClick={onInstall}><Download size={16}/>{L('تثبيت التطبيق','Install app')}</button>}<button className="rawi-customer-logout" onClick={onLogout}><LogOut size={16}/>{L('تسجيل الخروج','Sign out')}</button></div>
 </section>;
}
