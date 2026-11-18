import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../../../shared/components/Brand";
import "../styles/developer-help-v2.css";

type Category="apps"|"tests"|"testers"|"results"|"feedback"|"security";
const categories:{id:Category;title:string;description:string;symbol:string}[]=[
 {id:"apps",title:"التطبيقات",description:"إضافة التطبيقات ومراجعتها",symbol:"▦"},
 {id:"tests",title:"إنشاء الاختبارات",description:"معالج الخطوات الست والإعدادات",symbol:"✓"},
 {id:"testers",title:"مجتمع المختبرين",description:"المشاركة والخصوصية",symbol:"♙"},
 {id:"results",title:"النتائج والمراقبة",description:"التقدم ومؤشرات الجودة",symbol:"▤"},
 {id:"feedback",title:"الملاحظات",description:"مراجعة ملاحظات الاختبار",symbol:"✉"},
 {id:"security",title:"الحساب والأمان",description:"الجلسات وحماية الحساب",symbol:"⚙"}
];
const articles:{id:string;category:Category;question:string;answer:string}[]=[
 {id:"app-add",category:"apps",question:"كيف أضيف تطبيقاً جديداً؟",answer:"افتح صفحة تطبيقاتي ثم اختر إضافة تطبيق. أدخل اسم التطبيق ومعرّف الحزمة والتصنيف والوصف، ويمكنك إضافة أيقونة. بعد الحفظ تبقى حالة التطبيق مسودة إلى أن ترسله للمراجعة."},
 {id:"app-review",category:"apps",question:"هل يصبح التطبيق منشوراً بمجرد إضافته؟",answer:"لا. إنشاء التطبيق يحفظ مسودة فقط. يجب إرسالها للمراجعة وانتظار قرار الإدارة قبل أن يصبح التطبيق متاحاً لإنشاء الاختبارات المرتبطة به."},
 {id:"wizard",category:"tests",question:"ماذا يحدث عند إكمال معالج الاختبار ذي الست خطوات؟",answer:"يحفظ النظام الاختبار وإعداداته المعتمدة كمسودة واحدة. لا يبدأ الاختبار تلقائياً ولا يرسل دعوات للمختبرين ولا ينشر إصداراً على Google Play."},
 {id:"emails",category:"tests",question:"هل تُرسل قائمة البريد أو Google Group إلى المختبرين؟",answer:"لا. حقول CSV والبريد وGoogle Group تبقى محلية في المتصفح حالياً، ولا تُحفظ كقائمة دعوات ولا تُرسل إلى أي جهة."},
 {id:"monitor",category:"results",question:"أين أراقب تقدم الاختبار؟",answer:"من صفحة اختباراتي اختر تفاصيل ومراقبة. تعرض الصفحة إجماليات المشاركات وحالاتها والتقييمات والنشاط اليومي، وتسمح بتصدير ملخص CSV."},
 {id:"privacy",category:"testers",question:"لماذا لا أرى أسماء المختبرين أو ملفاتهم؟",answer:"يحمي V2 بيانات المشاركين الفردية. مساحة المطوّر تعرض أرقاماً مجمّعة فقط ولا تمنح المطوّر وصولاً مباشراً إلى أسماء المختبرين أو معرّفاتهم أو ملاحظاتهم أو ملفاتهم الخاصة."},
 {id:"community",category:"testers",question:"ماذا تعرض صفحة مجتمع المختبرين؟",answer:"تعرض أعداد المشاركين والمشاركات وحالات التقدم لكل اختبار تملكه. قد يشارك الشخص نفسه في أكثر من اختبار، لذلك لا تجمع أعداد المشاركين لكل الاختبارات على أنها عدد أشخاص فريدين."},
 {id:"results-page",category:"results",question:"كيف أفهم نسبة الإكمال ومتوسط التقييم؟",answer:"نسبة الإكمال هي عدد المشاركات المكتملة مقسوماً على إجمالي المشاركات في الاختبار. متوسط التقييم يحسب من التقييمات الرقمية المتاحة، ويُعرض عدد التقييمات الرقمية منفصلاً عن إجمالي الملاحظات."},
 {id:"feedback",category:"feedback",question:"أين أراجع ملاحظات المختبرين؟",answer:"افتح صندوق الملاحظات لمراجعة الملاحظات المرتبطة باختباراتك وإدارة حالة المراجعة والأولوية والردود وفق الصلاحيات الحالية. لا تستخدم الملاحظات بديلاً عن سجلات الدعم أو النزاعات."},
 {id:"support",category:"feedback",question:"هل يمكنني فتح تذكرة دعم من مساحة المطوّر؟",answer:"يمكن فتح مركز دعم المطوّر من الرابط أدناه. يعتمد إنشاء التذكرة على RPC يثبت دور Developer من قاعدة البيانات، ولا يُفعّل النموذج حتى يكون مخطط V2 معتمداً ومفعّلاً في بيئة التطبيق."},
 {id:"security",category:"security",question:"كيف أحمي حساب المطوّر؟",answer:"استخدم كلمة مرور فريدة ولا تشارك رموز التحقق. راجع سجل النشاط والجلسات النشطة من أدوات الأمان المتاحة، وسجّل الخروج من الأجهزة التي لم تعد تستخدمها."},
 {id:"billing",category:"security",question:"هل يمكنني شراء خطة أو تغيير الاشتراك من هنا؟",answer:"إجراءات شراء الخطط أو تعديل الاشتراك ليست جزءاً من مسار V2 المفعّل حالياً. لا تُدخل بيانات دفع في صفحات تجريبية ولا تعتبر معلومات الاستخدام عملية فوترة."}
];

export default function DeveloperHelpPage(){
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState<Category|"all">("all");
 const [expanded,setExpanded]=useState<string|null>(null);
 const visible=useMemo(()=>{const q=query.trim().toLocaleLowerCase();return articles.filter(item=>(category==="all"||item.category===category)&&(!q||(item.question+" "+item.answer).toLocaleLowerCase().includes(q)));},[query,category]);
 return <main className="dhv2-shell" dir="rtl">
  <header className="dhv2-header"><Brand/><nav><Link to="/developer-dashboard">لوحة المطوّر</Link><Link to="/developer-tests">اختباراتي</Link><Link to="/developer/testers">مجتمع المختبرين</Link><Link to="/developer-test-results">النتائج</Link><Link to="/developer-support">دعم المطوّر</Link></nav></header>
  <section className="dhv2-content">
   <div className="dhv2-hero"><span className="dhv2-hero-mark">?</span><div><span className="dhv2-eyebrow">TESTDZ · موارد المطوّر</span><h1>مركز مساعدة المطوّر</h1><p>إجابات عملية حول التطبيقات والاختبارات والنتائج وحدود الخصوصية في V2.</p></div></div>
   <label className="dhv2-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن سؤال أو موضوع…" aria-label="البحث في مركز المساعدة"/></label>
   <div className="dhv2-section-title"><div><h2>تصفّح حسب الموضوع</h2><p>اختر موضوعاً لتصفية الأسئلة.</p></div><button onClick={()=>{setCategory("all");setQuery("");setExpanded(null);}}>عرض الكل</button></div>
   <section className="dhv2-categories">{categories.map(item=><button type="button" key={item.id} className={category===item.id?"selected":""} onClick={()=>{setCategory(category===item.id?"all":item.id);setExpanded(null);}}><span>{item.symbol}</span><b>{item.title}</b><small>{item.description}</small></button>)}</section>
   <section className="dhv2-faq"><div className="dhv2-section-title"><div><h2>الأسئلة الشائعة</h2><p>معلومات مبنية على الوظائف المفعّلة فعلياً في مساحة V2.</p></div><span>{visible.length} نتيجة</span></div>
    {visible.length?visible.map(item=><article className={expanded===item.id?"open":""} key={item.id}><button type="button" onClick={()=>setExpanded(expanded===item.id?null:item.id)} aria-expanded={expanded===item.id}><span>{item.question}</span><b>{expanded===item.id?"−":"+"}</b></button>{expanded===item.id&&<p>{item.answer}</p>}</article>):<div className="dhv2-empty">لا توجد نتائج مطابقة. جرّب كلمات بحث أخرى.</div>}
   </section>
   <section className="dhv2-links"><div><strong>روابط سريعة</strong><p>انتقل مباشرة إلى الأدوات المتاحة في مساحة المطوّر.</p></div><Link to="/apps/new">إضافة تطبيق</Link><Link to="/developer/tests/new">إنشاء اختبار</Link><Link to="/developer/testers">مجتمع المختبرين</Link><Link to="/developer-test-results">النتائج</Link><Link to="/developer-support">مركز دعم المطوّر</Link></section>
   <section className="dhv2-notice"><strong>ملاحظة حول الوظائف غير المفعّلة</strong><p>مركز المساعدة لا يفعّل عمليات جديدة. دعوات المختبرين، نشر Google Play، وشراء الخطط تحتاج مسارات خلفية معتمدة قبل تشغيلها. تذاكر دعم المطوّر تستخدم RPC مخصصاً يتحقق من دور مساحة العمل، ويظل معطلاً حتى اعتماد مخطط V2.</p></section>
   <footer className="dhv2-footer">TestDZ · Build · Test · Improve</footer>
  </section>
 </main>;
}
