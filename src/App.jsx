import React,{useState,createContext,useContext,useEffect} from 'react';
import MifSmartShell from './MifSmartShell.jsx';
import MifCompany from './MifCompany.jsx';
import {initialLanguage} from './language-preferences.js';
export const SiteContext=createContext(null);
export const useSite=()=>useContext(SiteContext);
export const tr=(lang,ar,en)=>lang==='ar'?ar:en;
export const formatDay=(date,lang)=>date?new Date(date).toLocaleDateString(lang==='ar'?'ar-SA':'en-US'):'—';
export const displayMoney=(amount,lang)=>new Intl.NumberFormat(lang==='ar'?'ar-SA':'en-US',{style:'currency',currency:'SAR'}).format(Number(amount)||0);
export async function api(path,options={}){
 const response=await fetch(path,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const value=await response.json().catch(()=>({error:'تعذر قراءة استجابة الخادم'}));
 if(!response.ok)throw new Error(value.error||'Request failed ('+response.status+')');
 return value;
}
export default function App(){
 const [lang,setLang]=useState(()=>initialLanguage((window.location.pathname.startsWith('/mif')||window.location.pathname.startsWith('/admin'))?'mif_lang':'rawi_lang'));
 useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';const isMif=window.location.pathname.startsWith('/mif')||window.location.pathname.startsWith('/admin');try{localStorage.setItem(isMif?'mif_lang':'rawi_lang',lang)}catch{}if(!isMif){const title=lang==='ar'?'نظام راوي':'Rawi ERP';document.title=title;const link=document.querySelector('link[rel="manifest"]');if(link)link.href=lang==='ar'?'/manifest.webmanifest':'/manifest.en.webmanifest';const apple=document.querySelector('meta[name="apple-mobile-web-app-title"]');if(apple)apple.content=title}},[lang]);
 return <SiteContext.Provider value={{lang,setLang,mode:'live'}}>{(window.location.pathname.startsWith('/mif')||window.location.pathname.startsWith('/admin'))?<MifCompany/>:<MifSmartShell/>}</SiteContext.Provider>;
}
