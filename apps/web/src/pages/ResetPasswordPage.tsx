import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { supabase } from "../lib/supabase";
import { identityApi } from "../features/identity/identity-api";

export default function ResetPasswordPage() {
  const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");const [message,setMessage]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setMessage("");if(password.length<8||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)){setError("استخدم 8 أحرف على الأقل، مع حرف ورقم.");return;}if(password!==confirm){setError("كلمتا المرور غير متطابقتين.");return;}if(!supabase){setError("إعداد Supabase غير مكتمل.");return;}setBusy(true);const {error:err}=await identityApi.updatePassword(password);if(err)setError("الرابط غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.");else setMessage("تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول.");setBusy(false);}
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><span className="eyebrow">كلمة مرور جديدة</span><h2>أعد تعيين كلمة المرور</h2>{message&&<div className="notice notice-success">{message} <Link to="/auth">تسجيل الدخول</Link></div>}{error&&<div className="notice notice-error">{error}</div>}<form className="auth-form" onSubmit={submit}><label>كلمة المرور الجديدة<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} dir="ltr"/></label><label>تأكيد كلمة المرور<input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} dir="ltr"/></label><button className="button button-primary button-large" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ كلمة المرور"}</button></form></div></section></main>;
}

