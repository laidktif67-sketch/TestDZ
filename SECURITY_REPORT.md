# SECURITY_REPORT.md — مراجعة أمنية قبل التجربة المغلقة

**التاريخ:** 2026-11-13  
**المستودع:** `laidktif67-sketch/TestDZ`  
**الفرع الذي تمت مراجعته:** `feature/developer-my-tests-dashboard`  
**رأس المراجعة:** `49e89fa664c5190eeddd41ce6e9e47b584f88d3a`  
**نطاق القرار:** مراجعة ثابتة للمصدر وسلسلة migrations، وليست اختبار اختراق على قاعدة الإنتاج.

---

## 1. الملخص التنفيذي

<badge>غير جاهز للتجربة المغلقة</badge>

**القرار الأمني: لا أوصي بفتح Closed Beta قبل إغلاق نتائج High التالية وإثباتها باختبارات تشغيلية.** لا أملك دليلاً على تسريب شامل أو تجاوز RLS عام، لكن توجد ثغرات نزاهة في تسجيل الحضور، وعدم إنفاذ الحظر، وفجوة في وصول المطوّر إلى بيانات المختبرين، وخلل في مسار مراجعة الاستثناء الطبي. كما يوجد مسار GitHub Actions يدوي موجّه إلى مشروع TestDZ القديم رغم تسميته بيئة development.

### أخطر خمس نتائج

1. **H1 — صلاحيات profiles لا تسمح للمطوّر برؤية الاسم والصورة للمختبر المعيّن.** السياسة الوحيدة لـ SELECT على profiles هي المالك أو admin؛ صفحات المطوّر تحاول قراءة بيانات المختبرين لكنها ستتلقى صفوفاً محجوبة. هذا خلل وصول/وظيفة مؤكد وفق migrations، وليس دليلاً على كشف بيانات.
2. **تزوير check-ins — يمكن للمختبِر إدخال check-ins لتواريخ يختارها بنفسه.** المنحة الحالية INSERT على مستوى الجدول، والسياسة تتحقق من ملكية assignment وحالته فقط؛ لا تفرض تاريخ اليوم ولا تمنع إدخال created_at من العميل. هذا يتيح نظرياً اصطناع دورة 14 يوماً بسرعة.
3. **is_banned غير مفروض في طبقة البيانات.** الحقل موجود ومحمي من تعديل المستخدم، لكن لم أجد شرطاً يوقف عمليات المستخدم المحظور في RLS أو RPCs. تغيير العلم وحده لا يثبت أن الحظر فعّال.
4. **مراجعة الاستثناء الطبي غير متوافقة مع مخطط الجدول.** الجدول ينشئ requested_days، بينما دالة المراجعة تقرأ requested_dates. كما أن authenticated يملك GRANT UPDATE على الجدول، مع أن RLS تقصر الصفوف على admin، ما يسمح للمسؤول بتجاوز RPC وسجل التدقيق.
5. **مسار ترحيل يدوي موجّه إلى TestDZ القديم.** ملف `.github/workflows/apply-migration.yml` يتحقق من project ref القديم ثم ينفذ `supabase db push --remote --yes`. لم أشغّله. لا يجوز تشغيله في سياق هذه المراجعة أو قبل تصحيح هدفه وموافقات النشر.

### نطاق ما فُحص وما لم يُفحص

- تمت قراءة `AUDIT_REPORT.md` و`LAUNCH_PLAN.md` وREADME وArchitecture وMaster Blueprint على رأس الفرع أعلاه.
- تمت مراجعة **43 ملف migration** زمنياً، مع تتبع تعريفات الجداول والسياسات والمنح والدوال والمحفزات ومخازن Storage.
- تم مسح **96 ملف TypeScript/TSX** في `apps/web/src` بحثاً عن أنماط XSS والأسرار وAuth والتخزين المحلي والروابط وعمليات Supabase. لم أراجع كل ملف CSS سطراً بسطر.
- تمت مراجعة ملفات CI واختبارات SQL وStorage regression.
- أجريت استعلامات **قراءة فقط** على `TestDZ-Rebuild` فقط. النتيجة: لا توجد جداول تطبيق في public، ولا دوال تطبيق، ولا سياسات public، ولا buckets معرفة، ولا migrations مسجلة. لذلك لا يمكن استخدامه لاختبار RLS الفعلي لهذا المخطط.
- **لم أستعلم عن TestDZ القديم/الإنتاج، ولم أطبّق migrations، ولم أعدّل أي ملف موجود.**
- إعدادات Auth وStorage وVercel البعيدة، وبيانات الإنتاج الفعلية، لم تكن ضمن ما أمكن إثباته.
- لم أشغّل `npm audit`: لا يوجد checkout محلي قابل للتشغيل في بيئة التنفيذ المستخدمة، ونتائج CI الحالية لا تتضمن audit.
- لم أجرِ فحصاً كاملاً لكل تاريخ Git أو فحص GitHub Secret Scanning من لوحة المستودع. لذلك لا أصف نتيجة فحص الأسرار بأنها شاملة تاريخياً.

نجاح CI لا يغيّر هذا القرار: آخر تشغيل ظاهر لـ TestDZ CI هو run **874** ناجح، وSupabase migration regression هو run **158** ناجح، وVercel status ناجح. هذه النتائج تثبت نجاح ما تشغله تلك الوظائف على بيئتها، ولا تثبت سلامة إعدادات الإنتاج أو الحالات غير المختبرة أدناه.

---

## 2. جدول RLS الكامل — وفق سلسلة migrations

**تنبيه:** عمود RLS أدناه يعني أن migrations تنشئ/تفعّل RLS. لم أتحقق من الحالة الحية على TestDZ القديم. جميع الجداول الـ39 أدناه لها RLS مفعّل في سلسلة الإنشاء التي راجعتها. لم أجد سياسة تطبيقية من نوع `USING (true)`. لا توجد منح DELETE مباشرة للمستخدمين على جداول public التي راجعتها.

| الجدول | RLS؟ | SELECT | INSERT | UPDATE | DELETE | GRANT anon / authenticated | ملاحظات |
|---|---|---|---|---|---|---|---|
| profiles | نعم | المالك أو admin | لا؛ إنشاء عبر trigger | المالك، أعمدة ملفه المسموح بها فقط | لا | anon: لا / auth: SELECT + UPDATE أعمدة محددة | H1: لا توجد قراءة للملف العام من مطوّر الاختبار |
| user_roles | نعم | المستخدم لنفسه أو admin | لا | لا | لا | anon: لا / auth: SELECT | لا يستطيع العميل ترقية نفسه مباشرة |
| apps | نعم | منشور أو المالك أو admin | عبر RPC | عبر RPC | لا | anon: لا / auth: SELECT | إنشاء/تعديل التطبيق عبر دوال تحقق الملكية |
| tests | نعم | المالك أو admin أو اختبارات التطبيق المنشور | أعمدة إدخال محددة، app يملكه المطوّر | أعمدة محددة للمالك/admin | لا | anon: لا / auth: SELECT + INSERT/UPDATE محدودان | status وحقول الإدارة ليست ضمن منحة التعديل العادية |
| cohorts | نعم | المشاركون وadmin | لا | لا | لا | anon: لا / auth: SELECT | إدارة cohort عبر RPC إداري |
| cohort_tests | نعم | admin، مالك الاختبار، أو المختبِر المعيّن | لا | is_active فقط للمالك/admin | لا | anon: لا / auth: SELECT + UPDATE(is_active) | trigger يمنع إعادة التنشيط بعد إغلاق cohort |
| assignments | نعم | المختبِر أو مالك الاختبار أو admin | لا | لا | لا | anon: لا / auth: SELECT | لا يمكن للمستخدم إنشاء assignment باسم مستخدم آخر مباشرة |
| checkins | نعم | المختبِر أو المطوّر المالك أو admin | المختبِر لنفسه على assignment نشط | لا | لا | anon: لا / auth: SELECT + INSERT على الجدول | **منحة INSERT واسعة الأعمدة ولا يوجد تحقق من تاريخ check-in** |
| feedback | نعم | أطراف assignment أو admin | المختبِر المعيّن، ويبدأ pending | لا | لا | anon: لا / auth: SELECT + INSERT بأعمدة محددة | UNIQUE على assignment يمنع feedback مكرراً |
| play_opt_in_events | نعم | أطراف assignment أو admin | لا | لا | لا | anon: لا / auth: SELECT | لا يثبت ذلك وحده حالة Google Play الحقيقية |
| wallets | نعم | المالك أو admin | لا | لا | لا | anon: لا / auth: SELECT | الرصيد مخزّن في الجدول |
| points_ledger | نعم | المالك أو admin | لا | لا | لا | anon: لا / auth: SELECT | trigger يمنع UPDATE/DELETE |
| plans | نعم | الخطط النشطة أو admin | لا | لا | لا | anon: SELECT / auth: SELECT | الكتالوج هو الجدول العام الوحيد الذي وجدت له SELECT anon |
| subscriptions | نعم | المالك أو admin | لا | لا | لا | anon: لا / auth: SELECT | لا توجد كتابة مباشرة للعميل |
| payments | نعم | المالك أو admin | لا | لا | لا | anon: لا / auth: SELECT | لا توجد كتابة مباشرة للعميل |
| refunds | نعم | المالك أو admin | لا | لا | لا | anon: لا / auth: SELECT | لا توجد كتابة مباشرة للعميل |
| platform_config | نعم | admin | لا | لا | لا | anon: لا / auth: admin SELECT | العميل لا يستطيع تعديل flags |
| audit_logs | نعم | admin | لا مباشرة | لا | لا | anon: لا / auth: admin SELECT | سجلات التدقيق غير قابلة للتعديل من العميل |
| fraud_reviews | نعم | admin | لا | لا | لا | anon: لا / auth: admin SELECT | إدارة خادمية |
| reports | نعم | المبلّغ أو admin | المبلّغ لنفسه، assignment اختياري | لا | لا | anon: لا / auth: SELECT + INSERT بأعمدة محددة | **reported_user_id لا يُربط في WITH CHECK بطرف assignment** |
| disputes | نعم | الفاتح أو admin | opened_by هو المستخدم، مع مرجع دفع/بلاغ يشارك فيه | لا | لا | anon: لا / auth: SELECT + INSERT بأعمدة محددة | لا يمكن تزوير حالة الحل عند الإدخال |
| notifications | نعم | المستخدم ودور صندوق الإشعارات المطابق | لا | read_at وarchived_at فقط | لا | anon: لا / auth: SELECT + UPDATE أعمدة محددة | recipient_role غير قابل للتعديل من العميل |
| devices | نعم | المالك أو admin | لا | لا | لا | anon: لا / auth: SELECT | لا يظهر مسار تسجيل جهاز من العميل في grants |
| fraud_events | نعم | admin | لا | لا | لا | anon: لا / auth: admin SELECT | لا توجد كتابة عميل |
| coupons | نعم | الكوبونات النشطة أو admin | لا | لا | لا | anon: لا / auth: SELECT | لا توجد كتابة عميل |
| coupon_redemptions | نعم | صاحب الاسترداد أو admin | لا | لا | لا | anon: لا / auth: SELECT | الاسترداد يحتاج مساراً خادمياً |
| referrals | نعم | أطراف الإحالة | لا | لا | لا | anon: لا / auth: SELECT | لا يوجد مسار إحالة قابل للكتابة من العميل في grants |
| feature_usage | نعم | صاحب السجل أو admin | لا | لا | لا | anon: لا / auth: SELECT | لا توجد كتابة عميل |
| events | نعم | admin | لا | لا | لا | anon: لا / auth: admin SELECT | سجل داخلي |
| medical_exception_requests | نعم | المختبِر صاحب الطلب أو admin | صاحب assignment بحالة pending | admin فقط وفق RLS | لا | anon: لا / auth: SELECT + INSERT + UPDATE | UPDATE على مستوى الجدول ممنوح لكل authenticated لكن RLS تمنع غير admin |
| report_attachments | نعم | المبلّغ، مالك الاختبار، admin عبر helper | المبلّغ فقط وبعد وجود object مطابق | لا | لا | anon: لا / auth: SELECT + INSERT | storage_path مولّد، والـ FK يربط report/assignment/tester |
| support_tickets | نعم | صاحب التذكرة ودور الطلب أو support staff | صاحب الحساب ودور requester المصرّح | status/priority لـ support staff فقط | لا | anon: لا / auth: SELECT + INSERT + UPDATE محدود | تحديث priority محمي أيضاً بسياسة RLS |
| support_ticket_messages | نعم | أطراف التذكرة وفق requester_role أو support | sender_id = auth.uid وطرف في التذكرة | لا | لا | anon: لا / auth: SELECT + INSERT | لا يمكن إرسال رسالة باسم مستخدم آخر |
| support_ticket_attachments | نعم | أطراف التذكرة | كاتب الرسالة نفسه ومسار uploader الخاص به | لا | لا | anon: لا / auth: SELECT + INSERT | metadata مربوط برسالة وتذكرة |
| support_ticket_events | نعم | أطراف التذكرة | trigger داخلي فقط | لا | لا | anon: لا / auth: SELECT | سجل أحداث غير قابل للكتابة المباشرة |
| developer_feedback_reviews | نعم | المطوّر المالك للـ feedback | المطوّر المالك | status/resolution_note/priority للمالك | لا | anon: لا / auth: SELECT + INSERT/UPDATE محدودان | timestamps وسجل الأحداث من triggers |
| developer_feedback_messages | نعم | المختبِر والمطوّر المرتبطان | sender_id = auth.uid وطرف في feedback | لا | لا | anon: لا / auth: SELECT + INSERT | لا يمكن إرسال رسالة باسم مستخدم آخر |
| developer_feedback_attachments | نعم | أطراف feedback | uploader هو المستخدم وطرف في feedback | لا | لا | anon: لا / auth: SELECT + INSERT | bucket خاص؛ لا يوجد حذف عميل |
| developer_feedback_events | نعم | أطراف feedback | لا مباشرة؛ trigger فقط بعد migration التدقيق | لا | لا | anon: لا / auth: SELECT | لا يمكن للعميل تزوير سجل الحدث |

### خلاصة المنح

- لم أجد منح جدول public لـ anon باستثناء SELECT على `plans`.
- لا توجد منح DELETE مباشرة لـ authenticated على جداول public المذكورة.
- Storage يختلف: `app-icons` له قراءة anon، و`avatars` و`app-icons` معرفان كـ public buckets؛ هذا يعني أن قراءة الملفات العامة ليست محمية بسرية RLS للقراءة.
- منح authenticated على `checkins` هو الاستثناء الأهم: INSERT على مستوى الجدول بدلاً من أعمدة إدخال محددة.
- منح UPDATE على `medical_exception_requests` أوسع من اللازم حتى وإن كانت RLS تقصره على admin.

---

## 3. النتائج مرتبة حسب الخطورة

### عالية H1 — المطوّر لا يستطيع قراءة الاسم والصورة للمختبِر المعيّن

**الحالة:** مؤكد وفق migrations على رأس الفرع؛ لم يُختبر على قاعدة حية.

- **الدليل:** `supabase/migrations/20261106172737_initial_core_schema.sql:378-382` تنشئ `profiles_select_self_or_admin` فقط: `id = auth.uid() OR private.is_admin()`. لم أجد migration لاحقة تضيف سياسة SELECT مرتبطة بمالك الاختبار. واجهة المطوّر تستعلم عن `profiles(id,display_name,avatar_url)` في `apps/web/src/modules/developer/pages/DeveloperTestersPage.tsx:21`، وتطلب علاقة tester:profiles في `apps/web/src/modules/developer/pages/DeveloperFeedbackDetailsPage.tsx:44`.
- **الأثر:** الاسم والصورة لن يظهرا للمطوّر رغم وجود assignment/feedback. وقد ترجع علاقة profile فارغة أو بيانات profile غير متاحة. هذا يعطل تجربة المطوّر ويشجع على حلول غير آمنة إذا لم يُعالج.
- **الحقول الحساسة:** لا يستطيع المطوّر قراءة `phone` أو `is_verified` أو `is_banned` أو `subscription_tier` من صف profiles الآخر وفق السياسة الحالية. البريد الإلكتروني موجود في Supabase Auth وليس عموداً في profiles، ولم أجد grant يتيح للمستخدمين قراءة auth.users.
- **سيناريو إعادة الإنتاج النظري:** أنشئ مطوّراً A ومختبِراً B، اربط B باختبار يملكه A، ثم نفّذ SELECT على profiles للـ id الخاص بـ B باستخدام جلسة A. السياسة الحالية لا تسمح بإرجاع صف B. كرر الاستعلام من صفحة Developer Testers ومن علاقة feedback.
- **الإصلاح المقترح — مواصفات فقط، دون تنفيذ:**
  1. إبقاء `profiles_select_self_or_admin` كما هي؛ لا تضف SELECT عاماً ولا تفتح الجدول لكل المطوّرين.
  2. إنشاء RPC ضيقة مثل `get_assigned_tester_public_profiles(test_ids uuid[])` تعيد فقط `user_id, display_name, avatar_url`.
  3. تكون الدالة SECURITY DEFINER مع `SET search_path = ''` وتأهيل كل أسماء schemas والجداول.
  4. ترفض caller غير المصادق، وتتحقق من وجود دور developer من `user_roles` وليس user_metadata.
  5. تربط كل test_id بـ `tests.developer_id = auth.uid()`، ثم تعيد فقط المختبِرين الموجودين فعلياً في assignments التابعة لهذه الاختبارات. تجاهل أي id مزوّر أو اختبار لا يملكه caller.
  6. لا تُرجع البريد أو الهاتف أو حقول التحقق أو الحظر أو الاشتراك أو interests أو bio.
  7. تسحب EXECUTE من PUBLIC وanon، وتمنحه authenticated فقط. لا تمنح SELECT عاماً على profiles.
- **اختبارات مطلوبة:** نجاح A في قراءة display_name/avatar لمختبِر معيّن لديه assignment في اختبار A؛ فشل A في قراءة مختبِر غير مرتبط؛ فشل A في قراءة مختبِر مرتبط باختبار B؛ فشل anon؛ فشل الوصول إلى phone/is_verified/is_banned/subscription_tier؛ واستمرار نجاح المستخدم في قراءة ملفه الشخصي.
- **الجهد:** متوسط.
- **حالة التأكد:** مؤكد من تعريف السياسة؛ النتيجة الحية تحتاج staging مكتمل.

### عالية — تزوير تواريخ check-ins وتجاوز دورة 14 يوماً

- **الدليل:** جدول checkins وقيود التاريخ في `supabase/migrations/20261106172737_initial_core_schema.sql:136-149`، منحة `GRANT SELECT, INSERT ON public.checkins` في السطر 444، وسياسة `checkins_insert_tester` في الأسطر 456 وما بعدها. شرط WITH CHECK يثبت أن `tester_id = auth.uid()` وأن assignment للمستخدم وحالته active، لكنه لا يفرض أن `checkin_date` هو تاريخ اليوم المحلي، ولا يفرض أن `created_at` وقت الخادم.
- **الأثر:** يستطيع مختبِر مصادق عليه إدخال عدة أيام تاريخية أو مستقبلية على assignment الخاص به. القيد الفريد `UNIQUE(assignment_id, checkin_date)` يمنع تكرار اليوم نفسه، لكنه لا يمنع اختيار 14 تاريخاً مختلفاً. ومنحة INSERT على مستوى الجدول تسمح أيضاً بإرسال أعمدة مثل created_at بدلاً من الاعتماد على DEFAULT.
- **سيناريو إعادة الإنتاج النظري:** على assignment نشط يملكه المستخدم، أرسل سجلات check-in متتابعة بتواريخ مختلفة بدلاً من الانتظار يوماً بعد يوم. لا يتطلب ذلك تزوير tester_id لشخص آخر.
- **الإصلاح المقترح:** إلغاء INSERT المباشر على الجدول، وتقديم RPC موثوقة تسجل تاريخ اليوم حسب `Africa/Algiers` ووقت الخادم فقط، وتتحقق من assignment النشط وحدود الدورة، وتستخدم قيداً فريداً أو قفلاً معاملياً لمنع السباق. اجعل التصحيح التاريخي مساراً إدارياً منفصلاً ومُدقّقاً.
- **اختبارات مطلوبة:** تاريخ اليوم مرة واحدة ينجح؛ التكرار في اليوم نفسه يفشل؛ تاريخ مستقبلي يفشل؛ تاريخ قديم يفشل للمستخدم العادي؛ created_at مخصص يفشل؛ assignment غير نشط يفشل؛ وtester_id لمستخدم آخر يفشل.
- **الجهد:** متوسط إلى مرتفع.
- **حالة التأكد:** مؤكد من المنحة والسياسة الحالية.

### عالية — is_banned لا يوقف عمليات الحساب

- **الدليل:** `is_banned` موجود في profiles في `supabase/migrations/20261106172737_initial_core_schema.sql:29`، والحقول الحساسة مستثناة من UPDATE المستخدم. لكن مراجعة policies وRPCs في migrations لم تكشف شرطاً عاماً يرفض المستخدم المحظور، ولا شرطاً في سياسة checkins أو feedback أو support messages يقرأ هذا الحقل.
- **الأثر:** يمكن لمسؤول تعيين is_banned=true، لكن ذلك وحده لا يمنع جلسة Auth قائمة من مواصلة العمليات التي تسمح بها RLS. هذا ليس بديلاً عن تعطيل حساب Auth أو فرض ban gate في طبقة البيانات.
- **سيناريو إعادة الإنتاج النظري:** مستخدم يحتفظ بجلسة صالحة بعد تعيين is_banned=true، ثم يحاول تنفيذ عملية مسموحة عادة مثل إرسال feedback أو check-in. لا يظهر في السياسات شرط يرفضها بسبب الحظر.
- **الإصلاح المقترح:** وضع سياسة مركزية موثوقة للحسابات المحظورة: إما مزامنة موثقة مع Supabase Auth ban state، أو helper آمن `private.is_active_user()` يفحص حالة الحظر ويستخدم في جميع سياسات الكتابة والـ RPCs. يجب أن يبقى مسار admin/support لإدارة الحظر متاحاً، مع منع المستخدم المحظور من تغيير حالة نفسه.
- **الجهد:** متوسط إلى مرتفع بسبب اتساع العمليات.
- **حالة التأكد:** مؤكد على مستوى migrations؛ إعدادات Auth البعيدة لم تُفحص.

### عالية — دالة مراجعة الاستثناء الطبي تشير إلى أعمدة غير موجودة

- **الدليل:** `supabase/migrations/20261110185336_optimize_cohort_rls_and_fk_indexes.sql:15-20` تنشئ `requested_days integer` و`reason text` ولا تنشئ `requested_dates`. لكن `supabase/migrations/20261111000100_medical_exception_decision_audit.sql:72-102,122-130,155-184` تستخدم `v_request.requested_dates` و`other_request.requested_dates`. migration اللاحقة الخاصة بالمنطقة الزمنية تعيد استخدام الحقل نفسه.
- **الأثر:** عند تنفيذ مسار review/approval قد تفشل الدالة عند محاولة قراءة حقل requested_dates، وبالتالي لا يتم تسجيل القرار أو تمديد assignment بالطريقة المتوقعة. اختبارات SQL الحالية لا تستدعي هذه الدالة فعلياً.
- **سيناريو إعادة الإنتاج النظري:** أنشئ طلب استثناء وفق مخطط الجدول الحالي ثم نفّذ RPC مراجعة الطلب كـ admin. المتوقع ظهور خطأ field/column غير موجود قبل إكمال المعاملة.
- **الإصلاح المقترح:** اختيار نموذج واحد متسق: إما requested_days فقط مع منطق تمديد بسيط، أو requested_dates كـ date[] مع migration تضيف العمود والقيود والفهارس وتتحقق من الأيام. لا تخلط النموذجين. أضف اختباراً فعلياً للموافقة والرفض، بما يشمل التكرار، التواريخ المستقبلية، check-ins الموجودة، الإشعار وسجل التدقيق.
- **الجهد:** متوسط.
- **حالة التأكد:** مؤكد من مقارنة تعريف الجدول بجسم الدالة؛ لم تُشغّل الدالة على قاعدة حية.

### عالية — مسار GitHub Actions اليدوي يشير إلى مشروع TestDZ القديم

- **الدليل:** `.github/workflows/apply-migration.yml:1-45` يصف نفسه بأنه تطبيق migration على development، لكنه يتحقق من `SUPABASE_PROJECT_REF` مقابل ref مشروع TestDZ القديم. وفي مرحلة apply ينفذ `supabase db push --remote --yes` بعد dry-run. كما أن `supabase/config.toml:1` يحمل project_id القديم.
- **الأثر:** تشغيل workflow من الفرع الذي يسمح به الشرط قد يدفع migrations إلى المشروع القديم. تسمية GitHub Environment باسم development لا تثبت أن الهدف فعلاً staging.
- **سيناريو إعادة الإنتاج النظري:** مستخدم لديه صلاحية workflow_dispatch يختار migration من الخيارات ويشغّل workflow على الفرع المسموح، مع secrets التي تشير إلى المشروع القديم. عند نجاح preconditions ينتقل job إلى db push.
- **الإصلاح المقترح:** تعطيل workflow أو تغيير project ref إلى staging المقصود بعد التحقق منه، ومنع أي deploy إلى المشروع القديم عبر branch/environment protection، وإضافة تحقق مزدوج من اسم المشروع والمنطقة والـ ref، واشتراط موافقة مستقلة قبل أي remote push. لا تعتمد على اسم environment وحده.
- **الجهد:** منخفض إلى متوسط.
- **حالة التأكد:** مؤكد من ملف workflow؛ لم يتم تشغيله.

### متوسطة — إمكانية إنشاء بلاغ ضد مستخدم لا علاقة له بالـ assignment

- **الدليل:** `supabase/migrations/20261109200107_harden_user_insert_policies.sql:135-156` تفرض أن reporter_id هو auth.uid وأن status=open. لكنها تسمح بأن يكون assignment_id NULL، وإذا كان غير NULL تتحقق أن reporter طرف في assignment؛ لا تتحقق من أن reported_user_id هو الطرف الآخر في assignment أو أنه مسموح لهذا النوع من البلاغات.
- **الأثر:** يمكن لمستخدم إنشاء بلاغ يشير إلى reported_user_id اعتباطي، ما قد يملأ طابور المراجعة ببلاغات كيدية أو يفتح باب إساءة استخدام آلية النزاعات.
- **الإصلاح المقترح:** ربط reported_user_id بطرف assignment المقابل، أو فرض assignment_id للبلاغات الموجهة ضد مستخدم، وتعريف أنواع البلاغات التي تسمح بهدف عام دون assignment.
- **الجهد:** منخفض إلى متوسط.
- **حالة التأكد:** مؤكد من شرط WITH CHECK.

### متوسطة — admin يستطيع تجاوز RPC مراجعة الاستثناء وسجل التدقيق

- **الدليل:** `20261110185336_optimize_cohort_rls_and_fk_indexes.sql:37-55` تمنح authenticated صلاحية SELECT, INSERT, UPDATE على medical_exception_requests، بينما سياسة UPDATE تقصر الصفوف على admin. دالة `private.review_medical_exception` تسجل audit_logs وترسل notification في `20261111000100_medical_exception_decision_audit.sql`.
- **الأثر:** admin يستطيع تحديث صف الطلب مباشرة دون المرور عبر RPC؛ وقد يغير status/reviewed_by/reviewed_at دون منطق تمديد assignment أو سجل التدقيق أو الإشعار.
- **الإصلاح المقترح:** سحب UPDATE المباشر من authenticated، وإبقاء الكتابة داخل RPC SECURITY DEFINER واحدة تتحقق من admin وتنفذ القرار والتدقيق والإشعار في معاملة واحدة. لا تمنح admin مساراً جانبياً غير مدقق.
- **الجهد:** منخفض.
- **حالة التأكد:** مؤكد من GRANT وRLS وRPC.

### متوسطة — ملفات Storage يتيمة، لا حصص تخزين ولا فحص محتوى

- **الدليل:** `apps/web/src/modules/developer/pages/DeveloperFeedbackDetailsPage.tsx:81` يستخدم signed URL لمدة 300 ثانية لفتح المرفق. مسارات upload في هذا التدفق ترفع الملف إلى Storage ثم تحفظ metadata. إذا فشل حفظ metadata بعد نجاح الرفع فلا يظهر مسار cleanup تعويضي. `supabase/migrations/20261109203933_add_private_report_evidence.sql:49-95,184-220` تجعل report evidence خاصاً وتربط metadata بعلاقات report/assignment.
- **الأثر:** ملفات يتيمة تستهلك التخزين؛ ويمكن للمستخدم المصرح له رفع عدد كبير من الملفات ضمن حدود الحجم لكل ملف. MIME allowlist لا يعادل فحصاً فعلياً لمحتوى الملف ولا يكشف كل الملفات الخبيثة.
- **الإصلاح المقترح:** عملية رفع موحدة مع cleanup عند فشل metadata، مهمة دورية لاكتشاف orphan objects، quota لكل مستخدم/تذكرة/feedback، وفحص MIME من bytes أو quarantine قبل إتاحة التنزيل. حافظ على private buckets وروابط signed قصيرة العمر.
- **الجهد:** متوسط.
- **حالة التأكد:** M4 مؤكد في تدفق feedback؛ غياب quota/scanning مؤكد في الملفات التي راجعتها، وقد توجد حماية خارج المستودع لم أتمكن من رؤيتها.

### متوسطة — حقوق التصدير والحذف غير مكتملة

- **الدليل:** `apps/web/src/modules/tester/pages/PrivacyDataManagementPage.tsx:104-169` يسجل سجل طلبات التصدير داخل user_metadata، ويصدّر subset من profile/assignments/checkins/feedback/notifications/points_ledger. دالة `showDeleteInfo` تفتح نافذة معلومات فقط؛ لم أجد استدعاء حذف حساب أو RPC لمعالجة طلب الحذف.
- **الأثر:** لا يمثل التصدير الحالي نسخة كاملة من كل بيانات المستخدم؛ لا يغطي بوضوح تذاكر الدعم ورسائلها ومرفقاتها، سجلات الأمان والأجهزة، الاستثناءات الطبية، وكل بيانات دور المطوّر. حذف الحساب ليس عملية مكتملة مثبتة. بعض علاقات FK تستخدم ON DELETE RESTRICT، لذا حذف auth user مباشرة قد يفشل أو يترك عملية حذف غير مكتملة.
- **الإصلاح المقترح:** بناء export server-side شامل حسب الدور مع manifest يوضح البيانات المستثناة، وإنشاء deletion/anonymization workflow مدقق مع سياسة retention وlegal hold، وعدم الادعاء بأن الطلب اكتمل لمجرد تسجيله في user_metadata.
- **الجهد:** مرتفع.
- **حالة التأكد:** عدم وجود تنفيذ حذف في المصدر الذي راجعته مؤكد؛ نطاق اكتمال كل بيانات التصدير يحتاج مراجعة إضافية.

### متوسطة — لا توجد حدود إساءة استخدام واضحة للرسائل والطلبات

- **الدليل:** جداول support tickets/messages وdeveloper feedback messages تسمح بالكتابة للمشاركين مع قيود طول/ملكية، لكن لم أجد rate-limit أو quota على عدد الرسائل/التذاكر لكل مستخدم. Auth rate limits البعيدة غير متاحة للفحص.
- **الأثر:** مستخدم مصادق عليه يمكنه نظرياً إغراق الدعم أو محادثات feedback بطلبات ورسائل متتابعة. حدود حجم الملف لكل object لا تمنع استنزاف التخزين بتكرار الرفع.
- **الإصلاح المقترح:** حدود server-side لكل مستخدم ولكل ticket/feedback، throttling حسب IP/الحساب، cooldown، حد يومي للتذاكر والرسائل والمرفقات، ومراقبة إساءة الاستخدام مع مسار تصعيد.
- **الجهد:** متوسط.
- **حالة التأكد:** غياب حدود في migrations التي راجعتها مؤكد؛ قد توجد limits في إعدادات خارجية لم أتمكن من رؤيتها.

### منخفضة — مسودات محلية تبقى على الجهاز بعد تسجيل الخروج

- **الدليل:** `apps/web/src/modules/tester/pages/AssignmentSubmissionPage.tsx:121-132` يستخدم localStorage لحفظ draft بمفتاح يتضمن user id وassignment id.
- **الأثر:** المفتاح المميز يقلل احتمال عرض مسودة مستخدم آخر عبر واجهة التطبيق، لكنه لا يحذف المحتوى من جهاز مشترك بعد signOut، ويمكن لمن لديه وصول محلي للمتصفح قراءة التخزين.
- **الإصلاح المقترح:** حذف المسودات عند طلب حذف الحساب، وإضافة زر clear drafts وسياسة انتهاء صلاحية، وتوضيح أن بيانات المسودة محفوظة محلياً.
- **الجهد:** منخفض.
- **حالة التأكد:** مؤكد.

### منخفضة — روابط ومصادر صور خارجية تحتاج allowlist

- **الدليل:** تظهر روابط خارجية من `play_store_url` و`evidence_url` في صفحات المختبِر، وتظهر avatar_url كـ img src. لم أجد dangerouslySetInnerHTML أو innerHTML أو eval أو new Function في مسح ملفات TS/TSX الـ96.
- **الأثر:** لم أثبت XSS. لكن URL غير المقيّد قد يسمح بروابط تصيّد أو tracking، ويجب ألا يعتمد الأمان على أن الرابط "يبدو" صالحاً.
- **الإصلاح المقترح:** قبول https فقط، والتحقق من نطاق Google Play لروابط المتجر، ورفض data:/javascript:/file: وأي scheme غير متوقع، مع rel="noopener noreferrer" لكل الروابط الخارجية.
- **الجهد:** منخفض.
- **حالة التأكد:** وجود الروابط الديناميكية مؤكد؛ استغلال XSS غير مؤكد ولم يثبت.

---

## 4. نتيجة التحقق من H1 — منفصلة

**النتيجة: H1 مؤكد من migrations الحالية.**

| السؤال | النتيجة |
|---|---|
| سياسة SELECT الفعلية على profiles؟ | self أو admin فقط؛ لم أجد policy لاحقة تضيف developer participant access |
| مطوّر يقرأ display_name لمختبِر مرتبط؟ | لا، ليس عبر profiles مباشرة |
| مطوّر يقرأ avatar_url؟ | لا، ليس عبر profiles مباشرة؛ وجود bucket عام لا يكشف صف profile ولا مسار الصورة تلقائياً |
| مطوّر يقرأ phone؟ | لا |
| مطوّر يقرأ is_verified / is_banned / subscription_tier؟ | لا |
| مطوّر يقرأ البريد؟ | لا؛ البريد ضمن Auth users وليس عمود profiles، ولا grant للمستخدمين عليه |
| هل نفتح SELECT على profiles؟ | **لا. هذا إصلاح غير مقبول أمنياً.** |

التصميم الموصى به هو RPC محدودة الحقول ومحدودة بالعلاقات الفعلية بين developer → tests → assignments → tester. لا تقبل user_id list حرة دون التحقق من كل ارتباط، ولا تعرض البريد أو الهاتف أو حقول الحالة. يجب أن يبقى direct SELECT على profiles محصوراً بالمالك وadmin.

---

## 5. RLS والصلاحيات: الأدوار والتصعيد

- `user_roles` لا يملك المستخدم grants للـ INSERT أو UPDATE أو DELETE. قراءة الأدوار مقيدة بالمستخدم نفسه أو admin.
- `complete_onboarding` يقبل فقط tester وdeveloper، ويحد عدد الأدوار، ولا يقبل admin أو support. الدالة تستخدم auth.uid وتعمل على صف المستخدم نفسه. هذا يمنع ترقية النفس إلى admin عبر onboarding.
- `user_metadata.account_type` يظهر في Onboarding/Interests كقيمة افتراضية للواجهة فقط؛ الحفظ الفعلي يمر عبر RPC تتحقق من الأدوار المسموحة. لم أجد اعتماداً عليه في قرار RLS أو SECURITY DEFINER.
- الحساب متعدد الأدوار مقصود: tester + developer مسموح، وnotifications تفصل recipient_role. RoleGuard يسمح للأدوار المناسبة في الواجهة، لكن حماية البيانات الفعلية تأتي من RLS.
- admin يتجاوز بعض قيود الوصول عبر `private.is_admin()`; هذا متوقع ويجب أن يبقى حساباً محدوداً ومراقباً.
- **المشكلة المتبقية:** is_banned ليس جزءاً من بوابة الصلاحية؛ لا يكفي أن تكون حقول الحظر غير قابلة لتعديل المستخدم.

### هل يستطيع المستخدم تزوير user_id/tester_id/developer_id؟

في غالبية مسارات الإدخال التي راجعتها، لا: checkins/feedback/medical requests تربط tester_id بـ auth.uid؛ support messages تربط sender_id؛ developer feedback يربط developer_id بالمالك؛ reports تربط reporter_id؛ tests تربط developer_id بمالك app؛ وuser_roles لا يملك grants كتابة.

الاستثناءات/التحفظات:
- checkins يسمح للمستخدم بكتابة سجل لنفسه بتاريخ مصطنع، لا باسم شخص آخر.
- reports يسمح بـ reported_user_id غير مربوط بوضوح بالـ assignment، كما هو موضح أعلاه.
- يجب إضافة اختبارات runtime لجميع مسارات INSERT وليس الاكتفاء بمراجعة شروط SQL.

---

## 6. RPC وSECURITY DEFINER

راجعت الدوال ذات SECURITY DEFINER الظاهرة في migrations، ومن أبرزها:

| الدالة | التحقق/الملكية | search_path | EXECUTE | الملاحظة |
|---|---|---|---|---|
| private.is_admin | تتحقق من user_roles للمستخدم الحالي عبر auth.uid | فارغ | authenticated فقط | helper منطقي؛ لا يعيد بيانات |
| private.handle_new_auth_user | trigger إنشاء الحساب | فارغ | trigger فقط | لا تستدعى من العميل |
| private.sync_auth_user_profile | trigger مزامنة الملف | فارغ | trigger فقط | لا تستدعى من العميل |
| private.complete_onboarding | auth.uid، ويقبل tester/developer فقط | فارغ | authenticated | لا يسمح admin/support |
| private.create_app_impl | auth.uid + دور developer/admin + حدود الخطة | فارغ | authenticated | يتحقق من الملكية وحدود التطبيق |
| private.update_app_impl | auth.uid وdeveloper_id للصف | فارغ | authenticated | يحدّث تطبيق المالك فقط |
| private.archive_app_impl | auth.uid وdeveloper_id للصف | فارغ | authenticated | ملكية الصف |
| private.restore_app_impl | auth.uid وdeveloper_id + حد الخطة | فارغ | authenticated | ملكية وقفل حد الاستخدام |
| private.cohorts_sync_is_active | trigger | فارغ | trigger فقط | تحديث تابع لحالة cohort |
| private.cohort_tests_capacity | trigger | فارغ | trigger فقط | حماية السعة |
| private.cohorts_check_capacity_update | trigger | فارغ | trigger فقط | حماية انتقال الحالة |
| private.assignments_prevent_self_test | trigger | فارغ | trigger فقط | يمنع self-testing |
| public.create_cohort | admin check | فارغ | authenticated | يرفض غير admin |
| public.add_cohort_test | admin check | فارغ | authenticated | يرفض غير admin |
| public.remove_cohort_test | admin check | فارغ | authenticated | يرفض غير admin |
| private.is_report_participant | يتحقق من auth.uid ضمن reporter/reported user | فارغ | authenticated | helper لتحديد المشاركة |
| private.can_upload_report_evidence | auth.uid + report/assignment/test ownership + active/open | فارغ | authenticated | helper Storage ضيق |
| private.can_read_report_evidence | auth.uid أو مالك الاختبار أو admin | فارغ | authenticated | لا يمنح Support الوصول |
| private.review_medical_exception | auth.uid + admin + locks على الطلب والـ assignment | pg_catalog, public, private | authenticated | search_path مثبت لكنه أوسع من الأفضل؛ والأهم عدم تطابق requested_dates |
| public.get_my_security_activity | يفلتر سجلات Auth على auth.uid | فارغ | authenticated | بيانات المستخدم نفسه |
| public.get_my_active_sessions | يفلتر sessions على auth.uid | فارغ | authenticated | بيانات الجلسات الخاصة بالمستخدم |
| private.is_support_staff | role lookup للمستخدم الحالي | فارغ | authenticated | helper |
| private.audit_support_ticket_changes | trigger ويفحص صلاحية الدعم لتغيير الحالة/الأولوية | فارغ | trigger فقط | سجل تغييرات الدعم |
| private.has_role | يقرأ دور auth.uid فقط | فارغ | authenticated | helper |
| private.log_developer_feedback_review_changes | trigger audit | فارغ | trigger فقط | لا يمنح كتابة audit مباشرة |
| private.log_developer_feedback_message_event | trigger audit | فارغ | trigger فقط | يكتب الحدث عند الرسالة |
| private.log_developer_feedback_attachment_event | trigger audit | فارغ | trigger فقط | يكتب الحدث عند المرفق |
| private.cohort_tests_validate_is_active_update | trigger تحقق الحالة | فارغ | trigger فقط | التقييد الفعلي أيضاً عبر RLS ومنحة عمود is_active |

لم أجد EXECUTE ممنوحاً لـ anon على هذه الدوال. الدوال التي تقبل استدعاء authenticated إما تتحقق من auth.uid/الملكية/الدور، أو هي helpers محدودة، أو trigger functions مع EXECUTE مسحوب من المستخدمين. `public.review_medical_exception` wrapper يعمل بصلاحية invoker ويستدعي الدالة الداخلية المحمية.

**ملاحظات مهمة:**
- الدوال التي تنفذ عبر trigger لا تحتاج دائماً auth.uid داخل جسمها؛ يجب أن تبقى غير قابلة للاستدعاء المباشر وأن تظل مرتبطة بجداول ذات grants وRLS ضيقة.
- `private.review_medical_exception` يستخدم search_path ثابتاً لكنه يضم public وprivate. الأفضل اعتماد search_path فارغ وتأهيل كل الأسماء.
- لم أجد دالة award_points أو spend/debit wallet أو withdrawal أو payment webhook في المستودع.
- `get_active_subscription` وواجهات create/update app العامة wrappers ليست SECURITY DEFINER في الشكل النهائي الذي راجعته.

---

## 7. سلامة البيانات والنزاهة المالية

### Ledger / Wallet

- `wallets` و`points_ledger` قابلان للقراءة من المالك/admin فقط؛ لا توجد grants كتابة للمستخدم.
- `points_ledger` يحتوي idempotency_key فريداً، وmigration `20261106173022_master_blueprint_alignment.sql:145-159` تضيف trigger يمنع UPDATE/DELETE. هذا جيد ويجب الحفاظ عليه.
- رصيد `earned_points` و`purchased_credits` مخزّن في wallets، وليس مشتقاً تلقائياً من ledger. لم أجد trigger يضمن تطابق الرصيد مع مجموع ledger.
- لم أجد دالة award_points؛ لذلك لا توجد حالياً آلية عميل مثبتة تمنح النقاط، ولا يمكنني إثبات سلامة race/idempotency لعملية منح مستقبلية.
- لا توجد عملية withdrawal أو spend client-side يمكن اختبار double-spend عليها حالياً.

### Feedback وcheck-ins

- **M1 duplicate feedback:** تم علاجه في سلسلة migrations بإنشاء `feedback_one_per_assignment` UNIQUE في `20261107000200_assignments_feedback_constraints.sql:91`. هذا أقوى من منع التكرار في الواجهة فقط. يجب الاحتفاظ بالاختبار وإضافته إلى runtime regression.
- check-ins لها UNIQUE على assignment/date، لكنها لا تمنع إدخال تواريخ مصطنعة؛ راجع النتيجة عالية الخطورة أعلاه.
- لا يوجد في المستودع RPC موثوقة لتسجيل check-in مع تاريخ ووقت خادم، ولا اختبارات تحقق 14 يوماً بالتتابع.

### الاشتراكات والمدفوعات والسحب

- `platform_config` يزرع `payments.enabled=false` في `20261106173022_master_blueprint_alignment.sql:166-172`.
- subscriptions/payments/refunds للقراءة فقط من authenticated، ولا توجد دوال دفع/سحب أو Edge Functions في شجرة المستودع التي راجعتها.
- صفحة WithdrawalRequestPage تصف النموذج بأنه preview فقط ولا تحفظ الطلب، في `apps/web/src/modules/tester/pages/WithdrawalRequestPage.tsx:115,139-140`.
- لذلك التعطيل ليس مجرد إخفاء زر: لا توجد كتابة عميل مباشرة لجداول الدفع/الاشتراك/السحب في المخطط الحالي. لكن لا أستطيع تأكيد عدم وجود تكامل خارجي أو إعداد بعيد غير موجود في المستودع.
- قبل التفعيل مستقبلاً: webhook موقّع مع تحقق timestamp/replay، idempotency key فريد لكل provider event، تحقق server-to-server من حالة الدفع، دفتر مالي append-only، تسوية دورية، refund/reversal entries، قفل صف الرصيد أو ledger-based accounting، ومراجعة reconciliation مستقلة. لا تفعّل السحب قبل reservation/settlement/KYC وسياسة استرداد واضحة.

---

## 8. Storage

| Bucket | عام/خاص | الحجم وMIME وفق migrations | القراءة/الكتابة | المسار والملاحظات |
|---|---|---|---|---|
| avatars | عام | 2 MiB؛ JPEG/PNG/WebP | public URL؛ الكتابة/التعديل/الحذف في مجلد صاحب auth.uid | المسار يبدأ user_id؛ لا تستخدمه لمستندات حساسة |
| app-icons | عام | 512000 bytes؛ PNG/JPEG | SELECT anon/auth؛ الكتابة/التعديل/الحذف لصاحب المجلد | المسار user_id/app_id/icon؛ public مقصود |
| test-evidence | خاص | 10 MiB؛ PNG/JPEG/WebP/TXT/PDF/ZIP | insert عبر helper يربط test/tester/report؛ select للمبلّغ أو مالك الاختبار أو admin | test_id/tester_id/report_id/file_id؛ UUIDs ليست بديلاً عن التحقق |
| support-attachments | خاص | 10 MiB؛ MIME allowlist في migration | ticket owner/requester-role أو support staff وفق السياسات؛ روابط signed في الواجهة | ticket_id/uploader_id/...؛ upload يتطلب تذكرة غير مغلقة |
| developer-feedback-attachments | خاص | 10 MiB؛ MIME allowlist | أطراف feedback فقط؛ signed URL في الواجهة لمدة 300 ثانية | feedback_id/uploader_id/...؛ لا يوجد delete policy عميل |

**نقاط القوة:** buckets الخاصة ليست عامة، ومسارات report evidence تتحقق من العلاقات الفعلية في قاعدة البيانات، لا من اسم المجلد وحده. صفحات المرفقات تستخدم signed URLs قصيرة (60 ثانية لتذكرة الدعم و300 ثانية لمرفق feedback).

**النواقص:** لا توجد سياسة حذف عميل للملفات الخاصة؛ لا توجد quota per-user أو عدد ملفات؛ لا يوجد فحص malware/content ظاهر في المستودع؛ رفع الملف ثم فشل إدخال metadata قد يترك object يتيماً. Public avatar/app-icon تعني أن أي شخص يعرف URL يستطيع تنزيل الصورة، وهذا مقبول فقط إذا كانت الصور عامة فعلاً وبموافقة المستخدم.

---

## 9. المصادقة والجلسات

### ما وجدته في المصدر

- `supabase/config.toml` يفعّل signup وemail confirmations وdouble_confirm_changes وsecure_password_change للبيئة المحلية.
- `site_url` وredirect URLs في الملف محصورة في localhost. يجب ضبط روابط production وpreview صراحة في Supabase Auth dashboard.
- واجهة reset password تعرض رسالة عامة: إذا كان البريد مسجلاً فستصل رسالة؛ هذا يقلل user enumeration في هذا المسار.
- callback يوجّه إلى مسارات داخلية ثابتة، ولم أجد redirect parameter يتحكم به المستخدم. OAuth وreset يمرران `window.location.origin` إلى Supabase، ويجب أن يقيده allowlist البعيد.
- Supabase client يستخدم persistSession وautoRefreshToken وdetectSessionInUrl؛ الجلسة تحفظ محلياً حسب إعداد SDK.
- تحقق كلمة المرور في الواجهة يطلب 8 أحرف وحرفاً ورقماً، لكن هذا ليس بديلاً عن Password Policy على الخادم.

### ما لم أستطع تأكيده — تحقق يدوي إلزامي

1. Auth > Providers: هل email confirmation مفعل في المشروع البعيد؟
2. Password policy: الحد الأدنى، كلمات المرور المسرّبة، القوة، وتغيير كلمة المرور.
3. Rate limits: signup، token، OTP، reset، email/SMS؛ لا توجد قيم rate-limit صريحة في config المحلي.
4. Redirect allowlist: production domain وكل preview domain المطلوب فقط، دون wildcard واسع.
5. SMTP: SPF/DKIM/DMARC، معدل الإرسال، وحماية reset/verification من الإساءة.
6. Session lifetime/refresh token rotation، إبطال الجلسات، وMFA لحسابات admin/support.
7. جرّب reset/signup لحساب موجود وغير موجود، وتحقق من عدم اختلاف الرسائل أو التوقيت بشكل يكشف البريد.
8. تحقق من OAuth callback على production ورفض أي redirect خارج النطاق المسموح.

---

## 10. الواجهة وPWA والأسرار والترويسات

### XSS والروابط

- مسح ملفات TS/TSX الـ96 لم يجد `dangerouslySetInnerHTML` أو `innerHTML` أو `eval` أو `new Function` أو `document.write`.
- محتوى feedback والرسائل المعروض عبر JSX text nodes يستفيد من escaping الافتراضي في React.
- روابط `play_store_url` و`evidence_url` ومصادر الصور تحتاج allowlist للـ schemes/domains. لم أثبت XSS من هذه الروابط.
- فتح signed URLs في صفحات المرفقات يستخدم noopener/noreferrer.

### Service Worker والتخزين

- `apps/web/vite.config.ts` يستخدم VitePWA مع autoUpdate، ولم أجد إعداد runtimeCaching مخصصاً لاستجابات API أو بيانات المستخدم؛ الإعداد الظاهر يهيئ manifest وPWA assets.
- لا أملك دليلاً من المصدر على أن API responses أو بيانات الحساب تُخزّن في Cache Storage.
- drafts تحفظ في localStorage بمفتاح user_id + assignment_id؛ لا يظهر مسح تلقائي لها عند signOut. يلزم اختبار تبديل المستخدم على الجهاز نفسه ومسح cache/storage بعد الخروج.
- IdentityProvider يمسح roles عند تغيّر الجلسة، وبعض الصفحات تمسح حالتها عند signOut؛ لكن يلزم اختبار end-to-end لكل الصفحات التي تحمل بيانات حساسة.

### الأسرار

- Supabase client في `apps/web/src/lib/supabase.ts` يستخدم VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY. publishable key مخصص للمتصفح وليس service_role.
- سكربت Storage regression يقرأ `SUPABASE_SERVICE_ROLE_KEY` من environment لا من قيمة ثابتة في المصدر، ويستخدمه لإنشاء fixtures والتنظيف؛ طلبات الاختبار الفعلية تستخدم access tokens للمستخدمين.
- لم أجد قيمة service_role أو private key حرفية في الملفات التي راجعتها. **لم أجرِ فحصاً تاريخياً شاملاً لكل commits، لذلك لا أضمن خلو تاريخ Git من أسرار.** لا أنسخ أي قيمة مفتاح في هذا التقرير.

### ترويسات الأمان

- `apps/web/vercel.json` يحتوي rewrite فقط؛ لم أجد CSP أو X-Frame-Options أو Referrer-Policy أو Permissions-Policy أو HSTS في الملف.
- قد تكون هناك ترويسات من إعدادات Vercel Dashboard أو CDN خارج المستودع؛ يجب فحص response headers على production وpreview فعلياً.
- التوصية: CSP صارمة مع nonce/hash حسب البناء، frame-ancestors 'none' أو سياسة embedding معلومة، Referrer-Policy strict-origin-when-cross-origin، nosniff، Permissions-Policy محددة، وHSTS بعد التأكد من HTTPS والنطاقات الفرعية.

### npm audit

لم يتم تشغيل npm audit في هذه المراجعة. CI الحالي ينفذ npm install وtypecheck وbuild ولا ينفذ npm audit أو lint. يجب تشغيل `npm audit --omit=dev` و`npm audit` على checkout موثوق، ثم تصنيف كل نتيجة بحسب dependency tree: runtime dependency في production مقابل build/test tooling. لا أستنتج وجود ثغرات حالية من تقرير سابق أو من رقم قديم.

---

## 11. الخصوصية والبيانات الشخصية

### فئات البيانات الظاهرة في المخطط/المصدر

- **الهوية:** البريد في Supabase Auth؛ display_name وavatar_url وbio وlocale وphone وinterests في profiles.
- **الحساب والصلاحيات:** user_roles، is_verified، is_banned، subscription_tier.
- **النشاط:** assignments، checkins، feedback، play_opt_in_events، notifications، referrals، feature_usage.
- **الأمان والجهاز:** devices fingerprint_hash؛ دوال تعرض IP وuser-agent ووقت الجلسات من جداول Auth.
- **الدعم والمحادثات:** subject/description ورسائل ومرفقات support tickets، ورسائل ومرفقات developer feedback.
- **البلاغات والنزاعات:** reporter/reported user، report description، dispute references.
- **الاستثناء الطبي:** medical_exception_requests.reason نص حر مع reviewer notes. لم أجد bucket أو جدولاً مخصصاً لمستند طبي في migrations التي راجعتها؛ هذا لا يمنع المستخدم من كتابة معلومات صحية حساسة في حقل reason أو رفعها خطأً ضمن مرفقات عامة.
- **المال:** payments/refunds/subscriptions موجودة في المخطط، لكن لا توجد بيانات سحب بنكي/BaridiMob محفوظة في قاعدة البيانات الحالية التي راجعتها. حقول صفحة السحب محلية preview فقط.

### من يستطيع القراءة؟

- صاحب الحساب: بياناته الشخصية وسجلاته وفق RLS.
- المطوّر: بيانات الاختبار والـ feedback والـ check-ins المتعلقة باختباراته؛ لكنه لا يستطيع حالياً قراءة صف profile للمختبِر، وهي H1.
- Support: تذاكر الدعم ورسائلها ومرفقاتها وفق دور support.
- Admin: وصول واسع مقصود إلى جداول الإدارة والتدقيق والبلاغات.
- ملفات report evidence: المبلّغ، المطوّر المالك للاختبار، وadmin؛ Support ليس ضمن helper الخاص بها.

### الاستثناء الطبي

- reason نص حر من 10 إلى 2000 حرف، وهو قد يحتوي بيانات صحية حساسة.
- الوصول إلى الطلب في RLS محصور بصاحب الطلب وadmin؛ هذا جيد من ناحية النطاق.
- لم أجد سياسة retention أو حذف قصير الأجل أو تصنيف/تشفير منفصل لحقل السبب، ولم أجد مستندات طبية منفصلة أو workflow لإتلافها.
- أوصي بجمع أقل قدر ممكن: لا تطلب تشخيصاً أو تفاصيل طبية غير لازمة؛ اجعل سبب الطلب مختصراً، وافصل المستند الطبي إن أصبح ضرورياً في bucket خاص محدود، مع صلاحية وصول ضيقة ومدة احتفاظ محددة وتسجيل كل قراءة.

### حقوق المستخدم والاحتفاظ

- تصدير البيانات الحالي جزئي وليس export شاملاً لكل جداول/ملفات المستخدم.
- لا يوجد تنفيذ حذف حساب مثبت في الواجهة أو RPCs التي راجعتها.
- لم أجد retention schedule أو jobs لحذف/إخفاء بيانات المرفقات والطلبات القديمة.
- يلزم رأي قانوني متخصص قبل التجربة/الإطلاق بشأن نقل البيانات خارج الجزائر إلى منطقة Supabase في أوروبا، وتطبيق القانون 18-07 وتعديلاته، وأساس المعالجة والموافقة والاحتفاظ وحقوق أصحاب البيانات. هذا التقرير لا يقدم فتوى قانونية.

---

## 12. إساءة الاستخدام (Abuse)

| السيناريو | الوضع الحالي وفق المصدر | المطلوب |
|---|---|---|
| حسابات وهمية متعددة | signup موجود؛ لم أجد ربطاً واضحاً بين الحسابات أو حدوداً تطبيقية في migrations | rate limits، تحقق بريد، إشارات device/IP متناسبة، مراجعة يدوية دون جمع مفرط |
| تزوير check-ins | ممكن بتواريخ يحددها المستخدم؛ High | RPC server date/time وقفل/unique واختبارات |
| تكرار feedback | UNIQUE assignment يمنع التكرار | اختبار runtime لسباق طلبين متزامنين |
| تقييمات/feedback كيدية | لا توجد آلية معدل أو جودة شاملة مثبتة | حدود إرسال، moderation، لا تكافئ rating إيجابياً |
| رسائل دعم مزعجة | لا تظهر quotas/rate limits | per-user/per-ticket limits وcooldown |
| رسائل feedback مزعجة | المشاركون فقط يستطيعون الكتابة، لكن لا تظهر limits للعدد | throttling ومكافحة spam |
| ملفات خبيثة | MIME/size allowlist، لكن لا يظهر malware scanning أو content inspection | quarantine/scan، quotas، cleanup |
| استنزاف التخزين | حد لكل ملف فقط، لا quota لكل مستخدم | quota وحصص وعدد ملفات |
| إغراق الإشعارات | لا توجد grants عميل لإدخال notifications؛ هذا جيد | الحفاظ على server-only writes وإضافة limits لأي مستقبل event producer |
| مستخدم محظور | is_banned غير مفروض في السياسات | ban gate موحد في RLS/RPC/Auth |
| سرقة الجلسة | SDK يحفظ الجلسة محلياً؛ remote session settings غير مفحوصة | تدوير/إبطال الجلسات وMFA للأدوار الحساسة |

---

## 13. اختبارات أمان يجب إضافتها إلى CI

### RLS وبيانات المستخدم

- Profiles: owner يرى صفه؛ مستخدم آخر لا يرى صفه؛ developer لا يرى profiles للمختبرين عبر SELECT المباشر؛ admin فقط يرى الجميع.
- H1 RPC: اختبارات positive/negative كما في القسم 3.
- user_roles: محاولة INSERT/UPDATE/DELETE مباشرة تفشل؛ onboarding لا يقبل admin/support؛ metadata مزورة لا تمنح دوراً.
- is_banned: كل write/RPC حساس يرفض المستخدم المحظور، بينما admin يستطيع مراجعة الحساب وإلغاء الحظر.
- جدول كامل: لكل جدول اختبارات مستخدم A ومستخدم B وdeveloper وtester وsupport وadmin وanon، بما في ذلك SELECT وINSERT وUPDATE وDELETE.
- اختبارات spoofing لكل user_id/tester_id/developer_id/sender_id/uploader_id/reporter_id.
- reports: رفض reported_user_id غير المرتبط بالـ assignment وفق نوع البلاغ.
- notifications: لا يمكن تغيير recipient_role أو user_id أو إدخال notification من العميل.

### Check-ins / Feedback / Ledger

- check-in بتاريخ اليوم فقط؛ منع المستقبل والماضي؛ منع تغيير created_at؛ منع assignment غير نشط؛ منع tester_id مزور؛ منع double submit بالتزامن.
- اختبار 14 يوماً: لا يمكن بلوغ 14 يوماً في جلسة واحدة أو بتواريخ مختارة.
- feedback: طلبان متزامنان لنفس assignment؛ يجب أن ينجح واحد فقط.
- points_ledger: UPDATE/DELETE يفشلان للمستخدم وadmin العادي؛ الإدخال مستقبلاً عبر وظيفة خادمية فقط.
- إذا أضيف award_points: اختبارات idempotency وrace condition وwallet lock والتطابق بين ledger والرصيد.

### RPC

- enumerate كل دوال SECURITY DEFINER من pg_proc مع prosecdef/proconfig/proacl.
- تأكد أن search_path مضبوط وأن EXECUTE غير ممنوح لـ PUBLIC/anon.
- اختبر استدعاء كل RPC كمستخدم غير مصادق، tester، developer، support، admin.
- اختبر ownership boundary عند تمرير IDs تخص مستخدمين آخرين.
- اختبر medical approval/rejection فعلياً بعد إصلاح schema mismatch، مع audit/notification/extension في معاملة واحدة.

### Storage

- bucket public/private كما هو مقصود.
- cross-user read/write لكل bucket.
- path spoofing لمجلد مستخدم آخر أو ticket/feedback/report آخر.
- رفض MIME غير مسموح والحجم الزائد.
- التحقق من أن signed URLs تنتهي فعلاً عند TTL.
- اختبار فشل metadata بعد نجاح upload والتأكد من cleanup.
- اختبار delete/retention والـ orphan sweeper.
- quota لكل مستخدم.

### Auth وPWA والواجهة

- reset/signup enumeration، redirect allowlist، OAuth callback، expired/replayed links.
- session switch A→B في نفس المتصفح مع التأكد من عدم ظهور state/cache للمستخدم A.
- signOut يمسح البيانات الحساسة من الذاكرة والمسودات حسب السياسة.
- فحص Cache Storage وعدم تخزين API/auth responses.
- XSS payloads في feedback/messages/display names/URLs كاختبارات آمنة غير تنفيذية.
- security headers على preview وproduction.
- npm audit + lint + dependency review ضمن CI.

---

## 14. ما هو جيد ويجب الحفاظ عليه

1. deny-by-default grants وRLS على جداول التطبيق التي تنشئها migrations.
2. عدم منح anon SELECT عاماً على profiles أو بيانات المستخدمين.
3. عدم منح العميل كتابة مباشرة على user_roles أو wallets أو points_ledger أو payments/subscriptions/refunds.
4. onboarding RPC يقيّد الأدوار إلى tester/developer ولا يسمح بتعيين admin/support.
5. حقول profile الحساسة ليست ضمن UPDATE grants للمستخدم.
6. feedback له UNIQUE index على assignment، ما يعالج M1 على مستوى قاعدة البيانات.
7. points_ledger وaudit_logs محميان من UPDATE/DELETE عبر trigger.
8. developer feedback events وsupport ticket events تُكتب عبر triggers ولا يستطيع العميل تزويرها مباشرة.
9. Storage الخاص يربط الوصول بعلاقات ticket/feedback/report وليس فقط بمسار قابل للتخمين.
10. signed URLs للمرفقات قصيرة العمر في الواجهة.
11. support tickets تفصل requester_role وتمنع المستخدم من إنشاء تذكرة بدور لا يملكه.
12. migrations تقفل default privileges المستقبلية في public لـ anon/authenticated.
13. CI يشغّل migrations واختبارات SQL محلياً، واختبارات Storage API بجلسات مستخدمين منفصلة.
14. لا يوجد XSS sink مباشر واضح من الأنماط التي مسحتها في ملفات TS/TSX.

---

## 15. بوابات الإطلاق الأمنية — لا نفتح التجربة حتى

- [ ] إغلاق H1 عبر RPC محدودة الحقول، مع بقاء profiles self/admin فقط.
- [ ] إزالة INSERT المباشر لـ checkins وإضافة RPC server-side تمنع backdating/future dating وتزوير created_at.
- [ ] فرض is_banned فعلياً في Auth/RLS/RPC، مع اختبار حساب محظور وجلسة قائمة.
- [ ] إصلاح requested_days/requested_dates وتشغيل اختبارات مراجعة الاستثناء الطبي.
- [ ] منع UPDATE المباشر على medical_exception_requests وجعل القرار عبر RPC مدقق فقط.
- [ ] ربط reported_user_id بالـ assignment/نوع البلاغ لمنع البلاغات الاعتباطية.
- [ ] مراجعة workflow apply-migration.yml وتصحيح هدفه؛ لا يسمح له باستهداف TestDZ القديم.
- [ ] تأكيد أن كل migrations المعلّمة staging-only لا تُدفع إلى remote دون موافقة صريحة منفصلة.
- [ ] إكمال اختبارات RLS السلبية والإيجابية للجداول كلها، لا support/feedback فقط.
- [ ] تحديد quota وrate limits للرسائل والملفات والتذاكر.
- [ ] إضافة orphan cleanup وretention للملفات، وتحديد فحص الملفات قبل فتحها.
- [ ] إكمال سياسة تصدير/حذف/احتفاظ بيانات المستخدم، بما فيها medical/support/attachments.
- [ ] التحقق اليدوي من Auth remote settings وredirect allowlist وrate limits.
- [ ] التحقق من CSP وsecurity headers على Vercel production وpreview.
- [ ] تشغيل npm audit وlint وتصنيف الثغرات قبل beta.
- [ ] إجراء اختبار تبديل المستخدم على جهاز واحد والتأكد من عدم تسرب cache أو local drafts.
- [ ] رأي قانوني موثق حول نقل البيانات والبيانات الطبية والاحتفاظ قبل إدخال مختبرين حقيقيين.

---

## 16. أسئلة تحتاج قرارك

1. هل توافق أن يرى المطوّر display_name وavatar فقط للمختبرين المرتبطين باختباراته، دون بريد أو هاتف؟
2. هل نريد السماح بالبلاغ دون assignment؟ إذا نعم، ما أنواع البلاغات التي تسمح بهدف مستخدم حر؟
3. ما سياسة الاحتفاظ بطلبات الاستثناء الطبي وسبب الطلب؟ وهل نحتاج مستنداً طبياً أصلاً أم يكفي سبب مختصر؟
4. ما المدة المعتمدة للاحتفاظ بمرفقات support وfeedback وreport evidence؟
5. هل الحظر يجب أن يمنع الجلسات القائمة فوراً، أم يكفي منع تسجيل الدخول الجديد؟ توصيتي منع العمليات فوراً وإبطال الجلسات.
6. هل تؤكد أن `TestDZ-Rebuild` هو staging الوحيد الذي سنستخدمه لاختبارات RLS الفعلية، وأن TestDZ القديم يبقى خارج أي deploy؟
7. من يملك صلاحية GitHub workflow_dispatch وGitHub Environment approval لمسارات migrations؟

---

## ملاحظة ختامية

هذه مراجعة للمصدر وسلسلة migrations على commit محدد، وليست شهادة خلو من الثغرات. لا أصف TestDZ بأنه آمن بالكامل. لم أختبر قاعدة الإنتاج، ولم أنفذ أي migration أو تعديل على قاعدة بيانات. قاعدة TestDZ-Rebuild التي فحصتها فارغة من جداول التطبيق، ولذلك يلزم تجهيز staging معزول ثم تشغيل الاختبارات السلبية والإيجابية قبل اعتبار نتائج RLS مثبتة تشغيلياً.
