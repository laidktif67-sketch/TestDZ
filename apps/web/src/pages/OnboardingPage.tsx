import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { supabase } from "../lib/supabase";

export default function OnboardingPage() {
  const navigate=useNavigate();const [choice,setChoice]=useState("tester");const [interests,setInterests]=useState<string[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const options=["أدوات وإنتاجية","تعليم","ألعاب","تجارة إلكترونية","صحة ولياقة","شبكات اجتماعية","أخرى"];
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/auth", { replace: true });
        return;
      }
      const preferredRole = data.session.user.user_metadata?.account_type;
      if (preferredRole === "tester" || preferredRole === "developer" || preferredRole === "both") {
        setChoice(preferredRole);
      }
    });
  }, [navigate]);
  function toggle(item:string){setInterests(current=>current.includes(item)?current.filter(x=>x!==item):current.length<7?[...current,item]:current);}
  async function finish(){if(!supabase){setError("إعداد Supabase غير مكتمل.");return;}setBusy(true);setError("");const roles=choice==="both"?["tester","developer"]:[choice];const {error:err}=await supabase.rpc("complete_onboarding",{p_roles:roles,p_interests:interests});if(err)setError("تعذر حفظ إعدادات الحساب. حاول مرة أخرى.");else navigate("/dashboard",{replace:true});setBusy(false);}
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><span className="eyebrow">خطوة واحدة للبدء</span><h2>كيف ستستخدم TestDZ؟</h2><p className="form-intro">يمكنك الجمع بين الاختبار وتطوير التطبيقات.</p><div className="role-options">{[{value:"tester",label:"مختبر",desc:"أختبر التطبيقات وأشارك ملاحظاتي."},{value:"developer",label:"مطور",desc:"أنشر تطبيقاتي وأنظم اختبارات لها."},{value:"both",label:"كلاهما",desc:"أطور تطبيقاتي وأختبر تطبيقات الآخرين."}].map(item=><button type="button" key={item.value} className={"role-option "+(choice===item.value?"selected":"")} onClick={()=>setChoice(item.value)}><strong>{item.label}</strong><span>{item.desc}</span></button>)}</div><h3>ما المجالات التي تهمك؟ <small>اختياري</small></h3><div className="interest-options">{options.map(item=><button type="button" key={item} className={interests.includes(item)?"selected":""} onClick={()=>toggle(item)}>{item}</button>)}</div>{error&&<div className="notice notice-error">{error}</div>}<button className="button button-primary button-large submit-button" disabled={busy} onClick={finish}>{busy?"جارٍ الحفظ...":"متابعة إلى لوحة التحكم"}</button><button className="text-button" type="button" onClick={()=>{setChoice("tester");setInterests([]);}}>تخطي واستخدام الإعداد الافتراضي (مختبر)</button></div></section></main>;
}

