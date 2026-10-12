import React,{useEffect,useMemo,useState} from 'react';
import {api,useSite,tr} from './App.jsx';
import {CheckCircle2,FileText,Loader2,Plus,RefreshCw,Save,ShieldCheck} from 'lucide-react';
import './rawi-business-transactions.css';

const emptyLine=()=>({item_id:'',unit_id:'',quantity:1});
const emptyInvoiceLine=()=>({item_id:'',description:'',quantity:1,unit_price:''});
const emptyJournalLine=()=>({account_id:'',debit:'',credit:''});
const emptyPayment=()=>({request_id:crypto.randomUUID(),reference:'',amount:'',method:'bank',invoice_id:'',cash_account_id:'',counterpart_account_id:'',details:'',recorded_at:new Date().toISOString().slice(0,10)});
const currency=n=>(Number(n||0)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const kinds={
 sales_orders:{section:'documents',type:'sale'},
 purchase_orders:{section:'documents',type:'purchase'},
 sales_invoices:{section:'invoices'},
 journal_entries:{section:'journal'},
 sales_receipts:{section:'payments',direction:'incoming'},
 accounting_receipts:{section:'payments',direction:'incoming'},
 payment_vouchers:{section:'payments',direction:'outgoing'},
 price_lists:{section:'pricing'}
};
export default function RawiBusinessTransactions({prefix,kind,lookups={},sourceDraft=null,onSaved=()=>{}}){
 const {lang}=useSite(),L=(a,e)=>tr(lang,a,e),config=kinds[kind];
 const [rows,setRows]=useState([]),[invoices,setInvoices]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[open,setOpen]=useState(false);
 const [partner,setPartner]=useState(''),[lines,setLines]=useState([emptyLine()]),[notes,setNotes]=useState(''),[unitOptions,setUnitOptions]=useState({});
 const [invoiceLines,setInvoiceLines]=useState([emptyInvoiceLine()]),[invoiceDate,setInvoiceDate]=useState(new Date().toISOString().slice(0,10)),[dueDate,setDueDate]=useState('');
 const [reference,setReference]=useState(''),[memo,setMemo]=useState(''),[postedOn,setPostedOn]=useState(new Date().toISOString().slice(0,10)),[journalLines,setJournalLines]=useState([emptyJournalLine(),emptyJournalLine()]);
 const [payment,setPayment]=useState(emptyPayment),[priceItem,setPriceItem]=useState(''),[salePrice,setSalePrice]=useState('');
 const [issueFor,setIssueFor]=useState(null),[issueAccounts,setIssueAccounts]=useState({receivable_account_id:'',revenue_account_id:'',vat_account_id:''});
 const [receiveFor,setReceiveFor]=useState(null),[receiveWarehouse,setReceiveWarehouse]=useState('');
 const list=useMemo(()=>kind==='sales_orders'?rows.filter(r=>r.kind==='sale'):kind==='purchase_orders'?rows.filter(r=>r.kind==='purchase'):kind==='sales_receipts'||kind==='accounting_receipts'?rows.filter(r=>r.direction==='incoming'):kind==='payment_vouchers'?rows.filter(r=>r.direction==='outgoing'):rows,[rows,kind]);
 const loadUnits=async itemId=>{if(!itemId||unitOptions[itemId])return;try{const r=await api(prefix+'/system/items/'+encodeURIComponent(itemId)+'/units');setUnitOptions(prev=>({...prev,[itemId]:r.data||[]}))}catch(e){setError(e.message)}};
 const refresh=async()=>{if(!prefix||!config)return;setLoading(true);setError('');
  try{
   if(config.section==='documents'){const [d,i]=await Promise.all([api(prefix+'/core/documents'),api(prefix+'/invoices')]);setRows(d.data||[]);setInvoices(i.data||[]);}
   else if(config.section==='invoices'){const [d,i]=await Promise.all([api(prefix+'/core/documents'),api(prefix+'/invoices')]);setRows(i.data||[]);setInvoices(d.data||[]);}
   else if(config.section==='journal'){const d=await api(prefix+'/core/journal');setRows(d.data||[]);}
   else if(config.section==='pricing'){const d=await api(prefix+'/core/items');setRows(d.data||[]);}
   else {const d=await api(prefix+'/advanced/payments');setRows(d.payments||[]);setInvoices(d.invoices||[]);}
  }catch(e){setError(e.message)}finally{setLoading(false)}
 };
 useEffect(()=>{setRows([]);setOpen(false);setIssueFor(null);setReceiveFor(null);setPartner('');setInvoiceLines([emptyInvoiceLine()]);setMessage('');if(prefix&&config)refresh()},[prefix,kind]);
 useEffect(()=>{if(!sourceDraft||sourceDraft.kind!==kind)return;
  const values=sourceDraft.values||{};
  if(config?.section==='documents'){
   setPartner(sourceDraft.partner_id||'');
   const prepared=(sourceDraft.lines||[]).map(x=>({item_id:x.item_id,unit_id:x.unit_id||'',quantity:Number(x.quantity)||1})).filter(x=>x.item_id).slice(0,80);
   setLines(prepared.length?prepared:[emptyLine()]);prepared.forEach(x=>loadUnits(x.item_id));
   setNotes('مسودة راوي '+(sourceDraft.document_number||'')+' | المصدر: '+sourceDraft.id);
  }else if(config?.section==='invoices'){
   setPartner(sourceDraft.partner_id||'');
   const suggested=(sourceDraft.lines||[]).map(line=>{
    const product=(lookups.products||[]).find(p=>p.id===line.item_id);
    return {item_id:line.item_id||'',description:product?.name||'',quantity:Number(line.quantity)||1,
     unit_price:line.unit_price_halalas!=null?String(Number(line.unit_price_halalas)/100):product?String(Number(product.sale_price_halalas||0)/100):''};
   }).slice(0,80);
   setInvoiceLines(suggested.length?suggested:[emptyInvoiceLine()]);
   setNotes('مسودة راوي '+(sourceDraft.document_number||'')+' | المصدر: '+sourceDraft.id);
   if(/^\d{4}-\d{2}-\d{2}$/.test(String(values.field_2||'')))setInvoiceDate(values.field_2);
   if(/^\d{4}-\d{2}-\d{2}$/.test(String(values.field_3||'')))setDueDate(values.field_3);
  }else if(config?.section==='payments'){
   const ref=kind==='sales_receipts'?values.field_5:values.field_1;
   const method=String(values.field_4||'').toLowerCase();
   setPayment({request_id:sourceDraft.id,reference:String(ref||sourceDraft.document_number||'سند راوي').slice(0,180),
    amount:values.field_2==null?'':String(values.field_2),method:/نقد|cash/.test(method)?'cash':'bank',
    invoice_id:'',cash_account_id:'',counterpart_account_id:'',details:'مسودة راوي: '+sourceDraft.id,
    recorded_at:/^\d{4}-\d{2}-\d{2}$/.test(String(values.field_3||''))?values.field_3:new Date().toISOString().slice(0,10)});
  }else if(config?.section==='journal'){
   setReference(String(values.field_1||sourceDraft.document_number||'قيد راوي').slice(0,120));
   setMemo(String(values.field_3||'مسودة راوي: '+sourceDraft.id).slice(0,800));
   if(/^\d{4}-\d{2}-\d{2}$/.test(String(values.field_2||'')))setPostedOn(values.field_2);
   setJournalLines([{account_id:'',debit:String(values.field_4||''),credit:''},{account_id:'',debit:'',credit:String(values.field_5||'')}]);
  }else return;
  setOpen(true);setError('');setMessage(L('المسودة جاهزة للمراجعة. اختر الحسابات أو البيانات الناقصة واعتمد العملية بنفسك.','Review the imported draft, select any missing accounts and confirm the actual transaction.'));
 },[sourceDraft?.token,prefix,kind]);
 if(!config)return null;
 const updateLine=(index,key,value)=>{setLines(old=>old.map((line,i)=>i===index?{...line,[key]:value,...(key==='item_id'?{unit_id:''}:{})}:line));if(key==='item_id')loadUnits(value)};
 const updateJournal=(index,key,value)=>setJournalLines(old=>old.map((line,i)=>i===index?{...line,[key]:value}:line));
 const updateInvoiceLine=(index,key,value)=>setInvoiceLines(old=>old.map((line,i)=>i===index?{...line,[key]:value}:line));
 const pickInvoiceProduct=(index,id)=>{const product=(lookups.products||[]).find(x=>x.id===id);setInvoiceLines(old=>old.map((line,i)=>i===index?{...line,item_id:id,description:product?.name||line.description,unit_price:product?String(Number(product.sale_price_halalas||0)/100):line.unit_price}:line))};
 const totals=journalLines.reduce((acc,x)=>({debit:acc.debit+Number(x.debit||0),credit:acc.credit+Number(x.credit||0)}),{debit:0,credit:0});
 const request=async(fn)=>{if(busy)return;setBusy(true);setError('');setMessage('');
  try{const msg=await fn();setMessage(msg||L('تم حفظ العملية بنجاح','Transaction saved'));setOpen(false);await refresh();onSaved()}
  catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const create=event=>{event.preventDefault();
  if(config.section==='journal'&&!window.confirm(L('تأكيد تسجيل القيد المتوازن في دفتر اليومية؟','Confirm posting the balanced journal entry?')))return;
  if(config.section==='payments'&&!window.confirm(L('سيُحفظ السند مع قيد محاسبي متوازن. راجع الحسابين والمبلغ قبل التأكيد. لا تتم تسوية الفاتورة تلقائيًا.','Save this voucher and its balanced journal entry? Review both accounts and amount; invoice reconciliation remains separate.')))return;
  request(async()=>{
   if(config.section==='documents'){
    if(sourceDraft?.kind===kind&&rows.some(d=>String(d.notes||'').includes(sourceDraft.id)))throw Error(L('تم إنشاء أمر فعلي من هذه المسودة بالفعل. افتح الأمر السابق بدل التكرار.','This draft has already been used to create an operational order.'));
    const result=await api(prefix+'/core/documents',{method:'POST',body:JSON.stringify({kind:config.type,partner_id:partner,lines:lines.map(x=>({item_id:x.item_id,quantity:Number(x.quantity),...(x.unit_id?{unit_id:x.unit_id}:{})})),notes})});
    setPartner('');setLines([emptyLine()]);setNotes('');
    return L('تم إنشاء مستند '+result.data.doc_no+' كمسودة تشغيلية','Saved '+result.data.doc_no+' as a draft');
   }
   if(config.section==='invoices'){
    const result=await api(prefix+'/invoices',{method:'POST',body:JSON.stringify({
     customer_id:partner,issued_on:invoiceDate,due_on:dueDate||null,notes,
     lines:invoiceLines.map(x=>({description:x.description,quantity:Number(x.quantity),unit_price:Number(x.unit_price)}))
    })});
    if(!result.data?.id||!result.data?.invoice_no)throw Error(L('لم يؤكد الخادم إنشاء مسودة الفاتورة','Invoice draft was not confirmed'));
    setPartner('');setInvoiceLines([emptyInvoiceLine()]);setNotes('');setDueDate('');
    return L('تم حفظ الفاتورة ','Invoice ')+result.data.invoice_no+L(' كمسودة. راجعها قبل إصدارها وترحيل القيد.',' saved as draft. Review it before ledger posting.');
   }
   if(config.section==='journal'){
    const converted=journalLines.map(x=>({account_id:x.account_id,debit:Number(x.debit||0),credit:Number(x.credit||0)}));
    const debit=converted.reduce((n,x)=>n+x.debit,0),credit=converted.reduce((n,x)=>n+x.credit,0);
    if(!debit||Math.abs(debit-credit)>0.001)throw Error(L('يجب أن يتساوى إجمالي المدين والدائن','Total debits and credits must balance'));
    await api(prefix+'/core/journal',{method:'POST',body:JSON.stringify({reference,memo,posted_on:postedOn,lines:converted})});
    setReference('');setMemo('');setJournalLines([emptyJournalLine(),emptyJournalLine()]);
    return L('تم حفظ القيد المتوازن في دفتر اليومية','Balanced journal entry posted');
   }
   if(config.section==='pricing'){
    const item=rows.find(x=>x.id===priceItem);
    if(!item)throw Error(L('اختر صنفًا من قائمة المنتجات','Choose a product'));
    const price=Number(salePrice);
    if(!Number.isFinite(price)||price<0||price>100000000)throw Error(L('سعر البيع غير صحيح','Invalid sale price'));
    await api(prefix+'/core/items',{method:'POST',body:JSON.stringify({sku:item.sku,name:item.name,type:item.type,unit:item.unit,sale_price:price,cost:Number(item.cost_halalas||0)/100})});
    setPriceItem('');setSalePrice('');
    return L('تم تحديث سعر بيع الصنف في ملف المنتجات، وستستخدمه أوامر البيع التالية','Product sale price updated for new sales orders');
   }
   if(config.section==='payments'){
    const result=await api(prefix+'/advanced/payments',{method:'POST',body:JSON.stringify({
     direction:config.direction,reference:payment.reference,amount_halalas:Math.round(Number(payment.amount)*100),
     method:payment.method,invoice_id:payment.invoice_id||null,recorded_at:payment.recorded_at,details:payment.details,
     cash_account_id:payment.cash_account_id,counterpart_account_id:payment.counterpart_account_id,request_id:payment.request_id
    })});
    if(!result.posted||!result.journal_entry_id)throw Error(L('السند لم يؤكد ترحيل القيد المحاسبي','Voucher was not confirmed as posted to the ledger'));
    setPayment(emptyPayment());
    return L('تم حفظ السند وترحيل القيد المحاسبي المتوازن','Voucher and balanced journal entry saved');
   }
  });
 };
 const issueInvoice=event=>{event.preventDefault();if(!issueFor||busy)return;
  if(!window.confirm(L('تأكيد إصدار الفاتورة وترحيل إيراداتها والضريبة والذمم المدينة في قيد متوازن؟','Issue this sales invoice and post receivables, revenue and VAT to the ledger?')))return;
  request(async()=>{
   const r=await api(prefix+'/invoices/'+encodeURIComponent(issueFor.id)+'/issue',{method:'POST',body:JSON.stringify({...issueAccounts,vat_account_id:issueAccounts.vat_account_id||null})});
   if(!r.posted||!r.data?.journal_entry_id)throw Error(L('لم يؤكد الخادم ترحيل الفاتورة','The server did not confirm invoice posting'));
   setIssueFor(null);
   return L('صدرت الفاتورة وتم ترحيل قيدها المحاسبي','Invoice issued and journal entry posted');
  });
 };
 const receivePurchase=event=>{event.preventDefault();if(!receiveFor||!receiveWarehouse||busy)return;
  if(!window.confirm(L('تأكيد استلام جميع الأصناف المخزنية لأمر الشراء في المستودع المحدد؟','Confirm full goods receipt of this purchase order into the chosen warehouse?')))return;
  request(async()=>{
   const r=await api(prefix+'/core/documents/'+encodeURIComponent(receiveFor.id)+'/receive',{method:'POST',body:JSON.stringify({warehouse_id:receiveWarehouse})});
   setReceiveFor(null);setReceiveWarehouse('');
   return L('تم استلام أمر الشراء وتسجيل ','Purchase order received with ')+r.data?.movement_count+L(' حركات مخزنية',' inventory movements');
  });
 };
 const action=(id,mode)=>request(async()=>{
  if(mode==='paid'){await api(prefix+'/invoices/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status:'paid'})});return L('تم تحديث حالة الفاتورة إلى مدفوعة بعد التحقق من السندات المرحّلة','Invoice marked paid after validating posted receipts')}
  if(mode==='confirm'){if(!window.confirm(L('تأكيد أمر البيع أو الشراء؟','Confirm the sales or purchase order?')))return L('لم تُنفّذ عملية','No change made');await api(prefix+'/core/documents/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status:'confirmed'})});return L('تم تأكيد الأمر','Order confirmed')}
  if(mode==='invoice'){const r=await api(prefix+'/core/documents/'+encodeURIComponent(id)+'/invoice',{method:'POST',body:'{}'});return L('تم إنشاء الفاتورة المرتبطة: ','Linked invoice created: ')+(r.data?.invoice_no||'')}
 });
 const available=kind==='purchase_orders'?lookups.vendors||[]:lookups.customers||[];
 const canCreate=true;
 return <section className="rawi-live" aria-label={L('العمليات المالية والتجارية الفعلية','Live business transactions')}>
  <header className="rawi-live-head"><div><strong><ShieldCheck size={17}/>{L('السجلات التشغيلية الفعلية','Validated business transactions')}</strong>
   <small>{config.section==='payments'?L('كل سند جديد مرتبط بقيد يومية متوازن؛ يلزم اختيار حساب النقدية والحساب المقابل','Every new voucher posts a balanced journal entry after selecting two accounts'):config.section==='invoices'?L('فواتير منشأة من أوامر بيع مؤكدة','Invoices linked to confirmed sales orders'):L('البيانات محفوظة في جداول التشغيل الرئيسية للشركة','Stored in company operational tables')}</small></div>
   <div className="rawi-live-actions"><button type="button" onClick={refresh} disabled={loading||busy}><RefreshCw size={16}/>{L('تحديث','Refresh')}</button>{canCreate&&<button type="button" className="rawi-live-primary" onClick={()=>setOpen(x=>!x)}><Plus size={16}/>{L('إنشاء عملية فعلية','New transaction')}</button>}</div>
  </header>
  {error&&<p role="alert" className="rawi-live-error">{error}</p>}{message&&<p role="status" className="rawi-live-notice">{message}</p>}
  {receiveFor&&kind==='purchase_orders'&&<form className="rawi-live-editor" onSubmit={receivePurchase}>
   <strong>{L('استلام أمر شراء كامل: ','Receive entire purchase order: ')}{receiveFor.doc_no}</strong>
   <p className="rawi-live-hint">{L('سيضيف الاستلام جميع الأصناف المخزنية بالكميات الأساسية إلى المستودع، ويسجل الحركات، ويحوّل الأمر إلى مكتمل. لا يتم إنشاء فاتورة مورد أو قيد محاسبي تلقائيًا.','Receives all stock items into the warehouse and completes the purchase order. Supplier invoice and payable journal are not created automatically.')}</p>
   <label>{L('مستودع الاستلام','Receiving warehouse')}<select required value={receiveWarehouse} onChange={e=>setReceiveWarehouse(e.target.value)}><option value="">{L('اختر المستودع','Select warehouse')}</option>{(lookups.warehouses||[]).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
   <div className="rawi-live-actions"><button type="button" onClick={()=>setReceiveFor(null)}>{L('إلغاء','Cancel')}</button><button className="rawi-live-primary" type="submit" disabled={busy}><Save size={16}/>{L('تأكيد الاستلام','Post receipt')}</button></div>
  </form>}
  {issueFor&&config.section==='invoices'&&<form className="rawi-live-editor" onSubmit={issueInvoice}>
   <strong>{L('إصدار وترحيل الفاتورة: ','Issue and post invoice: ')}{issueFor.invoice_no}</strong>
   <p className="rawi-live-hint">{L('قيد تلقائي: مدين الذمم المدينة بإجمالي الفاتورة، دائن الإيرادات قبل الضريبة، ودائن ضريبة المخرجات. اختر الحسابات المطابقة من دليل الشركة.','Balanced GL: debit receivables for gross total; credit revenue for subtotal and output VAT. Choose matching GL accounts.')}</p>
   <div className="rawi-live-fields">
    <label>{L('حساب الذمم المدينة (أصول)','Accounts receivable (asset)')}<select required value={issueAccounts.receivable_account_id} onChange={e=>setIssueAccounts(x=>({...x,receivable_account_id:e.target.value}))}><option value="">{L('اختر حساب الذمم','Select receivables')}</option>{(lookups.accounts||[]).filter(a=>a.type==='asset').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>{L('حساب إيرادات المبيعات','Sales revenue (income)')}<select required value={issueAccounts.revenue_account_id} onChange={e=>setIssueAccounts(x=>({...x,revenue_account_id:e.target.value}))}><option value="">{L('اختر الإيرادات','Select revenue')}</option>{(lookups.accounts||[]).filter(a=>a.type==='income').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    {Number(issueFor.vat_halalas)>0&&<label>{L('حساب ضريبة المخرجات (التزامات)','Output VAT (liability)')}<select required value={issueAccounts.vat_account_id} onChange={e=>setIssueAccounts(x=>({...x,vat_account_id:e.target.value}))}><option value="">{L('اختر ضريبة المخرجات','Select VAT')}</option>{(lookups.accounts||[]).filter(a=>a.type==='liability').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
   </div>
   <div className="rawi-live-actions"><button type="button" onClick={()=>setIssueFor(null)}>{L('إلغاء','Cancel')}</button><button className="rawi-live-primary" type="submit" disabled={busy}><Save size={16}/>{L('إصدار وترحيل','Issue and post')}</button></div>
  </form>}
  {open&&canCreate&&<form className="rawi-live-editor" onSubmit={create}>
   {config.section==='documents'&&<>
    <div className="rawi-live-fields"><label>{config.type==='sale'?L('العميل','Customer'):L('المورد','Supplier')}<select required value={partner} onChange={e=>setPartner(e.target.value)}><option value="">{L('اختر من بيانات الشركة','Choose existing contact')}</option>{available.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>{L('ملاحظات الأمر','Order notes')}<input value={notes} maxLength={2000} onChange={e=>setNotes(e.target.value)}/></label></div>
    <div className="rawi-live-line-label"><strong>{L('بنود الأمر','Order lines')}</strong><button type="button" onClick={()=>setLines(a=>[...a,emptyLine()])}>{L('إضافة بند','Add line')}</button></div>
    {lines.map((line,i)=><div key={i} className="rawi-live-line">
     <label>{L('الصنف','Product')}<select required value={line.item_id} onChange={e=>updateLine(i,'item_id',e.target.value)}><option value="">{L('اختر المنتج','Select item')}</option>{(lookups.products||[]).map(p=><option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></label>
     <label>{L('وحدة القياس','Unit')}<select value={line.unit_id||''} onChange={e=>updateLine(i,'unit_id',e.target.value)}><option value="">{L('وحدة الأساس','Base unit')}</option>{(unitOptions[line.item_id]||[]).filter(x=>!x.is_base).map(u=><option value={u.unit_id} key={u.unit_id}>{u.name} (×{Number(u.factor)})</option>)}</select></label>
     <label>{L('الكمية','Quantity')}<input type="number" required min="0.001" max="100000" step="0.001" value={line.quantity} onChange={e=>updateLine(i,'quantity',e.target.value)}/></label>
     <button type="button" disabled={lines.length===1} onClick={()=>setLines(a=>a.filter((_,j)=>j!==i))}>{L('حذف','Remove')}</button></div>)}
   </>}
   {config.section==='invoices'&&<>
    <div className="rawi-live-fields">
     <label>{L('العميل','Customer')}<select required value={partner} onChange={e=>setPartner(e.target.value)}><option value="">{L('اختر العميل','Choose customer')}</option>{(lookups.customers||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     <label>{L('تاريخ الفاتورة','Invoice date')}<input type="date" required value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></label>
     <label>{L('تاريخ الاستحقاق (اختياري)','Due date (optional)')}<input type="date" min={invoiceDate} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
     <label>{L('البيان','Notes')}<input maxLength="2000" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    </div>
    <div className="rawi-live-line-label"><strong>{L('بنود فاتورة المبيعات','Sales invoice line items')}</strong><button type="button" onClick={()=>setInvoiceLines(a=>[...a,emptyInvoiceLine()])}>{L('إضافة بند','Add line')}</button></div>
    {invoiceLines.map((line,i)=><div className="rawi-live-invoice-line" key={i}>
     <label>{L('الصنف (اختياري)','Product (optional)')}<select value={line.item_id} onChange={e=>pickInvoiceProduct(i,e.target.value)}><option value="">{L('خدمة أو وصف حر','Free-text service')}</option>{(lookups.products||[]).map(p=><option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></label>
     <label>{L('الوصف','Description')}<input required maxLength="500" value={line.description} onChange={e=>updateInvoiceLine(i,'description',e.target.value)}/></label>
     <label>{L('الكمية','Quantity')}<input required type="number" min="0.001" max="100000" step="any" value={line.quantity} onChange={e=>updateInvoiceLine(i,'quantity',e.target.value)}/></label>
     <label>{L('سعر الوحدة (ر.س)','Unit price (SAR)')}<input required type="number" min="0" max="10000000" step="0.01" value={line.unit_price} onChange={e=>updateInvoiceLine(i,'unit_price',e.target.value)}/></label>
     <button type="button" disabled={invoiceLines.length===1} onClick={()=>setInvoiceLines(a=>a.filter((_,j)=>j!==i))}>{L('حذف','Remove')}</button>
    </div>)}
    <div className="rawi-live-totals"><span>{L('الإجمالي قبل الضريبة - تقديري','Estimated subtotal before tax')}: {invoiceLines.reduce((sum,line)=>sum+Number(line.quantity||0)*Number(line.unit_price||0),0).toFixed(2)} {L('ر.س','SAR')}</span><small>{L('الضريبة والإجمالي النهائي يحسبهما الخادم من إعدادات الشركة','Tax and final total are calculated by the server')}</small></div>
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
   {config.section==='pricing'&&<div className="rawi-live-fields"><label>{L('الصنف','Product')}<select required value={priceItem} onChange={e=>{setPriceItem(e.target.value);const item=rows.find(x=>x.id===e.target.value);setSalePrice(item?String(Number(item.sale_price_halalas||0)/100):'')}}><option value="">{L('اختر من ملف المنتجات','Choose a product')}</option>{rows.map(x=><option key={x.id} value={x.id}>{x.sku} — {x.name}</option>)}</select></label><label>{L('سعر البيع الجديد (ر.س)','New sale price (SAR)')}<input required min="0" max="100000000" step="0.01" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)}/></label></div>}
   {config.section==='payments'&&<div className="rawi-live-fields">
    <label>{L('مرجع السند','Voucher reference')}<input required minLength={2} value={payment.reference} onChange={e=>setPayment(p=>({...p,reference:e.target.value}))}/></label>
    <label>{L('المبلغ بالريال','Amount (SAR)')}<input type="number" min="0.01" max="100000000" step="0.01" required value={payment.amount} onChange={e=>setPayment(p=>({...p,amount:e.target.value}))}/></label>
    <label>{L('طريقة السداد','Method')}<select value={payment.method} onChange={e=>setPayment(p=>({...p,method:e.target.value}))}><option value="bank">{L('بنك','Bank')}</option><option value="cash">{L('نقدي','Cash')}</option></select></label>
    <label>{L('تاريخ السند','Date')}<input type="date" required value={payment.recorded_at} onChange={e=>setPayment(p=>({...p,recorded_at:e.target.value}))}/></label>
    <label>{L('حساب الصندوق أو البنك (مدين عند القبض، دائن عند الصرف)','Bank or cash ledger account')}<select required value={payment.cash_account_id} onChange={e=>setPayment(p=>({...p,cash_account_id:e.target.value}))}><option value="">{L('اختر حساب نقدية من دليل الحسابات','Select asset account')}</option>{(lookups.accounts||[]).filter(a=>a.type==='asset').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>{L('الحساب المقابل','Counterpart ledger account')}<select required value={payment.counterpart_account_id} onChange={e=>setPayment(p=>({...p,counterpart_account_id:e.target.value}))}><option value="">{L('اختر الحساب المقابل','Choose counterpart')}</option>{(lookups.accounts||[]).filter(a=>a.id!==payment.cash_account_id).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    {config.direction==='incoming'&&<label>{L('الفاتورة المرتبطة (اختياري)','Related invoice (optional)')}<select value={payment.invoice_id} onChange={e=>setPayment(p=>({...p,invoice_id:e.target.value}))}><option value="">{L('بدون ربط فاتورة','No invoice')}</option>{invoices.filter(x=>['issued','paid'].includes(x.status)).map(i=><option key={i.id} value={i.id}>{i.invoice_no} · {currency(i.total_halalas)}</option>)}</select></label>}
    <label className="rawi-live-wide">{L('البيان','Details')}<input value={payment.details} onChange={e=>setPayment(p=>({...p,details:e.target.value}))}/></label>
   </div>}
   <button type="submit" className="rawi-live-primary" disabled={busy}><Save size={16}/>{busy?L('جاري الحفظ','Saving'):L('حفظ في قاعدة الشركة','Save transaction')}</button>
  </form>}
  {loading?<div className="rawi-live-empty"><Loader2 size={19} className="mif-spinner"/>{L('جاري تحميل الحركات','Loading transactions')}</div>:list.length?<div className="rawi-live-table"><table><thead><tr><th>{L('المرجع','Reference')}</th><th>{L('التاريخ','Date')}</th><th>{L('الإجمالي (ر.س)','Amount (SAR)')}</th><th>{L('الحالة','Status')}</th>{(config.section==='documents'||config.section==='invoices')&&<th>{L('الإجراءات','Actions')}</th>}</tr></thead><tbody>{list.map(row=><tr key={row.id}>
   <td><FileText size={14}/>{row.doc_no||row.invoice_no||row.reference||row.sku+' — '+row.name}</td>
   <td>{String(row.created_at||row.recorded_at||row.posted_on||'').slice(0,10)}</td>
   <td>{currency(row.total_halalas??row.amount_halalas??row.debit_halalas??row.sale_price_halalas)}</td>
   <td>{config.section==='payments'?(row.journal_entry_id?L('مرحل محاسبيًا','Posted to ledger'):L('غير مرحل','Unposted')):config.section==='invoices'?(row.journal_entry_id?row.status+' · '+L('قيد مُرحّل','GL posted'):row.status+' · '+L('غير مرحل','GL unposted')):row.status|| (config.section==='pricing'?(row.active?L('نشط','Active'):L('غير نشط','Inactive')):L('مسجل','Recorded'))}</td>
   {config.section==='invoices'&&<td className="rawi-live-row-actions">{row.status==='draft'&&<button type="button" disabled={busy} onClick={()=>{setIssueFor(row);setOpen(false)}}><CheckCircle2 size={14}/>{L('مراجعة وإصدار','Review and issue')}</button>}{row.status==='issued'&&row.journal_entry_id&&Number(row.received_halalas||0)>=Number(row.total_halalas)&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm(L('تأكيد أن سندات القبض المرحّلة تغطي كامل الفاتورة؟','Mark paid after verifying posted receipts cover the full amount?')))action(row.id,'paid')}}>{L('تسوية مدفوعة','Mark paid')}</button>}</td>}
   {config.section==='documents'&&<td className="rawi-live-row-actions">{row.status==='draft'&&<button type="button" disabled={busy} onClick={()=>action(row.id,'confirm')}><CheckCircle2 size={14}/>{L('تأكيد الأمر','Confirm')}</button>}{row.kind==='purchase'&&row.status==='confirmed'&&<button type="button" disabled={busy} onClick={()=>setReceiveFor(row)}><CheckCircle2 size={14}/>{L('استلام للمستودع','Receive stock')}</button>}{row.kind==='sale'&&['confirmed','completed'].includes(row.status)&&<button type="button" disabled={busy||invoices.some(i=>i.source_document_id===row.id)} onClick={()=>action(row.id,'invoice')}><FileText size={14}/>{invoices.some(i=>i.source_document_id===row.id)?L('تمت الفوترة','Invoiced'):L('إنشاء فاتورة','Invoice')}</button>}</td>}
   </tr>)}</tbody></table></div>:<div className="rawi-live-empty">{L('لا توجد معاملات فعلية في هذا المستودع حتى الآن','No operational transactions yet')}</div>}
  {kind==='sales_invoices'&&<p className="rawi-live-hint">{L('لإنشاء فاتورة فعلية: أنشئ أمر بيع، أكّد الأمر، ثم اضغط إنشاء فاتورة. المسودة وحدها لا تُصدر فاتورة.','To create an invoice: create a sales order, confirm it, then issue the invoice. Drafts are not issued invoices.')}</p>}
 </section>;
}
