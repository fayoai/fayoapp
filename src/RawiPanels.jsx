import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {api,useSite,tr} from './App.jsx';
import {UsersRound,Bell,RefreshCcw,UserRoundPlus,CalendarClock,AlertCircle,CheckCircle2,ArrowUpRight,ShieldCheck} from 'lucide-react';
import './rawi-panels.css';
const roleNames={owner:['المالك','Owner'],admin:['مدير','Admin'],viewer:['عضو','Member']};
export function RawiTeamPanel({workspaceId,workspace,notify}){
 const {lang}=useSite(),L=(a,e)=>tr(lang,a,e),[members,setMembers]=useState([]),[email,setEmail]=useState(''),[role,setRole]=useState('viewer'),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const owner=workspace?.role==='owner';
 const refresh=useCallback(async()=>{
  if(!workspaceId){setMembers([]);return}
  setLoading(true);setError('');
  try{const r=await api('/api/admin/erp/w/'+encodeURIComponent(workspaceId)+'/members');setMembers(r.data||[])}
  catch(e){setError(e.message)}finally{setLoading(false)}
 },[workspaceId]);
 useEffect(()=>{refresh()},[refresh]);
 const add=async e=>{
  e.preventDefault();if(!owner||busy)return;setBusy(true);setError('');
  try{await api('/api/admin/erp/w/'+encodeURIComponent(workspaceId)+'/members',{method:'POST',body:JSON.stringify({email:email.trim().toLowerCase(),role})});setEmail('');await refresh();notify?.(L('تمت إضافة العضو','Member added'))}
  catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const change=async(member,next)=>{
  if(!owner||member.role==='owner')return;setBusy(true);setError('');
  try{await api('/api/admin/erp/w/'+encodeURIComponent(workspaceId)+'/members/'+encodeURIComponent(member.admin_id),{method:'PATCH',body:JSON.stringify({role:next})});await refresh()}
  catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const remove=async member=>{
  if(!owner||member.role==='owner'||!window.confirm(L('إلغاء وصول العضو؟','Remove this member?')))return;
  setBusy(true);setError('');
  try{await api('/api/admin/erp/w/'+encodeURIComponent(workspaceId)+'/members/'+encodeURIComponent(member.admin_id),{method:'DELETE'});await refresh()}
  catch(e){setError(e.message)}finally{setBusy(false)}
 };
 return <section className="rawi-utility-page">
  <div className="rawi-panel-head"><div><h1><UsersRound size={24}/>{L('الفريق','Team')}</h1><span>{workspace?.name||''}</span></div><button type="button" className="rawi-utility-refresh" onClick={refresh} disabled={loading}><RefreshCcw size={16}/>{L('تحديث','Refresh')}</button></div>
  {error&&<div role="alert" className="rawi-panel-error">{error}</div>}
  {owner&&<form onSubmit={add} className="rawi-team-invite"><label>{L('البريد الإلكتروني','Email')}<input type="email" required autoComplete="off" placeholder="name@company.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>{L('الصلاحية','Role')}<select value={role} onChange={e=>setRole(e.target.value)}><option value="viewer">{L('عضو','Member')}</option><option value="admin">{L('مدير','Admin')}</option></select></label><button type="submit" disabled={busy||!email.trim()}><UserRoundPlus size={17}/>{L('إضافة عضو','Add member')}</button></form>}
  <div className="rawi-team-members">{members.map(m=><article key={m.admin_id} className="rawi-member-row"><div className="rawi-member-avatar"><UsersRound size={19}/></div><div className="rawi-member-details"><strong>{m.email}</strong><small><ShieldCheck size={13}/>{L(...(roleNames[m.role]||roleNames.viewer))}</small></div>{owner&&m.role!=='owner'&&<div className="rawi-member-controls"><select aria-label={L('تغيير الصلاحية','Change role')} value={m.role} onChange={e=>change(m,e.target.value)} disabled={busy}><option value="viewer">{L('عضو','Member')}</option><option value="admin">{L('مدير','Admin')}</option></select><button type="button" onClick={()=>remove(m)} disabled={busy}>{L('إزالة','Remove')}</button></div>}</article>)}{!loading&&!members.length&&<div className="rawi-no-records">{L('لا يوجد أعضاء مسجلون.','No registered team members.')}</div>}</div>
 </section>
}
const toDate=d=>{const t=new Date(d);return Number.isNaN(t.getTime())?null:t};
export function RawiNotificationsPanel({workspaceId,onSchedule}){
 const {lang}=useSite(),L=(a,e)=>tr(lang,a,e),[tasks,setTasks]=useState([]),[cases,setCases]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const refresh=useCallback(async()=>{
  if(!workspaceId){setTasks([]);setCases([]);return}
  setLoading(true);setError('');
  const base='/api/admin/erp/w/'+encodeURIComponent(workspaceId);
  const settled=await Promise.allSettled([api(base+'/tasks'),api(base+'/activities')]);
  if(settled[0].status==='fulfilled')setTasks(settled[0].value.data||[]);else setTasks([]);
  if(settled[1].status==='fulfilled')setCases(settled[1].value.records||[]);else setCases([]);
  if(settled.some(x=>x.status==='rejected'))setError(settled.filter(x=>x.status==='rejected').map(x=>x.reason?.message).filter(Boolean).join(' · '));
  setLoading(false);
 },[workspaceId]);
 useEffect(()=>{refresh()},[refresh]);
 const items=useMemo(()=>{
  const now=Date.now(),horizon=now+7*86400000;
  const taskItems=tasks.filter(x=>x.status==='pending'&&toDate(x.due_at)&&toDate(x.due_at).getTime()<=horizon).map(x=>({id:'task-'+x.id,type:'task',label:x.title,when:toDate(x.due_at),urgent:toDate(x.due_at).getTime()<now}));
  const caseItems=cases.filter(x=>!['done','cancelled'].includes(x.status)&&(['urgent','high'].includes(x.priority)||toDate(x.due_on)&&toDate(x.due_on).getTime()<=horizon)).map(x=>({id:'case-'+x.id,type:'activity',label:x.title,when:toDate(x.due_on),urgent:x.priority==='urgent'||Boolean(toDate(x.due_on)&&toDate(x.due_on).getTime()<now)}));
  return [...taskItems,...caseItems].sort((a,b)=>Number(b.urgent)-Number(a.urgent)||(a.when?.getTime()||Infinity)-(b.when?.getTime()||Infinity));
 },[tasks,cases]);
 const date=d=>d?.toLocaleDateString(lang==='ar'?'ar-SA':'en-US',{month:'short',day:'numeric',year:'numeric'})||'';
 return <section className="rawi-utility-page">
  <div className="rawi-panel-head"><div><h1><Bell size={24}/>{L('التنبيهات','Notifications')}</h1><span>{items.length} {L('تنبيه','notifications')}</span></div><button type="button" className="rawi-utility-refresh" onClick={refresh} disabled={loading}><RefreshCcw size={16}/>{L('تحديث','Refresh')}</button></div>
  {error&&<div role="alert" className="rawi-panel-error">{error}</div>}
  <div className="rawi-notification-list">{items.map(item=><article key={item.id} className={'rawi-notification '+(item.urgent?'urgent':'')}><div className="rawi-alert-icon">{item.urgent?<AlertCircle size={20}/>:<CalendarClock size={20}/>}</div><div><strong>{item.label}</strong><small>{item.type==='task'?L('موعد مجدول','Scheduled task'):L('نشاط أعمال','Business activity')}{item.when?' · '+date(item.when):''}</small></div>{item.type==='task'&&<button type="button" aria-label={L('فتح الجدولة','Open schedule')} onClick={onSchedule}><ArrowUpRight size={17}/></button>}</article>)}{!loading&&!items.length&&!error&&<div className="rawi-no-records"><CheckCircle2 size={28}/>{L('لا توجد تنبيهات حالياً','No notifications right now')}</div>}</div>
 </section>
}
