import React,{useEffect,useMemo,useState} from 'react';
import {api,useSite,tr} from './App.jsx';
import {CheckCircle2,FileText,Loader2,Plus,RefreshCw,Save,ShieldCheck} from 'lucide-react';
import './rawi-business-transactions.css';

const emptyLine=()=>({item_id:'',quantity:1});
const emptyJournalLine=()=>({account_id:'',debit:'',credit:''});
const emptyPayment=()=>({reference:'',amount:'',method:'bank',invoice_id:'',details:'',recorded_at:new Date().toISOString().slice(0,10)});
const currency=n=>(Number(n||0)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const kinds={
 sales_orders:{section:'documents',type:'sale'},
 purchase_orders:{section:'documents',type:'purchase'},
 sales_invoices:{section:'invoices'},
 journal_entries:{section:'journal'},
 sales_receipts:{section:'payments',direction:'incoming'},
 accounting_receipts:{section:'payments',direction:'incoming'},
 payment_vouchers:{section:'payments',direction:'outgoing'}
};
export default function RawiBusinessTransactions({prefix,kind,lookups={},onSaved=()=>{}}){
 const {lang}=useSite(),L=(a,e)=>tr(lang,a,e),config=kinds[kind];
 const [rows,setRows]=useState([]),[invoices,setInvoices]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[open,setOpen]=useState(false);
 const [partner,setPartner]=useState(''),[lines,setLines]=useState([emptyLine()]),[notes,setNotes]=useState('');
 const [reference,setReference]=useState(''),[memo,setMemo]=useState(''),[postedOn,setPostedOn]=useState(new Date().toISOString().slice(0,10)),[journalLines,setJournalLines]=useState([emptyJournalLine(),emptyJournalLine()]);
 const [payment,setPayment]=useState(emptyPayment);
 const list=useMemo(()=>kind==='sales_orders'?rows.filter(r=>r.kind==='sale'):kind==='purchase_orders'?rows.filter(r=>r.kind==='purchase'):kind==='sales_receipts'||kind==='accounting_receipts'?rows.filter(r=>r.direction==='incoming'):kind==='payment_vouchers'?rows.filter(r=>r.direction==='outgoing'):rows,[rows,kind]);
 const refresh=async()=>{if(!prefix||!config)return;setLoading(true);setError('');
  try{
   if(config.section==='documents'){const [d,i]=await Promise.all([api(prefix+'/core/documents'),api(prefix+'/invoices')]);setRows(d.data||[]);setInvoices(i.data||[]);}
   else if(config.section==='invoices'){const [d,i]=await Promise.all([api(prefix+'/core/documents'),api(prefix+'/invoices')]);setRows(i.data||[]);setInvoices(d.data||[]);}
   else if(config.section==='journal'){const d=await api(prefix+'/core/journal');setRows(d.data||[]);}
   else {const d=await api(prefix+'/advanced/payments');setRows(d.payments||[]);setInvoices(d.invoices||[]);}
  }catch(e){setError(e.message)}finally{setLoading(false)}
 };
 useEffect(()=>{setRows([]);setOpen(false);setMessage('');if(prefix&&config)refresh()},[prefix,kind]);
 if(!config)return null;
 const updateLine=(index,key,value)=>setLines(old=>old.map((line,i)=>i===index?{...line,[key]:value}:line));
 const updateJournal=(index,key,value)=>setJournalLines(old=>old.map((line,i)=>i===index?{...line,[key]:value}:line));
 const totals=journalLines.reduce((acc,x)=>({debit:acc.debit+Number(x.debit||0),credit:acc.credit+Number(x.credit||0)}),{debit:0,credit:0});
 const request=async(fn)=>{if(busy)return;setBusy(true);setError('');setMessage('');
  try{const msg=await fn();setMessage(msg||L('تم حفظ العملية بنجاح','Transaction saved'));setOpen(false);await refresh();onSaved()}
  catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const create=event=>{event.preventDefault();
  request(async()=>{
   if(config.section==='documents'){
    const result=await api(prefix+'/core/documents',{method:'POST',body:JSON.stringify({kind:config.type,partner_id:partner,lines:lines.map(x=>({item_id:x.item_id,quantity:Number(x.quantity)})),notes})});
    setPartner('');setLines([emptyLine()]);setNotes('');
    return L('تم إنشاء مستند '+result.data.doc_no+' كمسودة تشغيلية','Saved '+result.data.doc_no+' as a draft');
   }
   if(config.section==='journal'){
    const converted=journalLines.map(x=>({account_id:x.account_id,debit:Number(x.debit||0),credit:Number(x.credit||0)}));
    const debit=converted.reduce((n,x)=>n+x.debit,0),credit=converted.reduce((n,x)=>n+x.credit,0);
    if(!debit||Math.abs(debit-credit)>0.001)throw Error(L('يجب أن يتساوى إجمالي المدين والدائن','Total debits and credits must balance'));
    if(!window.confirm(L('تأكيد تسجيل القيد في دفتر اليومية؟','Confirm posting this journal entry?')))return '';
    await api(prefix+'/core/journal',{method:'POST',body:JSON.stringify({reference,memo,posted_on:postedOn,lines:converted})});
    setReference('');setMemo('');setJournalLines([emptyJournalLine(),emptyJournalLine()]);
    return L('تم حفظ القيد المتوازن في دفتر اليومية','Balanced journal entry posted');
   }
   if(config.section==='payments'){
    if(!window.confirm(L('تأكيد تسجيل السند؟ هذا السجل لا يقوم بتسوية الفاتورة أو ترحيل قيد تلقائيًا.','Record this voucher? It does not automatically reconcile or post accounting entries.')))return '';
    await api(prefix+'/advanced/payments',{method:'POST',body:JSON.stringify({
     direction:config.direction,reference:payment.reference,amount_halalas:Math.round(Number(payment.amount)*100),
     method:payment.method,invoice_id:payment.invoice_id||null,recorded_at:payment.recorded_at,details:payment.details
    })});
    setPayment(emptyPayment());
    return L('تم حفظ سند الحركة النقدية، ولم يتم ترحيل قيد محاسبي تلقائي','Voucher saved without automatic accounting posting');
   }
  });
 };
 const action=(id,mode)=>request(async()=>{
  if(mode==='confirm'){await api(prefix+'/core/documents/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status:'confirmed'})});return L('تم تأكيد الأمر','Order confirmed')}
  if(mode==='invoice'){const r=await api(prefix+'/core/documents/'+encodeURIComponent(id)+'/invoice',{method:'POST',body:'{}'});return L('تم إنشاء الفاتورة المرتبطة: ','Linked invoice created: ')+(r.data?.invoice_no||'')}
 });
 const available=kind==='purchase_orders'?lookups.vendors||[]:lookups.customers||[];
 const canCreate=config.section!=='invoices';
 return <section className="rawi-live" aria-label={L('العمليات المالية والتجارية الفعلية','Live business transactions')}>
  <header className="rawi-live-head"><div><strong><ShieldCheck size={17}/>{L('السجلات التشغيلية الفعلية','Validated business transactions')}</strong>
   <small>{config.section==='payments'?L('سجل سندات قبض وصرف؛ لا يُرحّل قيودًا محاسبية آليًا','Payment register; no automatic GL posting'):config.section==='invoices'?L('فواتير منشأة من أوامر بيع مؤكدة','Invoices linked to confirmed sales orders'):L('البيانات محفوظة في جداول التشغيل الرئيسية للشركة','Stored in company operational tables')}</small></div>
   <div className="rawi-live-actions"><button type="button" onClick={refresh} disabled={loading||busy}><RefreshCw size={16}/>{L('تحديث','Refresh')}</button>{canCreate&&<button type="button" className="rawi-live-primary" onClick={()=>setOpen(x=>!x)}><Plus size={16}/>{L('إنشاء عملية فعلية','New transaction')}</button>}</div>
  </header>
  {error&&<p role="alert" className="rawi-live-error">{error}</p>}{message&&<p role="status" className="rawi-live-notice">{message}</p>}
  {open&&canCreate&&<form className="rawi-live-editor" onSubmit={create}>
   {config.section==='documents'&&<>
    <div className="rawi-live-fields"><label>{config.type==='sale'?L('العميل','Customer'):L('المورد','Supplier')}<select required value={partner} onChange={e=>setPartner(e.target.value)}><option value="">{L('اختر من بيانات الشركة','Choose existing contact')}</option>{available.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>{L('ملاحظات الأمر','Order notes')}<input value={notes} maxLength={2000} onChange={e=>setNotes(e.target.value)}/></label></div>
    <div className="rawi-live-line-label"><strong>{L('بنود الأمر','Order lines')}</strong><button type="button" onClick={()=>setLines(a=>[...a,emptyLine()])}>{L('إضافة بند','Add line')}</button></div>
    {lines.map((line,i)=><div key={i} className="rawi-live-line">
     <label>{L('الصنف','Product')}<select required value={line.item_id} onChange={e=>updateLine(i,'item_id',e.target.value)}><option value="">{L('اختر المنتج','Select item')}</option>{(lookups.products||[]).map(p=><option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></label>
     <label>{L('الكمية بوحدة الأساس','Base unit quantity')}<input type="number" required min="0.001" max="100000" step="0.001" value={line.quantity} onChange={e=>updateLine(i,'quantity',e.target.value)}/></label>
     <button type="button" disabled={lines.length===1} onClick={()=>setLines(a=>a.filter((_,j)=>j!==i))}>{L('حذف','Remove')}</button></div>)}
   </>}
   {config.section==='journal'&&<>
    <div className="rawi-live-fields"><label>{L('مرجع القيد','Journal reference')}<input value={reference} required minLength={2} onChange={e=>setReference(e.target.value)}/></label><label>{L('تاريخ القيد','Posting date')}<input type="date" required value={postedOn} onChange={e=>setPostedOn(e.target.value)}/></label><label className="rawi-live-wide">{L('البيان','Memo')}<input value={memo} onChange={e=>setMemo(e.target.value)}/></label></div>
    <div className="rawi-live-line-label"><strong>{L('الأطراف المدينة والدائنة','Debit and credit lines')}</strong><button type="button" onClick={()=>setJournalLines(a=>[...a,emptyJournalLine()])}>{L('إضافة طرف','Add line')}</button></div>
    {journalLines.map((line,i)=><div className="rawi-live-journal-line" key={i}>
     <label>{L('الحساب','Account')}<select required value={line.account_id} onChange={e=>updateJournal(i,'account_id',e.target.value)}><option value="">{L('حدد الحساب من الدليل','Select GL account')}</option>{(lookups.accounts||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
     <label>{L('مدين','Debit')}<input type="number" min="0" step="0.01" value={line.debit} onChange={e=>updateJournal(i,'debit',e.target.value)}/></label>
     <label>{L('دائن','Credit')}<input type="number" min="0" step="0.01" value={line.credit} onChange={e=>updateJournal(i,'credit',e.target.value)}/></label>
     <button type="button" disabled={journalLines.length<=2} onClick={()=>setJournalLines(a=>a.filter((_,j)=>j!==i))}>{L('حذف','Remove')}</button>
    </div>)}
    <div className="rawi-live-totals"><span>{L('إجمالي المدين','Debits')}: {totals.debit.toFixed(2)}</span><span>{L('إجمالي الدائن','Credits')}: {totals.credit.toFixed(2)}</span><strong>{Math.abs(totals.debit-totals.credit)<0.001&&totals.debit>0?L('متوازن','Balanced'):L('غير متوازن','Unbalanced')}</strong></div>
   </>}
   {config.section==='payments'&&<div className="rawi-live-fields">
    <label>{L('مرجع السند','Voucher reference')}<input required minLength={2} value={payment.reference} onChange={e=>setPayment(p=>({...p,reference:e.target.value}))}/></label>
    <label>{L('المبلغ بالريال','Amount (SAR)')}<input type="number" min="0.01" max="100000000" step="0.01" required value={payment.amount} onChange={e=>setPayment(p=>({...p,amount:e.target.value}))}/></label>
    <label>{L('طريقة السداد','Method')}<select value={payment.method} onChange={e=>setPayment(p=>({...p,method:e.target.value}))}><option value="bank">{L('بنك','Bank')}</option><option value="cash">{L('نقدي','Cash')}</option></select></label>
    <label>{L('تاريخ السند','Date')}<input type="date" required value={payment.recorded_at} onChange={e=>setPayment(p=>({...p,recorded_at:e.target.value}))}/></label>
    {config.direction==='incoming'&&<label>{L('الفاتورة المرتبطة (اختياري)','Related invoice (optional)')}<select value={payment.invoice_id} onChange={e=>setPayment(p=>({...p,invoice_id:e.target.value}))}><option value="">{L('بدون ربط فاتورة','No invoice')}</option>{invoices.filter(x=>['issued','paid'].includes(x.status)).map(i=><option key={i.id} value={i.id}>{i.invoice_no} · {currency(i.total_halalas)}</option>)}</select></label>}
    <label className="rawi-live-wide">{L('البيان','Details')}<input value={payment.details} onChange={e=>setPayment(p=>({...p,details:e.target.value}))}/></label>
   </div>}
   <button type="submit" className="rawi-live-primary" disabled={busy}><Save size={16}/>{busy?L('جاري الحفظ','Saving'):L('حفظ في قاعدة الشركة','Save transaction')}</button>
  </form>}
  {loading?<div className="rawi-live-empty"><Loader2 size={19} className="mif-spinner"/>{L('جاري تحميل الحركات','Loading transactions')}</div>:list.length?<div className="rawi-live-table"><table><thead><tr><th>{L('المرجع','Reference')}</th><th>{L('التاريخ','Date')}</th><th>{L('الإجمالي (ر.س)','Amount (SAR)')}</th><th>{L('الحالة','Status')}</th>{config.section==='documents'&&<th>{L('الإجراءات','Actions')}</th>}</tr></thead><tbody>{list.map(row=><tr key={row.id}>
   <td><FileText size={14}/>{row.doc_no||row.invoice_no||row.reference}</td>
   <td>{String(row.created_at||row.recorded_at||row.posted_on||'').slice(0,10)}</td>
   <td>{currency(row.total_halalas??row.amount_halalas??row.debit_halalas)}</td>
   <td>{row.status|| (config.section==='journal'?L('مسجل','Recorded'):L('مسجل','Recorded'))}</td>
   {config.section==='documents'&&<td className="rawi-live-row-actions">{row.status==='draft'&&<button type="button" disabled={busy} onClick={()=>action(row.id,'confirm')}><CheckCircle2 size={14}/>{L('تأكيد الأمر','Confirm')}</button>}{row.kind==='sale'&&['confirmed','completed'].includes(row.status)&&<button type="button" disabled={busy||invoices.some(i=>i.source_document_id===row.id)} onClick={()=>action(row.id,'invoice')}><FileText size={14}/>{invoices.some(i=>i.source_document_id===row.id)?L('تمت الفوترة','Invoiced'):L('إنشاء فاتورة','Invoice')}</button>}</td>}
   </tr>)}</tbody></table></div>:<div className="rawi-live-empty">{L('لا توجد معاملات فعلية في هذا المستودع حتى الآن','No operational transactions yet')}</div>}
  {kind==='sales_invoices'&&<p className="rawi-live-hint">{L('لإنشاء فاتورة فعلية: أنشئ أمر بيع، أكّد الأمر، ثم اضغط إنشاء فاتورة. المسودة وحدها لا تُصدر فاتورة.','To create an invoice: create a sales order, confirm it, then issue the invoice. Drafts are not issued invoices.')}</p>}
 </section>;
}
