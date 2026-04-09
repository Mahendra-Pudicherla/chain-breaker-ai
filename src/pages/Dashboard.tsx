import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Activity, AlertTriangle, Clock, Plus, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppShell from "@/components/layout/AppShell";
import SeverityBadge from "@/components/scan/SeverityBadge";
import SeverityDonut from "@/components/charts/SeverityDonut";
import { useAuthStore } from "@/store/authStore";
import { onUserDoc, onUserScans, onFindings } from "@/lib/firestore";
import type { Scan, Finding, User, ScanStats } from "@/types";
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

const Dashboard = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();
  const [userData, setUserData] = useState<User | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [criticalFindings, setCriticalFindings] = useState<(Finding & { scanId: string })[]>([]);

  useEffect(() => {
    if (!authUser?.uid) return;
    const unsub1 = onUserDoc(authUser.uid, setUserData);
    const unsub2 = onUserScans(authUser.uid, (s) => {
      setScans(s);
      // Fetch critical findings from completed scans
      const completedScans = s.filter((sc) => sc.stats?.critical > 0).slice(0, 5);
      completedScans.forEach((sc) => {
        onFindings(sc.scanId, (findings) => {
          const crits = findings
            .filter((f) => f.severity === "critical")
            .slice(0, 5)
            .map((f) => ({ ...f, scanId: sc.scanId }));
          setCriticalFindings((prev) => {
            const filtered = prev.filter((p) => p.scanId !== sc.scanId);
            return [...filtered, ...crits].slice(0, 5);
          });
        });
      });
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
    { title: "Total Scans", value: userData?.totalScans ?? 0, icon: BarChart3 },
    { title: "Active Scans", value: activeScans.length, icon: Activity },
    { title: "Critical Findings", value: totalCritical, icon: AlertTriangle },
    { title: "Last Scan", value: lastScanTime, icon: Clock },
  ];

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{stat.title}</span>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Scans */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Scans</CardTitle>
            </CardHeader>
            <CardContent>
              {recentScans.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No scans yet. Launch your first scan to get started.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/scan/new")}>
                    Start Scan
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                        <tr key={scan.scanId} className="border-b border-border/50 hover:bg-muted/30">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => navigate(`/scan/${scan.scanId}/report`)}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" /> View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

        {/* Critical findings */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Critical Findings</CardTitle>
          </CardHeader>
          <CardContent>
            {criticalFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No critical findings detected</p>
            ) : (
              <div className="space-y-2">
                {criticalFindings.map((f) => (
                  <div key={f.findingId} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30">
                    <SeverityBadge severity="critical" />
                    <span className="text-sm text-foreground flex-1 truncate">{f.title}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">{f.url}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => navigate(`/scan/${f.scanId}/report`)}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Dashboard;
