import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

// ─── ICON REGISTRY ─────────────────────────────────────────
interface IconEntry { id: string; name: string; path: string; aliases: string[]; }
let ICON_REGISTRY: IconEntry[] = [];

async function loadRegistry() {
  if (ICON_REGISTRY.length > 0) return;
  try {
    const res = await fetch("/icons/registry.json");
    const data = await res.json();
    ICON_REGISTRY = data.icons || [];
  } catch { /* ignore */ }
}

function findIconPath(name: string, iconHint?: string): string | null {
  if (!ICON_REGISTRY.length) return null;
  const lower = (iconHint || name).toLowerCase().trim();
  let m = ICON_REGISTRY.find(i => i.id === lower);
  if (m) return `/icons/gcp/${m.id}.svg`;
  m = ICON_REGISTRY.find(i => i.name.toLowerCase() === lower);
  if (m) return `/icons/gcp/${m.id}.svg`;
  m = ICON_REGISTRY.find(i => i.aliases.some(a => a === lower || lower.includes(a) || a.includes(lower)));
  if (m) return `/icons/gcp/${m.id}.svg`;
  return null;
}

// ─── COLORS ────────────────────────────────────────────────
const PALETTE: Record<string, { bg: string; border: string; headerBg: string; header: string; accent: string }> = {
  actors:     { bg: "#f8f9fa", border: "#dee2e6", headerBg: "#e9ecef", header: "#212529", accent: "#495057" },
  channels:   { bg: "#e8f5e9", border: "#a5d6a7", headerBg: "#c8e6c9", header: "#1b5e20", accent: "#43a047" },
  ingestion:  { bg: "#fff3e0", border: "#ffcc80", headerBg: "#ffe0b2", header: "#e65100", accent: "#fb8c00" },
  processing: { bg: "#ede7f6", border: "#b39ddb", headerBg: "#d1c4e9", header: "#4527a0", accent: "#7e57c2" },
  ai:         { bg: "#e3f2fd", border: "#90caf9", headerBg: "#bbdefb", header: "#0d47a1", accent: "#1e88e5" },
  storage:    { bg: "#fce4ec", border: "#f48fb1", headerBg: "#f8bbd0", header: "#880e4f", accent: "#e91e63" },
  serving:    { bg: "#e0f7fa", border: "#80deea", headerBg: "#b2ebf2", header: "#006064", accent: "#00acc1" },
  output:     { bg: "#fff8e1", border: "#ffe082", headerBg: "#ffecb3", header: "#f57f17", accent: "#ffb300" },
  security:   { bg: "#ffebee", border: "#ef9a9a", headerBg: "#ffcdd2", header: "#b71c1c", accent: "#e53935" },
  monitoring: { bg: "#e1f5fe", border: "#81d4fa", headerBg: "#b3e5fc", header: "#01579b", accent: "#039be5" },
};

const ARROW_COLOR = "#5c6bc0";
const ARROW_ACTIVE = "#303f9f";

const SAMPLES = [
  { label: "Healthcare AI Pipeline", prompt: "Healthcare AI system: Patient data from Epic EHR flows through FHIR API gateway to a data lake in BigQuery. Vertex AI trains clinical prediction models using feature store. Models are deployed via Cloud Run API serving predictions to a React clinician dashboard and a mobile app for nurses. Include monitoring and security layers." },
  { label: "E-commerce Platform", prompt: "E-commerce recommendation system: User clickstream from web and mobile apps flows through API Gateway to Pub/Sub streams. Cloud Functions processes events into Firestore user profiles. Vertex AI trains recommendation models nightly. Results cached in Memorystore Redis, served through Cloud Run GraphQL API to the React storefront. Include Identity Platform for auth." },
  { label: "RAG Chatbot Platform", prompt: "RAG chatbot: Internal documents from SharePoint, Confluence, and Google Drive are chunked and embedded via Vertex AI embedding API, stored in Cloud SQL with pgvector. User queries come through a React chat UI, hit a Cloud Run orchestrator that does retrieval, augments the prompt, calls Vertex AI for generation, and returns responses. Include Memorystore Redis for conversation cache." },
];

// ─── TYPES ─────────────────────────────────────────────────
interface Component { id: string; name: string; icon?: string; subtitle?: string; }
interface Group { id: string; name: string; category: string; components: Component[]; }
interface Flow { from: string; to: string; label?: string; step?: number; }
interface DiagramData { title: string; groups: Group[]; flows: Flow[]; }

// Layout positions (mutable for drag)
interface GroupPos { x: number; y: number; w: number; h: number; }

// Aggregated group-to-group arrow
interface GroupArrow {
  fromGroupId: string;
  toGroupId: string;
  steps: number[];
  labels: string[];
  details: string[]; // "CompA → CompB: label"
}

// ─── TOPOLOGICAL SORT ──────────────────────────────────────
function topoSortGroups(groups: Group[], flows: Flow[]): string[][] {
  // Map comp → group
  const comp2group: Record<string, string> = {};
  groups.forEach(g => g.components.forEach(c => { comp2group[c.id] = g.id; }));

  // Build group-level adjacency
  const adj: Record<string, Set<string>> = {};
  const inDeg: Record<string, number> = {};
  groups.forEach(g => { adj[g.id] = new Set(); inDeg[g.id] = 0; });

  flows.forEach(f => {
    const fg = comp2group[f.from];
    const tg = comp2group[f.to];
    if (fg && tg && fg !== tg && !adj[fg].has(tg)) {
      adj[fg].add(tg);
      inDeg[tg]++;
    }
  });

  // BFS - Kahn's algorithm
  const columns: string[][] = [];
  const visited = new Set<string>();
  let queue = groups.map(g => g.id).filter(id => inDeg[id] === 0);

  while (queue.length > 0) {
    columns.push([...queue]);
    queue.forEach(id => visited.add(id));
    const next: string[] = [];
    queue.forEach(id => {
      adj[id].forEach(tgt => {
        inDeg[tgt]--;
        if (inDeg[tgt] === 0 && !visited.has(tgt)) next.push(tgt);
      });
    });
    queue = next;
  }

  // Add any remaining (cycles or disconnected)
  const remaining = groups.map(g => g.id).filter(id => !visited.has(id));
  if (remaining.length) columns.push(remaining);

  return columns;
}

// ─── BUILD GROUP ARROWS ────────────────────────────────────
function buildGroupArrows(groups: Group[], flows: Flow[]): GroupArrow[] {
  const comp2group: Record<string, string> = {};
  const comp2name: Record<string, string> = {};
  groups.forEach(g => g.components.forEach(c => { comp2group[c.id] = g.id; comp2name[c.id] = c.name; }));

  const arrowMap: Record<string, GroupArrow> = {};
  flows.forEach(f => {
    const fg = comp2group[f.from];
    const tg = comp2group[f.to];
    if (!fg || !tg || fg === tg) return;
    const key = `${fg}→${tg}`;
    if (!arrowMap[key]) {
      arrowMap[key] = { fromGroupId: fg, toGroupId: tg, steps: [], labels: [], details: [] };
    }
    if (f.step != null) arrowMap[key].steps.push(f.step);
    if (f.label) arrowMap[key].labels.push(f.label);
    arrowMap[key].details.push(`${comp2name[f.from]} → ${comp2name[f.to]}${f.label ? ': ' + f.label : ''}`);
  });

  // Sort by minimum step number
  return Object.values(arrowMap).sort((a, b) => {
    const aMin = a.steps.length ? Math.min(...a.steps) : 999;
    const bMin = b.steps.length ? Math.min(...b.steps) : 999;
    return aMin - bMin;
  });
}

// ─── LAYOUT CONSTANTS ──────────────────────────────────────
const ISIZ = 44;
const COMP_CELL_W = 100;
const COMP_CELL_H = 80;
const COMP_GAP = 8;
const GROUP_PAD_X = 20;
const GROUP_PAD_TOP = 40;
const GROUP_PAD_BOT = 16;
const COL_GAP = 80;
const ROW_GAP = 40;
const MARGIN = 50;
const TITLE_H = 46;

function computeGroupSize(g: Group): { w: number; h: number } {
  const n = g.components.length || 1;
  const cols = Math.min(n, 2);
  const rows = Math.ceil(n / cols);
  const w = cols * COMP_CELL_W + (cols - 1) * COMP_GAP + 2 * GROUP_PAD_X;
  const h = GROUP_PAD_TOP + rows * COMP_CELL_H + GROUP_PAD_BOT;
  return { w: Math.max(w, 180), h };
}

function computeInitialPositions(groups: Group[], flows: Flow[]): Record<string, GroupPos> {
  const columns = topoSortGroups(groups, flows);
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));
  const positions: Record<string, GroupPos> = {};

  // Compute sizes
  const sizes: Record<string, { w: number; h: number }> = {};
  groups.forEach(g => { sizes[g.id] = computeGroupSize(g); });

  // Column widths
  const colWidths = columns.map(col => Math.max(...col.map(id => sizes[id].w)));

  // Column X positions
  const colX: number[] = [MARGIN];
  for (let c = 1; c < columns.length; c++) {
    colX.push(colX[c - 1] + colWidths[c - 1] + COL_GAP);
  }

  // Place groups
  columns.forEach((col, ci) => {
    // Vertical stack
    let curY = MARGIN + TITLE_H;
    col.forEach(gid => {
      const sz = sizes[gid];
      const x = colX[ci] + (colWidths[ci] - sz.w) / 2;
      positions[gid] = { x, y: curY, w: sz.w, h: sz.h };
      curY += sz.h + ROW_GAP;
    });
  });

  return positions;
}

// ─── BEZIER ARROW PATH ─────────────────────────────────────
function arrowPath(
  fromPos: GroupPos, toPos: GroupPos,
  index: number, total: number
): { path: string; labelX: number; labelY: number; sx: number; sy: number; ex: number; ey: number } {
  // Exit from right edge of source, enter left edge of target
  // If multiple arrows between different groups in same columns, offset vertically
  const vertOffset = total > 1 ? (index - (total - 1) / 2) * 16 : 0;

  const sx = fromPos.x + fromPos.w;
  const sy = fromPos.y + fromPos.h / 2 + vertOffset;
  const ex = toPos.x;
  const ey = toPos.y + toPos.h / 2 + vertOffset;

  // Handle case where target is to the left (backward reference)
  const isForward = ex > sx;

  if (isForward) {
    const gap = ex - sx;
    const cpx = gap * 0.45;
    const path = `M${sx},${sy} C${sx + cpx},${sy} ${ex - cpx},${ey} ${ex},${ey}`;
    return { path, labelX: (sx + ex) / 2, labelY: (sy + ey) / 2, sx, sy, ex, ey };
  } else {
    // Backward: route around (go up/down then back)
    const lift = 50;
    const goUp = sy < ey;
    const topY = goUp ? Math.min(fromPos.y, toPos.y) - lift : Math.max(fromPos.y + fromPos.h, toPos.y + toPos.h) + lift;
    const path = `M${sx},${sy} C${sx + 40},${sy} ${sx + 40},${topY} ${(sx + ex) / 2},${topY} C${ex - 40},${topY} ${ex - 40},${ey} ${ex},${ey}`;
    return { path, labelX: (sx + ex) / 2, labelY: topY, sx, sy, ex, ey };
  }
}

// ─── EXPORT .drawio ────────────────────────────────────────
function exportDrawio(
  diag: DiagramData,
  positions: Record<string, GroupPos>,
) {
  let cid = 10;
  const cs: string[] = [];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const gCellMap: Record<string, string> = {};

  diag.groups.forEach(g => {
    const col = PALETTE[g.category] || PALETTE.processing;
    const pos = positions[g.id];
    if (!pos) return;
    const id = `c${++cid}`;
    gCellMap[g.id] = id;
    cs.push(`<mxCell id="${id}" value="${esc(g.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${col.bg};strokeColor=${col.border};verticalAlign=top;fontStyle=1;fontSize=12;fontColor=${col.header};arcSize=4;spacingTop=6;" vertex="1" parent="1"><mxGeometry x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" as="geometry"/></mxCell>`);
  });

  const arrows = buildGroupArrows(diag.groups, diag.flows);
  arrows.forEach(a => {
    const src = gCellMap[a.fromGroupId], tgt = gCellMap[a.toGroupId];
    if (!src || !tgt) return;
    const id = `c${++cid}`;
    const label = a.steps.length ? a.steps.sort((x, y) => x - y).join(",") : "";
    cs.push(`<mxCell id="${id}" value="${label}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=${ARROW_COLOR};strokeWidth=2;endArrow=blockThin;endFill=1;fontSize=11;fontStyle=1;fontColor=${ARROW_COLOR};" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile><diagram name="Architecture"><mxGraphModel><root>\n<mxCell id="0"/><mxCell id="1" parent="0"/>\n${cs.join("\n")}\n</root></mxGraphModel></diagram></mxfile>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  a.download = `${diag.title?.replace(/\s+/g, "_") || "architecture"}.drawio`;
  a.click();
}

// ─── DIAGRAM CANVAS (SVG + DRAG) ───────────────────────────
function DiagramCanvas({
  diag, positions, setPositions,
}: {
  diag: DiagramData;
  positions: Record<string, GroupPos>;
  setPositions: (p: Record<string, GroupPos>) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ gid: string; offX: number; offY: number } | null>(null);
  const [hArrow, setHArrow] = useState<number | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingComp, setEditingComp] = useState<string | null>(null);

  const arrows = buildGroupArrows(diag.groups, diag.flows);

  // Canvas bounds
  let maxX = 0, maxY = 0;
  Object.values(positions).forEach(p => {
    maxX = Math.max(maxX, p.x + p.w);
    maxY = Math.max(maxY, p.y + p.h);
  });
  const canvasW = maxX + MARGIN;
  const canvasH = maxY + MARGIN;

  // Mouse handlers for drag
  const handleMouseDown = (gid: string, e: React.MouseEvent) => {
    if (editingGroup || editingComp) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
    const pos = positions[gid];
    setDrag({ gid, offX: svgPt.x - pos.x, offY: svgPt.y - pos.y });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
    setPositions({
      ...positions,
      [drag.gid]: {
        ...positions[drag.gid],
        x: Math.max(10, svgPt.x - drag.offX),
        y: Math.max(10, svgPt.y - drag.offY),
      },
    });
  }, [drag, positions, setPositions]);

  const handleMouseUp = useCallback(() => setDrag(null), []);

  // Compute component positions within group
  function compPos(g: Group, pos: GroupPos) {
    const n = g.components.length;
    const cols = Math.min(n, 2);
    const rows = Math.ceil(n / cols);
    const totalW = cols * COMP_CELL_W + (cols - 1) * COMP_GAP;
    const totalH = rows * COMP_CELL_H;
    const startX = pos.x + (pos.w - totalW) / 2;
    const startY = pos.y + GROUP_PAD_TOP + (pos.h - GROUP_PAD_TOP - GROUP_PAD_BOT - totalH) / 2;

    return g.components.map((c, ci) => {
      const row = Math.floor(ci / cols);
      const col = ci % cols;
      return {
        cx: startX + col * (COMP_CELL_W + COMP_GAP) + COMP_CELL_W / 2,
        cy: startY + row * COMP_CELL_H + COMP_CELL_H / 2 - 6,
        comp: c,
      };
    });
  }

  return (
    <svg ref={svgRef} width={canvasW} height={canvasH}
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      style={{
        display: "block", fontFamily: "'DM Sans', system-ui, sans-serif",
        cursor: drag ? "grabbing" : "default",
      }}>
      <defs>
        <marker id="arw" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0.5,9 3.5,0 6.5" fill={ARROW_COLOR} />
        </marker>
        <marker id="arw-h" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0.5,9 3.5,0 6.5" fill={ARROW_ACTIVE} />
        </marker>
        <filter id="grp-sh"><feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.06" /></filter>
        <filter id="grp-sh-d"><feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.1" /></filter>
        <filter id="ico-sh"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.06" /></filter>
      </defs>

      <rect width={canvasW} height={canvasH} fill="#fff" />

      {/* Title */}
      <text x={canvasW / 2} y={36} textAnchor="middle"
        style={{ fontSize: 18, fontWeight: 700, fill: "#111" }}>
        {diag.title}
      </text>

      {/* Arrows between groups */}
      {arrows.map((a, ai) => {
        const fpos = positions[a.fromGroupId];
        const tpos = positions[a.toGroupId];
        if (!fpos || !tpos) return null;

        // Count arrows leaving same source to space them
        const sameSource = arrows.filter(x => x.fromGroupId === a.fromGroupId);
        const idx = sameSource.indexOf(a);
        const ap = arrowPath(fpos, tpos, idx, sameSource.length);
        const active = hArrow === ai;
        const stepLabel = a.steps.length ? a.steps.sort((x, y) => x - y).join("·") : "";

        return (
          <g key={`a${ai}`} onMouseEnter={() => setHArrow(ai)} onMouseLeave={() => setHArrow(null)}
            style={{ cursor: "pointer" }}>
            {/* Hit area */}
            <path d={ap.path} fill="none" stroke="transparent" strokeWidth={20} />
            {/* Line */}
            <path d={ap.path} fill="none"
              stroke={active ? ARROW_ACTIVE : "#c5cae9"}
              strokeWidth={active ? 2.5 : 2}
              markerEnd={active ? "url(#arw-h)" : "url(#arw)"}
              style={{ transition: "all 0.15s" }}
            />
            {/* Step badge */}
            {stepLabel && (
              <g>
                <circle cx={ap.labelX} cy={ap.labelY} r={14}
                  fill={active ? ARROW_ACTIVE : ARROW_COLOR}
                  style={{ transition: "fill 0.15s" }} />
                <text x={ap.labelX} y={ap.labelY + 4.5} textAnchor="middle"
                  style={{ fontSize: 10, fontWeight: 800, fill: "#fff" }}>
                  {stepLabel}
                </text>
              </g>
            )}
            {/* Hover tooltip */}
            {active && a.details.length > 0 && (
              <g>
                {a.details.map((d, di) => (
                  <g key={di}>
                    <rect x={ap.labelX + 22} y={ap.labelY - 10 + di * 18} width={Math.min(d.length * 6 + 16, 220)} height={16} rx={3}
                      fill="#1a237e" opacity={0.92} />
                    <text x={ap.labelX + 30} y={ap.labelY + 1 + di * 18}
                      style={{ fontSize: 9, fill: "#fff" }}>
                      {d.length > 36 ? d.slice(0, 35) + "…" : d}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </g>
        );
      })}

      {/* Groups */}
      {diag.groups.map((g, gi) => {
        const pos = positions[g.id];
        if (!pos) return null;
        const c = PALETTE[g.category] || PALETTE.processing;
        const isDragging = drag?.gid === g.id;
        const cps = compPos(g, pos);

        return (
          <g key={g.id}>
            {/* Group box */}
            <g onMouseDown={e => handleMouseDown(g.id, e)}
              style={{ cursor: isDragging ? "grabbing" : "grab" }}>
              <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h}
                rx={10} fill={c.bg} stroke={c.border} strokeWidth={1.2}
                filter={isDragging ? "url(#grp-sh-d)" : "url(#grp-sh)"}
                style={{ transition: isDragging ? "none" : "filter 0.2s" }}
              />
              {/* Header bar */}
              <rect x={pos.x} y={pos.y} width={pos.w} height={32}
                rx={10} fill={c.headerBg} />
              <rect x={pos.x} y={pos.y + 22} width={pos.w} height={10} fill={c.headerBg} />
              {/* Top accent line */}
              <rect x={pos.x + 10} y={pos.y} width={pos.w - 20} height={3} rx={1.5} fill={c.accent} />
              {/* Group name */}
              <text x={pos.x + pos.w / 2} y={pos.y + 22} textAnchor="middle"
                style={{ fontSize: 12, fontWeight: 700, fill: c.header, pointerEvents: "none" }}>
                {g.name}
              </text>
            </g>

            {/* Components */}
            {cps.map(({ cx, cy, comp }) => {
              const iconPath = findIconPath(comp.name, comp.icon);
              return (
                <g key={comp.id}>
                  {iconPath ? (
                    <image href={iconPath}
                      x={cx - ISIZ / 2} y={cy - ISIZ / 2}
                      width={ISIZ} height={ISIZ}
                      filter="url(#ico-sh)"
                    />
                  ) : (
                    <g>
                      <rect x={cx - 20} y={cy - 20} width={40} height={40} rx={8}
                        fill="#f0f0f0" stroke="#ddd" strokeWidth={1}
                        filter="url(#ico-sh)" />
                      <text x={cx} y={cy + 5} textAnchor="middle"
                        style={{ fontSize: 14, fill: "#aaa" }}>?</text>
                    </g>
                  )}
                  <text x={cx} y={cy + ISIZ / 2 + 12} textAnchor="middle"
                    style={{ fontSize: 10, fontWeight: 500, fill: "#444" }}>
                    {comp.name.length > 14 ? comp.name.slice(0, 13) + "…" : comp.name}
                  </text>
                  {comp.subtitle && (
                    <text x={cx} y={cy + ISIZ / 2 + 23} textAnchor="middle"
                      style={{ fontSize: 8, fill: "#999" }}>
                      {comp.subtitle}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Drag hint */}
      {!drag && (
        <text x={canvasW - 10} y={canvasH - 10} textAnchor="end"
          style={{ fontSize: 9, fill: "#ccc" }}>
          Drag groups to reposition
        </text>
      )}
    </svg>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────
export default function Dashboard({ user }: { user: User }) {
  const { logout, isLoggingOut } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diag, setDiag] = useState<DiagramData | null>(null);
  const [positions, setPositions] = useState<Record<string, GroupPos>>({});

  useEffect(() => { loadRegistry(); }, []);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(""); setDiag(null);
    try {
      const res = await fetch("/api/diagrams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Generation failed"); }
      const data = await res.json();
      const diagram = data.diagram as DiagramData;
      setDiag(diagram);
      setPositions(computeInitialPositions(diagram.groups, diagram.flows));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [prompt]);

  const resetLayout = () => {
    if (diag) setPositions(computeInitialPositions(diag.groups, diag.flows));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.3s ease-out; }
        textarea:focus { border-color: #333 !important; background: #fff !important; }
      `}</style>

      {/* Top bar */}
      <div style={{
        height: 52, padding: "0 20px", borderBottom: "1px solid #f0f0f0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#212529",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12 }}>◇</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#212529" }}>ArchGen</span>
          <span style={{ fontSize: 9, background: "#f5f5f5", color: "#999",
            padding: "2px 6px", borderRadius: 3, fontWeight: 600 }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {diag && (
            <>
              <button onClick={resetLayout} style={{
                background: "none", border: "1px solid #eee",
                padding: "5px 12px", borderRadius: 6, fontSize: 11,
                color: "#999", cursor: "pointer",
              }}>⟲ Reset Layout</button>
              <button onClick={() => exportDrawio(diag, positions)} style={{
                background: "#212529", color: "#fff", border: "none",
                padding: "6px 14px", borderRadius: 6, fontSize: 12,
                fontWeight: 600, cursor: "pointer",
              }}>↓ Export .drawio</button>
            </>
          )}
          <span style={{ fontSize: 12, color: "#aaa" }}>{user.firstName || user.email}</span>
          <button onClick={() => logout()} disabled={isLoggingOut} style={{
            background: "none", border: "1px solid #eee",
            padding: "5px 12px", borderRadius: 6, fontSize: 12,
            color: "#999", cursor: "pointer",
          }}>Logout</button>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* Left panel */}
        <div style={{
          width: 340, borderRight: "1px solid #f0f0f0",
          padding: 20, display: "flex", flexDirection: "column", gap: 14,
          overflowY: "auto", flexShrink: 0,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1 }}>DESCRIBE YOUR SYSTEM</div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
            placeholder="Describe your architecture in plain English..."
            style={{
              width: "100%", minHeight: 140, padding: 12,
              border: "1px solid #eee", borderRadius: 8,
              fontSize: 13, color: "#333", outline: "none",
              resize: "vertical", lineHeight: 1.6, background: "#fafafa",
              boxSizing: "border-box",
            }}
          />
          <button onClick={generate} disabled={loading || !prompt.trim()}
            style={{
              width: "100%", padding: "11px 0",
              background: loading ? "#666" : "#212529",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: !prompt.trim() ? 0.3 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {loading && <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {loading ? "Generating..." : "Generate Diagram"}
          </button>

          {error && (
            <div style={{ padding: 10, borderRadius: 6, background: "#fff5f5",
              border: "1px solid #fecaca", color: "#dc2626", fontSize: 12 }}>{error}</div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 6 }}>TEMPLATES</div>
          {SAMPLES.map((s, i) => (
            <button key={i} onClick={() => setPrompt(s.prompt)} style={{
              width: "100%", textAlign: "left", padding: "10px 12px",
              background: "#fafafa", border: "1px solid #f0f0f0",
              borderRadius: 6, cursor: "pointer",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{s.label}</div>
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 3, lineHeight: 1.4 }}>{s.prompt.slice(0, 80)}...</div>
            </button>
          ))}

          {diag && (
            <div style={{ padding: 12, background: "#f8f9fa", borderRadius: 6, border: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", gap: 24 }}>
                {[
                  { n: diag.groups.length, l: "Groups" },
                  { n: diag.groups.reduce((s, g) => s + g.components.length, 0), l: "Services" },
                  { n: buildGroupArrows(diag.groups, diag.flows).length, l: "Connections" },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#212529" }}>{s.n}</div>
                    <div style={{ fontSize: 10, color: "#aaa" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: "auto", padding: 24, background: "#f5f5f5" }}>
          {!diag && !loading && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 40, color: "#ddd" }}>◇</div>
              <div style={{ color: "#bbb", fontSize: 13 }}>Describe a system to generate its architecture diagram</div>
            </div>
          )}
          {loading && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
              <div style={{ width: 28, height: 28, border: "3px solid #e5e5e5",
                borderTopColor: "#212529", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <div style={{ color: "#999", fontSize: 13 }}>Generating architecture diagram...</div>
            </div>
          )}
          {diag && Object.keys(positions).length > 0 && (
            <div className="fade-up" style={{
              background: "#fff", borderRadius: 10, border: "1px solid #e5e5e5",
              display: "inline-block",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <DiagramCanvas diag={diag} positions={positions} setPositions={setPositions} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
