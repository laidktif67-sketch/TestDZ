# خطة التدقيق الشامل والإصلاح والإطلاق — TestDZ Rebuild V2

> هذه الوثيقة هي سجل العمل المعتمد لتذكير فريق المشروع بما يجب فحصه وتنفيذه، وبأي ترتيب. وهي **خطة وليست إعلاناً عن اكتمال التدقيق أو جاهزية الإطلاق**.

## 1. نقطة البداية والمرجع

- المستودع: `laidktif67-sketch/TestDZ`
- الفرع المعماري الرسمي: `rebuild/testdz-v2`
- commit المرجعي عند إعداد الخطة: `9a973cfb2d970f37c2bd8523584d29c9c1622ea0`
- وثائق المرجع: `docs/MASTER_BLUEPRINT.md` و`docs/ARCHITECTURE.md`
- فرع هذه الوثيقة: `docs/full-project-audit-roadmap`

يجب إعادة التحقق من HEAD قبل كل جولة تدقيق أو إصلاح. لا تُنسب نتائج commit قديم إلى commit أحدث دون إعادة الفحص.

## 2. الهدف

إثبات أن TestDZ Rebuild V2 يعمل بشكل صحيح وآمن وقابل للصيانة، وتحديد ما ينقصه قبل اتخاذ قرار الإطلاق. الأولوية لفهم الموجود وإثبات حالته، لا لإضافة ميزات أو إعادة كتابة أجزاء من المشروع بلا دليل.

## 3. قواعد العمل غير القابلة للتجاوز

1. Rebuild V2 هو المرجع المعماري الرسمي.
2. التدقيق الأولي قراءة فقط: لا تعديل كود، ولا تغييرات قاعدة بيانات، ولا نشر.
3. لا تغيير على Supabase المستضافة، ولا تطبيق migrations عليها، ولا تعديل بيانات أو سياسات حية.
4. لا نشر أو ترقية أو rollback على Vercel أثناء التدقيق.
5. لا دمج PR ولا حذف فرع ولا تغيير الفرع الرسمي دون موافقة صريحة ومحددة من مالك المشروع.
6. موافقة سابقة على PR معين لا تعتبر تفويضاً لعمليات مستقبلية.
7. لا إنشاء موارد مدفوعة أو خدمات أو اشتراكات قد تفرض رسوماً. استخدم الأدوات المحلية وGitHub Actions المجانية ضمن الحصة المتاحة فقط.
8. لا تضف ميزات جديدة قبل انتهاء التدقيق واعتماد الأولويات.
9. لا تعتبر مشكلة محلولة لمجرد تعديل الكود؛ يلزم اختبار قبول ناجح ودليل على commit المعني.
10. افصل دائماً بين: مشكلة مؤكدة، خطر يحتاج تحققاً وقت التشغيل، ونقطة لا يمكن التحقق منها بسبب غياب البيئة أو الصلاحيات.
11. لا تخلط نتائج فروع أو commits مختلفة، ولا تعتمد على نتائج CI قديمة بعد تغير HEAD.
12. لا تنفذ أي حذف أو دمج أو تغيير خارجي دون إبلاغ المالك وانتظار موافقته الصريحة.

## 4. مراحل العمل

### المرحلة 0 — تثبيت خط الأساس والجرد

- [ ] التحقق من HEAD للفرع الرسمي وتسجيل SHA والتاريخ.
- [ ] قراءة تعليمات المستودع والـBlueprint والـArchitecture والوثائق المرتبطة.
- [ ] جرد المجلدات والحزم والاعتماديات والصفحات وواجهات API وEdge Functions وSQL migrations والاختبارات وCI.
- [ ] تحديد ما هو منفذ فعلاً وما هو مخطط أو معطل أو تجريبي.
- [ ] توثيق المسارات القديمة والجديدة وعدم افتراض أن وجود الملف يعني استخدامه.

**المخرج:** خريطة مكونات المشروع وجدول نطاق التنفيذ الحالي.

### المرحلة 1 — تدقيق Architecture

- [ ] فحص حدود الوحدات وتبعياتها وتدفق البيانات.
- [ ] فحص تسجيل المسارات وحراس الدخول وتعدد الأدوار.
- [ ] فحص فصل الواجهة عن API وطبقة البيانات.
- [ ] تحديد ازدواجية التنفيذ والـlegacy fallback ومسارات V2.
- [ ] التحقق من عدم وجود واجهات أو خدمات موصوفة على أنها منفذة وهي غير موجودة.
- [ ] مراجعة قابلية البناء والصيانة والتوسع دون refactor غير ضروري.

**المخرج:** مخطط معماري واقعي وقائمة مخاطر بنيوية.

### المرحلة 2 — تدقيق Database & Security

- [ ] مراجعة جميع ملفات Rebuild V2 SQL بالترتيب.
- [ ] مراجعة grants وRLS وFORCE ROW LEVEL SECURITY لكل جدول مكشوف.
- [ ] مراجعة سياسات SELECT وINSERT وUPDATE وDELETE وحدود ملكية السجلات.
- [ ] مراجعة كل RPC: صلاحيات التنفيذ، التحقق من هوية المستخدم ودوره وملكيته، search_path، SECURITY DEFINER، والتعامل مع الأخطاء.
- [ ] مراجعة القيود والفهارس والمفاتيح الخارجية والـtriggers والـconstraints.
- [ ] مراجعة Storage buckets والسياسات ومسارات الملفات والوصول العام والخاص.
- [ ] مراجعة حماية البيانات الشخصية والمرفقات وسجلات التدقيق.
- [ ] مراجعة حدود الثقة: عدم الاعتماد على user_metadata أو مدخلات العميل لتحديد الأدوار والصلاحيات.
- [ ] مراجعة المحفظة والدفتر المالي وعمليات الحجز/الإلغاء/idempotency ومنع التكرار والتزامن.
- [ ] تشغيل اختبارات SQL والعقود على قاعدة محلية/مؤقتة مجانية فقط، إذا توفرت البيئة؛ لا تستخدم قاعدة الإنتاج.

**المخرج:** سجل أمني مدعوم بمراجع الملفات والأسطر ونتائج الاختبارات.

### المرحلة 3 — Auth & Identity

- [ ] فحص التسجيل وتأكيد البريد وتسجيل الدخول والخروج.
- [ ] فحص استعادة كلمة المرور وتغييرها وcallback وروابط إعادة التوجيه.
- [ ] فحص إدارة الجلسات وانتهاء الصلاحية وتحديث الرموز.
- [ ] فحص OAuth إن كان مفعلاً.
- [ ] فحص تعيين الأدوار وطلب الدور والموافقة عليه وتبديل مساحة العمل.
- [ ] اختبار منع تصعيد الصلاحيات والوصول إلى صفحات وأعمال دور آخر.
- [ ] فحص سلوك الحسابات متعددة الأدوار والحسابات غير المكتملة.

**المخرج:** مصفوفة سيناريوهات Auth/Identity ونتائجها.

### المرحلة 4 — تدقيق وظائف Tester

- [ ] لوحة المختبِر والملف الشخصي والإعدادات.
- [ ] اكتشاف الاختبارات ومعاينتها وشروط الأهلية.
- [ ] الانضمام والتعيينات والجلسات النشطة.
- [ ] بدء المهمة وقواعد الأيام المتتالية وCheck-in.
- [ ] إرسال الأدلة والتعليقات والملاحظات والتقييمات.
- [ ] إكمال المهمة والتحقق من قواعد 14 يوماً والاستثناءات الطبية.
- [ ] الإشعارات وسجل النشاط والدعم والخصوصية.
- [ ] المحفظة والنقاط والمكافآت والسحب: إثبات ما يعمل فعلاً وما هو معطل أو مخطط.
- [ ] اختبار منع مشاهدة أو تعديل بيانات مختبِر آخر.

**المخرج:** مصفوفة وظيفة × صفحة × API/RPC × صلاحية × اختبار قبول.

### المرحلة 5 — تدقيق وظائف Developer

- [ ] التطبيقات والملفات والصور وملكية التطبيق.
- [ ] إنشاء الاختبار وتحريره ومحتواه ومتطلباته وخطواته.
- [ ] إرسال الاختبار للمراجعة واعتماده وتغيير حالته.
- [ ] المجموعات والسعة والانضمام وتعيين المختبِرين.
- [ ] متابعة الاختبار والنتائج والملاحظات وقبولها أو رفضها.
- [ ] التحليلات ومقاييس الأداء ومنع كشف بيانات فردية غير مصرح بها.
- [ ] الإشعارات وإعدادات مساحة العمل والدعم.
- [ ] اختبار منع الوصول إلى تطبيقات واختبارات مطور آخر.

**المخرج:** مصفوفة وظائف Developer مع أدلة الصلاحيات والاختبارات.

### المرحلة 6 — Admin, Support & Trust/Safety

- [ ] طلبات الأدوار ومنحها ومراجعتها.
- [ ] طوابير الدعم والرسائل والملاحظات الداخلية والمرفقات وسجل الأحداث.
- [ ] إدارة المستخدمين والتعليق والاستئناف والإجراءات الإدارية.
- [ ] مراجعة الاحتيال والتنبيهات وحدود القرار البشري.
- [ ] مراجعة سجل التدقيق وهوية المنفذ وسبب الإجراء.
- [ ] التحقق من أن واجهة الإدارة لا تمنح صلاحيات لا يسمح بها الخادم.

**المخرج:** مصفوفة صلاحيات إدارية وسيناريوهات إساءة الاستخدام.

### المرحلة 7 — Integrations & Operations

- [ ] مطابقة متغيرات البيئة مع ما تتوقعه الواجهة والـEdge Functions.
- [ ] فحص تكامل Supabase Auth/Postgres/Storage/RPC.
- [ ] فحص Edge Functions والتحقق من الأسرار وCORS والتحقق من JWT عند الحاجة.
- [ ] فحص الإشعارات والبريد ومزودي الدفع دون إجراء معاملات حقيقية.
- [ ] التحقق من Webhooks والتوقيع وidempotency قبل اعتبار الدفع جاهزاً.
- [ ] فحص إعدادات PWA وVercel وGitHub Actions كملفات فقط أثناء التدقيق.
- [ ] تحديد ما لا يمكن إثباته دون وصول آمن إلى إعدادات البيئة الحية.

**المخرج:** خريطة تكاملات وحالة كل تكامل وحدود التحقق.

### المرحلة 8 — UI/UX & Accessibility

- [ ] مراجعة جميع المسارات والصفحات، لا الصفحة الرئيسية فقط.
- [ ] فحص العربية وRTL والنصوص الطويلة والأرقام والتواريخ.
- [ ] فحص الشاشات الصغيرة والمتوسطة والكبيرة وعدم وجود overflow أفقي.
- [ ] فحص حالات التحميل والفراغ والخطأ والنجاح والتعطيل.
- [ ] فحص لوحة المفاتيح والتركيز المرئي وتسميات عناصر التحكم وARIA.
- [ ] فحص التباين وأهداف اللمس والحركة المخفضة.
- [ ] إجراء تحقق بصري فعلي على متصفحات/أجهزة عند توفر بيئة اختبار مناسبة.
- [ ] الالتزام بتعليمات UI/UX Pro Max الموجودة في AGENTS.md عند أي عمل بصري لاحق.

**المخرج:** قائمة عيوب UI/UX مع الصفحة والجهاز وخطوات إعادة الإنتاج.

### المرحلة 9 — Performance & Reliability

- [ ] فحص الاستعلامات المتكررة والتحميل الزائد وN+1.
- [ ] مراجعة pagination والحدود والفرز والفهارس.
- [ ] فحص حجم الحزم وتحميل الصفحات والأصول.
- [ ] فحص التعامل مع انقطاع الشبكة وإعادة المحاولة والمهلات.
- [ ] فحص منع تكرار الطلبات والعمليات المتزامنة.
- [ ] فحص logging والمراقبة وعدم تسريب بيانات حساسة.
- [ ] تشغيل اختبارات الأداء والاستقرار الممكنة دون خدمات مدفوعة.

**المخرج:** تقرير أداء واستقرار مع قياسات قابلة لإعادة الاختبار.

### المرحلة 10 — تقرير التدقيق وترتيب الأولويات

لكل نتيجة سجل مستقل يحتوي على:

- ID فريد، مثل `SEC-001` أو `FUNC-001`.
- التصنيف: Critical / High / Medium / Low.
- الحالة: Confirmed / Needs runtime validation / Not verifiable.
- الملف/المكون والمسار والأسطر أو SHA ذات الصلة.
- وصف المشكلة والدليل القابل للتحقق.
- الأثر المحتمل وسيناريو إعادة الإنتاج.
- الإصلاح المقترح ومخاطره واعتمادياته.
- اختبار القبول الذي يثبت الإصلاح.
- الحالة وتاريخ آخر تحقق وcommit الذي اختبر عليه.

**المخرج:** تقرير كامل دون إصلاحات عشوائية، مع قائمة بما يمنع الإطلاق وما يمكن تأجيله.

### المرحلة 11 — الإصلاح المنضبط بعد اعتماد التقرير

لا تبدأ هذه المرحلة إلا بعد تسليم نتائج التدقيق وترتيب الأولويات. لكل إصلاح:

1. شرح المشكلة والدليل والحل المقترح.
2. تحديد الملفات والنطاق والمخاطر والاختبارات.
3. انتظار موافقة المالك عندما يتطلب الأمر تغييراً ذا أثر أو قراراً معمارياً.
4. إنشاء فرع محدود من أحدث commit رسمي.
5. تنفيذ أصغر تغيير آمن ممكن.
6. إضافة/تحديث اختبارات القبول.
7. تشغيل الاختبارات وCI وتوثيق SHA والنتائج.
8. مراجعة diff والتأكد من عدم وجود تغييرات جانبية.
9. فتح PR عند الحاجة فقط.
10. طلب موافقة صريحة منفصلة قبل الدمج.

ترتيب الإصلاح الافتراضي: Critical security/data integrity، ثم High security/integration، ثم Auth والوظائف الأساسية، ثم Admin/Support، ثم UI/UX، ثم الأداء والتحسينات.

### المرحلة 12 — Release Readiness

- [ ] جميع Critical وHigh مغلقة أو لها قرار موثق يمنع الإطلاق عند بقائها.
- [ ] اختبارات قاعدة البيانات والعقود ناجحة على نسخة نظيفة.
- [ ] اختبارات Auth والأدوار وRLS وStorage ناجحة.
- [ ] مسارات Tester وDeveloper وAdmin الأساسية مجربة بحسابات اختبار منفصلة.
- [ ] لا توجد بيانات أو مفاتيح سرية في Git أو حزمة العميل.
- [ ] التكاملات الحساسة مثل الدفع والإشعارات مثبتة باختبارات آمنة.
- [ ] فحص بصري Responsive/RTL/Accessibility موثق.
- [ ] CI ناجح على commit المرشح نفسه.
- [ ] توجد خطة نشر واسترجاع ومراقبة، ولا تنفذ إلا بعد موافقة صريحة.
- [ ] يصدر قرار واضح: جاهز، جاهز بشروط محددة، أو غير جاهز.

**لا يُعلن TestDZ جاهزاً للإطلاق أو Beta قبل وجود هذه الأدلة.**

## 5. الجرد الأولي المسجل عند إنشاء هذه الخطة

الأرقام التالية تخص commit المرجعي المذكور أعلاه، وهي جرد ملفات وليست دليلاً على اكتمال الوظائف:

| العنصر | العدد |
|---|---:|
| ملفات المستودع | 648 |
| ملفات SQL مرقمة في Rebuild V2 | 35 |
| ملفات SQL لاختبارات العقود | 24 |
| ملفات SQL في المسار القديم | 31 |
| Edge Functions | 2 |
| ملفات TSX | 80 |
| ملفات API في features | 14 |
| GitHub Workflows | 5 |
| ملفات تحت apps/mobile | 0 |

ملاحظات أولية يجب مواصلة التحقق منها:
- Rebuild V2 موجود في `supabase/rebuild-v2/` ومنفصل عن `supabase/migrations/`.
- تفعيل واجهة V2 مشروط بمتغير `VITE_TESTER_WORKFLOW_V2_ENABLED=true`، وبنشر المخطط وإتاحته في بيئة Supabase المقصودة.
- يوجد fallback انتقالي إلى المسار القديم؛ يجب إثبات تغطية كل الشاشات وواجهات API قبل أي cutover.
- تطبيق الهاتف غير موجود في نقطة البداية؛ لا توصف ميزات الهاتف بأنها منفذة.
- واجهات المحفظة والسحب تتضمن أجزاء معطلة أو مؤجلة في V2؛ يلزم تدقيق تدفقها كاملاً.
- هذه مؤشرات أولية وليست نتائج تدقيق نهائية أو ثغرات مؤكدة.

## 6. سجل التقدم

| المرحلة | الحالة | ملاحظات |
|---|---|---|
| 0 — الجرد الأولي | جزئي | تم جرد شجرة الملفات عند SHA المرجعي؛ يلزم استكمال مراجعة الوثائق والمسارات |
| 1 — Architecture | لم تكتمل | بدأت مراجعة طبقة البيانات والـfallback |
| 2 — Database & Security | لم تكتمل | تمت قراءة عينات من SQL والعقود؛ يلزم فحص جميع الملفات وتشغيل الاختبارات |
| 3 — Auth & Identity | لم تبدأ | — |
| 4 — Tester | لم تبدأ | — |
| 5 — Developer | لم تبدأ | — |
| 6 — Admin & Support | لم تبدأ | — |
| 7 — Integrations | لم تبدأ | — |
| 8 — UI/UX | لم تبدأ | — |
| 9 — Performance | لم تبدأ | — |
| 10 — تقرير التدقيق | لم يبدأ | يصدر بعد تغطية المحاور |
| 11 — الإصلاح | محظور حتى اعتماد التقرير | لا تغييرات أثناء التدقيق |
| 12 — Release readiness | لم تبدأ | لا إعلان جاهزية دون أدلة |

حدّث هذا السجل فقط بعد تنفيذ عمل فعلي موثق. لا تغيّر الحالة إلى مكتمل اعتماداً على التخمين أو على وجود ملفات فقط.


## 7. نتائج تدقيق موثقة — تحديث 2026-11-27

نطاق هذه النتائج: قراءة ملفات commit المرجعي `9a973cfb2d970f37c2bd8523584d29c9c1622ea0`. لم يتم تشغيل قاعدة محلية في هذه الجولة، ولم تُجرَ أي تغييرات على الفرع الرسمي أو Supabase المستضافة.

### نتائج أولية

#### `CI-001` — Medium — Type-check لـ Edge Functions لا يعمل عند تغيير ملفات الدوال وحدها

- **الحالة:** Confirmed (ملاحظة على إعداد CI، وليست دليلاً على خطأ داخل الدالة).
- **الدليل:** `.github/workflows/rebuild-v2-tests.yml` يحتوي على job باسم `notification-edge-function` ينفذ `deno check` على:
  - `supabase/functions/dispatch-notifications/index.ts`
  - `supabase/functions/developer-invitations/index.ts`
- **المشكلة:** قوائم `paths` في محفزات `push` و`pull_request` لهذا الـworkflow تشمل `supabase/rebuild-v2/**` و`supabase/seed.sql` و`supabase/config.toml` وملف workflow نفسه، لكنها لا تشمل `supabase/functions/**`.
- **الأثر:** إذا تغيرت Edge Function وحدها، فلن يكون هذا الـworkflow مضمون التشغيل، وبالتالي قد لا يعمل فحص Deno لهذه التغييرات عبر هذا المسار.
- **الإصلاح المقترح:** إضافة `supabase/functions/**` إلى مسارات `push` و`pull_request`، أو إنشاء workflow مستقل للدوال مع محفز مسارات صريح.
- **اختبار القبول:** تعديل تجريبي في فرع اختبار داخل `supabase/functions/**` يجب أن يطلق workflow ويشغّل خطوة Deno؛ وتغيير خارج النطاق لا يجب أن يطلقه بلا داعٍ.
- **ملاحظة:** لم يتم إجراء الإصلاح في مرحلة التدقيق.

#### `SEC-OBS-001` — لا تُصنف كاجتياز أمني حتى الآن

- **الحالة:** Needs runtime validation.
- **الدليل الثابت في المستودع:** `002_security.sql` ينشئ سياسات SELECT للأدوار والجداول الحساسة، ويمنح authenticated صلاحية SELECT على جداول مخطط V2. ويقيّد صلاحيات تعديل بعض أعمدة الملف الشخصي، كما يسحب صلاحيات تنفيذ عدة دوال خاصة من PUBLIC وanon.
- **الاختبارات المكتوبة:** `tests/security_contract.sql` يفحص 43 جدولاً عند نقطة ما بعد migration 006، ويتحقق من FORCE RLS وتغطية السياسات وحدود grants؛ و`tests/010_security_definer_boundary_contract.sql` يفحص search_path وملكية دوال SECURITY DEFINER وحدود إنشاء المخططات.
- **الحد:** لم نشغّل هذه العقود في قاعدة محلية في هذه الجولة؛ وجود الاختبار لا يثبت نجاحه على البيئة الفعلية أو الحالية.
- **الخطوة المطلوبة:** تشغيل workflow المحلي على SHA محدد، مراجعة logs لكل عقد، ثم اختبار حالات المستخدمين المتقاطعة بحسابات منفصلة.

#### `INT-OBS-001` — الوظائف الطرفية موجودة كمصدر، لكن نشرها وتشغيلها الحي غير مثبتين

- **الحالة:** Not verifiable from repository alone.
- **الدليل:** يوجد مصدر `developer-invitations` ويتحقق من JWT عبر `supabase.auth.getUser(accessToken)`، ويستخدم HMAC لتوليد رمز دعوة، ويخزن بصمة SHA-256، ويعيد حالة `not_emailed` بوضوح. ويوجد مصدر `dispatch-notifications` يتحقق من سر `x-dispatch-secret` قبل استخدام service-role client.
- **الحد:** وثائق `supabase/rebuild-v2/README.md` تنص على أن الدوال لم تُنشر ولم تُجدول في بيئة TestDZ أو FixLab المستضافة ضمن هذا المسار. لا يمكن استنتاج حالتها الحية من ملفات المصدر.
- **الخطوة المطلوبة:** مراجعة إعدادات الاستضافة والأسرار والجدولة لاحقاً، فقط بعد موافقة مستقلة؛ لا تنشر أو تضبط أسراراً أثناء التدقيق.

### ما تم فحصه في هذه الجولة

- `supabase/rebuild-v2/002_security.sql`
- `supabase/rebuild-v2/006_storage_policies.sql`
- `supabase/rebuild-v2/028_restrict_support_attachment_reads_to_public_messages.sql`
- `supabase/rebuild-v2/033_support_tester_data_boundary.sql`
- `supabase/rebuild-v2/034_tester_feedback_reply_access.sql`
- `supabase/rebuild-v2/tests/security_contract.sql`
- `supabase/rebuild-v2/tests/010_security_definer_boundary_contract.sql`
- `supabase/rebuild-v2/tests/030_apk_build_storage_contract.sql`
- `supabase/functions/developer-invitations/index.ts`
- `supabase/functions/dispatch-notifications/index.ts`
- `.github/workflows/rebuild-v2-tests.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/frontend-ci.yml`
- `apps/web/src/lib/supabase-v2.ts`
- `apps/web/src/lib/supabase-data.ts`
- `apps/web/src/features/wallet/wallet-api.ts`
- `apps/web/src/features/tester/assignments-api.ts`
- `apps/web/src/features/apps/apps-api.ts`
- `apps/web/src/features/support/support-api.ts`

### تحديث سجل التقدم

| المرحلة | الحالة | ملاحظات |
|---|---|---|
| 0 — الجرد الأولي | جزئي | إحصاء شجرة المستودع والتمييز بين SQL candidate وlegacy |
| 1 — Architecture | جزئي | تأكدنا من وجود selector مركزي بين `public` و`rebuild_v2`؛ لم تكتمل مطابقة كل routes وAPI modules |
| 2 — Database & Security | جزئي | قراءة عينة أمنية واختبارات عقود؛ يلزم تحليل جميع migrations وRPCs وتشغيل الاختبارات محلياً |
| 3 — Auth & Identity | لم تكتمل | لم تُراجع كل تدفقات Auth والـcallbacks |
| 4 — Tester | لم تكتمل | تمت قراءة عينات من assignment/support APIs فقط |
| 5 — Developer | لم تكتمل | تمت قراءة عينات من apps/tests APIs فقط |
| 6 — Admin & Support | جزئي | تمت قراءة عينات support وrole-management وسياسات المرفقات |
| 7 — Integrations | جزئي | فحص مصدري Edge Functions وCI؛ حالة الاستضافة الحية غير مثبتة |
| 8 — UI/UX | لم تبدأ | — |
| 9 — Performance | لم تبدأ | — |
| 10 — تقرير التدقيق | جارٍ | سجل النتائج الأولية أعلاه، وليس التقرير النهائي |
| 11 — الإصلاح | محظور حتى اعتماد التقرير | لا تغييرات على التطبيق أثناء التدقيق |
| 12 — Release readiness | لم تبدأ | لا إعلان جاهزية دون أدلة |


## 8. نتائج تدقيق مسارات الأدوار وواجهات Tester — 2026-11-27

نطاق هذه الجولة: ملفات الواجهة والـguards وواجهات API على commit الرسمي `9a973cfb2d970f37c2bd8523584d29c9c1622ea0`. هذه مراجعة ساكنة؛ لا تعادل اختباراً بحسابات فعلية أو تشغيل RLS.

### `FUNC-ROLE-001` — Medium — دور Financial مقبول في النظام دون مساحة عمل مقابلة في الواجهة

- **الحالة:** Confirmed as a product-scope gap; هل هو عيب إطلاق يعتمد على نطاق المنتج المعتمد.
- **الدليل:**
  - `packages/types/src/identity.ts` يعرّف `AccountRole` ويشمل `financial`.
  - `supabase/rebuild-v2/023_admin_role_grants.sql` يسمح للمشرف بمنح دور `financial`.
  - `apps/web/src/features/admin/admin-api.ts` يسمح باستدعاء `admin_grant_role` مع `financial`.
  - `apps/web/src/shared/guards/RoleGuard.tsx` يحصر `WorkspaceRole` في tester/developer/admin/support، ودالة `getHomePath` لا تحدد مساراً لدور Financial.
  - `apps/web/src/App.tsx` لا يسجل مسارات أو مساحة عمل مالية.
- **الأثر:** يمكن منح الحساب دور Financial، لكن لا توجد واجهة تشغيلية مخصصة له، ويقع المستخدم الذي يحمل هذا الدور وحده على fallback إلى `/profile`.
- **القرار المطلوب:** تأكيد هل دور Financial مطلوب في أول إصدار أم أنه دور محجوز/مؤجل. لا تُنشأ واجهة مالية أثناء التدقيق.
- **اختبار القبول إذا كان مطلوباً:** حساب Financial فقط بعد تسجيل الدخول يذهب إلى مساحة مالية مخصصة؛ لا يستطيع الوصول إلى وظائف Admin/Support/Developer؛ وتكون جميع العمليات المالية مفوضة ومتحققة في الخادم.

### `ARCH-ROLE-002` — Medium — الحماية من الوصول إلى مسارات العمل موزعة بين route guards وفحوص داخل الصفحات

- **الحالة:** Confirmed architectural observation; لا يوجد دليل على تجاوز صلاحيات الخادم.
- **الدليل:** في `apps/web/src/App.tsx`، صفحات مثل `/support/queue` و`/assignments/:id` و`/assignments/:id/progress` و`/assignments/:id/submit` تقع تحت `AuthGuard` فقط، بينما `/support/queue/:id` محمية أيضاً بـ`RoleGuard`. بعض الصفحات نفسها تتحقق من الدور بعد التحميل أو قبل عرض الواجهة؛ مثال `SupportStaffQueuePage.tsx` يتحقق من Support/Admin، وصفحات assignment تتحقق من tester.
- **الأثر:** نمط الحماية غير موحد، وقد تظهر طلبات تحميل قبل اكتمال فحص الدور في بعض الصفحات. الحماية الحقيقية للبيانات يجب أن تبقى في RLS/RPC، ولا يمكن اعتبار فحوص React حاجزاً أمنياً.
- **الخطوة المطلوبة:** إعداد مصفوفة لكل route تبين AuthGuard وRoleGuard وفحص الصفحة وRLS/RPC المقابل، ثم اختبار مستخدم غير مخول مباشرة على API. لا تغيير مسارات في مرحلة التدقيق.

### نقاط إيجابية مؤكدة من مراجعة API

- `identityApi.getUserRoles` يقرأ الأدوار من جدول `user_roles` عبر Data Client المركزي، ولا يعتمد على الدور القادم من user_metadata.
- `RoleGuard` ينتظر تحميل الأدوار ويتوقف برسالة retry عند فشل التحقق بدلاً من السماح تلقائياً.
- واجهات تفاصيل وإرسال تسليم المهمة تضيف قيد `tester_id = userId` في استعلامات assignment/check-in/feedback.
- واجهات إنشاء الاختبار وتعديله ومراجعة التطبيق/الاختبار تستخدم RPCs مخصصة؛ ورفع APK/المرفقات يسجل metadata أولاً ثم يرفع الملف ويستدعي finalize.
- واجهات الدعم تفصل مسار requester عن مسار staff، وتستبعد internal notes من مسار رسائل صاحب التذكرة في V2.

### نطاق الملفات الذي تمت مراجعته في هذه الجولة

- `apps/web/src/App.tsx`
- `apps/web/src/shared/guards/AuthGuard.tsx`
- `apps/web/src/shared/guards/RoleGuard.tsx`
- `apps/web/src/shared/auth/identity-api.ts`
- `apps/web/src/shared/auth/identity-provider.tsx`
- `apps/web/src/features/identity/identity-api.ts`
- `apps/web/src/features/profiles/profiles-api.ts`
- `apps/web/src/features/admin/admin-api.ts`
- `apps/web/src/features/apps/apps-api.ts`
- `apps/web/src/features/tester/assignments-api.ts`
- `apps/web/src/features/tester/dashboard-api.ts`
- `apps/web/src/features/tester/feedback-api.ts`
- `apps/web/src/features/wallet/wallet-api.ts`
- `apps/web/src/features/support/support-api.ts`
- صفحات assignment وSupport queue/detail ذات الصلة.
- `packages/types/src/identity.ts`
- `supabase/rebuild-v2/023_admin_role_grants.sql`

### تحديث سجل التقدم

| المرحلة | الحالة | ملاحظات |
|---|---|---|
| 0 — الجرد الأولي | جزئي | — |
| 1 — Architecture | جزئي | مراجعة App routes وAuth/Role guards وتحديد نمط الحماية الموزع |
| 2 — Database & Security | جزئي | مراجعة عينات RPC/RLS وملفات العقود؛ التشغيل المحلي لم يتم بعد |
| 3 — Auth & Identity | جزئي | مراجعة IdentityProvider وقراءة الأدوار؛ لم تختبر تدفقات Auth الحية |
| 4 — Tester | جزئي | مراجعة dashboard/assignment/submission/feedback API وعينات الصفحات |
| 5 — Developer | جزئي | مراجعة API للتطبيقات والاختبارات والرفع والمراقبة؛ لم تكتمل مطابقة الصفحات |
| 6 — Admin & Support | جزئي | مراجعة role grant وqueue/detail ودوال الدعم |
| 7 — Integrations | جزئي | لا تغيير عن التحديث السابق |
| 8 — UI/UX | لم تبدأ | — |
| 9 — Performance | لم تبدأ | — |
| 10 — تقرير التدقيق | جارٍ | سجل النتائج غير نهائي |
| 11 — الإصلاح | محظور حتى اعتماد التقرير | — |
| 12 — Release readiness | لم تبدأ | — |


## 9. متابعة Developer وAssignment routes — 2026-11-27

نطاق هذه الجولة: App.tsx وواجهات apps-api.ts وassignments-api.ts وصفحات إنشاء الاختبار/تفاصيل المهمة/التقدم/الإرسال/ملخص الإكمال، مع مطابقة عينات من SQL المرشح 007 و008 و011 و023. المراجعة ساكنة على commit الرسمي 9a973cfb2d970f37c2bd8523584d29c9c1622ea0؛ لم يتم تشغيل التطبيق أو قاعدة محلية.

### توضيح مهم لـ ARCH-ROLE-002

- مسارات /assignments/:id و/progress و/submit و/summary غير مغلفة بـ AuthGuard في App.tsx، لكن هذا لا يعني أنها متاحة فعلياً للزائر:
  - AssignmentDetailsPage.tsx وActiveAssignmentProgressPage.tsx وAssignmentSubmissionPage.tsx وTestCompletionSummaryPage.tsx تنفذ redirect إلى /auth عند غياب session.
  - صفحات التفاصيل والتقدم والإرسال تتحقق كذلك من دور tester بعد انتهاء التحميل.
  - assignments-api.ts يضيف tester_id = userId إلى استعلامات بيانات المهمة وcheck-ins وfeedback.
  - RPC start_assignment في 007_tester_workflow.sql يتحقق من auth.uid() ويقارن tester_id بالمستخدم الحالي قبل بدء المهمة.
- التقييم المحدّث: ملاحظة معمارية عن تكرار/توزيع حراسة المسارات، وليست ثغرة وصول مؤكدة. يلزم اختبار runtime للزائر، والمستخدم ذي الدور غير المناسب، ومختبر آخر يحاول فتح UUID لا يملكه، بما في ذلك قراءة البيانات والمرفقات وعمليات RPC.

### FUNC-V2-001 — Medium — ملخص إكمال المهمة لا يملك تدفق عرض خاصاً بـ V2

- الحالة: Confirmed product-flow limitation in frontend code; لا تعني فقدان بيانات أو خللاً في RPC.
- الدليل:
  - apps/web/src/modules/tester/pages/TestCompletionSummaryPage.tsx: إذا كان isTesterWorkflowV2Enabled صحيحاً، يوقف تحميل بيانات الملخص مباشرة، ثم يحوّل المستخدم إلى /wallet-rewards.
  - في وضع legacy فقط، يستدعي getLegacyTesterCompletionSummaryPageData لقراءة المهمة وcheck-ins وfeedback وledger والملف الشخصي.
  - مسار /assignments/:id/summary موجود في App.tsx، لكنه لا يعرض ملخص إكمال المهمة في V2.
- الأثر: لا يحصل مختبر V2 على صفحة ملخص مخصصة تعرض مدة المهمة وملخص الملاحظات وتفاصيل المكافآت؛ يجري تحويله إلى المحفظة بدلاً من ذلك.
- قرار المنتج المطلوب: هل ملخص الإكمال جزء من نطاق أول إصدار V2؟ إذا نعم، يجب تصميم مصدر بيانات آمن متوافق مع نموذج V2؛ وإذا لا، يجب توثيق أن الوجهة المعتمدة بعد الإكمال هي المحفظة.
- اختبار القبول إذا تقرر دعمه: حساب Tester يملك assignment مكتملة في V2 يرى ملخصاً متسقاً مع بيانات المهمة والـledger ولا يستطيع قراءة ملخص مستخدم آخر.

### مطابقة Developer API مع عينات SQL

- apps/web/src/features/apps/apps-api.ts يرسل create_test وupdate_test وsubmit_test_for_review وcreate_test_cohort وsave_test_content بمعاملات تتطابق في الأسماء والترتيب الدلالي مع wrappers/implementations المقروءة في 008_developer_lifecycle.sql و011_test_content_authoring.sql.
- save_test_content في SQL يتحقق من الدور والملكية وحالة الاختبار، ويفحص JSON array والحد الأقصى 50 خطوة/متطلباً قبل استبدال المحتوى داخل المعاملة؛ لا يظهر mismatch ساكن في أسماء المعاملات التي تمت مراجعتها.
- admin_grant_role في apps/web/src/features/admin/admin-api.ts يرسل p_user_id وp_role وp_reason، وهي مطابقة لتعريف 023_admin_role_grants.sql. الـRPC يفرض Admin server-side، يمنع self-grant ومنح Admin، ويشترط سبباً بطول 10–1000 حرف.
- هذه مطابقة ساكنة لعينة من التدفقات وليست تغطية شاملة لكل RPC أو إثباتاً لنجاح التشغيل.

### نقاط تحتاج اختبار runtime

1. مستخدم Tester يفتح assignment لا يملكه ويحاول قراءة بياناتها ومرفقاتها وتنفيذ start/check-in/submit.
2. مستخدم Developer يفتح تطبيقاً أو اختباراً يملكه مستخدم آخر ويحاول القراءة والتعديل والرفع والإرسال للمراجعة.
3. مستخدم غير Admin يستدعي admin_grant_role مباشرة، ثم Admin يحاول self-grant أو grant لدور admin.
4. إعادة المحاولة بعد فشل upload/finalize للتحقق من عدم ترك ملفات أو metadata يتيمة، وعدم إعادة استعمال ملف سبق رفعه بطريقة غير متوقعة.

### نطاق الملفات الإضافي الذي تمت مراجعته

- apps/web/src/modules/tester/pages/AssignmentDetailsPage.tsx
- apps/web/src/modules/tester/pages/ActiveAssignmentProgressPage.tsx
- apps/web/src/modules/tester/pages/AssignmentSubmissionPage.tsx
- apps/web/src/modules/tester/pages/TestCompletionSummaryPage.tsx
- apps/web/src/features/tester/assignments-api.ts
- apps/web/src/features/apps/apps-api.ts
- apps/web/src/features/admin/admin-api.ts
- supabase/rebuild-v2/007_tester_workflow.sql
- supabase/rebuild-v2/008_developer_lifecycle.sql
- supabase/rebuild-v2/011_test_content_authoring.sql
- supabase/rebuild-v2/023_admin_role_grants.sql

### تحديث سجل التقدم

| المرحلة | الحالة | ملاحظات |
|---|---|---|
| 0 — الجرد الأولي | جزئي | — |
| 1 — Architecture | جزئي | مراجعة routes وتوضيح أن صفحات assignment تحتوي فحوص session/role داخل الصفحة |
| 2 — Database & Security | جزئي | مطابقة عينات Developer/Admin RPC مع SQL؛ الاختبارات المحلية لم تُشغّل |
| 3 — Auth & Identity | جزئي | — |
| 4 — Tester | جزئي | تدقيق assignment details/progress/submission/summary وAPI؛ runtime لم يتم |
| 5 — Developer | جزئي | مطابقة عينة create/update/content/cohort مع SQL؛ بقية التدفقات قيد المراجعة |
| 6 — Admin & Support | جزئي | مطابقة admin role grant مع SQL؛ لم تُختبر بحسابات فعلية |
| 7 — Integrations | جزئي | — |
| 8 — UI/UX | لم تبدأ | — |
| 9 — Performance | لم تبدأ | — |
| 10 — تقرير التدقيق | جارٍ | النتائج أعلاه أولية وغير نهائية |
| 11 — الإصلاح | محظور حتى اعتماد التقرير | لا تغييرات تطبيقية أثناء التدقيق |
| 12 — Release readiness | لم تبدأ | — |


### متابعة مطابقة دورة التطبيق وإعداد الاختبار ذي الخطوات الست

- تمت مطابقة create_app وupdate_app وarchive_app وrestore_app وget_app_limit في apps-api.ts مع wrappers المقابلة في 003_app_lifecycle.sql؛ أسماء المعاملات وترتيبها متوافق في الاستدعاءات المقروءة.
- create_app في SQL يفرض تحققاً خادمياً من اسم التطبيق ووصفه وصيغة package name والتصنيف وحدود خطة المستخدم. update_app يقيّد التعديل بمالك التطبيق وحالتي draft/rejected، ويتحقق من icon URL إن أُرسل.
- صفحة DeveloperCreateTestSixStepPage.tsx تستدعي createDeveloperTestWithConfig، والواجهة ترسل p_test_config عبر create_test_with_config. تمت مطابقة ذلك مع 029_six_step_test_config.sql الذي يتحقق من allowlist للحقول والقيم ويشترط اتساق targetTesters مع p_min_testers وتعليمات الاختبار.
- 035_sync_six_step_config_on_test_edit.sql يعيد مزامنة حقول الهدف والتعليمات داخل test_config عند تحديث بيانات الاختبار الأساسية. لم يظهر mismatch ساكن في هذه النقطة.
- SupportStaffQueuePage.tsx يفحص أدوار Admin/Support داخل الصفحة قبل عرض الطابور، رغم أن route نفسه لا يحمل RoleGuard مستقلاً في App.tsx؛ هذا يدعم تصنيف ARCH-ROLE-002 كملاحظة توزيع حراسة لا كدليل اختراق.
- لم يتم تنفيذ اختبارات runtime أو تعديل أي كود. يجب اختبار ملكية التطبيق/الاختبار بحسابات منفصلة قبل اعتماد صلاحيات هذه التدفقات.


## 10. مراجعة تدفقات Admin/Feedback والرفع وواجهة Developer — 2026-11-27

المراجعة ساكنة على commit الرسمي 9a973cfb2d970f37c2bd8523584d29c9c1622ea0. تمت قراءة ملفات الواجهة وSQL المذكورة أدناه؛ لم يتم تشغيل متصفح أو بيئة قاعدة بيانات.

### مطابقة إضافية لـ RPCs

- طلبات الأدوار: admin-api.ts يرسل p_request_id وp_decision وp_review_note إلى admin_review_role_request، وهي مطابقة لتوقيع 022_admin_role_request_management.sql. SQL يتحقق من دور Admin، وسبب 10–1000 حرف، ويرفض مراجعة طلب المستخدم لنفسه ويقفل الطلب pending قبل تمرير القرار إلى helper.
- تغذية المطوّر الراجعة: استدعاءات get_developer_feedback وupdate_developer_feedback_review وget_developer_feedback_messages وsend_developer_feedback_message تتطابق في أسماء المعاملات مع 016_private_developer_feedback.sql. SQL يتحقق من دور Developer وملكية الاختبار المرتبط بالملاحظة، ويشترط سبباً عند الإغلاق/رفض الإصلاح، ويحد طول الرد بـ5000 حرف. واجهة المحادثة تعرض تسميات You/Tester بدلاً من اسم/معرّف المختبر، وهو متسق مع هدف تقليل كشف الهوية.
- المجموعات: update_test_cohort وtransition_test_cohort في apps-api.ts يرسلان p_cohort_id/p_name/p_capacity/p_starts_at/p_ends_at/p_reason وp_new_status/p_reason؛ وهذه مطابقة لتواقيع 012_cohort_management.sql. صفحة DeveloperTestsPage تمرر أسباباً ثابتة واضحة بطول صالح، والـSQL يعيد التحقق من ملكية المجموعة والسعة وعدد المختبرين وحالات الانتقال ويسجل audit event.
- المراجعة الإدارية للتطبيق والاختبار: review_app وreview_test ترسل p_app_id/p_test_id وp_decision وp_reason، وهي مطابقة للتواقيع في 008_developer_lifecycle.sql. الخادم يفرض دور Admin ويطلب سبباً بطول 5–2000 حرف.
- تدفق الملفات: واجهة APK تقيد الامتداد والحجم وتطلب MIME محدداً، ثم تسجل metadata، ترفع إلى bucket خاص، وتستدعي finalize. SQL 013 يتحقق من Developer وملكية اختبار APK وحالة الاختبار وحدود البيانات، ثم يتحقق من وجود Storage object ومطابقة الحجم وMIME قبل status=uploaded. تدفق assets مماثل في SQL 015 مع allowlist للامتدادات/MIME وحد أقصى 20 ملفاً و50MB للملف.
- هذه مطابقة ساكنة؛ لا تثبت سياسات Storage الحية ولا سلوك رفع الملفات عبر المتصفحات.

### `COMPAT-UPLOAD-001` — Medium (محتملة؛ تحتاج إعادة إنتاج) — رفض APK عند اختلاف MIME الذي يبلغه المتصفح

- **الملف:** `apps/web/src/features/apps/apps-api.ts`، الأسطر 289–295.
- **الدليل:** uploadDeveloperTestBuild يرفض الملف ما لم يكن امتداده .apk و`input.file.type` يساوي حرفياً `application/vnd.android.package-archive`. بخلاف ذلك لا يصل إلى RPC registration.
- **الأثر المحتمل:** بعض أنظمة التشغيل/المتصفحات أو أدوات اختيار الملفات قد ترجع MIME فارغاً أو `application/octet-stream` لملف APK صحيح، ما يؤدي إلى رفض رفع صحيح رغم تحقق الخادم لاحقاً من حجم الملف وMIME المخزن.
- **الحل المقترح بعد اعتماد التدقيق:** اختبار مصفوفة متصفحات/أنظمة تشغيل أولاً؛ إن ثبتت الحالة، لا تجعل MIME العميل وحده مانعاً نهائياً، مع الإبقاء على تحقق server-side ومطابقة metadata في finalize وعدم تخفيف قيود التخزين.
- **اختبار القبول:** APK صالح بنفس المحتوى عبر Chrome/Firefox/Safari وعلى Android/Windows/macOS؛ MIME القياسي يُقبل، والحالات غير القياسية تُعالج برسالة/تحقق آمن دون السماح بملف غير APK أو تجاوز حد 50MB.
- **الحالة:** لا إصلاح؛ لم يتم اختبار الملف فعلياً.

### ملاحظات UI/UX الأولية

- Developer Dashboard لديه media queries عند 1200/900/560px، تخطيط عمود واحد على الهاتف، وشبكة إحصاءات عمودين، ودعم reduced-motion. هذا دليل على responsive intent في هذا المكون فقط وليس على سلامة جميع الصفحات.
- معالج الاختبار ذي الخطوات الست يحتوي قواعد responsive متعددة عند 1250/900/760/600px؛ شريط الخطوات يبقى بعرض أفقي قابل للتجاوز في الهاتف، ويجب التحقق بصرياً/باستخدام لوحة المفاتيح من قابلية اكتشاف الخطوات والوصول إليها.
- Developer Feedback يتحول إلى عمود واحد عند 920px، وإلى نموذج عمودي عند 560px. مدخلات البحث والفلترة لها aria-label، وأخطاء/نجاح العمليات تستخدم role=alert/status.
- صفحات Admin role grants/requests تحتوي labels ورسائل status/alert، لكن CSS المحلي لـ AdminRoleGrantsPage لا يعرّف focus-visible صراحة. لا أعد ذلك عيباً مؤكداً قبل فحص CSS العام وقياس التباين/التنقل الفعلي بلوحة المفاتيح.
- لم تُجرَ اختبارات مرئية على أجهزة فعلية، ولا اختبارات WCAG/axe؛ لذلك تبقى Phase 8 جزئية ولم تبدأ كاختبار شامل.

### تحديث سجل التقدم

| المرحلة | الحالة | ملاحظات |
|---|---|---|
| 0 — الجرد الأولي | جزئي | — |
| 1 — Architecture | جزئي | — |
| 2 — Database & Security | جزئي | مطابقة إضافية RPCs admin/feedback/cohort/storage؛ runtime غير منفذ |
| 3 — Auth & Identity | جزئي | — |
| 4 — Tester | جزئي | — |
| 5 — Developer | جزئي | مطابقة إضافية للرفع والمجموعات والتغذية الراجعة؛ اختبار متصفحات غير منفذ |
| 6 — Admin & Support | جزئي | مطابقة طلبات الأدوار والمراجعات؛ لم تُختبر بحسابات فعلية |
| 7 — Integrations | جزئي | — |
| 8 — UI/UX | جزئي — static only | مراجعة عينات responsive وARIA؛ لا browser/device/automated accessibility QA |
| 9 — Performance | لم تبدأ | — |
| 10 — تقرير التدقيق | جارٍ | سجل مخاطر أولي؛ ليس تقرير اعتماد نهائي |
| 11 — الإصلاح | محظور حتى اعتماد التقرير | لا تغييرات تطبيقية أثناء التدقيق |
| 12 — Release readiness | لم تبدأ | — |
