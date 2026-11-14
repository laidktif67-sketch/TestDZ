import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../shared/components/Brand";
import { identityApi } from "../features/identity/identity-api";
import { getPostAuthRoute } from "../lib/auth-routing";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("جارٍ التحقق من رابط الدخول...");
  useEffect(() => {
    let active = true;
    async function completeCallback() {
      if (!identityApi.isConfigured()) { setMessage("إعداد الاتصال غير مكتمل."); return; }
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (hash.has("error") || hash.has("error_description")) {
        setMessage("تعذر تأكيد الرابط. ارجع لصفحة الدخول واطلب رابطاً جديداً.");
        return;
      }
      try {
        const { data, error } = await identityApi.getSession();
        if (!active) return;
        if (error) {
          setMessage("تعذر إكمال المصادقة. اطلب رابطاً جديداً.");
          return;
        }
        if (!data.session) {
          setMessage("الرابط غير صالح أو انتهت صلاحيته. ارجع لصفحة الدخول واطلب رابطاً جديداً.");
          return;
        }
        const route = await getPostAuthRoute(data.session.user.id);
        if (active) navigate(route, { replace: true });
      } catch {
        if (active) setMessage("تعذر إكمال المصادقة أو التحقق من إعداد الحساب. حدّث الصفحة أو حاول مجدداً.");
      }
    }
    void completeCallback();
    return () => { active = false; };
  }, [navigate]);
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><h2>تأكيد الحساب</h2><p>{message}</p><Link className="button button-primary" to="/auth">العودة للدخول</Link></div></section></main>;
}
