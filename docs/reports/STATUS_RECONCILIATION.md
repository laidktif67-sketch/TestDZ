# TestDZ — Status Reconciliation / مطابقة التقارير مع الكود

> **حدود الدليل:** هذه مطابقة مصدرية عبر GitHub، وليست جلسة طرفية محلية أو اختبار اختراق. لم تُعدّل ملفات التطبيق أو قاعدة البيانات. الحالات أدناه محافظة: لا تعني إضافة كود أو نجاح CI أن الخطر مغلق ما لم يوجد اختبار يغطيه ويُشغّل على الرأس الحالي.

## 1. رأس التدقيق ومراجع التقارير

- **فرع التدقيق:** `feat/developer-create-test-six-step`
- **HEAD/SHA المتحقق:** `cfd8a44867cdb30b481e7fa1206282b69ddb45ca` — commit: [fix(developer): remove unused notice state](https://github.com/laidktif67-sketch/TestDZ/commit/cfd8a44867cdb30b481e7fa1206282b69ddb45ca)
- **المستودع:** `laidktif67-sketch/TestDZ`
- **AUDIT_REPORT.md:** رأس التقرير `17430f77a2c3e117d832fa5db6a06876e55124bc`، الفرع `feature/developer-my-tests-dashboard`.
- **SECURITY_REPORT.md:** رأس المراجعة `49e89fa664c5190eeddd41ce6e9e47b584f88d3a`، الفرع `feature/developer-my-tests-dashboard`.
- **UX_REPORT.md:** commit المراجعة `e4cd4456f3eaf3bf91a449322cb664c286ca3b28`، الفرع `feature/developer-my-tests-dashboard`.
- **LAUNCH_PLAN.md:** النطاق المرجعي `feature/developer-my-tests-dashboard`، بعد التقرير `9a843ce539e123718417a2b5100eb9787b17ed93`.
- **DESIGN_AUDIT.md:** لم يوجد بهذا المسار في الفرع الذي فُحص؛ لا يمكن نسبة SHA أو بنود فجوات إليه حتى يُحدد مساره/فرعه.
- **docs/BACKEND_PROGRESS.md**, **docs/CONTRACTS.md**, **docs/FRONTEND_PROGRESS.md**, **docs/I18N_STATUS.md**: لم توجد بهذه المسارات في الفرع الذي فُحص. لا أفترض أنها غير موجودة في فروع أخرى.
- **سجل التغييرات:** مقارنة GitHub من رأس AUDIT إلى الرأس الحالي أعادت 651 commit للأمام؛ هذا نطاق كبير، ولا يصح اختزاله إلى قائمة قصيرة دون استخراج قائمة commits كاملة ومقارنة كل PR. من التغييرات المؤكدة في الحالة الحالية: بنية monorepo `apps/web/` و`packages/*`، طبقات API حسب المجال، مسارات/وحدات جديدة، ومعالج إنشاء اختبار من ست خطوات في PR #33. لا أزعم أن PR #33 مدموج؛ الفرع الحالي هو فرع PR/feature.
- **ملاحظة مهمة:** `README.md` في `main` ما زال يصف الواجهة بأنها غير scaffolded ويذكر 8 migrations/28 جدولاً؛ بينما `docs/ARCHITECTURE.md` في الفرع الحالي يصف تطبيق `apps/web/` وmonorepo. هذا اختلاف بين فروع/نسخ، لا يجوز وصفه تلقائياً بأنه تناقض داخل الرأس نفسه.

## 2. ملخص التحقق والتنفيذ

| الفحص | النتيجة | الدليل/القيد |
|---|---|---|
| قراءة التقارير ومقارنة رؤوسها | تم جزئياً | قرئت التقارير المتاحة عبر GitHub؛ بعض الوثائق المطلوبة غير موجودة في هذا الفرع. |
| قراءة HEAD الحالي | تم | SHA أعلاه؛ `fetch_commit` على اسم الفرع أعاد هذا الرأس. |
| Typecheck محلي | **لم يُشغّل** | لا تتوفر جلسة shell/repository محلية في بيئة التدقيق الحالية. |
| Build محلي | **لم يُشغّل** | السبب نفسه. |
| Lint محلي | **لم يُشغّل** | لم أجد أساساً موثوقاً لتأكيد script/نتيجة على الرأس الحالي. |
| Unit/integration tests محلياً | **لم تُشغّل** | لا أعتبر CI قديم دليلاً على HEAD الحالي. |
| `supabase start` / replay migrations / SQL tests | **لم تُشغّل** | لا توجد بيئة CLI في هذه الجلسة. |
| `npm audit` | **لم يُشغّل** | لا يمكن تأكيد ثغرات الاعتماديات أو خلوها. |
| اختبار Supabase البعيد / Auth / Storage / Vercel headers | **غير متحقق** | يحتاج بيئة بعيدة وصلاحية اختبار آمنة. |
| قاعدة البيانات البعيدة | **لم تُعدّل** | لم تُنفذ أي أوامر كتابة أو migrations. |

## 3. مطابقة AUDIT_REPORT.md — H1، M1–M8، L1–L2

**قاعدة التصنيف:** «جزئي» أو «مفتوح» تعني أن الدليل الحالي لا يكفي لإغلاق البند. لا توجد هنا حالة «أُصلح» دون اختبار/دليل محدد على الرأس الحالي.

| المرجع | الحالة | الدليل الحالي | ملاحظات |
|---|---|---|---|
| H1 — قراءة اسم/صورة المختبِر للمطور عبر RLS | **غير مؤكد** | التقرير الأمني القديم يصف مشكلة قراءة `profiles`؛ توجد الآن طبقة `apps/web/src/features/developer/developer-testers-api.ts`، لكن لم يُثبت من هذا الفحص أنها RPC محدودة الحقول وأن اختبار RLS يغطي owner/developer/outsider. | لا نغلقها لمجرد وجود API جديد؛ يلزم migration/RPC وسياسة واختبار سلبي وإيجابي. |
| M1 — تكرار Feedback بالتزامن | **غير مؤكد** | `apps/web/src/features/feedback/feedback-api.ts` موجود في الرأس الحالي. | وجود API لا يثبت قيد UNIQUE أو idempotency؛ افحص migration واختبار التزامن. |
| M2 — مقياس Attendance لا يعكس الحضور اليومي | **غير مؤكد** | `apps/web/src/features/analytics/app-metrics-api.ts` وواجهات Developer موجودة في بنية المشروع. | يلزم تتبع query إلى مصدر check-ins واختبار بيانات مرجعية. |
| M3 — Active Testers يعرض الإجمالي | **غير مؤكد** | توجد `developer-testers-api.ts` وواجهات Developer. | لم يُثبت تعريف active ولا اختبار حالات status. |
| M4 — ملفات Storage يتيمة عند فشل metadata | **جزئي** | `SECURITY_REPORT.md` يطلب orphan cleanup/retention؛ لا يوجد في الأدلة التي فُحصت إثبات job تنظيف مجدول واختبار فشل upload/metadata. | يلزم اختبار تعطل بين رفع الملف وحفظ metadata، ثم إثبات cleanup. |
| M5 — حدود استعلام ثابتة دون pagination | **غير مؤكد** | طبقات API متعددة أُضيفت؛ لم يُثبت pagination موحد أو اختبار استكمال النتائج. | افحص كل list query؛ limit وحده ليس pagination. |
| M6 — مرفقات Feedback غير مكتملة | **تغيّر / غير مؤكد الإغلاق** | تقرير PR #30 يصف `assignment_submissions` وbucket خاصاً وRPC لرفع التقرير؛ لكن لم يُثبت هنا أن هذه التغييرات مدموجة في HEAD الحالي وأن UI يعالج الرفع والأخطاء فعلياً. | لا تخلط مرفقات assignment submission مع مرفقات feedback القديمة أو support. |
| M7 — اختبارات الواجهة/الـ CI ضعيفة | **جزئي** | توجد scripts جذرية `typecheck` و`build` و`check:routes` و`audit:identity-guards`. | وجود scripts لا يثبت تشغيلها على HEAD؛ يلزم نتائج CI الحالية وتغطية سلوكية فعلية. |
| M8 — العربية غير مكتملة خارج Landing | **مفتوح مبدئياً** | تقرير UX يذكر نصوصاً ثابتة؛ لم يوجد `docs/I18N_STATUS.md` في هذا الفرع. | يلزم inventory فعلي لكل صفحات MVP واختبار EN/FR/AR وRTL. |
| L1 — README قديم | **تغيّر بين الفروع / مفتوح على main** | README على `main` يقول «Frontend: not scaffolded yet» و«8 migrations»؛ Architecture في فرع التدقيق يذكر `apps/web/` وmonorepo. | تحديث README في فرع العمل غير مثبت. لا تغيّر main تلقائياً. |
| L2 — صيانة الصفحات/التكرار | **غير مؤكد** | توجد طبقات feature-based وAPI مفصولة؛ لا توجد نتيجة تحليل تعقيد/تكرار أو lint حالية. | refactor معماري لا يثبت انخفاض التعقيد أو غياب regressions. |

## 4. المطابقة الأمنية — النتائج الرئيسية

| المرجع في SECURITY_REPORT.md | الحالة | الدليل المطلوب/المتوفر | ملاحظة التدقيق |
|---|---|---|---|
| H1 — ملف المختبِر العام للمطور | **غير مؤكد** | API مطور جديدة موجودة؛ لا إثبات هنا لRPC محدودة الحقول واختبار RLS. | تبقى بوابة أمنية. |
| تزوير تواريخ check-ins / تجاوز 14 يوماً | **جزئي / غير مؤكد الإغلاق** | PR #29 يصف `submit_assignment_checkin` الذي يشتق التاريخ من ساعة قاعدة البيانات ويمنع التكرار ويحد المكافآت؛ لا أؤكد دمجه أو تشغيل SQL regression على HEAD. | يلزم تأكيد migration في الرأس واختبارات grants وbackdating/future dating والـ duplicate. |
| `is_banned` لا يوقف العمليات | **غير مؤكد** | PR #30 يذكر تطبيق restrictive banned-account RLS على جداول submissions الجديدة؛ لا يكفي لإثبات تغطية جميع RPCs والجداول والجلسات القائمة. | يلزم اختبار حساب محظور مع جلسة موجودة لكل مسارات الكتابة. |
| أعمدة الاستثناء الطبي غير متطابقة | **غير مؤكد** | `docs/MASTER_BLUEPRINT.md` يصف `review_medical_exception` وجدول `medical_exception_requests` كمسار معتمد. | الوثيقة ليست دليلاً على توافق SQL الحالي؛ يلزم اختبار migration/RPC فعلي. |
| workflow تطبيق migrations يستهدف مشروعاً قديماً | **غير مؤكد** | يوجد `supabase/config.toml` بمشروع ref `naqjjykcglxiobkmdllj`؛ لم يُفحص كل workflow أو تشغيله. | يجب تدقيق guard في workflow وسرّ البيئة قبل أي dispatch. |
| بلاغ ضد مستخدم غير مرتبط بالمهمة | **غير مؤكد** | لا دليل اختبار حالي على الربط بين `reported_user_id` والـ assignment/نوع البلاغ. | يحتاج SQL regression سلبي. |
| تجاوز admin لـ RPC/سجل التدقيق | **غير مؤكد** | Architecture يذكر عملية `suspend_user` مضبوطة وسجل تدقيق؛ لا يكفي لإثبات أن كل مسارات admin تمر عبرها. | مراجعة grants وSECURITY DEFINER والـ audit atomicity مطلوبة. |
| ملفات Storage يتيمة/لا حصص/لا فحص محتوى | **مفتوح** | لا دليل على orphan cleanup أو quotas أو malware/content validation تعمل. | بوابة قبل استقبال ملفات حقيقية. |
| التصدير والحذف والاحتفاظ غير مكتملة | **مفتوح** | Architecture/Blueprint يصفان المبادئ؛ لم يُثبت مسار تنفيذ كامل واختبار حذف/تصدير. | يلزم قرار سياسة ثم اختبار end-to-end. |
| حدود إساءة الاستخدام للرسائل/الطلبات | **مفتوح** | لا دليل محدد على rate limits/quotas الفعلية. | لا تُغلق بالتوثيق فقط. |
| مسودات محلية بعد تسجيل الخروج | **غير مؤكد** | لم يُشغّل اختبار تبديل الحساب على الجهاز نفسه. | يلزم فحص localStorage/IndexedDB/cache ومسحها عند logout/account switch. |
| روابط وصور خارجية بلا allowlist | **غير مؤكد** | لم يُثبت allowlist موحداً ومختبراً. | افحص URL sinks وCSP وremote image sources. |

## 5. بوابات SECURITY_REPORT.md — القسم 15 (كل البوابات الست عشرة)

| # | بوابة الإطلاق | الحالة | دليل الإغلاق المطلوب |
|---:|---|---|---|
| 1 | إغلاق H1 بـ RPC محدودة الحقول مع بقاء profiles self/admin فقط | **غير متحققة/غير مثبتة** | migration + RPC grants + RLS tests owner/developer/outsider. |
| 2 | إزالة INSERT المباشر لـ checkins وإضافة RPC تمنع back/future dating وتزوير created_at | **غير متحققة/غير مثبتة** | SQL regression على grants والتواريخ والتكرار ووقت قاعدة البيانات. |
| 3 | فرض is_banned في Auth/RLS/RPC واختبار جلسة قائمة | **غير متحققة/غير مثبتة** | اختبار حساب محظور على كل write paths مع session قديمة. |
| 4 | إصلاح requested_days/requested_dates واختبارات الاستثناء الطبي | **غير متحققة/غير مثبتة** | تشغيل RPC/migration tests لكل pending/approved/rejected والتواريخ المتداخلة. |
| 5 | منع UPDATE المباشر على medical_exception_requests وحصر القرار في RPC مدققة | **غير متحققة/غير مثبتة** | grants/policies + اختبار أن العميل لا يستطيع تغيير القرار. |
| 6 | ربط reported_user_id بالـ assignment/نوع البلاغ | **غير متحققة/غير مثبتة** | قيود/RPC واختبارات بلاغات غير مرتبطة. |
| 7 | تصحيح workflow apply-migration.yml ومنع استهداف المشروع القديم | **لا يمكن التحقق دون فحص وتشغيل workflow المستهدف** | مراجعة الملف الحالي وproject-ref guard؛ لا dispatch قبلها. |
| 8 | منع دفع migrations staging-only دون موافقة صريحة | **لا يمكن التحقق دون مراجعة workflows وإعدادات البيئة** | تحقق من triggers/environment approvals/secrets والـ guard. |
| 9 | اختبارات RLS سلبية وإيجابية لجميع الجداول | **غير متحققة/غير مثبتة** | inventory للجداول مقابل تغطية اختبارات؛ نجاح اختبارات support/feedback وحدها لا يكفي. |
| 10 | quotas/rate limits للرسائل والملفات والتذاكر | **غير متحققة** | حدود server-side واختبارات تجاوز المعدل والحجم. |
| 11 | orphan cleanup وretention وفحص الملفات | **غير متحققة** | job/retention policy/content validation واختبار cleanup. |
| 12 | سياسة تصدير/حذف/احتفاظ تشمل medical/support/attachments | **غير متحققة** | سياسة معتمدة ومسارات تنفيذ واختبارات لكل فئة. |
| 13 | Auth remote settings/redirect allowlist/rate limits | **لا يمكن التحقق دون البيئة البعيدة** | مراجعة إعدادات Supabase Auth الفعلية، لا `config.toml` المحلي فقط. |
| 14 | CSP/security headers على Vercel production وpreview | **لا يمكن التحقق دون البيئة البعيدة** | فحص response headers للروابط الحية لكل بيئة. |
| 15 | npm audit + lint وتصنيف الثغرات | **غير متحقق** | تشغيل على lockfile والرأس الحالي، وتوثيق المخرجات والإجراء لكل finding. |
| 16 | تبديل المستخدم على جهاز واحد دون تسرب cache/local drafts | **غير متحققة** | E2E يبدّل بين حسابين ويتحقق من cache/storage وبيانات الشاشة. |
| 17 | رأي قانوني موثق بشأن نقل البيانات والبيانات الطبية والاحتفاظ | **غير متحقق** | مراجعة قانونية مكتوبة قبل إدخال مختبرين حقيقيين. |

> ملاحظة: القائمة في القسم 15 تحتوي **17 checkbox** في النص المتاح، لا 16. أدرجتها جميعاً حتى لا يسقط شرط بسبب العدد المذكور في طلب التدقيق.

## 6. مطابقة UX_REPORT.md — UX-BLOCK وFE-01 إلى FE-20

### 6.1 العوائق المانعة للإطلاق

| المرجع | الحالة | الدليل/ما يلزم |
|---|---|---|
| UX-BLOCK-01 — Check-in لا ينفذ من مسار التقدم | **غير مؤكد** | طبقة `apps/web/src/features/testers/checkins-api.ts` موجودة، لكن يلزم إثبات أن زر صفحة التقدم يستدعي RPC server-authoritative وأن نجاح UI ينتظر رد الخادم. |
| UX-BLOCK-02 — التطبيق الداخلي غير مترجم بالكامل | **مفتوح مبدئياً** | لا يوجد `docs/I18N_STATUS.md` في هذا الفرع؛ لا توجد نتيجة inventory شاملة أو اختبار ثلاث لغات. |
| UX-BLOCK-03 — اللغة لا تتحكم بكل الصفحات | **غير مؤكد** | لم يُثبت Provider واحد وتغطية route-wide؛ يلزم اختبار التنقل وإعادة التحميل وحساب/زائر. |
| UX-BLOCK-04 — الاستثناء الطبي لا يقود إلى طلب واضح ولا يشرح الخصوصية | **غير مؤكد** | Blueprint يصف backend workflow، لكن هذا لا يثبت ربط UI بنموذج خاص ولا شرح pending/approved/rejected. |
| UX-BLOCK-05 — الشروط والخصوصية مسودة | **مفتوح حتى إثبات النسخ المعتمدة** | يلزم مراجعة النصوص المنشورة، version/date والموافقة المسجلة؛ لم تُجرَ مراجعة قانونية. |

### 6.2 مهام FE

| ID | الحالة | معيار الإغلاق / الملاحظة |
|---|---|---|
| FE-01 Check-in حقيقي | **غير مؤكد** | اختبار RPC، duplicate/denied/network، تحديث بعد تأكيد الخادم. |
| FE-02 Provider لغة موحد | **غير مؤكد** | إثبات مصدر locale واحد مع html lang/dir والحفظ بين routes/reload. |
| FE-03 ترجمة shell/navigation | **مفتوح مبدئياً** | اختبار EN/FR/AR لكل labels. |
| FE-04 ترجمة صفحات Tester | **مفتوح مبدئياً** | تغطية كل النصوص وحالات loading/empty/error/validation. |
| FE-05 ترجمة صفحات Developer | **مفتوح مبدئياً** | تغطية كل النصوص وحالاتها في اللغات الثلاث. |
| FE-06 شروط/خصوصية ثلاثية اللغة ومعتمدة | **مفتوح** | نسخ متكافئة مع version/date ومراجعة قانونية. |
| FE-07 وضوح Draft مقابل Published | **جزئي/غير مؤكد** | PR #33 يصف wizard من ست خطوات وحفظ draft؛ يلزم تحقق UI من عدم الإيحاء بالنشر واختبار persist/reload. |
| FE-08 توضيح أن النقاط غير نقدية | **غير مؤكد** | يلزم فحص Wallet/Progress/Completion ورسائل المكافأة جميعها. |
| FE-09 تدفق الاستثناء الطبي | **غير مؤكد** | نموذج خاص، شرح الخصوصية، وحالات pending/approved/rejected والتمديد. |
| FE-10 إزالة المرفقات غير العاملة من Feedback | **غير مؤكد** | يلزم فحص الصفحة الفعلية وتدفق upload، لا الاعتماد على وصف PR. |
| FE-11 fallback آمن لأسماء المختبرين | **غير مؤكد** | يلزم إثبات عدم query مباشر غير مصرح واختبار الوصول. |
| FE-12 تصحيح Attendance/Active/Completion metrics | **غير مؤكد** | تعريفات ومصدر بيانات واختبارات حسابية ببيانات معلومة. |
| FE-13 حالات Loading/Empty/Error/Offline/Forbidden موحدة | **غير مؤكد** | لا يوجد فحص بصري/سلوكي شامل. |
| FE-14 توحيد مصطلحات المجال | **غير مؤكد** | يلزم قاموس مصطلحات ومراجعة النصوص في صفحات MVP. |
| FE-15 RTL logical properties | **غير مؤكد** | يلزم بحث CSS شامل واختبار AR على 360/390px. |
| FE-16 تنقل الهاتف | **غير مؤكد** | لم تُلتقط screenshots ولم يُنفذ اختبار لمس/keyboard. |
| FE-17 تحديث PWA الآمن للنماذج | **غير مؤكد** | يلزم اختبار update أثناء dirty form، مع prompt/تأجيل reload. |
| FE-18 الخطوط والأداء | **غير متحقق** | لم تُقَس LCP/CLS على جهاز Android وشبكة بطيئة. |
| FE-19 إمكانية الوصول | **غير متحقق** | لا نتائج keyboard/screen reader/contrast/focus. |
| FE-20 الحظر وانتهاء الجلسة | **غير مؤكد** | يلزم اختبار جلسة قائمة وحساب محظور ورسائل مترجمة لكل دور. |

### 6.3 UX-HIGH / UX-MED / UX-LOW إضافية

| المرجع | الحالة | ملاحظة |
|---|---|---|
| UX-HIGH-01 Draft قد يفهم كنشر | **جزئي/غير مؤكد** | PR #33 يصرح أن draft لا ينشر ولا يجند تلقائياً؛ يلزم تحقق الواجهة والـ DB. |
| UX-HIGH-02 أسماء المختبرين تعتمد على H1 | **غير مؤكد** | مرتبط بإغلاق H1 واختبار RLS. |
| UX-HIGH-03 توضيح أن النقاط غير نقدية | **غير مؤكد** | يحتاج فحص كل مواضع عرض الرصيد والمكافأة. |
| UX-HIGH-04 أثر pending/approved/rejected للاستثناء الطبي | **غير مؤكد** | يلزم اختبار UI/backend. |
| UX-HIGH-05 مرفقات Feedback غير متاحة | **غير مؤكد** | وجود مسار submission منفصل لا يثبت إكمال كل الواجهة. |
| UX-HIGH-06 تعريف المؤشرات | **غير مؤكد** | يحتاج tests لمصدر الحساب. |
| UX-HIGH-07 الحظر/انتهاء الجلسة | **غير مؤكد** | يلزم E2E لكل دور. |
| UX-MED-01 تعدد مصادر اللغة | **غير مؤكد** | يلزم تتبع localStorage/profile/user_metadata واختبار conflict. |
| UX-MED-02 تنقل الهاتف | **غير متحقق** | لا browser run أو screenshots. |
| UX-MED-03 تحديث PWA أثناء النموذج | **غير متحقق** | لا اختبار. |
| UX-MED-04 Google Fonts والأداء | **غير متحقق** | لا قياسات. |
| UX-MED-05 اتساق Empty/Error/Loading | **غير متحقق** | لا inventory كامل. |
| UX-MED-06 حفظ Draft محلياً | **غير مؤكد** | يلزم توضيح UI ومسح بيانات الحساب عند logout. |
| UX-MED-07 pagination/عرض النتائج | **غير مؤكد** | يلزم فحص list endpoints والـ UI. |
| UX-LOW-01 تسمية النقاط والمحفظة | **غير مؤكد** | يلزم مراجعة نصوص موحدة. |
| UX-LOW-02 الصور والرسومات | **غير متحقق** | لم يُجر فحص بصري أو أحجام assets. |

## 7. DESIGN_AUDIT.md وفجوات التصميم

**الحالة: غير قابل للمطابقة حالياً.** لم يوجد `DESIGN_AUDIT.md` في الفرع الذي فُحص. لن أختلق قائمة فجوات أو IDs غير متاحة. المطلوب لاستكمال هذا القسم: تزويدي بمسار/فرع الوثيقة أو استرجاعها إلى الفرع دون تغيير أي ملف آخر. بعد توفرها، يجب إضافة صف لكل finding فيها، مع الحالة والدليل على الكود الحالي.

## 8. بنود جديدة أو تغيّرات تستوجب تدقيقاً مستقلاً

هذه ليست ادعاءات بأن البنود معطوبة؛ إنها مساحات تغيرت أو أصبحت مهمة في بنية الكود الحالية مقارنة بوصف التقارير القديمة:

| المجال/التغيير | سبب إعادة التدقيق | المطلوب |
|---|---|---|
| npm workspaces و`apps/web/` و`packages/*` | اختلاف جذري عن وصف README القديم ووجود حدود package جديدة | تحقق workspace scripts، lockfile، build context في Vercel، ومنع imports عبر الحدود غير المقصودة. |
| طبقات API حسب المجال في `apps/web/src/features/*/*-api.ts` | نقاط وصول جديدة إلى البيانات والصلاحيات | تتبع كل استدعاء إلى grants/RLS/RPC؛ تأكد من عدم وجود مسار كتابة مباشر يتجاوز RPC. |
| identity-provider / identity-api / auth-routing | تغييرات حساسة في الهوية والحراس | إعادة اختبار role switching، stale session، ban enforcement، route guards، وتبديل الحساب. |
| `apps/web/src/features/testers/checkins-api.ts` وcompletion/reward APIs | مسارات check-in والمكافآت حساسة للوقت والرصيد | اختبارات SQL تزامن/تكرار/تاريخ/ledger، ومطابقة UI مع استجابة الخادم. |
| `apps/web/src/features/feedback/feedback-api.ts` | مسار Feedback/attachments تغير | تمييز feedback عن assignment submissions وعن support attachments؛ اختبار authorization وorphan cleanup. |
| `apps/web/src/features/testers/privacy-data-api.ts` | ظهور واجهة/طبقة بيانات خصوصية | لا تعتبرها تنفيذاً لحق التصدير والحذف حتى تثبت اكتمال جميع الجداول والملفات وE2E. |
| PR #33: Create Test من 8 إلى 6 خطوات | تغيير في العقد وتجربة الإنشاء وحقول `test_type`/`test_config` وحالة draft | تحقق من migration على قاعدة فارغة وترقية قاعدة قديمة، validation server-side، RLS، حفظ/استئناف draft، ورفض الحقول غير المسموحة. |
| migration تسمح بـ `draft` كحالة قبل التجنيد (موصوفة في PR #33) | تغيير في state machine | تأكد من أن كل RPC/trigger والتقارير والتحليلات تقبل draft فقط في موضعه ولا تعامل draft كمنشور/نشط. |
| مسارات/وحدات Admin وDeveloper وTester توسعت | مخاطر route/role leakage وتضخم mock data | route inventory + role matrix tests لكل route وAPI، والتأكد من أن أي mock/demo واضح ومعزول. |
| تغيّر migrations/CI/workflows عبر الفروع | قد تكون حالة remote schema مختلفة عن repo | لا تطبق migrations عن بعد قبل baseline/history check وموافقة صريحة؛ أجرِ schema diff. |

## 9. تعارضات التوثيق المعروفة

| الوثيقة | التعارض/الفجوة | الحالة |
|---|---|---|
| `README.md` على `main` | يذكر «Frontend: not scaffolded yet» و8 migrations/28 جدولاً، بينما `docs/ARCHITECTURE.md` على فرع التدقيق يذكر تطبيق `apps/web/` وmonorepo. | **تعارض بين الفروع/النسخ؛ README في فرع العمل يحتاج مراجعة**. لا يُستنتج أن README على فرع العمل مطابق لـ main. |
| `docs/ARCHITECTURE.md` | يذكر `apps/mobile/` وshared packages كخطة وغير موجودة حالياً؛ الجذر يحتوي `packages/*` workspace لكن لا يثبت أن كل الحزم موجودة. | **يحتاج تحققاً من الشجرة الحالية**؛ لا تُعلن تطبيق الهاتف منفذاً. |
| `docs/MASTER_BLUEPRINT.md` | يصف بعض التدفقات بأنها implemented/approved، لكن ذلك لا يثبت أن migrations الحالية متوافقة أو أن E2E مرّ. | **وثيقة مرجعية وليست دليل تشغيل**. طابق كل RPC وschema وtest قبل إطلاق الادعاء. |
| `AUDIT_REPORT.md` / `SECURITY_REPORT.md` / `UX_REPORT.md` | رؤوس commits مختلفة وتاريخ 13 نوفمبر؛ التغييرات بعد تلك الرؤوس كبيرة (مقارنة GitHub أظهرت 651 commit من رأس AUDIT إلى HEAD). | **التقارير تاريخية؛ يلزم إعادة تدقيق البنود لا نسخ نتائجها كحالة راهنة**. |
| `DESIGN_AUDIT.md` | غير موجود بالمسار المتوقع في الفرع المفحوص. | **لا يمكن تحديد فجواته حتى تحديد مصدره**. |
| `docs/BACKEND_PROGRESS.md`, `docs/CONTRACTS.md`, `docs/FRONTEND_PROGRESS.md`, `docs/I18N_STATUS.md` | لم توجد بالمسارات المحددة في الفرع الحالي. | **غير مؤكد أنها مفقودة من المستودع كله؛ قد تكون في فرع/مسار آخر**. |

## 10. بوابات الإطلاق حسب LAUNCH_PLAN

| البوابة | الحالة الحالية | شرط اجتيازها |
|---|---|---|
| الأمان وسلامة البيانات | **غير متحققة** | إغلاق جميع بوابات SECURITY_REPORT واختبارات RLS/RPC/Storage على الرأس النهائي. |
| رحلة Tester من التسجيل إلى assignment مكتمل | **غير متحققة** | E2E حقيقي يشمل check-in 14 يوماً/حالات الانقطاع/feedback/reward، دون احتساب نقاط مزدوجة. |
| رحلة Developer وإنشاء/نشر اختبار | **جزئي** | wizard ست خطوات موصوف في PR #33؛ يلزم تحقق create draft وvalidation وpublish transition الفعلية. |
| لوحة الإدارة ومراجعة الاستثناءات/الدعم | **غير متحققة** | أدوار حقيقية، قرارات server-side، audit trail واختبارات negative permissions. |
| اللغات EN/FR/AR في كل صفحات المنتج | **غير متحققة** | inventory لكل routes + اختبار RTL وempty/error/validation. |
| قانونية/خصوصية البيانات في الجزائر | **لا يمكن التحقق دون رأي قانوني موثق** | مراجعة قانونية قبل استخدام بيانات حقيقية، خاصة الطبية والدعم والمرفقات والاحتفاظ/النقل. |
| التشغيل والبريد وAuth | **لا يمكن التحقق دون البيئة البعيدة** | SMTP/redirect allowlist/rate limits وتجربة استعادة الحساب الفعلية. |
| Vercel/PWA والأمان على الشبكة | **لا يمكن التحقق دون preview/production** | headers/CSP، update behavior، mobile screenshots، smoke tests. |
| الاعتماديات والاختبارات | **غير متحققة في هذا التدقيق** | typecheck/build/lint/tests/npm audit على HEAD الحالي مع نتائج محفوظة. |
| مدفوعات/سحب | **مؤجلة حسب MVP** | يجب أن تبقى معطلة؛ لا تعتبر بوابة فشل إذا بقيت خارج النطاق ولم تظهر وعود للمستخدم. |

## 11. ما يجب إعادة تدقيقه بالكامل

1. **Security review جديد:** بسبب تغييرات الهوية وAPI حسب المجال وcheck-in/reward/submission وmigrations؛ إعادة بناء خريطة grants/RLS/RPC/SECURITY DEFINER من الصفر.
2. **State machine للاختبار والـ assignment:** خصوصاً `draft`، انتقالات النشر/التجنيد، check-ins، الإكمال، الاستثناءات الطبية والمكافآت.
3. **الـ ledger والمكافآت:** idempotency، القيود الفريدة، row locks، تزامن الطلبات، compensating entries، وربط wallet بالـ ledger.
4. **Storage والخصوصية:** صلاحيات المرفقات، signed URLs، file validation، orphan cleanup، quotas، الحذف والاحتفاظ.
5. **الهوية والحظر وتبديل الأدوار:** كل route وRPC مع session قائمة وحساب محظور وحساب متعدد الأدوار.
6. **i18n/RTL وإمكانية الوصول:** inventory كامل واختبار جهاز فعلي، لا استنتاج من Landing أو وجود locale selector.
7. **CI والمigrations:** replay من قاعدة فارغة، upgrade من baseline المعتمد، SQL regression، RLS negative tests، workflow guards. لا يُستخدم نجاح CI قديم كبديل.
8. **التصميم وتجربة الهاتف:** screenshots متطابقة viewport، 360/390px، loading/error/empty/offline، update PWA أثناء تعبئة النماذج.
9. **مراجعة الوثائق والعقود:** بعد حسم المصدر الصحيح لكل من BACKEND_PROGRESS/CONTRACTS/FRONTEND_PROGRESS/I18N_STATUS/DESIGN_AUDIT، ومطابقة الوثائق للـ schema والمسارات الحالية.

## 12. الفروع وPRs — ما أمكن إثباته

| PR/فرع | الحالة من المعلومات المتاحة | القرار |
|---|---|---|
| PR #33 — Create Test six-step flow | نتيجة البحث تعرض PR بعنوان `feat(developer): add six-step Create Test flow` على `feat/developer-create-test-six-step`; لم أتحقق من merge commit أو حالة CI الحية هنا. | يبقى مفتوحاً/غير مدموج إلى أن يثبت خلاف ذلك من صفحة PR؛ لا تدمجه قبل migration/contract/UI validation. |
| PR #32 — Admin workspace | وصفه ينص على أن البيانات illustrative/mock والعمليات preview-only، وأن CI/التحقق مطلوب. | لا يُدمج على أنه Admin حقيقي؛ افصل preview عن المسارات التشغيلية. |
| PR #31 — Developer final report review | وصفه يضيف review RPC ومكافأة وتدقيقاً؛ يحتاج مراجعة تبعياته مع PR #30/#29 وSQL tests. | مراجعة backend-first وتأكد من ترتيب dependencies. |
| PR #30 — Tester report/evidence submission | وصفه يضيف submissions وbucket خاصاً وRPC؛ CI migration regression كان pending وفق نص PR القديم. | لا تعتمد على الوصف؛ تحقق من نتائج أحدث وhead SHA. |
| PR #29 — Server-authoritative check-ins | وصفه يضيف RPC check-in واختبارات؛ E2E حقيقي كان مطلوباً. | شرط أمان؛ تحقق من دمج/اختبار migration قبل أي UI release. |
| PR #13 — Unified Landing + Auth | وصفه Draft تاريخياً؛ لا أملك دليلاً هنا على حالته الحالية. | لا تفترض أنه ما زال مفتوحاً أو مدموجاً؛ افحص الحالة الحية. |
| PRs #1–#8 و#11–#18 وغيرها | ظهرت في سجل البحث كأعمال/PRs تاريخية، لكن لم يتم استخراج جدول كامل للحالة والـ head/base والـ mergeability. | **غير محسوم**؛ لا أوصي بترتيب دمج نهائي قبل inventory كامل. |

### ترتيب دمج مبدئي (ليس تصريحاً بالدمج)

1. تثبيت migrations/contracts واختبارات SQL وRLS أولاً، مع baseline/upgrade/rollback واضح.
2. إغلاق check-in server-side (#29) ثم submission/evidence (#30) مع اختباراتهما.
3. مراجعة developer report/reward (#31) بعد ثبوت contracts والـ ledger.
4. دمج مسارات إنشاء الاختبار (#33) بعد اختبار draft lifecycle وmigration على fresh + upgrade.
5. فصل واجهات Admin التجريبية (#32) عن أي ادعاء أنها متصلة بالبيانات، ثم ربط كل عملية إدارية بـ RPC مدققة.
6. تنفيذ توطين شامل وUX/accessibility، ثم QA مغلق على preview.
7. لا دمج إلى main ولا إطلاق إنتاجي حتى إغلاق بوابات الأمان والقانون والـ E2E.

## 13. أسئلة مطلوبة لإكمال المطابقة بلا تخمين

1. أين يوجد `DESIGN_AUDIT.md` بالضبط: أي فرع أو مسار؟
2. هل `docs/BACKEND_PROGRESS.md`, `docs/CONTRACTS.md`, `docs/FRONTEND_PROGRESS.md`, و`docs/I18N_STATUS.md` موجودة في فرع آخر أو تغيرت أسماؤها؟
3. هل الفرع المعتمد لإطلاق MVP هو `feat/developer-create-test-six-step` أم فرع تكامل آخر؟ وهل المطلوب تدقيق HEAD هذا فقط أم فرع تكامل نهائي؟
4. هل تسمح بتشغيل الاختبارات محلياً في بيئة المشروع لاحقاً؟ في هذه الجلسة لم تتوفر shell، لذلك لم أشغّل أي أوامر.
5. هل توجد بيئة Supabase محلية معتمدة للاختبار؟ لن أُجري أي اختبار كتابة على المشروع البعيد دون تصريح منفصل وخطة تنظيف آمنة.
6. هل قرار MVP النهائي ما زال: PWA/Web، لا مدفوعات ولا سحب نقدي، وثلاث لغات كاملة قبل التجربة المغلقة؟

## 14. قرار التدقيق

**لا أوصي بإعلان الجاهزية للإطلاق الآن.** هذا ليس حكماً بأن كل البنود ما زالت معطوبة؛ بل لأن عدداً من المخاطر الحرجة لم يُثبت إغلاقه على HEAD الحالي، والاختبارات المطلوبة لم تُشغّل في هذه الجلسة. البنود المصنفة «غير مؤكد» يجب أن تبقى مفتوحة تشغيلياً حتى يقدم الكود/الاختبار دليلاً قابلاً لإعادة التشغيل.

**لم تُجرَ أي تغييرات على التطبيق أو migrations أو إعدادات Supabase. هذا الملف هو الملف الوحيد الذي أُنشئ لهذا التدقيق.**
