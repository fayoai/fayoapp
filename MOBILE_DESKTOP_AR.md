# MIF Smart — تطبيق الجوال والديسكتوب

## الإصدار 3.0 — نطاق الأعمال

المنتجات الحالية: MIF ERP المبني على Odoo Community، وMIF Odoo Control، وPartner Cloud لشركاء أودو، وMIF Marketing، وموديولات Odoo، والاستضافة والسيرفرات والبريد المؤسسي. لا تُعرض المقاولات أو المنازل الذكية حاليًا. أعمال الذكاء الاصطناعي العامة ليست في واجهة المتجر خلال هذه المرحلة.

> **مهم:** الكود والشعارات لا يعنيان توافر إصدار أصلي في المتاجر. الإطلاق يحتاج قاعدة بيانات عاملة واختبارًا فعليًا للدفع ونشر موقع HTTPS وتوقيع حزم المنصات.

## 1. تطبيق ويب واحد — PWA

```bash
npm install
npm run test
npm run build
npm run dev
```

بعد النشر عبر HTTPS: زر «التطبيقات» يشرح طريقة التثبيت. ملف `/manifest.webmanifest` يعرّف الأيقونات واختصارات المتجر والطلبات والإدارة. Service Worker يخزن فقط قالب الصفحات/الأصول العامة، ولا يخزن API أو بيانات الطلب والدفع. يمكن تصفح محتوى مخزن بشكل محدود بدون اتصال؛ الشراء والدفع والأمان يتطلبان الإنترنت.

- Android: عبر Chrome أو متصفح داعم، ثم «تثبيت التطبيق».
- iPhone/iPad: Safari ← مشاركة ← «إضافة إلى الشاشة الرئيسية».
- Windows/macOS/Linux: Chrome أو Edge، ومكوّن تثبيت التطبيقات على المتصفح.

## 2. نسخ Android / iOS الأصلية (Capacitor)

أولًا تأكد من توافر Node 22+، وعنوان API **مستقل وآمن HTTPS**، واضبط:

```bash
export VITE_API_BASE_URL=https://YOUR_REAL_DOMAIN
npm install
npm run build
npm run mobile:add:android
npm run mobile:sync
npx cap open android
```

في Windows استعمل صيغة تعيين البيئة المناسبة. Android Studio وSDK مطلوبان لبناء AAB أو APK. للايفون، على macOS مع Xcode:

```bash
export VITE_API_BASE_URL=https://YOUR_REAL_DOMAIN
npm run build
npm run mobile:add:ios
npm run mobile:sync
npx cap open ios
```

يجب ضبط المتغير **السري** التالي على Cloudflare Worker، باستخدام مصادر الأصول الهجينة المحددة فقط:

`ALLOWED_APP_ORIGINS=capacitor://localhost,https://localhost,http://localhost`

السماح يقتصر على واجهات API العامة المطلوبة من الجوال؛ واجهات الإدارة لا تسمح بتوثيق عابر للمصدر ولا تُرسل أسرارًا إلى التطبيق. لدخول إدارة المنصة من الهاتف افتح رابط HTTPS الأصلي بمتصفح آمن على نفس الموقع. الدفع لدى مزوّد الخدمة سيعيد المستخدم إلى رابط HTTPS في المتصفح؛ لا يُعد تكامل العودة داخل التطبيق أصلًا حتى يُضبط Deep Link موثوق.

سير عمل `mobile-android.yml` ينتج **debug APK** عند استدعائه يدويًا بعد تحديد HTTPS، ولا ينتج نسخة متجر موقعة. سير عمل `mobile-ios.yml` يبني **نسخة محاكي unsigned** فقط، وليست IPA قابلة للتوزيع.

## 3. سطح المكتب — Electron

يشغّل تطبيق Electron **الموقع المنشور نفسه عبر HTTPS** للحفاظ على وظائف المتجر ولوحة الإدارة والدفع، بدل نسخ بيانات العميل إلى تطبيق محلي غير متصل. هيكل Electron مقيّد: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`، ويفتح الروابط الخارجية في المتصفح وليس في نافذة التطبيق الداخلية.

عدّل `apps/desktop/desktop-config.json` بوضع عنوان النشر الصحيح قبل البناء:

```json
{"siteUrl":"https://YOUR_REAL_DOMAIN"}
```

ثم على الجهاز المستهدف:

```bash
cd apps/desktop
npm install
npm start
npm run dist:win       # على Windows
npm run dist:mac       # على macOS
npm run dist:linux     # على Linux
```

يمكنك تشغيل GitHub Action `apps-desktop.yml` يدويًا بعد إدخال URL صالح لـ MIF Smart. ستنتج حزم **غير موقعة** لكل نظام؛ للمستخدمين النهائيين يتطلب التوزيع تواقيع Windows وNotarization على macOS وسياسة نشر/تحديث معتمدة.

## 4. الحماية والدفع

- التسعير وحساب الضريبة على الخادم فقط، وليس من المتصفح.
- Moyasar مع `MOYASAR_SECRET_KEY` سري في Cloudflare Workers؛ لا يُحفظ ضمن React أو الملفات الموزعة.
- لا يتم تسجيل أي طلب على أنه مدفوع بناء على Redirect؛ يتحقق API من فاتورة مزود الخدمة.
- خصم الاشتراكات المتكرر التلقائي غير مفعّل؛ تواريخ التجديد للتتبع، ويجب بناء منظومة تحصيل دوري مستقلة قبل عرضها كتجديد تلقائي.
- لا تُوضع بيانات دخول GitHub أو Neon أو Cloudflare في حزم التطبيقات.

## 5. ما يلزم للإطلاق

1. تحديد دومين MIF Smart وتهيئة Cloudflare Workers مع `SITE_ORIGIN`.
2. إنشاء Neon PostgreSQL وتطبيق `npm run db:migrate`.
3. إعداد المتغيرات السرية `DATABASE_URL` و`SESSION_SECRET` ومفاتيح بوابة الدفع التجريبية ثم الفعلية.
4. اختبار: أسعار كاملة، سلة وعروض أسعار، دفع ناجح/مرفوض، Duplicate callback، تحميل الموديولات بعد الدفع فقط.
5. إعداد `MODULE_FILES` كـ R2 خاص للملفات، واعتماد رخص وحقوق الموديولات ونسخة Odoo Community.
6. إصدار حزم الجوال/سطح المكتب وتوقيعها ثم اختبارها على أجهزة فعلية، ونشرها في المتاجر بحسابات المطور المطلوبة.

## ملاحظة حقوق Odoo

المنصة منتج مستقل يعتمد على Odoo Community وفق رخص الوحدات ذات الصلة؛ لا تفترض احتواءه على شيفرة Odoo Enterprise أو مطابقة كافة ميزات Enterprise من دون تدقيق تقني وقانوني لكل موديول.
