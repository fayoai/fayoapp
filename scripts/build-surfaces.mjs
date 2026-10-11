import {build} from 'vite';
import {existsSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
const surfaces=['enterprise','mif'];
const removeFrom={
 enterprise:['developer','rawi-developer-mark.svg','rawi-mark.svg','mif-logo.svg','mif-mark.svg','mif-app-icon.svg','mif-symbol.png','robots.txt'],
 mif:['developer','rawi-developer-mark.svg','rawi-mark.svg','sw.js','offline.html','icons']
};
for(const surface of surfaces){
 process.env.VITE_APP_SURFACE=surface;
 const dir=join('dist',surface);
 await build({build:{outDir:dir,emptyOutDir:true}});
 for(const item of removeFrom[surface]){
  const asset=join(dir,item);if(existsSync(asset))rmSync(asset,{force:true,recursive:true});
 }
 if(!existsSync(join(dir,'index.html')))throw Error('Missing '+surface+' app');
 const assetdir=join(dir,'assets');
 const js=readdirSync(assetdir).filter(x=>x.endsWith('.js')).map(x=>readFileSync(join(assetdir,x),'utf8')).join('\n');
 if(js.includes('rd-chat-first')||js.includes('RawiDevelopers'))throw Error('Inactive Dev product bundled in '+surface);
 if(surface==='mif'&&js.includes('mif-chat-welcome'))throw Error('RAWI ERP bundled inside MIF company assets');
 console.log('Verified only active '+surface+' app');
}
