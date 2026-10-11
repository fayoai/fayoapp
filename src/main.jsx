import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);

if ('serviceWorker' in navigator && (location.protocol==='https:' || ['localhost','127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load',()=>{const developers=location.pathname==='/developers'||location.pathname.startsWith('/developers/');navigator.serviceWorker.register(developers?'/developers/sw.js':'/sw.js',{scope:developers?'/developers/':'/'}).catch(()=>{})});
}
