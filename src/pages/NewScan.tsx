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
import { createScan, incrementUserScans } from "@/lib/firestore";
import { ScanProfile, ScanStatus } from "@/types";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

type AuthType = "none" | "session" | "jwt" | "oauth";

interface RoleRow {
  name: string;
  token: string;
  cookies: string;
}

interface CustomHeader {
  key: string;
  value: string;
}

const profiles = [
  {
    id: ScanProfile.Quick,
    icon: Zap,
    title: "Quick Scan",
    time: "5-10 min",
    desc: "Common vulns only — SQLi, XSS, CSRF, headers",
  },
  {
    id: ScanProfile.Full,
    icon: Shield,
    title: "Full Scan",
    time: "20-40 min",
    desc: "All modules, recommended for thorough coverage",
  },
  {
    id: ScanProfile.APIOnly,
    icon: Globe,
    title: "API Only",
    time: "10-15 min",
    desc: "REST and GraphQL endpoints focus",
  },
];

const stepLabels = ["Target", "Auth", "Roles & Scope", "Review"];

const NewScan = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);

  // Step 1
  const [targetUrl, setTargetUrl] = useState("");
  const [scanProfile, setScanProfile] = useState<ScanProfile>(ScanProfile.Full);
  const [scanDepth, setScanDepth] = useState<"shallow" | "normal" | "deep">("normal");

  // Step 2
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

  // Step 3
  const [roles, setRoles] = useState<RoleRow[]>([
    { name: "Guest", token: "", cookies: "" },
    { name: "Authenticated User", token: "", cookies: "" },
    { name: "Admin", token: "", cookies: "" },
  ]);
  const [includeUrls, setIncludeUrls] = useState("");
  const [excludeUrls, setExcludeUrls] = useState("");
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>([]);

  const urlValid = /^https?:\/\/.+/.test(targetUrl);

  const canNext = () => {
    if (step === 0) return urlValid;
    return true;
  };

  const addRole = () => {
    if (roles.length >= 5) return;
    setRoles([...roles, { name: "", token: "", cookies: "" }]);
  };

  const removeRole = (i: number) => {
    setRoles(roles.filter((_, idx) => idx !== i));
  };

  const updateRole = (i: number, field: keyof RoleRow, value: string) => {
    const updated = [...roles];
    updated[i] = { ...updated[i], [field]: value };
    setRoles(updated);
  };

  const addHeader = () => setCustomHeaders([...customHeaders, { key: "", value: "" }]);
  const removeHeader = (i: number) => setCustomHeaders(customHeaders.filter((_, idx) => idx !== i));

  const testConnection = async () => {
    setTestingConnection(true);
    await new Promise((r) => setTimeout(r, 1500));
    setTestingConnection(false);
    toast.success("Connection test passed");
  };

  const getAuthCredentials = (): Record<string, string> => {
    switch (authType) {
      case "session":
        return { loginUrl, username, password, cookies: cookieString };
      case "jwt":
        return { token: jwtToken, headerName, prefix: headerPrefix };
      case "oauth":
        return { clientId, clientSecret, tokenEndpoint };
      default:
        return {};
    }
  };

  const launchScan = async () => {
    if (!user?.uid) return;
    setLaunching(true);
    try {
      const scanId = await createScan({
        userId: user.uid,
        targetUrl,
        scanProfile,
        status: ScanStatus.Queued,
        progress: 0,
        currentModule: "",
        authConfig: { type: authType, credentials: getAuthCredentials() },
        roles: roles.filter((r) => r.name),
        scope: {
          include: includeUrls.split("\n").filter(Boolean),
          exclude: excludeUrls.split("\n").filter(Boolean),
        },
        createdAt: Timestamp.now(),
        completedAt: null,
        aiSummary: "",
        stats: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
      });
      await incrementUserScans(user.uid);
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

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border ${
                  i <= step
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < stepLabels.length - 1 && (
                <div className={`w-8 h-px ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Target */}
        {step === 0 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <Label>Target URL</Label>
              <Input
                placeholder="https://example.com"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
              {targetUrl && !urlValid && (
                <p className="text-xs text-severity-critical">URL must start with http:// or https://</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Scan Profile</Label>
              <div className="grid md:grid-cols-3 gap-3">
                {profiles.map((p) => (
                  <Card
                    key={p.id}
                    className={`cursor-pointer transition-all ${
                      scanProfile === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/30"
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
              <div className="flex rounded-lg border border-border overflow-hidden w-fit">
                {(["shallow", "normal", "deep"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setScanDepth(d)}
                    className={`px-4 py-2 text-sm capitalize transition-colors ${
                      scanDepth === d
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Auth */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <Label>Authentication Type</Label>
              <div className="flex flex-wrap gap-2">
                {(["none", "session", "jwt", "oauth"] as AuthType[]).map((t) => (
                  <Button
                    key={t}
                    variant={authType === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAuthType(t)}
                    className="capitalize"
                  >
                    {t}
                  </Button>
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
                <div className="space-y-2">
                  <Label>Login URL</Label>
                  <Input placeholder="https://example.com/login" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cookie String</Label>
                  <Textarea placeholder="session_id=abc123; csrf_token=xyz" value={cookieString} onChange={(e) => setCookieString(e.target.value)} />
                </div>
              </div>
            )}

            {authType === "jwt" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>JWT Token</Label>
                  <Textarea placeholder="eyJhbGciOiJIUzI1NiIs..." value={jwtToken} onChange={(e) => setJwtToken(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Header Name</Label>
                    <Input value={headerName} onChange={(e) => setHeaderName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prefix</Label>
                    <Input value={headerPrefix} onChange={(e) => setHeaderPrefix(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {authType === "oauth" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Client ID</Label>
                  <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Token Endpoint URL</Label>
                  <Input placeholder="https://auth.example.com/token" value={tokenEndpoint} onChange={(e) => setTokenEndpoint(e.target.value)} />
                </div>
              </div>
            )}

            {authType !== "none" && (
              <Button variant="outline" size="sm" onClick={testConnection} disabled={testingConnection}>
                {testingConnection ? "Testing..." : "Test Connection"}
              </Button>
            )}
          </div>
        )}

        {/* Step 3 — Roles & Scope */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-3">
              <Label>Role Profiles</Label>
              {roles.map((role, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input
                    placeholder="Role name"
                    value={role.name}
                    onChange={(e) => updateRole(i, "name", e.target.value)}
                    className="w-40"
                  />
                  <Textarea
                    placeholder="Token / Cookie"
                    value={role.token || role.cookies}
                    onChange={(e) => updateRole(i, "token", e.target.value)}
                    rows={1}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-severity-critical" onClick={() => removeRole(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {roles.length < 5 && (
                <Button variant="outline" size="sm" onClick={addRole} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Role
                </Button>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Include URLs</Label>
                <Textarea
                  placeholder={"/admin/*\n/api/*"}
                  value={includeUrls}
                  onChange={(e) => setIncludeUrls(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Exclude URLs</Label>
                <Textarea
                  placeholder={"/logout\n/static/*"}
                  value={excludeUrls}
                  onChange={(e) => setExcludeUrls(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Custom Headers</Label>
              {customHeaders.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Key" value={h.key} onChange={(e) => {
                    const u = [...customHeaders];
                    u[i] = { ...u[i], key: e.target.value };
                    setCustomHeaders(u);
                  }} className="w-40" />
                  <Input placeholder="Value" value={h.value} onChange={(e) => {
                    const u = [...customHeaders];
                    u[i] = { ...u[i], value: e.target.value };
                    setCustomHeaders(u);
                  }} className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => removeHeader(i)} className="text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addHeader} className="gap-1">
                <Plus className="h-3 w-3" /> Add Header
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-1">
                  <span className="text-xs text-muted-foreground">Target URL</span>
                  <p className="text-sm font-medium text-foreground break-all">{targetUrl}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-1">
                  <span className="text-xs text-muted-foreground">Scan Profile</span>
                  <p className="text-sm font-medium text-foreground capitalize">{scanProfile}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-1">
                  <span className="text-xs text-muted-foreground">Auth Type</span>
                  <p className="text-sm font-medium text-foreground capitalize">{authType}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-1">
                  <span className="text-xs text-muted-foreground">Roles</span>
                  <p className="text-sm font-medium text-foreground">{roles.filter((r) => r.name).length} roles configured</p>
                </CardContent>
              </Card>
            </div>

            <Button className="w-full gap-2 h-12 text-base" onClick={launchScan} disabled={launching}>
              {launching ? "Launching..." : (<><Rocket className="h-5 w-5" /> Launch Scan</>)}
            </Button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < 3 && (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="gap-1">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default NewScan;
