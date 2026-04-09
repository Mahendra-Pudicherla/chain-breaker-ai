import SeverityBadge from "./SeverityBadge";
import { Badge } from "@/components/ui/badge";
import type { Finding } from "@/types";

interface FindingCardProps {
  finding: Finding;
  onClick?: () => void;
}

const typeLabels: Record<string, string> = {
  sqli: "SQL Injection",
  xss: "Cross-Site Scripting",
  csrf: "CSRF",
  idor: "IDOR",
  ssrf: "SSRF",
  open_redirect: "Open Redirect",
  broken_auth: "Broken Auth",
  misconfig: "Misconfiguration",
  sensitive_data: "Sensitive Data",
  rbac: "RBAC",
  api: "API",
  logic: "Business Logic",
};

const FindingCard = ({ finding, onClick }: FindingCardProps) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-surface-elevated transition-colors cursor-pointer ${
        finding.severity === "critical" ? "border-l-2 border-l-severity-critical" : ""
      }`}
    >
      <SeverityBadge severity={finding.severity} />
      <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
        {typeLabels[finding.type] ?? finding.type}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground">{finding.title}</p>
        <p className="text-xs text-muted-foreground truncate">{finding.url}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-mono text-muted-foreground">CVSS {finding.cvssScore?.toFixed(1)}</p>
      </div>
    </div>
  );
};

export default FindingCard;
