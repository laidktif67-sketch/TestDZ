import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { supabase } from "../lib/supabase";
import { identityApi } from "../features/identity/identity-api";

export default function ForgotPasswordPage() {
  const [email,setEmail]=useState(""); const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");setMessage("");if(!supabase){setError("إعداد Supabase غير مكتمل.");setBusy(false);return;}try{const {error:err}=await identityApi.requestPasswordReset(email.trim(), window.location.origin + "/reset-password");if(err)setError("تعذر إرسال رابط الاستعادة. حاول لاحقاً.");else setMessage("إذا كان البريد مسجلاً، ستصلك رسالة لاستعادة كلمة المرور.");}catch{setError("تعذر إرسال رابط الاستعادة. تحقق من اتصالك وحاول لاحقاً.");}finally{setBusy(false);}}
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><span className="eyebrow">استعادة الحساب</span><h2>نسيت كلمة المرور؟</h2><p className="form-intro">أدخل بريدك وسنرسل رابطاً آمناً لإعادة تعيينها.</p>{message&&<div className="notice notice-success">{message}</div>}{error&&<div className="notice notice-error">{error}</div>}<form className="auth-form" onSubmit={submit}><label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} dir="ltr"/></label><button className="button button-primary button-large" disabled={busy}>{busy?"جارٍ الإرسال...":"إرسال رابط الاستعادة"}</button></form><Link to="/auth">العودة للدخول</Link></div></section></main>;
}

