import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
export function approvedNativeSvg(target,raw){
 if(!['enterprise','developer'].includes(target))throw new Error('Unknown RAWI app');
 if(!raw.includes('viewBox="280 165 690 742"'))throw new Error('Expected approved RAWI mark viewBox');
 const expected=target==='developer'?['#080808','#ffd21a']:['#2166e8','#ffffff'];
 if(expected.some(x=>!raw.includes('fill="'+x+'"')))throw new Error('Approved RAWI application colors or mark changed');
 return raw.replace('viewBox="280 165 690 742"','viewBox="254 165 742 742"');
}
function png(svg,size){return new Resvg(svg,{fitTo:{mode:'width',value:size},background:'rgba(0,0,0,0)'}).render().asPng()}
export function writeApprovedNativeIcons(target,root='.'){
 const filename=target==='developer'?'rawi-developer-mark.svg' :'rawi-erp-mark.svg';
 const svg=approvedNativeSvg(target,readFileSync(join(root,'public',filename),'utf8'));
 const res=join(root,'android','app','src','main','res');
 if(existsSync(join(root,'android'))){
  for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
   const dir=join(res,'mipmap-'+density);mkdirSync(dir,{recursive:true});
   const data=png(svg,size);for(const name of ['ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png'])writeFileSync(join(dir,name),data);
  }
  const anydpi=join(res,'mipmap-anydpi-v26');mkdirSync(anydpi,{recursive:true});
  const xml='<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/rawi_icon_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>';
  for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])writeFileSync(join(anydpi,name),xml);
  const values=join(res,'values');mkdirSync(values,{recursive:true});
  writeFileSync(join(values,'rawi_native_icon_color.xml'),'<?xml version="1.0" encoding="utf-8"?><resources><color name="rawi_icon_background">'+(target==='developer'?'#080808':'#e35a0e')+'</color></resources>');
 }
 if(existsSync(join(root,'ios'))){
  const assets=join(root,'ios','App','App','Assets.xcassets','AppIcon.appiconset');
  mkdirSync(assets,{recursive:true});
  writeFileSync(join(assets,'AppIcon-512@2x.png'),png(svg,1024));
  writeFileSync(join(assets,'Contents.json'),JSON.stringify({images:[{filename:'AppIcon-512@2x.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2));
 }
}
if(process.argv[1]?.endsWith('/native-icons.mjs')){
 writeApprovedNativeIcons(process.env.RAWI_NATIVE_TARGET);
 console.log('Prepared approved '+process.env.RAWI_NATIVE_TARGET+' app icons without modifying source brand assets.');
}
