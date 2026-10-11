import {z} from 'zod';
const email=z.email().max(180);
export async function notifyMifInquiry(env={},lead={}){
 const from=String(env.MAIL_FROM||'').trim(),formatted=/^([^<>\r\n]{1,100}) <([^<>\r\n]+)>$/.exec(from);
 const sender=email.safeParse(formatted?formatted[2]:from),recipient=email.safeParse(env.MIF_INQUIRY_NOTIFY_EMAIL);
 if(!env.RESEND_API_KEY||!sender.success||!recipient.success)return {status:'not_configured'};
 const text=['MIF Smart — New website inquiry',
  'Name: '+String(lead.name||'').slice(0,160),
  'Email: '+String(lead.email||'').slice(0,180),
  'Phone: '+String(lead.phone||'').slice(0,35),
  'Company: '+String(lead.company||'').slice(0,160),
  'Product: '+String(lead.product_code||'').slice(0,50),
  'Message:',String(lead.message||'').slice(0,3500),
  'Manage the request in your MIF Smart SaaS console.'
 ].join('\n');
 try{
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',
   headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({from,to:[recipient.data],subject:'MIF Smart — New website inquiry',text}),
   signal:AbortSignal.timeout(8000)
  });
  return {status:response.ok?'sent':'failed'};
 }catch{return {status:'failed'}}
}
