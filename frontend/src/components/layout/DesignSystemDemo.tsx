import { useState } from "react";
import { KpiCard } from "../dashboard/KpiCard";
import { EmptyState } from "../shared/EmptyState";
import { Avatar, Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Modal, Progress, ToastProvider, useToast } from "../ui";
function DemoContent(){
 const [modalOpen,setModalOpen]=useState(false);const toast=useToast();
 return <main className="tdz-demo"><header><span className="tdz-demo-eyebrow">TESTDZ · UI FOUNDATION</span><h1>مكتبة مكونات TestDZ</h1><p>مرجع بصري للمكونات المشتركة. لا توجد بيانات إنتاج أو حسابات تجريبية.</p></header>
 <section><h2>الأزرار والحالات</h2><div className="tdz-demo-row"><Button>إجراء أساسي</Button><Button variant="secondary">ثانوي</Button><Button variant="outline">حدّي</Button><Button variant="ghost">شفاف</Button><Button variant="danger">حذف</Button><Button loading>جارٍ الحفظ</Button></div></section>
 <section><h2>الحقول</h2><div className="tdz-demo-grid"><Input label="البريد الإلكتروني" type="email" placeholder="name@example.com" hint="لن نشارك بريدك مع الآخرين."/><Input label="اسم التطبيق" placeholder="أدخل اسم التطبيق" error="هذا الحقل مطلوب."/></div></section>
 <section><h2>البطاقات والشارات</h2><div className="tdz-demo-grid"><Card><CardHeader><CardTitle>بطاقة افتراضية</CardTitle></CardHeader><CardContent><p>محتوى البطاقة يوضع عبر children دون ربط ببيانات وهمية.</p></CardContent><CardFooter><Badge variant="success" dot>نشط</Badge><Badge variant="neutral">مسودة</Badge></CardFooter></Card><Card variant="elevated"><CardHeader><CardTitle>تقدم الاختبار</CardTitle></CardHeader><CardContent><Progress value={8} max={14} label="أيام مكتملة" showLabel/></CardContent></Card></div></section>
 <section><h2>بطاقات المؤشرات وحالة الفراغ</h2><div className="tdz-demo-grid"><KpiCard label="التطبيقات النشطة" value="—" icon="▣" tone="primary"/><KpiCard label="الاختبارات المكتملة" value="—" icon="✓" tone="success"/></div><EmptyState icon="＋" title="لا توجد عناصر بعد" description="هذه حالة عرض للمكوّن فقط؛ تُمرّر البيانات الحقيقية والإجراءات من الصفحة المستهلكة."/></section>\n <section><h2>الصورة الشخصية والإشعارات</h2><div className="tdz-demo-row"><Avatar fallback="Test DZ" size="xl"/><Badge variant="info">معلومات</Badge><Badge variant="warning" dot>قيد المراجعة</Badge><Button onClick={()=>toast.show({title:"تم حفظ التغيير",description:"هذا إشعار توضيحي للمكون فقط.",kind:"success"})}>عرض Toast</Button><Button variant="outline" onClick={()=>setModalOpen(true)}>فتح Modal</Button></div></section>
 <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title="نافذة تجريبية" description="اختبر الإغلاق بزر Escape أو بالنقر خارج النافذة." footer={<Button onClick={()=>setModalOpen(false)}>حسناً</Button>}>هذا محتوى تجريبي للمكوّن، ولا ينفّذ أي إجراء على الحساب.</Modal>
 </main>;
}
export function DesignSystemDemo(){return <ToastProvider><DemoContent/></ToastProvider>;}
