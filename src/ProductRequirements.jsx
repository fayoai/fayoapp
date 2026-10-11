import React from 'react';
import {productRequirements} from '../api/product-config.js';
import './product-requirements.css';
export default function ProductRequirements({sku,value,onChange,lang}){
 const fields=productRequirements[sku]||[],ar=lang==='ar';
 if(!fields.length)return null;
 const change=(key,val)=>onChange(old=>({...old,[key]:val}));
 return <section className="ms-requirements"><div className="ms-req-head"><strong>{ar?'متطلبات المنتج':'Product requirements'}</strong><p>{ar?'حدد متطلبات العمل الفعلية للحصول على نطاق تنفيذ وعرض سعر مناسب.':'Specify actual requirements to receive a tailored scope and quotation.'}</p></div><div className="ms-req-grid">{fields.map(f=><label key={f.key}><span>{ar?f.ar:f.en}</span>{f.type==='number'?<input type="number" min={f.min} max={f.max} value={value[f.key]??f.default} onChange={e=>change(f.key,Number(e.target.value))}/>:f.type==='text'?<input maxLength={f.maxLength} value={value[f.key]??f.default} onChange={e=>change(f.key,e.target.value)} placeholder={ar?'اختياري':'Optional'}/>:f.type==='select'?<select value={value[f.key]??f.default} onChange={e=>change(f.key,e.target.value)}>{f.options.map(([id,a,en])=><option key={id} value={id}>{ar?a:en}</option>)}</select>:<div className="ms-req-multi">{f.options.map(([id,a,en])=><label key={id}><input type="checkbox" checked={(value[f.key]??f.default).includes(id)} onChange={e=>change(f.key,e.target.checked?[...(value[f.key]??f.default),id]:(value[f.key]??f.default).filter(x=>x!==id))}/>{ar?a:en}</label>)}</div>}</label>)}</div></section>;
}
