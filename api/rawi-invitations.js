const encoder=new TextEncoder();
export async function hashInvite(token,secret){
 if(!secret||secret.length<32)throw new Error('Safe invitation secret required');
 const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(secret+'|rawi-invitation|'+token));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
export function newInviteToken(){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
