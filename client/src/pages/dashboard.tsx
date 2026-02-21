import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

// ─── ICON REGISTRY ─────────────────────────────────────────
interface IconEntry { id: string; name: string; path: string; aliases: string[]; }
let ICON_REGISTRY: IconEntry[] = [];
async function loadRegistry() {
  if (ICON_REGISTRY.length > 0) return;
  try { const r = await fetch("/icons/registry.json"); const d = await r.json(); ICON_REGISTRY = d.icons || []; } catch {}
}
function findIconPath(name: string, hint?: string): string | null {
  if (!ICON_REGISTRY.length) return null;
  const l = (hint || name).toLowerCase().trim();
  let m = ICON_REGISTRY.find(i => i.id === l);
  if (m) return `/icons/gcp/${m.id}.svg`;
  m = ICON_REGISTRY.find(i => i.name.toLowerCase() === l);
  if (m) return `/icons/gcp/${m.id}.svg`;
  m = ICON_REGISTRY.find(i => i.aliases.some(a => a === l || l.includes(a) || a.includes(l)));
  if (m) return `/icons/gcp/${m.id}.svg`;
  return null;
}

// ─── COLORS ────────────────────────────────────────────────
const CATEGORIES = ["actors","channels","ingestion","processing","ai","storage","serving","output","security","monitoring"] as const;
type Category = typeof CATEGORIES[number];

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
interface GroupPos { x: number; y: number; w: number; h: number; }
interface GroupArrow {
  id: string; fromGroupId: string; toGroupId: string;
  steps: number[]; labels: string[]; details: string[];
}

type Selection = { type: "group"; id: string } | { type: "arrow"; id: string } | null;

// ─── TOPOLOGICAL SORT ──────────────────────────────────────
function topoSortGroups(groups: Group[], flows: Flow[]): string[][] {
  const c2g: Record<string, string> = {};
  groups.forEach(g => g.components.forEach(c => { c2g[c.id] = g.id; }));
  const adj: Record<string, Set<string>> = {};
  const inD: Record<string, number> = {};
  groups.forEach(g => { adj[g.id] = new Set(); inD[g.id] = 0; });
  flows.forEach(f => {
    const fg = c2g[f.from], tg = c2g[f.to];
    if (fg && tg && fg !== tg && !adj[fg].has(tg)) { adj[fg].add(tg); inD[tg]++; }
  });
  const cols: string[][] = [];
  const vis = new Set<string>();
  let q = groups.map(g => g.id).filter(id => inD[id] === 0);
  while (q.length > 0) {
    cols.push([...q]);
    q.forEach(id => vis.add(id));
    const nx: string[] = [];
    q.forEach(id => { adj[id].forEach(t => { inD[t]--; if (inD[t] === 0 && !vis.has(t)) nx.push(t); }); });
    q = nx;
  }
  const rem = groups.map(g => g.id).filter(id => !vis.has(id));
  if (rem.length) cols.push(rem);
  return cols;
}

function buildGroupArrows(groups: Group[], flows: Flow[]): GroupArrow[] {
  const c2g: Record<string, string> = {};
  const c2n: Record<string, string> = {};
  groups.forEach(g => g.components.forEach(c => { c2g[c.id] = g.id; c2n[c.id] = c.name; }));
  const m: Record<string, GroupArrow> = {};
  flows.forEach(f => {
    const fg = c2g[f.from], tg = c2g[f.to];
    if (!fg || !tg || fg === tg) return;
    const key = `${fg}→${tg}`;
    if (!m[key]) m[key] = { id: key, fromGroupId: fg, toGroupId: tg, steps: [], labels: [], details: [] };
    if (f.step != null) m[key].steps.push(f.step);
    if (f.label) m[key].labels.push(f.label);
    m[key].details.push(`${c2n[f.from]} → ${c2n[f.to]}${f.label ? ': ' + f.label : ''}`);
  });
  return Object.values(m).sort((a, b) => {
    const am = a.steps.length ? Math.min(...a.steps) : 999;
    const bm = b.steps.length ? Math.min(...b.steps) : 999;
    return am - bm;
  });
}

// ─── LAYOUT ────────────────────────────────────────────────
const ISIZ = 44;
const COMP_W = 100;
const COMP_H = 80;
const COMP_GAP = 8;
const G_PX = 20;
const G_PT = 42;
const G_PB = 16;
const COL_GAP = 90;
const ROW_GAP = 40;
const MARGIN = 50;
const TITLE_H = 50;

function groupSize(g: Group): { w: number; h: number } {
  const n = g.components.length || 1;
  const cols = Math.min(n, 2);
  const rows = Math.ceil(n / cols);
  return {
    w: Math.max(cols * COMP_W + (cols - 1) * COMP_GAP + 2 * G_PX, 180),
    h: G_PT + rows * COMP_H + G_PB,
  };
}

function computePositions(groups: Group[], flows: Flow[]): Record<string, GroupPos> {
  const columns = topoSortGroups(groups, flows);
  const sizes: Record<string, { w: number; h: number }> = {};
  groups.forEach(g => { sizes[g.id] = groupSize(g); });
  const colW = columns.map(col => Math.max(...col.map(id => sizes[id].w)));
  const colX: number[] = [MARGIN];
  for (let c = 1; c < columns.length; c++) colX.push(colX[c - 1] + colW[c - 1] + COL_GAP);
  const pos: Record<string, GroupPos> = {};
  columns.forEach((col, ci) => {
    let y = MARGIN + TITLE_H;
    col.forEach(gid => {
      const sz = sizes[gid];
      pos[gid] = { x: colX[ci] + (colW[ci] - sz.w) / 2, y, w: sz.w, h: sz.h };
      y += sz.h + ROW_GAP;
    });
  });
  return pos;
}

function compPositions(g: Group, pos: GroupPos) {
  const n = g.components.length;
  const cols = Math.min(n, 2);
  const rows = Math.ceil(n / cols);
  const tw = cols * COMP_W + (cols - 1) * COMP_GAP;
  const th = rows * COMP_H;
  const sx = pos.x + (pos.w - tw) / 2;
  const sy = pos.y + G_PT + (pos.h - G_PT - G_PB - th) / 2;
  return g.components.map((c, ci) => ({
    cx: sx + (ci % cols) * (COMP_W + COMP_GAP) + COMP_W / 2,
    cy: sy + Math.floor(ci / cols) * COMP_H + COMP_H / 2 - 6,
    comp: c,
  }));
}

// ─── ARROW BEZIER ──────────────────────────────────────────
function bezierPath(fp: GroupPos, tp: GroupPos, idx: number, total: number) {
  const vOff = total > 1 ? (idx - (total - 1) / 2) * 18 : 0;
  const sx = fp.x + fp.w;
  const sy = fp.y + fp.h / 2 + vOff;
  const ex = tp.x;
  const ey = tp.y + tp.h / 2 + vOff;
  const fwd = ex > sx + 10;
  let path: string;
  if (fwd) {
    const cp = (ex - sx) * 0.4;
    path = `M${sx},${sy} C${sx + cp},${sy} ${ex - cp},${ey} ${ex},${ey}`;
  } else {
    const lift = 60;
    const topY = Math.min(fp.y, tp.y) - lift;
    path = `M${sx},${sy} C${sx + 50},${sy} ${sx + 50},${topY} ${(sx + ex) / 2},${topY} S${ex - 50},${ey} ${ex},${ey}`;
  }
  return { path, lx: (sx + ex) / 2, ly: fwd ? (sy + ey) / 2 : Math.min(fp.y, tp.y) - 30 };
}

// ─── EXPORT .drawio ────────────────────────────────────────
function exportDrawio(diag: DiagramData, positions: Record<string, GroupPos>) {
  let cid = 10;
  const cs: string[] = [];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const gm: Record<string, string> = {};
  diag.groups.forEach(g => {
    const col = PALETTE[g.category] || PALETTE.processing;
    const pos = positions[g.id]; if (!pos) return;
    const id = `c${++cid}`; gm[g.id] = id;
    cs.push(`<mxCell id="${id}" value="${esc(g.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${col.bg};strokeColor=${col.border};verticalAlign=top;fontStyle=1;fontSize=12;fontColor=${col.header};" vertex="1" parent="1"><mxGeometry x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" as="geometry"/></mxCell>`);
  });
  buildGroupArrows(diag.groups, diag.flows).forEach(a => {
    const s = gm[a.fromGroupId], t = gm[a.toGroupId]; if (!s || !t) return;
    const id = `c${++cid}`;
    const lb = a.steps.length ? a.steps.sort((x, y) => x - y).join(",") : "";
    cs.push(`<mxCell id="${id}" value="${lb}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=${ARROW_COLOR};strokeWidth=2;endArrow=blockThin;endFill=1;fontSize=11;fontStyle=1;" edge="1" parent="1" source="${s}" target="${t}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile><diagram name="Arch"><mxGraphModel><root>\n<mxCell id="0"/><mxCell id="1" parent="0"/>\n${cs.join("\n")}\n</root></mxGraphModel></diagram></mxfile>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  a.download = `${diag.title?.replace(/\s+/g, "_") || "arch"}.drawio`;
  a.click();
}

// ─── EDIT PANEL ────────────────────────────────────────────
function EditPanel({
  diag, setDiag, selection, setSelection, positions, arrows,
}: {
  diag: DiagramData; setDiag: (d: DiagramData) => void;
  selection: Selection; setSelection: (s: Selection) => void;
  positions: Record<string, GroupPos>;
  arrows: GroupArrow[];
}) {
  if (!selection) return (
    <div style={{ padding: 16, color: "#bbb", fontSize: 12, textAlign: "center", marginTop: 20 }}>
      Click a group or arrow to edit
    </div>
  );

  if (selection.type === "group") {
    const g = diag.groups.find(x => x.id === selection.id);
    if (!g) return null;
    const c = PALETTE[g.category] || PALETTE.processing;

    const updateGroup = (updates: Partial<Group>) => {
      setDiag({
        ...diag,
        groups: diag.groups.map(x => x.id === g.id ? { ...x, ...updates } : x),
      });
    };

    const updateComp = (compId: string, updates: Partial<Component>) => {
      updateGroup({
        components: g.components.map(c => c.id === compId ? { ...c, ...updates } : c),
      });
    };

    const deleteComp = (compId: string) => {
      updateGroup({ components: g.components.filter(c => c.id !== compId) });
      // Also remove flows referencing this component
      setDiag({
        ...diag,
        groups: diag.groups.map(x => x.id === g.id ? { ...x, components: x.components.filter(c => c.id !== compId) } : x),
        flows: diag.flows.filter(f => f.from !== compId && f.to !== compId),
      });
    };

    const addComp = () => {
      const newId = `new_${Date.now()}`;
      updateGroup({
        components: [...g.components, { id: newId, name: "New Service", subtitle: "" }],
      });
    };

    const deleteGroup = () => {
      const compIds = new Set(g.components.map(c => c.id));
      setDiag({
        ...diag,
        groups: diag.groups.filter(x => x.id !== g.id),
        flows: diag.flows.filter(f => !compIds.has(f.from) && !compIds.has(f.to)),
      });
      setSelection(null);
    };

    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 0.5 }}>EDIT GROUP</div>
          <button onClick={() => setSelection(null)} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>

        {/* Name */}
        <div>
          <label style={{ fontSize: 10, color: "#999", display: "block", marginBottom: 3 }}>Name</label>
          <input value={g.name} onChange={e => updateGroup({ name: e.target.value })}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #eee", borderRadius: 5, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Category (color) */}
        <div>
          <label style={{ fontSize: 10, color: "#999", display: "block", marginBottom: 3 }}>Category / Color</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CATEGORIES.map(cat => {
              const pc = PALETTE[cat];
              const active = g.category === cat;
              return (
                <button key={cat} onClick={() => updateGroup({ category: cat })}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: pc.accent, border: active ? "2px solid #333" : "2px solid transparent",
                    cursor: "pointer", position: "relative",
                  }}
                  title={cat}>
                  {active && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Components */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 10, color: "#999" }}>Components</label>
            <button onClick={addComp}
              style={{ background: "#f0f0f0", border: "none", borderRadius: 4, padding: "2px 8px",
                fontSize: 10, cursor: "pointer", color: "#666" }}>+ Add</button>
          </div>
          {g.components.map(comp => (
            <div key={comp.id} style={{
              padding: 8, background: "#fafafa", borderRadius: 6, marginBottom: 4,
              border: "1px solid #f0f0f0",
            }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <input value={comp.name}
                  onChange={e => updateComp(comp.id, { name: e.target.value })}
                  style={{ flex: 1, padding: "4px 6px", border: "1px solid #eee", borderRadius: 4, fontSize: 11, outline: "none" }}
                  placeholder="Service name" />
                <button onClick={() => deleteComp(comp.id)}
                  style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 14 }}>×</button>
              </div>
              <input value={comp.subtitle || ""}
                onChange={e => updateComp(comp.id, { subtitle: e.target.value })}
                style={{ width: "100%", padding: "3px 6px", border: "1px solid #eee", borderRadius: 4, fontSize: 10, outline: "none", color: "#999", boxSizing: "border-box" }}
                placeholder="Subtitle (protocol, etc)" />
            </div>
          ))}
        </div>

        <button onClick={deleteGroup}
          style={{ marginTop: 4, padding: "6px 0", background: "#fff5f5", border: "1px solid #fecaca",
            borderRadius: 6, fontSize: 11, color: "#dc2626", cursor: "pointer" }}>
          Delete Group
        </button>
      </div>
    );
  }

  if (selection.type === "arrow") {
    const arrow = arrows.find(a => a.id === selection.id);
    if (!arrow) return null;
    const fromG = diag.groups.find(g => g.id === arrow.fromGroupId);
    const toG = diag.groups.find(g => g.id === arrow.toGroupId);

    const reverseArrow = () => {
      // Reverse all flows between these two groups
      const c2g: Record<string, string> = {};
      diag.groups.forEach(g => g.components.forEach(c => { c2g[c.id] = g.id; }));
      setDiag({
        ...diag,
        flows: diag.flows.map(f => {
          const fg = c2g[f.from], tg = c2g[f.to];
          if (fg === arrow.fromGroupId && tg === arrow.toGroupId) {
            return { ...f, from: f.to, to: f.from };
          }
          return f;
        }),
      });
    };

    const deleteArrow = () => {
      const c2g: Record<string, string> = {};
      diag.groups.forEach(g => g.components.forEach(c => { c2g[c.id] = g.id; }));
      setDiag({
        ...diag,
        flows: diag.flows.filter(f => {
          const fg = c2g[f.from], tg = c2g[f.to];
          return !(fg === arrow.fromGroupId && tg === arrow.toGroupId);
        }),
      });
      setSelection(null);
    };

    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 0.5 }}>EDIT CONNECTION</div>
          <button onClick={() => setSelection(null)} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>

        <div style={{ padding: 10, background: "#f8f9fa", borderRadius: 6, fontSize: 12 }}>
          <span style={{ fontWeight: 600 }}>{fromG?.name || "?"}</span>
          <span style={{ color: "#999", margin: "0 8px" }}>→</span>
          <span style={{ fontWeight: 600 }}>{toG?.name || "?"}</span>
        </div>

        {/* Steps */}
        {arrow.steps.length > 0 && (
          <div style={{ fontSize: 11, color: "#666" }}>
            Steps: {arrow.steps.sort((a, b) => a - b).join(", ")}
          </div>
        )}

        {/* Details */}
        <div>
          <label style={{ fontSize: 10, color: "#999", display: "block", marginBottom: 4 }}>Flows</label>
          {arrow.details.map((d, i) => (
            <div key={i} style={{ fontSize: 11, color: "#555", padding: "3px 0", borderBottom: "1px solid #f5f5f5" }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={reverseArrow}
            style={{ flex: 1, padding: "7px 0", background: "#f5f5f5", border: "1px solid #eee",
              borderRadius: 6, fontSize: 11, cursor: "pointer", color: "#555" }}>
            ⇄ Reverse Direction
          </button>
          <button onClick={deleteArrow}
            style={{ flex: 1, padding: "7px 0", background: "#fff5f5", border: "1px solid #fecaca",
              borderRadius: 6, fontSize: 11, color: "#dc2626", cursor: "pointer" }}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── DIAGRAM CANVAS ────────────────────────────────────────
function DiagramCanvas({
  diag, setDiag, positions, setPositions, selection, setSelection,
}: {
  diag: DiagramData; setDiag: (d: DiagramData) => void;
  positions: Record<string, GroupPos>; setPositions: (p: Record<string, GroupPos>) => void;
  selection: Selection; setSelection: (s: Selection) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ gid: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [hArrow, setHArrow] = useState<string | null>(null);

  const arrows = buildGroupArrows(diag.groups, diag.flows);

  // Canvas size
  let maxX = 0, maxY = 0;
  Object.values(positions).forEach(p => { maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h); });
  const cW = maxX + MARGIN;
  const cH = maxY + MARGIN;

  // Drag handlers using clientX/Y delta (reliable across transforms)
  const onMouseDown = (gid: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = positions[gid];
    setDrag({ gid, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      // Get SVG scale factor
      const svgEl = svgRef.current;
      let scale = 1;
      if (svgEl) {
        const rect = svgEl.getBoundingClientRect();
        scale = cW / rect.width;
      }
      setPositions({
        ...positions,
        [drag.gid]: {
          ...positions[drag.gid],
          x: Math.max(10, drag.origX + dx * scale),
          y: Math.max(10, drag.origY + dy * scale),
        },
      });
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drag, positions, setPositions, cW]);

  return (
    <svg ref={svgRef} width={cW} height={cH} viewBox={`0 0 ${cW} ${cH}`}
      style={{ display: "block", fontFamily: "'DM Sans', system-ui, sans-serif", cursor: drag ? "grabbing" : "default" }}
      onClick={() => setSelection(null)}>
      <defs>
        <marker id="arw" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0.5,9 3.5,0 6.5" fill={ARROW_COLOR} />
        </marker>
        <marker id="arw-a" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0.5,9 3.5,0 6.5" fill={ARROW_ACTIVE} />
        </marker>
        <filter id="gs"><feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.06" /></filter>
        <filter id="gsd"><feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.12" /></filter>
        <filter id="is"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.06" /></filter>
      </defs>

      {/* Flow animation CSS */}
      <style>{`
        @keyframes flowDash { to { stroke-dashoffset: -24; } }
        .flow-line { stroke-dasharray: 8, 4; animation: flowDash 0.8s linear infinite; }
        .flow-line-idle { stroke-dasharray: none; animation: none; }
      `}</style>

      <rect width={cW} height={cH} fill="#fff" />

      <text x={cW / 2} y={36} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: "#111" }}>
        {diag.title}
      </text>

      {/* Arrows */}
      {arrows.map((a) => {
        const fp = positions[a.fromGroupId], tp = positions[a.toGroupId];
        if (!fp || !tp) return null;
        const sameFrom = arrows.filter(x => x.fromGroupId === a.fromGroupId);
        const idx = sameFrom.indexOf(a);
        const bp = bezierPath(fp, tp, idx, sameFrom.length);
        const active = hArrow === a.id || (selection?.type === "arrow" && selection.id === a.id);
        const stepLabel = a.steps.length ? a.steps.sort((x, y) => x - y).join("·") : "";

        return (
          <g key={a.id}
            onMouseEnter={() => setHArrow(a.id)} onMouseLeave={() => setHArrow(null)}
            onClick={e => { e.stopPropagation(); setSelection({ type: "arrow", id: a.id }); }}
            style={{ cursor: "pointer" }}>
            <path d={bp.path} fill="none" stroke="transparent" strokeWidth={20} />
            <path d={bp.path} fill="none"
              className={active ? "flow-line" : "flow-line-idle"}
              stroke={active ? ARROW_ACTIVE : "#c5cae9"}
              strokeWidth={active ? 2.5 : 2}
              markerEnd={active ? "url(#arw-a)" : "url(#arw)"}
            />
            {stepLabel && (
              <g>
                <circle cx={bp.lx} cy={bp.ly} r={13}
                  fill={active ? ARROW_ACTIVE : ARROW_COLOR} style={{ transition: "fill 0.15s" }} />
                <text x={bp.lx} y={bp.ly + 4} textAnchor="middle"
                  style={{ fontSize: 10, fontWeight: 800, fill: "#fff", pointerEvents: "none" }}>
                  {stepLabel}
                </text>
              </g>
            )}
            {/* Hover tooltip */}
            {active && !selection && a.details.length > 0 && (
              <g>
                {a.details.slice(0, 3).map((d, di) => (
                  <g key={di}>
                    <rect x={bp.lx + 20} y={bp.ly - 10 + di * 17}
                      width={Math.min(d.length * 5.5 + 16, 200)} height={15} rx={3}
                      fill="#1a237e" opacity={0.9} />
                    <text x={bp.lx + 28} y={bp.ly + 1 + di * 17}
                      style={{ fontSize: 8.5, fill: "#fff", pointerEvents: "none" }}>
                      {d.length > 34 ? d.slice(0, 33) + "…" : d}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </g>
        );
      })}

      {/* Groups */}
      {diag.groups.map((g) => {
        const pos = positions[g.id];
        if (!pos) return null;
        const c = PALETTE[g.category] || PALETTE.processing;
        const isDrag = drag?.gid === g.id;
        const isSel = selection?.type === "group" && selection.id === g.id;
        const cps = compPositions(g, pos);

        return (
          <g key={g.id}>
            {/* Draggable group box */}
            <g onMouseDown={e => onMouseDown(g.id, e)}
              onClick={e => { e.stopPropagation(); setSelection({ type: "group", id: g.id }); }}
              style={{ cursor: isDrag ? "grabbing" : "grab" }}>
              <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h}
                rx={10} fill={c.bg} stroke={isSel ? c.accent : c.border}
                strokeWidth={isSel ? 2.5 : 1.2}
                filter={isDrag ? "url(#gsd)" : "url(#gs)"}
              />
              <rect x={pos.x} y={pos.y} width={pos.w} height={34} rx={10} fill={c.headerBg} />
              <rect x={pos.x} y={pos.y + 24} width={pos.w} height={10} fill={c.headerBg} />
              <rect x={pos.x + 10} y={pos.y} width={pos.w - 20} height={3} rx={1.5} fill={c.accent} />
              <text x={pos.x + pos.w / 2} y={pos.y + 24} textAnchor="middle"
                style={{ fontSize: 12, fontWeight: 700, fill: c.header, pointerEvents: "none" }}>
                {g.name}
              </text>
            </g>

            {/* Components */}
            {cps.map(({ cx, cy, comp }) => {
              const ip = findIconPath(comp.name, comp.icon);
              return (
                <g key={comp.id}>
                  {ip ? (
                    <image href={ip} x={cx - ISIZ / 2} y={cy - ISIZ / 2} width={ISIZ} height={ISIZ} filter="url(#is)" />
                  ) : (
                    <g>
                      <rect x={cx - 20} y={cy - 20} width={40} height={40} rx={8}
                        fill="#f0f0f0" stroke="#ddd" strokeWidth={1} filter="url(#is)" />
                      <text x={cx} y={cy + 5} textAnchor="middle" style={{ fontSize: 14, fill: "#aaa" }}>?</text>
                    </g>
                  )}
                  <text x={cx} y={cy + ISIZ / 2 + 12} textAnchor="middle"
                    style={{ fontSize: 10, fontWeight: 500, fill: "#444", pointerEvents: "none" }}>
                    {comp.name.length > 14 ? comp.name.slice(0, 13) + "…" : comp.name}
                  </text>
                  {comp.subtitle && (
                    <text x={cx} y={cy + ISIZ / 2 + 23} textAnchor="middle"
                      style={{ fontSize: 8, fill: "#aaa", pointerEvents: "none" }}>
                      {comp.subtitle}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      <text x={cW - 10} y={cH - 10} textAnchor="end" style={{ fontSize: 9, fill: "#ddd" }}>
        Drag groups to reposition · Click to edit
      </text>
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
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => { loadRegistry(); }, []);

  // Recompute positions when diagram structure changes (add/delete groups)
  const updateDiag = useCallback((newDiag: DiagramData) => {
    setDiag(newDiag);
    // Recompute sizes for existing positions, add new groups
    const newPos = { ...positions };
    const existing = new Set(Object.keys(newPos));
    newDiag.groups.forEach(g => {
      const sz = groupSize(g);
      if (existing.has(g.id)) {
        // Keep position, update size
        newPos[g.id] = { ...newPos[g.id], w: sz.w, h: sz.h };
      } else {
        // New group — place it
        const allPos = computePositions(newDiag.groups, newDiag.flows);
        if (allPos[g.id]) newPos[g.id] = allPos[g.id];
      }
    });
    // Remove deleted groups
    Object.keys(newPos).forEach(k => {
      if (!newDiag.groups.find(g => g.id === k)) delete newPos[k];
    });
    setPositions(newPos);
  }, [positions]);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(""); setDiag(null); setSelection(null);
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
      setPositions(computePositions(diagram.groups, diagram.flows));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [prompt]);

  const resetLayout = () => {
    if (diag) { setPositions(computePositions(diag.groups, diag.flows)); setSelection(null); }
  };

  const arrows = diag ? buildGroupArrows(diag.groups, diag.flows) : [];

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.3s ease-out; }
        textarea:focus { border-color: #333 !important; background: #fff !important; }
        input:focus { border-color: #aaa !important; }
      `}</style>

      {/* Top bar */}
      <div style={{
        height: 52, padding: "0 20px", borderBottom: "1px solid #f0f0f0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#212529",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>◇</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#212529" }}>ArchGen</span>
          <span style={{ fontSize: 9, background: "#f5f5f5", color: "#999", padding: "2px 6px", borderRadius: 3, fontWeight: 600 }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {diag && (
            <>
              <button onClick={resetLayout} style={{
                background: "none", border: "1px solid #eee", padding: "5px 12px", borderRadius: 6, fontSize: 11, color: "#999", cursor: "pointer",
              }}>⟲ Reset</button>
              <button onClick={() => exportDrawio(diag, positions)} style={{
                background: "#212529", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>↓ .drawio</button>
            </>
          )}
          <span style={{ fontSize: 12, color: "#aaa" }}>{user.firstName || user.email}</span>
          <button onClick={() => logout()} disabled={isLoggingOut} style={{
            background: "none", border: "1px solid #eee", padding: "5px 12px", borderRadius: 6, fontSize: 12, color: "#999", cursor: "pointer",
          }}>Logout</button>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* Left panel */}
        <div style={{
          width: 300, borderRight: "1px solid #f0f0f0",
          padding: 16, display: "flex", flexDirection: "column", gap: 12,
          overflowY: "auto", flexShrink: 0,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1 }}>DESCRIBE YOUR SYSTEM</div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
            placeholder="Describe your architecture..."
            style={{
              width: "100%", minHeight: 120, padding: 10, border: "1px solid #eee", borderRadius: 8,
              fontSize: 12, color: "#333", outline: "none", resize: "vertical", lineHeight: 1.6,
              background: "#fafafa", boxSizing: "border-box",
            }}
          />
          <button onClick={generate} disabled={loading || !prompt.trim()}
            style={{
              width: "100%", padding: "10px 0", background: loading ? "#666" : "#212529",
              color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: loading ? "wait" : "pointer", opacity: !prompt.trim() ? 0.3 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {loading && <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {loading ? "Generating..." : "Generate Diagram"}
          </button>

          {error && <div style={{ padding: 8, borderRadius: 6, background: "#fff5f5", border: "1px solid #fecaca", color: "#dc2626", fontSize: 11 }}>{error}</div>}

          {/* Templates or Edit panel */}
          {diag && selection ? (
            <EditPanel diag={diag} setDiag={updateDiag} selection={selection} setSelection={setSelection} positions={positions} arrows={arrows} />
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 4 }}>TEMPLATES</div>
              {SAMPLES.map((s, i) => (
                <button key={i} onClick={() => setPrompt(s.prompt)} style={{
                  width: "100%", textAlign: "left", padding: "8px 10px", background: "#fafafa",
                  border: "1px solid #f0f0f0", borderRadius: 6, cursor: "pointer",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>{s.label}</div>
                  <div style={{ fontSize: 9, color: "#aaa", marginTop: 2, lineHeight: 1.4 }}>{s.prompt.slice(0, 70)}...</div>
                </button>
              ))}
            </>
          )}

          {diag && (
            <div style={{ padding: 10, background: "#f8f9fa", borderRadius: 6, border: "1px solid #f0f0f0", marginTop: 4 }}>
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  { n: diag.groups.length, l: "Groups" },
                  { n: diag.groups.reduce((s, g) => s + g.components.length, 0), l: "Services" },
                  { n: arrows.length, l: "Connections" },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#212529" }}>{s.n}</div>
                    <div style={{ fontSize: 9, color: "#aaa" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#f5f5f5" }}>
          {!diag && !loading && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 40, color: "#ddd" }}>◇</div>
              <div style={{ color: "#bbb", fontSize: 13 }}>Describe a system to generate its architecture diagram</div>
            </div>
          )}
          {loading && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
              <div style={{ width: 28, height: 28, border: "3px solid #e5e5e5", borderTopColor: "#212529", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <div style={{ color: "#999", fontSize: 13 }}>Generating diagram...</div>
            </div>
          )}
          {diag && Object.keys(positions).length > 0 && (
            <div className="fade-up" style={{
              background: "#fff", borderRadius: 10, border: "1px solid #e5e5e5",
              display: "inline-block", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <DiagramCanvas diag={diag} setDiag={updateDiag} positions={positions} setPositions={setPositions} selection={selection} setSelection={setSelection} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
