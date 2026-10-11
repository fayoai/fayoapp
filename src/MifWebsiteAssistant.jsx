import React,{useState} from 'react';
import {ArrowUpLeft,Bot,Send,Sparkles} from 'lucide-react';
import {api,useSite,tr} from './App.jsx';

// This is a real API-backed conversation surface. No placeholder or simulated AI replies.
export default function MifWebsiteAssistant(){
 const {lang}=useSite(),L=(ar,en)=>tr(lang,ar,en);
 const [question,setQuestion]=useState(''),[messages,setMessages]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const send=async event=>{
  event.preventDefault();
  const text=question.trim();
  if(!text||busy)return;
  setQuestion('');setError('');setBusy(true);
  setMessages(items=>[...items,{role:'user',text}]);
  try{
   const result=await api('/api/chat/public',{method:'POST',body:JSON.stringify({question:text})});
   if(typeof result.answer!=='string'||!result.answer.trim())throw new Error(L('لم يصل رد من الخدمة.','The service returned no answer.'));
   setMessages(items=>[...items,{role:'assistant',text:result.answer}]);
  }catch(e){
   setError(e.message||L('خدمة الذكاء الاصطناعي غير متاحة حاليًا.','AI service is unavailable.'));
   setQuestion(text);
  }finally{setBusy(false)}
 };
 return <section className="mif-ai-widget" aria-label={L('مساعد MIF Smart الذكي','MIF Smart AI assistant')}>
  <header className="mif-ai-widget-head"><img src="/mif-mark.svg" alt=""/><div><strong>MIF Smart AI</strong><small>{L('مساعد الموقع التفاعلي','Interactive website assistant')}</small></div><Sparkles size={20}/></header>
  <div className="mif-ai-widget-messages" aria-live="polite" aria-relevant="additions text">
   {messages.length?messages.map((item,i)=><div key={i} className={'mif-ai-message '+item.role}><span>{item.role==='user'?L('أنت','You'):'MIF Smart AI'}</span><p>{item.text}</p></div>):
   <div className="mif-ai-widget-intro"><Bot size={29}/><strong>{L('اسأل عن حلول MIF Smart','Ask about MIF Smart solutions')}</strong><p>{L('محادثة مباشرة عند تفعيل مزوّد الذكاء الاصطناعي. لا توجد إجابات تجريبية مصطنعة.','Live responses when the AI provider is enabled. No simulated answers.')}</p></div>}
   {busy&&<p className="mif-ai-widget-loading" role="status">{L('جارٍ طلب الإجابة...','Requesting response...')}</p>}
  </div>
  {messages.length===0&&<div className="mif-ai-widget-suggestions">
   <button type="button" onClick={()=>setQuestion(L('ما الفرق بين RAWI Enterprise وRAWI Developer؟','What is the difference between RAWI Enterprise and Developer?'))}>{L('راوي Enterprise وDeveloper','Enterprise vs Developer')}</button>
   <button type="button" onClick={()=>setQuestion(L('ما الذي يتضمنه Odoo Community المطوّر؟','What is included in enhanced Odoo Community?'))}>{L('Odoo Community المطوّر','Enhanced Odoo Community')}</button>
  </div>}
  <form className="mif-ai-widget-form" onSubmit={send}>
   <label htmlFor="mif-ai-question" className="mif-ai-visually-hidden">{L('سؤالك للمساعد','Your question')}</label>
   <input id="mif-ai-question" maxLength={2500} value={question} disabled={busy} onChange={e=>setQuestion(e.target.value)} placeholder={L('اكتب سؤالك هنا...','Ask a question...')}/>
   <button aria-label={L('إرسال السؤال','Send question')} type="submit" disabled={busy||!question.trim()}><Send size={19}/></button>
  </form>
  {error&&<p className="mif-ai-widget-error" role="alert">{error} <a href="/mif/contact">{L('تواصل معنا','Contact us')}<ArrowUpLeft size={14}/></a></p>}
  <small className="mif-ai-widget-note">{L('تُرسل الأسئلة إلى مزوّد AI عند تشغيل الخدمة. لا تشارك بيانات سرية. كل سؤال يُعالج بصورة مستقلة.','Questions go to an AI provider when enabled. Do not share sensitive data. Each question is processed independently.')}</small>
 </section>;
}
