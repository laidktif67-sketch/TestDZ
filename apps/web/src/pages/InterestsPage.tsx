import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { identityApi } from "../features/identity/identity-api";
import { profilesApi } from "../features/profiles/profiles-api";
import { useIdentity } from "../features/identity/hooks/useIdentity";
import { useLenis } from "../hooks/useLenis";
import "../styles/interests.css";

type Language = "en" | "fr" | "ar";
type GroupKey = "testing" | "skills" | "other";
type Item = { id: string; icon: string; labels: Record<Language, string>; descriptions: Record<Language, string> };

const content = {
  en: {
    language:"Language", progress:"STEP 03 / 04", title:"Tell us what you love to build",
    intro:"Choose your interests and skills. We’ll use them to personalize your testing journey and discover opportunities that fit you.",
    testing:"Testing interests", testingHint:"What would you like to explore?", skills:"Development skills", skillsHint:"Technologies you work with",
    other:"Explore more interests", optional:"Choose any that inspire you", selected:"selected", clear:"Clear all",
    continue:"Continue", saving:"Saving your profile…", skip:"Skip for now", back:"Back", error:"We couldn’t save your choices. Please try again.",
    config:"Supabase is not configured.", footer:"Build. Test. Reward.", rights:"© 2026 TestDZ. All rights reserved.",
    about:"About", terms:"Terms", privacy:"Privacy", contact:"Contact", selectedLabel:"Your selection",
    selectedHint:"Your choices help us tailor recommendations.", min:"Pick at least one interest to get better recommendations.",
    noSelection:"Nothing selected yet", done:"Great choices!", roles:{tester:"Tester",developer:"Developer",both:"Tester & Developer"}
  },
  fr: {
    language:"Langue", progress:"ÉTAPE 03 / 04", title:"Parlez-nous de vos passions",
    intro:"Choisissez vos centres d’intérêt et vos compétences. Nous personnaliserons votre parcours de test et vous proposerons des opportunités adaptées.",
    testing:"Intérêts de test", testingHint:"Que souhaitez-vous explorer ?", skills:"Compétences en développement", skillsHint:"Les technologies que vous utilisez",
    other:"Découvrez d’autres domaines", optional:"Choisissez ce qui vous inspire", selected:"sélectionnés", clear:"Tout effacer",
    continue:"Continuer", saving:"Enregistrement du profil…", skip:"Passer pour le moment", back:"Retour", error:"Impossible d’enregistrer vos choix. Réessayez.",
    config:"Supabase n’est pas configuré.", footer:"Créer. Tester. Récompenser.", rights:"© 2026 TestDZ. Tous droits réservés.",
    about:"À propos", terms:"Conditions", privacy:"Confidentialité", contact:"Contact", selectedLabel:"Votre sélection",
    selectedHint:"Vos choix nous aident à personnaliser les recommandations.", min:"Choisissez au moins un intérêt pour de meilleures recommandations.",
    noSelection:"Aucun choix pour le moment", done:"Excellent choix !", roles:{tester:"Testeur",developer:"Développeur",both:"Testeur & développeur"}
  },
  ar: {
    language:"اللغة", progress:"الخطوة 03 / 04", title:"أخبرنا بما تحب أن تبدع فيه",
    intro:"اختر اهتماماتك ومهاراتك التقنية لنخصص لك تجربة الاختبار ونقترح عليك المشاريع والفرص المناسبة.",
    testing:"مجالات الاختبار", testingHint:"ما المجالات التي تود استكشافها؟", skills:"مهارات التطوير", skillsHint:"التقنيات التي تعمل بها",
    other:"اكتشف اهتمامات أخرى", optional:"اختر المجالات التي تلهمك", selected:"مختارة", clear:"مسح الكل",
    continue:"متابعة", saving:"جارٍ حفظ ملفك…", skip:"تخطي الآن", back:"رجوع", error:"تعذر حفظ اختياراتك. حاول مرة أخرى.",
    config:"إعداد Supabase غير مكتمل.", footer:"ابنِ. اختبر. اكسب.", rights:"© 2026 TestDZ. جميع الحقوق محفوظة.",
    about:"من نحن", terms:"الشروط", privacy:"الخصوصية", contact:"اتصل بنا", selectedLabel:"اختياراتك",
    selectedHint:"تساعدنا اختياراتك على تخصيص الاقتراحات لك.", min:"اختر اهتماماً واحداً على الأقل للحصول على اقتراحات أفضل.",
    noSelection:"لم تختر أي مجال بعد", done:"اختيارات رائعة!", roles:{tester:"مختبِر",developer:"مطوّر",both:"مختبِر ومطوّر"}
  }
} as const;

const testingItems: Item[] = [
  {id:"Android",icon:"android",labels:{en:"Android",fr:"Android",ar:"Android"},descriptions:{en:"Mobile app testing",fr:"Tests d’applications mobiles",ar:"اختبار تطبيقات الهاتف"}},
  {id:"UI/UX",icon:"design",labels:{en:"UI / UX",fr:"UI / UX",ar:"واجهات وتجربة المستخدم"},descriptions:{en:"Usability & design",fr:"Ergonomie et design",ar:"سهولة الاستخدام والتصميم"}},
  {id:"Performance",icon:"gauge",labels:{en:"Performance",fr:"Performance",ar:"الأداء"},descriptions:{en:"Speed & stability",fr:"Vitesse et stabilité",ar:"السرعة والاستقرار"}},
  {id:"Security",icon:"shield",labels:{en:"Security",fr:"Sécurité",ar:"الأمان"},descriptions:{en:"Privacy & protection",fr:"Confidentialité",ar:"الخصوصية والحماية"}},
];
const skillItems: Item[] = [
  {id:"Java",icon:"java",labels:{en:"Java",fr:"Java",ar:"Java"},descriptions:{en:"Backend & Android",fr:"Backend et Android",ar:"باك إند وأندرويد"}},
  {id:"Kotlin",icon:"kotlin",labels:{en:"Kotlin",fr:"Kotlin",ar:"Kotlin"},descriptions:{en:"Modern Android",fr:"Android moderne",ar:"تطوير أندرويد"}},
  {id:"Flutter",icon:"flutter",labels:{en:"Flutter",fr:"Flutter",ar:"Flutter"},descriptions:{en:"Cross-platform apps",fr:"Apps multiplateformes",ar:"تطبيقات متعددة المنصات"}},
  {id:"React",icon:"react",labels:{en:"React",fr:"React",ar:"React"},descriptions:{en:"Web interfaces",fr:"Interfaces web",ar:"واجهات الويب"}},
];
const otherItems: Item[] = [
  {id:"Web Development",icon:"globe",labels:{en:"Web Development",fr:"Développement Web",ar:"تطوير الويب"},descriptions:{en:"Websites & platforms",fr:"Sites et plateformes",ar:"المواقع والمنصات"}},
  {id:"Mobile Apps",icon:"phone",labels:{en:"Mobile Apps",fr:"Applications mobiles",ar:"تطبيقات الهاتف"},descriptions:{en:"iOS & Android",fr:"iOS et Android",ar:"iOS وAndroid"}},
  {id:"AI / Machine Learning",icon:"brain",labels:{en:"AI / Machine Learning",fr:"IA / Machine Learning",ar:"الذكاء الاصطناعي"},descriptions:{en:"Intelligent products",fr:"Produits intelligents",ar:"المنتجات الذكية"}},
  {id:"Game Development",icon:"game",labels:{en:"Game Development",fr:"Jeux vidéo",ar:"تطوير الألعاب"},descriptions:{en:"Games & interactive",fr:"Jeux et interactivité",ar:"الألعاب والتفاعل"}},
  {id:"Open Source",icon:"code",labels:{en:"Open Source",fr:"Open Source",ar:"المصادر المفتوحة"},descriptions:{en:"Build with community",fr:"Créer en communauté",ar:"التطوير مع المجتمع"}},
];

function Icon({name,size=24}:{name:string;size?:number}) {
  const common={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true as const};
  const paths:Record<string,ReactNode>={
    android:<><path d="M7 8 5.5 5M17 8l1.5-3"/><path d="M4 10a8 8 0 0 1 16 0v7a2 2 0 0 1-2 2h-1v-5H7v5H6a2 2 0 0 1-2-2z"/><path d="M8 12h.01M16 12h.01"/></>,
    design:<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="m8 21 4-4 4 4M8 8h8M8 12h5"/></>,
    gauge:<><path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 13 4-4M7 18h10"/><circle cx="12" cy="13" r="1"/></>,
    shield:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></>,
    java:<><path d="M8 18h9M6 21h13M7 15c-2 2 1 3 4 3s7-1 6-3"/><path d="M12 3c-3 2 3 3 0 6M16 4c-2 2 2 2 0 4M8 10c-2 2 1 3 4 3"/></>,
    kotlin:<><path d="M4 3h16L9 12l11 9H4z"/><path d="m4 12 9-9"/></>,
    flutter:<><path d="m13 2 8 0-11 11-4-4z"/><path d="m10 13 4-4 7 7h-8z"/><path d="m6 17 4-4 4 4-4 4z"/></>,
    react:<><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></>,
    globe:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    phone:<><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/></>,
    brain:<><path d="M12 4a3 3 0 0 0-5.8 1A4 4 0 0 0 4 12a4 4 0 0 0 3 6 3 3 0 0 0 5-2z"/><path d="M12 4a3 3 0 0 1 5.8 1A4 4 0 0 1 20 12a4 4 0 0 1-3 6 3 3 0 0 1-5-2zM8 9h2m4 0h2M9 14h3m2 3h2"/></>,
    game:<><path d="M6 9h12a4 4 0 0 1 3.8 5l-1 3a2 2 0 0 1-3.2 1l-2.2-2H8.6l-2.2 2a2 2 0 0 1-3.2-1l-1-3A4 4 0 0 1 6 9z"/><path d="M7 12v4m-2-2h4m7-1h.01m3 2h.01"/></>,
    code:<><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14"/></>,
    check:<path d="m5 12 4 4L19 6"/>, spark:<><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
    target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    arrow:<path d="M5 12h14m-6-6 6 6-6 6"/>, flask:<><path d="M9 3h6m-5 0v6l-5.5 9.2A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.8L14 9V3"/><path d="M8 15h8"/></>
  };
  return <svg {...common}>{paths[name] ?? paths.spark}</svg>;
}

function Brand(){return <a className="interest-brand" href="/" aria-label="TestDZ home"><span className="interest-flask"><Icon name="flask" size={34}/></span><span><strong>TestDZ</strong><small>Test · Learn · Grow</small></span></a>;}
function Progress(){return <div className="interest-progress" aria-label="Step 3 of 4"><span className="complete"><Icon name="check" size={17}/></span><i/><span className="complete"><Icon name="check" size={17}/></span><i/><span className="active">3</span><i/><span className="future">4</span></div>;}
function SelectionCard({item,language,selected,onClick}:{item:Item;language:Language;selected:boolean;onClick:()=>void}){
  return <button type="button" className={"interest-option"+(selected?" selected":"")} aria-pressed={selected} onClick={onClick}>
    <span className={"interest-option-icon icon-"+item.icon}><Icon name={item.icon} size={25}/></span>
    <span className="interest-option-copy"><strong>{item.labels[language]}</strong><small>{item.descriptions[language]}</small></span>
    <span className="interest-option-check"><Icon name="check" size={15}/></span>
  </button>;
}
function InterestChip({item,language,selected,onClick}:{item:Item;language:Language;selected:boolean;onClick:()=>void}){
  return <button type="button" className={"interest-chip"+(selected?" selected":"")} aria-pressed={selected} onClick={onClick}><Icon name={item.icon} size={17}/>{item.labels[language]}<span className="chip-check"><Icon name="check" size={12}/></span></button>;
}

export default function InterestsPage(){
  useLenis();
  const rootRef=useRef<HTMLElement>(null);
  const navigate=useNavigate();
  const location=useLocation();
  const { refreshRoles } = useIdentity();
  const [language,setLanguage]=useState<Language>(()=>{const saved=window.localStorage.getItem("testdz-landing-language");return saved==="fr"||saved==="ar"?saved:"en";});
  const t=content[language];
  const roleFromState=(location.state as {choice?:string}|null)?.choice;
  const [role,setRole]=useState<"tester"|"developer"|"both">(roleFromState==="developer"||roleFromState==="both"?roleFromState:"tester");
  const [testing,setTesting]=useState<string[]>(["Android","UI/UX","Security"]);
  const [skills,setSkills]=useState<string[]>(["Java","Flutter"]);
  const [other,setOther]=useState<string[]>(["Web Development"]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const selected=[...testing,...skills,...other];

  useEffect(()=>{
    const root=rootRef.current;if(!root)return;
    const ctx=gsap.context(()=>{
      if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
      gsap.timeline({defaults:{ease:"power3.out"}})
        .fromTo(".interest-progress",{y:12,autoAlpha:0},{y:0,autoAlpha:1,duration:.4})
        .fromTo(".interest-heading",{y:20,autoAlpha:0,filter:"blur(6px)"},{y:0,autoAlpha:1,filter:"blur(0)",duration:.55},"-=.18")
        .fromTo(".interest-panel",{y:24,autoAlpha:0},{y:0,autoAlpha:1,duration:.5,stagger:.09},"-=.2")
        .fromTo(".interest-other,.interest-summary,.interest-footer-actions",{y:15,autoAlpha:0},{y:0,autoAlpha:1,duration:.4,stagger:.08},"-=.2");
      gsap.to(".interest-art-orbit",{rotate:8,duration:12,repeat:-1,yoyo:true,ease:"sine.inOut"});
      gsap.to(".interest-art-flask",{y:-10,duration:2.8,repeat:-1,yoyo:true,ease:"sine.inOut"});
    },root);
    return()=>ctx.revert();
  },[]);

  useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language==="ar"?"rtl":"ltr";window.localStorage.setItem("testdz-landing-language",language);},[language]);
  useEffect(()=>{
    if(!identityApi.isConfigured())return;
    identityApi.getSession().then(({data})=>{
      if(!data.session){navigate("/auth",{replace:true});return;}
      const savedRole=data.session.user.user_metadata?.account_type;
      if(!roleFromState&&(savedRole==="tester"||savedRole==="developer"||savedRole==="both"))setRole(savedRole);
    });
  },[navigate,roleFromState]);

  function toggle(group:GroupKey,id:string){
    const setter=group==="testing"?setTesting:group==="skills"?setSkills:setOther;
    setter(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  }
  function clearAll(){setTesting([]);setSkills([]);setOther([]);}
  async function finish(skip=false){
    if(!identityApi.isConfigured()){setError(t.config);return;}
    setBusy(true);setError("");
    const roles=role==="both"?["tester","developer"]:[role];
    const interests=skip?[]:selected;
    try {
      const {error:saveError}=await profilesApi.completeOnboarding(roles,interests);
      if(saveError) {
        setError(t.error);
      } else {
        // Refresh shared identity state after the RPC commits the role rows.
        await refreshRoles();
        navigate("/complete-profile",{replace:true});
      }
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  return <main ref={rootRef} className="interests-page" dir={language==="ar"?"rtl":"ltr"} lang={language}>
    <div className="interest-bg interest-bg-top"/><div className="interest-bg interest-bg-bottom"/>
    <header className="interest-header"><Brand/><div className="interest-language" role="group" aria-label={t.language}>{(["en","fr","ar"] as const).map(code=><button key={code} type="button" className={language===code?"active":""} aria-pressed={language===code} onClick={()=>setLanguage(code)}>{code.toUpperCase()}</button>)}</div></header>
    <div className="interest-layout">
      <aside className="interest-art" aria-hidden="true"><div className="interest-art-orbit"/><div className="interest-art-dots"/><div className="interest-art-flask"><Icon name="flask" size={86}/></div><div className="interest-art-bulb"><Icon name="spark" size={28}/></div><div className="interest-art-laptop"><div><Icon name="flask" size={52}/></div></div><div className="interest-art-gear"><Icon name="target" size={67}/></div><div className="interest-art-code">&lt;/&gt;</div></aside>
      <section className="interest-content">
        <Progress/>
        <div className="interest-heading"><span className="interest-eyebrow"><Icon name="spark" size={15}/>{t.progress}</span><h1>{t.title}</h1><p>{t.intro}</p></div>
        <div className={"interest-panels"+(role==="both"?" interest-panels-both":"")}>
          {(role==="tester"||role==="both")&&<section className="interest-panel"><div className="interest-panel-heading"><span className="interest-panel-symbol"><Icon name="target" size={27}/></span><span><strong>{t.testing}</strong><small>{t.testingHint}</small></span></div><div className="interest-options-grid">{testingItems.map(item=><SelectionCard key={item.id} item={item} language={language} selected={testing.includes(item.id)} onClick={()=>toggle("testing",item.id)}/>)}</div></section>}
          {(role==="developer"||role==="both")&&<section className="interest-panel"><div className="interest-panel-heading"><span className="interest-panel-symbol"><Icon name="code" size={27}/></span><span><strong>{t.skills}</strong><small>{t.skillsHint}</small></span></div><div className="interest-options-grid">{skillItems.map(item=><SelectionCard key={item.id} item={item} language={language} selected={skills.includes(item.id)} onClick={()=>toggle("skills",item.id)}/>)}</div></section>}
        </div>
        <section className="interest-other"><div className="interest-section-title"><span><Icon name="spark" size={19}/><strong>{t.other}</strong><small>{t.optional}</small></span><span className="interest-count">{other.length} / {otherItems.length}</span></div><div className="interest-chips">{otherItems.map(item=><InterestChip key={item.id} item={item} language={language} selected={other.includes(item.id)} onClick={()=>toggle("other",item.id)}/>)}</div></section>
        <section className="interest-summary"><div className="interest-summary-top"><span><Icon name="check" size={16}/>{t.selectedLabel}</span><button type="button" onClick={clearAll} disabled={!selected.length}>{t.clear}</button></div><div className="interest-summary-body"><div className="interest-summary-number">{selected.length.toString().padStart(2,"0")}</div><div className="interest-summary-copy"><strong>{selected.length? t.done:t.noSelection}</strong><small>{t.selectedHint}</small></div><div className="interest-summary-pills">{selected.slice(0,5).map(id=><span key={id}>{id}</span>)}{selected.length>5&&<span>+{selected.length-5}</span>}</div></div></section>
        {error&&<div className="interest-error" role="alert">{error}</div>}
        <div className="interest-footer-actions"><button className="interest-back" type="button" onClick={()=>navigate("/onboarding",{state:{choice:role}})}><span aria-hidden="true">←</span>{t.back}</button><button className="interest-skip" type="button" disabled={busy} onClick={()=>finish(true)}>{t.skip}</button><button className="interest-continue" type="button" disabled={busy} onClick={()=>finish(false)}>{busy?t.saving:t.continue}<Icon name="arrow" size={20}/></button></div>
      </section>
    </div>
    <footer className="interest-footer"><Brand/><span className="interest-tagline">{t.footer}</span><nav><a href="/">{t.about}</a><a href="/terms">{t.terms}</a><a href="/privacy">{t.privacy}</a><a href="mailto:support@testdz.com">{t.contact}</a></nav><small>{t.rights}</small></footer>
  </main>;
}
