import React,{useState,createContext,useContext,useEffect} from 'react';
import Admin from './Admin.jsx';
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
 const [lang,setLang]=useState(()=>{try{return localStorage.getItem('mif_lang')==='en'?'en':'ar'}catch{return 'ar'}});
 useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';try{localStorage.setItem('mif_lang',lang)}catch{}},[lang]);
 return <SiteContext.Provider value={{lang,setLang,mode:'live'}}><Admin/></SiteContext.Provider>;
}
