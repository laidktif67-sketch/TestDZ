import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { supabase } from "../lib/supabase";
import { getPostAuthRoute } from "../lib/auth-routing";
import { identityApi } from "../features/identity/identity-api";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("جارٍ التحقق من رابط الدخول...");
  useEffect(() => {
    if (!supabase) { setMessage("إعداد الاتصال غير مكتمل."); return; }
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const errorDescription = hash.get("error_description");
    if (errorDescription) { setMessage("تعذر تأكيد الرابط: " + errorDescription); return; }
    identityApi.getSession().then(async ({ data, error }) => {
      if (error) {
        setMessage("تعذر إكمال المصادقة. اطلب رابطاً جديداً.");
        return;
      }
      if (!data.session) {
        setMessage("الرابط غير صالح أو انتهت صلاحيته. ارجع لصفحة الدخول واطلب رابطاً جديداً.");
        return;
      }
      try {
        navigate(await getPostAuthRoute(data.session.user.id), { replace: true });
      } catch {
        setMessage("تم تسجيل الدخول، لكن تعذر التحقق من إعداد الحساب. حدّث الصفحة أو حاول مجدداً.");
      }
    });
  }, [navigate]);
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><h2>تأكيد الحساب</h2><p>{message}</p><Link className="button button-primary" to="/auth">العودة للدخول</Link></div></section></main>;
}
