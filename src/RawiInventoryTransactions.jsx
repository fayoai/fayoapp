import React,{useEffect,useMemo,useState} from 'react';
import {api,useSite,tr} from './App.jsx';
import {ArrowLeftRight,ClipboardCheck,Loader2,RefreshCw,Save,Warehouse} from 'lucide-react';
import './rawi-inventory-transactions.css';

export default function RawiInventoryTransactions({prefix,kind,lookups={},sourceDraft=null,onSaved=()=>{}}){
 const {lang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [stock,setStock]=useState([]),[movements,setMovements]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [itemId,setItemId]=useState(''),[warehouseId,setWarehouseId]=useState(''),[destination,setDestination]=useState(''),[quantity,setQuantity]=useState(''),[reference,setReference]=useState('');
 const [units,setUnits]=useState([]),[unitId,setUnitId]=useState(''),[transferRequestId,setTransferRequestId]=useState(()=>crypto.randomUUID());
 const active=kind==='stock_count'||kind==='internal_transfer';
 const load=async()=>{if(!prefix||!active)return;setLoading(true);setError('');
  try{const [current,history]=await Promise.all([api(prefix+'/core/stock'),api(prefix+'/core/movements')]);setStock(current.data||[]);setMovements(history.data||[])}
  catch(e){setError(e.message)}finally{setLoading(false)}
 };
 useEffect(()=>{setStock([]);setMovements([]);setItemId('');setWarehouseId('');setDestination('');setQuantity('');if(active)load()},[prefix,kind]);
 useEffect(()=>{if(!sourceDraft||sourceDraft.kind!==kind||!active)return;
  const values=sourceDraft.values||{};
  if(kind==='stock_count'){
   setWarehouseId(String(values.field_1||''));
   setItemId(String(values.field_3||''));
   setQuantity(values.field_4===undefined?'':String(values.field_4));
  }else if(kind==='internal_transfer'){
   setWarehouseId(String(values.field_1||''));
   setDestination(String(values.field_2||''));
   setItemId('');setQuantity('');
  }
  setReference('مسودة راوي '+(sourceDraft.document_number||sourceDraft.id));
  setNotice(L('تم تجهيز البيانات المتاحة من المسودة. راجع الكميات والمستودعات قبل اعتماد الحركة.','Draft fields loaded. Review warehouses and quantities before posting.'));
 },[sourceDraft?.token,prefix,kind]);
 useEffect(()=>{setUnits([]);setUnitId('');if(!itemId||!prefix||!active)return;let valid=true;
  api(prefix+'/system/items/'+encodeURIComponent(itemId)+'/units').then(r=>{if(valid)setUnits(r.data||[])}).catch(e=>{if(valid)setError(e.message)});
  return()=>{valid=false}
 },[itemId,prefix,kind]);
 const current=useMemo(()=>Number(stock.find(x=>x.item_id===itemId&&x.warehouse_id===warehouseId)?.quantity||0),[stock,itemId,warehouseId]);
 const counted=Number(quantity),delta=Number((counted-current).toFixed(3));
 const products=(lookups.products||[]).filter(x=>x.type!=='service'),warehouses=lookups.warehouses||[];
 const save=async event=>{event.preventDefault();if(busy||!itemId||!warehouseId)return;
  if(kind==='internal_transfer'&&(!destination||warehouseId===destination)){setError(L('اختر مستودعين مختلفين','Select two distinct warehouses'));return}
  if(!Number.isFinite(counted)||counted<0||counted>1000000){setError(L('أدخل كمية صحيحة','Enter a valid quantity'));return}
  if(kind==='stock_count'&&delta===0){setNotice(L('الكمية الفعلية تساوي الدفترية، لا يوجد فرق جرد','Count matches book stock; no adjustment needed'));return}
  if(!window.confirm(kind==='stock_count'?L('تأكيد تسجيل فرق الجرد في المخزون؟','Post the stock count difference?'):L('تأكيد النقل الفعلي بين المستودعين؟','Confirm the physical stock transfer?')))return;
  setBusy(true);setError('');setNotice('');
  try{
   if(kind==='stock_count'){
    await api(prefix+'/core/movements',{method:'POST',body:JSON.stringify({item_id:itemId,warehouse_id:warehouseId,delta,expected_quantity:current,reason:reference.trim()||'جرد فعلي معتمد'})});
    setNotice(L('تم حفظ فرق الجرد وحركة المخزون','Stock count difference and movement recorded'));
   }else{
    const result=await api(prefix+'/core/transfers',{method:'POST',body:JSON.stringify({item_id:itemId,source_warehouse_id:warehouseId,target_warehouse_id:destination,quantity:counted,...(unitId?{unit_id:unitId}:{}),request_id:transferRequestId,reference:reference.trim()||'تحويل مخزني'})});
    setNotice(L('تم نقل ','Transferred ')+result.moved_quantity+L(' من وحدات الأساس وحفظ الحركتين',' base units and recorded both movements'));
   }
   setQuantity('');setReference('');if(kind==='internal_transfer')setTransferRequestId(crypto.randomUUID());await load();onSaved();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 if(!active)return null;
 return <section className="rawi-inventory-live">
  <header><div><strong>{kind==='stock_count'?<ClipboardCheck size={19}/>:<ArrowLeftRight size={19}/>}
   {kind==='stock_count'?L('الجرد الفعلي للمستودعات','Actual warehouse stock count'):L('التحويل الحقيقي بين المستودعات','Real inter-warehouse transfer')}</strong>
   <small>{L('الحركات تسجل في مخزون الشركة الفعلي، وليس في قائمة وهمية','Transactions change actual tenant stock and create audit movements')}</small></div>
   <button type="button" disabled={loading||busy} onClick={load}><RefreshCw size={15}/>{L('تحديث','Refresh')}</button></header>
  {error&&<p className="rawi-inventory-error" role="alert">{error}</p>}{notice&&<p className="rawi-inventory-notice" role="status">{notice}</p>}
  <form onSubmit={save} className="rawi-inventory-editor">
   <label>{L('الصنف المخزني','Stock product')}<select value={itemId} required onChange={e=>setItemId(e.target.value)}><option value="">{L('اختر الصنف','Select product')}</option>{products.map(i=><option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}</select></label>
   <label>{kind==='stock_count'?L('المستودع','Warehouse'):L('المستودع المصدر','From warehouse')}<select required value={warehouseId} onChange={e=>setWarehouseId(e.target.value)}><option value="">{L('اختر المستودع','Select warehouse')}</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
   {kind==='internal_transfer'&&<label>{L('المستودع المستلم','Destination warehouse')}<select required value={destination} onChange={e=>setDestination(e.target.value)}><option value="">{L('اختر المستودع','Select warehouse')}</option>{warehouses.filter(w=>w.id!==warehouseId).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
   {kind==='internal_transfer'&&<label>{L('وحدة القياس','Unit')}<select value={unitId} onChange={e=>setUnitId(e.target.value)}><option value="">{L('وحدة الأساس','Base unit')}</option>{units.filter(u=>!u.is_base).map(u=><option key={u.unit_id} value={u.unit_id}>{u.name} (×{Number(u.factor)})</option>)}</select></label>}
   <label>{kind==='stock_count'?L('الكمية التي تم جردها','Physically counted quantity'):L('الكمية المنقولة','Transfer quantity')}<input type="number" min={kind==='stock_count'?'0':'0.001'} step="0.001" max="1000000" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
   <label>{L('المرجع أو سبب الحركة','Transaction reference')}<input maxLength="120" value={reference} onChange={e=>setReference(e.target.value)} placeholder={kind==='stock_count'?L('جرد المستودع','Stock count reference'):L('أمر تحويل','Transfer reference')}/></label>
   <div className="rawi-inventory-balance"><span><Warehouse size={16}/>{L('الكمية الحالية','On-hand')}: <b>{current.toLocaleString()}</b></span>{kind==='stock_count'&&quantity!==''&&<span>{L('فرق الجرد','Adjustment')}: <b>{delta>0?'+':''}{delta.toLocaleString()}</b></span>}</div>
   <button type="submit" disabled={busy||loading||!products.length||!warehouses.length}><Save size={16}/>{busy?L('جاري التسجيل','Saving'):kind==='stock_count'?L('تسجيل فرق الجرد','Post stock count'):L('تنفيذ النقل','Post transfer')}</button>
  </form>
  <div className="rawi-inventory-table"><strong>{L('أرصدة المخزون الفعلية','Actual warehouse balances')}</strong>{loading?<div className="rawi-inventory-loading"><Loader2 size={17} className="mif-spinner"/></div>:stock.length?<table><thead><tr><th>{L('الصنف','Product')}</th><th>{L('المستودع','Warehouse')}</th><th>{L('الكمية','Quantity')}</th></tr></thead><tbody>{stock.map(r=><tr key={r.item_id+'|'+r.warehouse_id}><td>{r.item_name}</td><td>{r.warehouse_name}</td><td>{Number(r.quantity).toLocaleString()}</td></tr>)}</tbody></table>:<p>{L('لا توجد أرصدة مخزنية بعد','No warehouse balances yet')}</p>}</div>
  {movements.length>0&&<div className="rawi-inventory-table"><strong>{L('سجل حركات المخزون','Inventory movement audit')}</strong><table><thead><tr><th>{L('المرجع','Reference')}</th><th>{L('التاريخ','Date')}</th><th>{L('الكمية','Quantity')}</th></tr></thead><tbody>{movements.slice(0,35).map(m=><tr key={m.id}><td>{m.reason}</td><td>{String(m.created_at).slice(0,10)}</td><td>{Number(m.delta).toLocaleString()}</td></tr>)}</tbody></table></div>}
 </section>;
}
