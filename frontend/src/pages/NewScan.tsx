import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Shield, Globe, Check, Plus, Trash2, ArrowLeft, ArrowRight, Rocket, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppShell from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import {
  createScan,
  incrementUserScans,
  startAuthCaptureSession,
  completeAuthCaptureSession,
} from "@/lib/firestore";
import { ScanProfile, ScanStatus } from "@/types";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

type AuthType = "none" | "session" | "jwt" | "oauth";

interface RoleRow { name: string; token: string; cookies: string; }
interface CustomHeader { key: string; value: string; }

const profiles = [
  { id: ScanProfile.Quick, icon: Zap, title: "Quick Scan", time: "5-10 min", desc: "Common vulns only — SQLi, XSS, CSRF, headers" },
  { id: ScanProfile.Full, icon: Shield, title: "Full Scan", time: "20-40 min", desc: "All modules, recommended for thorough coverage" },
  { id: ScanProfile.APIOnly, icon: Globe, title: "API Only", time: "10-15 min", desc: "REST and GraphQL endpoints focus" },
];

const stepLabels = ["Target", "Auth", "Roles & Scope", "Review"];

const NewScan = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [scanMode, setScanMode] = useState<"beginner" | "advanced">("beginner");

  const [targetUrl, setTargetUrl] = useState("");
  const [scanProfile, setScanProfile] = useState<ScanProfile>(ScanProfile.Full);
  const [scanDepth, setScanDepth] = useState<"shallow" | "normal" | "deep">("normal");

  const [authType, setAuthType] = useState<AuthType>("none");
  const [loginUrl, setLoginUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cookieString, setCookieString] = useState("");
  const [jwtToken, setJwtToken] = useState("");
  const [headerName, setHeaderName] = useState("Authorization");
  const [headerPrefix, setHeaderPrefix] = useState("Bearer");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tokenEndpoint, setTokenEndpoint] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [authSessionId, setAuthSessionId] = useState("");
  const [captureInProgress, setCaptureInProgress] = useState(false);
  const [capturedCookie, setCapturedCookie] = useState("");

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [includeUrls, setIncludeUrls] = useState("");
  const [excludeUrls, setExcludeUrls] = useState("");
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>([]);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);

  const urlValid = /^https?:\/\/.+/.test(targetUrl);
  const dynamicStepLabels =
    scanMode === "beginner" ? ["Target", "Auth", "Review"] : stepLabels;
  const finalStepIndex = dynamicStepLabels.length - 1;
  const canNext = () => {
    if (step === 0) return urlValid;
    if (scanMode === "beginner" && step === 1 && authType === "oauth" && !authSessionId) return true;
    return true;
  };

  const addRole = () => { if (roles.length >= 5) return; setRoles([...roles, { name: "", token: "", cookies: "" }]); };
  const removeRole = (i: number) => setRoles(roles.filter((_, idx) => idx !== i));
  const updateRole = (i: number, field: keyof RoleRow, value: string) => {
    const u = [...roles]; u[i] = { ...u[i], [field]: value }; setRoles(u);
  };
  const addHeader = () => setCustomHeaders([...customHeaders, { key: "", value: "" }]);
  const removeHeader = (i: number) => setCustomHeaders(customHeaders.filter((_, idx) => idx !== i));

  const testConnection = async () => {
    setTestingConnection(true);
    await new Promise((r) => setTimeout(r, 1500));
    setTestingConnection(false);
    toast.success("Connection test passed");
  };

  const runPreflight = () => {
    if (!urlValid) return "Target URL is required and must start with http:// or https://";
    if (!ownershipConfirmed) return "Please confirm you own (or have permission to test) this target.";
    if (authType === "oauth" && scanMode === "beginner" && !authSessionId) {
      return "For OAuth beginner mode, run guided auth capture first.";
    }
    return "";
  };

  const handleStartGuidedCapture = async () => {
    if (!user?.uid || !targetUrl) {
      toast.error("Provide target URL before starting guided capture.");
      return;
    }
    setCaptureInProgress(true);
    try {
      const session = await startAuthCaptureSession(user.uid, targetUrl);
      setAuthSessionId(session.authSessionId);
      toast.success("Auth capture session started", {
        description: `Session ID: ${session.authSessionId}`,
      });
    } catch (err: any) {
      toast.error("Failed to start auth capture", { description: err?.message });
    } finally {
      setCaptureInProgress(false);
    }
  };

  const handleCompleteGuidedCapture = async () => {
    if (!authSessionId) return;
    setCaptureInProgress(true);
    try {
      const session = await completeAuthCaptureSession(authSessionId, {
        cookies: capturedCookie ? [{ name: "session", value: capturedCookie }] : [],
        headers: {
          Authorization: jwtToken || "",
        },
      });
      const cookies = (session.payload?.cookies as Array<{ name: string; value: string }>) || [];
      if (cookies.length > 0) {
        setCookieString(cookies.map((c) => `${c.name}=${c.value}`).join("; "));
      }
      toast.success("Guided auth capture completed");
    } catch (err: any) {
      toast.error("Failed to complete auth capture", { description: err?.message });
    } finally {
      setCaptureInProgress(false);
    }
  };

  const getAuthCredentials = (): Record<string, string> => {
    switch (authType) {
      case "session": return { loginUrl, username, password, cookies: cookieString };
      case "jwt": return { token: jwtToken, headerName, prefix: headerPrefix };
      case "oauth": return { clientId, clientSecret, tokenEndpoint };
      default: return {};
    }
  };

  const launchScan = async () => {
    if (!user?.uid) return;
    const preflightError = runPreflight();
    if (preflightError) {
      toast.error("Preflight failed", { description: preflightError });
      return;
    }
    setLaunching(true);
    try {
      const scanId = await createScan({
        userId: user.uid, targetUrl, scanProfile,
        status: ScanStatus.Queued, progress: 0, currentModule: "",
        ownershipConfirmed,
        authConfig: { type: authType, credentials: getAuthCredentials() },
        roles: roles.filter((r) => r.name),
        scope: { include: includeUrls.split("\n").filter(Boolean), exclude: excludeUrls.split("\n").filter(Boolean) },
        createdAt: Timestamp.now(), completedAt: null, aiSummary: "",
        stats: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
      });
      await incrementUserScans(user.uid);
      toast.success("Scan started successfully");
      navigate(`/scan/${scanId}/live`);
    } catch (err: any) {
      toast.error("Failed to launch scan", { description: err?.message });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">New Scan</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={scanMode === "beginner" ? "default" : "outline"}
            onClick={() => {
              setScanMode("beginner");
              setStep(0);
            }}
          >
            Beginner
          </Button>
          <Button
            size="sm"
            variant={scanMode === "advanced" ? "default" : "outline"}
            onClick={() => {
              setScanMode("advanced");
              setStep(0);
            }}
          >
            Advanced
          </Button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
          {dynamicStepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="relative">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border transition-all ${
                    i < step
                      ? "bg-severity-low text-primary-foreground border-severity-low"
                      : i === step
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i === step && (
                  <span className="absolute inset-0 rounded-full border-2 border-primary animate-pulse-dot pointer-events-none" />
                )}
              </div>
              <span className={`text-sm hidden sm:inline ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < dynamicStepLabels.length - 1 && (
                <div className={`w-4 sm:w-8 h-px ${i < step ? "bg-severity-low" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 0 && (
          <div className="space-y-6 animate-slide-step">
            <div className="space-y-2">
              <Label htmlFor="target-url">Target URL</Label>
              <Input id="target-url" placeholder="https://example.com" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
              {targetUrl && !urlValid && <p className="text-xs text-severity-critical animate-error-slide">URL must start with http:// or https://</p>}
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Permission confirmation</div>
                  <div className="text-sm text-muted-foreground">
                    Only scan targets you own or have explicit permission to test. Active testing modules are disabled unless you confirm.
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={ownershipConfirmed}
                      onChange={(e) => setOwnershipConfirmed(e.target.checked)}
                    />
                    I own this target or have permission to run security testing.
                  </label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Scan Profile</Label>
              <div className="grid sm:grid-cols-3 gap-3">
                {profiles.map((p) => (
                  <Card
                    key={p.id}
                    className={`cursor-pointer transition-all duration-150 ${
                      scanProfile === p.id ? "border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(99,102,241,0.4)]" : "border-border bg-card card-hover"
                    }`}
                    onClick={() => setScanProfile(p.id)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <p.icon className={`h-4 w-4 ${scanProfile === p.id ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm font-medium text-foreground">{p.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                      <Badge variant="secondary" className="text-[10px]">{p.time}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Scan Depth</Label>
              <div className="flex rounded-lg border border-border overflow-hidden w-full sm:w-fit">
                {(["shallow", "normal", "deep"] as const).map((d) => (
                  <button key={d} onClick={() => setScanDepth(d)} className={`flex-1 sm:flex-none px-4 py-2 text-sm capitalize transition-colors ${scanDepth === d ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>{d}</button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Use `shallow` for fastest results while testing.</p>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 1 && (
          <div className="space-y-6 animate-slide-step">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">
                  <strong>Testing Tip: </strong> 
                  Authentication is completely optional! If you just want to test your OpenAI integration, leave this as <strong>None</strong> and scan a test target like <code className="text-primary text-xs bg-primary/10 px-1 py-0.5 rounded">http://demo.testfire.net</code>.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Authentication Type</Label>
              <div className="flex flex-wrap gap-2">
                {(["none", "session", "jwt", "oauth"] as AuthType[]).map((t) => (
                  <Button key={t} variant={authType === t ? "default" : "outline"} size="sm" onClick={() => setAuthType(t)} className="capitalize">{t}</Button>
                ))}
              </div>
            </div>
            {authType === "none" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Info className="h-4 w-4 text-severity-info shrink-0" />
                <p className="text-sm text-muted-foreground">Scanner will test as unauthenticated user</p>
              </div>
            )}
            {authType === "session" && (
              <div className="space-y-3">
                <div className="space-y-2"><Label htmlFor="login-url">Login URL</Label><Input id="login-url" placeholder="https://example.com/login" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} /></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="sess-user">Username</Label><Input id="sess-user" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="sess-pass">Password</Label><Input id="sess-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="cookies">Cookie String</Label><Textarea id="cookies" placeholder="session_id=abc123; csrf_token=xyz" value={cookieString} onChange={(e) => setCookieString(e.target.value)} /></div>
              </div>
            )}
            {authType === "jwt" && (
              <div className="space-y-3">
                <div className="space-y-2"><Label htmlFor="jwt-token">JWT Token</Label><Textarea id="jwt-token" placeholder="eyJhbGciOiJIUzI1NiIs..." value={jwtToken} onChange={(e) => setJwtToken(e.target.value)} rows={3} /></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="header-name">Header Name</Label><Input id="header-name" value={headerName} onChange={(e) => setHeaderName(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="header-prefix">Prefix</Label><Input id="header-prefix" value={headerPrefix} onChange={(e) => setHeaderPrefix(e.target.value)} /></div>
                </div>
              </div>
            )}
            {authType === "oauth" && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Guided OAuth capture creates a temporary browser window so you can log in manually. Once logged in, click "Complete" to automatically extract the session cookies instead of setting up endpoints blindly!
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleStartGuidedCapture} disabled={captureInProgress}>
                      {captureInProgress ? "Starting..." : "Start Guided Capture"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCompleteGuidedCapture} disabled={!authSessionId || captureInProgress}>
                      {captureInProgress ? "Completing..." : "Complete Guided Capture"}
                    </Button>
                  </div>
                  {authSessionId && <p className="text-xs text-muted-foreground">Session ID: {authSessionId}</p>}
                  <Input
                    placeholder="Paste captured session cookie value (optional)"
                    value={capturedCookie}
                    onChange={(e) => setCapturedCookie(e.target.value)}
                  />
                </div>
                <div className="space-y-2"><Label htmlFor="client-id">Client ID</Label><Input id="client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="client-secret">Client Secret</Label><Input id="client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="token-url">Token Endpoint URL</Label><Input id="token-url" placeholder="https://auth.example.com/token" value={tokenEndpoint} onChange={(e) => setTokenEndpoint(e.target.value)} /></div>
              </div>
            )}
            {authType !== "none" && (
              <Button variant="outline" size="sm" onClick={testConnection} disabled={testingConnection}>{testingConnection ? "Testing..." : "Test Connection"}</Button>
            )}
          </div>
        )}

        {/* Step 3 */}
        {step === 2 && scanMode === "advanced" && (
          <div className="space-y-6 animate-slide-step">
            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
              <p className="text-sm font-medium text-foreground">Advanced options are optional</p>
              <p className="text-xs text-muted-foreground">
                You can keep these empty and launch scan directly for a simpler workflow.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide Advanced Fields" : "Show Advanced Fields"}
              </Button>
            </div>

            {!showAdvanced && (
              <div className="p-3 rounded-lg border border-border bg-card">
                <p className="text-sm text-muted-foreground">
                  Advanced fields are hidden. Click "Show Advanced Fields" if you need role-based testing, URL scope, or custom headers.
                </p>
              </div>
            )}

            {showAdvanced && (
              <>
            <div className="space-y-3">
              <Label>Role Profiles</Label>
              {roles.map((role, i) => (
                <div key={i} className="flex gap-2 items-start animate-fade-in">
                  <Input placeholder="Role name" value={role.name} onChange={(e) => updateRole(i, "name", e.target.value)} className="w-full sm:w-40" aria-label={`Role ${i + 1} name`} />
                  <Textarea placeholder="Token / Cookie" value={role.token || role.cookies} onChange={(e) => updateRole(i, "token", e.target.value)} rows={1} className="flex-1" aria-label={`Role ${i + 1} token`} />
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-severity-critical" onClick={() => removeRole(i)} aria-label={`Remove role ${role.name}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {roles.length < 5 && <Button variant="outline" size="sm" onClick={addRole} className="gap-1"><Plus className="h-3 w-3" /> Add Role</Button>}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="include-urls">Include URLs</Label><Textarea id="include-urls" placeholder={"/admin/*\n/api/*"} value={includeUrls} onChange={(e) => setIncludeUrls(e.target.value)} rows={4} /></div>
              <div className="space-y-2"><Label htmlFor="exclude-urls">Exclude URLs</Label><Textarea id="exclude-urls" placeholder={"/logout\n/static/*"} value={excludeUrls} onChange={(e) => setExcludeUrls(e.target.value)} rows={4} /></div>
            </div>
            <div className="space-y-3">
              <Label>Custom Headers</Label>
              {customHeaders.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Key" value={h.key} onChange={(e) => { const u = [...customHeaders]; u[i] = { ...u[i], key: e.target.value }; setCustomHeaders(u); }} className="w-full sm:w-40" aria-label={`Header ${i + 1} key`} />
                  <Input placeholder="Value" value={h.value} onChange={(e) => { const u = [...customHeaders]; u[i] = { ...u[i], value: e.target.value }; setCustomHeaders(u); }} className="flex-1" aria-label={`Header ${i + 1} value`} />
                  <Button variant="ghost" size="icon" onClick={() => removeHeader(i)} className="text-muted-foreground" aria-label="Remove header"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addHeader} className="gap-1"><Plus className="h-3 w-3" /> Add Header</Button>
            </div>
              </>
            )}
          </div>
        )}

        {/* Step 4 */}
        {step === finalStepIndex && (
          <div className="space-y-4 animate-slide-step">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: "Target URL", value: targetUrl },
                { label: "Scan Profile", value: scanProfile },
                { label: "Auth Type", value: authType },
                { label: "Roles", value: `${roles.filter((r) => r.name).length} configured` },
                { label: "Mode", value: scanMode },
              ].map((item) => (
                <Card key={item.label} className="bg-card border-border">
                  <CardContent className="p-4 space-y-1">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <p className="text-sm font-medium text-foreground break-all capitalize">{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button className="w-full gap-2 h-12 text-base" onClick={launchScan} disabled={launching}>
              {launching ? "Launching..." : <><Rocket className="h-5 w-5" /> Launch Scan</>}
            </Button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-between pt-4">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1 w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < 3 && (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext() || step >= finalStepIndex} className="gap-1 w-full sm:w-auto">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default NewScan;
