import React,{useEffect,useMemo,useState} from 'react';
import {BrainCircuit,MessageCircle,Plus,RefreshCw,Search,ArrowUpLeft,BookOpen,Check,FilePlus2,FolderKanban,Loader2,ChevronDown,Save,X,ShieldCheck} from 'lucide-react';
import {api,useSite,tr} from './App.jsx';
import './rawi-generated-workspace.css';

const blank=()=>({values:{},stage:'',source_thread_id:null});
export default function RawiGeneratedWorkspace({onNewChat=()=>{},onOpenThread=()=>{}}){
 const {lang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [workspaces,setWorkspaces]=useState([]),[workspace,setWorkspace]=useState(''),[blueprint,setBlueprint]=useState(null),[status,setStatus]=useState('loading'),[error,setError]=useState(''),[repoKey,setRepoKey]=useState('');
 const [rows,setRows]=useState([]),[threads,setThreads]=useState([]),[search,setSearch]=useState(''),[draft,setDraft]=useState(null),[saving,setSaving]=useState(false),[generating,setGenerating]=useState(false),[showChats,setShowChats]=useState(false),[threadForImport,setThreadForImport]=useState(''),[relationRows,setRelationRows]=useState({});
 const base=workspace?'/api/admin/erp/w/'+encodeURIComponent(workspace):'';
 const selected=blueprint?.repositories?.find(x=>x.key===repoKey)||null;
 const source=threads.find(x=>x.id===threadForImport);
 const loadWorkspaces=async()=>{setStatus('loading');setError('');try{
  const r=await api('/api/admin/erp/workspaces');
  setWorkspaces(r.data||[]);
  setWorkspace(current=>(r.data||[]).some(w=>w.id===current)?current:(r.data?.[0]?.id||''));
  if(!r.data?.length)setStatus('unavailable');
 }catch(e){setError(e.message);setStatus('error')}};
 useEffect(()=>{loadWorkspaces()},[]);
 const loadBlueprint=async()=>{if(!workspace)return;setStatus('generating');setGenerating(true);setError('');
  try{const r=await api('/api/admin/company/workspace-plan/'+encodeURIComponent(workspace)+'?language='+lang);
   if(!r.ready||!r.data?.repositories?.length){setBlueprint(null);setStatus('needs_ai');return}
   setBlueprint(r.data);setRepoKey(old=>r.data.repositories.some(x=>x.key===old)?old:r.data.repositories[0].key);
   setStatus('ready');
  }catch(e){setBlueprint(null);setError(e.message);setStatus('error')}finally{setGenerating(false)}
 };
 useEffect(()=>{setBlueprint(null);setRepoKey('');setRows([]);setThreads([]);if(workspace)loadBlueprint()},[workspace,lang]);
 const fetchThreads=async()=>{if(!base)return;try{const r=await api(base+'/repository');setThreads(r.data?.threads||[])}catch(e){setError(e.message)}};
 useEffect(()=>{if(status==='ready'&&workspace)fetchThreads()},[status,workspace]);
 const loadRecords=async()=>{if(!base||!selected)return;try{const r=await api(base+'/dynamic/'+selected.key+'/records');setRows(r.data||[])}catch(e){setError(e.message)}};
 useEffect(()=>{setRows([]);setDraft(null);setRelationRows({});if(selected&&workspace)loadRecords()},[repoKey,workspace,blueprint?.title]);
 const relations=useMemo(()=>selected?.fields?.filter(f=>f.type==='relation')||[],[selected]);
 useEffect(()=>{if(!base||!relations.length)return;let active=true;Promise.all(relations.map(async f=>{
  try{const r=await api(base+'/dynamic/'+f.target+'/records');return [f.key,r.data||[]]}catch{return [f.key,[]]}
 })).then(entries=>{if(active)setRelationRows(Object.fromEntries(entries))});return()=>{active=false}},[base,repoKey,blueprint?.title]);
 const display=(field,value)=>{
  if(value===undefined||value===null||value==='')return '—';
  if(typeof value==='boolean')return value?L('نعم','Yes'):L('لا','No');
  if(field.type==='relation'){const found=(relationRows[field.key]||[]).find(x=>x.id===value);return found?String(Object.values(found.values_json||{})[0]||value):value}
  return String(value);
 };
 const visibleRows=rows.filter(r=>(JSON.stringify(r.values_json||{})+' '+r.stage).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 const openDraft=(values={},stage='',source_thread_id=null,edit_id=null)=>{setError('');setDraft({values,stage:stage||selected?.stages?.[0]||'',source_thread_id,edit_id});setShowChats(false)};
 const updateField=(key,value)=>setDraft(x=>({...x,values:{...x.values,[key]:value}}));
 const save=async e=>{e.preventDefault();if(!selected||!draft||saving)return;setSaving(true);setError('');try{
  const values={};for(const field of selected.fields){const v=draft.values[field.key];if(v===undefined||v===null||v==='')continue;values[field.key]=field.type==='number'?Number(v):v}
  await api(base+'/dynamic/'+selected.key+'/records'+(draft.edit_id?'/'+draft.edit_id:''),{method:draft.edit_id?'PATCH':'POST',body:JSON.stringify({values,stage:draft.stage,...(!draft.edit_id&&draft.source_thread_id?{source_thread_id:draft.source_thread_id}:{})})});
  setDraft(null);setThreadForImport('');await loadRecords();
 }catch(e){setError(e.message)}finally{setSaving(false)}};
 const propose=async id=>{if(!selected)return;setSaving(true);setError('');try{
  const r=await api(base+'/dynamic/'+selected.key+'/propose',{method:'POST',body:JSON.stringify({thread_id:id})});
  setDraft(r.draft);setShowChats(false);setThreadForImport(id);
 }catch(e){setError(e.message)}finally{setSaving(false)}};
 const updateStage=async(row,stage)=>{if(!window.confirm(L('تأكيد تغيير مرحلة السجل؟','Confirm changing this record stage?')))return;setSaving(true);setError('');
  try{await api(base+'/dynamic/'+selected.key+'/records/'+row.id,{method:'PATCH',body:JSON.stringify({stage})});await loadRecords()}catch(e){setError(e.message)}finally{setSaving(false)}};
 const main=blueprint?.repositories||[];
 return <section className="rawi-generated-app" dir={lang==='ar'?'rtl':'ltr'}>
  <header className="rawi-generated-head"><div className="rawi-generated-identity"><BrainCircuit size={25}/><div><span>{L('مساحة الشركة المولّدة بالذكاء الاصطناعي','AI-generated company application')}</span><h1>{blueprint?.title||L('مساحة عمل شركتك','Your company workspace')}</h1><p>{blueprint?.summary||L('راوي يبني مستودعات وسير عمل مخصصًا لنشاط شركتك، وليس إدارات عامة ثابتة.','Rawi builds repositories and processes specific to your business, not fixed ERP departments.')}</p></div></div>
   <div className="rawi-generated-head-actions">{workspaces.length>1&&<select aria-label={L('الشركة','Company')} value={workspace} onChange={e=>setWorkspace(e.target.value)}>{workspaces.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}</select>}<button type="button" onClick={onNewChat}><MessageCircle size={16}/>{L('تحدث مع راوي','Chat with Rawi')}</button></div>
  </header>
  {error&&<p className="rawi-generated-error" role="alert">{error}</p>}
  {status!=='ready'?<div className="rawi-generated-state">
   {status==='loading'||status==='generating'?<Loader2 className="mif-spinner" size={26}/>:<BrainCircuit size={30}/>}
   <h2>{status==='needs_ai'?L('كمّل تصميم برنامجك مع راوي','Finish designing your application with Rawi'):status==='unavailable'?L('مساحة الشركة قيد الإعداد','Company workspace is being prepared'):L('راوي يجهز مساحة عملك','Rawi is preparing your application')}</h2>
   <p>{status==='needs_ai'?L('راوي هيعرف تفاصيل شغلك وتفضيلاتك من المحادثة الأول، ويقترح تصميمًا تراجعه قبل التنفيذ.','Rawi will learn your business needs and preferred software in chat, then present a design for your approval.'):L('سيتم تحميل مستودعات الشركة ومراحلها وحقولها عند جاهزيتها.','Your company repositories, workflows and fields will appear when ready.')}</p>
   {status==='needs_ai'?<button type="button" onClick={onNewChat}><MessageCircle size={16}/>{L('افتح المحادثة مع راوي','Open chat with Rawi')}</button>:<button type="button" disabled={generating} onClick={()=>workspace?loadBlueprint():loadWorkspaces()}><RefreshCw size={16}/>{L('التحقق من الجاهزية','Check readiness')}</button>}
  </div>:<>
   <div className="rawi-generated-summary"><span><ShieldCheck size={15}/>{L('مصمم خصيصًا لنشاطك','Tailored to your business')}</span><strong>{main.length} {L('مستودعات متخصصة','business repositories')}</strong><small>{L('المحادثة أولًا، والسجلات عند الحاجة','Conversation first, structured records when needed')}</small></div>
   {blueprint.workflows?.length>0&&<div className="rawi-generated-workflows"><strong>{L('طريقة تشغيل أعمال شركتك','Your business workflow')}</strong><div>{blueprint.workflows.map((step,i)=><span key={i}><b>{i+1}</b>{step}</span>)}</div></div>}
   <div className="rawi-generated-layout">
    <nav className="rawi-generated-nav" aria-label={L('مستودعات شركتك','Your business repositories')}>
     {main.map(r=><button type="button" key={r.key} className={selected?.key===r.key?'active':''} onClick={()=>{setRepoKey(r.key);setSearch('');setShowChats(false)}}><FolderKanban size={17}/><span>{r.name}</span><ChevronDown size={15}/></button>)}
    </nav>
    <div className="rawi-generated-main">{selected&&<>
     <div className="rawi-generated-repo-head"><div><h2>{selected.name}</h2><p>{selected.description}</p></div><button type="button" onClick={()=>openDraft()}><Plus size={16}/>{L('سجل جديد','New record')}</button></div>
     {selected.stages.length>0&&<div className="rawi-generated-stage-track">{selected.stages.map(stage=><span key={stage}>{stage}</span>)}</div>}
     <div className="rawi-generated-tools"><label><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={L('ابحث في سجلات المستودع','Search repository records')}/></label><button type="button" onClick={loadRecords}><RefreshCw size={16}/></button><button type="button" onClick={()=>{setShowChats(x=>!x);fetchThreads()}}><MessageCircle size={17}/>{L('حوّل محادثة إلى سجل','Create record from chat')}</button></div>
     {showChats&&<div className="rawi-generated-chat-picker"><strong>{L('اختر محادثة ليستخلص راوي منها بيانات السجل','Choose a conversation to extract a record draft')}</strong>{threads.length===0?<p>{L('لا توجد محادثات محفوظة بعد.','No saved conversations yet.')}</p>:threads.map(t=><div key={t.id}><span>{t.title}</span><button type="button" disabled={saving||!t.latest_answer} onClick={()=>propose(t.id)}>{saving?<Loader2 className="mif-spinner" size={14}/>:<BrainCircuit size={15}/>} {L('استخراج مسودة','Extract draft')}</button><button type="button" onClick={()=>onOpenThread(t.id)}>{L('فتح','Open')}</button></div>)}</div>}
     {draft&&<form className="rawi-generated-form" onSubmit={save}><div className="rawi-generated-form-title"><strong>{draft.edit_id?L('تعديل سجل','Edit record'):draft.source_thread_id?L('مسودة مستخرجة من المحادثة — راجع البيانات','AI-extracted draft — review before saving'):L('سجل جديد في','New record in')+' '+selected.name}</strong><button type="button" onClick={()=>setDraft(null)}><X size={17}/></button></div>
      <div className="rawi-generated-form-fields">{selected.fields.map(field=><label key={field.key}><span>{field.label}{field.required?' *':''}</span>
       {field.type==='boolean'?<select value={draft.values[field.key]===undefined?'':String(draft.values[field.key])} required={field.required} onChange={e=>updateField(field.key,e.target.value===''?'':e.target.value==='true')}><option value="">{L('اختر','Choose')}</option><option value="true">{L('نعم','Yes')}</option><option value="false">{L('لا','No')}</option></select>:
       field.type==='select'||field.type==='relation'?<select required={field.required} value={draft.values[field.key]??''} onChange={e=>updateField(field.key,e.target.value)}><option value="">{L('اختر','Choose')}</option>{(field.type==='select'?field.options||[]:relationRows[field.key]||[]).map(option=>field.type==='select'?<option key={option} value={option}>{option}</option>:<option key={option.id} value={option.id}>{String(Object.values(option.values_json||{})[0]||option.id)}</option>)}</select>:
       field.type==='long_text'?<textarea value={draft.values[field.key]??''} onChange={e=>updateField(field.key,e.target.value)} rows={3} required={field.required}/>:
       <input type={field.type==='number'?'number':field.type==='date'?'date':'text'} step={field.type==='number'?'any':undefined} value={draft.values[field.key]??''} required={field.required} onChange={e=>updateField(field.key,e.target.value)}/>}
       </label>)}</div>
      {selected.stages.length>0&&<label className="rawi-generated-stage-select">{L('المرحلة','Stage')}<select value={draft.stage||selected.stages[0]} onChange={e=>setDraft(x=>({...x,stage:e.target.value}))}>{selected.stages.map(s=><option key={s} value={s}>{s}</option>)}</select></label>}
      <footer><span>{L('لن يحفظ راوي السجل إلا بعد مراجعتك وضغط حفظ.','No record is saved until you review and confirm.')}</span><button disabled={saving} type="submit"><Save size={16}/>{L('تأكيد وحفظ','Confirm and save')}</button></footer>
     </form>}
     <div className="rawi-generated-records">{!visibleRows.length?<div className="rawi-generated-empty"><FilePlus2 size={26}/><p>{L('المستودع جاهز لاستقبال بيانات العمل من محادثاتك أو سجل جديد.','Your repository is ready for records from conversations or manual entry.')}</p></div>:visibleRows.map(row=><article key={row.id}><div className="rawi-generated-row-title"><BookOpen size={17}/><b>{String(Object.values(row.values_json||{})[0]||selected.name)}</b><small>{new Date(row.updated_at).toLocaleDateString(lang==='ar'?'ar-SA':'en-US')}</small></div><div className="rawi-generated-row-fields">{selected.fields.filter(f=>row.values_json?.[f.key]!==undefined).map(f=><div key={f.key}><small>{f.label}</small><strong>{display(f,row.values_json[f.key])}</strong></div>)}</div>
      <div className="rawi-generated-row-stage">{selected.stages.length>0&&<label>{L('المرحلة','Stage')}<select disabled={saving} value={row.stage||selected.stages[0]} onChange={e=>updateStage(row,e.target.value)}>{selected.stages.map(stage=><option key={stage}>{stage}</option>)}</select></label>}<button type="button" onClick={()=>openDraft(row.values_json||{},row.stage,row.source_thread_id,row.id)}>{L('تعديل السجل','Edit record')}</button></div>
     </article>)}</div>
    </>}</div>
   </div>
  </>}
 </section>;
}
