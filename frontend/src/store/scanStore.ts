import { create } from "zustand";
import type { Scan, Finding, SitemapNode } from "@/types";

interface ScanState {
  activeScan: Scan | null;
  findings: Finding[];
  sitemapNodes: SitemapNode[];
  startScan: (scan: Scan) => void;
  updateProgress: (progress: number, currentModule: string) => void;
  addFinding: (finding: Finding) => void;
  setSitemapNodes: (nodes: SitemapNode[]) => void;
  reset: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  activeScan: null,
  findings: [],
  sitemapNodes: [],

  startScan: (scan) => set({ activeScan: scan, findings: [], sitemapNodes: [] }),

  updateProgress: (progress, currentModule) =>
    set((state) => ({
      activeScan: state.activeScan
        ? { ...state.activeScan, progress, currentModule }
        : null,
    })),

  addFinding: (finding) =>
    set((state) => ({ findings: [...state.findings, finding] })),

  setSitemapNodes: (nodes) => set({ sitemapNodes: nodes }),

  reset: () => set({ activeScan: null, findings: [], sitemapNodes: [] }),
}));
