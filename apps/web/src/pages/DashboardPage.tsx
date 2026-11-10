import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, Navigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { supabase } from "../lib/supabase";

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const roleRequest = useRef(0);
  const authEventSeen = useRef(false);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }

    const loadRoles = async (userId: string) => {
      const requestId = ++roleRequest.current;
      const { data: roleRows } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (requestId === roleRequest.current) {
        setRoles((roleRows ?? []).map((row: { role: string }) => row.role));
      }
    };

    client.auth.getSession().then(({ data }) => {
      if (!authEventSeen.current) {
        setSession(data.session);
        if (data.session) {
          void loadRoles(data.session.user.id);
        } else {
          roleRequest.current += 1;
          setRoles([]);
        }
      }
      setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      authEventSeen.current = true;
      setSession(nextSession);
      if (nextSession) {
        // Supabase advises against awaiting another Supabase request inside this callback.
        window.setTimeout(() => {
          void loadRoles(nextSession.user.id);
        }, 0);
      } else {
        roleRequest.current += 1;
        setRoles([]);
      }
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="loading-screen">جارٍ تحميل حسابك...</div>;
  if (!session) return <Navigate to="/auth" replace />;

  return <main className="dashboard-shell"><header className="site-header container"><Brand /><button className="button button-quiet" onClick={async () => { await supabase?.auth.signOut(); }}>تسجيل الخروج</button></header><section className="dashboard-welcome container"><span className="eyebrow">مساحة العمل</span><h1>مرحباً بك في <span>TestDZ</span></h1><p>تم تسجيل الدخول بنجاح. نبني الآن لوحة مهام المختبر والمطور.</p><div className="dashboard-card"><strong>{session.user.email}</strong><span>الأدوار: {roles.length ? roles.join(" · ") : "غير محدد"}</span><span>حالة البريد: {session.user.email_confirmed_at ? "مؤكد" : "بانتظار التأكيد"}</span><Link to="/profile">إدارة الملف الشخصي ←</Link>{roles.includes("developer") && <><span>مساحة المطور — إدارة تطبيقاتك ودورات الاختبار.</span><Link to="/apps">إدارة تطبيقاتي ←</Link></>}{roles.includes("tester") && <span>مساحة المختبر — اكتشاف الاختبارات ستكون متاحة بعد اكتمال محرك الاختبارات.</span>}</div><p className="dashboard-note">هذه نسخة تأسيسية؛ لم نعرض بيانات وهمية أو مهام تجريبية.</p></section></main>;
}

