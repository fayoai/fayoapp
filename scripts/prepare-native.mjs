import {readFileSync,writeFileSync} from 'node:fs';
export function prepareNativeConfig(target,siteOrigin,originalERP){
 if(target!=='enterprise')throw new Error('Only RAWI ERP is enabled');
 let site;try{site=new URL(siteOrigin)}catch{throw new Error('Valid HTTPS RAWI ERP origin required')}
 if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash||site.pathname!=='/'||!site.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|172\.16\.)/.test(site.hostname))throw new Error('Public HTTPS origin required');
 const cfg=structuredClone(originalERP);
 cfg.server={...cfg.server,url:site.origin+'/',cleartext:false,androidScheme:'https'};
 if(cfg.plugins?.SplashScreen?.backgroundColor!=='#2166e8')throw new Error('RAWI ERP approved blue icon is required');
 return cfg;
}
if(process.argv[1]?.endsWith('/prepare-native.mjs')){
 const erp=JSON.parse(readFileSync('capacitor.config.json','utf8'));
 const cfg=prepareNativeConfig('enterprise',process.env.RAWI_PUBLIC_SITE_URL,erp);
 writeFileSync('capacitor.config.json',JSON.stringify(cfg,null,2)+'\n');
 console.log('Configured RAWI ERP native wrapper for '+cfg.server.url);
}
