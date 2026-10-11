export const otpDurationMinutes=10;
export function createSixDigitCode(){
 const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);return String(100000+(bytes[0]%900000));
}
export async function hashVerificationCode(secret,email,code){
 if(!secret||secret.length<32)throw Error('Verification secret is unavailable');
 const input=new TextEncoder().encode(secret+'|rawi-email-otp|'+email.toLowerCase()+'|'+code);
 const hash=await crypto.subtle.digest('SHA-256',input);
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
export function mailReady(settings){
 return !!(settings.RESEND_API_KEY?.length>15&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.EMAIL_FROM||''));
}
export async function deliverVerificationCode(settings,email,code,language='ar'){
 if(!mailReady(settings))throw Error('Verified sending address and email API key are required');
 const result=await fetch('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:'Bearer '+settings.RESEND_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({from:settings.EMAIL_FROM,to:[email],subject:language==='ar'?'نظام راوي — رمز تأكيد البريد الإلكتروني':'Rawi ERP — Email verification',
   text:language==='ar'?'رمز التأكيد الخاص بنظام راوي هو '+code+'. تنتهي صلاحيته خلال 10 دقائق. إذا لم تطلب التسجيل، تجاهل هذه الرسالة.':'Your Rawi ERP verification code is '+code+'. It expires in 10 minutes. If you did not sign up, ignore this email.'}),
  signal:AbortSignal.timeout(12000)
 });
 if(!result.ok)throw Error('Email provider rejected the verification message');
 return true;
}
