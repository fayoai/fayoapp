/* RAWI Developers native desktop app: secure standalone Odoo engineering shell. */
import {app,BrowserWindow,shell} from 'electron';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(readFileSync(path.join(dir,'desktop-config.json'),'utf8'));
const raw=String(process.env.RAWI_DEVELOPERS_URL||config.siteUrl||'');
let site;
try{site=new URL(raw);if(site.protocol!=='https:'||site.hostname.endsWith('.example')||!['/developers','/developers/'].includes(site.pathname))throw new Error('Invalid deployment URL');}
catch{throw new Error('RAWI Developers requires a verified production HTTPS domain ending with /developers/')}
const allowed=site.origin;
function isInternal(input){try{const u=new URL(input);return u.origin===allowed&&(u.pathname==='/developers'||u.pathname.startsWith('/developers/'))}catch{return false}}
function external(url){try{const u=new URL(url);if(['https:','mailto:'].includes(u.protocol))shell.openExternal(u.href)}catch{}}
const create=async()=>{
 const icon=path.join(dir,'build','icon.png');
 const win=new BrowserWindow({width:1500,height:940,minWidth:850,minHeight:620,backgroundColor:'#0b0b0d',title:'RAWI Developers',
  ...(existsSync(icon)?{icon}:{}),
  autoHideMenuBar:true,
  webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false}});
 win.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'}});
 win.webContents.on('will-navigate',(event,url)=>{if(!isInternal(url)){event.preventDefault();external(url)}});
 win.webContents.session.setPermissionRequestHandler((_web,_permission,callback)=>callback(false));
 await win.loadURL(site.href);
};
app.whenReady().then(async()=>{await create();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)create()})});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
