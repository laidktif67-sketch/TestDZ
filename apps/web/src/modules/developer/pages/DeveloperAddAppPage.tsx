import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import imageCompression from "browser-image-compression";
import { identityApi } from "../../../features/identity/identity-api";
import { createAppWithDistribution, getAppLimit, uploadAppIcon } from "../../../features/apps/apps-api";
import type { AppLimit } from "@testdz/types";
import { appError } from "../../../lib/app-utils";
import DeveloperSidebar from "../components/DeveloperSidebar";
import "../styles/developer-add-app.css";

type Step = 1 | 2 | 3 | 4;
type Category = "games" | "tools" | "education" | "social" | "health" | "other";

const categories: { value: Category; label: string }[] = [
  { value: "games", label: "Games" },
  { value: "tools", label: "Tools" },
  { value: "education", label: "Education" },
  { value: "social", label: "Social" },
  { value: "health", label: "Health & Fitness" },
  { value: "other", label: "Other" },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    apps: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    box: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 7 9 5 9-5M3 7v10l9 5 9-5V7M12 12v10"/></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M20 16.5v2A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-2"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    arrow: <><path d="M4 12h15M13 6l6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.apps}</svg>;
}

export default function DeveloperAddAppPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [limit, setLimit] = useState<AppLimit | null>(null);
  const [name, setName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("tools");
  const [distributionUrl, setDistributionUrl] = useState("");
  const [icon, setIcon] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createdAppId, setCreatedAppId] = useState("");

  useEffect(() => {
    if (!identityApi.isConfigured()) {
      setError("Supabase is not configured.");
      return;
    }
    void getAppLimit().then(({ data, error: loadError }) => {
      if (loadError) setError("Could not check your application plan limit.");
      else setLimit(Array.isArray(data) ? data[0] ?? null : data as AppLimit);
    });
  }, []);

  useEffect(() => {
    if (!icon) { setPreview(""); return; }
    const url = URL.createObjectURL(icon);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [icon]);

  async function chooseIcon(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Choose a PNG or JPG image.");
      return;
    }
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.45, maxWidthOrHeight: 512, useWebWorker: true });
      setIcon(new File([compressed], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: compressed.type || "image/jpeg" }));
      setError("");
    } catch {
      setError("Could not process this image. Please choose another.");
    }
  }

  function validateStepOne() {
    if (name.trim().length < 3 || name.trim().length > 50) return "App name must be between 3 and 50 characters.";
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName.trim())) return "Enter a valid package ID, e.g. com.example.myapp.";
    if (description.trim().length < 20 || description.trim().length > 500) return "Description must be between 20 and 500 characters.";
    return "";
  }

  function validateStepTwo() {
    try {
      const url = new URL(distributionUrl.trim());
      if (url.protocol !== "https:" || !url.hostname.includes(".")) return "Enter a valid HTTPS distribution link.";
      return "";
    } catch {
      return "Enter a valid HTTPS distribution link.";
    }
  }

  function nextFromInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateStepOne();
    setError(validation);
    if (!validation) { setError(""); setStep(2); }
  }

  function nextFromDistribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateStepTwo();
    setError(validation);
    if (!validation) { setError(""); setStep(3); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const infoError = validateStepOne();
    const distributionError = validateStepTwo();
    if (infoError || distributionError) { setError(infoError || distributionError); setStep(infoError ? 1 : 2); return; }
    if (!identityApi.isConfigured()) { setError("Supabase is not configured."); return; }
    setBusy(true); setError(""); setNotice("");
    const { data: appId, error: createError } = await createAppWithDistribution({
      name: name.trim(),
      packageName: packageName.trim(),
      description: description.trim(),
      category,
      distributionUrl: distributionUrl.trim(),
    });
    if (createError || !appId) {
      setError(appError(createError?.message ?? "APP_CREATE_FAILED"));
      setBusy(false);
      return;
    }
    const currentUser = await identityApi.getCurrentUser();
    let warning = "";
    if (icon && currentUser.data.user?.id) {
      const result = await uploadAppIcon(currentUser.data.user.id, String(appId), icon, {
        name: name.trim(), description: description.trim(), category,
      });
      if (result.uploadError || result.updateError) warning = "The app was created, but its icon could not be fully saved.";
    }
    setCreatedAppId(String(appId));
    setNotice(warning);
    setStep(4);
    setBusy(false);
  }

  const selectedCategory = categories.find(item => item.value === category)?.label ?? "Other";

  return <main className="daa-shell">
    <DeveloperSidebar />
    <section className="daa-content">
      <header className="daa-topbar">
        <label className="daa-search"><span>⌕</span><input aria-label="Search in TestDZ" placeholder="Search in TestDZ..." /></label>
        <div className="daa-account"><button type="button" aria-label="Notifications" className="daa-bell">♧<i>3</i></button><span className="daa-language">🇫🇷 <b>EN</b>⌄</span><span className="daa-avatar">D</span></div>
      </header>
      <div className="daa-page">
        <nav className="daa-breadcrumb" aria-label="Breadcrumb"><Link to="/apps">My Apps</Link><span>›</span><strong>Add New App</strong></nav>
        <section className="daa-hero"><div className="daa-hero-icon"><Icon name="apps" size={34}/></div><div><h1>Add New App</h1><p>Register your application on TestDZ and make it available for testing</p></div><div className="daa-hero-art" aria-hidden="true"><span>♟</span><span>‹/›</span><span><Icon name="upload" size={42}/></span></div></section>

        <div className="daa-steps" aria-label="Application setup progress">
          {[["App Information",1],["Version & Distribution",2],["Review & Confirm",3],["Complete",4]].map(([label, number]) => {
            const stepNumber = Number(number) as Step;
            return <div className={"daa-step " + (step === stepNumber ? "current" : step > stepNumber ? "done" : "")} key={label as string}><span>{step > stepNumber ? <Icon name="check" size={17}/> : stepNumber}</span><strong>{label}</strong></div>;
          })}
        </div>

        {error && <div className="daa-alert error" role="alert">{error}</div>}
        {notice && step !== 4 && <div className="daa-alert">{notice}</div>}

        {step === 1 && <form className="daa-layout" onSubmit={nextFromInfo}>
          <section className="daa-panel">
            <div className="daa-panel-title"><span><Icon name="box" size={25}/></span><div><h2>Application Information</h2><p>Provide the basic information about your application</p></div></div>
            <div className="daa-form-grid">
              <div className="daa-field daa-icon-field"><label htmlFor="daa-icon">App Icon <em>*</em></label><label className="daa-upload" htmlFor="daa-icon">{preview ? <img src={preview} alt="App icon preview"/> : <><Icon name="upload" size={30}/><strong>Upload Icon</strong><small>PNG or JPG (512 × 512 px)</small></>}<input id="daa-icon" type="file" accept="image/png,image/jpeg" onChange={event => void chooseIcon(event)} /></label></div>
              <label className="daa-field">App Name <em>*</em><input required minLength={3} maxLength={50} value={name} onChange={event => setName(event.target.value)} placeholder="Enter application name..." /><small className="daa-count">{name.length}/50</small></label>
              <label className="daa-field">Package ID <em>*</em><input required dir="ltr" value={packageName} onChange={event => setPackageName(event.target.value)} placeholder="e.g. com.example.myapp" /><small>Use the unique Android application ID.</small></label>
              <label className="daa-field">Category <em>*</em><select value={category} onChange={event => setCategory(event.target.value as Category)}>{categories.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
              <label className="daa-field daa-description">Description <em>*</em><textarea required minLength={20} maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe your application..." /><small className="daa-count">{description.length}/500</small></label>
            </div>
          </section>
          <aside className="daa-aside"><section className="daa-panel daa-preview"><div className="daa-aside-title"><Icon name="eye" size={22}/><h2>Application Preview</h2></div><div className="daa-app-icon">{preview ? <img src={preview} alt=""/> : <Icon name="box" size={48}/>}</div><h3>{name.trim() || "App Name"}</h3><span className="daa-category">{selectedCategory}</span><p>{description.trim() || "A short description of your application will appear here."}</p></section><section className="daa-note"><strong>Before you continue</strong><p>Use the official package ID and a clear description. Your app will be saved as a draft.</p></section></aside>
          <div className="daa-actions"><Link className="daa-button secondary" to="/apps">Cancel</Link><button className="daa-button primary" type="submit">Continue <Icon name="arrow" size={18}/></button></div>
        </form>}

        {step === 2 && <form className="daa-layout" onSubmit={nextFromDistribution}>
          <section className="daa-panel"><div className="daa-panel-title"><span><Icon name="upload" size={25}/></span><div><h2>Version & Distribution</h2><p>Choose how testers will access your application</p></div></div>
            <div className="daa-methods"><div className="daa-method selected"><span className="daa-method-icon"><Icon name="link" size={28}/></span><div><strong>External Link</strong><p>Provide a secure HTTPS link to your app or test build.</p></div><span className="daa-radio selected"/></div><div className="daa-method disabled" aria-disabled="true"><span className="daa-method-icon"><Icon name="upload" size={28}/></span><div><strong>Upload APK File</strong><p>Direct uploads will be available after secure file storage is implemented.</p><small>Coming soon</small></div><span className="daa-radio"/></div></div>
            <label className="daa-field daa-url-field">External Distribution URL <em>*</em><input required type="url" inputMode="url" dir="ltr" value={distributionUrl} onChange={event => setDistributionUrl(event.target.value)} placeholder="https://example.com/my-test-build" /><small>Use HTTPS. If the link is private, make sure invited testers can access it.</small></label>
            <div className="daa-info"><strong>Important</strong><p>Google Play closed testing links may require testers to join the testing program first. TestDZ will store this link; it does not verify the external provider's access permissions.</p></div>
          </section>
          <aside className="daa-aside"><section className="daa-panel daa-preview"><div className="daa-aside-title"><Icon name="eye" size={22}/><h2>Application Preview</h2></div><div className="daa-app-icon">{preview ? <img src={preview} alt=""/> : <Icon name="box" size={48}/>}</div><h3>{name.trim() || "App Name"}</h3><span className="daa-category">{selectedCategory}</span><p>{packageName || "Package ID"}</p></section><section className="daa-note"><strong>Distribution status</strong><p>External link is selected. APK upload is shown as unavailable and cannot be selected yet.</p></section></aside>
          <div className="daa-actions"><button className="daa-button secondary" type="button" onClick={() => { setError(""); setStep(1); }}>Back</button><button className="daa-button primary" type="submit">Review App <Icon name="arrow" size={18}/></button></div>
        </form>}

        {step === 3 && <form className="daa-layout" onSubmit={event => void create(event)}>
          <section className="daa-panel"><div className="daa-panel-title"><span><Icon name="eye" size={25}/></span><div><h2>Review & Confirm</h2><p>Check the details before creating your app</p></div></div><dl className="daa-review"><dt>App Name</dt><dd>{name}</dd><dt>Package ID</dt><dd dir="ltr">{packageName}</dd><dt>Category</dt><dd>{selectedCategory}</dd><dt>Description</dt><dd>{description}</dd><dt>Distribution Method</dt><dd>External Link</dd><dt>Distribution URL</dt><dd dir="ltr"><a href={distributionUrl} target="_blank" rel="noreferrer">{distributionUrl}</a></dd><dt>App Icon</dt><dd>{icon ? icon.name : "No icon uploaded"}</dd></dl><div className="daa-info"><strong>What happens next?</strong><p>TestDZ will create this application as a draft. This does not publish the app or create a test campaign.</p></div></section>
          <aside className="daa-aside"><section className="daa-panel daa-preview"><div className="daa-aside-title"><Icon name="eye" size={22}/><h2>Application Preview</h2></div><div className="daa-app-icon">{preview ? <img src={preview} alt=""/> : <Icon name="box" size={48}/>}</div><h3>{name}</h3><span className="daa-category">{selectedCategory}</span><p>{description}</p></section></aside>
          <div className="daa-actions"><button className="daa-button secondary" type="button" onClick={() => { setError(""); setStep(2); }}>Back</button><button className="daa-button primary" type="submit" disabled={busy || limit?.can_create === false}>{busy ? "Creating App…" : "Create App"} <Icon name="check" size={18}/></button></div>
        </form>}

        {step === 4 && <section className="daa-complete"><span className="daa-complete-icon"><Icon name="check" size={42}/></span><h2>Application Created</h2><p>Your application has been saved as a draft with its external distribution link.</p>{notice && <div className="daa-alert">{notice}</div>}<div className="daa-complete-actions"><button className="daa-button secondary" type="button" onClick={() => navigate("/apps")}>Back to My Apps</button><button className="daa-button primary" type="button" onClick={() => navigate("/apps/" + createdAppId)}>View App Details <Icon name="arrow" size={18}/></button></div></section>}

        {limit && <p className="daa-plan-note">Plan usage: {limit.current_active_apps} of {limit.max_active_apps} active app slots used. {limit.can_create ? "You can add an app." : "Your current plan limit has been reached."}</p>}
      </div>
    </section>
  </main>;
}
