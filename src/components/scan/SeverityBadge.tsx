import { Badge } from "@/components/ui/badge";
import type { Severity } from "@/types";

interface SeverityBadgeProps {
  severity: Severity;
}

const severityClasses: Record<string, string> = {
  critical: "bg-severity-critical/20 text-severity-critical border-severity-critical/30",
  high: "bg-severity-high/20 text-severity-high border-severity-high/30",
  medium: "bg-severity-medium/20 text-severity-medium border-severity-medium/30",
  low: "bg-severity-low/20 text-severity-low border-severity-low/30",
  info: "bg-severity-info/20 text-severity-info border-severity-info/30",
};

const SeverityBadge = ({ severity }: SeverityBadgeProps) => {
  return (
    <Badge variant="outline" className={severityClasses[severity]}>
      {severity.toUpperCase()}
    </Badge>
  );
};

export default SeverityBadge;
