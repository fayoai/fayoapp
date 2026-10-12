import React,{useEffect,useMemo,useRef,useState} from 'react';
import QRCode from 'qrcode';
import RawiBusinessTransactions from './RawiBusinessTransactions.jsx';
import {BookOpen,Building2,ChartColumn,FilePlus2,Loader2,RefreshCw,Save,Search,SlidersHorizontal,X} from 'lucide-react';
import {api,useSite,tr} from './App.jsx';
import './rawi-standard.css';

export default function RawiStandardRepositories({onOpenThread}={}){
 const {lang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [workspaces,setWorkspaces]=useState([]),[workspace,setWorkspace]=useState(''),[groups,setGroups]=useState([]);
 const [groupKey,setGroupKey]=useState('sales'),[repoKey,setRepoKey]=useState('std_opportunities');
 const [rows,setRows]=useState([]),[report,setReport]=useState(null),[draft,setDraft]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [drafts,setDrafts]=useState([]),[focusDraftId,setFocusDraftId]=useState(null);
 const [loading,setLoading]=useState(true),[recordsLoading,setRecordsLoading]=useState(false),[saving,setSaving]=useState(false),[search,setSearch]=useState(''),[viewMode,setViewMode]=useState('table');
 const [sequenceKind,setSequenceKind]=useState('sales_orders'),[sequenceValue,setSequenceValue]=useState('1');
 const [realInvoices,setRealInvoices]=useState([]),[qrImage,setQrImage]=useState(null);
 const [lookups,setLookups]=useState({}),[units,setUnits]=useState([]),[productEditor,setProductEditor]=useState(null);
 const [documentUnitOptions,setDocumentUnitOptions]=useState({});
 const [productUnitDraft,setProductUnitDraft]=useState({unit_id:'',factor:1,barcode:'',sale_price:'',purchase_price:''});
 const request=useRef(0);
 const prefix=workspace?'/api/admin/erp/w/'+encodeURIComponent(workspace):'';
 const loadDrafts=async()=>{if(!prefix)return;try{const r=await api(prefix+'/standard/drafts');setDrafts(r.data||[])}catch{setDrafts([])}};
 useEffect(()=>{if(workspace)loadDrafts();else setDrafts([])},[workspace]);
 const activeGroup=groups.find(g=>g.key===groupKey)||groups[0];
 const selected=groups.flatMap(g=>g.repositories).find(r=>r.key===repoKey)||null;
 const all=groups.flatMap(g=>g.repositories);
 const sequences=all.filter(r=>['quotations','sales_orders','sales_invoices','sales_credit_note','sales_debit_note','sales_receipts','purchase_quotes','purchase_orders','purchase_expenses','purchase_credit_note','purchase_debit_note','internal_transfer','external_transfer','stock_count','journal_entries','accounting_receipts','payment_vouchers','contracts','leaves','payroll','custody','attendance'].includes(r.kind));
 const boot=async()=>{
  setLoading(true);setError('');
  try{
   const w=await api('/api/admin/erp/workspaces');
   const list=w.data||[];
   setWorkspaces(list);setWorkspace(old=>list.some(x=>x.id===old)?old:(list[0]?.id||''));
  }catch(e){setError(e.message)}finally{setLoading(false)}
 };
 useEffect(()=>{boot()},[]);
 useEffect(()=>{if(!workspace)return;let active=true;api(prefix+'/standard/catalog').then(r=>{
  if(!active)return;
  setGroups(r.groups||[]);
  setGroupKey(old=>(r.groups||[]).some(g=>g.key===old)?old:'sales');
  setRepoKey(old=>(r.groups||[]).some(g=>g.repositories.some(x=>x.key===old))?old:'std_opportunities');
 }).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[workspace]);
 const loadRecords=async()=>{
  if(!prefix||!selected)return;
  const seq=++request.current;setRecordsLoading(true);setRows([]);setReport(null);setError('');
  try{
   const r=await api(prefix+(selected.read_only?'/system/report/'+selected.kind:'/standard/'+selected.key+'/records'));
   if(seq!==request.current)return;
   if(selected.read_only)setReport(r);
   else setRows(r.data||[]);
  }catch(e){if(seq===request.current)setError(e.message)}
  finally{if(seq===request.current)setRecordsLoading(false)}
 };
 useEffect(()=>{request.current++;setDraft(null);setRows([]);setReport(null);setSearch('');if(selected&&workspace)loadRecords()},[workspace,repoKey,groups]);

 useEffect(()=>{setQrImage(null);setRealInvoices([]);if(selected?.kind!=='sales_invoices'||!prefix)return;let alive=true;
  api(prefix+'/invoices').then(r=>{if(alive)setRealInvoices(r.data||[])}).catch(e=>{if(alive)setError(e.message)});
  return()=>{alive=false}
 },[workspace,repoKey,groups]);
 const showInvoiceQr=async invoice=>{
  setError('');setQrImage(null);
  try{
   const result=await api(prefix+'/system/invoices/'+encodeURIComponent(invoice.id)+'/qr');
   const dataUrl=await QRCode.toDataURL(result.tlv_base64,{width:220,margin:2,errorCorrectionLevel:'M'});
   setQrImage({invoice_no:result.invoice_no,dataUrl,phase2_compliant:result.phase2_compliant});
  }catch(e){setError(e.message)}
 };

 const refreshLookups=async()=>{if(!prefix)return;const [ref,measure]=await Promise.all([api(prefix+'/standard/lookups'),api(prefix+'/system/units')]);setLookups(ref.data||{});setUnits(measure.data||[])};
 useEffect(()=>{if(!workspace)return;let active=true;Promise.all([api(prefix+'/standard/lookups'),api(prefix+'/system/units')]).then(([ref,measure])=>{if(active){setLookups(ref.data||{});setUnits(measure.data||[])}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[workspace]);
 const openProductUnits=async row=>{
  setError('');setProductEditor(null);
  try{const r=await api(prefix+'/system/items/'+encodeURIComponent(row.id)+'/units');
   setProductEditor({product:r.product,links:r.data||[]});
   setProductUnitDraft({unit_id:units.find(u=>u.active&&u.code!==r.product.unit)?.id||'',factor:1,barcode:'',sale_price:'',purchase_price:''});
  }catch(e){setError(e.message)}
 };
 const saveProductUnit=async e=>{e.preventDefault();if(!productEditor||saving)return;setSaving(true);setError('');
  try{const d=productUnitDraft;await api(prefix+'/system/items/'+encodeURIComponent(productEditor.product.id)+'/units',{method:'PUT',body:JSON.stringify({
   unit_id:d.unit_id,factor:Number(d.factor),barcode:d.barcode,sale_price:d.sale_price===''?null:Number(d.sale_price),
   purchase_price:d.purchase_price===''?null:Number(d.purchase_price)
  })});const r=await api(prefix+'/system/items/'+encodeURIComponent(productEditor.product.id)+'/units');
   setProductEditor({product:r.product,links:r.data||[]});setNotice(L('تم حفظ وحدات الصنف ومعامل التحويل','Saved product units and conversions'));
  }catch(e){setError(e.message)}finally{setSaving(false)}
 };
 const selectGroup=key=>{setProductEditor(null);setGroupKey(key);setRepoKey(groups.find(g=>g.key===key)?.repositories?.[0]?.key||'');};
 const lineKinds=new Set(['quotations','sales_orders','sales_invoices','purchase_quotes','purchase_orders']);
 const loadLineUnits=async itemId=>{
  if(!itemId||documentUnitOptions[itemId])return;
  try{const result=await api(prefix+'/system/items/'+encodeURIComponent(itemId)+'/units');
   setDocumentUnitOptions(old=>({...old,[itemId]:result.data||[]}));
  }catch(e){setError(e.message)}
 };
 const startDraft=row=>{
  setError('');setNotice('');
  const lines=(row?.values_json?.document_lines||[]).map(x=>({item_id:x.item_id,unit_id:x.unit_id||'',quantity:Number(x.quantity)}));
  setDraft(row?{id:row.id,stage:row.stage||'',values:{...row.values_json},lines}:
   {stage:selected?.stages?.[0]||'',values:selected?.kind==='products'?{field_3:units.find(u=>u.code==='unit')?.code||'unit'}:{},lines:[]});
  lines.forEach(x=>loadLineUnits(x.item_id));
 };
 useEffect(()=>{if(!focusDraftId||!rows.length)return;const row=rows.find(record=>record.id===focusDraftId);if(row)startDraft(row);setFocusDraftId(null)},[rows,focusDraftId]);
 const changeLine=(index,key,value)=>{
  setDraft(old=>({...old,lines:old.lines.map((line,i)=>i===index?{...line,[key]:value,...(key==='item_id'?{unit_id:''}:{})}:line)}));
  if(key==='item_id')loadLineUnits(value);
 };

 const fieldChange=(key,value)=>setDraft(old=>({...old,values:{...old.values,[key]:value}}));
 const save=async event=>{
  event.preventDefault();if(!selected||!draft||saving)return;
  setSaving(true);setError('');setNotice('');
  try{
   const values={};
   for(const f of selected.fields){
    const raw=draft.values[f.key];
    if(raw===undefined||raw===null||raw==='')continue;
    values[f.key]=f.type==='number'?Number(raw):raw;
   }
   const target=prefix+'/standard/'+selected.key+'/records'+(draft.id?'/'+encodeURIComponent(draft.id):'');
   const documentLines=lineKinds.has(selected.kind)?{lines:(draft.lines||[]).map(x=>({item_id:x.item_id,quantity:Number(x.quantity),...(x.unit_id?{unit_id:x.unit_id}:{})}))}:{};
   const response=await api(target,{method:draft.id?'PATCH':'POST',body:JSON.stringify({values,stage:draft.stage||'',...documentLines})});
   if(!response?.data?.id)throw Error(L('لم يؤكد النظام حفظ البيانات','The server did not confirm saving'));
   setDraft(null);await loadRecords();await refreshLookups();await loadDrafts();setNotice(L('تم حفظ السجل في قاعدة بيانات الشركة','Record saved in the company database'));
  }catch(e){setError(e.message)}finally{setSaving(false)}
 };
 const saveSequence=async e=>{e.preventDefault();setSaving(true);setError('');
  try{
   await api(prefix+'/system/sequences/'+encodeURIComponent(sequenceKind),{method:'PUT',body:JSON.stringify({next_number:Number(sequenceValue)})});
   await loadRecords();setNotice(L('تم تحديث الرقم التالي دون إعادة استخدام الأرقام السابقة','Next number updated without reusing existing numbers'));
  }catch(e){setError(e.message)}finally{setSaving(false)}
 };
 const show=(field,value)=>{
  if(value===undefined||value===null||value==='')return '—';
  if(field.type==='number')return Number(value).toLocaleString(lang==='ar'?'ar-SA':'en');
  if(field.type==='relation')return lookups[field.target]?.find(x=>x.id===value)?.name||String(value);
  return String(value);
 };
 const visible=useMemo(()=>rows.filter(x=>JSON.stringify(x.values_json||{}).toLocaleLowerCase().includes(search.toLocaleLowerCase())),[rows,search]);
 const genericDraft=selected&&!selected.read_only&&selected.storage!=='erp'&&selected.kind!=='system_designs'&&selected.kind!=='document_sequences';
 return <section className="rawi-std" dir={lang==='ar'?'rtl':'ltr'}>
  <div className="rawi-std-heading"><div><h1><BookOpen size={23}/>{L('العمليات','Operations')}</h1><p>{L('إدارة السجلات والمستندات ومسودات راوي المحفوظة داخل الشركة','Manage company records, documents and saved Rawi drafts')}</p></div>
   {workspaces.length>1&&<select aria-label={L('الشركة','Company')} value={workspace} onChange={e=>setWorkspace(e.target.value)}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}
  </div>
  {error&&<p role="alert" className="rawi-std-error">{error}</p>}
  {notice&&<p role="status" className="rawi-std-notice">{notice}</p>}
  {loading?<div className="rawi-std-empty"><Loader2 className="mif-spinner"/>{L('جاري تحميل المستودعات','Loading repositories')}</div>:!workspace?<div className="rawi-std-empty">{L('لا توجد شركة متاحة','No company workspace is available')}</div>:<>
   <section className="rawi-std-drafts" aria-label={L('مسودات العمليات','Operational drafts')}>
    <div className="rawi-std-drafts-head"><h2>{L('مسودات العمليات','Operational drafts')}</h2><span>{drafts.length}</span><button type="button" onClick={loadDrafts}><RefreshCw size={15}/>{L('تحديث','Refresh')}</button></div>
    {drafts.length?<div className="rawi-std-drafts-list">{drafts.map(row=><div className="rawi-std-draft-item" key={row.id}>
     <button type="button" className="rawi-std-draft-open" onClick={()=>{setGroupKey(row.group);setRepoKey(row.repository_key);setFocusDraftId(row.id)}}>
      <strong>{row.repository_name}</strong><span>{String(row.values_json?.document_number||row.values_json?.field_1||row.id).slice(0,85)}</span><small>{L('مسودة','Draft')}</small>
     </button>
     {row.source_thread_id&&onOpenThread&&<button type="button" className="rawi-std-source-link" onClick={()=>onOpenThread(row.source_thread_id)}>{L('المصدر','Source')}</button>}
    </div>)}</div>:<p className="rawi-std-drafts-empty">{L('لا توجد مسودات محفوظة بعد. ستظهر هنا العمليات التي ينشئها راوي أو المستخدم.','No saved drafts yet. Rawi and user-created drafts will appear here.')}</p>}
   </section>
   <nav className="rawi-std-groups" aria-label={L('الإدارات','Departments')}>
    {groups.map(g=><button key={g.key} className={groupKey===g.key?'active':''} type="button" onClick={()=>selectGroup(g.key)}>{g.title}<span>{g.repositories.length}</span></button>)}
   </nav>
   <div className="rawi-std-layout">
    <nav className="rawi-std-side" aria-label={L('المستودعات','Repositories')}>
     {(activeGroup?.repositories||[]).map(r=><button type="button" key={r.key} className={repoKey===r.key?'active':''} onClick={()=>{setProductEditor(null);setRepoKey(r.key)}}>{r.name}</button>)}
    </nav>
    <div className="rawi-std-main">
     {selected&&<>
      <header className="rawi-std-repo-header"><div><h2>{selected.name}</h2><small>{activeGroup?.title}</small></div>
       <div className="rawi-std-header-actions"><button type="button" onClick={loadRecords} disabled={recordsLoading}><RefreshCw size={16}/>{L('تحديث','Refresh')}</button>
       {!selected.read_only&&selected.kind!=='document_sequences'&&<button type="button" className="primary" onClick={()=>startDraft()}><FilePlus2 size={16}/>{L('سجل جديد','New record')}</button>}</div>
      </header>
      <RawiBusinessTransactions prefix={prefix} kind={selected.kind} lookups={lookups} onSaved={()=>{loadRecords();refreshLookups();loadDrafts()}}/>
      {genericDraft&&<p className="rawi-std-info">{L('السجلات الجديدة هنا مسودات إدارية محفوظة، وليست فواتير صادرة أو قيودًا مرحّلة أو حركات مخزون منفذة. الاعتماد والترحيل يتطلبان العمليات المحاسبية والمخزنية المخصصة.','These are stored operational drafts, not issued invoices, posted journal entries or executed inventory movements.')}</p>}
      {selected.read_only&&<p className="rawi-std-info">{L('يُحسب التقرير من السجلات التشغيلية الفعلية، ولا ينشئ قيودًا أو إقرارات معتمدة.','This report reads operational data and does not issue certified statements.')}</p>}
      
      {selected.kind==='sales_invoices'&&<section className="rawi-std-issued"><h3>{L('الفواتير الفعلية الصادرة','Actual ERP invoices')}</h3>
       <p className="rawi-std-info">{L('رمز QR يظهر للفواتير الصادرة بعد اكتمال اسم الشركة والرقم الضريبي وتفعيل QR في ملف الشركة. لا يمثل هذا الرمز وحده تكامل المرحلة الثانية.','QR is available for issued invoices with a registered Saudi tax profile. Basic QR alone is not Phase 2 integration.')}</p>
       {realInvoices.length?<div className="rawi-std-invoices">{realInvoices.map(invoice=><div key={invoice.id}>
        <strong>{invoice.invoice_no}</strong><span>{invoice.customer_name||'—'} · {invoice.status} · {(Number(invoice.total_halalas||0)/100).toFixed(2)}</span>
        {['issued','paid'].includes(invoice.status)&&<button type="button" onClick={()=>showInvoiceQr(invoice)}>{L('عرض QR','Show QR')}</button>}
       </div>)}</div>:<p>{L('لا توجد فواتير تشغيلية صادرة بعد','No operational invoices have been issued yet')}</p>}
       {qrImage&&<div className="rawi-std-qr" role="dialog" aria-label={L('رمز الفاتورة','Invoice QR')}><strong>{qrImage.invoice_no}</strong><img src={qrImage.dataUrl} alt={L('رمز QR الأساسي للفاتورة','Basic invoice QR code')}/><small>{L('QR أساسي، ليس شهادة توافق مع المرحلة الثانية','Basic QR, not Phase 2 certification')}</small><button type="button" onClick={()=>setQrImage(null)}>{L('إغلاق','Close')}</button></div>}
      </section>}

      
       {selected.kind==='products'&&productEditor&&<section className="rawi-std-uom-editor">
        <div className="rawi-std-form-top"><strong>{L('وحدات الصنف: ','Product units: ')}{productEditor.product.name}</strong>
         <button type="button" onClick={()=>setProductEditor(null)} aria-label={L('إغلاق','Close')}><X size={17}/></button></div>
        <p className="rawi-std-info">{L('وحدة الأساس: ','Base unit: ')}{productEditor.product.unit} — {L('كل وحدة بديلة تساوي عددًا محددًا من وحدات الأساس','Each alternative represents a quantity of base units')}</p>
        <div className="rawi-std-uom-links">{productEditor.links.map(link=><div key={link.unit_id}><strong>{link.name}{link.is_base?' — الأساس':''}</strong><span>{'1 '+link.name+' = '+Number(link.factor)+' '+productEditor.product.unit}</span><small>{link.barcode||''}</small></div>)}</div>
        <form onSubmit={saveProductUnit} className="rawi-std-uom-form">
         <label>{L('وحدة إضافية','Alternative unit')}<select required value={productUnitDraft.unit_id} onChange={e=>setProductUnitDraft(x=>({...x,unit_id:e.target.value}))}>
          <option value="">{L('اختر وحدة','Choose unit')}</option>{units.filter(u=>u.active&&u.code!==productEditor.product.unit).map(u=><option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
         </select></label>
         <label>{L('معامل التحويل إلى وحدة الأساس','Quantity in base units')}<input required type="number" min="0.000001" step="any" value={productUnitDraft.factor} onChange={e=>setProductUnitDraft(x=>({...x,factor:e.target.value}))}/></label>
         <label>{L('باركود الوحدة','Unit barcode')}<input value={productUnitDraft.barcode} onChange={e=>setProductUnitDraft(x=>({...x,barcode:e.target.value}))}/></label>
         <label>{L('سعر البيع للوحدة (اختياري)','Unit sale price (optional)')}<input type="number" min="0" step="0.01" value={productUnitDraft.sale_price} onChange={e=>setProductUnitDraft(x=>({...x,sale_price:e.target.value}))}/></label>
         <label>{L('سعر الشراء للوحدة (اختياري)','Unit purchase price (optional)')}<input type="number" min="0" step="0.01" value={productUnitDraft.purchase_price} onChange={e=>setProductUnitDraft(x=>({...x,purchase_price:e.target.value}))}/></label>
         <button type="submit" disabled={saving}><Save size={16}/>{L('حفظ وحدة الصنف','Save product unit')}</button>
        </form>
       </section>}

       {selected.kind==='document_sequences'&&<form className="rawi-std-sequence" onSubmit={saveSequence}>
       <label>{L('نوع المستند','Document type')}<select value={sequenceKind} onChange={e=>setSequenceKind(e.target.value)}>{sequences.map(r=><option key={r.kind} value={r.kind}>{r.name} — {groups.find(g=>g.key===r.group)?.title}</option>)}</select></label>
       <label>{L('الرقم التالي (لا يمكن الرجوع للخلف)','Next number (cannot decrease)')}<input type="number" min="1" required value={sequenceValue} onChange={e=>setSequenceValue(e.target.value)}/></label>
       <button disabled={saving} type="submit"><Save size={15}/>{L('حفظ الترقيم','Save numbering')}</button>
      </form>}
      {selected.read_only?recordsLoading?<div className="rawi-std-empty"><Loader2 className="mif-spinner"/></div>:<div className="rawi-std-report">
       {report?.notice&&<p className="rawi-std-info">{report.notice}</p>}
       {report?.data?.length?<div className="rawi-std-table-wrap"><table><thead><tr>{report.columns?.map(key=><th key={key}>{({code:'رمز الحساب',name:'الحساب',type:'النوع',debit_halalas:'مدين (هللة)',credit_halalas:'دائن (هللة)',balance_halalas:'الرصيد (هللة)',invoices:'الفواتير',taxable_sales_halalas:'المبيعات الخاضعة (هللة)',output_vat_halalas:'ضريبة المخرجات (هللة)'})[key]||key}</th>)}</tr></thead><tbody>{report.data.map((r,i)=><tr key={i}>{report.columns?.map(k=><td key={k}>{String(r[k]??'—')}</td>)}</tr>)}</tbody></table></div>:<div className="rawi-std-empty">{L('لا توجد بيانات منشورة للتقرير','No posted report data')}</div>}
      </div>:<>
       {draft&&<form className="rawi-std-form" onSubmit={save}>
        <div className="rawi-std-form-top"><strong>{draft.id?L('تعديل السجل','Edit record'):L('إضافة سجل','Create record')}</strong><button type="button" aria-label={L('إغلاق','Close')} onClick={()=>setDraft(null)}><X size={18}/></button></div>
        <div className="rawi-std-fields">{selected.fields.map(f=><label key={f.key}><span>{f.label}{f.required?' *':''}</span>
         {f.type==='relation'?<select required={f.required} value={draft.values[f.key]||''} onChange={e=>fieldChange(f.key,e.target.value)}>
           <option value="">{L('اختر من سجلات الشركة','Choose a company record')}</option>
           {(lookups[f.target]||[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>:
          selected.kind==='products'&&f.key==='field_3'?<select required value={draft.values[f.key]||''} onChange={e=>fieldChange(f.key,e.target.value)}>
           <option value="">{L('وحدة الأساس','Base unit')}</option>{units.filter(x=>x.active).map(x=><option key={x.id} value={x.code}>{x.name} ({x.code})</option>)}
          </select>:
          selected.kind==='units'&&f.key==='field_3'?<select required value={draft.values[f.key]||'count'} onChange={e=>fieldChange(f.key,e.target.value)}>
           {Object.entries({count:'العدد',weight:'الوزن',volume:'الحجم',length:'الطول',area:'المساحة',time:'الوقت',other:'أخرى'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>:
          selected.kind==='chart_accounts'&&f.key==='field_3'?<select value={draft.values[f.key]||''} onChange={e=>fieldChange(f.key,e.target.value)} required><option value="">{L('اختر','Choose')}</option>{[['asset','أصول'],['liability','التزامات'],['equity','حقوق ملكية'],['income','إيرادات'],['expense','مصروفات']].map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>:
         f.type==='long_text'?<textarea rows={3} value={draft.values[f.key]??''} required={f.required} onChange={e=>fieldChange(f.key,e.target.value)}/>:
         <input type={f.type==='date'?'date':f.type==='number'?'number':'text'} step={f.type==='number'?'any':undefined} min={f.type==='number'?0:undefined} required={f.required} value={draft.values[f.key]??''} onChange={e=>fieldChange(f.key,e.target.value)}/>}
        </label>)}</div>

        {lineKinds.has(selected.kind)&&<section className="rawi-std-document-lines">
         <div className="rawi-std-form-top"><strong>{L('أصناف المستند','Document products')}</strong>
          <button type="button" onClick={()=>setDraft(old=>({...old,lines:[...(old.lines||[]),{item_id:'',unit_id:'',quantity:1}]}))}>{L('إضافة صنف +','Add product +')}</button>
         </div>
         {(draft.lines||[]).map((line,index)=><div className="rawi-std-document-line" key={index}>
          <label>{L('الصنف','Product')}<select required value={line.item_id} onChange={e=>changeLine(index,'item_id',e.target.value)}>
           <option value="">{L('اختر صنفًا','Choose a product')}</option>{(lookups.products||[]).map(x=><option value={x.id} key={x.id}>{x.sku} — {x.name}</option>)}
          </select></label>
          <label>{L('الوحدة','Unit')}<select value={line.unit_id||''} onChange={e=>changeLine(index,'unit_id',e.target.value)}>
           <option value="">{L('وحدة الأساس','Base unit')}</option>{(documentUnitOptions[line.item_id]||[]).filter(x=>!x.is_base).map(x=><option value={x.unit_id} key={x.unit_id}>{x.name} (×{Number(x.factor)})</option>)}
          </select></label>
          <label>{L('الكمية','Quantity')}<input required type="number" min="0.001" step="any" value={line.quantity} onChange={e=>changeLine(index,'quantity',e.target.value)}/></label>
          <button type="button" onClick={()=>setDraft(old=>({...old,lines:old.lines.filter((_,i)=>i!==index)}))}>{L('حذف','Remove')}</button>
         </div>)}
         {!draft.lines?.length&&<p className="rawi-std-info">{L('أضف صنفًا واحدًا على الأقل؛ الأسعار والكميات الأساسية تُحسب من ملف الصنف ووحداته.','Add at least one item; prices and base quantities come from product records and their units.')}</p>}
        </section>}

        {!!selected.stages.length&&<label className="rawi-std-status">{L('الحالة','Status')}<select value={draft.stage||selected.stages[0]} onChange={e=>setDraft(x=>({...x,stage:e.target.value}))}>{selected.stages.map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
        <button type="submit" className="primary" disabled={saving}><Save size={16}/>{saving?L('جاري الحفظ','Saving'):L('حفظ البيانات','Save')}</button>
       </form>}
       <div className="rawi-std-tools"><label><Search size={16}/><input placeholder={L('بحث في سجلات المستودع','Search records')} value={search} onChange={e=>setSearch(e.target.value)}/></label><span>{visible.length} {L('سجل','records')}</span><div className="rawi-std-view-mode"><button type="button" className={viewMode==='table'?'active':''} onClick={()=>setViewMode('table')}>{L('جدول','Table')}</button><button type="button" className={viewMode==='cards'?'active':''} onClick={()=>setViewMode('cards')}>{L('بطاقات','Cards')}</button></div></div>
       {recordsLoading?<div className="rawi-std-empty"><Loader2 className="mif-spinner"/>{L('جاري جلب البيانات','Loading data')}</div>:visible.length?viewMode==='table'?<div className="rawi-std-table-wrap"><table><thead><tr><th>{L('المستند / المرجع','Record / Reference')}</th>{selected.fields.slice(0,4).map(f=><th key={f.key}>{f.label}</th>)}<th>{L('الحالة','Status')}</th><th>{L('الإجراء','Action')}</th></tr></thead><tbody>{visible.map(row=><tr key={row.id}><td><strong>{row.document_number||row.values_json?.document_number||String(row.values_json?.field_1||'—')}</strong></td>{selected.fields.slice(0,4).map(f=><td key={f.key}>{show(f,row.values_json?.[f.key])}</td>)}<td>{row.stage||'—'}</td><td><div className="rawi-std-record-actions">{selected.kind!=='document_sequences'&&<button type="button" onClick={()=>startDraft(row)}>{L('فتح','Open')}</button>}{selected.kind==='products'&&<button type="button" onClick={()=>openProductUnits(row)}>{L('الوحدات','Units')}</button>}{row.values_json?.rawi_source_thread_id&&onOpenThread&&<button type="button" onClick={()=>onOpenThread(row.values_json.rawi_source_thread_id)}>{L('المصدر','Source')}</button>}</div></td></tr>)}</tbody></table></div>:<div className="rawi-std-records">{visible.map(row=><article key={row.id}>
        <div className="rawi-std-record-title"><strong>{row.document_number||row.values_json?.document_number||String(row.values_json?.field_1||selected.name)}</strong>{row.stage&&<small>{row.stage}</small>}</div>
        <div className="rawi-std-record-fields">{selected.fields.filter(f=>row.values_json?.[f.key]!==undefined).map(f=><div key={f.key}><small>{f.label}</small><span>{show(f,row.values_json[f.key])}</span></div>)}</div>
        <div className="rawi-std-record-actions">{selected.kind!=='document_sequences'&&<button type="button" onClick={()=>startDraft(row)}>{L('تعديل','Edit')}</button>}
         {row.values_json?.rawi_source_thread_id&&onOpenThread&&<button type="button" onClick={()=>onOpenThread(row.values_json.rawi_source_thread_id)}>{L('عرض المصدر','View source')}</button>}
         {selected.kind==='products'&&<button type="button" onClick={()=>openProductUnits(row)}>{L('وحدات الصنف','Product units')}</button>}</div>
       </article>)}</div>:<div className="rawi-std-empty">{L('لا توجد سجلات بعد في هذا المستودع','No records saved in this repository yet')}</div>}
      </>}
     </>}
    </div>
   </div>
  </>}
 </section>;
}
