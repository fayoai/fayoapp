// Deterministic, bilingual product routing; intentionally does not pretend to be a generative AI model.
const rules=[
 {sku:'MIF-PARTNERS',patterns:[/شركاء|شريك|وكلاء|موزعين|partner|reseller/i,/موزع.*اودو|odoo.*partner/i]},
 {sku:'MIF-CONTROL',patterns:[/حاويات|containers?|دومينات|domains?|نسخ احتياطي|backup|صيانة.*سيرفر|ادار[هة].*نسخ|odoo control/i,/ادار[هة].*استضاف|ادار[هة].*سيرفرات.*عملاء/i]},
 {sku:'MIF-MARKETING',patterns:[/تسويق|حملات|اعلانات|marketing|campaigns?|leads?|الموقع.*التسويق/i,/محادثات.*موقع|محتوى.*موقع|فرص.*تسويق/i]},
 {sku:'MIF-MODULES',patterns:[/موديول|موديولات|اضافات|اضافه|modules?|addons?|plugins?/i,/تخصيص.*اودو|odoo.*module/i]},
 {sku:'MIF-EMAIL',patterns:[/بريد|ايميل|email|outlook|business mail/i]},
 {sku:'MIF-HOSTING',patterns:[/استضافه|سيرفر|خادم|خوادم|hosting|servers?|vps|ram|cpu|data.?center/i,/موارد.*تشغيل|سيرفر.*سعودي/i]},
 {sku:'MIF-ERP',patterns:[/اودو|odoo|erp|محاسب[هة]?|محاسبه|مبيعات|مخزون|مشتريات|الموارد البشريه|نقاط البيع|inventory|accounting|purchasing/i,/برنامج.*شرك[هة]|نظام.*شرك[هة]/i]}
];
export function normalizeQuestion(text){return String(text||'').normalize('NFKC').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\u064b-\u065f]/g,'').trim().slice(0,500);}
export function adviseProducts(question,{limit=3}={}){
 const q=normalizeQuestion(question);
 if(!q)return [];
 return rules.map(({sku,patterns},index)=>({sku,score:patterns.reduce((n,p,i)=>n+(p.test(q)?(i===0?3:2):0),0),index}))
  .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index)
  .slice(0,Math.max(1,Math.min(7,limit))).map(({sku,score})=>({sku,score}));
}
