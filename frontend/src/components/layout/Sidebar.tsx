import { NavLink, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
type Role="tester"|"developer"|"admin";
interface SidebarProps{role?:Role;collapsed?:boolean;onToggle?:()=>void;onSignOut?:()=>void}
const menus:Record<Role,Array<{label:string;to:string;icon:string}>>={
 tester:[{label:"الرئيسية",to:"/dashboard",icon:"⌂"},{label:"اختباراتي",to:"/my-tests",icon:"✓"},{label:"اكتشف التطبيقات",to:"/discover",icon:"⌕"}],
 developer:[{label:"الرئيسية",to:"/dashboard",icon:"⌂"},{label:"تطبيقاتي",to:"/apps",icon:"▣"},{label:"مجموعات الاختبار",to:"/cohorts",icon:"◉"},{label:"التقييمات",to:"/reviews",icon:"☆"}],
 admin:[{label:"لوحة الإدارة",to:"/admin",icon:"⌂"},{label:"المستخدمون",to:"/admin/users",icon:"♙"},{label:"التطبيقات",to:"/admin/apps",icon:"▣"}]
};
export function Sidebar({role="developer",collapsed=false,onToggle,onSignOut}:SidebarProps){
 const [dark,setDark]=useState(()=>{try{return localStorage.getItem("testdz-theme")!=="light";}catch{return true;}});
 useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light";try{localStorage.setItem("testdz-theme",dark?"dark":"light");}catch{}},[dark]);
 useEffect(()=>{try{const saved=localStorage.getItem("testdz-theme");if(saved==="light"||saved==="dark")setDark(saved==="dark");}catch{}},[]);
 return <aside className={cn("tdz-sidebar",collapsed&&"tdz-sidebar--collapsed")} aria-label="القائمة الجانبية">
  <div className="tdz-sidebar-brand"><Link to="/" className="tdz-brand"><span className="tdz-brand-mark">T</span>{!collapsed&&<span>Test<span>DZ</span></span>}</Link><button className="tdz-icon-button tdz-sidebar-toggle" onClick={onToggle} type="button" aria-label={collapsed?"توسيع القائمة":"طي القائمة"}>{collapsed?"‹":"›"}</button></div>
  <nav className="tdz-sidebar-nav">{menus[role].map(item=><NavLink key={item.to} to={item.to} end className={({isActive})=>cn("tdz-nav-link",isActive&&"is-active")} title={collapsed?item.label:undefined}><span className="tdz-nav-icon" aria-hidden="true">{item.icon}</span>{!collapsed&&<span>{item.label}</span>}</NavLink>)}</nav>
  <div className="tdz-sidebar-footer"><button className="tdz-nav-link" type="button" onClick={()=>setDark(value=>!value)}><span className="tdz-nav-icon" aria-hidden="true">{dark?"☼":"☾"}</span>{!collapsed&&<span>{dark?"الوضع الفاتح":"الوضع الداكن"}</span>}</button><Link className="tdz-nav-link" to="/help"><span className="tdz-nav-icon" aria-hidden="true">?</span>{!collapsed&&<span>المساعدة</span>}</Link><button className="tdz-nav-link tdz-nav-link--danger" type="button" onClick={onSignOut}><span className="tdz-nav-icon" aria-hidden="true">↪</span>{!collapsed&&<span>تسجيل الخروج</span>}</button></div>
 </aside>;
}
