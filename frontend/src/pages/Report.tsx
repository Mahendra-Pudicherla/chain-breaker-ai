import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Download, Copy, Shield, ChevronDown, ChevronRight, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import AppShell from "@/components/layout/AppShell";
import SeverityBadge from "@/components/scan/SeverityBadge";
import SeverityDonut from "@/components/charts/SeverityDonut";
import SitemapGraph from "@/components/sitemap/SitemapGraph";
import { getScan, getFindings, getSitemapNodes } from "@/lib/firestore";
import type { Scan, Finding, SitemapNode, ScanStats } from "@/types";
import { Severity, FindingType } from "@/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const owaspCategories = [
  { id: "A01", name: "Broken Access Control", types: ["idor", "rbac", "broken_auth"] },
  { id: "A02", name: "Cryptographic Failures", types: ["sensitive_data"] },
  { id: "A03", name: "Injection", types: ["sqli", "xss", "ssrf"] },
  { id: "A04", name: "Insecure Design", types: ["logic"] },
  { id: "A05", name: "Security Misconfiguration", types: ["misconfig"] },
  { id: "A06", name: "Vulnerable Components", types: [] },
  { id: "A07", name: "Auth Failures", types: ["broken_auth", "csrf"] },
  { id: "A08", name: "Software Integrity", types: [] },
  { id: "A09", name: "Logging Failures", types: [] },
  { id: "A10", name: "SSRF", types: ["ssrf"] },
];

const sevBorderColors: Record<string, string> = {
  critical: "border-l-severity-critical",
  high: "border-l-severity-high",
  medium: "border-l-severity-medium",
  low: "border-l-severity-low",
  info: "border-l-severity-info",
};

function asDate(value: any): Date | null {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button
          variant="ghost" size="sm" className="h-6 text-[10px]"
          onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied"); }}
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3 w-3 mr-1" /> Copy
        </Button>
      </div>
      <pre className="p-3 rounded-lg bg-[#0d0d14] border border-border text-xs font-mono overflow-x-auto text-foreground">
        {code}
      </pre>
    </div>
  );
}

function FindingDetail({ finding }: { finding: Finding }) {
  return (
    <div className="p-4 bg-muted/30 rounded-lg space-y-4 animate-fade-in">
      <Tabs defaultValue="overview">
        <TabsList className="bg-muted overflow-x-auto flex-nowrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1"><Sparkles className="h-3 w-3" /> AI Analysis</TabsTrigger>
          <TabsTrigger value="remediation">Remediation</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-3 mt-3">
          <p className="text-sm text-muted-foreground">{finding.description || "No description available."}</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-xs text-muted-foreground">URL</span><p className="text-foreground break-all">{finding.url}</p></div>
            <div><span className="text-xs text-muted-foreground">Method</span><p className="text-foreground">{finding.method}</p></div>
            <div><span className="text-xs text-muted-foreground">Parameter</span><p className="text-foreground font-mono text-xs">{finding.parameter || "—"}</p></div>
          </div>
        </TabsContent>
        <TabsContent value="technical" className="space-y-3 mt-3">
          {finding.payload && <CodeBlock code={finding.payload} label="Payload" />}
          {finding.evidence && <CodeBlock code={finding.evidence} label="Evidence" />}
        </TabsContent>
        <TabsContent value="ai" className="space-y-3 mt-3">
          <p className="text-sm text-muted-foreground">{finding.aiExplanation || "AI analysis pending."}</p>
          {finding.businessImpact && (
            <div><span className="text-xs text-muted-foreground font-medium">Business Impact</span><p className="text-sm text-muted-foreground mt-1">{finding.businessImpact}</p></div>
          )}
          <div>
            <span className="text-xs text-muted-foreground font-medium">False Positive Confidence</span>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={(finding.falsePositiveConfidence ?? 0) * 100} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{Math.round((finding.falsePositiveConfidence ?? 0) * 100)}% chance false positive</span>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="remediation" className="space-y-3 mt-3">
          <div className="text-sm text-muted-foreground prose prose-sm prose-invert max-w-none prose-pre:bg-[#0d0d14] prose-pre:p-3 prose-pre:rounded-lg prose-pre:border-border">
            <ReactMarkdown>{finding.aiRemediation || "Remediation guidance pending."}</ReactMarkdown>
          </div>
          {finding.attackChain && finding.attackChain.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">Attack Chain</span>
              <div className="mt-2 space-y-1">
                {finding.attackChain.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Report = () => {
  const { scanId } = useParams<{ scanId: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [nodes, setNodes] = useState<SitemapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"severity" | "cvss" | "risk">("severity");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!scanId) return;
    (async () => {
      const [s, f, n] = await Promise.all([getScan(scanId), getFindings(scanId), getSitemapNodes(scanId)]);
      setScan(s); setFindings(f); setNodes(n); setLoading(false);
    })();
  }, [scanId]);

  const filteredFindings = useMemo(() => {
    let f = [...findings];
    if (severityFilter !== "all") f = f.filter((x) => x.severity === severityFilter);
    if (typeFilter !== "all") f = f.filter((x) => x.type === typeFilter);
    if (confirmedOnly) f = f.filter((x) => x.isConfirmed);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      f = f.filter((x) => x.title.toLowerCase().includes(q) || x.url.toLowerCase().includes(q));
    }
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    if (sortBy === "severity") f.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));
    else if (sortBy === "cvss") f.sort((a, b) => (b.cvssScore ?? 0) - (a.cvssScore ?? 0));
    else f.sort((a, b) => (b.businessRiskScore ?? 0) - (a.businessRiskScore ?? 0));
    return f;
  }, [findings, severityFilter, typeFilter, confirmedOnly, debouncedSearch, sortBy]);

  const stats: ScanStats = scan?.stats ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
  const riskScore = Math.min(100, stats.critical * 20 + stats.high * 10 + stats.medium * 5 + stats.low);
  const riskColor = riskScore >= 80 ? "text-severity-critical" : riskScore >= 50 ? "text-severity-high" : riskScore >= 20 ? "text-severity-medium" : "text-severity-low";
  const createdAtDate = asDate((scan as any)?.createdAt);
  const completedAtDate = asDate((scan as any)?.completedAt);
  const scanDurationMinutes =
    createdAtDate && completedAtDate
      ? `${Math.round((completedAtDate.getTime() - createdAtDate.getTime()) / 60000)} min`
      : "—";

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  }, []);

  const exportPDF = useCallback(async () => {
    try {
      toast.info("Generating PDF report...");
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const el = document.getElementById("report-content");
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: "#0a0a0f" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, w, h);
      pdf.save(`chain-breaker-ai-report-${scanId}.pdf`);
      toast.success("PDF downloaded");
    } catch { toast.error("Failed to generate PDF"); }
  }, [scanId]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-6xl">
          <Skeleton className="h-10 w-72" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          <Skeleton className="h-64 rounded-lg" />
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        </div>
      </AppShell>
    );
  }

  const apiNodes = nodes.filter((n) => n.type === "api");

  const sevCards = [
    { sev: "critical" as const, count: stats.critical, border: "border-l-severity-critical" },
    { sev: "high" as const, count: stats.high, border: "border-l-severity-high" },
    { sev: "medium" as const, count: stats.medium, border: "border-l-severity-medium" },
    { sev: "low" as const, count: stats.low, border: "border-l-severity-low" },
    { sev: "info" as const, count: stats.info, border: "border-l-severity-info" },
  ];

  return (
    <AppShell>
      <div id="report-content" className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">Security Assessment Report</h1>
              <p className="text-xs text-muted-foreground">
                {scan?.targetUrl} · {scan?.scanProfile} · {createdAtDate?.toLocaleDateString() ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={exportPDF} className="gap-2 flex-1 sm:flex-none" size="sm"><Download className="h-4 w-4" /> Download PDF</Button>
            <Button variant="outline" onClick={copyLink} size="sm" className="gap-2 flex-1 sm:flex-none"><Copy className="h-4 w-4" /> Copy Link</Button>
          </div>
        </div>

        {/* Severity cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {sevCards.map((s) => (
            <Card key={s.sev} className={`bg-card border-border border-l-4 ${s.border}`}>
              <CardContent className="p-3 text-center">
                <SeverityBadge severity={s.sev} className="mb-2" />
                <p className="text-3xl font-extrabold text-foreground">{s.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          <Card className="bg-card border-border"><CardContent className="p-4 text-center space-y-2">
            <span className="text-xs text-muted-foreground">Overall Risk Score</span>
            <p className={`text-5xl font-extrabold ${riskColor}`}>{riskScore}</p>
            <span className="text-xs text-muted-foreground">/100</span>
          </CardContent></Card>
          <Card className="md:col-span-2 bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> AI Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground leading-relaxed prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{scan?.aiSummary || `Security scan of ${scan?.targetUrl || "the target"} completed with ${stats?.total || 0} findings across ${nodes?.length || 0} discovered endpoints. Review the findings below for detailed vulnerability analysis and remediation guidance.`}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pages Crawled", value: nodes.filter((n) => n.type === "page").length },
            { label: "Endpoints Tested", value: nodes.filter((n) => n.scanned).length },
            { label: "Scan Duration", value: scanDurationMinutes },
            { label: "Total Findings", value: stats.total },
          ].map((s) => (
            <Card key={s.label} className="bg-card border-border"><CardContent className="p-3 text-center">
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* Findings */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">Findings ({filteredFindings.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-28 sm:w-32 h-8 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  {Object.values(Severity).map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-28 sm:w-36 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.values(FindingType).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={confirmedOnly} onCheckedChange={setConfirmedOnly} id="confirmed" />
                <Label htmlFor="confirmed" className="text-xs text-muted-foreground">Confirmed</Label>
              </div>
              <div className="relative flex-1 min-w-[150px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-7 h-8 text-xs" aria-label="Search findings" />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-24 sm:w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="severity">Severity</SelectItem>
                  <SelectItem value="cvss">CVSS</SelectItem>
                  <SelectItem value="risk">Biz Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No findings match your filters</p>
            ) : (
              <div className="space-y-1">
                {filteredFindings.map((f) => (
                  <div key={f.findingId}>
                    <button
                      onClick={() => setExpandedId(expandedId === f.findingId ? null : f.findingId)}
                      className={`w-full text-left flex items-center gap-2 sm:gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors border-l-2 ${sevBorderColors[f.severity] ?? ""}`}
                    >
                      <SeverityBadge severity={f.severity} />
                      <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{f.type}</Badge>
                      <span className="text-sm truncate text-foreground flex-1">{f.title}</span>
                      <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[120px]">{f.url}</span>
                      <span className="text-xs font-mono text-muted-foreground hidden sm:block">{f.cvssScore?.toFixed(1)}</span>
                      <span className="text-xs text-primary flex items-center gap-1 shrink-0">
                        {expandedId === f.findingId ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </span>
                    </button>
                    {expandedId === f.findingId && <FindingDetail finding={f} />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RBAC Matrix */}
        {scan?.roles && scan.roles.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">RBAC Access Matrix</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg">
                <table className="w-full text-sm min-w-[400px]">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Endpoint</th>
                    {scan.roles.map((r) => <th key={r.name} className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">{r.name}</th>)}
                  </tr></thead>
                  <tbody>{nodes.filter((n) => n.type !== "asset").slice(0, 20).map((n) => (
                    <tr key={n.url} className="border-b border-border/50">
                      <td className="py-2 px-3 text-xs text-foreground truncate max-w-[200px]">{n.url}</td>
                      {scan.roles.map((r) => (
                        <td key={r.name} className="py-2 px-3 text-center">
                          <Badge variant="outline" className={`text-[10px] ${n.vulnerable ? "text-severity-high border-severity-high/30 bg-severity-high/10" : "text-severity-low border-severity-low/30 bg-severity-low/10"}`}>
                            {n.vulnerable ? "Unexpected" : "OK"}
                          </Badge>
                        </td>
                      ))}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* API Coverage */}
        {apiNodes.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">API Coverage ({apiNodes.length})</CardTitle></CardHeader>
            <CardContent><div className="space-y-1">{apiNodes.map((n) => {
              const findingsForUrl = findings.filter((f) => f.url === n.url);
              return (
                <div key={n.url} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                  <Badge variant="outline" className="text-[10px] font-mono w-14 justify-center">{n.method}</Badge>
                  <span className="text-sm text-foreground truncate flex-1">{n.url}</span>
                  <Badge variant={n.vulnerable ? "destructive" : "secondary"} className="text-[10px]">{n.vulnerable ? "Vulnerable" : n.scanned ? "Clean" : "Untested"}</Badge>
                  {findingsForUrl.length > 0 && <span className="text-xs text-muted-foreground">{findingsForUrl.length}</span>}
                </div>
              );
            })}</div></CardContent>
          </Card>
        )}

        {nodes.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">Sitemap</CardTitle></CardHeader>
            <CardContent><SitemapGraph nodes={nodes} interactive={false} /></CardContent>
          </Card>
        )}

        {/* OWASP */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">OWASP Top 10 Compliance</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg">
              <table className="w-full text-sm min-w-[400px]">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">ID</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Category</th>
                  <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Findings</th>
                </tr></thead>
                <tbody>{owaspCategories.map((cat) => {
                  const catFindings = findings.filter((f) => cat.types.includes(f.type));
                  const status = catFindings.length > 0 ? "vulnerable" : cat.types.length === 0 ? "not_tested" : "clean";
                  return (
                    <tr key={cat.id} className={`border-b border-border/50 ${
                      status === "vulnerable" ? "bg-severity-critical/5" : status === "clean" ? "bg-severity-low/5" : ""
                    }`}>
                      <td className="py-2 px-3 text-xs font-mono text-muted-foreground">{cat.id}</td>
                      <td className="py-2 px-3 text-sm text-foreground">{cat.name}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${
                          status === "vulnerable" ? "text-severity-critical border-severity-critical/30 bg-severity-critical/10"
                          : status === "clean" ? "text-severity-low border-severity-low/30 bg-severity-low/10"
                          : "text-muted-foreground border-border bg-muted/30"
                        }`}>{status === "vulnerable" ? "Vulnerable" : status === "clean" ? "Clean" : "Not Tested"}</Badge>
                      </td>
                      <td className="py-2 px-3 text-center text-xs text-muted-foreground">{catFindings.length}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Report;
