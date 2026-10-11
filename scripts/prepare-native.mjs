import {readFileSync,writeFileSync} from 'node:fs';
export function prepareNativeConfig(target,siteOrigin,originalEnterprise,originalDeveloper){
 if(!['enterprise','developer'].includes(target))throw new Error('Unknown RAWI application');
 let site;try{site=new URL(siteOrigin)}catch{throw new Error('A valid deployed HTTPS origin is required')}
 if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash||site.pathname!=='/'||!site.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|172\.16\.)/.test(site.hostname))throw new Error('A public HTTPS origin without a path is required');
 const source=target==='developer'?originalDeveloper:originalEnterprise;
 const cfg=structuredClone(source);
 cfg.server={...cfg.server,url:site.origin+(target==='developer'?'/developer/':'/'),cleartext:false,androidScheme:'https'};
 if(target==='developer'){
  if(cfg.appId!=='com.mifsmart.rawideveloper'||cfg.plugins?.SplashScreen?.backgroundColor!=='#080808')throw new Error('Approved Developer native identity is missing');
 }else if(cfg.plugins?.SplashScreen?.backgroundColor!=='#e35a0e')throw new Error('Approved Enterprise orange native identity is missing');
 return cfg;
}
if(process.argv[1]?.endsWith('/prepare-native.mjs')){
 const enterprise=JSON.parse(readFileSync('capacitor.config.json','utf8'));
 const developer=JSON.parse(readFileSync('capacitor.developer.config.json','utf8'));
 const cfg=prepareNativeConfig(process.env.RAWI_NATIVE_TARGET,process.env.RAWI_PUBLIC_SITE_URL,enterprise,developer);
 writeFileSync('capacitor.config.json',JSON.stringify(cfg,null,2)+'\n');
 console.log('Configured remote HTTPS debug application: '+cfg.appName+' / '+cfg.server.url);
}
