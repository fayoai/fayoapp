import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {SiteContext} from './site-shared.jsx';
import './styles.css';
import {initialLanguage} from './language-preferences.js';
export function launch(Screen,workerPath,languageKey='mif_lang'){
 function Runtime(){
  const [lang,setLang]=useState(()=>initialLanguage(languageKey));
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';try{localStorage.setItem(languageKey,lang)}catch{}if(languageKey==='rawi_lang'){const name=lang==='ar'?'نظام راوي':'Rawi ERP';document.title=name;const manifest=document.querySelector('link[rel="manifest"]');if(manifest)manifest.href=lang==='ar'?'/manifest.webmanifest':'/manifest.en.webmanifest';const appleTitle=document.querySelector('meta[name="apple-mobile-web-app-title"]');if(appleTitle)appleTitle.content=name}},[lang,languageKey]);
  return <SiteContext.Provider value={{lang,setLang,mode:'live'}}><Screen/></SiteContext.Provider>
 }
 createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><Runtime/></BrowserRouter></React.StrictMode>);
 if(workerPath&&'serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
  window.addEventListener('load',()=>navigator.serviceWorker.register(workerPath).catch(()=>{}));
 }
}
