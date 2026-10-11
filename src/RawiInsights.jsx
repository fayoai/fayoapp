import React,{useEffect,useState} from 'react';
import {Activity,AlertTriangle,BarChart3,Boxes,CalendarClock,CheckCircle2,Coins,RefreshCw,Users,Wallet} from 'lucide-react';
import {api,tr} from './App.jsx';
const money=n=>new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR'}).format((Number(n)||0)/100);
const cards=[
 ['customers','العملاء','Customers',Users],
 ['receivables_halalas','الفواتير المنتظرة','Open receivables',Wallet,true],
 ['invoices_due','فواتير متأخرة','Overdue invoices',AlertTriangle],
 ['crm_open','الفرص المفتوحة','Open opportunities',BarChart3],
 ['stock_low','أرصدة مخزون منخفضة','Low stock balances',Boxes],
 ['tasks_due','المهام المتأخرة','Overdue tasks',CalendarClock],
 ['sales_halalas','أوامر المبيعات المعتمدة','Confirmed sales orders',Coins,true],
 ['purchases_halalas','أوامر المشتريات المعتمدة','Confirmed purchases',Coins,true],
 ['receipts_halalas','المقبوضات المسجلة','Recorded receipts',Wallet,true],
 ['payments_halalas','المدفوعات المسجلة','Recorded payments',Wallet,true],
 ['active_employees','الموظفون النشطون','Active employees',Users],
 ['active_projects','المشاريع النشطة','Active projects',Activity]
];
export default function RawiInsights({workspace,lang}){
 const L=(ar,en)=>tr(lang,ar,en),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const refresh=async()=>{if(!workspace)return;setBusy(true);try{const x=await api('/api/admin/erp/w/'+encodeURIComponent(workspace)+'/insights');setResult(x);setError('')}catch(e){setError(e.message)}finally{setBusy(false)}};
 useEffect(()=>{refresh()},[workspace]);
 return <section className="rawi-insights"><header><div><small>RAWI / BUSINESS INTELLIGENCE</small><h2>{L('مؤشرات الأعمال الذكية','Business intelligence')}</h2><p>{L('مؤشرات فعلية من سجلات المؤسسة المصرح بها. لا تعتمد على تخمين النموذج.','Verified, read-only metrics from your authorized business records — not invented AI figures.')}</p></div><button onClick={refresh} disabled={busy}><RefreshCw size={16}/>{L('تحديث المؤشرات','Refresh')}</button></header>
 {error&&<p role="alert">{error}</p>}
 <div className="rawi-insight-cards">{cards.map(([key,ar,en,Icon,currency])=><article key={key}><Icon size={20}/><small>{L(ar,en)}</small><strong>{result?(currency?money(result.data[key]):Number(result.data[key]||0).toLocaleString(lang==='ar'?'ar-SA':'en-US')):'—'}</strong></article>)}</div>
 <div className="rawi-insight-recommendations"><h3><Activity size={19}/>{L('ملاحظات تشغيلية','Operational recommendations')}</h3>{(result?.recommendations||[]).map(x=><div key={x.id}><CheckCircle2 size={17}/>{L(x.ar,x.en)}</div>)}{!result&&!error&&<p>{L('جارٍ قراءة بيانات مؤسستك...','Loading your company metrics...')}</p>}<small>{L('هذه مؤشرات تشغيلية ولا تُعد ميزانية محاسبية معتمدة أو استشارة ضريبية.','Operational metrics only; not audited financial statements or tax advice.')}</small></div>
 </section>;
}
