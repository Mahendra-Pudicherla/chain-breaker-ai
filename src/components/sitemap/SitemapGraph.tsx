import React, { useState, useEffect, useRef } from "react";
import type { SitemapNode } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface SitemapGraphProps {
  nodes: SitemapNode[];
  interactive?: boolean;
}

interface GraphNode {
  id: string;
  node: SitemapNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const typeColors: Record<string, string> = {
  page: "#6366f1",
  api: "#14b8a6",
  form: "#f59e0b",
  asset: "#6b7280",
};

const SitemapGraph = React.memo(({ nodes, interactive = true }: SitemapGraphProps) => {
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [selected, setSelected] = useState<SitemapNode | null>(null);
  const frameRef = useRef<number>(0);
  const iterRef = useRef(0);

  useEffect(() => {
    if (nodes.length === 0) return;
    const gn: GraphNode[] = nodes.map((n, i) => ({
      id: n.url,
      node: n,
      x: 300 + Math.cos((i / nodes.length) * Math.PI * 2) * 150 + Math.random() * 40,
      y: 200 + Math.sin((i / nodes.length) * Math.PI * 2) * 120 + Math.random() * 40,
      vx: 0,
      vy: 0,
    }));

    iterRef.current = 0;
    const idxMap = new Map(gn.map((n, i) => [n.id, i]));

    const simulate = () => {
      if (iterRef.current > 200) {
        setGraphNodes([...gn]);
        return;
      }
      iterRef.current++;

      for (let i = 0; i < gn.length; i++) {
        for (let j = i + 1; j < gn.length; j++) {
          const dx = gn[j].x - gn[i].x;
          const dy = gn[j].y - gn[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 800 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          gn[i].vx -= fx; gn[i].vy -= fy;
          gn[j].vx += fx; gn[j].vy += fy;
        }
      }

      for (const n of gn) {
        if (n.node.parentUrl) {
          const pi = idxMap.get(n.node.parentUrl);
          if (pi !== undefined) {
            const parent = gn[pi];
            const dx = parent.x - n.x;
            const dy = parent.y - n.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist - 80) * 0.02;
            n.vx += (dx / dist) * force;
            n.vy += (dy / dist) * force;
            parent.vx -= (dx / dist) * force * 0.5;
            parent.vy -= (dy / dist) * force * 0.5;
          }
        }
      }

      for (const n of gn) {
        n.vx += (300 - n.x) * 0.001;
        n.vy += (200 - n.y) * 0.001;
        n.vx *= 0.9; n.vy *= 0.9;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(20, Math.min(580, n.x));
        n.y = Math.max(20, Math.min(380, n.y));
      }

      setGraphNodes([...gn]);
      frameRef.current = requestAnimationFrame(simulate);
    };

    frameRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [nodes]);

  const idxMap = new Map(graphNodes.map((n, i) => [n.id, i]));

  return (
    <div className="relative">
      <svg viewBox="0 0 600 400" className="w-full min-h-[300px] border border-border rounded-xl bg-[#0d0d14]">
        {graphNodes.map((gn) => {
          if (!gn.node.parentUrl) return null;
          const pi = idxMap.get(gn.node.parentUrl);
          if (pi === undefined) return null;
          const parent = graphNodes[pi];
          return (
            <line key={`edge-${gn.id}`} x1={parent.x} y1={parent.y} x2={gn.x} y2={gn.y} stroke="hsl(240,14%,24%)" strokeWidth="1" />
          );
        })}

        {graphNodes.map((gn) => (
          <g key={gn.id} onClick={() => interactive && setSelected(gn.node)} className={interactive ? "cursor-pointer" : ""}>
            {gn.node.vulnerable && (
              <circle cx={gn.x} cy={gn.y} r="14" fill="none" stroke="hsl(0,84%,60%)" strokeWidth="2" opacity="0.4">
                <animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={gn.x} cy={gn.y} r="8"
              fill={typeColors[gn.node.type] ?? typeColors.asset}
              opacity={gn.node.scanned ? 1 : 0.4}
              className="animate-scale-in"
            />
          </g>
        ))}
      </svg>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
        {Object.entries(typeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>

      {selected && interactive && (
        <Card className="absolute top-2 right-2 w-64 p-4 bg-surface-elevated border-border space-y-2 animate-fade-in z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Node Details</span>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close details">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground break-all">{selected.url}</p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] capitalize">{selected.type}</Badge>
            <Badge variant="outline" className="text-[10px]">{selected.method}</Badge>
            <Badge variant="outline" className="text-[10px]">{selected.statusCode}</Badge>
          </div>
          {selected.vulnerable && (
            <Badge className="bg-severity-critical/15 text-severity-critical border-severity-critical/30 text-[10px]">
              Vulnerable
            </Badge>
          )}
        </Card>
      )}
    </div>
  );
});

SitemapGraph.displayName = "SitemapGraph";

export default SitemapGraph;
