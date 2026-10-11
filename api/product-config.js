// Canonical product discovery/configuration, shared between storefront and API.
export const productRequirements={
 'MIF-AI-ERP':[
  {key:'users',type:'number',ar:'المستخدمون',en:'Users',min:1,max:10000,default:5},
  {key:'integrations',type:'multi',ar:'برامج الأعمال المطلوب ربطها',en:'Business platforms to connect',options:[['odoo','Odoo','Odoo'],['erpnext','ERPNext','ERPNext'],['zoho','Zoho','Zoho'],['email','البريد الإلكتروني','Email']],default:['odoo']},
  {key:'modules',type:'multi',ar:'الوظائف المطلوبة',en:'Required features',options:[['crm','العملاء','CRM'],['invoices','الفواتير','Invoices'],['tasks','المهام','Tasks'],['knowledge','قاعدة المعرفة','Knowledge']],default:['crm','invoices','tasks','knowledge']}
 ],
 'MIF-ERP':[
  {key:'users',type:'number',ar:'عدد المستخدمين',en:'Users',min:1,max:1000,default:10},
  {key:'version',type:'select',ar:'إصدار Odoo',en:'Odoo version',options:[['19','Odoo 19','Odoo 19'],['20','Odoo 20','Odoo 20'],['other','إصدار آخر','Other version']],default:'20'},
  {key:'modules',type:'multi',ar:'وحدات العمل المطلوبة',en:'Required business apps',options:[['sales','المبيعات','Sales'],['purchase','المشتريات','Purchase'],['inventory','المخزون','Inventory'],['accounting','المحاسبة','Accounting'],['hr','الموارد البشرية','HR'],['projects','المشاريع','Projects'],['pos','نقطة البيع','POS']],default:['sales','purchase','inventory']},
  {key:'deployment',type:'select',ar:'طريقة التشغيل',en:'Deployment',options:[['managed','استضافة مُدارة','Managed hosting'],['self','على سيرفر العميل','Customer server']],default:'managed'}
 ],
 'MIF-CONTROL':[
  {key:'instances',type:'number',ar:'عدد نسخ أودو',en:'Odoo instances',min:1,max:5000,default:10},
  {key:'servers',type:'number',ar:'عدد السيرفرات',en:'Servers',min:1,max:1000,default:2},
  {key:'control',type:'select',ar:'نطاق الإدارة',en:'Management scope',options:[['operations','التشغيل والمراقبة','Operations and monitoring'],['full','التشغيل والنسخ والصيانة','Operations, backups and maintenance']],default:'full'}
 ],
 'MIF-PARTNERS':[
  {key:'staff',type:'number',ar:'مستخدمو الإدارة',en:'Admin users',min:1,max:1000,default:5},
  {key:'customers',type:'number',ar:'عدد العملاء المتوقع',en:'Expected customers',min:1,max:100000,default:30},
  {key:'deployment',type:'select',ar:'بيئة التشغيل',en:'Hosting preference',options:[['cloud','سحابي','Cloud'],['private','استضافة خاصة','Private hosting']],default:'cloud'}
 ],
 'MIF-MARKETING':[
  {key:'sites',type:'number',ar:'عدد المواقع',en:'Websites',min:1,max:100,default:1},
  {key:'team',type:'number',ar:'عدد مستخدمي التسويق',en:'Marketing team users',min:1,max:1000,default:3},
  {key:'channels',type:'multi',ar:'القنوات المطلوبة',en:'Required channels',options:[['web','الموقع','Website'],['chat','المحادثات','Chat'],['whatsapp','واتساب','WhatsApp'],['analytics','التحليلات','Analytics']],default:['web','chat']}
 ],
 'MIF-EMAIL':[
  {key:'mailboxes',type:'number',ar:'عدد صناديق البريد',en:'Mailboxes',min:1,max:10000,default:10},
  {key:'domain',type:'text',ar:'الدومين (اختياري)',en:'Domain (optional)',maxLength:180,default:''},
  {key:'migration',type:'select',ar:'نقل البريد القديم',en:'Email migration',options:[['no','لا','No'],['yes','نعم','Yes']],default:'no'}
 ]
};
export function defaultProductConfig(sku){
 return Object.fromEntries((productRequirements[sku]||[]).map(f=>[f.key,Array.isArray(f.default)?[...f.default]:f.default]));
}
export function validateProductConfig(sku,input){
 const fields=productRequirements[sku]||[];
 if(!fields.length)return {};
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Missing product configuration');
 const keys=new Set(fields.map(f=>f.key));
 if(Object.keys(input).some(key=>!keys.has(key)))throw Error('Unknown product option');
 const result={};
 for(const field of fields){
  const value=input[field.key]??field.default;
  if(field.type==='number'){
   const n=Number(value);
   if(!Number.isSafeInteger(n)||n<field.min||n>field.max)throw Error('Invalid '+field.key);
   result[field.key]=n;
  }else if(field.type==='text'){
   if(typeof value!=='string'||value.length>(field.maxLength||200))throw Error('Invalid '+field.key);
   result[field.key]=value.trim();
  }else if(field.type==='select'){
   if(typeof value!=='string'||!field.options.some(x=>x[0]===value))throw Error('Invalid '+field.key);
   result[field.key]=value;
  }else if(field.type==='multi'){
   if(!Array.isArray(value)||value.length>field.options.length||new Set(value).size!==value.length||value.some(v=>!field.options.some(x=>x[0]===v)))throw Error('Invalid '+field.key);
   result[field.key]=[...value];
  }
 }
 return result;
}
export function needsTailoredQuote(sku){return !/^MOD-[A-Z0-9-]{3,50}$/.test(sku);}
