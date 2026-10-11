import React,{useEffect,useMemo,useState} from 'react';
import {Plus,Package,Warehouse,ArrowDownToLine,ArrowUpFromLine,FileText,Check,ChartColumnIncreasing,Users,FolderKanban,Wallet,BookText,RefreshCw,ShieldCheck} from 'lucide-react';
import {api,tr} from './App.jsx';
import './erp-departments.css';

const m=n=>new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR'}).format((Number(n)||0)/100);
const modules={
 sales:{kind:'sale',ar:'إدارة المبيعات',en:'Sales management'},
 purchases:{kind:'purchase',ar:'إدارة المشتريات',en:'Purchases management'},
 inventory:{ar:'المخزون والمستودعات',en:'Inventory & warehouses'},
 accounting:{ar:'الحسابات والقيود',en:'Accounting & general ledger'},
 employees:{ar:'الموارد البشرية',en:'Human resources'},
 projects:{ar:'إدارة المشاريع',en:'Project management'},
 expenses:{ar:'المصروفات',en:'Expense management'},
 reports:{ar:'تقارير الأعمال',en:'Business reporting'}
};
function FormField({title,children}){return <label className="erp-core-label"><span>{title}</span>{children}</label>}
function Block({title,children,icon:Icon}){return <div className="erp-core-panel"><h2>{Icon&&<Icon size={20}/>} {title}</h2>{children}</div>}
function Empty({children}){return <p className="erp-core-empty">{children}</p>}
export default function ErpDepartments({section,workspace,lang,notify=()=>{},readOnly=false}){
 const L=(ar,en)=>tr(lang,ar,en),mod=modules[section],base='/api/admin/erp/w/'+encodeURIComponent(workspace);
 const [data,setData]=useState([]),[items,setItems]=useState([]),[warehouses,setWarehouses]=useState([]),[contacts,setContacts]=useState([]),[accounts,setAccounts]=useState([]),[employees,setEmployees]=useState([]),[report,setReport]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [item,setItem]=useState({sku:'',name:'',type:'stock',unit:'unit',sale_price:0,cost:0});
 const [wh,setWh]=useState({name:'',location:''});
 const [stock,setStock]=useState({item_id:'',warehouse_id:'',delta:1,reason:''});
 const [doc,setDoc]=useState({partner_id:'',notes:'',lines:[{item_id:'',quantity:1}]});
 const [account,setAccount]=useState({code:'',name:'',type:'asset'});
 const [journal,setJournal]=useState({reference:'',memo:'',lines:[{account_id:'',debit:0,credit:0},{account_id:'',debit:0,credit:0}]});
 const [employee,setEmployee]=useState({name:'',employee_number:'',email:'',department:'',job_title:'',basic_salary:0});
 const [project,setProject]=useState({name:'',customer_id:'',owner:'',budget:0,start_on:'',due_on:''});
 const [expense,setExpense]=useState({description:'',amount:0,category:'general',employee_id:'',occurred_on:''});
 const endpoint=s=>base+'/core/'+s;
 const load=async()=>{
  if(!mod||readOnly)return;
  try{
   setError('');
   const requests=section==='inventory'?['items','warehouses','stock','movements']:section==='sales'||section==='purchases'?['documents','items']:section==='accounting'?['accounts','journal']:section==='expenses'?['expenses','employees']:section==='projects'?['projects']:section==='reports'?['reports']:['employees'];
   const more=(section==='sales'||section==='purchases'||section==='projects')?['contacts']:[];
   const results=await Promise.all([...requests.map(k=>api(endpoint(k))),...more.map(k=>api(base+'/'+k))]);
   for(let i=0;i<requests.length;i++){const name=requests[i],v=results[i].data;if(name==='items')setItems(v||[]);else if(name==='warehouses')setWarehouses(v||[]);else if(name==='reports')setReport(v);else if(name==='accounts')setAccounts(v||[]);else if(name==='stock')setData(v||[]);else if(name==='employees')setEmployees(v||[]);else if(name===requests[requests.length-1]&&name!=='movements')setData(v||[]);else if(name==='documents')setData(v||[]);else if(name==='projects'||name==='expenses')setData(v||[])}
   if(requests.includes('documents'))setData((results[0].data||[]).filter(x=>x.kind===mod.kind));
   if(requests.includes('journal'))setData(results[1].data||[]);
   if(requests.includes('expenses'))setData(results[0].data||[]);
   if(more.length)setContacts(results[requests.length].data||[]);
  }catch(e){setError(e.message)}
 };
 useEffect(()=>{if(!readOnly)load()},[workspace,section,readOnly]);
 async function save(resource,payload,reset){
  if(readOnly)return;
  setBusy(true);setError('');
  try{await api(endpoint(resource),{method:'POST',body:JSON.stringify(payload)});notify(L('تم الحفظ','Saved'));reset?.();await load()}
  catch(e){setError(e.message);notify(e.message)}
  finally{setBusy(false)}
 }
 const send=(resource,payload,reset)=>e=>{e.preventDefault();save(resource,payload,reset)};
 const act=async(route,status)=>{if(readOnly)return;setBusy(true);try{await api(route,{method:'PATCH',body:JSON.stringify({status})});await load();notify(L('تم تحديث الحالة','Status updated'))}catch(e){setError(e.message)}finally{setBusy(false)}};
 const field=(state,set,key,title,type='text',options)=> <FormField title={title}>{options?<select required value={state[key]} onChange={e=>set(x=>({...x,[key]:e.target.value}))}><option value="">{L('اختر','Select')}</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>:<input type={type} required={!['location','email','owner','start_on','due_on','occurred_on'].includes(key)} step={type==='number'?'0.01':undefined} min={type==='number'&&key!=='delta'?0:undefined} value={state[key]} onChange={e=>set(x=>({...x,[key]:type==='number'?Number(e.target.value):e.target.value}))}/>}</FormField>;
 const updateLine=(setter,index,key,value)=>setter(x=>({...x,lines:x.lines.map((r,i)=>i===index?{...r,[key]:value}:r)}));
 if(!mod)return null;
 return <section className="erp-core">
  <div className="erp-core-heading"><div><small>MIF SMART / OPERATIONS</small><h2>{L(mod.ar,mod.en)}</h2></div><button onClick={load} title={L('تحديث البيانات','Refresh')}><RefreshCw size={18}/></button></div>
  {error&&<div className="erp-core-error" role="alert">{error}</div>}
  {section==='inventory'&&<div className="erp-core-layout">
   <div className="erp-core-column">
    <Block title={L('الأصناف والخدمات','Items and services')} icon={Package}>
     <form onSubmit={send('items',item,()=>setItem({sku:'',name:'',type:'stock',unit:'unit',sale_price:0,cost:0}))} className="erp-core-form">
      {field(item,setItem,'sku',L('رمز الصنف','SKU'))}{field(item,setItem,'name',L('اسم الصنف','Item name'))}
      <FormField title={L('النوع','Type')}><select value={item.type} onChange={e=>setItem(x=>({...x,type:e.target.value}))}><option value="stock">{L('مخزني','Stock')}</option><option value="service">{L('خدمة','Service')}</option></select></FormField>
      {field(item,setItem,'unit',L('الوحدة','Unit'))}<div className="erp-core-2">{field(item,setItem,'sale_price',L('سعر البيع (ر.س)','Sale price (SAR)'),'number')}{field(item,setItem,'cost',L('التكلفة (ر.س)','Cost (SAR)'),'number')}</div>
      <button disabled={busy}><Plus size={16}/>{L('حفظ الصنف','Save item')}</button>
     </form><div className="erp-core-records">{items.map(x=><article key={x.id}><strong>{x.name}</strong><small>{x.sku} · {m(x.sale_price_halalas)} · {x.type}</small></article>)}</div>
    </Block>
    <Block title={L('المستودعات','Warehouses')} icon={Warehouse}><form className="erp-core-form" onSubmit={send('warehouses',wh,()=>setWh({name:'',location:''}))}>{field(wh,setWh,'name',L('اسم المستودع','Warehouse name'))}{field(wh,setWh,'location',L('الموقع','Location'))}<button disabled={busy}><Plus size={16}/>{L('إضافة المستودع','Add warehouse')}</button></form><div className="erp-core-records">{warehouses.map(w=><article key={w.id}><strong>{w.name}</strong><small>{w.location}</small></article>)}</div></Block>
   </div>
   <div className="erp-core-column">
    <Block title={L('حركة المخزون','Stock movement')} icon={ArrowDownToLine}><form className="erp-core-form" onSubmit={send('movements',stock,()=>setStock(x=>({...x,delta:1,reason:''})))}><FormField title={L('الصنف','Item')}><select required value={stock.item_id} onChange={e=>setStock(x=>({...x,item_id:e.target.value}))}><option value="">{L('اختر','Select')}</option>{items.filter(x=>x.type==='stock').map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></FormField>{field(stock,setStock,'warehouse_id',L('المستودع','Warehouse'),'text',warehouses)}<div className="erp-core-help">{L('كمية موجبة للاستلام وسالبة للصرف. لا يمكن صرف أكثر من المتاح.','Positive quantity receives stock, negative quantity issues stock. Negative balances are blocked.')}</div>{field(stock,setStock,'delta',L('الكمية (+ / -)','Quantity (+ / -)'),'number')}{field(stock,setStock,'reason',L('سبب الحركة','Reason'))}<button disabled={busy}><Check size={16}/>{L('تسجيل الحركة','Post movement')}</button></form></Block>
    <Block title={L('الأرصدة حسب المستودع','Balances by warehouse')} icon={Package}>{data.length?<div className="erp-core-records">{data.filter(x=>x.item_name).map(x=><article key={x.item_id+'-'+x.warehouse_id}><strong>{x.item_name} — {x.warehouse_name}</strong><small>{Number(x.quantity)} {L('وحدة','units')}</small></article>)}</div>:<Empty>{L('سجل أصناف ومستودعات ثم أضف أول حركة.','Create items and warehouses, then post a stock movement.')}</Empty>}</Block>
   </div>
  </div>}
  {(section==='sales'||section==='purchases')&&<div className="erp-core-layout">
    <Block icon={FileText} title={section==='sales'?L('أمر بيع جديد','New sales order'):L('أمر شراء جديد','New purchase order')}>
     <form className="erp-core-form" onSubmit={send('documents',{...doc,kind:mod.kind},()=>setDoc({partner_id:'',notes:'',lines:[{item_id:'',quantity:1}]}))}>
      <FormField title={section==='sales'?L('العميل','Customer'):L('المورد','Supplier')}><select required value={doc.partner_id} onChange={e=>setDoc(x=>({...x,partner_id:e.target.value}))}><option value="">{L('اختر جهة اتصال','Choose contact')}</option>{contacts.filter(x=>mod.kind==='sale'?x.kind!=='vendor':x.kind!=='customer').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></FormField>
      {doc.lines.map((line,i)=><div className="erp-line-form" key={i}><select required value={line.item_id} onChange={e=>updateLine(setDoc,i,'item_id',e.target.value)}><option value="">{L('اختر الصنف','Select item')}</option>{items.map(x=><option key={x.id} value={x.id}>{x.sku} · {x.name}</option>)}</select><input aria-label={L('الكمية','Quantity')} required type="number" min=".001" step=".001" value={line.quantity} onChange={e=>updateLine(setDoc,i,'quantity',Number(e.target.value))}/><button type="button" disabled={doc.lines.length===1} onClick={()=>setDoc(x=>({...x,lines:x.lines.filter((_,j)=>j!==i)}))}>×</button></div>)}
      <button type="button" className="outline" onClick={()=>setDoc(x=>({...x,lines:[...x.lines,{item_id:'',quantity:1}]}))}><Plus size={15}/>{L('إضافة بند','Add line')}</button>
      <FormField title={L('ملاحظات','Notes')}><textarea value={doc.notes} onChange={e=>setDoc(x=>({...x,notes:e.target.value}))}/></FormField>
      <button disabled={busy||!items.length||!contacts.length}><FileText size={16}/>{L('إنشاء المستند','Create document')}</button>
     </form>
    </Block>
    <Block icon={FileText} title={L('المستندات','Documents')}>{data.length?<div className="erp-core-records">{data.map(x=><article key={x.id}><div><strong>{x.doc_no} · {m(x.total_halalas)}</strong><small>{x.status} · {(x.lines||[]).map(l=>l.name+' × '+l.quantity).join('، ')}</small></div><div className="erp-record-actions">{x.status==='draft'&&<button disabled={busy} onClick={()=>act(endpoint('documents')+'/'+x.id+'/status','confirmed')}>{L('اعتماد','Confirm')}</button>}{x.status==='confirmed'&&<button disabled={busy} onClick={()=>act(endpoint('documents')+'/'+x.id+'/status','completed')}>{L('إتمام','Complete')}</button>}{section==='sales'&&['confirmed','completed'].includes(x.status)&&<button disabled={busy} onClick={async()=>{setBusy(true);try{const v=await api(endpoint('documents')+'/'+x.id+'/invoice',{method:'POST',body:'{}'});notify(L('تم إنشاء مسودة فاتورة: ','Invoice draft created: ')+v.data.invoice_no)}catch(e){setError(e.message)}finally{setBusy(false)}}}>{L('إنشاء فاتورة','Create invoice')}</button>}</div></article>)}</div>:<Empty>{L('أضف مستندك الأول لتبدأ.','Create your first document.')}</Empty>}<p className="erp-core-help">{L('يتم تسجيل حركات المخزون في شاشة المخزون، وليس بمجرد اعتماد أمر البيع أو الشراء.','Post stock movements in Inventory; confirming an order does not automatically move stock.')}</p></Block>
  </div>}
  {section==='accounting'&&<div className="erp-core-layout">
   <div className="erp-core-column">
    <Block icon={BookText} title={L('دليل الحسابات','Chart of accounts')}><form className="erp-core-form" onSubmit={send('accounts',account,()=>setAccount({code:'',name:'',type:'asset'}))}>{field(account,setAccount,'code',L('رقم الحساب','Account code'))}{field(account,setAccount,'name',L('اسم الحساب','Account name'))}<FormField title={L('النوع','Type')}><select value={account.type} onChange={e=>setAccount(x=>({...x,type:e.target.value}))}>{[['asset','أصول'],['liability','التزامات'],['equity','حقوق ملكية'],['income','إيراد'],['expense','مصروف']].map(([k,name])=><option key={k} value={k}>{lang==='ar'?name:k}</option>)}</select></FormField><button disabled={busy}><Plus size={16}/>{L('حفظ الحساب','Save account')}</button></form><div className="erp-core-records">{accounts.map(x=><article key={x.id}><strong>{x.code} · {x.name}</strong><small>{x.type}</small></article>)}</div></Block>
   </div>
   <div className="erp-core-column"><Block icon={BookText} title={L('قيد محاسبي متوازن','Balanced journal entry')}><form className="erp-core-form" onSubmit={send('journal',journal,()=>setJournal({reference:'',memo:'',lines:[{account_id:'',debit:0,credit:0},{account_id:'',debit:0,credit:0}]}))}>{field(journal,setJournal,'reference',L('مرجع القيد','Reference'))}{field(journal,setJournal,'memo',L('البيان','Memo'))}
    {journal.lines.map((line,i)=><div className="erp-journal-line" key={i}><select value={line.account_id} required onChange={e=>updateLine(setJournal,i,'account_id',e.target.value)}><option value="">{L('الحساب','Account')}</option>{accounts.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select><input type="number" min="0" step=".01" aria-label={L('مدين','Debit')} value={line.debit} onChange={e=>updateLine(setJournal,i,'debit',Number(e.target.value))}/><input type="number" min="0" step=".01" aria-label={L('دائن','Credit')} value={line.credit} onChange={e=>updateLine(setJournal,i,'credit',Number(e.target.value))}/></div>)}
    <button type="button" className="outline" onClick={()=>setJournal(x=>({...x,lines:[...x.lines,{account_id:'',debit:0,credit:0}]}))}><Plus size={15}/>{L('إضافة سطر','Add line')}</button>
    <div className="erp-journal-total"><span>{L('مدين','Debit')} {journal.lines.reduce((n,x)=>n+Number(x.debit||0),0).toFixed(2)}</span><span>{L('دائن','Credit')} {journal.lines.reduce((n,x)=>n+Number(x.credit||0),0).toFixed(2)}</span></div>
    <button disabled={busy||accounts.length<2}><Check size={16}/>{L('ترحيل القيد','Post entry')}</button></form></Block>
    <Block title={L('دفتر اليومية','Journal entries')}>{data.map(x=><div className="erp-core-list-row" key={x.id}><strong>{x.reference}</strong><small>{m(x.debit_halalas)} · {x.posted_on}</small></div>)}</Block>
   </div>
  </div>}
  {section==='employees'&&<div className="erp-core-layout"><Block icon={Users} title={L('تسجيل موظف','Employee profile')}><form className="erp-core-form" onSubmit={send('employees',employee,()=>setEmployee({name:'',employee_number:'',email:'',department:'',job_title:'',basic_salary:0}))}>{field(employee,setEmployee,'name',L('اسم الموظف','Name'))}{field(employee,setEmployee,'employee_number',L('الرقم الوظيفي','Employee number'))}{field(employee,setEmployee,'email',L('البريد الإلكتروني','Email'))}{field(employee,setEmployee,'department',L('الإدارة','Department'))}{field(employee,setEmployee,'job_title',L('المسمى الوظيفي','Job title'))}{field(employee,setEmployee,'basic_salary',L('الراتب الأساسي (ر.س)','Base salary (SAR)'),'number')}<button disabled={busy}><Plus size={16}/>{L('حفظ الموظف','Save employee')}</button></form></Block><Block title={L('الهيكل الوظيفي','Employee directory')}>{employees.map(x=><div className="erp-core-list-row" key={x.id}><strong>{x.name}</strong><small>{x.employee_number} · {x.department} · {x.job_title}</small></div>)}</Block></div>}
  {section==='projects'&&<div className="erp-core-layout"><Block icon={FolderKanban} title={L('مشروع جديد','New project')}><form className="erp-core-form" onSubmit={send('projects',{...project,customer_id:project.customer_id||null,start_on:project.start_on||null,due_on:project.due_on||null},()=>setProject({name:'',customer_id:'',owner:'',budget:0,start_on:'',due_on:''}))}>{field(project,setProject,'name',L('اسم المشروع','Project name'))}<FormField title={L('العميل','Customer')}><select value={project.customer_id} onChange={e=>setProject(x=>({...x,customer_id:e.target.value}))}><option value="">{L('بدون عميل','No customer')}</option>{contacts.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></FormField>{field(project,setProject,'owner',L('المسؤول','Owner'))}{field(project,setProject,'budget',L('الميزانية (ر.س)','Budget (SAR)'),'number')}<div className="erp-core-2">{field(project,setProject,'start_on',L('البداية','Start'),'date')}{field(project,setProject,'due_on',L('الانتهاء','Due'),'date')}</div><button disabled={busy}><Plus size={16}/>{L('حفظ المشروع','Save project')}</button></form></Block><Block title={L('المشاريع','Projects')}>{data.map(x=><div className="erp-core-list-row" key={x.id}><strong>{x.name}</strong><small>{x.status} · {m(x.budget_halalas)} · {x.owner}</small></div>)}</Block></div>}
  {section==='expenses'&&<div className="erp-core-layout"><Block icon={Wallet} title={L('طلب مصروف','Expense claim')}><form className="erp-core-form" onSubmit={send('expenses',{...expense,employee_id:expense.employee_id||null,occurred_on:expense.occurred_on||undefined},()=>setExpense({description:'',amount:0,category:'general',employee_id:'',occurred_on:''}))}>{field(expense,setExpense,'description',L('وصف المصروف','Description'))}{field(expense,setExpense,'amount',L('القيمة (ر.س)','Amount (SAR)'),'number')}{field(expense,setExpense,'category',L('الفئة','Category'))}<FormField title={L('الموظف','Employee')}><select value={expense.employee_id} onChange={e=>setExpense(x=>({...x,employee_id:e.target.value}))}><option value="">{L('بدون موظف','No employee')}</option>{employees.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></FormField>{field(expense,setExpense,'occurred_on',L('التاريخ','Date'),'date')}<button disabled={busy}><Plus size={16}/>{L('رفع المصروف','Submit expense')}</button></form></Block><Block title={L('الاعتمادات','Approvals')}>{data.map(x=><div className="erp-core-list-row" key={x.id}><strong>{x.description} · {m(x.amount_halalas)}</strong><small>{x.category} · {x.status}</small><div className="erp-record-actions">{x.status==='submitted'&&<><button onClick={()=>act(endpoint('expenses')+'/'+x.id+'/status','approved')}>{L('موافقة','Approve')}</button><button onClick={()=>act(endpoint('expenses')+'/'+x.id+'/status','rejected')}>{L('رفض','Reject')}</button></>}{x.status==='approved'&&<button onClick={()=>act(endpoint('expenses')+'/'+x.id+'/status','paid')}>{L('تم الصرف','Paid')}</button>}</div></div>)}</Block></div>}
  {section==='reports'&&<div className="erp-core-report"><Block icon={ChartColumnIncreasing} title={L('مؤشرات مؤسستك','Organization KPIs')}>{report?<div className="erp-core-stats">{[['الموظفون','Employees',report.employees?.count],['كتل الرواتب الشهرية (ر.س)','Base monthly salaries (SAR)',Number(report.employees?.payroll||0)/100],['أرصدة المخزون','Stock balance',Number(report.inventory?.balance||0)],['الحركات المحاسبية','Journal debits',Number(report.finance?.debits||0)/100]].map(([a,e,v],i)=><article key={i}><strong>{Number(v||0).toLocaleString(lang==='ar'?'ar-SA':'en-US')}</strong><small>{L(a,e)}</small></article>)}</div>:<Empty>{L('جاري جلب التقارير','Loading reports')}</Empty>}</Block><Block title={L('ملخص الطلبات والمصروفات','Orders and expenses')}>{(report?.documents||[]).map((x,i)=><div className="erp-core-list-row" key={i}><strong>{x.kind} · {x.status}</strong><small>{x.count} · {m(x.amount)}</small></div>)}{(report?.expenses||[]).map((x,i)=><div className="erp-core-list-row" key={'e'+i}><strong>{L('مصروفات','Expenses')} · {x.status}</strong><small>{x.count} · {m(x.amount)}</small></div>)}</Block></div>}
 </section>;
}
