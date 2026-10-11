import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Activity,ArrowUpLeft,ArrowLeft,Boxes,BrainCircuit,CheckCircle2,ChevronLeft,Command,CreditCard,ExternalLink,FileText,Globe2,HardDrive,Layers3,Mail,MessageSquareText,MonitorSmartphone,Network,Package,Send,ServerCog,ShieldCheck,ShoppingBag,Sparkles,Workflow,Zap} from 'lucide-react';
import {offers,cycleLabels} from '../api/commerce-model.js';
import {useSite,tr} from './App.jsx';
import './ai-portal.css';

const productIcons={'MIF-ERP':Boxes,'MIF-CONTROL':ServerCog,'MIF-PARTNERS':Network,'MIF-MARKETING':MessageSquareText,'MIF-HOSTING':HardDrive,'MIF-MODULES':Layers3,'MIF-EMAIL':Mail};
const prompts=[
 {ar:'أريد Odoo Community المطوّر',en:'I need enhanced Odoo Community',icon:Boxes},
 {ar:'أريد إدارة نسخ عملائي',en:'Manage Odoo client instances',icon:ServerCog},
 {ar:'أريد منصة لشركاء Odoo',en:'Explore Odoo Partner SaaS',icon:Network},
 {ar:'أريد منصة للتسويق',en:'Explore marketing platform',icon:Workflow},
 {ar:'ما خيارات الدفع والاشتراكات؟',en:'What billing terms are available?',icon:CreditCard},
 {ar:'كيف أثبّت التطبيق على جهازي؟',en:'How do I install the app?',icon:MonitorSmartphone}
];
const isMatch=(text,re)=>re.test(text);
function getGuidance(question,lang){
 const q=question.toLowerCase().normalize('NFKC');
 const l=(ar,en)=>tr(lang,ar,en);
 const found=(sku)=>offers.find(x=>x.sku===sku);
 const product=(sku,ar,en)=>({text:l(ar,en),items:[found(sku)],links:[{to:'/store/'+found(sku).slug,label:l('استعرض المنتج','View product')},{to:'/store',label:l('كل المنتجات','All products')}]});
 if(isMatch(q,/تثبيت|تنزيل|تحميل التطبيق|جوال|موبايل|اندرويد|ايفون|ويندوز|ماك|linux|install|desktop|android|iphone|ipad|windows|macos/))return {text:l('التطبيق متاح كتجربة قابلة للتثبيت على الجوال والكمبيوتر عبر المتصفحات المدعومة. من صفحة التطبيقات ستجد تعليمات كل نظام.', 'Install the web app on supported mobile and desktop browsers. Visit Apps for platform-specific steps.'),links:[{to:'/apps',label:l('تثبيت التطبيق','Install the app')}]};
 if(isMatch(q,/دفع|اشتراك|شهري|سنوي|ربع سنوي|نصف سنوي|مرة واحدة|سعر|billing|payment|monthly|quarterly|yearly|subscription|price/))return {text:l('تقدر تختار الدفع مرة واحدة أو شهري أو ربع سنوي أو نصف سنوي أو سنوي، حسب المنتج. السعر وطرق الدفع المتاحة بيظهروا في صفحة المنتج، والدفع يتفعل فقط بعد اعتماد السعر وربط البوابة.', 'Billing options are one time, monthly, quarterly, half yearly and yearly, depending on the product. Available payment methods appear at checkout once pricing and the payment gateway are configured.'),links:[{to:'/store',label:l('افتح المتجر','Open store')},{to:'/orders',label:l('متابعة الطلبات','Track orders')}]};
 if(isMatch(q,/طلباتي|حالة الطلب|رقم الطلب|متابعة طلب|order status|track order|my order/))return {text:l('يمكنك متابعة حالة الطلب والسداد من مركز الطلبات باستخدام رقم الطلب ورمز الوصول الخاص بك.', 'Track your order and payment status with your order reference and private access code.'),links:[{to:'/orders',label:l('متابعة الطلب','Track order')}]};
 if(isMatch(q,/بريد|ايميل|إيميل|email|mail|outlook/))return product('MIF-EMAIL','خدمة البريد المؤسسي تشمل بريدًا بدومين شركتك وإعدادات DNS وخيارات الإدارة والترحيل.','Business email with custom domain, DNS configuration, and managed setup options.');
 if(isMatch(q,/موديول|إضافة|إضافات|plugin|addon|module/))return product('MIF-MODULES','متجر إضافات Odoo يضم الموديولات التي ننشرها، مع توضيح الإصدارات المتوافقة وشروط التسليم.','Browse published Odoo add-ons with compatibility and delivery details.');
 if(isMatch(q,/استضافة|سيرفر|خادم|hosting|server|vps|ram|cpu/))return product('MIF-HOSTING','كوّن الاستضافة المطلوبة حسب موقع مركز البيانات والمعالج والذاكرة والتخزين والنسخ الاحتياطي، ثم اطلب تسعيرًا.','Configure your server location, CPU, RAM, storage and backups, then request pricing.');
 if(isMatch(q,/شركاء|شريك|partner|reseller/))return product('MIF-PARTNERS','Partner Cloud مخصص لإدارة عملاء وفرص ومشاريع واشتراكات ودعم شركاء Odoo.','Partner Cloud brings Odoo partner customers, opportunities, projects, subscriptions and support together.');
 if(isMatch(q,/تسويق|موقع|محادثات|حملات|marketing|website|campaign|lead/))return product('MIF-MARKETING','MIF Marketing لإدارة الموقع والصفحات والمحتوى والفرص والعروض والمحادثات من مساحة واحدة.','MIF Marketing brings website pages, content, leads, offers and conversations together.');
 if(isMatch(q,/إدارة أودو|حاويات|دومينات|نسخ احتياط|صيانة|odoo control|backup|containers|domains/))return product('MIF-CONTROL','MIF Odoo Control لإدارة بيئات Odoo والدومينات والنسخ الاحتياطية والصيانة والتحديثات.','MIF Odoo Control manages Odoo environments, domains, backups, maintenance and releases.');
 if(isMatch(q,/أودو|اودو|erp|مبيعات|محاسبة|مخزون|مشتريات|odoo|accounting|inventory/))return product('MIF-ERP','Odoo Community المطوّر هو المنتج الأساسي. استعرض الوحدات المتاحة وفترة الدفع المناسبة من صفحة المنتج.', 'Enhanced Odoo Community is the core ERP product. Explore its supported modules and billing options on the product page.');
 return {text:l('أقدر أوجّهك مباشرةً للمنتج أو الخدمة المناسبة. كل المنتجات موجودة تحت مساحة المحادثة، أو اختر أحد الأسئلة الجاهزة علشان توصّل للي تحتاجه بسرعة.','I can guide you to the appropriate product or service. Explore the entire collection below, or choose a suggested prompt to get started.'),links:[{to:'/store',label:l('استكشف كل المنتجات','Explore the store')},{to:'/contact',label:l('تواصل معنا','Contact us')}]};
}
function SolutionIcon({sku,size=24}){const Icon=productIcons[sku]||Package;return <Icon size={size} strokeWidth={1.6}/>}
function SmartShortcut({to,icon:Icon,children}){return <Link to={to} className="ai-shortcut"><Icon size={18}/><span>{children}</span><ArrowUpLeft size={15}/></Link>}
export default function AIPortal(){
 const {lang}=useSite(),navigate=useNavigate(),L=(ar,en)=>tr(lang,ar,en);
 const [draft,setDraft]=useState(''),[messages,setMessages]=useState([]),[active,setActive]=useState('overview');
 const inputRef=useRef(null),feedRef=useRef(null);
 useEffect(()=>{const onKey=(e)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();inputRef.current?.focus()}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
 useEffect(()=>{if(feedRef.current)feedRef.current.scrollTop=feedRef.current.scrollHeight},[messages]);
 const ask=(raw)=>{const question=String(raw||draft).trim().slice(0,500);if(!question)return;setDraft('');const answer=getGuidance(question,lang);setMessages(old=>[...old.slice(-9),{id:Date.now()+Math.random(),question,answer}]);setActive('assistant')};
 const navItems=[
  {id:'overview',icon:BrainCircuit,to:'/',ar:'مساحة الذكاء',en:'Intelligence hub'},
  {id:'store',icon:ShoppingBag,to:'/store',ar:'المتجر والمنتجات',en:'Products & store'},
  {id:'orders',icon:FileText,to:'/orders',ar:'الطلبات والاشتراكات',en:'Orders & billing'},
  {id:'apps',icon:MonitorSmartphone,to:'/apps',ar:'التطبيقات والأجهزة',en:'Apps & devices'},
  {id:'contact',icon:MessageSquareText,to:'/contact',ar:'التواصل',en:'Contact'}
 ];
 return <div className="ai-portal">
  <div className="ai-atmosphere" aria-hidden="true"/><div className="ai-grid-pattern" aria-hidden="true"/>
  <div className="ai-topline"><span><span className="ai-topline-orb"/><Sparkles size={14}/> MIF SMART <span className="ai-topline-dash">/</span> INTELLIGENCE INTERFACE</span><span className="ai-topline-right"><ShieldCheck size={14}/>{L('الهوية الأصلية · واجهة متكاملة','Original identity · Unified interface')}</span></div>
  <div className="ai-layout">
   <aside className="ai-sidebar">
    <div className="ai-sidebar-brand"><img src="/mif-symbol.png" alt="MIF Smart"/><div><strong>MIF <em>Smart</em></strong><small>INTELLIGENCE WORKSPACE</small></div></div>
    <div className="ai-side-label">{L('مساحة العمل','WORKSPACE')}</div>
    <nav className="ai-side-nav" aria-label={L('التنقل في المنصة','Platform navigation')}>{navItems.map(item=><Link key={item.id} to={item.to} onClick={()=>setActive(item.id)} className={active===item.id?'ai-side-link on':'ai-side-link'}><item.icon size={19}/><span>{L(item.ar,item.en)}</span>{active===item.id&&<i/>}</Link>)}</nav>
    <div className="ai-side-label">{L('اختصارات الحلول','PRODUCT ACCESS')}</div>
    <nav className="ai-side-products" aria-label={L('منتجات المنصة','Platform products')}>{offers.map(p=><Link key={p.sku} to={'/store/'+p.slug}><SolutionIcon sku={p.sku} size={17}/><span>{L(p.title_ar,p.title_en)}</span><ChevronLeft size={13}/></Link>)}</nav>
    <div className="ai-sidebar-end"><div className="ai-sidebar-powered"><img src="/icons/icon-512.png" alt="" /><span>{L('نفس شعارك وأيقونة التطبيق','Existing brand & application icon')}</span></div><Link to="/admin"><Command size={16}/>{L('لوحة الإدارة','Management console')}<ArrowUpLeft size={13}/></Link></div>
   </aside>
   <main className="ai-primary">
    <div className="ai-kicker"><span className="ai-kicker-dot"/><span>AI-FIRST EXPERIENCE</span><span className="ai-kicker-line"/></div>
    <div className="ai-intro"><div><h1>{L('واجهة واحدة.','One interface.')}<span>{L('كل إمكانياتك.','Every capability.')}</span></h1><p>{L('اكتب احتياجك، واستكشف منتجاتنا واشتراكاتنا وخدماتنا من مساحة عمل تفاعلية واحدة، بدون ما تضيع بين صفحات موقع تقليدي.','Describe what you need and discover every product, billing option and service from one interactive workspace.')}</p></div><div className="ai-core-symbol" aria-hidden="true"><div className="ai-core-ring"/><div className="ai-core-inner"><img src="/mif-symbol.png" alt=""/></div><span className="ai-core-node n1"/><span className="ai-core-node n2"/><span className="ai-core-node n3"/></div></div>
    <div className="ai-workspace">
     <section className="ai-conversation" aria-label={L('المساعد التفاعلي','Interactive assistant')}>
      <div className="ai-pane-head"><div className="ai-agent"><span><img src="/mif-symbol.png" alt=""/></span><div><strong>MIF Assistant</strong><small>{L('مساعد الاستكشاف التفاعلي','Interactive product guide')}</small></div></div><div className="ai-pane-mode"><Activity size={14}/>{L('جاهز للاستكشاف','Ready to explore')}</div></div>
      <div className="ai-chat-feed" ref={feedRef} aria-live="polite"><div className="ai-chat-greeting"><span className="ai-chat-spark"><Sparkles size={20}/></span><strong>{L('كيف أقدر أساعدك؟','What can I help you explore?')}</strong><p>{L('اسأل عن Odoo Community المطوّر، إدارة الاستضافات، الشركاء، التسويق، أو خيارات الاشتراك.','Ask about enhanced Odoo Community, hosting control, partners, marketing or billing.')}</p></div>
       {messages.map(m=><div className="ai-exchange" key={m.id}><div className="ai-msg-user">{m.question}</div><div className="ai-msg-assistant"><div className="ai-msg-logo"><img src="/mif-symbol.png" alt=""/></div><div><p>{m.answer.text}</p>{m.answer.items?.map(p=><Link className="ai-result-product" key={p.sku} to={'/store/'+p.slug}><SolutionIcon sku={p.sku}/><span>{L(p.title_ar,p.title_en)}</span><ArrowUpLeft size={15}/></Link>)}<div className="ai-result-links">{m.answer.links?.map(link=><Link key={link.to} to={link.to}>{link.label}<ArrowUpLeft size={14}/></Link>)}</div></div></div></div>)}
      </div>
      <div className="ai-compose">
       <div className="ai-prompts">{prompts.map(p=><button key={p.en} type="button" onClick={()=>ask(L(p.ar,p.en))}><p.icon size={14}/>{L(p.ar,p.en)}</button>)}</div>
       <form onSubmit={e=>{e.preventDefault();ask()}} className="ai-prompt-bar"><Sparkles size={21}/><input ref={inputRef} maxLength={500} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={L('اسأل عن منتج، مدة الدفع، أو خدمة تحتاجها...','Ask about a product, billing term or service...')} aria-label={L('اكتب طلبك','Enter your request')}/><span className="ai-kbd">Ctrl K</span><button type="submit" disabled={!draft.trim()} aria-label={L('إرسال','Send')}><Send size={19}/></button></form>
       <small className="ai-chat-caveat">{L('مساعد توجيه ذكي داخل المنصة. الإجابات إرشادية، وليس متصلاً حاليًا بنموذج ذكاء اصطناعي خارجي.','Smart in-app product navigation. Guided responses only; no external generative AI model is connected.')}</small>
      </div>
     </section>
     <aside className="ai-insights">
      <div className="ai-insight-top"><span><Zap size={16}/>{L('الوصول السريع','QUICK ACCESS')}</span><span>01 / 03</span></div>
      <h2>{L('من الفكرة إلى المنتج','From intent to product')}</h2><p>{L('كل أقسام المتجر والخدمات الأساسية متاحة بدون ما تخرج من تجربة المنصة.','Every essential product and service remains one step away.')}</p>
      <SmartShortcut to="/store" icon={ShoppingBag}>{L('استكشف المتجر الكامل','Explore the full store')}</SmartShortcut>
      <SmartShortcut to="/store/odoo-community" icon={Boxes}>{L('Odoo Community المطوّر','Enhanced Odoo Community')}</SmartShortcut>
      <SmartShortcut to="/orders" icon={FileText}>{L('متابعة الطلبات','Track orders')}</SmartShortcut>
      <SmartShortcut to="/apps" icon={MonitorSmartphone}>{L('تثبيت التطبيق','Install the app')}</SmartShortcut>
      <div className="ai-insight-divider"/>
      <div className="ai-insight-top"><span><CreditCard size={16}/>{L('دورات الدفع','BILLING TERMS')}</span><span>02 / 03</span></div>
      <div className="ai-billing">{Object.entries(cycleLabels).map(([id,label])=><Link key={id} to="/store"><CheckCircle2 size={14}/>{L(label,{once:'One time',monthly:'Monthly',quarterly:'Quarterly',semiannual:'Half yearly',yearly:'Yearly'}[id])}</Link>)}</div>
      <div className="ai-insight-divider"/>
      <div className="ai-insight-top"><span><Globe2 size={16}/>{L('التطبيقات','CROSS-DEVICE')}</span><span>03 / 03</span></div>
      <div className="ai-devices"><MonitorSmartphone size={29}/><div><strong>Android · iOS</strong><small>Windows · macOS · Linux</small></div><Link to="/apps" aria-label={L('عرض التطبيقات','View apps')}><ArrowUpLeft size={18}/></Link></div>
     </aside>
    </div>
   </main>
  </div>
  <section className="ai-collection" id="ai-ecosystem"><div className="ai-collection-head"><div><span className="ai-section-kicker"><Layers3 size={16}/> MIF / PRODUCTS</span><h2>{L('كل المنتجات.','Every product.')} <em>{L('مساحة واحدة.','One workspace.')}</em></h2><p>{L('نفس المنتجات الموجودة في المتجر، مع تفاصيلها وأنظمة الدفع والطلب بدون تغيير.','The same store catalog with product details, billing terms and checkout preserved.')}</p></div><Link to="/store">{L('المتجر الكامل','Full store')}<ArrowUpLeft size={18}/></Link></div>
   <div className="ai-product-grid">{offers.map((p,i)=><Link to={'/store/'+p.slug} className="ai-product" key={p.sku}><div className="ai-product-head"><div className="ai-product-icon"><SolutionIcon sku={p.sku} size={28}/></div><span className="ai-product-num">{String(i+1).padStart(2,'0')} / {String(offers.length).padStart(2,'0')}</span></div><h3>{L(p.title_ar,p.title_en)}</h3><p>{L(p.description_ar,p.description_en)}</p><div className="ai-product-bottom"><span>{p.cycles.length} {L('أنظمة دفع','billing terms')}</span><span>{L('التفاصيل','Explore')} <ArrowUpLeft size={16}/></span></div></Link>)}</div>
  </section>
  <div className="ai-bottom-cta"><span><Sparkles size={17}/> MIF SMART / CONNECTED EXPERIENCE</span><p>{L('أنت تختار. المنصة توصّلك.','Your intent. Your next step.')}</p><div><Link to="/store">{L('ابدأ من المتجر','Open store')}<ArrowUpLeft size={17}/></Link><Link to="/contact">{L('تواصل معنا','Contact us')}<ArrowUpLeft size={17}/></Link></div></div>
 </div>;
}
