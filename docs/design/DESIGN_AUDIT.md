# TestDZ — Design Audit

**تاريخ التدقيق:** 13 نوفمبر 2026  
**المستودع:** laidktif67-sketch/TestDZ  
**الفرع المرجعي:** feat/developer-report-review  
**Commit المرجعي:** 0321855cdf7ecb802c20492f80f8e23283fe3a71  
**النطاق:** المرحلة الأولى فقط — قراءة وتحليل، دون إنشاء Mockups أو تعديل كود التطبيق.

> هذا التدقيق يميز بين ما أثبته الكود وما يحتاج اختباراً بصرياً أو تشغيلياً. لا أصف أي شاشة بأنها مطابقة بصرياً قبل تشغيلها ومقارنتها على أحجام فعلية.

---

## 0. الملفات المرجعية وحدودها

| الملف | النتيجة |
|---|---|
| CLAUDE.md | **غير موجود في جذر الفرع أو ضمن شجرة الملفات المفحوصة**. لم أستبدله بتعليمات مخمّنة. |
| LAUNCH_PLAN.md | موجود، تمت قراءته لتحديد نطاق MVP، خصوصاً رحلة Tester وDeveloper، استبعاد الدفع والسحب والاشتراكات والإحالات وLeaderboard، ومتطلبات اللغات الثلاث. |
| UX_REPORT.md | موجود، تمت قراءة الأقسام 3 و5 و6 و8. التقرير نفسه يذكر أن مراجعته كانت قراءة كود ولم تشغّل التطبيق، وأن التغطية لم تشمل كل ملفات TSX/CSS سطراً بسطر. |
| apps/web/src/App.tsx | تمت قراءته كاملاً لاستخراج المسارات والحراس والأدوار. |
| apps/web/src/styles/tokens.css | تمت قراءته. |
| apps/web/src/styles.css | تمت قراءة الأساس العام وعينات المكونات المشتركة والأنماط القديمة. |
| apps/web/tailwind.config.js | تمت قراءته؛ لا توجد tokens مخصصة داخل Tailwind extend. |
| apps/web/index.html | تمت قراءته لتحديد الخطوط ومصدر تحميلها واللغة/الاتجاه الابتدائي. |
| مكونات مشتركة | تمت قراءة Card وBrand وLpIcon وTesterSidebar وRole/Auth guards ذات الصلة. |
| شاشات وCSS | تمت قراءة عينات من لوحات Tester وDeveloper، وDeveloper Review Reports الجديدة، مع جرد ملفات CSS من شجرة المستودع. |

**ملاحظة نسخة المصدر:** رأس UX_REPORT.md يذكر أنه راجع الفرع feature/developer-my-tests-dashboard والـ commit e4cd4456f86e3bf91a449322cb664c286ca3b28 (كما ورد في الوثيقة)، بينما هذا التدقيق يراجع فرع PR #31 الحالي. لذلك استخدمت UX_REPORT لتوجيه الفحص وربط FE IDs، ثم تحققت من المسارات والكود الحالي حيث أمكن. لا أتعامل مع كل ملاحظة قديمة على أنها ما زالت صحيحة دون تحقق.

## 1. استخراج نظام التصميم الفعلي

### 1.1 الألوان المثبتة في tokens.css

المصدر الأساسي هو apps/web/src/styles/tokens.css. هذه هي القيم المركزية الفعلية وليست لوحة ألوان مقترحة:

| Token | القيمة | الاستخدام المستنتج من الاسم/الاستخدام |
|---|---|---|
| --color-canvas | #f5f8ff | خلفية التطبيق الفاتحة |
| --color-surface | #ffffff | سطح البطاقة/المحتوى |
| --color-surface-raised | #ffffff | سطح مرتفع |
| --color-surface-subtle | #edf4ff | سطح ثانوي |
| --color-text | #071b50 | النص الأساسي |
| --color-text-muted | #526486 | النص الثانوي |
| --color-text-soft | #7183a2 | النص الخافت |
| --color-primary | #075cf5 | اللون الأساسي |
| --color-primary-hover | #064bd0 | حالة hover الأساسية |
| --color-primary-soft | #e8f0ff | خلفية primary الخفيفة |
| --color-accent | #08a879 | Accent / نجاح محتمل |
| --color-accent-soft | #e3fbf3 | خلفية Accent |
| --color-danger | #dc4545 | خطر/رفض |
| --color-border | rgba(7, 27, 80, 0.1) | حدود عادية |
| --color-border-strong | rgba(7, 27, 80, 0.18) | حدود بارزة |
| --color-focus | rgba(7, 92, 245, 0.24) | حلقة التركيز |

**Legacy aliases:** --bg و--surface و--surface-2 و--line و--text و--muted و--green و--green-bright و--red. الملاحظة المهمة أن --green و--green-bright يشيران فعلياً إلى --color-primary الأزرق، وليس إلى الأخضر. هذا إرث تسمية قد يسبب تفسيراً خاطئاً عند تعديل CSS.

### 1.2 ألوان متفرعة/متعارضة في الشاشات

| المصدر | القيم الموجودة | الملاحظة |
|---|---|---|
| developer-dashboard.css | --dd-blue #075cf5، --dd-navy #082f63، --dd-ink #102044، --dd-muted #71809b، --dd-line #e6edf8، خلفية #f4f8ff | قريب من نظام tokens، لكنه يعرّف نسخاً محلية موازية. |
| DeveloperDashboard hero | gradient من #0649c5 إلى #0879ed إلى #61b8f8 | نمط بصري مميز للوحة المطور؛ لا يوجد token للتدرج. |
| DeveloperReviewReports CSS | خلفية #f3f5ff، نص #091d58، primary #0758df، أخضر #07975d، أحمر #d92d50، بنفسجي #7442d5 | قيم محلية لا تطابق primary وdanger/accent المركزية حرفياً. |
| styles.css القديم | قيم كثيرة من الأزرق والأخضر الداكن، مثل #eff6ff و#1d4ed8 ودرجات خضراء في أجزاء Landing/Auth | توجد آثار من ثيم أقدم؛ لا ينبغي افتراض أن كل هذه القيم هي نظام التطبيق الداخلي. |
| Tester dashboard CSS | ألوان مستقلة للحالات والبطاقات، مع درجات أزرق/أخضر/بنفسجي/كهرماني | تحتاج توحيداً أو توثيقاً كألوان دلالية بعد فحصها صفحةً صفحة. |

**تعارض مثبت:** صفحة Review Reports الجديدة تستعمل Inter و#0758df و#f3f5ff بدلاً من Plus Jakarta Sans و#075cf5 و#f5f8ff المركزية. كذلك تستخدم زوايا محلية 12–19px. هذا ليس دليلاً على أنها غير جميلة، لكنه دليل كودي على أنها ليست مبنية بالكامل على tokens الحالية.

### 1.3 التباين المحسوب للألوان المركزية

حُسبت قيم التباين من ألوان tokens.css وفق صيغة WCAG contrast ratio، على خلفية بيضاء:

| زوج النص/الخلفية | النسبة التقريبية | النتيجة للنص العادي |
|---|---:|---|
| #071b50 على #ffffff | 16.39:1 | ينجح AA |
| #526486 على #ffffff | 5.96:1 | ينجح AA |
| #075cf5 على #ffffff | 5.44:1 | ينجح AA |
| #075cf5 على #f5f8ff | 5.12:1 | ينجح AA |
| #7183a2 على #ffffff | 3.84:1 | لا ينجح للنص العادي |
| #dc4545 على #ffffff | 4.22:1 | أقل من 4.5:1 للنص العادي |
| #08a879 على #ffffff | 3.05:1 | لا ينجح للنص العادي |

هذه حسابات للألوان المركزية فقط، وليست شهادة WCAG لكل الواجهات. يجب فحص درجات النص الصغيرة والحدود والأيقونات والنص فوق التدرجات وحالات hover/disabled بشكل منفصل. اللون الأخضر والأحمر الحاليان لا يصلحان تلقائياً كنص صغير فوق الأبيض دون تعديل درجة اللون أو تغيير الخلفية.

### 1.4 الخطوط

| الاستخدام | الخط | المصدر | دعم العربية |
|---|---|---|---|
| --font-sans | Plus Jakarta Sans ثم Noto Sans Arabic ثم sans-serif | Google Fonts خارجي في apps/web/index.html | Plus Jakarta Sans ليس الخط العربي الأساسي؛ fallback Noto Sans Arabic موجود. |
| --font-arabic | Noto Sans Arabic ثم Plus Jakarta Sans ثم sans-serif | Google Fonts خارجي | مناسب لتشكيل العربية واتصال الحروف بحسب عائلة الخط. |

- يتم تحميل الخطين من fonts.googleapis.com مع preconnect إلى fonts.gstatic.com؛ التطبيق يعتمد على اتصال خارجي للحصول على الخطوط، مع fallback نظامي.
- صفحة Developer Review Reports تضبط font-family إلى Inter, system-ui, sans-serif، لكن Inter غير محمّل في index.html؛ النتيجة المتوقعة غالباً fallback إلى system-ui بدلاً من Plus Jakarta Sans.
- لا يوجد دليل في Tailwind config على توحيد fontFamily؛ extend فارغ.
- لا توجد في المسارات المفحوصة ملفات خطوط محلية ضمن apps/web/public.

### 1.5 الأحجام والمسافات والزوايا والظلال

المصدر المركزي tokens.css:

| الفئة | Tokens |
|---|---|
| أحجام الخط | xs 0.75rem، sm 0.875rem، md 1rem، lg 1.125rem |
| المسافات | 4، 8، 12، 16، 20، 24، 32، 40، 48، 64px |
| الزوايا | sm 10px، md 16px، lg 22px، xl 28px، pill 999px |
| الظلال | sm 0 4px 12px rgba(23,54,105,.06)، md 0 12px 32px rgba(23,54,105,.1)، lg 0 24px 64px rgba(23,54,105,.14) |

ملاحظات:
- CSS الشاشات يستعمل قيماً كثيرة خارج السلم: 6، 9، 11، 13، 14، 17، 18، 19px، مع ظلال hard-coded متعددة.
- developer-dashboard.css يعرّف أبعاداً محلية كثيرة للـ sidebar والبطاقات والـ hero، وبعضها مضبوط لسطح المكتب ثم يتغير عبر media queries.
- في CSS الأساسي توجد قواعد mobile breakpoints عند 850 و520px؛ Developer Dashboard عند 1200 و900 و560px. هذا تفاوت يحتاج توثيقاً واختباراً، وليس بالضرورة خطأ بحد ذاته.
- لا يوجد token موحد واضح لارتفاعات الأزرار والحقول؛ الأزرار تتراوح بين 34 و52px في الأمثلة المفحوصة.

### 1.6 الأيقونات

- لا يظهر اعتماد مكتبة أيقونات عامة مثل Lucide ضمن dependencies المفحوصة.
- apps/web/src/shared/components/LpIcon.tsx يرسم SVG مخصصاً بأسماء حالات محددة؛ stroke-width الافتراضي 1.8 وviewBox 24×24.
- TesterSidebar.tsx يحتوي خريطة SVG مستقلة كبيرة لأيقونات التنقل والصفحات.
- DeveloperReviewReportsPage.tsx يحتوي خريطة SVG محلية أخرى مختلفة، مع fallback إلى file icon.
- توجد رموز Unicode/Emoji في بعض واجهات الصفحات، ومنها عناصر في Review Reports.
- النتيجة: الأيقونات vector وتبقى واضحة غالباً، لكن مصدر الأيقونة وسمك stroke وأحجامها ووجود بدائل موحد ليس مركزياً. يجب عدم افتراض أن كل أيقونة لها نسخة RTL معكوسة أو معنى موحد.

### 1.7 المكونات المشتركة وحالاتها

| المكوّن | الملف/المصدر | المتغيرات/الحالات المثبتة | الفجوات |
|---|---|---|---|
| Card | shared/components/ui/Card.tsx | default، bordered، elevated، interactive عبر prop variant | CSS الخاص بـ tdz-card لم يظهر ضمن القواعد العامة المفحوصة؛ يلزم التحقق من وجود تعريفه الفعلي أو stylesheet مستورد. |
| CardHeader/Title/Content/Footer | Card.tsx | تقسيم بنيوي؛ class names مستقلة | لا توجد props للحالة أو الكثافة أو الاتجاه؛ يعتمد على CSS غير مثبت هنا. |
| Brand | shared/components/Brand.tsx | مكوّن علامة تجارية مشترك | لم أجد نظاماً شاملاً لمقاسات العلامة عبر كل الـ shells؛ Developer Review Reports يرسم علامته محلياً. |
| LpIcon | shared/components/LpIcon.tsx | size افتراضي 24، SVG حسب name، fallback دائرة | لا توجد حالة disabled أو selected موحدة؛ أيقونات كثيرة موجودة في خرائط محلية أخرى. |
| Button العام | styles.css | .button، .button-primary، .button-quiet، .button-outline، .button-large؛ hover يرفع الزر 2px | لا توجد قواعد عامة صريحة disabled/loading في الجزء المركزي المفحوص. |
| Developer Dashboard button | developer-dashboard.css | .dd-primary، hover transform/shadow | لا تظهر حالات disabled/loading موحدة؛ ارتفاع desktop 38px ويتغير إلى 30px في mobile. |
| Review Reports buttons | developer-review-reports.css | أزرار tabs بحالة active؛ صفوف قابلة للنقر hover؛ أزرار القرار | لا توجد حالات focus مخصصة في CSS الخاص بالصفحة، لكن :focus-visible عام موجود؛ ارتفاعات بعض controls أقل من 44px. |
| Inputs | styles.css | auth input 49px، focus border/shadow؛ toolbar input 42px | لا توجد منظومة مشتركة كاملة لحالات error/disabled/loading/helper text. |
| Notices | styles.css | notice-warning، notice-success، notice-error | هذه تنبيهات inline وليست Toast system؛ لا يوجد دليل على نظام Toast مركزي. |
| Modal | styles.css | modal-backdrop، app-modal، modal-close | مكوّن CSS خاص بتفاصيل التطبيق؛ لا يوجد API مشترك موحد لكل الصفحات أو توثيق focus trap/escape. |
| Empty | عدة صفحات CSS | .apps-empty، .dd-app-empty، .dd-recent-empty، .drr-empty | أنماط متعددة، النص والخطوة التالية تختلف بين الصفحات. |
| Loading | عدة صفحات | .loading-screen، .dd-loading spinner، loading text داخل صفحات أخرى | لا يوجد skeleton عام موحد ظاهر. |
| Error | guards وCSS الصفحات | Auth/Role notices، .dd-error، .drr-error، أخطاء محلية | نصوص وحالات متنوعة؛ لا يوجد ErrorState component موحد. |
| Badge/status | CSS feature-specific | dd-status-*، drr-status، حالات draft/accepted/rejected وغيرها | ألوان وتسميات محلية؛ semantics غير موحدة بين الأدوار. |
| Tables/lists | صفحات feature | جداول check-in وrows للقوائم | لا يوجد Table component مشترك ظاهر في shared/components/ui. |
| Banner | صفحات محددة | notices/hero/promo محلية | لا يوجد Banner component عام واضح. |
| Toast | — | لم أعثر على نظام Toast مشترك في الملفات المفحوصة | حالة غير مثبتة؛ لا أضيف Toast جديداً قبل فحص بقية الشاشات. |

### 1.8 قواعد عامة وإمكانية الوصول

- styles.css يضع :focus-visible outline بعرض 3px مع outline-offset 3px في tokens.css.
- index.html يثبت lang="ar" وdir="rtl" عند التحميل الأول.
- لا توجد قيمة Tailwind tokens مخصصة؛ tailwind.config.js يستخدم theme.extend فارغاً.
- ارتفاعات لمس أقل من 44px موجودة في بعض عناصر Developer Dashboard وReview Reports، خاصة الأزرار الصغيرة داخل الجداول/التبويبات والـ CTA في CSS المحمول. يجب أن تكون 44px على الأقل في التسليم النهائي.
- لا يوجد تقرير تباين شامل لكل مكوّن، ولا اختبار keyboard/screen reader موثق في الملفات المقروءة.

## 2. جرد الشاشات والمسارات من App.tsx

التصنيف:
- **داخل MVP:** ضروري لرحلة الإطلاق وفق LAUNCH_PLAN.
- **خارج MVP:** موجود كمسار، لكن الخطة تستبعد الميزة من النسخة الأولى.
- **مخفي/محدود:** المسار محمي أو لا ينبغي عرضه في التنقل العام، أو يعيد توجيهاً/يستخدم صفحة placeholder.

| المسار | الشاشة | الدور/الحماية | النطاق |
|---|---|---|---|
| / | Landing | عام | داخل MVP |
| /terms | الشروط | عام | داخل MVP، لكن النص القانوني مسودة حسب UX_REPORT؛ لا mockup لنص قانوني قبل اعتماد النص |
| /privacy | الخصوصية | عام | داخل MVP، مانع إطلاق حتى اعتماد النص والترجمة |
| /auth | تسجيل/دخول | عام | داخل MVP |
| /signup-success | نجاح التسجيل | عام | داخل MVP |
| /auth/callback | Auth callback | عام/نظام | داخل MVP، حالة نظام |
| /verify-email | تأكيد البريد | عام | داخل MVP |
| /forgot-password | نسيت كلمة المرور | عام | داخل MVP |
| /reset-password | إعادة تعيين كلمة المرور | عام | داخل MVP |
| /password-reset-success | نجاح إعادة التعيين | عام | داخل MVP |
| /invalid-otp | رمز غير صالح | عام | داخل MVP |
| /onboarding | اختيار الدور | Auth + OnboardingGuard | داخل MVP |
| /interests | الاهتمامات | Auth + OnboardingGuard | داخل MVP إذا بقيت مطلوبة في onboarding |
| /complete-profile | إكمال الملف | Auth + OnboardingGuard | داخل MVP |
| /assignments/:id | تفاصيل المهمة | Auth | داخل MVP |
| /assignments/:id/progress | تقدم المهمة / 14 يوماً | Auth | داخل MVP |
| /assignments/:id/submit | إرسال التقرير النهائي | Auth | داخل MVP |
| /assignments/:id/summary | ملخص الإكمال | Auth | داخل MVP |
| /profile | الملف الشخصي | Auth | داخل MVP |
| /feedback-history | سجل الملاحظات | Auth | داخل MVP |
| /submit-feedback | إرسال Feedback | Auth | داخل MVP |
| /report-problem | الإبلاغ عن مشكلة | Auth | داخل MVP إذا كان مسار البلاغ الأساسي |
| /wallet-rewards | المحفظة والمكافآت | Auth | داخل MVP لعرض المكافآت المكتسبة والمعلّقة والمرفوضة ورصيد السحب المتاح |
| /withdrawal-request | طلب سحب | Auth | داخل MVP كمسار سحب للمكافآت المكتسبة والمعتمدة، بعد تنفيذ المراجعة والدفع الآمن |
| /withdrawal-status | حالة السحب | Auth | داخل MVP لمتابعة حالة طلب السحب وسجل قراراته |
| /help | مساعدة المختبر | Auth | داخل MVP |
| /support | مركز الدعم | Auth | داخل MVP |
| /support/:id | تفاصيل تذكرة الدعم | Auth | داخل MVP |
| /live-chat | محادثة مباشرة | Auth | خارج MVP ما لم توجد قدرة تشغيلية مثبتة؛ يوصى بإخفائه |
| /help-support | redirect إلى /help | Auth | مخفي/مسار توافق قديم |
| /settings | إعدادات الأمان | Auth | داخل MVP للحد الأدنى من إعدادات الحساب |
| /notification-preferences | تفضيلات الإشعارات | Auth | متوسط؛ تعتمد على وجود إشعارات مفعلة |
| /active-sessions | الجلسات النشطة | Auth | داخل MVP من منظور أمان الحساب |
| /tester/security-history | سجل نشاط الأمان | Tester RoleGuard | متوسط/أمني |
| /notifications | مركز إشعارات عام | Auth | داخل MVP |
| /admin | TesterSectionPage تحت Admin RoleGuard | Admin | داخل MVP كمدخل إدارة أساسي فقط، لكن المكوّن المعاد استخدامه لا يثبت وجود لوحة إدارة فعلية؛ حالة ناقصة/مخفية |
| /dashboard | RoleHomeRedirect | Auth | مخفي/مسار توجيه |
| /tester-dashboard | لوحة المختبر | Tester | داخل MVP |
| /my-tests | اختباراتي | Tester | داخل MVP |
| /assignments/:id/reward | مكافأة المهمة | Tester | داخل MVP لعرض مكافأة المهمة وحالة اعتمادها وأثرها على رصيد السحب |
| /leaderboard | لوحة الترتيب | Tester | خارج MVP + إخفاء |
| /tester/language-appearance | اللغة والمظهر | Tester | داخل MVP للغة؛ المظهر اختياري |
| /tester/privacy | إدارة الخصوصية والبيانات | Tester | داخل MVP |
| /check-in-history | سجل الحضور | Tester | داخل MVP |
| /activity-history | سجل النشاط | Tester | متوسط/غير أساسي |
| /referral-program | برنامج الإحالة | Tester | خارج MVP + إخفاء |
| /referral-history | سجل الإحالات | Tester | خارج MVP + إخفاء |
| /discover-tests | اكتشاف الاختبارات | Tester | داخل MVP |
| /tests/:id | معاينة الاختبار | Tester | داخل MVP |
| /developer-dashboard | لوحة المطور | Developer | داخل MVP |
| /developer/tests | اختباراتي للمطور | Developer | داخل MVP |
| /developer/tests/:id | تفاصيل الحملة | Developer | داخل MVP |
| /developer/tests/:id/monitoring | متابعة الحملة | Developer | داخل MVP |
| /developer/tests/new | إنشاء اختبار | Developer | داخل MVP؛ يجب أن تميّز Draft عن Published |
| /developer/settings | إعدادات المطور | Developer | داخل MVP للحد الأدنى |
| /developer/subscription | الاشتراك | Developer | خارج MVP + إخفاء |
| /developer/testers | إدارة المختبرين | Developer | داخل MVP |
| /developer/analytics | التحليلات | Developer | متوسط؛ المؤشرات الأساسية فقط، لا رسوم متقدمة مطلوبة |
| /developer/results | النتائج | Developer | داخل MVP |
| /developer/reports | قائمة مراجعة التقارير | Developer | داخل MVP، أضيفت في PR #31 |
| /developer/reports/:id | تفاصيل مراجعة التقرير | Developer | داخل MVP، أضيفت في PR #31 |
| /developer/feedback | Feedback الوارد | Developer | داخل MVP |
| /developer/feedback/:id | تفاصيل Feedback/الرد | Developer | داخل MVP |
| /developer/notifications | إشعارات المطور | Developer | داخل MVP |
| /developer/help | مساعدة المطور | Developer | داخل MVP |
| /developer/support | دعم المطور | Developer | داخل MVP |
| /developer/support/:id | تفاصيل تذكرة الدعم | Developer | داخل MVP |
| /apps | تطبيقات المطور | Developer | داخل MVP |
| /apps/:id | تفاصيل التطبيق | Developer | داخل MVP |

**ملاحظة عن الأدوار:** معظم صفحات Tester وDeveloper تقع تحت AuthGuard ثم OnboardingGuard، ثم RoleGuard لكل مجموعة. صفحات المهام وبعض الصفحات المشتركة موجودة تحت AuthGuard دون RoleGuard خاص؛ يجب أن يضمن Backend/RLS أن الدور والملكية يحددان البيانات. لا أستنتج صلاحية فعلية من إخفاء عنصر التنقل.

## 3. مصفوفة الحالات (Screen × State)

الرموز:
- **جيد جزئياً:** الحالة موجودة في كود الصفحة لكن ليست نظاماً موحداً أو لم تثبت جودة سلوكها.
- **ضعيف:** الحالة موجودة لكن الرسالة عامة أو لا تعطي الخطوة التالية أو لا تغطي كل السبب.
- **ناقص/غير مثبت:** لم أجد دليلاً كافياً في الكود/التقرير.
- **غير مطبق:** الحالة غير منطقية لهذه الشاشة.

هذه المصفوفة تدقيق كود؛ لا تعني أن الحالة اختبرت بصرياً على جهاز.

### 3.1 مصفوفة عامة بحسب مجموعة الشاشة

| الشاشة/المجموعة | Default | Empty | Loading | Error | Offline | Session expired | Banned | No permission / not found | Success | Partial data | Long lists / long FR / mixed RTL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Landing / Legal | موجود | غير منطبق غالباً | ضعيف/غير مثبت | غير مثبت | غير مثبت | غير منطبق | غير منطبق | غير منطبق | CTA فقط | غير مثبت | RTL/FR تحتاج تحقق |
| Auth / Verify / Reset | موجود جزئياً | غير منطبق | busy جزئي | رسائل مختلطة | غير مثبت | غير مثبت | غير مثبت | invalid OTP موجود | success routes موجودة | غير منطبق | نص عربي/لاتيني يحتاج تحقق |
| Onboarding / Interests / Profile | موجود | غير منطبق | saving موجود | موجود جزئياً | غير مثبت | guard عام | غير مثبت | guard جزئي | موجود جزئياً | غير مثبت | FR/RTL تحتاج تحقق |
| Tester Dashboard | موجود | بيانات صفرية ممكنة لكن تفسيرها ضعيف | spinner موجود | موجود catch عام | غير مثبت | session check | غير مثبت | role notice | بعض confirmations | موجود جزئياً | قوائم محدودة؛ RTL/FR غير مثبت |
| Discover Tests / Preview | موجود | empty موجود في Discover | موجود | موجود جزئياً | غير مثبت | redirect/session | غير مثبت | role/access جزئي | join state غير مكتمل الإثبات | غير مثبت | pagination/FR/RTL غير مثبت |
| My Tests / Assignment Details | موجود | unavailable state | موجود | موجود | رسالة اتصال عامة | redirect | غير مثبت | role/ownership يحتاج تحقق | حالات المهمة جزئية | غير مثبت | النص الطويل وRTL غير مثبت |
| Assignment Progress / Check-in | موجود | unavailable state | موجود | generic catch | غير مثبت | redirect | غير مثبت | role check | نجاح Check-in يعتمد على RPC | عداد الأيام محدود | لا يوجد إثبات عرض كل حالات اليوم المكرر/المفوّت/المرفوض |
| Assignment Submission / Summary / Reward | موجود | لا مرفقات كـ MVP | موجود جزئياً | موجود جزئياً | غير مثبت | AuthGuard | غير مثبت | ownership/RLS | submit success موجود جزئياً | غير مثبت | long report/FR/RTL يحتاج اختبار |
| Feedback / Feedback History | موجود | لا توجد empty واضحة لكل الحالات | assignments loading | موجود جزئياً | غير مثبت | redirect/session | غير مثبت | RLS عام | إرسال/رد موجود | قائمة محدودة | المرفقات غير الجاهزة يجب ألا تظهر؛ FR/RTL ناقص |
| Wallet / Rewards | موجود | غير مثبت | موجود | موجود جزئياً | غير مثبت | session handler | غير مثبت | access غير مثبت | ledger status جزئي | غير مثبت | مصطلح النقاط غير موحد؛ RTL/FR ناقص |
| Developer Dashboard | موجود | empty للتطبيقات/النشاط موجود | spinner موجود | رسائل عامة | غير مثبت | session handler | غير مثبت | RoleGuard | إنشاء/تحديث جزئي | بيانات profile قد تغيب | dashboard responsive؛ FR/RTL جزئي |
| Developer Apps / App Details | موجود | apps-empty موجود | موجود | DB error | غير مثبت | redirect | غير مثبت | developer guard | create/update notices جزئية | limits/metadata | RTL/FR غير مثبت |
| Developer Create Test / My Tests | موجود | empty apps جزئي | موجود | DB error | غير مثبت | redirect | غير مثبت | guard | حفظ Draft | خطوات Wizard متعددة | تمييز Draft/Published ناقص؛ FR/RTL ناقص |
| Developer Monitoring / Testers | موجود | empty غير واضح | موجود | موجود جزئياً | غير مثبت | getUser/session | غير مثبت | H1/RLS قد يخفي profile | لا يوجد تأكيد موحد | tester profile قد يكون ناقصاً | قوائم طويلة/pagination غير مثبتة |
| Developer Results / Analytics | موجود | chart empty في dashboard | موجود | غير مثبت بالكامل | غير مثبت | guard/session | غير مثبت | guard | export/filters بحسب الصفحة | تعريف المؤشرات يحتاج شرح | RTL/FR غير مثبت |
| Developer Review Reports | موجود | empty نصي عام | نص Loading وليس skeleton | error message عام لكن action غير موحد | غير مثبت | navigate إلى auth عند عدم وجود user | RoleAccessNotice فقط؛ ban state غير مثبت هنا | not-found message موجود | notice بعد RPC decision | tester/app profile قد يغيب ويعرض fallback | queue limit 200؛ لا pagination مثبتة؛ RTL/FR غير مدعومين |
| Developer Feedback / Details | موجود | empty جزئي | موجود | Retry موجود | غير مثبت | session expired message | غير مثبت | access error عام | reply success | بيانات ملف/مرفقات جزئية | حد ثابت/FR/RTL غير مثبت |
| Support / Ticket Details | موجود | empty موجود | موجود | RLS error عام | غير مثبت | user check | غير مثبت | error عام | reply/close حسب الصفحة | آخر رد/metadata | pagination/FR/RTL غير مثبت |
| Settings / Privacy / Notifications | موجود جزئياً | غير منطبق | موجود في بعض الصفحات | موجود جزئياً | غير مثبت | guards | غير مثبت | role-specific في بعض المسارات | save success جزئي | بيانات إعدادات موزعة | RTL/FR ناقص |
| Admin /admin | صفحة TesterSectionPage مع Admin guard | غير مثبت | غير مثبت | غير مثبت | غير مثبت | AuthGuard | admin path needs policy | Admin guard | لا يوجد workflow إدارة مثبت | غير مثبت | ليست لوحة إدارة مكتملة |

### 3.2 حالات المنتج الخاصة

| الحالة | الشاشة/الدور | الموجود حسب الأدلة | الفجوة / المطلوب في قائمة Mockups |
|---|---|---|---|
| لا توجد اختبارات مناسبة حالياً | Discover Tests / Tester | Empty state موجود وفق UX_REPORT | يحتاج Empty state يشرح عدم توفر اختبار مؤهل حالياً وخطوة تالية واحدة (العودة لاحقاً/تحديث القائمة)، دون إيحاء بفرص وهمية. |
| قيد تكوين المجموعة | Campaign Details / Developer | خطة MVP تطلب أن تكون الحالة مرئية؛ لم يثبت وجود حالة موحدة في الواجهة المفحوصة | Mockup عالي الأولوية يشرح المقاعد المؤكدة والاحتياج المتبقي دون ضمان موعد/عدد غير متاح. |
| Draft / قيد المراجعة / منشور | Create Test / My Tests / Developer | إنشاء الاختبار يحفظ status draft بحسب UX_REPORT؛ التمييز عن النشر غير واضح | حالة Draft مطلوبة. لا تصمم Published أو Under Review كحالة فعلية إلا إذا ثبتت حالات backend؛ يمكن عرضها كحالات موجودة فقط بعد التحقق. |
| Check-in مسجل | Progress / Tester | مسار RPC في PR #29 يضيف تسجيل الخادم | يحتاج نجاحاً لا يظهر إلا بعد تأكيد RPC، مع التاريخ والوقت المحليين. |
| Check-in مفوّت | Progress / Tester | السياسة تمنع التسجيل بأثر رجعي | يحتاج حالة توضح أن اليوم السابق لا يمكن تعويضه وأن الجدول يتأثر وفق سياسة المهمة. |
| Check-in مرفوض | Progress / Tester | UX_REPORT يقترح رسالة رفض واضحة | يحتاج سبباً مفهوماً وخطوة تالية؛ لا تعرض رسالة SQL/RLS. |
| Check-in مكرر | Progress / Tester | duplicate protection في backend PR #29 | يحتاج رسالة "تم تسجيل حضور هذا اليوم مسبقاً" دون منح نقاط ثانية. |
| استثناء طبي Pending | Progress / Tester | UX_REPORT يطلب عدم تطبيق عقوبة تلقائية أثناء المراجعة | لا يوجد تدفق تقديم واضح في المسار المفحوص؛ لا mockup قبل اعتماد مدخلات الطلب ونص الخصوصية. |
| استثناء طبي Approved | Progress / Tester | السياسة تقر بتمديد داخلي دون check-in للأيام المعفاة | يحتاج حالة تعرض التمديد وتوضح أن الأيام المعفاة لا تصبح Check-ins. |
| استثناء طبي Rejected | Progress / Tester | حالة منتج موثقة في سياسة المشروع | يحتاج سبباً وخطوة تالية؛ لا تعرض مستنداً طبياً للمطور. |
| Feedback مرسل / قيد المراجعة | Feedback / Tester + Developer | صفحات الإرسال والسجل موجودة؛ حالات العرض ليست موحدة | Mockup لحالة الإرسال المؤكد وحالة انتظار مراجعة المطور عند الحاجة. |
| مكافآت معلّقة / مكتسبة ومعتمدة / مرفوضة | Wallet/Reward / Tester | Wallet وسجل ledger موجودان جزئياً | توحيد حالات المكافأة وسبب القرار؛ إتاحة السحب للمكافآت المكتسبة والمعتمدة فقط، بعد تفعيل دورة السحب الآمنة. |
| تذكرة دعم مفتوحة / مغلقة | Support / كلا الدورين | صفحات الدعم والتفاصيل موجودة | حالات status/آخر رد/خطوة تالية تحتاج توحيداً واختباراً. |
| تقرير نهائي Submitted / Accepted / Rejected | Review Reports / Developer | PR #31 يضيف queue/detail وقرار backend | الحالة موجودة في الفرع؛ تحتاج لغات ثلاثية وحالات offline/session/banned/pagination، كما أن التصميم يستخدم tokens محلية متباينة. |

### 3.3 حالة النقاط — قيد إلزامي لكل Mockup

أي شاشة تعرض رصيداً أو مكافأة أو حركة ledger يجب أن تميّز بوضوح بين المكافآت المعلّقة والمكتسبة والمعتمدة والمرفوضة. المكافآت المكتسبة والمعتمدة فقط يمكن أن تصبح مؤهلة للسحب وفق سعر التحويل والحدود ووسائل الدفع التي تضبطها الإدارة. الرصيد المشترى (purchased_credits) منفصل ولا يمكن سحبه أو تحويله إلى مكافآت. لا تعرض سعراً أو وعد دفع قبل تفعيل الإعدادات ودورة الدفع الآمنة.

## 4. فجوات الهوية والاتساق مع دليل الكود

| الفجوة | الدليل | الأثر |
|---|---|---|
| صفحة Review Reports لا تستخدم الخط المركزي | developer-review-reports.css يحدد Inter, system-ui؛ index.html يحمل Plus Jakarta Sans وNoto Sans Arabic فقط | اختلاف طباعي وfallback غير متوقع؛ يجب ربطها بـ --font-sans. |
| Review Reports تعرّف primary وخلفية محليين | #0758df و#f3f5ff مقابل --color-primary #075cf5 و--color-canvas #f5f8ff | انحراف لوني قابل للقياس. |
| Review Reports لا تستخدم tokens للزوايا والظلال | قيم مثل 12px و16px و17px و19px وbox-shadow محلي | اختلاف في نصف القطر وعمق البطاقات. |
| Review Reports sidebar/brand/icon مستقلة | drr-sidebar وdrr-brand وIcon map داخل الصفحة | تكرار مكون التنقل والعلامة والأيقونات بدلاً من مكون Developer shell موحد. |
| Developer Dashboard نفسه يملك tokens محلية | --dd-* داخل developer-dashboard.css | يوجد نظام فرعي موازٍ؛ قريب من المركزي لكنه غير موحد. |
| Global CSS يحوي إرث ألوان أخضر/داكن | styles.css يستخدم aliases خضراء ودرجات أقدم في أجزاء Landing/Auth | خطر إعادة استخدام class أو token legacy بمعنى غير متوقع. |
| RTL غير مركزي | بعض CSS يستخدم [dir=rtl]، لكن UX_REPORT يذكر margin-left/text-align:left في discover-tests.css ومراجع أخرى | قد تنعكس أجزاء من الصفحة دون بقية المكونات. |
| اللغة ليست Provider واحداً | UX_REPORT يحدد localStorage وprofiles.locale وuser_metadata، مع Developer Dashboard state مستقل | تبديل اللغة قد لا يترجم كل route ولا يثبت الاتجاه قبل render. |
| عناصر لمس أصغر من 44px | developer-dashboard.css mobile CTA 30px وبعض tabs/controls 34–40px؛ Review Reports tabs 40px | لا يحقق معيار اللمس الذي طلبه صاحب المشروع. |
| حالة disabled/loading غير موحدة | الزر العام لا يحدد جميع الحالات؛ feature styles لها سلوك مستقل | المستخدم قد لا يفهم هل الإجراء جارٍ أو غير متاح. |
| Card variant API غير موثق بالكامل | Card.tsx يعلن default/bordered/elevated/interactive؛ CSS الفعلي لـ tdz-card لم يظهر في الملفات الأساسية المقروءة | لا يمكن اعتماد هذه variants قبل تحديد CSS الفعلي. |
| Toast غير مثبت | لم يظهر Toast provider أو مكوّن مشترك في الشجرة/الملفات المفحوصة | لا نفترض أن التنبيهات المؤقتة متاحة؛ الموجود inline notices. |
| لا توجد حالة offline موحدة | UX_REPORT يصنف offline غير مثبت في معظم الرحلات | PWA لا يثبت وحده وجود offline UX. |

### ملاحظة RTL/LTR

- html الابتدائي في index.html هو ar/rtl، لكن صفحة Developer Dashboard تضبط lang/dir من localStorage محلياً، وإعدادات Language Appearance تكتب profile/user_metadata.
- هناك قواعد [dir=rtl] في Developer Dashboard، لكن ليست طبقة عامة لكل التطبيق.
- CSS المنطقي المطلوب مستقبلاً: margin-inline، padding-inline، inset-inline، text-align:start/end، مع dir=ltr موضعي للأرقام والمعرفات والبريد وأسماء الحزم اللاتينية.
- يجب اختبار نص مختلط مثل "CodeMaster — com.example.app" داخل فقرة عربية، لا الاكتفاء بتغيير dir على عنصر الجذر.

## 5. قائمة Mockups المطلوبة — للاعتماد قبل المرحلة الثانية

**لا يوجد أي Mockup منشأ في هذا التدقيق.** القائمة التالية هي مقترح الاعتماد فقط. كل بند مرتبط بدليل UX_REPORT أو فجوة حالية. الأولوية تعني أهمية التصميم للمراجعة، ولا تعني أن mockup وحده يحل العائق البرمجي.

| ID | Mockup / الشاشة والحالة | الدور | السبب | الأولوية | RTL + LTR؟ | المكونات | ربط UX_REPORT |
|---|---|---|---|---|---|---|---|
| M-01 | Discover Tests — لا توجد اختبارات مناسبة حالياً | Tester | empty موجود لكنه يحتاج سبباً وخطوة تالية موحدة | عالية | نعم | يمكن توليده بمكوّن موجود (Card/Empty patterns) | FE-04، FE-13، UX-BLOCK-02 |
| M-02 | Assignment Progress — Check-in متاح/مسجل/مكرر/مفوّت/مرفوض | Tester | شاشة حرجة؛ يجب توضيح حالات الخادم وسياسة عدم backdating | مانعة للإطلاق | نعم | يحتاج توحيد Status/Feedback state؛ يمكن البدء بمكونات موجودة | FE-01، FE-04، FE-13 |
| M-03 | Medical Exception — Pending/Approved/Rejected | Tester | مسار الطلب الحالي غير واضح/غير مكتمل؛ بيانات حساسة | مانعة للإطلاق | نعم | يحتاج مكوّن حالة استثناء/خصوصية جديد من نفس لغة البطاقات والتنبيهات | FE-09، FE-13 |
| M-04 | Assignment Submission — تقرير نهائي/تأكيد الإرسال/قائمة المرفقات المتاحة في MVP | Tester | مسار أساسي لإكمال المهمة؛ يجب عدم إظهار attachment controls غير المدعومة | عالية | نعم | يمكن توليده بمكوّن موجود؛ لا تصميم مرفقات غير جاهزة | FE-04، FE-10 |
| M-05 | Wallet & Reward — نقاط معلقة/مكتسبة/مرفوضة مع السبب | Tester | وضوح الثقة ومنع فهم النقاط كأموال | مانعة للإطلاق | نعم | يحتاج Status/Points disclosure موحداً من tokens الحالية | FE-08، FE-14 |
| M-06 | Developer Create Test — Draft محفوظ مقابل نشر/مراجعة إن ثبتت الحالة | Developer | wizard يحفظ draft؛ لا يجب أن يوحي بالنشر | عالية | نعم | يمكن توليده بمكوّن موجود (Wizard/Card/Badge) | FE-05، FE-07 |
| M-07 | Developer Campaign — قيد تكوين المجموعة | Developer | حالة أساسية في رحلة المطور بحسب LAUNCH_PLAN؛ لم يثبت تمثيلها بوضوح | عالية | نعم | يحتاج Progress/Capacity state؛ يمكن أن يبنى من Card/Progress موجود إذا ثبت | FE-05، FE-12، UX-BLOCK-04 (إن كان معرفاً في التقرير) |
| M-08 | Developer Testers — قائمة/بيانات جزئية/اسم وصورة غير متاحين | Developer | RLS/profile visibility قد يمنع البيانات؛ لا يجوز إظهار هوية مستنتجة | عالية | نعم | يحتاج ProfileFallback state بسيط من نفس اللغة البصرية | FE-05، FE-11 |
| M-09 | Developer Review Reports — Queue empty/loading/error/partial + detail accepted/rejected | Developer | الصفحة جديدة في PR #31 وتحتاج ضبط tokens والحالات واللغات | عالية | نعم | يمكن توليده بمكونات موجودة، مع توحيد shell/status | FE-05، FE-13، FE-14، FE-15، FE-16 |
| M-10 | Developer Feedback — مرسل/قيد المراجعة/تم الرد | Developer | حالة Feedback أساسية لكن التسمية والحالات غير موحدة | عالية | نعم | يمكن توليده بمكوّنات Card/Badge/Empty الحالية | FE-05، FE-14 |
| M-11 | Support Center / Ticket Details — مفتوحة/مغلقة/لا ردود | Tester + Developer | مسار دعم مطلوب في MVP، مع حالات واضحة | متوسطة | نعم | يمكن توليده بمكوّنات موجودة | FE-13، FE-14 |
| M-12 | Session Expired / Account Restricted / No Permission | كل الأدوار | الحالات العامة غير موحدة، والحظر لا ينبغي أن يبدو كخطأ عادي | عالية | نعم | يحتاج StateNotice موحداً مع variants؛ مكوّن جديد صغير من نفس لغة التنبيهات | FE-13، FE-20 |
| M-13 | Legal & Privacy — صفحة حالة اعتماد/مراجعة النصوص فقط | عام | النص القانوني الحالي Working Draft؛ لا يجوز إعادة صياغة قانونية آلياً | مانعة للإطلاق | نعم | لا mockup لنص قانوني؛ placeholder واضح بانتظار نص معتمد | FE-06 |
| M-14 | Admin — قائمة المراجعة الأساسية/حالات الدعم/الاستثناءات (بعد تثبيت نطاق Admin MVP) | Admin | /admin يعيد استخدام TesterSectionPage ولا يثبت لوحة إدارة مكتملة | مانعة للإطلاق | نعم | يحتاج تحديد الشاشات الفعلية ومكونات moderation؛ لا نصمم نطاقاً غير معتمد | خارج FE scope الحالي؛ Launch Plan milestone A/B |

### عناصر لا أوصي بتصميمها في MVP

- مسارات طلب السحب وحالته ضمن MVP، لكن لا تُعرض كميزة إنتاجية قبل تنفيذ مراجعة الإدارة وتسوية الدفع وحجز/تحرير الرصيد بأمان.
- Developer Subscription/Billing أو شراء credits.
- Referral Program/History.
- Leaderboard.
- Live Chat إذا لم تكن هناك قدرة تشغيلية حقيقية.
- Upload media أو feedback attachments غير الجاهزة.
- أي شاشة تدعي Google Play opt-in verified ما لم توجد بيانات موثوقة وتكامل مثبت.
- أي عرض لقيمة نقدية أو سعر تحويل للنقاط.

## 6. ما فُحص وما لم يُفحص

### ما فُحص
- مستودع GitHub على فرع feat/developer-report-review عند SHA المذكور.
- App.tsx ومساراته وحراس الأدوار.
- LAUNCH_PLAN.md كاملاً بالقدر اللازم لتحديد MVP.
- UX_REPORT.md، خصوصاً الأقسام 3 و5 و6 و8.
- tokens.css وstyles.css وtailwind.config.js وindex.html وvite.config.ts.
- ملفات CSS في شجرة apps/web/src، ومكونات Card وBrand وLpIcon وTesterSidebar.
- عينة من صفحات Tester Dashboard وDeveloper Dashboard وDeveloper Review Reports.
- حساب تباين عدد من ألوان tokens المركزية حسابياً.

### ما لم يُفحص/لم يحدث
- **لم أشغّل التطبيق** ولم أفتح Vite preview أو PWA على متصفح/هاتف.
- لم ألتقط screenshots أو أقارن 360×800 أو tablet أو desktop بصرياً.
- لم أختبر فعلياً RTL/LTR أو طول الفرنسية أو النص العربي المختلط بالمعرفات اللاتينية.
- لم أختبر keyboard-only أو screen reader أو focus order أو contrast لكل حالة ومكوّن.
- لم أقرأ كل ملفات TSX/CSS البالغ عددها مئات الملفات سطراً بسطر؛ الجرد أوسع من القراءة التفصيلية.
- لم أتحقق من كل حالات backend/RPC/Storage أو صلاحيات RLS من قاعدة بيانات فعلية.
- لم أراجع النص القانوني أو أترجمه؛ أي نص قانوني يحتاج نسخة معتمدة ومراجعة بشرية.
- لم أعدّل src أو tailwind أو CSS أو أي ملف خارج docs/design.
- لم أنشئ Mockups أو HTML أو COMPONENT_GAPS أو COPY أو HANDOFF في المرحلة الأولى.

## 7. أسئلة لصاحب المشروع (5 كحد أقصى)

1. **هل نعتمد هذا الفرع feat/developer-report-review كمرجع التصميم الحالي، أم تريد أن يكون الأساس هو architecture-v1/main؟**  
   توصيتي: اعتماد الفرع الحالي مؤقتاً للتدقيق لأنه يحتوي سلسلة Tester/Developer الأحدث، مع إعادة التحقق من الفروقات قبل handoff النهائي.

2. **هل Admin داخل MVP الأول أم بعد إكمال Tester وDeveloper؟**  
   توصيتي: Admin أساسي داخل بوابة الإطلاق، لكن نحدد فقط مراجعة الاستثناءات والدعم والحسابات والتقارير؛ لا نصمم لوحة إدارية واسعة قبل تعريف صلاحياتها.

3. **هل نعرض نقاط TestDZ في جميع المواضع بلفظ points فقط مع disclosure ملاصق؟**  
   توصيتي: نعم، مع توضيح أن المكافآت المكتسبة والمعتمدة قابلة للسحب وفق إعدادات المنصة، بينما الرصيد المشترى غير قابل للسحب. لا نعرض سعر تحويل أو وعد دفع قبل تفعيلهما.

4. **هل تريد إخفاء كل المسارات الخارجة عن MVP من التنقل مع إبقاء routes محمية، أم تعطيلها/إزالة مساراتها أيضاً؟**  
   توصيتي: إخفاؤها من التنقل وعدم تسويقها، مع قرار هندسي منفصل حول إبقاء routes للتطوير أو تعطيلها قبل الإطلاق.

5. **هل اعتماد النصوص القانونية والترجمات الثلاثية سيكون من طرفك/مراجع قانوني قبل تصميم صفحات Legal؟**  
   توصيتي: نعم؛ في Mockups نستخدم placeholder واضحاً ولا نصوغ شروطاً أو خصوصية قانونية من عندنا.

---

**نقطة توقف المرحلة الأولى:** لا تبدأ المرحلة الثانية ولا تنشئ أي Mockup قبل مراجعة صاحب المشروع لقائمة M-01 إلى M-14 واعتماد البنود المطلوبة.


## ملحق اعتماد المرحلة الثانية — قرارات صاحب المشروع

- الفرع المرجعي المؤقت: `feat/developer-report-review` (PR #31)، ويعاد التحقق من الفروقات قبل HANDOFF النهائي.
- Admin ضمن MVP بثلاث مهام فقط: مراجعة الاستثناءات الطبية، الدعم/البلاغات، حظر الحساب. تصميم Admin مؤجل إلى الموجة الثالثة، وM-14 ينتظر تحديد الشاشات.
- مكافآت المختبر المكتسبة والمعتمدة قابلة للسحب وفق سعر التحويل وشروط الإدارة؛ الرصيد المشترى منفصل وغير قابل للسحب.
- المسارات خارج MVP تُخفى من التنقل، وتحول إلى صفحة «غير متاح» قبل التجربة بقرار هندسي منفصل. لا تصمم لها Mockups.
- النصوص القانونية تبقى placeholder؛ حُذف M-13 من قائمة Mockups.
- M-03: التواريخ المطلوبة + سبب قصير محدود الطول فقط، دون رفع مستند. القرار من Admin فقط. تعرض الشاشة ما يجمع ومن يراه، مع placeholder خصوصية ينتظر اعتماد المستشار القانوني.
- M-12: حالة الحساب المحظور مستقلة عن الخطأ العادي، وتُعرض حتى لو بقيت جلسة المستخدم قائمة.

### ترتيب الموجات المعتمد
1. الموجة الأولى: M-00، M-02، M-03، M-05، M-12.
2. الموجة الثانية: M-01، M-04، M-06، M-07، M-08، M-09.
3. الموجة الثالثة: M-10، M-11، M-14 بعد تحديد شاشات M-14 من صاحب المشروع.

لا تبدأ أي موجة لاحقة قبل موافقة صريحة على الموجة السابقة.


## 10. Admin dashboard concept — added after Wave 1

- Added static overview mockups: `mockups/admin-dashboard-overview-{ar,fr,en}.html`.
- The concept expands the future Admin scope with user/developer/tester management, apps and tests, cohorts, assignments, reports, medical exceptions, support, suspensions/appeals, rewards/withdrawals, payments/plans, analytics, leaderboard, notifications, audit trail, monitoring and settings.
- Summary cards, trend chart, test-status donut, activity feed, top contributors and system-health strip use illustrative mock data only.
- The withdrawal/rewards, payments, uptime and performance indicators are future concepts, not evidence that those workflows or monitoring services are implemented.
- This remains a design artifact under `docs/design/`; it does not create an Admin application route, authorization policy, API, database schema, or operational action.
- The Admin dashboard was added as a separate concept after the originally approved Wave 1 screens. Further Admin detail screens and application implementation require their own approval.
