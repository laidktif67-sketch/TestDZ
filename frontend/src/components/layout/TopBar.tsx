import { Avatar } from "../ui/Avatar";
interface TopBarProps{greeting?:string;subtitle?:string;userName?:string;avatarUrl?:string;notificationCount?:number;onNotificationsClick?:()=>void}
export function TopBar({greeting="أهلاً",subtitle,userName,avatarUrl,notificationCount=0,onNotificationsClick}:TopBarProps){
 return <header className="tdz-topbar"><div className="tdz-topbar-heading"><h1>{greeting}{userName?", "+userName:""} <span aria-hidden="true">👋</span></h1>{subtitle&&<p>{subtitle}</p>}</div><div className="tdz-topbar-actions"><button className="tdz-icon-button tdz-notification-button" type="button" onClick={onNotificationsClick} aria-label={"الإشعارات، "+notificationCount+" غير مقروء"}>♧{notificationCount>0&&<i/>}</button><Avatar src={avatarUrl} fallback={userName} size="sm" alt={userName?"صورة "+userName:"الصورة الشخصية"}/></div></header>;
}
