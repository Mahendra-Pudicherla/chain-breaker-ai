import React from "react";
import type { ScanStats } from "@/types";

interface SeverityDonutProps {
  stats: ScanStats;
  size?: number;
}

const segments = [
  { key: "critical" as const, color: "hsl(0, 84%, 60%)", label: "Critical" },
  { key: "high" as const, color: "hsl(25, 95%, 53%)", label: "High" },
  { key: "medium" as const, color: "hsl(48, 96%, 53%)", label: "Medium" },
  { key: "low" as const, color: "hsl(142, 71%, 45%)", label: "Low" },
  { key: "info" as const, color: "hsl(217, 91%, 60%)", label: "Info" },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const SeverityDonut = React.memo(({ stats, size = 160 }: SeverityDonutProps) => {
  const total = stats.total || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;
  const strokeWidth = 20;

  let currentAngle = 0;
  const arcs = segments
    .map((seg) => {
      const value = stats[seg.key];
      if (value <= 0) return null;
      const angle = (value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle - 0.5;
      currentAngle += angle;
      return { ...seg, startAngle, endAngle, value };
    })
    .filter(Boolean);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width={size} height={size} className="shrink-0">
        {stats.total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(240,14%,19%)" strokeWidth={strokeWidth} />
        ) : (
          arcs.map((arc, i) =>
            arc ? (
              <path
                key={i}
                d={describeArc(cx, cy, r, arc.startAngle, arc.endAngle)}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            ) : null
          )
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-2xl font-bold" fontSize="28">
          {stats.total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted-foreground text-xs" fontSize="11">
          Total
        </text>
      </svg>

      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-medium text-foreground ml-auto">{stats[seg.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

SeverityDonut.displayName = "SeverityDonut";

export default SeverityDonut;
