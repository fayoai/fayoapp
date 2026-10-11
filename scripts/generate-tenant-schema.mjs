import {readFileSync,writeFileSync} from 'node:fs';
const sources=["auth","ai-erp","erp-core","mif-chat","mif-platform","mif-guest","mif-saas","mif-website","rawi-advanced","rawi-chat-isolation","rawi-activities","rawi-onboarding","rawi-products","mif-inquiry-workflow"];
const input=sources.map(name=>readFileSync(new URL('../sql/'+name+'.sql',import.meta.url),'utf8')).join('\n');
let buf='',quoted=false;const statements=[];
for(let i=0;i<input.length;i++){
 const ch=input[i];
 if(ch==="'"&&input[i+1]==="'"&&quoted){buf+="''";i++;continue}
 if(ch==="'")quoted=!quoted;
 if(ch===';'&&!quoted){if(buf.trim())statements.push(buf.trim());buf=''}
 else buf+=ch;
}
if(buf.trim())statements.push(buf.trim());
const moduleText=['// Generated from checked-in SQL migrations. No credentials or customer data.','export const tenantMigrationSteps='+JSON.stringify(statements)+';','export const tenantMigrationCount=tenantMigrationSteps.length;',''].join('\n');
writeFileSync(new URL('../api/tenant-schema.generated.js',import.meta.url),moduleText);
console.log('Generated '+statements.length+' tenant schema statements');
