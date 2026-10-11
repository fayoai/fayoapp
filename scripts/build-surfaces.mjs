import {build} from 'vite';
import {existsSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
const surfaces=['enterprise','developer','mif'];
const removeFrom={
 enterprise:['developer','rawi-developer-mark.svg','mif-logo.svg','mif-mark.svg','mif-app-icon.svg','mif-symbol.png','robots.txt'],
 developer:['manifest.webmanifest','sw.js','offline.html','icons','rawi-mark.svg','mif-logo.svg','mif-mark.svg','mif-app-icon.svg','mif-symbol.png','robots.txt'],
 mif:['developer/sw.js','developer/offline.html','sw.js','offline.html','icons']
};
for(const surface of surfaces){
 process.env.VITE_APP_SURFACE=surface;
 const dir=join('dist',surface);
 await build({build:{outDir:dir,emptyOutDir:true}});
 for(const item of removeFrom[surface]){
  const file=join(dir,item);
  if(existsSync(file))rmSync(file,{recursive:true,force:true});
 }
 const index=join(dir,'index.html');
 if(!existsSync(index))throw Error('Missing '+surface+' entry');
 const assets=join(dir,'assets');
 const js=readdirSync(assets).filter(x=>x.endsWith('.js')).map(x=>readFileSync(join(assets,x),'utf8')).join('\n');
 if(surface==='enterprise'&&(js.includes('RAWI Developer')||js.includes('rd-chat-first')))throw Error('Developer source is present in Enterprise bundle');
 if(surface==='developer'&&(js.includes('mif-chat-welcome')||js.includes('mif-bottom-nav')))throw Error('Enterprise source is present in Developer bundle');
 if(surface==='mif'&&(js.includes('rd-chat-first')||js.includes('mif-chat-welcome')))throw Error('Customer application source is present in the MIF SaaS bundle');
 console.log('Verified independent '+surface+' application build');
}
