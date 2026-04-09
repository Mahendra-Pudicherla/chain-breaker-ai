import { useNavigate } from "react-router-dom";
import { ExternalLink, Copy, RotateCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Scan } from "@/types";
import { ScanStatus } from "@/types";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ScanCardProps {
  scan: Scan;
  onDelete?: (scanId: string) => void;
  onRescan?: (scan: Scan) => void;
}

const statusConfig: Record<string, { color: string; pulse: boolean }> = {
  queued: { color: "bg-muted-foreground", pulse: false },
  crawling: { color: "bg-severity-info", pulse: true },
  scanning: { color: "bg-primary", pulse: true },
  analyzing: { color: "bg-purple-500", pulse: true },
  completed: { color: "bg-severity-low", pulse: false },
  failed: { color: "bg-severity-critical", pulse: false },
};

const ScanCard = ({ scan, onDelete, onRescan }: ScanCardProps) => {
  const navigate = useNavigate();
  const sc = statusConfig[scan.status] ?? statusConfig.queued;
  const total = scan.stats?.total ?? 0;
  const stats = scan.stats ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const isActive = ![ScanStatus.Completed, ScanStatus.Failed].includes(scan.status as ScanStatus);

  const severitySegments = [
    { count: stats.critical, color: "bg-severity-critical" },
    { count: stats.high, color: "bg-severity-high" },
    { count: stats.medium, color: "bg-severity-medium" },
    { count: stats.low, color: "bg-severity-low" },
    { count: stats.info, color: "bg-severity-info" },
  ];

  const copyUrl = () => {
    navigator.clipboard.writeText(scan.targetUrl);
    toast.success("URL copied");
  };

  const dateStr = scan.createdAt?.toDate
    ? formatDistanceToNow(scan.createdAt.toDate(), { addSuffix: true })
    : "Unknown";

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate text-foreground">{scan.targetUrl}</p>
              <button onClick={copyUrl} className="shrink-0 text-muted-foreground hover:text-foreground">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] uppercase">
            {scan.scanProfile}
          </Badge>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${sc.color} ${sc.pulse ? "animate-pulse-dot" : ""}`} />
            <span className="text-xs text-muted-foreground capitalize">{scan.status}</span>
          </div>
        </div>

        {total > 0 && (
          <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
            {severitySegments.map((seg, i) =>
              seg.count > 0 ? (
                <div
                  key={i}
                  className={`${seg.color} transition-all`}
                  style={{ width: `${(seg.count / total) * 100}%` }}
                />
              ) : null
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} finding{total !== 1 ? "s" : ""}</span>
          <span>{dateStr}</span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            onClick={() =>
              isActive
                ? navigate(`/scan/${scan.scanId}/live`)
                : navigate(`/scan/${scan.scanId}/report`)
            }
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            {isActive ? "Monitor" : "View Report"}
          </Button>
          {onRescan && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onRescan(scan)}>
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-severity-critical" onClick={() => onDelete(scan.scanId)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScanCard;
