/* Secure remote-first MIF Smart desktop shell. No Node access in renderer.
 * Release must configure SITE_URL to deployed HTTPS MIF Smart domain.
 */
import {app,BrowserWindow,shell,session} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
const root=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(readFileSync(path.join(root,'desktop-config.json'),'utf8'));
const siteUrl=String(process.env.MIF_DESKTOP_URL||config.siteUrl||'');
let site;
try {site=new URL(siteUrl);if(site.protocol!=='https:'||!site.hostname||site.hostname.endsWith('.example'))throw Error('Invalid URL');}
catch {throw new Error('MIF desktop app needs a verified deployed HTTPS site URL. Set siteUrl in desktop-config.json before packaging.');}
const allowedOrigin=site.origin;
const winExternal=url=>{
 try {const parsed=new URL(url);if(['https:','mailto:'].includes(parsed.protocol))shell.openExternal(parsed.href)} catch{}
};
const start=async()=>{
 const win=new BrowserWindow({width:1400,height:900,minWidth:760,minHeight:590,backgroundColor:'#151519',title:'MIF Smart AI ERP',autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false}});
 win.webContents.setWindowOpenHandler(({url})=>{winExternal(url);return {action:'deny'}});
 win.webContents.on('will-navigate',(event,url)=>{let parsed;try{parsed=new URL(url)}catch{event.preventDefault();return}if(parsed.origin!==allowedOrigin){event.preventDefault();winExternal(url)}});
 win.webContents.session.setPermissionRequestHandler((_web,permission,callback)=>callback(false));
 await win.loadURL(siteUrl);
};
app.whenReady().then(async()=>{await start();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)start()})});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
