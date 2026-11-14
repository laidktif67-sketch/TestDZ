import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { RoleAccessNotice } from "../../../shared/guards/RoleGuard";
import DeveloperSidebar from "../components/DeveloperSidebar";
import "../styles/developer-dashboard.css";
import "../styles/developer-help-center.css";

type Category = "apps" | "tests" | "testers" | "results" | "billing" | "account";
const categories: {id:Category;title:string;description:string;icon:string;color:string}[] = [
 {id:"apps",title:"Apps & Publishing",description:"App setup, store links and publishing requirements",icon:"▦",color:"blue"},
 {id:"tests",title:"Tests & Campaigns",description:"Create tests, configure campaigns and manage schedules",icon:"✓",color:"violet"},
 {id:"testers",title:"Testers & Invitations",description:"Recruitment, eligibility and tester management",icon:"♙",color:"green"},
 {id:"results",title:"Results & Feedback",description:"Understand reports, ratings and tester feedback",icon:"▤",color:"cyan"},
 {id:"billing",title:"Plans & Billing",description:"Subscriptions, invoices and plan limits",icon:"◈",color:"amber"},
 {id:"account",title:"Account & Security",description:"Profile, workspace access and account protection",icon:"⚙",color:"purple"}
];
function Glyph({children}:{children:string}){return <span className="dh-glyph" aria-hidden="true">{children}</span>;}
const articles:{id:string;category:Category;question:string;answer:string}[]=[
 {id:"app-create",category:"apps",question:"How do I add my application?",answer:"Open My Apps from your developer workspace and choose Add App. Provide the app name, platform and the required store or package information, then save the application profile."},
 {id:"app-link",category:"apps",question:"Can I update my app details later?",answer:"Yes. Open the application details page to review and update supported metadata. Keep package identifiers and store links accurate because tests and tester assignments depend on the correct app."},
 {id:"test-create",category:"tests",question:"How do I create a testing campaign?",answer:"Open My Tests and choose Create Test. Select the application, describe the testing goals, configure the campaign duration and tester requirements, then review the campaign before publishing."},
 {id:"google",category:"tests",question:"What should I know about Google Play closed testing?",answer:"When a campaign is intended to satisfy Google Play's closed-testing requirement, configure the tester count and participation period to meet the applicable Google Play rules. A missed check-in does not by itself prove that the requirement failed; review actual participation and eligibility."},
 {id:"monitor",category:"tests",question:"Where can I monitor an active test?",answer:"Open the relevant test from My Tests and use its Monitoring page to follow participation, progress and campaign activity."},
 {id:"invite",category:"testers",question:"How are testers assigned to my test?",answer:"Tester allocation follows the campaign's eligibility and assignment rules. Use Testers Management and the test monitoring view to review the testers associated with your campaigns."},
 {id:"feedback",category:"results",question:"Where can I review submitted feedback?",answer:"Open Feedback from the developer sidebar. Feedback quality review and your team's follow-up status are separate: quality status is controlled by the review process, while developer status tracks your response or planned fix."},
 {id:"results",category:"results",question:"How do I understand test results?",answer:"Open Test Results for the selected campaign to review the available feedback and outcome summaries. Results depend on the submissions and review data recorded for that test."},
 {id:"plan",category:"billing",question:"Where can I manage my subscription?",answer:"Open Subscription from your developer workspace to review the current plan, usage and available plan actions."},
 {id:"security",category:"account",question:"How can I protect my developer account?",answer:"Use a unique password, keep your email account secure and never share verification codes. Review your account and security settings when you change devices or team access."}
];
export default function DeveloperHelpCenterPage(){
 const {user}=useIdentity();const [query,setQuery]=useState("");const [category,setCategory]=useState<Category|"all">("all");const [expanded,setExpanded]=useState<string|null>(null);
 const name=user?.user_metadata?.display_name||user?.email?.split("@")[0]||"Developer";const initial=name.slice(0,1).toUpperCase();
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return articles.filter(a=>(category==="all"||a.category===category)&&(!q||(a.question+" "+a.answer).toLowerCase().includes(q)));},[query,category]);
 return <div className="dd-shell dh-shell">
  <DeveloperSidebar />
  <main className="dd-main dh-main"><RoleAccessNotice/><header className="dd-topbar"><label className="dd-search">⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search developer help…" aria-label="Search developer help"/></label><div className="dd-top-actions"><Link to="/developer/notifications" className="dh-top-link">♧</Link><Link to="/profile" className="dd-top-avatar">{initial}</Link></div></header>
   <section className="dd-hero dh-hero"><div className="dd-hero-copy"><span className="dd-hero-kicker">TESTDZ · DEVELOPER RESOURCES</span><h1>Developer Help Center</h1><p>Practical answers to help you launch apps, run better tests and manage your testing workspace.</p><label className="dh-hero-search">⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search guides, topics or questions…"/></label></div><div className="dh-hero-art"><div className="dh-orbit"/><div className="dh-help-symbol">?</div><div className="dh-code-card"><i/><i/><i/><span>developer.help()</span><b>✓ Ready to build</b></div></div></section>
   <section className="dh-heading"><div><h2>Browse by topic</h2><p>Choose a category to find relevant developer guidance.</p></div><span>{categories.length} topics</span></section>
   <section className="dh-categories">{categories.map(c=><button key={c.id} className={category===c.id?"selected":""} onClick={()=>{setCategory(category===c.id?"all":c.id);setExpanded(null);}}><span className={"dh-category-icon "+c.color}><Glyph>{c.icon}</Glyph></span><span><b>{c.title}</b><small>{c.description}</small><em>{articles.filter(a=>a.category===c.id).length} articles</em></span><strong>→</strong></button>)}</section>
   <div className="dh-lower"><section className="dh-faq"><div className="dh-heading"><div><h2>Frequently asked questions</h2><p>Answers curated for TestDZ developers.</p></div><button onClick={()=>{setCategory("all");setQuery("");setExpanded(null);}}>View all</button></div><div className="dh-faq-tools"><button className={category==="all"?"active":""} onClick={()=>setCategory("all")}>All topics</button><span>{filtered.length} results</span></div>{filtered.length?filtered.map(a=><article className={expanded===a.id?"open":""} key={a.id}><button onClick={()=>setExpanded(expanded===a.id?null:a.id)} aria-expanded={expanded===a.id}><span>{a.question}</span><b>{expanded===a.id?"−":"+"}</b></button>{expanded===a.id&&<p>{a.answer}</p>}</article>):<div className="dh-empty">No matching articles. Try another search or topic.</div>}</section>
    <aside className="dh-aside"><section><span className="dh-aside-icon">♧</span><h3>Still need help?</h3><p>Can't find the answer? Create a support ticket and our team will follow up.</p><Link to="/developer/support">Open Support Center →</Link></section><section><span className="dh-aside-icon">▤</span><h3>Developer workspace</h3><p>Jump back into the tools you use most.</p><Link to="/developer/tests">Manage tests →</Link><Link to="/developer/results">View test results →</Link><Link to="/developer/subscription">Plans & billing →</Link></section></aside></div>
  </main>
 </div>;
}
