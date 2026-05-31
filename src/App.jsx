import { Component, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Camera,
  Check,
  HeartHandshake,
  History,
  Home,
  ImagePlus,
  Loader2,
  Lock,
  LogOut,
  Settings,
  Shield,
  Sparkles,
  X
} from "lucide-react";
import { api, fileToDataUrl } from "./api.js";

const DISCLAIMER =
  "AKRIVO Skin provides skincare guidance and wellness insights only. It is not a medical device, does not provide medical diagnosis, and does not replace advice from a qualified dermatologist or doctor.";

const FINAL_DISCLAIMER =
  "AKRIVO Skin is a skincare wellness app. AI results may be inaccurate and should not be considered medical advice. For severe, painful, infected, rapidly changing, or concerning skin symptoms, consult a qualified healthcare professional.";

const LOGO_SRC = "/api/brand/logo";

const concernOptions = ["acne", "pimples", "blackheads", "pigmentation", "dark spots", "redness", "dullness", "oily skin", "dry skin", "pores", "uneven tone"];
const redFlags = ["Severe painful acne", "Sudden rash", "Swelling", "Bleeding or infected-looking skin", "Rapidly spreading irritation", "Severe burning after product use", "Eye-area infection signs", "Skin condition worsening quickly", "Suspicious mole or lesion changes"];

export default function App() {
  return (
    <ErrorBoundary>
      <AkrivoApp />
    </ErrorBoundary>
  );
}

function AkrivoApp() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("welcome");
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/auth/me")
      .then(data => {
        setUser(data.user);
        setScreen(data.user?.skinProfile ? "dashboard" : "onboarding");
      })
      .catch(() => setScreen("welcome"))
      .finally(() => setLoading(false));
  }, []);

  function navigate(next) {
    setHistory(current => (screen === next ? current : [...current, screen]));
    setScreen(next);
  }

  function back() {
    const previous = history.at(-1);
    setHistory(current => current.slice(0, -1));
    setScreen(previous || (user ? "dashboard" : "welcome"));
  }

  function notify(message) {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 2600);
  }

  async function refreshUser() {
    const data = await api("/api/auth/me");
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    setUser(null);
    setHistory([]);
    setScreen("welcome");
  }

  if (loading) return <ShellSkeleton />;

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6">
      <header className="mb-4 flex min-h-16 items-center gap-3">
        <button className={`grid h-11 w-11 place-items-center rounded-lg bg-[#f1e8df] font-black ${history.length ? "" : "invisible"}`} onClick={back} aria-label="Back">
          <ArrowLeft size={19} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <img src={LOGO_SRC} alt="AKRIVO Skin" className="h-12 w-12 rounded-lg object-contain" />
          <div className="min-w-0">
            <p className="eyebrow">AI skincare companion</p>
            <h1 className="text-2xl font-black tracking-normal">AKRIVO Skin</h1>
          </div>
        </div>
        {user && (
          <button className="grid h-11 w-11 place-items-center rounded-lg bg-[#f1e8df]" onClick={logout} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        )}
      </header>

      {!user && screen === "welcome" && <Welcome onNavigate={navigate} />}
      {!user && ["login", "signup", "forgot"].includes(screen) && <AuthScreen mode={screen} onUser={setUser} onNavigate={navigate} notify={notify} />}
      {user && screen === "onboarding" && <OnboardingScreen onUser={setUser} onNavigate={navigate} notify={notify} />}
      {user && screen === "photo" && <PhotoScreen onUser={setUser} onNavigate={navigate} notify={notify} />}
      {user && screen === "dashboard" && <Dashboard user={user} onNavigate={navigate} />}
      {user && screen === "routine" && <RoutineScreen user={user} refreshUser={refreshUser} notify={notify} onNavigate={navigate} />}
      {user && screen === "progress" && <ProgressScreen user={user} onUser={setUser} onNavigate={navigate} notify={notify} />}
      {user && screen === "duo" && <DuoScreen user={user} onUser={setUser} notify={notify} />}
      {user && screen === "settings" && <SettingsScreen user={user} onUser={setUser} notify={notify} onNavigate={navigate} />}
      {user && screen === "privacy" && <PrivacyScreen user={user} onUser={setUser} notify={notify} />}
      {screen === "legal" && <LegalScreen onNavigate={navigate} />}
      {screen === "privacyPolicy" && <PrivacyPolicyScreen />}
      {screen === "terms" && <TermsScreen />}

      {user && <BottomNav screen={screen} onNavigate={navigate} />}
      <FooterDisclaimer onNavigate={navigate} />
      {toast && <div className="fixed bottom-5 left-1/2 z-30 w-[min(420px,calc(100%-32px))] -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm font-black text-white shadow-soft">{toast}</div>}
    </div>
  );
}

function Welcome({ onNavigate }) {
  return (
    <main className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <section className="min-h-[440px] overflow-hidden rounded-lg border border-white/70 bg-[linear-gradient(135deg,rgba(255,253,249,.92),rgba(247,216,210,.55))] p-6 shadow-soft sm:p-10">
        <img src={LOGO_SRC} alt="AKRIVO Skin" className="mb-6 h-28 w-28 rounded-lg object-contain sm:h-36 sm:w-36" />
        <p className="eyebrow">Welcome</p>
        <h2 className="max-w-3xl text-5xl font-black leading-none tracking-normal sm:text-6xl">Understand your skin without making it complicated.</h2>
        <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#625a55]">Upload a clear skin photo, answer a short questionnaire, and get confidence-based routine guidance, progress tracking, reminders, and safety notes.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary" onClick={() => onNavigate("signup")}>Create account</button>
          <button className="btn-secondary" onClick={() => onNavigate("login")}>Login</button>
        </div>
      </section>
      <aside className="card grid content-start gap-4">
        <Sparkles className="text-rose" />
        <p className="font-black">{DISCLAIMER}</p>
        <p className="muted">No diagnosis, no prescriptions, no appearance scoring, and no face identification.</p>
        <button className="btn-secondary" onClick={() => onNavigate("legal")}>Read disclaimer</button>
      </aside>
    </main>
  );
}

function AuthScreen({ mode, onUser, onNavigate, notify }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "forgot") {
        await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: form.email }) });
        notify("If this email exists, a reset email can be sent after email delivery is configured.");
        return;
      }
      const data = await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(form) });
      onUser(data.user);
      onNavigate(data.user.skinProfile ? "dashboard" : "onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md">
      <section className="card">
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg bg-[#f4eee6] p-1">
          {["login", "signup", "forgot"].map(item => (
            <button key={item} className={`min-h-10 rounded-md text-sm font-black ${mode === item ? "bg-white shadow" : "text-[#73716d]"}`} onClick={() => onNavigate(item)}>
              {item === "forgot" ? "Forgot" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Email" value={form.email} onChange={email => setForm({ ...form, email })} type="email" placeholder="you@example.com" />
          {mode !== "forgot" && <Field label="Password" value={form.password} onChange={password => setForm({ ...form, password })} type="password" placeholder="Minimum 8 characters" />}
          <button className="btn-primary" disabled={busy}>{busy ? "Please wait..." : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Login"}</button>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        </form>
      </section>
    </main>
  );
}

function OnboardingScreen({ onUser, onNavigate, notify }) {
  const [form, setForm] = useState({ name: "", ageRange: "", country: "", skinType: "unknown", currentRoutine: "", allergies: "", budgetLevel: "medium", sensitivityLevel: "unknown", concerns: [], redFlags: [], consentAccepted: false, guardianConsentAccepted: false, photoConsentAccepted: false, aiProcessingConsentAccepted: false, understandsWellnessOnly: false });
  const [error, setError] = useState("");

  function toggle(list, value) {
    setForm(current => ({ ...current, [list]: current[list].includes(value) ? current[list].filter(item => item !== value) : [...current[list], value] }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const data = await api("/api/onboarding", { method: "POST", body: JSON.stringify(form) });
      onUser(data.user);
      notify("Profile saved");
      onNavigate("photo");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="grid gap-4">
      <Heading eyebrow="Onboarding" title="Your skin profile" copy="A few basics help keep your routine simple and relevant." />
      <form onSubmit={submit} className="card grid gap-5">
        <SectionTitle title="Basic details" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" value={form.name} onChange={name => setForm({ ...form, name })} placeholder="Your name" />
          <Select label="Age range" value={form.ageRange} onChange={ageRange => setForm({ ...form, ageRange })} options={["", "13-17", "18-24", "25-34", "35-44", "45+"]} />
          <Field label="Country or region" value={form.country} onChange={country => setForm({ ...form, country })} placeholder="India, United States, UAE..." />
          <Select label="Skin type" value={form.skinType} onChange={skinType => setForm({ ...form, skinType })} options={["unknown", "oily", "dry", "combination", "sensitive", "normal"]} />
          <Select label="Budget level" value={form.budgetLevel} onChange={budgetLevel => setForm({ ...form, budgetLevel })} options={["low", "medium", "high"]} />
          <Select label="Sensitivity level" value={form.sensitivityLevel} onChange={sensitivityLevel => setForm({ ...form, sensitivityLevel })} options={["unknown", "low", "medium", "high"]} />
        </div>
        <ChipGroup title="Skin concerns" values={concernOptions} selected={form.concerns} onToggle={value => toggle("concerns", value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea label="Current routine" value={form.currentRoutine} onChange={currentRoutine => setForm({ ...form, currentRoutine })} placeholder="Cleanser, moisturizer, sunscreen sometimes..." />
          <TextArea label="Allergies or sensitivities" value={form.allergies} onChange={allergies => setForm({ ...form, allergies })} placeholder="Fragrance, essential oils..." />
        </div>
        <ChipGroup title="Safety check" values={redFlags} selected={form.redFlags} onToggle={value => toggle("redFlags", value)} danger />
        <label className="flex gap-3 rounded-lg border border-[#eee4d9] bg-white p-4 text-sm font-bold leading-6">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#2f7567]" checked={form.consentAccepted} onChange={event => setForm({ ...form, consentAccepted: event.target.checked })} />
          <span>I accept the privacy notice and understand I can delete photos, export data, delete my account, and withdraw consent where legally applicable.</span>
        </label>
        <label className="flex gap-3 rounded-lg border border-[#eee4d9] bg-white p-4 text-sm font-bold leading-6">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#2f7567]" checked={form.photoConsentAccepted} onChange={event => setForm({ ...form, photoConsentAccepted: event.target.checked })} />
          <span>I agree to upload only my own photo or a photo I have permission to use.</span>
        </label>
        <label className="flex gap-3 rounded-lg border border-[#eee4d9] bg-white p-4 text-sm font-bold leading-6">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#2f7567]" checked={form.aiProcessingConsentAccepted} onChange={event => setForm({ ...form, aiProcessingConsentAccepted: event.target.checked })} />
          <span>I agree that my photo may be processed for skin wellness insights.</span>
        </label>
        <label className="flex gap-3 rounded-lg border border-[#eee4d9] bg-white p-4 text-sm font-bold leading-6">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#2f7567]" checked={form.understandsWellnessOnly} onChange={event => setForm({ ...form, understandsWellnessOnly: event.target.checked })} />
          <span>I understand this is not medical advice and does not replace a qualified dermatologist or doctor.</span>
        </label>
        {form.ageRange === "13-17" && <label className="flex gap-3 rounded-lg border border-[#eee4d9] bg-[#fff8f1] p-4 text-sm font-bold leading-6">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#2f7567]" checked={form.guardianConsentAccepted} onChange={event => setForm({ ...form, guardianConsentAccepted: event.target.checked })} />
          <span>I confirm parent or guardian consent where required in my region. AKRIVO Skin does not allow targeted advertising to children.</span>
        </label>}
        {error && <ErrorBox message={error} />}
        <button className="btn-primary">Save profile</button>
      </form>
    </main>
  );
}

function PhotoScreen({ onUser, onNavigate, notify }) {
  const [preview, setPreview] = useState("");
  const [imageId, setImageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function choose(file) {
    if (!file) return;
    setError("");
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    const uploaded = await api("/api/images/upload", { method: "POST", body: JSON.stringify({ dataUrl, uploadPurpose: "analysis", ownPhotoConsent: true, aiProcessingConsent: true, wellnessOnlyConsent: true }) });
    setImageId(uploaded.image.id);
  }

  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/analysis/create", { method: "POST", body: JSON.stringify({ imageId }) });
      setResult(data.aiOutput);
      onUser(data.user);
      notify("Analysis ready");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (busy) return <LoadingAnalysis />;
  if (result) return <AnalysisResult result={result} onDashboard={() => onNavigate("dashboard")} />;

  return (
    <main className="grid gap-4">
      <Heading eyebrow="Photo" title="Upload a skin photo" copy="Use natural light, no heavy filters, no makeup if possible, and keep your face visible." />
      <DisclaimerNotice />
      <p className="rounded-lg border border-[#eee4d9] bg-white p-4 text-sm font-black">By uploading, you confirm this is your own photo or you have permission, and you agree it may be processed for skin wellness insights. You can delete photos and your account.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {["Use natural light", "No heavy filters", "No makeup if possible", "Keep face visible", "Do not upload someone else without permission"].map(tip => <div className="card grid min-h-20 place-items-center text-center text-sm font-black" key={tip}>{tip}</div>)}
      </div>
      <section className="card grid gap-4">
        <label className="grid min-h-60 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-[#d9b8ad] bg-[#fff8f1] p-6 text-center">
          <input className="sr-only" type="file" accept="image/*" onChange={event => choose(event.target.files?.[0])} />
          {preview ? <img src={preview} alt="Selected skin preview" className="max-h-96 w-full rounded-lg object-cover" /> : <span className="grid gap-2"><ImagePlus className="mx-auto text-rose" /><strong>Choose a clear photo</strong><small className="muted">You can retake or reupload before analysis.</small></span>}
        </label>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary" disabled={!imageId} onClick={analyze}>Analyze skin</button>
      </section>
    </main>
  );
}

function LoadingAnalysis() {
  return (
    <main className="grid gap-4">
      <Heading eyebrow="Analysis" title="Reading your skin profile" copy="Combining your photo and questionnaire. This is wellness guidance only." />
      <DisclaimerNotice />
      <section className="card grid gap-4">
        <div className="skeleton h-44" />
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-5 w-1/2" />
      </section>
    </main>
  );
}

function AnalysisResult({ result, onDashboard }) {
  return (
    <main className="grid gap-4">
      <Heading eyebrow="Analysis result" title="Your guidance is ready" copy="Everything is confidence-based skin wellness guidance." />
      <DisclaimerNotice />
      <section className="card grid gap-4">
        <p className="font-black">Skin type estimate: {result.skinTypeEstimate}</p>
        <ConcernList concerns={result.visibleConcerns} />
        {result.redFlags?.length > 0 && <Warning flags={result.redFlags} />}
        <p className="muted">{FINAL_DISCLAIMER}</p>
        <button className="btn-primary" onClick={onDashboard}>Go to dashboard</button>
      </section>
    </main>
  );
}

function Dashboard({ user, onNavigate }) {
  const routine = user.latestRoutine;
  const analysis = user.latestAnalysis?.aiFindings;
  const today = new Date().toISOString().slice(0, 10);
  const history = user.routineHistory || [];
  const morningDone = history.some(item => item.date === today && item.routineType === "morning" && item.completedAt);
  const nightDone = history.some(item => item.date === today && item.routineType === "night" && item.completedAt);

  return (
    <main className="grid gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <Heading eyebrow="Dashboard" title={`${user.name || "Your"}'s routine`} copy="Short routines, simple reminders, and private progress tracking." />
        <button className="btn-secondary" onClick={() => onNavigate("photo")}><Camera className="mr-2 inline" size={17} />New photo</button>
      </div>
      {analysis?.redFlags?.length > 0 && <Warning flags={analysis.redFlags} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Morning" value={morningDone ? "Done" : "Open"} />
        <Stat label="Night" value={nightDone ? "Done" : "Open"} />
        <Stat label="Next reminder" value={user.settings?.skipToday ? "Skipped" : user.settings?.remindersEnabled ? formatTime(morningDone ? user.settings.nightTime : user.settings.morningTime) : "Off"} />
      </div>
      {routine ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <RoutineCard title="Morning" steps={routine.morningSteps} onStart={() => onNavigate("routine")} />
          <RoutineCard title="Night" steps={routine.nightSteps} onStart={() => onNavigate("routine")} />
        </div>
      ) : <Empty title="No routine yet" copy="Upload a photo and create an analysis to generate your first routine." action="Upload photo" onAction={() => onNavigate("photo")} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h3 className="mb-3 text-lg font-black">Skin concern summary</h3>
          {analysis ? <ConcernList concerns={analysis.visibleConcerns} /> : <p className="muted">No analysis yet.</p>}
        </section>
        <section className="card">
          <h3 className="mb-3 text-lg font-black">Product categories</h3>
          <ul className="list-disc pl-5 text-sm leading-7">{(analysis?.productCategories || []).map(item => <li key={item}>{item}</li>)}</ul>
          <p className="muted mt-3">No prescription products are suggested. Patch test first; results vary. Sponsored or affiliate content must be clearly disclosed if added later.</p>
        </section>
      </div>
    </main>
  );
}

function RoutineScreen({ user, refreshUser, notify, onNavigate }) {
  const [type, setType] = useState("morning");
  const [index, setIndex] = useState(0);
  const routine = user.latestRoutine;
  const steps = type === "night" ? routine?.nightSteps || [] : routine?.morningSteps || [];
  const step = steps[index];

  async function mark(skipped) {
    if (!step) return;
    const path = skipped ? "/api/routine/skip-step" : "/api/routine/step-complete";
    await api(path, { method: "POST", body: JSON.stringify({ routineType: type, stepName: step.stepName }) });
    if (index < steps.length - 1) {
      setIndex(index + 1);
      notify(skipped ? "Step skipped" : `Done: ${step.stepName}`);
    } else {
      await refreshUser();
      notify(`${type === "morning" ? "Morning" : "Night"} routine complete`);
      onNavigate("dashboard");
    }
  }

  if (!routine) return <Empty title="No routine yet" copy="Generate a routine from your first analysis." action="Upload photo" onAction={() => onNavigate("photo")} />;

  return (
    <main className="grid gap-4">
      <Heading eyebrow="Today's routine" title={step?.stepName || "Routine"} copy={step?.instruction || "Choose morning or night to begin."} />
      <div className="grid grid-cols-2 gap-2">
        {["morning", "night"].map(item => <button key={item} className={type === item ? "btn-primary" : "btn-secondary"} onClick={() => { setType(item); setIndex(0); }}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>
      <section className="card grid gap-4">
        <div className="h-3 overflow-hidden rounded-full bg-[#f0e8df]"><div className="h-full rounded-full bg-gradient-to-r from-[#2f7567] to-rose" style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Stat label="Duration" value={step?.estimatedDuration || "1 min"} />
          <Stat label="Step" value={`${index + 1} of ${steps.length}`} />
        </div>
        {step?.warning && <p className="rounded-lg border border-[#efc0ba] bg-[#fff4f1] p-3 text-sm font-bold text-[#894842]">{step.warning}</p>}
        <p className="muted">After Done, the next reminder can wait {user.settings?.stepDelayMinutes || 10} minutes when a pause is needed.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="btn-secondary" onClick={() => mark(true)}><X className="mr-2 inline" size={17} />Skip</button>
          <button className="btn-primary" onClick={() => mark(false)}><Check className="mr-2 inline" size={17} />Done</button>
        </div>
      </section>
    </main>
  );
}

function ProgressScreen({ user, onUser, onNavigate, notify }) {
  const [preview, setPreview] = useState("");
  const [imageId, setImageId] = useState("");
  const [notes, setNotes] = useState("");
  const [concerns, setConcerns] = useState([]);
  const [compare, setCompare] = useState(false);
  const entries = user.progress || [];

  async function choose(file) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    const uploaded = await api("/api/images/upload", { method: "POST", body: JSON.stringify({ dataUrl, uploadPurpose: "progress", ownPhotoConsent: true, aiProcessingConsent: false, wellnessOnlyConsent: true }) });
    setImageId(uploaded.image.id);
  }

  async function save(event) {
    event.preventDefault();
    const data = await api("/api/progress/photo", { method: "POST", body: JSON.stringify({ imageId, notes, concerns, visibility: "private" }) });
    onUser(data.user);
    setPreview("");
    setImageId("");
    setNotes("");
    setConcerns([]);
    notify("Progress saved privately");
  }

  async function deleteEntry(entryId) {
    const data = await api(`/api/progress/${entryId}`, { method: "DELETE" });
    onUser(data.user);
    notify("Progress photo entry deleted");
  }

  return (
    <main className="grid gap-4">
      <Heading eyebrow="Progress" title="Self-tracked progress" copy="Weekly photos and notes are private. Progress is your own record, not guaranteed AI proof." />
      <p className="rounded-lg border border-[#eee4d9] bg-white p-4 text-sm font-black">Progress photos are private and should only be uploaded by the account owner.</p>
      <form onSubmit={save} className="card grid gap-4">
        <label className="grid min-h-44 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-[#d9b8ad] bg-[#fff8f1] p-4 text-center">
          <input className="sr-only" type="file" accept="image/*" onChange={event => choose(event.target.files?.[0])} />
          {preview ? <img src={preview} alt="Progress preview" className="max-h-72 w-full rounded-lg object-cover" /> : <span><ImagePlus className="mx-auto text-rose" />Upload weekly progress photo</span>}
        </label>
        <TextArea label="Notes" value={notes} onChange={setNotes} placeholder="What changed this week?" />
        <ChipGroup title="Concerns this week" values={concernOptions.slice(0, 7)} selected={concerns} onToggle={value => setConcerns(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])} />
        <button className="btn-primary" disabled={!imageId}>Save progress</button>
      </form>
      <section className="card">
        <h3 className="mb-3 text-lg font-black">Progress timeline</h3>
        {entries.length ? entries.map(entry => (
          <div key={entry.id} className="grid gap-2 border-b border-[#eee4d9] py-3 last:border-b-0">
            <TimelineItem title="Weekly progress" date={entry.createdAt} copy={entry.notes || "Photo saved privately"} />
            <button className="justify-self-start text-sm font-black text-red-700" onClick={() => deleteEntry(entry.id)}>Delete this photo entry</button>
          </div>
        )) : <Empty title="No progress entries yet" copy="Add a weekly photo when you are ready." />}
        <button className="btn-secondary mt-4 w-full" disabled={entries.length < 2} onClick={() => setCompare(!compare)}>Compare previous and latest</button>
      </section>
      {compare && entries.length >= 2 && <div className="grid gap-3 sm:grid-cols-2"><CompareCard label="Previous" /><CompareCard label="Latest" /></div>}
    </main>
  );
}

function DuoScreen({ user, onUser, notify }) {
  const duo = user.duo;
  const [code, setCode] = useState("");

  async function create() {
    const data = await api("/api/duo/create-code", { method: "POST" });
    onUser(data.user);
    notify("Duo code created");
  }

  async function join(event) {
    event.preventDefault();
    const data = await api("/api/duo/join", { method: "POST", body: JSON.stringify({ duoCode: code }) });
    onUser(data.user);
    setCode("");
    notify("Joined duo");
  }

  async function disconnect() {
    const data = await api("/api/duo/disconnect", { method: "DELETE" });
    onUser(data.user);
    notify("Duo disconnected");
  }

  return (
    <main className="grid gap-4">
      <Heading eyebrow="Duo plan" title="Support each other's routine" copy="Use a duo code only. Each partner must have their own email login." />
      <section className="card grid gap-4">
        {!duo && <Empty title="No duo yet" copy="Create a code or enter your partner's code. No phone, SMS, or WhatsApp invite is used." />}
        {duo && <div className="grid gap-4">
          <div className="rounded-lg bg-[#edf5ef] p-5 text-center"><p className="muted font-black">Duo code</p><strong className="text-4xl tracking-widest">{duo.duoCode}</strong></div>
          {duo.partner ? <div className="rounded-lg border border-[#eee4d9] bg-white p-4">
            <h3 className="text-lg font-black">{duo.partner.name}</h3>
            <p className="muted">Partner completed morning routine: {duo.partner.routineStatus ? yesNo(duo.partner.routineStatus.morning) : "Private"}</p>
            <p className="muted">Partner completed night routine: {duo.partner.routineStatus ? yesNo(duo.partner.routineStatus.night) : "Private"}</p>
            <p className="muted">Partner streak: {duo.partner.streak ?? "Private"}</p>
            <p className="mt-3 rounded-lg bg-[#fff8f1] p-3 text-sm font-bold">Encouragement: small routines count. Support each other without pressure.</p>
          </div> : <Empty title="Waiting for partner" copy="Ask your partner to login with their own email and enter this code." />}
        </div>}
        <button className="btn-primary" onClick={create}>Create duo code</button>
        <form onSubmit={join} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className="input" value={code} onChange={event => setCode(event.target.value)} placeholder="Enter duo code" />
          <button className="btn-secondary">Join</button>
        </form>
        {duo && <button className="font-black text-red-700" onClick={disconnect}>Disconnect duo</button>}
      </section>
    </main>
  );
}

function SettingsScreen({ user, onUser, notify, onNavigate }) {
  const [settings, setSettings] = useState(user.settings);
  const [abuseMessage, setAbuseMessage] = useState("");
  const [correction, setCorrection] = useState({ name: user.name || "", ageRange: user.ageRange || "", country: user.country || "" });
  const [breachSummary, setBreachSummary] = useState("");

  async function save(event) {
    event.preventDefault();
    const data = await api("/api/settings", { method: "PATCH", body: JSON.stringify(settings) });
    onUser(data.user);
    notify("Settings saved");
  }

  async function deleteAccount() {
    if (!window.confirm("Delete this AKRIVO Skin account and its local data? This cannot be undone.")) return;
    await api("/api/account/delete", { method: "DELETE" });
    onUser(null);
    notify("Account deleted");
    onNavigate("welcome");
  }

  async function saveCorrection() {
    const data = await api("/api/account/profile", { method: "PATCH", body: JSON.stringify(correction) });
    onUser(data.user);
    notify("Account details corrected");
  }

  async function withdrawConsent() {
    if (!window.confirm("Withdraw consent for non-essential photo and AI processing? You can still access your account and delete/export data.")) return;
    const data = await api("/api/consent/withdraw", { method: "POST" });
    onUser(data.user);
    notify("Consent withdrawn");
  }

  async function restoreConsent() {
    const data = await api("/api/consent/restore", { method: "POST" });
    onUser(data.user);
    notify("Consent restored");
  }

  async function exportData() {
    const data = await api("/api/account/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "akrivo-skin-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAnalysisHistory() {
    if (!window.confirm("Delete analysis history and generated routines?")) return;
    const data = await api("/api/analysis/history", { method: "DELETE" });
    onUser(data.user);
    notify("Analysis history deleted");
  }

  async function deleteProgressTimeline() {
    if (!window.confirm("Delete progress timeline entries?")) return;
    const data = await api("/api/progress", { method: "DELETE" });
    onUser(data.user);
    notify("Progress timeline deleted");
  }

  async function reportAbuse() {
    if (!abuseMessage.trim()) return;
    await api("/api/report-abuse", { method: "POST", body: JSON.stringify({ category: "abuse", message: abuseMessage }) });
    setAbuseMessage("");
    notify("Report received");
  }

  async function reportBreach() {
    if (!breachSummary.trim()) return;
    await api("/api/breach/report", { method: "POST", body: JSON.stringify({ category: "suspected-breach", summary: breachSummary }) });
    setBreachSummary("");
    notify("Breach concern recorded");
  }

  async function startRazorpayTestPayment() {
    try {
      const data = await api("/api/payments/razorpay/order", { method: "POST", body: JSON.stringify({ planId: "starter" }) });
      if (data.checkout.mock) {
        await api("/api/payments/razorpay/verify", {
          method: "POST",
          body: JSON.stringify({
            localPaymentId: data.checkout.localPaymentId,
            razorpay_order_id: data.checkout.order_id,
            razorpay_payment_id: "pay_mock_test",
            razorpay_signature: "mock"
          })
        });
        notify("Razorpay test payment verified in mock mode");
        return;
      }
      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        ...data.checkout,
        handler: async response => {
          await api("/api/payments/razorpay/verify", {
            method: "POST",
            body: JSON.stringify({ localPaymentId: data.checkout.localPaymentId, ...response })
          });
          notify("Razorpay payment verified");
        },
        theme: { color: "#2f7567" }
      });
      checkout.open();
    } catch (error) {
      notify(error.message);
    }
  }

  return (
    <main className="grid gap-4">
      <Heading eyebrow="Settings" title="Routine notifications" copy="Configure reminders and step timing." />
      <form onSubmit={save} className="card grid gap-4">
        <Switch label="Enable reminders" checked={settings.remindersEnabled} onChange={remindersEnabled => setSettings({ ...settings, remindersEnabled })} />
        <Field label="Morning routine time" type="time" value={settings.morningTime} onChange={morningTime => setSettings({ ...settings, morningTime })} />
        <Field label="Night routine time" type="time" value={settings.nightTime} onChange={nightTime => setSettings({ ...settings, nightTime })} />
        <Field label="Custom delay between steps" type="number" value={settings.stepDelayMinutes} onChange={stepDelayMinutes => setSettings({ ...settings, stepDelayMinutes })} />
        <Switch label="Skip today" checked={settings.skipToday} onChange={skipToday => setSettings({ ...settings, skipToday })} />
        <button className="btn-primary">Save settings</button>
        <div className="grid gap-3 rounded-lg border border-[#eee4d9] bg-white p-4">
          <h3 className="font-black">Access and correction</h3>
          <Field label="Name" value={correction.name} onChange={name => setCorrection({ ...correction, name })} />
          <Field label="Age range" value={correction.ageRange} onChange={ageRange => setCorrection({ ...correction, ageRange })} />
          <Field label="Country or region" value={correction.country} onChange={country => setCorrection({ ...correction, country })} />
          <button className="btn-secondary" type="button" onClick={saveCorrection}>Correct account data</button>
        </div>
        <div className="grid gap-3 rounded-lg border border-[#eee4d9] bg-white p-4">
          <h3 className="font-black">Consent under DPDP</h3>
          <p className="muted">{user.processingRestricted ? "Consent is withdrawn. New photo uploads, AI analysis, and routine generation are paused." : "Consent is active for app functionality you chose."}</p>
          {user.processingRestricted
            ? <button className="btn-secondary" type="button" onClick={restoreConsent}>Restore consent</button>
            : <button className="btn-secondary" type="button" onClick={withdrawConsent}>Withdraw consent</button>}
        </div>
        <div className="grid gap-3 rounded-lg border border-[#eee4d9] bg-white p-4">
          <h3 className="font-black">Razorpay test payment</h3>
          <p className="muted">Test-mode billing interface for AKRIVO Skin Starter. No Stripe integration is used.</p>
          <button className="btn-secondary" type="button" onClick={startRazorpayTestPayment}>Open Razorpay test checkout</button>
        </div>
        <div className="grid gap-3 rounded-lg border border-[#eee4d9] bg-white p-4">
          <h3 className="font-black">Data retention</h3>
          <p className="muted">Analysis data is retained up to 365 days, progress and routine history up to 730 days, audit logs up to 1095 days, and breach records up to 1825 days unless deletion is requested sooner.</p>
          <button className="btn-secondary" type="button" onClick={exportData}>Export user data</button>
          <button className="btn-secondary" type="button" onClick={deleteAnalysisHistory}>Delete analysis history</button>
          <button className="btn-secondary" type="button" onClick={deleteProgressTimeline}>Delete progress timeline</button>
        </div>
        <div className="grid gap-3 rounded-lg border border-[#eee4d9] bg-white p-4">
          <h3 className="font-black">Report abuse or privacy concern</h3>
          <textarea className="input min-h-24" value={abuseMessage} onChange={event => setAbuseMessage(event.target.value)} placeholder="Tell us what happened." />
          <button className="btn-secondary" type="button" onClick={reportAbuse}>Send report</button>
        </div>
        <div className="grid gap-3 rounded-lg border border-[#eee4d9] bg-white p-4">
          <h3 className="font-black">Report suspected data breach</h3>
          <textarea className="input min-h-24" value={breachSummary} onChange={event => setBreachSummary(event.target.value)} placeholder="Describe the suspected breach or unauthorized access." />
          <button className="btn-secondary" type="button" onClick={reportBreach}>Record breach concern</button>
        </div>
        <button className="rounded-lg border border-red-200 bg-red-50 px-5 py-3 font-black text-red-700" type="button" onClick={deleteAccount}>Delete account</button>
      </form>
    </main>
  );
}

function PrivacyScreen({ user, onUser, notify }) {
  const [privacy, setPrivacy] = useState(user.duo?.privacy || { shareRoutineStatus: true, shareStreak: true, shareProgressNotes: false, sharePhotos: false });

  async function save(event) {
    event.preventDefault();
    const data = await api("/api/duo/privacy", { method: "PATCH", body: JSON.stringify(privacy) });
    onUser(data.user);
    notify("Privacy saved");
  }

  return (
    <main className="grid gap-4">
      <Heading eyebrow="Privacy" title="Duo privacy controls" copy="Choose what a partner can see. Face photos are never shared by default." />
      <form onSubmit={save} className="card grid gap-4">
        <Switch label="Share routine status" checked={privacy.shareRoutineStatus} onChange={shareRoutineStatus => setPrivacy({ ...privacy, shareRoutineStatus })} />
        <Switch label="Share streak" checked={privacy.shareStreak} onChange={shareStreak => setPrivacy({ ...privacy, shareStreak })} />
        <Switch label="Share progress notes" checked={privacy.shareProgressNotes} onChange={shareProgressNotes => setPrivacy({ ...privacy, shareProgressNotes })} />
        <div className="rounded-lg bg-[#f6f0e9] p-4 text-sm font-black text-[#73716d]">Share uploaded face photos by default: never</div>
        <button className="btn-primary" disabled={!user.duo}>Save privacy</button>
      </form>
    </main>
  );
}

function LegalScreen({ onNavigate }) {
  return (
    <main className="card grid gap-4">
      <Heading eyebrow="Legal" title="Disclaimer" />
      <p className="font-black">{DISCLAIMER}</p>
      <p className="font-black">{FINAL_DISCLAIMER}</p>
      <p className="muted">AKRIVO Skin does not provide medical conclusions, prescription advice, promised outcomes, identity recognition, attractiveness scoring, or appearance shaming. It only provides visible skin concern estimates with uncertainty.</p>
      <p className="muted">Please consult a qualified dermatologist or doctor for red-flag symptoms such as swelling, bleeding, infection signs, rapidly spreading irritation, severe burning, eye-area infection signs, fast worsening skin, or suspicious mole or lesion changes.</p>
      <p className="muted">Progress photos are private and should only be uploaded by the account owner.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="btn-secondary" onClick={() => onNavigate("privacyPolicy")}>Privacy policy</button>
        <button className="btn-secondary" onClick={() => onNavigate("terms")}>Terms of service</button>
      </div>
    </main>
  );
}

function PrivacyPolicyScreen() {
  return (
    <main className="card grid gap-4">
      <Heading eyebrow="Privacy policy" title="Your data, kept minimal" />
      <p className="font-black">For Indian users, AKRIVO Skin is designed to support DPDP Act principles: clear consent, data minimization, access, correction, deletion, consent withdrawal, reasonable security safeguards, and breach response records.</p>
      <p className="muted">AKRIVO Skin collects only what is needed for skin wellness insights: email, password hash, profile basics, age range, country or region, skin type, selected concerns, allergies or sensitivities, current routine, consent records, photos you upload, analysis outputs, routines, progress notes, reminder settings, and Duo sharing preferences.</p>
      <p className="muted">Photos are used to provide visible skin concern estimates and routine suggestions. In this MVP, photos are stored in private local storage outside the public web root. In production, use private object storage or temporary processing storage depending on your retention policy.</p>
      <p className="muted">Analysis data is retained up to 365 days, progress and routine history up to 730 days, audit logs up to 1095 days, and breach records up to 1825 days unless you delete data sooner or the law requires longer retention.</p>
      <p className="muted">AKRIVO Skin does not collect phone numbers, Aadhaar, PAN, government ID, payment data, or precise location in this MVP. Do not upload photos of other people without permission.</p>
      <p className="muted">Third-party processors may include AI APIs, private cloud storage, email support tools, analytics, payment gateways, or push notification services if configured later. Only necessary data should be sent to processors. API keys remain backend-only.</p>
      <p className="muted">Duo partners can only see routine status, streak, and notes you choose to share. Uploaded face photos are not shared by default.</p>
      <p className="muted">You can export data, correct account data, delete analysis history, delete progress data, delete your account, and withdraw consent from Settings. After consent withdrawal, non-essential photo/AI processing is stopped.</p>
      <p className="muted">Users may request access, deletion, export, correction, grievance review, or withdrawal of consent where legally applicable. Configure privacy contact email: privacy@akrivoskin.example. For a suspected data breach, contact security@akrivoskin.example.</p>
    </main>
  );
}

function TermsScreen() {
  return (
    <main className="card grid gap-4">
      <Heading eyebrow="Terms" title="Skincare wellness guidance only" />
      <p className="font-black">{DISCLAIMER}</p>
      <p className="muted">AKRIVO Skin is not emergency care. For severe, painful, infected, rapidly changing, or concerning symptoms, consider consulting a qualified healthcare professional.</p>
      <p className="muted">You must upload only your own photos or photos you have permission to use. You are responsible for patch testing, reading product labels, and using products safely.</p>
      <p className="muted">Routine suggestions may help some users, but results vary. AI outputs may be inaccurate or incomplete.</p>
      <p className="muted">Product category suggestions are not prescription products, sponsored endorsements, or promises. If affiliate links or sponsored content are added later, AKRIVO Skin must disclose them clearly.</p>
      <p className="muted">Account misuse, attempts to access another user’s data, abusive uploads, or attempts to bypass security controls may lead to suspension or deletion.</p>
    </main>
  );
}

function BottomNav({ screen, onNavigate }) {
  const items = [
    ["dashboard", Home, "Home"],
    ["routine", Bell, "Routine"],
    ["progress", History, "Progress"],
    ["duo", HeartHandshake, "Duo"],
    ["settings", Settings, "Settings"]
  ];
  return <nav className="bottom-nav">{items.map(([key, Icon, label]) => <button key={key} className={screen === key ? "active" : ""} onClick={() => onNavigate(key)}><Icon className="mx-auto mb-0.5" size={17} />{label}</button>)}</nav>;
}

function DisclaimerNotice() {
  return <div className="rounded-lg border border-[#eee4d9] bg-white p-4 text-sm font-black leading-6">{DISCLAIMER}</div>;
}

function FooterDisclaimer({ onNavigate }) {
  return (
    <footer className="mx-auto mt-6 grid max-w-4xl gap-2 rounded-lg border border-[#eee4d9] bg-white/80 p-4 text-xs font-bold leading-5 text-[#625a55]">
      <p>{FINAL_DISCLAIMER}</p>
      <div className="flex flex-wrap gap-3">
        <button className="font-black text-[#2f7567]" onClick={() => onNavigate("legal")}>Legal</button>
        <button className="font-black text-[#2f7567]" onClick={() => onNavigate("privacyPolicy")}>Privacy Policy</button>
        <button className="font-black text-[#2f7567]" onClick={() => onNavigate("terms")}>Terms</button>
      </div>
    </footer>
  );
}

function Heading({ eyebrow, title, copy }) {
  return <div><p className="eyebrow">{eyebrow}</p><h2 className="text-4xl font-black leading-none tracking-normal sm:text-5xl">{title}</h2>{copy && <p className="muted mt-3 max-w-2xl">{copy}</p>}</div>;
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return <label className="grid gap-2 text-sm font-black text-[#554f4b]">{label}<input className="input" type={type} value={value || ""} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange, placeholder = "" }) {
  return <label className="grid gap-2 text-sm font-black text-[#554f4b]">{label}<textarea className="input min-h-28 resize-y" value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options }) {
  return <label className="grid gap-2 text-sm font-black text-[#554f4b]">{label}<select className="input" value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option} value={option}>{option || "Select"}</option>)}</select></label>;
}

function ChipGroup({ title, values, selected, onToggle, danger = false }) {
  return <fieldset><legend className="mb-2 text-sm font-black">{title}</legend><div className="flex flex-wrap gap-2">{values.map(value => <button type="button" key={value} onClick={() => onToggle(value)} className={`rounded-full border px-3 py-2 text-sm font-black ${selected.includes(value) ? "border-[#2f7567] bg-[#e7f1eb] text-[#245c52]" : danger ? "border-[#f2c8c4] bg-[#fff7f6] text-[#5a514c]" : "border-[#e6d9ce] bg-white text-[#5a514c]"}`}>{value}</button>)}</div></fieldset>;
}

function Switch({ label, checked, onChange }) {
  return <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[#eaded4] bg-white p-3 text-sm font-black"><input className="h-5 w-5 accent-[#2f7567]" type="checkbox" checked={Boolean(checked)} onChange={event => onChange(event.target.checked)} />{label}</label>;
}

function SectionTitle({ title }) {
  return <p className="eyebrow">{title}</p>;
}

function ConcernList({ concerns }) {
  return <div className="grid gap-2">{(concerns || []).map(item => <div key={item.concern} className="flex items-center justify-between gap-3 border-b border-[#eee4d9] py-2 last:border-b-0"><span className="text-sm font-bold">{item.concern}</span><span className="badge">{item.confidence}</span></div>)}</div>;
}

function Warning({ flags }) {
  return <div className="rounded-lg border border-[#f1b7b1] bg-[#fff0ee] p-4 text-[#9a443f]"><strong>Please consult a qualified dermatologist or doctor.</strong><p className="mt-1 text-sm font-semibold">Noted: {flags.join(", ")}</p></div>;
}

function Stat({ label, value }) {
  return <div className="card p-4"><span className="block text-2xl font-black">{value}</span><small className="font-black text-[#73716d]">{label}</small></div>;
}

function RoutineCard({ title, steps, onStart }) {
  return <article className="card"><p className="eyebrow">{title}</p><h3 className="mb-3 text-lg font-black">{title} routine</h3><ol className="list-decimal pl-5 text-sm leading-7">{steps.map(step => <li key={step.stepName}>{step.stepName}</li>)}</ol><button className="btn-secondary mt-4 w-full" onClick={onStart}>Start {title}</button></article>;
}

function TimelineItem({ title, date, copy }) {
  return <div className="border-l-4 border-rose py-2 pl-4"><strong>{title}</strong><p className="muted">{copy}</p><small className="font-bold text-[#73716d]">{new Date(date).toLocaleDateString()}</small></div>;
}

function Empty({ title, copy, action, onAction }) {
  return <div className="rounded-lg border border-dashed border-[#dfcfc0] bg-[#fff9f2] p-5 text-center"><strong>{title}</strong><p className="muted mt-1">{copy}</p>{action && <button className="btn-secondary mt-4" onClick={onAction}>{action}</button>}</div>;
}

function CompareCard({ label }) {
  return <div className="card grid aspect-square place-items-center text-center"><Lock className="text-sage" /><p className="font-black">{label} photo</p><p className="muted">Private image preview is intentionally not shared in Duo.</p></div>;
}

function ErrorBox({ message }) {
  return <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>;
}

function ShellSkeleton() {
  return <div className="mx-auto grid min-h-screen max-w-4xl gap-4 p-4"><div className="skeleton h-16" /><div className="skeleton h-96" /><div className="skeleton h-32" /></div>;
}

function formatTime(value) {
  const [hour, minute] = String(value || "08:00").split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute || 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function yesNo(value) {
  return value ? "Yes" : "Not yet";
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("AKRIVO Skin UI error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto grid min-h-screen max-w-md place-items-center p-4">
          <div className="card text-center">
            <Shield className="mx-auto mb-3 text-rose" />
            <h1 className="text-2xl font-black">Something needs a refresh</h1>
            <p className="muted mt-2">Your data is still protected. Refresh the app and try again.</p>
            <button className="btn-primary mt-5" onClick={() => window.location.reload()}>Refresh app</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
