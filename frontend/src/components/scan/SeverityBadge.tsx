import { Badge } from "@/components/ui/badge";
import { type Severity } from "@/types";

interface SeverityBadgeProps {
  severity: Severity | string;
  className?: string;
}

const config: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-severity-critical/15", text: "text-severity-critical", border: "border-severity-critical/30" },
  high: { bg: "bg-severity-high/15", text: "text-severity-high", border: "border-severity-high/30" },
  medium: { bg: "bg-severity-medium/15", text: "text-severity-medium", border: "border-severity-medium/30" },
  low: { bg: "bg-severity-low/15", text: "text-severity-low", border: "border-severity-low/30" },
  info: { bg: "bg-severity-info/15", text: "text-severity-info", border: "border-severity-info/30" },
};

const SeverityBadge = ({ severity, className = "" }: SeverityBadgeProps) => {
  const c = config[severity] ?? config.info;
  return (
    <Badge
      variant="outline"
      className={`${c.bg} ${c.text} ${c.border} text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 ${className}`}
    >
      {severity}
    </Badge>
  );
};

export default SeverityBadge;
