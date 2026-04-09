import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ExternalLink, Pause, Square, Clock,
  Search, Shield, Cpu, Bot, FileText, Key, Bug, CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AppShell from "@/components/layout/AppShell";
import ProgressRing from "@/components/scan/ProgressRing";
import SeverityBadge from "@/components/scan/SeverityBadge";
import SitemapGraph from "@/components/sitemap/SitemapGraph";
import { onScan, onFindings, onSitemapNodes, updateScan } from "@/lib/firestore";
import type { Scan, Finding, SitemapNode } from "@/types";
import { ScanStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";

const moduleSteps = [
  { key: "crawler", icon: Search, label: "Crawler" },
  { key: "auth", icon: Key, label: "Auth" },
  { key: "vuln_scanner", icon: Bug, label: "Vuln Scanner" },
  { key: "api_analyzer", icon: Cpu, label: "API Analyzer" },
  { key: "rbac_tester", icon: Shield, label: "RBAC Tester" },
  { key: "ai_analysis", icon: Bot, label: "AI Analysis" },
  { key: "report", icon: FileText, label: "Report" },
];

function useElapsedTimer(startDate: Date | null) {
  const [elapsed, setElapsed] = useState("00:00:00");
  useEffect(() => {
    if (!startDate) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - startDate.getTime()) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startDate]);
  return elapsed;
}

const LiveScan = () => {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [nodes, setNodes] = useState<SitemapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const startDate = scan?.createdAt?.toDate ? scan.createdAt.toDate() : null;
  const elapsed = useElapsedTimer(startDate);

  useEffect(() => {
    if (!scanId) return;
    const unsub1 = onScan(scanId, (s) => { setScan(s); setLoading(false); });
    const unsub2 = onFindings(scanId, setFindings);
    const unsub3 = onSitemapNodes(scanId, setNodes);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [scanId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [findings.length]);

  const isActive = scan && ![ScanStatus.Completed, ScanStatus.Failed].includes(scan.status as ScanStatus);

  const handlePause = async () => { if (scanId) await updateScan(scanId, { status: ScanStatus.Queued } as any); };
  const handleStop = async () => { if (scanId) await updateScan(scanId, { status: ScanStatus.Failed } as any); };

  const currentModuleIndex = moduleSteps.findIndex((m) => m.key === scan?.currentModule);

  const severityCounts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-6xl">
          <Skeleton className="h-8 w-72" />
          <div className="grid lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="lg:col-span-2 h-64 rounded-lg" />
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </AppShell>
    );
  }

  if (!scan) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 space-y-3">
          <p className="text-muted-foreground">Scan not found</p>
          <Button variant="outline" onClick={() => navigate("/scans")}>Go to Scan History</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl">
        {scan.status === ScanStatus.Completed && (
          <div className="p-4 rounded-xl bg-severity-low/10 border border-severity-low/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-severity-low" />
              <span className="text-sm font-medium text-foreground">Scan Complete! Found {scan.stats?.total ?? 0} vulnerabilities</span>
            </div>
            <Button size="sm" onClick={() => navigate(`/scan/${scanId}/report`)}>View Full Report</Button>
          </div>
        )}
        {scan.status === ScanStatus.Failed && (
          <div className="p-4 rounded-xl bg-severity-critical/10 border border-severity-critical/30">
            <span className="text-sm font-medium text-severity-critical">Scan Failed</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <a href={scan.targetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline truncate max-w-[200px] sm:max-w-none">
            {scan.targetUrl} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <Badge variant="secondary" className="text-[10px] uppercase">{scan.scanProfile}</Badge>
          <div className="flex items-center gap-1.5">
            {isActive && <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />}
            <span className="text-xs capitalize text-muted-foreground">{scan.status}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{elapsed}</span>
          </div>
          {isActive && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePause} className="gap-1 text-xs" aria-label="Pause scan"><Pause className="h-3 w-3" /> Pause</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 text-xs text-severity-critical border-severity-critical/30" aria-label="Stop scan"><Square className="h-3 w-3" /> Stop</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Stop Scan?</AlertDialogTitle>
                    <AlertDialogDescription>This will terminate the scan immediately. All findings collected so far will be preserved.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleStop} className="bg-severity-critical text-primary-foreground">Stop Scan</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          {/* Progress */}
          <Card className="bg-card border-border">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <ProgressRing progress={scan.progress ?? 0} size={140} label={scan.currentModule} />
              <div className="flex flex-wrap items-center justify-center gap-1 mt-2">
                {moduleSteps.map((m, i) => {
                  const isCompleted = i < currentModuleIndex;
                  const isCurrent = i === currentModuleIndex;
                  return (
                    <div key={m.key} className="flex flex-col items-center gap-1 w-14">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                        isCompleted ? "bg-severity-low/20 text-severity-low"
                        : isCurrent ? "bg-primary/20 text-primary ring-2 ring-primary/50"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {isCompleted ? <CheckCircle className="h-3.5 w-3.5" />
                          : isCurrent ? <m.icon className="h-3.5 w-3.5 animate-spin-slow" />
                          : <m.icon className="h-3.5 w-3.5" />}
                      </div>
                      <span className={`text-[9px] text-center leading-tight ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Findings feed */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <CardTitle className="text-base">Live Findings</CardTitle>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="text-severity-critical font-medium">{severityCounts.critical} Critical</span>
                  <span className="text-severity-high font-medium">{severityCounts.high} High</span>
                  <span className="text-severity-medium font-medium">{severityCounts.medium} Medium</span>
                  <span className="text-severity-low font-medium">{severityCounts.low} Low</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={feedRef} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {findings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{isActive ? "Waiting for findings..." : "No findings detected"}</p>
                ) : (
                  findings.map((f, i) => (
                    <div key={f.findingId || i} className={`flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 animate-slide-in-right ${
                      f.severity === "critical" ? "border-l-2 border-l-severity-critical bg-severity-critical/5" : ""
                    }`}>
                      <SeverityBadge severity={f.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{f.url}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {f.createdAt?.toDate ? formatDistanceToNow(f.createdAt.toDate(), { addSuffix: true }) : "now"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sitemap */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">Sitemap Discovery</CardTitle></CardHeader>
          <CardContent>
            {nodes.length === 0 ? (
              <div className="flex flex-col items-center py-8 space-y-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Crawler discovering nodes...</p>
              </div>
            ) : <SitemapGraph nodes={nodes} />}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default LiveScan;
