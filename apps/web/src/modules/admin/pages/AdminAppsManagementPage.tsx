import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/admin-dashboard.css";
import "../styles/admin-apps-management.css";
import AdminSidebar from "../components/AdminSidebar";
import AdminIcon from "../components/AdminIcon";

type AppStatus = "Approved" | "Pending" | "Rejected" | "Suspended";
type AppRecord = { id: string; name: string; description: string; developer: string; handle: string; category: string; version: string; status: AppStatus; submitted: string; downloads: string; activeUsers: string };
const initialApps: AppRecord[] = [
  { id:"app-1",name:"Security Plus",description:"Advanced security tools",developer:"Ahmed Benali",handle:"@ahmed_dev",category:"Security",version:"1.2.0",status:"Approved",submitted:"Nov 20, 2026 · 14:30",downloads:"12.5K",activeUsers:"8.9K" },
  { id:"app-2",name:"Learn Pro",description:"Interactive courses",developer:"Karim Ait Ahmed",handle:"@karim_dev",category:"Education",version:"2.0.1",status:"Pending",submitted:"Nov 20, 2026 · 11:15",downloads:"—",activeUsers:"—" },
  { id:"app-3",name:"ShopEasy",description:"Smart shopping assistant",developer:"Yacine Hadjout",handle:"@yacine_dev",category:"Shopping",version:"1.5.0",status:"Approved",submitted:"Nov 19, 2026 · 16:20",downloads:"8.2K",activeUsers:"5.1K" },
  { id:"app-4",name:"Health First",description:"Health & wellness",developer:"Mohamed Tarek",handle:"@tarek_dev",category:"Health",version:"1.0.3",status:"Rejected",submitted:"Nov 19, 2026 · 13:45",downloads:"—",activeUsers:"—" },
  { id:"app-5",name:"Game Zone",description:"Top games collection",developer:"Nour Chenouf",handle:"@nour_dev",category:"Games",version:"3.1.0",status:"Approved",submitted:"Nov 18, 2026 · 19:10",downloads:"18.4K",activeUsers:"10.2K" },
  { id:"app-6",name:"Finance Pro",description:"Personal finance tools",developer:"Ahmed Benali",handle:"@ahmed_dev",category:"Finance",version:"1.0.0",status:"Suspended",submitted:"Nov 18, 2026 · 12:30",downloads:"2.1K",activeUsers:"640" },
  { id:"app-7",name:"Video Maker",description:"Create & edit videos",developer:"Karim Ait Ahmed",handle:"@karim_dev",category:"Multimedia",version:"2.2.0",status:"Approved",submitted:"Nov 16, 2026 · 17:25",downloads:"6.7K",activeUsers:"3.4K" },
  { id:"app-8",name:"Travel DZ",description:"Travel and booking",developer:"Yacine Hadjout",handle:"@yacine_dev",category:"Travel",version:"1.1.0",status:"Pending",submitted:"Nov 15, 2026 · 10:50",downloads:"—",activeUsers:"—" },
];
const filters = ["All Apps","Pending","Approved","Rejected","Suspended"] as const;
type Filter = typeof filters[number];
const statusClass = (status: AppStatus) => status.toLowerCase();
export default function AdminAppsManagementPage() {
 const [apps,setApps]=useState(initialApps);
 const [filter,setFilter]=useState<Filter>("All Apps");
 const [query,setQuery]=useState("");
 const [selectedId,setSelectedId]=useState("app-1");
 const [notice,setNotice]=useState("");
 const selected=apps.find(app=>app.id===selectedId)??apps[0];
 const visible=useMemo(()=>apps.filter(app=>(filter==="All Apps"||app.status===filter)&&[app.name,app.developer,app.category,app.version,app.status].some(value=>value.toLowerCase().includes(query.toLowerCase()))),[apps,filter,query]);
 const count=(status:Filter)=>status==="All Apps"?248:status==="Pending"?32:status==="Approved"?190:status==="Rejected"?26:12;
 const changeStatus=(status:AppStatus)=>{if(!selected)return;setApps(current=>current.map(app=>app.id===selected.id?{...app,status}:app));setNotice(selected.name+" marked as "+status+". This is a local preview only; no platform record was changed.");};
 return <main className="admin-dashboard admin-apps-page">
  <aside className="admin-sidebar">
   <Link className="admin-brand" to="/admin"><span className="admin-brand-mark">✓</span><span>TestDZ<small>Build · Test · Improve</small></span></Link>
   <div className="admin-sidebar-label">Workspace</div>
   <AdminSidebar activePath="/admin/apps" />
   <div className="admin-sidebar-label">System</div><Link className="admin-nav-item" to="/admin/audit-trail"><span className="apps-nav-symbol">◷</span><span>Audit Trail</span></Link>
   <div className="admin-sidebar-footer"><span className="admin-avatar">AD</span><div><strong>Admin</strong><small>Platform administrator</small></div><span className="admin-online"/></div>
  </aside>
  <section className="admin-main">
   <header className="admin-topbar"><label className="admin-search"><AdminIcon name="search" size={18}/><input aria-label="Search apps and developers" placeholder="Search users, apps, or developers..." value={query} onChange={event=>setQuery(event.target.value)}/></label><div className="admin-top-actions"><button type="button" className="admin-icon-button" aria-label="Notifications"><AdminIcon name="bell" size={18}/><span>3</span></button><button type="button" className="admin-icon-button" aria-label="Messages"><AdminIcon name="mail" size={18}/><span>5</span></button><div className="admin-user-menu"><span className="admin-avatar">AD</span><span>Admin</span></div></div></header>
   <div className="admin-content apps-content">
    <section className="apps-hero"><div className="apps-hero-icon">◇</div><div><span>TESTDZ · ADMIN WORKSPACE</span><h1>Apps Management</h1><p>Review and manage all submitted applications</p></div><span className="apps-period">▦　Last 30 Days　⌄</span></section>
    <div className="apps-demo-banner"><strong>DEMO MODE</strong><span>Sample app records only. Status actions below are local previews and do not update production data.</span></div>
    <section className="apps-metrics">
     <article className="apps-metric blue"><span>◇</span><div><strong>248</strong><small>Total Apps</small></div><b>↑ +12%</b></article>
     <article className="apps-metric green"><span>✓</span><div><strong>190</strong><small>Approved</small></div><b>↑ +8%</b></article>
     <article className="apps-metric orange"><span>◷</span><div><strong>32</strong><small>Pending Review</small></div><b>↓ -6%</b></article>
     <article className="apps-metric red"><span>×</span><div><strong>26</strong><small>Rejected</small></div><b>↓ -10%</b></article>
    </section>
    {notice&&<div className="apps-notice" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>Dismiss</button></div>}
    <div className="apps-toolbar"><div className="apps-filters" role="tablist" aria-label="Filter applications">{filters.map(item=><button type="button" role="tab" aria-selected={filter===item} className={filter===item?"active":""} key={item} onClick={()=>setFilter(item)}>{item}<span>{count(item)}</span></button>)}</div><label className="apps-search">⌕<input placeholder="Search apps..." aria-label="Search apps" value={query} onChange={event=>setQuery(event.target.value)}/></label><button type="button" className="apps-submit" onClick={()=>setNotice("App submission is performed by developers. This admin preview does not create apps.")}>➤　Submit App</button></div>
    <div className="apps-workspace">
     <section className="apps-table-card"><div className="apps-table-scroll"><table className="apps-table"><thead><tr><th>App</th><th>Developer</th><th>Category</th><th>Version</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{visible.map(app=><tr key={app.id} className={selectedId===app.id?"selected":""} onClick={()=>setSelectedId(app.id)}><td><span className="apps-name-cell"><i>{app.name.slice(0,1)}</i><span><b>{app.name}</b><small>{app.description}</small></span></span></td><td><b>{app.developer}</b><small className="apps-handle">{app.handle}</small></td><td><span className="apps-category">{app.category}</span></td><td>{app.version}</td><td><span className={"apps-status "+statusClass(app.status)}>{app.status}</span></td><td>{app.submitted}</td><td><button type="button" aria-label={"View "+app.name} onClick={event=>{event.stopPropagation();setSelectedId(app.id)}}>◉</button><button type="button" aria-label={"Review "+app.name} onClick={event=>{event.stopPropagation();setSelectedId(app.id);setNotice("Review "+app.name+" in the details panel. Actions are demo-only.")}}>✎</button><button type="button" aria-label={"More actions for "+app.name} onClick={event=>{event.stopPropagation();setSelectedId(app.id);setNotice("Select an action in the details panel for "+app.name+".")}}>•••</button></td></tr>)}{visible.length===0&&<tr><td colSpan={7} className="apps-empty">No applications match your filters.</td></tr>}</tbody></table></div><footer className="apps-table-footer">Showing {visible.length} sample apps <span>‹　<strong>1</strong>　2　3　…　32　›</span></footer></section>
     {selected&&<aside className="apps-detail-card"><header><b>◇　App Details</b><button type="button" onClick={()=>setNotice("Full app detail route can be added after the app review data model is verified.")}>View Details →</button></header><div className="apps-detail-title"><i>{selected.name.slice(0,1)}</i><div><h2>{selected.name}</h2><p>{selected.description}</p><span className={"apps-status "+statusClass(selected.status)}>{selected.status}</span></div></div><dl><div><dt>Developer</dt><dd>{selected.developer}</dd></div><div><dt>Version</dt><dd>{selected.version}</dd></div><div><dt>Category</dt><dd>{selected.category}</dd></div><div><dt>Submitted</dt><dd>{selected.submitted}</dd></div><div><dt>Last Update</dt><dd>Nov 21, 2026 · 09:15</dd></div></dl><h3>Key Statistics</h3><div className="apps-detail-stats"><span><small>Total Downloads</small><b>{selected.downloads}</b></span><span><small>Active Users</small><b>{selected.activeUsers}</b></span></div><div className="apps-review-actions"><button type="button" className="approve" onClick={()=>changeStatus("Approved")}>✓　Approve</button><button type="button" className="reject" onClick={()=>changeStatus("Rejected")}>×　Reject</button><button type="button" className="suspend" onClick={()=>changeStatus("Suspended")}>Ⅱ　Suspend App</button></div></aside>}
    </div>
    <p className="admin-demo-note">Apps Management preview · Counts, dates, downloads and application records are illustrative sample data.</p>
   </div>
  </section>
 </main>;
}
