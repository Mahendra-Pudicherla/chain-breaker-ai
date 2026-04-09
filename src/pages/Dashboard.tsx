import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Activity, AlertTriangle, Clock, Plus, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AppShell from "@/components/layout/AppShell";
import SeverityBadge from "@/components/scan/SeverityBadge";
import SeverityDonut from "@/components/charts/SeverityDonut";
import ScanCard from "@/components/scan/ScanCard";
import { useAuthStore } from "@/store/authStore";
import { onUserDoc, onUserScans } from "@/lib/firestore";
import type { Scan, User, ScanStats } from "@/types";
import { ScanStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  queued: "bg-muted-foreground",
  crawling: "bg-severity-info",
  scanning: "bg-primary",
  analyzing: "bg-purple-500",
  completed: "bg-severity-low",
  failed: "bg-severity-critical",
};

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    const duration = 800;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);

  return <>{display}</>;
}

function EmptyState({ message, cta, onCta }: { message: string; cta: string; onCta: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-3">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-muted-foreground/30">
        <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M16 18h16M16 24h12M16 30h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onCta} className="gap-1">
        <Plus className="h-3 w-3" /> {cta}
      </Button>
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();
  const [userData, setUserData] = useState<User | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser?.uid) { setLoading(false); return; }
    const unsub1 = onUserDoc(authUser.uid, setUserData);
    const unsub2 = onUserScans(authUser.uid, (s) => {
      setScans(s);
      setLoading(false);
    });
    return () => { unsub1(); unsub2(); };
  }, [authUser?.uid]);

  const activeScans = scans.filter((s) => ![ScanStatus.Completed, ScanStatus.Failed].includes(s.status as ScanStatus));
  const totalCritical = scans.reduce((sum, s) => sum + (s.stats?.critical ?? 0), 0);
  const lastScan = scans[0];
  const lastScanTime = lastScan?.createdAt?.toDate
    ? formatDistanceToNow(lastScan.createdAt.toDate(), { addSuffix: true })
    : "Never";

  const aggregatedStats: ScanStats = scans.reduce(
    (acc, s) => ({
      critical: acc.critical + (s.stats?.critical ?? 0),
      high: acc.high + (s.stats?.high ?? 0),
      medium: acc.medium + (s.stats?.medium ?? 0),
      low: acc.low + (s.stats?.low ?? 0),
      info: acc.info + (s.stats?.info ?? 0),
      total: acc.total + (s.stats?.total ?? 0),
    }),
    { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 }
  );

  const recentScans = scans.slice(0, 5);

  const statCards = [
    { title: "Total Scans", value: userData?.totalScans ?? 0, icon: BarChart3, color: "bg-primary/10 text-primary" },
    { title: "Active Scans", value: activeScans.length, icon: Activity, color: "bg-severity-info/10 text-severity-info" },
    { title: "Critical Findings", value: totalCritical, icon: AlertTriangle, color: "bg-severity-critical/10 text-severity-critical" },
    { title: "Last Scan", value: lastScanTime, icon: Clock, color: "bg-severity-medium/10 text-severity-medium", isText: true },
  ];

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-6xl">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-10 w-36" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <Button onClick={() => navigate("/scan/new")} className="gap-2">
            <Plus className="h-4 w-4" /> Start New Scan
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-card border-border card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-muted-foreground block">{stat.title}</span>
                  <p className="text-xl font-bold text-foreground truncate">
                    {(stat as any).isText ? stat.value : <AnimatedCounter value={stat.value as number} />}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          {/* Recent Scans */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Scans</CardTitle>
            </CardHeader>
            <CardContent>
              {recentScans.length === 0 ? (
                <EmptyState message="No scans yet. Launch your first scan." cta="Start Scan" onCta={() => navigate("/scan/new")} />
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground text-xs">
                          <th className="text-left py-2 font-medium">Target</th>
                          <th className="text-left py-2 font-medium">Profile</th>
                          <th className="text-left py-2 font-medium">Status</th>
                          <th className="text-center py-2 font-medium">Findings</th>
                          <th className="text-right py-2 font-medium">Date</th>
                          <th className="py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentScans.map((scan) => (
                          <tr key={scan.scanId} className="border-b border-border/50 hover:bg-surface-elevated/50 transition-colors">
                            <td className="py-2.5 max-w-[200px] truncate text-foreground">{scan.targetUrl}</td>
                            <td className="py-2.5">
                              <Badge variant="secondary" className="text-[10px] uppercase">{scan.scanProfile}</Badge>
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${statusColors[scan.status] ?? "bg-muted-foreground"}`} />
                                <span className="text-xs capitalize text-muted-foreground">{scan.status}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-center text-muted-foreground">{scan.stats?.total ?? 0}</td>
                            <td className="py-2.5 text-right text-xs text-muted-foreground">
                              {scan.createdAt?.toDate
                                ? formatDistanceToNow(scan.createdAt.toDate(), { addSuffix: true })
                                : "—"}
                            </td>
                            <td className="py-2.5 text-right">
                              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/scan/${scan.scanId}/report`)}>
                                <ExternalLink className="h-3 w-3 mr-1" /> View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {recentScans.map((scan) => (
                      <ScanCard key={scan.scanId} scan={scan} />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Severity overview */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Severity Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {aggregatedStats.total === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No findings yet</p>
              ) : (
                <SeverityDonut stats={aggregatedStats} size={140} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default Dashboard;
