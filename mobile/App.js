import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:3000";
const DISCLAIMER =
  "AKRIVO Skin provides skincare guidance and wellness insights only. It is not a medical device, does not provide medical diagnosis, and does not replace advice from a qualified dermatologist or doctor.";
const FINAL_DISCLAIMER =
  "AKRIVO Skin is a skincare wellness app. AI results may be inaccurate and should not be considered medical advice. For severe, painful, infected, rapidly changing, or concerning skin symptoms, consult a qualified healthcare professional.";

const concerns = ["acne", "pimples", "blackheads", "pigmentation", "dark spots", "redness", "dullness", "oily skin", "dry skin", "pores", "uneven tone"];
const redFlags = ["Severe painful acne", "Sudden rash", "Swelling", "Bleeding or infected-looking skin", "Rapidly spreading irritation", "Severe burning after product use", "Eye-area infection signs", "Skin condition worsening quickly", "Suspicious mole or lesion changes"];
const imageMediaType = ImagePicker.MediaType?.Images || ImagePicker.MediaTypeOptions?.Images;

let cookieJar = "";
let csrfToken = "";

async function api(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !csrfToken) {
    const csrf = await api("/api/auth/csrf");
    csrfToken = csrf.csrfToken;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookieJar ? { Cookie: cookieJar } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const pair = setCookie.split(";")[0];
    const [name] = pair.split("=");
    const current = new Map(cookieJar.split("; ").filter(Boolean).map(item => item.split("=")));
    current.set(name, pair.split("=").slice(1).join("="));
    cookieJar = [...current.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api("/api/auth/me")
      .then(data => {
        setUser(data.user);
        setScreen(data.user?.skinProfile ? "dashboard" : "onboarding");
      })
      .catch(() => setScreen("welcome"));
  }, []);

  function notify(message) {
    setNotice(message);
    setTimeout(() => setNotice(""), 2600);
  }

  async function refresh() {
    const data = await api("/api/auth/me");
    setUser(data.user);
    return data.user;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="dark" />
      <View style={styles.shell}>
        <Header user={user} onLogout={async () => {
          await api("/api/auth/logout", { method: "POST" }).catch(() => null);
          cookieJar = "";
          csrfToken = "";
          setUser(null);
          setScreen("welcome");
        }} />
        {screen === "loading" && <Loading />}
        {screen === "welcome" && <Welcome go={setScreen} />}
        {screen === "login" && <Auth mode="login" setUser={setUser} go={setScreen} notify={notify} />}
        {screen === "signup" && <Auth mode="signup" setUser={setUser} go={setScreen} notify={notify} />}
        {screen === "forgot" && <Auth mode="forgot" setUser={setUser} go={setScreen} notify={notify} />}
        {screen === "onboarding" && <Onboarding setUser={setUser} go={setScreen} notify={notify} />}
        {screen === "photo" && <Photo setUser={setUser} go={setScreen} notify={notify} />}
        {screen === "dashboard" && <Dashboard user={user} go={setScreen} />}
        {screen === "routine" && <Routine user={user} refresh={refresh} go={setScreen} notify={notify} />}
        {screen === "progress" && <Progress user={user} setUser={setUser} notify={notify} />}
        {screen === "duo" && <Duo user={user} setUser={setUser} notify={notify} />}
        {screen === "settings" && <SettingsScreen user={user} setUser={setUser} go={setScreen} notify={notify} />}
        {screen === "legal" && <Legal />}
        {screen === "privacy" && <Privacy />}
        {user && <Tabs screen={screen} go={setScreen} />}
        <Text style={styles.footer}>{FINAL_DISCLAIMER}</Text>
        {notice ? <View style={styles.toast}><Text style={styles.toastText}>{notice}</Text></View> : null}
      </View>
    </SafeAreaView>
  );
}

function Header({ user, onLogout }) {
  return (
    <View style={styles.header}>
      <Image source={{ uri: `${API_BASE_URL}/api/brand/logo` }} style={styles.logo} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>AI skincare companion</Text>
        <Text style={styles.title}>AKRIVO Skin</Text>
      </View>
      {user ? <IconButton name="log-out-outline" onPress={onLogout} /> : null}
    </View>
  );
}

function Welcome({ go }) {
  return (
    <Screen>
      <Card>
        <Image source={{ uri: `${API_BASE_URL}/api/brand/logo` }} style={styles.heroLogo} resizeMode="contain" />
        <Text style={styles.hero}>Simple skincare wellness insights.</Text>
        <Text style={styles.muted}>Upload your own photo, answer a short questionnaire, and get routine suggestions, reminders, progress tracking, and safety warnings.</Text>
        <Text style={styles.notice}>{DISCLAIMER}</Text>
        <Button label="Create account" onPress={() => go("signup")} />
        <Button label="Login" secondary onPress={() => go("login")} />
        <Pressable onPress={() => go("legal")}><Text style={styles.link}>Legal and privacy</Text></Pressable>
      </Card>
    </Screen>
  );
}

function Auth({ mode, setUser, go, notify }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    try {
      setBusy(true);
      if (mode === "forgot") {
        await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
        notify("If this email exists, a reset flow can be sent.");
        return;
      }
      const data = await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password }) });
      setUser(data.user);
      go(data.user.skinProfile ? "dashboard" : "onboarding");
    } catch (error) {
      Alert.alert("Could not continue", error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.h1}>{mode === "signup" ? "Create account" : mode === "forgot" ? "Forgot password" : "Login"}</Text>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        {mode !== "forgot" && <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="12+ chars, uppercase, number, symbol" />}
        <Button label={busy ? "Please wait..." : "Continue"} onPress={submit} disabled={busy} />
        <View style={styles.row}>
          <Pressable onPress={() => go("login")}><Text style={styles.link}>Login</Text></Pressable>
          <Pressable onPress={() => go("signup")}><Text style={styles.link}>Signup</Text></Pressable>
          <Pressable onPress={() => go("forgot")}><Text style={styles.link}>Forgot</Text></Pressable>
        </View>
      </Card>
    </Screen>
  );
}

function Onboarding({ setUser, go, notify }) {
  const [form, setForm] = useState({
    name: "",
    ageRange: "18-24",
    country: "India",
    skinType: "unknown",
    currentRoutine: "",
    allergies: "",
    budgetLevel: "medium",
    sensitivityLevel: "unknown",
    concerns: [],
    redFlags: [],
    consentAccepted: false,
    guardianConsentAccepted: false,
    photoConsentAccepted: false,
    aiProcessingConsentAccepted: false,
    understandsWellnessOnly: false
  });

  function toggle(field, value) {
    setForm(current => ({ ...current, [field]: current[field].includes(value) ? current[field].filter(item => item !== value) : [...current[field], value] }));
  }

  async function submit() {
    try {
      const data = await api("/api/onboarding", { method: "POST", body: JSON.stringify(form) });
      setUser(data.user);
      notify("Profile saved");
      go("photo");
    } catch (error) {
      Alert.alert("Consent or profile needed", error.message);
    }
  }

  return (
    <Screen>
      <Text style={styles.h1}>Your skin profile</Text>
      <Input label="Name" value={form.name} onChangeText={name => setForm({ ...form, name })} />
      <Input label="Age range" value={form.ageRange} onChangeText={ageRange => setForm({ ...form, ageRange })} />
      <Input label="Country/region" value={form.country} onChangeText={country => setForm({ ...form, country })} />
      <Input label="Skin type" value={form.skinType} onChangeText={skinType => setForm({ ...form, skinType })} />
      <ChipGroup label="Concerns" values={concerns} selected={form.concerns} onToggle={value => toggle("concerns", value)} />
      <Input label="Current routine" value={form.currentRoutine} onChangeText={currentRoutine => setForm({ ...form, currentRoutine })} multiline />
      <Input label="Allergies/sensitivities" value={form.allergies} onChangeText={allergies => setForm({ ...form, allergies })} multiline />
      <ChipGroup label="Red flags" values={redFlags} selected={form.redFlags} onToggle={value => toggle("redFlags", value)} danger />
      <Consent label="I accept the privacy notice and data controls." value={form.consentAccepted} onValueChange={consentAccepted => setForm({ ...form, consentAccepted })} />
      <Consent label="I will upload only my own photo or one I have permission to use." value={form.photoConsentAccepted} onValueChange={photoConsentAccepted => setForm({ ...form, photoConsentAccepted })} />
      <Consent label="I agree my photo may be processed for skin wellness insights." value={form.aiProcessingConsentAccepted} onValueChange={aiProcessingConsentAccepted => setForm({ ...form, aiProcessingConsentAccepted })} />
      <Consent label="I understand this is not medical advice." value={form.understandsWellnessOnly} onValueChange={understandsWellnessOnly => setForm({ ...form, understandsWellnessOnly })} />
      {form.ageRange === "13-17" && <Consent label="Parent/guardian consent is confirmed where required." value={form.guardianConsentAccepted} onValueChange={guardianConsentAccepted => setForm({ ...form, guardianConsentAccepted })} />}
      <Button label="Save profile" onPress={submit} />
    </Screen>
  );
}

function Photo({ setUser, go, notify }) {
  const [preview, setPreview] = useState("");
  const [imageId, setImageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo permission", "Photo access is needed only when you choose a skin photo.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: imageMediaType,
      allowsEditing: true,
      quality: 0.8,
      base64: true
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const mime = asset.mimeType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${asset.base64}`;
    setPreview(asset.uri);
    const upload = await api("/api/images/upload", {
      method: "POST",
      body: JSON.stringify({ dataUrl, uploadPurpose: "analysis", ownPhotoConsent: true, aiProcessingConsent: true, wellnessOnlyConsent: true })
    });
    setImageId(upload.image.id);
  }

  async function analyze() {
    try {
      setBusy(true);
      const data = await api("/api/analysis/create", { method: "POST", body: JSON.stringify({ imageId }) });
      setUser(data.user);
      setResult(data.aiOutput);
      notify("Analysis ready");
    } catch (error) {
      Alert.alert("Analysis failed", error.message);
    } finally {
      setBusy(false);
    }
  }

  if (busy) return <Loading text="Creating skin wellness insights..." />;
  if (result) return (
    <Screen>
      <Text style={styles.h1}>Analysis result</Text>
      <Text style={styles.notice}>{DISCLAIMER}</Text>
      <Text style={styles.muted}>{FINAL_DISCLAIMER}</Text>
      {result.visibleConcerns?.map(item => <ListItem key={item.concern} left={item.concern} right={item.confidence} />)}
      {result.redFlags?.length ? <Text style={styles.warning}>Please consider consulting a dermatologist or doctor: {result.redFlags.join(", ")}</Text> : null}
      <Button label="Go to dashboard" onPress={() => go("dashboard")} />
    </Screen>
  );

  return (
    <Screen>
      <Text style={styles.h1}>Upload skin photo</Text>
      <Text style={styles.notice}>{DISCLAIMER}</Text>
      <Text style={styles.muted}>Use natural light, no heavy filters, no makeup if possible, and keep your face visible.</Text>
      {preview ? <Image source={{ uri: preview }} style={styles.preview} /> : null}
      <Button label={preview ? "Retake or reupload" : "Choose photo"} onPress={pick} secondary={Boolean(preview)} />
      <Button label="Analyze skin" onPress={analyze} disabled={!imageId} />
    </Screen>
  );
}

function Dashboard({ user, go }) {
  const analysis = user.latestAnalysis?.aiFindings;
  const routine = user.latestRoutine;
  return (
    <Screen>
      <Text style={styles.h1}>{user.name || "Your"} routine</Text>
      {user.processingRestricted ? <Text style={styles.warning}>Consent is withdrawn. New photo and AI processing is paused.</Text> : null}
      {analysis?.redFlags?.length ? <Text style={styles.warning}>Consider consulting a dermatologist: {analysis.redFlags.join(", ")}</Text> : null}
      <Card>
        <Text style={styles.h2}>Morning</Text>
        {routine?.morningSteps?.map(step => <Text key={step.stepName} style={styles.bullet}>• {step.stepName}</Text>) || <Text style={styles.muted}>No routine yet.</Text>}
        <Button label="Start routine" onPress={() => go("routine")} secondary />
      </Card>
      <Card>
        <Text style={styles.h2}>Product categories</Text>
        {analysis?.productCategories?.map(item => <Text key={item} style={styles.bullet}>• {item}</Text>)}
        <Text style={styles.muted}>No prescription products. Patch test first. Results vary.</Text>
      </Card>
    </Screen>
  );
}

function Routine({ user, refresh, go, notify }) {
  const [type, setType] = useState("morning");
  const [index, setIndex] = useState(0);
  const steps = type === "night" ? user.latestRoutine?.nightSteps || [] : user.latestRoutine?.morningSteps || [];
  const step = steps[index];

  async function mark(skipped) {
    const path = skipped ? "/api/routine/skip-step" : "/api/routine/step-complete";
    await api(path, { method: "POST", body: JSON.stringify({ routineType: type, stepName: step.stepName }) });
    if (index < steps.length - 1) setIndex(index + 1);
    else {
      await refresh();
      notify("Routine complete");
      go("dashboard");
    }
  }

  if (!step) return <Screen><Text style={styles.h1}>No routine yet</Text><Button label="Upload photo" onPress={() => go("photo")} /></Screen>;
  return (
    <Screen>
      <View style={styles.row}>
        <Button label="Morning" onPress={() => { setType("morning"); setIndex(0); }} secondary={type !== "morning"} />
        <Button label="Night" onPress={() => { setType("night"); setIndex(0); }} secondary={type !== "night"} />
      </View>
      <Card>
        <Text style={styles.h1}>{step.stepName}</Text>
        <Text style={styles.muted}>{step.instruction}</Text>
        <Text style={styles.badge}>{step.estimatedDuration}</Text>
        {step.warning ? <Text style={styles.warning}>{step.warning}</Text> : null}
        <Text style={styles.muted}>Step {index + 1} of {steps.length}. Delay between steps: {user.settings?.stepDelayMinutes || 10} minutes.</Text>
        <View style={styles.row}>
          <Button label="Skip" onPress={() => mark(true)} secondary />
          <Button label="Done" onPress={() => mark(false)} />
        </View>
      </Card>
    </Screen>
  );
}

function Progress({ user, setUser, notify }) {
  const [notes, setNotes] = useState("");

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: imageMediaType, quality: 0.8, base64: true });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const upload = await api("/api/images/upload", {
      method: "POST",
      body: JSON.stringify({ dataUrl: `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`, uploadPurpose: "progress", ownPhotoConsent: true, aiProcessingConsent: false, wellnessOnlyConsent: true })
    });
    const data = await api("/api/progress/photo", { method: "POST", body: JSON.stringify({ imageId: upload.image.id, notes, concerns: [], visibility: "private" }) });
    setUser(data.user);
    setNotes("");
    notify("Progress saved privately");
  }

  return (
    <Screen>
      <Text style={styles.h1}>Self-tracked progress</Text>
      <Text style={styles.notice}>Progress photos are private and should only be uploaded by the account owner.</Text>
      <Input label="Progress note" value={notes} onChangeText={setNotes} multiline />
      <Button label="Upload weekly progress photo" onPress={pick} />
      {user.progress?.map(entry => <ListItem key={entry.id} left={entry.notes || "Progress photo"} right={new Date(entry.createdAt).toLocaleDateString()} />)}
    </Screen>
  );
}

function Duo({ user, setUser, notify }) {
  const [code, setCode] = useState("");
  async function create() {
    const data = await api("/api/duo/create-code", { method: "POST" });
    setUser(data.user);
    notify("Duo code created");
  }
  async function join() {
    const data = await api("/api/duo/join", { method: "POST", body: JSON.stringify({ duoCode: code }) });
    setUser(data.user);
    notify("Joined duo");
  }
  return (
    <Screen>
      <Text style={styles.h1}>Duo plan</Text>
      <Text style={styles.muted}>Use a duo code. No phone, SMS, or WhatsApp invite. Face photos are never shared by default.</Text>
      {user.duo?.duoCode ? <Text style={styles.code}>{user.duo.duoCode}</Text> : null}
      {user.duo?.partner ? <Card><Text style={styles.h2}>{user.duo.partner.name}</Text><Text style={styles.muted}>Morning: {user.duo.partner.routineStatus?.morning ? "Done" : "Not yet or private"}</Text><Text style={styles.muted}>Night: {user.duo.partner.routineStatus?.night ? "Done" : "Not yet or private"}</Text></Card> : null}
      <Button label="Create duo code" onPress={create} />
      <Input label="Enter duo code" value={code} onChangeText={setCode} autoCapitalize="characters" />
      <Button label="Join duo" onPress={join} secondary />
    </Screen>
  );
}

function SettingsScreen({ user, setUser, go, notify }) {
  const [name, setName] = useState(user.name || "");
  const [country, setCountry] = useState(user.country || "");
  const [breach, setBreach] = useState("");
  async function withdraw() {
    const data = await api("/api/consent/withdraw", { method: "POST" });
    setUser(data.user);
    notify("Consent withdrawn");
  }
  async function restore() {
    const data = await api("/api/consent/restore", { method: "POST" });
    setUser(data.user);
    notify("Consent restored");
  }
  async function correct() {
    const data = await api("/api/account/profile", { method: "PATCH", body: JSON.stringify({ name, country }) });
    setUser(data.user);
    notify("Data corrected");
  }
  async function reportBreach() {
    await api("/api/breach/report", { method: "POST", body: JSON.stringify({ category: "suspected-breach", summary: breach }) });
    setBreach("");
    notify("Breach concern recorded");
  }
  async function startPayment() {
    const data = await api("/api/payments/razorpay/order", { method: "POST", body: JSON.stringify({ planId: "starter" }) });
    if (data.checkout.mock) {
      await api("/api/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({
          localPaymentId: data.checkout.localPaymentId,
          razorpay_order_id: data.checkout.order_id,
          razorpay_payment_id: "pay_mock_mobile_test",
          razorpay_signature: "mock"
        })
      });
      notify("Razorpay test payment verified in mock mode");
      return;
    }
    Alert.alert("Razorpay order created", "Use the web checkout or add Razorpay native SDK for production mobile payments.");
  }
  async function deleteAccount() {
    await api("/api/account/delete", { method: "DELETE" });
    setUser(null);
    go("welcome");
  }
  return (
    <Screen>
      <Text style={styles.h1}>Settings and privacy</Text>
      <Input label="Correct name" value={name} onChangeText={setName} />
      <Input label="Correct country/region" value={country} onChangeText={setCountry} />
      <Button label="Save correction" onPress={correct} />
      <Button label={user.processingRestricted ? "Restore consent" : "Withdraw consent"} onPress={user.processingRestricted ? restore : withdraw} secondary />
      <Button label="Razorpay test payment" onPress={startPayment} secondary />
      <Button label="Privacy policy" onPress={() => go("privacy")} secondary />
      <Button label="Legal / terms" onPress={() => go("legal")} secondary />
      <Input label="Report suspected breach" value={breach} onChangeText={setBreach} multiline />
      <Button label="Record breach concern" onPress={reportBreach} secondary />
      <Button label="Delete account" onPress={() => Alert.alert("Delete account", "This cannot be undone.", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: deleteAccount }])} danger />
    </Screen>
  );
}

function Legal() {
  return <Screen><Text style={styles.h1}>Legal</Text><Text style={styles.notice}>{DISCLAIMER}</Text><Text style={styles.muted}>{FINAL_DISCLAIMER}</Text><Text style={styles.muted}>AKRIVO Skin is not emergency care. Use only your own photos or photos you have permission to use. Patch test products. Results vary.</Text></Screen>;
}

function Privacy() {
  return <Screen><Text style={styles.h1}>Privacy Policy</Text><Text style={styles.muted}>AKRIVO Skin collects only data needed for skin wellness insights: email, profile details, consent records, uploaded photos, analysis outputs, routines, progress notes, reminders, and Duo preferences.</Text><Text style={styles.muted}>For Indian users, the app supports DPDP principles: consent, access, correction, deletion, consent withdrawal, retention limits, breach reporting, and data minimization.</Text><Text style={styles.muted}>No phone number, contacts, microphone, Aadhaar, PAN, payment data, government ID, or precise location is collected in this MVP.</Text></Screen>;
}

function Tabs({ screen, go }) {
  const tabs = [
    ["dashboard", "home-outline", "Home"],
    ["routine", "notifications-outline", "Routine"],
    ["progress", "images-outline", "Progress"],
    ["duo", "people-outline", "Duo"],
    ["settings", "settings-outline", "Settings"]
  ];
  return <View style={styles.tabs}>{tabs.map(([key, icon, label]) => <Pressable key={key} style={[styles.tab, screen === key && styles.tabActive]} onPress={() => go(key)}><Ionicons name={icon} size={18} color={screen === key ? "#245c52" : "#73716d"} /><Text style={styles.tabText}>{label}</Text></Pressable>)}</View>;
}

function Screen({ children }) {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>{children}</ScrollView>;
}

function Card({ children }) {
  return <View style={styles.card}>{children}</View>;
}

function Loading({ text = "Loading..." }) {
  return <View style={styles.loading}><ActivityIndicator color="#2f7567" /><Text style={styles.muted}>{text}</Text></View>;
}

function Input({ label, ...props }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} style={[styles.input, props.multiline && styles.textarea]} placeholderTextColor="#9a918a" /></View>;
}

function Button({ label, onPress, secondary, danger, disabled }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, danger && styles.buttonDanger, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.buttonSecondaryText, danger && styles.buttonDangerText]}>{label}</Text></Pressable>;
}

function IconButton({ name, onPress }) {
  return <Pressable onPress={onPress} style={styles.iconButton}><Ionicons name={name} size={20} color="#2e3130" /></Pressable>;
}

function Consent({ label, value, onValueChange }) {
  return <View style={styles.consent}><Switch value={value} onValueChange={onValueChange} /><Text style={styles.consentText}>{label}</Text></View>;
}

function ChipGroup({ label, values, selected, onToggle, danger }) {
  return <View><Text style={styles.label}>{label}</Text><View style={styles.chips}>{values.map(value => <Pressable key={value} onPress={() => onToggle(value)} style={[styles.chip, danger && styles.chipDanger, selected.includes(value) && styles.chipActive]}><Text style={styles.chipText}>{value}</Text></Pressable>)}</View></View>;
}

function ListItem({ left, right }) {
  return <View style={styles.listItem}><Text style={styles.listLeft}>{left}</Text><Text style={styles.badge}>{right}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fffaf3", paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  shell: { flex: 1, padding: 16 },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 10 },
  heroLogo: { width: 132, height: 132, marginBottom: 18 },
  eyebrow: { color: "#d98984", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#2e3130", fontSize: 24, fontWeight: "900" },
  screen: { flex: 1 },
  screenContent: { gap: 14, paddingBottom: 28 },
  card: { backgroundColor: "rgba(255,253,249,.94)", borderColor: "#eee4d9", borderWidth: 1, borderRadius: 12, padding: 18, gap: 14, shadowColor: "#5c452f", shadowOpacity: 0.12, shadowRadius: 20 },
  hero: { fontSize: 42, lineHeight: 44, fontWeight: "900", color: "#2e3130" },
  h1: { fontSize: 32, lineHeight: 34, fontWeight: "900", color: "#2e3130" },
  h2: { fontSize: 20, fontWeight: "900", color: "#2e3130" },
  muted: { color: "#73716d", lineHeight: 22, fontWeight: "600" },
  notice: { backgroundColor: "#fff", borderColor: "#eee4d9", borderWidth: 1, borderRadius: 10, padding: 12, color: "#5f4d46", fontWeight: "800", lineHeight: 21 },
  warning: { backgroundColor: "#fff0ee", borderColor: "#f1b7b1", borderWidth: 1, borderRadius: 10, padding: 12, color: "#9a443f", fontWeight: "800", lineHeight: 21 },
  field: { gap: 7 },
  label: { fontWeight: "900", color: "#554f4b" },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#e3d7cd", borderRadius: 10, backgroundColor: "#fff", paddingHorizontal: 14, color: "#2e3130" },
  textarea: { minHeight: 92, paddingTop: 12, textAlignVertical: "top" },
  button: { minHeight: 48, borderRadius: 10, backgroundColor: "#2f7567", justifyContent: "center", alignItems: "center", paddingHorizontal: 18 },
  buttonSecondary: { backgroundColor: "#e7f1eb" },
  buttonDanger: { backgroundColor: "#fff0ee", borderColor: "#f1b7b1", borderWidth: 1 },
  buttonText: { color: "#fff", fontWeight: "900" },
  buttonSecondaryText: { color: "#315f55" },
  buttonDangerText: { color: "#9a443f" },
  disabled: { opacity: 0.5 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" },
  link: { color: "#2f7567", fontWeight: "900", paddingVertical: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#e6d9ce", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipDanger: { borderColor: "#f2c8c4", backgroundColor: "#fff7f6" },
  chipActive: { borderColor: "#2f7567", backgroundColor: "#e7f1eb" },
  chipText: { fontWeight: "800", color: "#5a514c" },
  consent: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee4d9", borderRadius: 10, padding: 12 },
  consentText: { flex: 1, color: "#554f4b", fontWeight: "800", lineHeight: 20 },
  preview: { width: "100%", height: 320, borderRadius: 12, backgroundColor: "#eee4d9" },
  badge: { alignSelf: "flex-start", backgroundColor: "#eef5ef", color: "#2f7567", fontWeight: "900", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden" },
  bullet: { color: "#5c514a", fontWeight: "700", lineHeight: 24 },
  code: { fontSize: 42, letterSpacing: 5, textAlign: "center", fontWeight: "900", color: "#2f7567", backgroundColor: "#edf5ef", borderRadius: 12, padding: 16 },
  tabs: { flexDirection: "row", gap: 4, borderWidth: 1, borderColor: "#e3d7cd", backgroundColor: "rgba(255,253,249,.96)", borderRadius: 12, padding: 5 },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  tabActive: { backgroundColor: "#e7f1eb" },
  tabText: { fontSize: 11, fontWeight: "900", color: "#73716d" },
  iconButton: { width: 44, height: 44, backgroundColor: "#f1e8df", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  footer: { marginTop: 10, color: "#625a55", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  toast: { position: "absolute", left: 18, right: 18, bottom: 92, backgroundColor: "#2e3130", padding: 14, borderRadius: 10 },
  toastText: { color: "#fff", fontWeight: "900", textAlign: "center" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  listItem: { flexDirection: "row", justifyContent: "space-between", gap: 12, borderBottomColor: "#eee4d9", borderBottomWidth: 1, paddingVertical: 10 },
  listLeft: { flex: 1, color: "#554f4b", fontWeight: "800" }
});
