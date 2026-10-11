// A fresh install uses the preferred device language. Explicit user preferences win.
export function languageFromDevice(device){
 const locale=String(device?.languages?.[0]||device?.language||'').trim();
 return /^ar(?:-|$)/i.test(locale)?'ar':'en';
}
export function initialLanguage(storageKey='mif_lang',storage,device){
 let value=null;
 try{
  const resolved=storage===undefined?(typeof localStorage==='undefined'?null:localStorage):storage;
  value=resolved?.getItem(storageKey);
 }catch{}
 if(value==='ar'||value==='en')return value;
 return languageFromDevice(device===undefined?(typeof navigator==='undefined'?null:navigator):device);
}
