import React,{useEffect,useMemo,useState} from 'react';
import {MessageCircle,BookOpen,CheckCircle2,RefreshCw,Search,Plus,ArrowUpLeft,ClipboardList,ReceiptText,FolderKanban,Users,Loader2} from 'lucide-react';
import {api,useSite,tr} from './App.jsx';
import './rawi-conversation-repository.css';

export default function RawiConversationRepository({workspace,readOnly=false,onOpenThread=()=>{},onNewChat=()=>{},onSection=()=>{},notify=()=>{}}){
 const {lang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [data,setData]=useState({threads:[],notes:[],counts:{}}),[busy,setBusy]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[view,setView]=useState('threads'),[saving,setSaving]=useState('');
 const base='/api/admin/erp/w/'+encodeURIComponent(workspace);
 const reload=async()=>{if(!workspace||readOnly){setBusy(false);return}
  setBusy(true);setError('');try{const r=await api(base+'/repository');setData(r.data||{threads:[],notes:[],counts:{}})}catch(e){setError(e.message)}finally{setBusy(false)}
 };
 useEffect(()=>{let active=true;if(readOnly||!workspace){setBusy(false);return}
  setBusy(true);setError('');
  api(base+'/repository').then(r=>{if(active)setData(r.data||{threads:[],notes:[],counts:{}})}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[workspace,readOnly]);
 const term=query.trim().toLocaleLowerCase(lang==='ar'?'ar':'en');
 const threads=useMemo(()=>(data.threads||[]).filter(t=>(t.title+' '+(t.latest_answer||'')).toLocaleLowerCase().includes(term)),[data.threads,term]);
 const notes=useMemo(()=>(data.notes||[]).filter(t=>(t.title+' '+(t.preview||'')).toLocaleLowerCase().includes(term)),[data.notes,term]);
 const saveThread=async id=>{setSaving(id);setError('');try{
  const result=await api(base+'/repository/save-thread',{method:'POST',body:JSON.stringify({thread_id:id})});
  notify(result.saved?L('تم حفظ نتيجة المحادثة في مستودع المعرفة','Conversation result saved to knowledge'):L('هذه النتيجة محفوظة بالفعل','This result is already saved'));
  await reload();
 }catch(e){setError(e.message)}finally{setSaving('')}};
 const date=v=>v?new Date(v).toLocaleDateString(lang==='ar'?'ar-SA':'en-GB',{month:'short',day:'numeric'}):'';
 const paths=[
  ['tasks',ClipboardList,L('المهام','Tasks'),data.counts?.open_tasks||0],
  ['invoices',ReceiptText,L('الفواتير','Invoices'),data.counts?.invoices||0],
  ['projects',FolderKanban,L('المشاريع','Projects'),data.counts?.projects||0],
  ['contacts',Users,L('جهات الاتصال','Contacts'),data.counts?.contacts||0]
 ];
 return <section className="rawi-repository" aria-label={L('مستودعات العمل','Work repositories')}>
  <div className="rawi-repository-top"><div><span className="rawi-repository-eyebrow">{L('مساحة العمل','Workspace')}</span><h2>{L('مستودعات العمل','Work repositories')}</h2><p>{L('كل محادثة محفوظة تلقائيًا، ونتائجها متاحة للحفظ في المعرفة. الإدارات التفصيلية موجودة عند الحاجة.','Conversations are indexed automatically. Save useful AI outputs to knowledge; open detailed tools only when needed.')}</p></div>
   <button type="button" className="rawi-repository-new" onClick={onNewChat}><Plus size={16}/>{L('محادثة جديدة','New conversation')}</button>
  </div>
  <div className="rawi-repository-counters">
   <button type="button" onClick={()=>setView('threads')} className={view==='threads'?'active':''}><MessageCircle size={18}/><span>{L('المحادثات','Conversations')}</span><strong>{data.threads?.length||0}</strong></button>
   <button type="button" onClick={()=>setView('notes')} className={view==='notes'?'active':''}><BookOpen size={18}/><span>{L('المعرفة','Knowledge')}</span><strong>{data.notes?.length||0}</strong></button>
  </div>
  <div className="rawi-repository-library">
   <div className="rawi-repository-toolbar"><strong>{view==='threads'?L('مستودع المحادثات','Conversation archive'):L('مستودع المعرفة','Knowledge archive')}</strong>
    <div><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={L('ابحث في المحتوى...','Search content...')} aria-label={L('بحث','Search')}/></label><button type="button" title={L('تحديث','Refresh')} onClick={reload}><RefreshCw size={17}/></button></div>
   </div>
   {error&&<p className="rawi-repository-error" role="alert">{error}</p>}
   {busy?<div className="rawi-repository-empty"><Loader2 size={21} className="mif-spinner"/>{L('جاري تحميل المستودعات...','Loading repositories...')}</div>:
    view==='threads'?threads.length?<div className="rawi-repository-items">{threads.map(item=><article key={item.id}>
     <div className="rawi-repository-entry-head"><MessageCircle size={17}/><strong>{item.title}</strong><small>{date(item.updated_at)}</small></div>
     <p>{item.latest_answer||L('محادثة محفوظة؛ افتحها لمراجعة محتواها.','Conversation saved. Open it to read the messages.')}</p>
     <footer><span>{Number(item.message_count||0)} {L('رسائل','messages')}</span><div><button type="button" onClick={()=>onOpenThread(item.id)}><ArrowUpLeft size={15}/>{L('فتح المحادثة','Open chat')}</button><button type="button" disabled={saving===item.id||!item.latest_answer||readOnly} onClick={()=>saveThread(item.id)}>{saving===item.id?<Loader2 size={15} className="mif-spinner"/>:<BookOpen size={15}/>} {L('حفظ النتيجة','Save result')}</button></div></footer>
    </article>)}</div>:<div className="rawi-repository-empty"><MessageCircle size={25}/>{term?L('لا توجد نتائج للبحث','No matching conversations'):L('ستظهر محادثاتك هنا تلقائيًا بمجرد إرسالها.','Your conversations will appear here automatically after you send them.')}</div>
    :notes.length?<div className="rawi-repository-items">{notes.map(item=><article key={item.id}><div className="rawi-repository-entry-head"><BookOpen size={17}/><strong>{item.title}</strong><small>{date(item.created_at)}</small></div><p>{item.preview}</p><footer><span>{item.category==='conversation'?L('محفوظ من محادثة','From conversation'):L('معلومة محفوظة','Knowledge note')}</span><CheckCircle2 size={16}/></footer></article>)}</div>:<div className="rawi-repository-empty"><BookOpen size={24}/>{term?L('لا توجد نتائج للبحث','No matching notes'):L('احفظ مخرجات المحادثة المفيدة بضغطة واحدة لتظهر هنا.','Save useful chat outputs in one click to see them here.')}</div>}
  </div>
  <div className="rawi-repository-toolbox"><h3>{L('مستودعات البيانات الأخرى','Other work data')}</h3><div>{paths.map(([key,Icon,title,count])=><button type="button" key={key} onClick={()=>onSection(key)}><Icon size={17}/><span>{title}</span><strong>{count}</strong><ArrowUpLeft size={15}/></button>)}</div></div>
 </section>;
}
