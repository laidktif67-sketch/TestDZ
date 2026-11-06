import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { cn } from "../../lib/cn";
interface AppShellProps{children:ReactNode;role?:"tester"|"developer"|"admin";userName?:string;avatarUrl?:string;notificationCount?:number;subtitle?:string;onSignOut?:()=>void;onNotificationsClick?:()=>void}
export function AppShell({children,role="developer",userName,avatarUrl,notificationCount,subtitle,onSignOut,onNotificationsClick}:AppShellProps){
 const [collapsed,setCollapsed]=useState(false);
 return <div className={cn("tdz-app-shell",collapsed&&"tdz-app-shell--collapsed")} dir="rtl"><Sidebar role={role} collapsed={collapsed} onToggle={()=>setCollapsed(value=>!value)} onSignOut={onSignOut}/><div className="tdz-app-main"><TopBar userName={userName} avatarUrl={avatarUrl} notificationCount={notificationCount} subtitle={subtitle} onNotificationsClick={onNotificationsClick}/><main className="tdz-app-content">{children}</main></div></div>;
}
