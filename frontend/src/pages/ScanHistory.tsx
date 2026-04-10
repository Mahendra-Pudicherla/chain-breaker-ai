import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AppShell from "@/components/layout/AppShell";
import ScanCard from "@/components/scan/ScanCard";
import { useAuthStore } from "@/store/authStore";
import { onUserScans, deleteScanFull, createScan, incrementUserScans } from "@/lib/firestore";
import type { Scan } from "@/types";
import { ScanStatus, ScanProfile } from "@/types";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 12;

const ScanHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "findings">("newest");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const unsub = onUserScans(user.uid, (s) => { setScans(s); setLoading(false); });
    return unsub;
  }, [user?.uid]);

  const filtered = useMemo(() => {
    let f = [...scans];
    if (debouncedSearch) f = f.filter((s) => s.targetUrl.toLowerCase().includes(debouncedSearch.toLowerCase()));
    if (statusFilter !== "all") f = f.filter((s) => s.status === statusFilter);
    if (profileFilter !== "all") f = f.filter((s) => s.scanProfile === profileFilter);
    if (sortOrder === "oldest") f.reverse();
    if (sortOrder === "findings") f.sort((a, b) => (b.stats?.total ?? 0) - (a.stats?.total ?? 0));
    return f;
  }, [scans, debouncedSearch, statusFilter, profileFilter, sortOrder]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await deleteScanFull(deleteId); toast.success("Deleted successfully"); } catch { toast.error("Failed to delete scan"); }
    setDeleteId(null);
  };

  const handleRescan = async (scan: Scan) => {
    if (!user?.uid) return;
    try {
      const newId = await createScan({
        userId: user.uid, targetUrl: scan.targetUrl, scanProfile: scan.scanProfile,
        status: ScanStatus.Queued, progress: 0, currentModule: "",
        authConfig: scan.authConfig, roles: scan.roles, scope: scan.scope,
        createdAt: Timestamp.now(), completedAt: null, aiSummary: "",
        stats: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
      });
      await incrementUserScans(user.uid);
      toast.success("Scan started successfully");
      navigate(`/scan/${newId}/live`);
    } catch { toast.error("Failed to create scan"); }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Scan History</h1>
          <Button onClick={() => navigate("/scan/new")} className="gap-2"><Plus className="h-4 w-4" /> New Scan</Button>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by URL..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search scans" />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.values(ScanStatus).map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={profileFilter} onValueChange={setProfileFilter}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Profile" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.values(ScanProfile).map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="findings">Most Findings</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary/50" />
            </div>
            <p className="text-sm text-muted-foreground">No scans yet. Launch your first security scan.</p>
            <Button onClick={() => navigate("/scan/new")} className="gap-2"><Plus className="h-4 w-4" /> Start Scan</Button>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              {filtered.slice(0, visibleCount).map((scan) => (
                <ScanCard key={scan.scanId} scan={scan} onDelete={(id) => setDeleteId(id)} onRescan={handleRescan} />
              ))}
            </div>
            {visibleCount < filtered.length && (
              <div className="text-center pt-4"><Button variant="outline" onClick={() => setVisibleCount((c) => c + ITEMS_PER_PAGE)}>Load More</Button></div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scan?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the scan and all associated findings. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-severity-critical text-primary-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default ScanHistory;
