import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AppLimit } from "@testdz/types";
import { createApp, getAppLimit, uploadAppIcon } from "../../../features/apps/apps-api";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import { Brand } from "../../../shared/components/Brand";
import "../../../styles/developer-add-app.css";

type Category = "games" | "tools" | "education" | "social" | "health" | "other";

const categories: Array<{ value: Category; label: string }> = [
  { value: "games", label: "Games" },
  { value: "tools", label: "Tools" },
  { value: "education", label: "Education" },
  { value: "social", label: "Social" },
  { value: "health", label: "Health & Fitness" },
  { value: "other", label: "Other" },
];

function validatePackageName(value: string) {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value.trim());
}

export default function DeveloperAddAppPage() {
  const navigate = useNavigate();
  const { user, loading: identityLoading } = useIdentity();
  const [limit, setLimit] = useState<AppLimit | null>(null);
  const [limitLoading, setLimitLoading] = useState(true);
  const [name, setName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("tools");
  const [icon, setIcon] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createdAppId, setCreatedAppId] = useState("");

  useEffect(() => {
    let active = true;
    if (!user) {
      if (!identityLoading) navigate("/auth", { replace: true });
      return () => { active = false; };
    }
    void getAppLimit().then(({ data, error: requestError }) => {
      if (!active) return;
      if (requestError) setError("Could not check your application plan limit. The server will still validate app creation.");
      else {
        const row = Array.isArray(data) ? data[0] : data;
        setLimit((row ?? null) as AppLimit | null);
      }
      setLimitLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("Could not check your application plan limit.");
      setLimitLoading(false);
    });
    return () => { active = false; };
  }, [identityLoading, navigate, user]);

  useEffect(() => {
    if (!icon) { setPreview(""); return; }
    const url = URL.createObjectURL(icon);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [icon]);

  function chooseIcon(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) { setIcon(null); return; }
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Choose a PNG or JPG image.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("The app icon must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }
    setError("");
    setIcon(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!user) { setError("Your session is no longer available. Sign in again."); return; }
    if (name.trim().length < 3 || name.trim().length > 50) {
      setError("App name must be between 3 and 50 characters.");
      return;
    }
    if (!validatePackageName(packageName)) {
      setError("Enter a valid package ID, for example com.example.myapp.");
      return;
    }
    if (description.trim().length < 20 || description.trim().length > 500) {
      setError("Description must be between 20 and 500 characters.");
      return;
    }
    if (limit?.can_create === false) {
      setError("Your current plan has reached its active application limit.");
      return;
    }

    setBusy(true);
    try {
      const { data: appId, error: createError } = await createApp({
        name: name.trim(),
        packageName: packageName.trim(),
        description: description.trim(),
        category,
      });
      if (createError || !appId) {
        setError(createError?.message ?? "The application could not be created.");
        return;
      }

      const id = String(appId);
      setCreatedAppId(id);
      if (icon) {
        const upload = await uploadAppIcon(user.id, id, icon, {
          name: name.trim(),
          description: description.trim(),
          category,
        });
        if (upload.uploadError || upload.updateError) {
          setNotice("Your app was created as a draft, but the icon could not be fully saved. You can add it later from app details.");
        } else {
          setNotice("Your app and icon were saved as a draft.");
        }
      } else {
        setNotice("Your app was saved as a draft.");
      }
    } catch {
      setError("Something went wrong while creating the application. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (createdAppId) {
    return (
      <main className="developer-add-app-shell">
        <header className="developer-add-app-topbar"><Brand /></header>
        <section className="developer-add-app-success" aria-live="polite">
          <span className="developer-add-app-success-mark" aria-hidden="true">✓</span>
          <p className="developer-add-app-eyebrow">DEVELOPER WORKSPACE</p>
          <h1>Application created</h1>
          <p>{notice}</p>
          <div className="developer-add-app-actions">
            <Link className="developer-add-app-button secondary" to="/apps">Back to My Apps</Link>
            <button className="developer-add-app-button primary" type="button" onClick={() => navigate("/apps/" + createdAppId)}>View app details</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="developer-add-app-shell">
      <header className="developer-add-app-topbar"><Brand /><Link to="/apps">← Back to My Apps</Link></header>
      <section className="developer-add-app-page">
        <nav className="developer-add-app-breadcrumb" aria-label="Breadcrumb"><Link to="/developer-dashboard">Developer workspace</Link><span>/</span><Link to="/apps">My Apps</Link><span>/</span><strong>Add app</strong></nav>
        <div className="developer-add-app-heading">
          <div><p className="developer-add-app-eyebrow">DEVELOPER WORKSPACE</p><h1>Add a new application</h1><p>Register your application on TestDZ. It will be created as a draft and will not be published automatically.</p></div>
          <div className="developer-add-app-heading-art" aria-hidden="true">＋</div>
        </div>

        {error && <div className="developer-add-app-alert error" role="alert">{error}</div>}
        {notice && <div className="developer-add-app-alert" role="status">{notice}</div>}

        <form className="developer-add-app-grid" onSubmit={submit}>
          <section className="developer-add-app-card">
            <div className="developer-add-app-card-title"><span>01</span><div><h2>Application information</h2><p>Enter the details testers will use to identify your app.</p></div></div>
            <div className="developer-add-app-form-grid">
              <label className="developer-add-app-field">Application name
                <input required minLength={3} maxLength={50} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. My productivity app" />
                <small>{name.length}/50 characters</small>
              </label>
              <label className="developer-add-app-field">Android package ID
                <input required dir="ltr" autoCapitalize="none" spellCheck={false} value={packageName} onChange={event => setPackageName(event.target.value)} placeholder="com.example.myapp" />
                <small>Use the unique application ID from your Android project.</small>
              </label>
              <label className="developer-add-app-field">Category
                <select value={category} onChange={event => setCategory(event.target.value as Category)}>{categories.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
              </label>
              <label className="developer-add-app-field developer-add-app-description">Description
                <textarea required minLength={20} maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe what your application does and what testers should know." />
                <small>{description.length}/500 characters</small>
              </label>
            </div>
          </section>

          <aside className="developer-add-app-side">
            <section className="developer-add-app-card">
              <div className="developer-add-app-card-title"><span>02</span><div><h2>Application icon</h2><p>Optional · PNG or JPG · up to 2 MB</p></div></div>
              <label className="developer-add-app-icon-upload">
                {preview ? <img src={preview} alt="Application icon preview" /> : <><span aria-hidden="true">↑</span><strong>Choose an icon</strong><small>PNG or JPG</small></>}
                <input type="file" accept="image/png,image/jpeg" onChange={chooseIcon} />
              </label>
              {icon && <button className="developer-add-app-remove-icon" type="button" onClick={() => setIcon(null)}>Remove selected icon</button>}
            </section>
            <section className="developer-add-app-plan">
              <strong>Plan usage</strong>
              {limitLoading ? <p>Checking your app limit…</p> : limit ? <><p>{limit.current_active_apps} of {limit.max_active_apps} active app slots used</p><div className="developer-add-app-progress"><i style={{ width: Math.min(100, limit.max_active_apps ? limit.current_active_apps / limit.max_active_apps * 100 : 0) + "%" }} /></div>{!limit.can_create && <small>Your active app limit has been reached.</small>}</> : <p>Your plan limit could not be loaded. The server will validate creation.</p>}
            </section>
          </aside>

          <div className="developer-add-app-footer">
            <Link className="developer-add-app-button secondary" to="/apps">Cancel</Link>
            <button className="developer-add-app-button primary" type="submit" disabled={busy || limitLoading || limit?.can_create === false}>{busy ? "Creating…" : "Create draft app"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
