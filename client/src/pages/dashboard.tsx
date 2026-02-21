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
const ARROW_CLR = "#5c6bc0";
const ARROW_ACT = "#303f9f";

const SAMPLES = [
  { label: "Healthcare AI Pipeline", prompt: "Healthcare AI system: Patient data from Epic EHR flows through FHIR API gateway to a data lake in BigQuery. Vertex AI trains clinical prediction models using feature store. Models are deployed via Cloud Run API serving predictions to a React clinician dashboard and a mobile app for nurses. Include monitoring and security layers." },
  { label: "E-commerce Platform", prompt: "E-commerce recommendation system: User clickstream from web and mobile apps flows through API Gateway to Pub/Sub streams. Cloud Functions processes events into Firestore user profiles. Vertex AI trains recommendation models nightly. Results cached in Memorystore Redis, served through Cloud Run GraphQL API to the React storefront." },
  { label: "RAG Chatbot Platform", prompt: "RAG chatbot: Internal documents from SharePoint, Confluence, and Google Drive are chunked and embedded via Vertex AI embedding API, stored in Cloud SQL with pgvector. User queries come through a React chat UI, hit a Cloud Run orchestrator that does retrieval, augments the prompt, calls Vertex AI for generation, and returns responses." },
];

// ─── TYPES ─────────────────────────────────────────────────
interface Comp { id: string; name: string; icon?: string; subtitle?: string; }
interface Group { id: string; name: string; category: string; components: Comp[]; }
interface Flow { from: string; to: string; label?: string; step?: number; }
interface DiagData { title: string; groups: Group[]; flows: Flow[]; }
interface GPos { x: number; y: number; w: number; h: number; }
interface GArrow { id: string; fromGid: string; toGid: string; steps: number[]; labels: string[]; details: string[]; }
type Sel = { type: "group"; id: string } | { type: "arrow"; id: string } | null;
type Dir = "horizontal" | "vertical";

// ─── TOPO SORT ─────────────────────────────────────────────
function topoSort(groups: Group[], flows: Flow[]): string[][] {
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
  while (q.length) {
    cols.push([...q]); q.forEach(id => vis.add(id));
    const nx: string[] = [];
    q.forEach(id => { adj[id].forEach(t => { inD[t]--; if (inD[t] === 0 && !vis.has(t)) nx.push(t); }); });
    q = nx;
  }
  const rem = groups.map(g => g.id).filter(id => !vis.has(id));
  if (rem.length) cols.push(rem);
  return cols;
}

function buildArrows(groups: Group[], flows: Flow[]): GArrow[] {
  const c2g: Record<string, string> = {};
  const c2n: Record<string, string> = {};
  groups.forEach(g => g.components.forEach(c => { c2g[c.id] = g.id; c2n[c.id] = c.name; }));
  const m: Record<string, GArrow> = {};
  flows.forEach(f => {
    const fg = c2g[f.from], tg = c2g[f.to];
    if (!fg || !tg || fg === tg) return;
    const key = `${fg}→${tg}`;
    if (!m[key]) m[key] = { id: key, fromGid: fg, toGid: tg, steps: [], labels: [], details: [] };
    if (f.step != null) m[key].steps.push(f.step);
    if (f.label) m[key].labels.push(f.label);
    m[key].details.push(`${c2n[f.from]} → ${c2n[f.to]}${f.label ? ': ' + f.label : ''}`);
  });
  return Object.values(m).sort((a, b) => (a.steps.length ? Math.min(...a.steps) : 999) - (b.steps.length ? Math.min(...b.steps) : 999));
}

// ─── LAYOUT ────────────────────────────────────────────────
const ISIZ = 44;
const CW = 100; const CH = 80; const CG = 8;
const GPX = 20; const GPT = 42; const GPB = 16;
const GAP_MAIN = 90; const GAP_CROSS = 40;
const MRG = 50; const TTL = 50;

function gSize(g: Group): { w: number; h: number } {
  const n = g.components.length || 1;
  const cols = Math.min(n, 2);
  const rows = Math.ceil(n / cols);
  return { w: Math.max(cols * CW + (cols - 1) * CG + 2 * GPX, 180), h: GPT + rows * CH + GPB };
}

function computePos(groups: Group[], flows: Flow[], dir: Dir): Record<string, GPos> {
  const columns = topoSort(groups, flows);
  const sizes: Record<string, { w: number; h: number }> = {};
  groups.forEach(g => { sizes[g.id] = gSize(g); });
  const pos: Record<string, GPos> = {};

  if (dir === "horizontal") {
    // Groups as columns L→R, stacked vertically within column
    const colW = columns.map(col => Math.max(...col.map(id => sizes[id].w)));
    const colX: number[] = [MRG];
    for (let c = 1; c < columns.length; c++) colX.push(colX[c - 1] + colW[c - 1] + GAP_MAIN);
    columns.forEach((col, ci) => {
      let y = MRG + TTL;
      col.forEach(gid => {
        const sz = sizes[gid];
        pos[gid] = { x: colX[ci] + (colW[ci] - sz.w) / 2, y, w: sz.w, h: sz.h };
        y += sz.h + GAP_CROSS;
      });
    });
  } else {
    // Groups as rows T→B, placed horizontally within row
    const rowH = columns.map(col => Math.max(...col.map(id => sizes[id].h)));
    const rowY: number[] = [MRG + TTL];
    for (let r = 1; r < columns.length; r++) rowY.push(rowY[r - 1] + rowH[r - 1] + GAP_MAIN);
    columns.forEach((col, ri) => {
      let x = MRG;
      col.forEach(gid => {
        const sz = sizes[gid];
        pos[gid] = { x, y: rowY[ri] + (rowH[ri] - sz.h) / 2, w: sz.w, h: sz.h };
        x += sz.w + GAP_CROSS;
      });
    });
  }
  return pos;
}

function compPos(g: Group, pos: GPos) {
  const n = g.components.length;
  const cols = Math.min(n, 2);
  const rows = Math.ceil(n / cols);
  const tw = cols * CW + (cols - 1) * CG;
  const th = rows * CH;
  const sx = pos.x + (pos.w - tw) / 2;
  const sy = pos.y + GPT + (pos.h - GPT - GPB - th) / 2;
  return g.components.map((c, ci) => ({
    cx: sx + (ci % cols) * (CW + CG) + CW / 2,
    cy: sy + Math.floor(ci / cols) * CH + CH / 2 - 6,
    comp: c,
  }));
}

// ─── BEZIER PATHS ──────────────────────────────────────────
function hBezier(fp: GPos, tp: GPos, idx: number, total: number) {
  const vOff = total > 1 ? (idx - (total - 1) / 2) * 18 : 0;
  const sx = fp.x + fp.w, sy = fp.y + fp.h / 2 + vOff;
  const ex = tp.x, ey = tp.y + tp.h / 2 + vOff;
  const fwd = ex > sx + 10;
  if (fwd) {
    const cp = (ex - sx) * 0.4;
    return { path: `M${sx},${sy} C${sx + cp},${sy} ${ex - cp},${ey} ${ex},${ey}`, lx: (sx + ex) / 2, ly: (sy + ey) / 2 };
  }
  const topY = Math.min(fp.y, tp.y) - 50;
  return { path: `M${sx},${sy} C${sx + 50},${sy} ${sx + 50},${topY} ${(sx + ex) / 2},${topY} S${ex - 50},${ey} ${ex},${ey}`, lx: (sx + ex) / 2, ly: topY };
}

function vBezier(fp: GPos, tp: GPos, idx: number, total: number) {
  const hOff = total > 1 ? (idx - (total - 1) / 2) * 18 : 0;
  const sx = fp.x + fp.w / 2 + hOff, sy = fp.y + fp.h;
  const ex = tp.x + tp.w / 2 + hOff, ey = tp.y;
  const fwd = ey > sy + 10;
  if (fwd) {
    const cp = (ey - sy) * 0.4;
    return { path: `M${sx},${sy} C${sx},${sy + cp} ${ex},${ey - cp} ${ex},${ey}`, lx: (sx + ex) / 2, ly: (sy + ey) / 2 };
  }
  const leftX = Math.min(fp.x, tp.x) - 50;
  return { path: `M${sx},${sy} C${sx},${sy + 50} ${leftX},${sy + 50} ${leftX},${(sy + ey) / 2} S${ex},${ey - 50} ${ex},${ey}`, lx: leftX, ly: (sy + ey) / 2 };
}

// ─── EXPORT .drawio ────────────────────────────────────────
function exportDrawio(diag: DiagData, positions: Record<string, GPos>) {
  let cid = 10;
  const cs: string[] = [];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const gm: Record<string, string> = {};
  diag.groups.forEach(g => {
    const col = PALETTE[g.category] || PALETTE.processing;
    const p = positions[g.id]; if (!p) return;
    const id = `c${++cid}`; gm[g.id] = id;
    cs.push(`<mxCell id="${id}" value="${esc(g.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${col.bg};strokeColor=${col.border};verticalAlign=top;fontStyle=1;fontSize=12;fontColor=${col.header};" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" as="geometry"/></mxCell>`);
  });
  buildArrows(diag.groups, diag.flows).forEach(a => {
    const s = gm[a.fromGid], t = gm[a.toGid]; if (!s || !t) return;
    const id = `c${++cid}`;
    cs.push(`<mxCell id="${id}" value="${a.steps.sort((x,y)=>x-y).join(",")}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=${ARROW_CLR};strokeWidth=2;endArrow=blockThin;endFill=1;fontSize=11;fontStyle=1;" edge="1" parent="1" source="${s}" target="${t}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });
  const xml = `<?xml version="1.0"?>\n<mxfile><diagram name="Arch"><mxGraphModel><root>\n<mxCell id="0"/><mxCell id="1" parent="0"/>\n${cs.join("\n")}\n</root></mxGraphModel></diagram></mxfile>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  a.download = `${diag.title?.replace(/\s+/g, "_") || "arch"}.drawio`;
  a.click();
}

// ─── EDIT PANEL ────────────────────────────────────────────
function EditPanel({ diag, setDiag, sel, setSel, arrows }: {
  diag: DiagData; setDiag: (d: DiagData) => void;
  sel: Sel; setSel: (s: Sel) => void; arrows: GArrow[];
}) {
  if (!sel) return <div style={{ padding: 16, color: "#bbb", fontSize: 12, textAlign: "center", marginTop: 16 }}>Click a group or arrow to edit</div>;

  if (sel.type === "group") {
    const g = diag.groups.find(x => x.id === sel.id);
    if (!g) return null;
    const upG = (u: Partial<Group>) => setDiag({ ...diag, groups: diag.groups.map(x => x.id === g.id ? { ...x, ...u } : x) });
    const upC = (cid: string, u: Partial<Comp>) => upG({ components: g.components.map(c => c.id === cid ? { ...c, ...u } : c) });
    const delC = (cid: string) => setDiag({ ...diag, groups: diag.groups.map(x => x.id === g.id ? { ...x, components: x.components.filter(c => c.id !== cid) } : x), flows: diag.flows.filter(f => f.from !== cid && f.to !== cid) });
    const addC = () => upG({ components: [...g.components, { id: `n${Date.now()}`, name: "New Service" }] });
    const delG = () => { const ids = new Set(g.components.map(c => c.id)); setDiag({ ...diag, groups: diag.groups.filter(x => x.id !== g.id), flows: diag.flows.filter(f => !ids.has(f.from) && !ids.has(f.to)) }); setSel(null); };

    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>EDIT GROUP</span>
          <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
        <input value={g.name} onChange={e => upG({ name: e.target.value })}
          style={{ padding: "6px 8px", border: "1px solid #eee", borderRadius: 5, fontSize: 12, outline: "none" }} />
        <div>
          <label style={{ fontSize: 10, color: "#999", marginBottom: 3, display: "block" }}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => upG({ category: cat })} title={cat}
                style={{ width: 24, height: 24, borderRadius: 5, background: PALETTE[cat].accent,
                  border: g.category === cat ? "2px solid #333" : "2px solid transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9 }}>
                {g.category === cat ? "✓" : ""}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={{ fontSize: 10, color: "#999" }}>Components</label>
            <button onClick={addC} style={{ background: "#f0f0f0", border: "none", borderRadius: 4, padding: "1px 7px", fontSize: 10, cursor: "pointer" }}>+ Add</button>
          </div>
          {g.components.map(c => (
            <div key={c.id} style={{ padding: 6, background: "#fafafa", borderRadius: 5, marginBottom: 3, border: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", gap: 4 }}>
                <input value={c.name} onChange={e => upC(c.id, { name: e.target.value })}
                  style={{ flex: 1, padding: "3px 6px", border: "1px solid #eee", borderRadius: 4, fontSize: 11, outline: "none" }} />
                <button onClick={() => delC(c.id)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer" }}>×</button>
              </div>
              <input value={c.subtitle || ""} onChange={e => upC(c.id, { subtitle: e.target.value })} placeholder="Subtitle"
                style={{ width: "100%", padding: "2px 6px", border: "1px solid #eee", borderRadius: 4, fontSize: 9, outline: "none", color: "#999", marginTop: 3, boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
        <button onClick={delG} style={{ padding: "5px 0", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 5, fontSize: 10, color: "#dc2626", cursor: "pointer" }}>Delete Group</button>
      </div>
    );
  }

  if (sel.type === "arrow") {
    const a = arrows.find(x => x.id === sel.id);
    if (!a) return null;
    const fG = diag.groups.find(g => g.id === a.fromGid)?.name || "?";
    const tG = diag.groups.find(g => g.id === a.toGid)?.name || "?";
    const c2g: Record<string, string> = {};
    diag.groups.forEach(g => g.components.forEach(c => { c2g[c.id] = g.id; }));
    const reverse = () => setDiag({ ...diag, flows: diag.flows.map(f => { const fg = c2g[f.from], tg = c2g[f.to]; return fg === a.fromGid && tg === a.toGid ? { ...f, from: f.to, to: f.from } : f; }) });
    const del = () => { setDiag({ ...diag, flows: diag.flows.filter(f => { const fg = c2g[f.from], tg = c2g[f.to]; return !(fg === a.fromGid && tg === a.toGid); }) }); setSel(null); };

    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>CONNECTION</span>
          <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: 8, background: "#f8f9fa", borderRadius: 5, fontSize: 12 }}>
          <b>{fG}</b> <span style={{ color: "#999", margin: "0 6px" }}>→</span> <b>{tG}</b>
        </div>
        {a.steps.length > 0 && <div style={{ fontSize: 11, color: "#666" }}>Steps: {a.steps.sort((x, y) => x - y).join(", ")}</div>}
        {a.details.map((d, i) => <div key={i} style={{ fontSize: 10, color: "#555", padding: "2px 0", borderBottom: "1px solid #f5f5f5" }}>{d}</div>)}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={reverse} style={{ flex: 1, padding: 6, background: "#f5f5f5", border: "1px solid #eee", borderRadius: 5, fontSize: 10, cursor: "pointer" }}>⇄ Reverse</button>
          <button onClick={del} style={{ flex: 1, padding: 6, background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 5, fontSize: 10, color: "#dc2626", cursor: "pointer" }}>Delete</button>
        </div>
      </div>
    );
  }
  return null;
}

// ─── CANVAS ────────────────────────────────────────────────
function Canvas({ diag, setDiag, pos, setPos, sel, setSel, dir }: {
  diag: DiagData; setDiag: (d: DiagData) => void;
  pos: Record<string, GPos>; setPos: (p: Record<string, GPos>) => void;
  sel: Sel; setSel: (s: Sel) => void; dir: Dir;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ gid: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [hA, setHA] = useState<string | null>(null);
  const arrows = buildArrows(diag.groups, diag.flows);

  let mxX = 0, mxY = 0;
  Object.values(pos).forEach(p => { mxX = Math.max(mxX, p.x + p.w); mxY = Math.max(mxY, p.y + p.h); });
  const cW = mxX + MRG, cH = mxY + MRG;

  const onDown = (gid: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDrag({ gid, sx: e.clientX, sy: e.clientY, ox: pos[gid].x, oy: pos[gid].y });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const svg = ref.current; if (!svg) return;
      const r = svg.getBoundingClientRect();
      const s = cW / r.width;
      setPos({ ...pos, [drag.gid]: { ...pos[drag.gid], x: Math.max(10, drag.ox + (e.clientX - drag.sx) * s), y: Math.max(10, drag.oy + (e.clientY - drag.sy) * s) } });
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drag, pos, setPos, cW]);

  const bezier = dir === "horizontal" ? hBezier : vBezier;

  return (
    <svg ref={ref} width={cW} height={cH} viewBox={`0 0 ${cW} ${cH}`}
      style={{ display: "block", fontFamily: "'DM Sans',system-ui,sans-serif", cursor: drag ? "grabbing" : "default" }}
      onClick={() => setSel(null)}>
      <defs>
        <marker id="aw" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill={ARROW_CLR} /></marker>
        <marker id="awa" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill={ARROW_ACT} /></marker>
        <filter id="gs"><feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.06" /></filter>
        <filter id="gsd"><feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.12" /></filter>
        <filter id="is"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.06" /></filter>
      </defs>
      <style>{`@keyframes fd { to { stroke-dashoffset: -24; } } .fl { stroke-dasharray: 8,4; animation: fd 0.8s linear infinite; } .fl-i { stroke-dasharray: none; }`}</style>
      <rect width={cW} height={cH} fill="#fff" />
      <text x={cW / 2} y={36} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: "#111" }}>{diag.title}</text>

      {/* Arrows */}
      {arrows.map(a => {
        const fp = pos[a.fromGid], tp = pos[a.toGid];
        if (!fp || !tp) return null;
        const sameF = arrows.filter(x => x.fromGid === a.fromGid);
        const bp = bezier(fp, tp, sameF.indexOf(a), sameF.length);
        const act = hA === a.id || (sel?.type === "arrow" && sel.id === a.id);
        const st = a.steps.length ? a.steps.sort((x, y) => x - y).join("·") : "";
        return (
          <g key={a.id} onMouseEnter={() => setHA(a.id)} onMouseLeave={() => setHA(null)}
            onClick={e => { e.stopPropagation(); setSel({ type: "arrow", id: a.id }); }} style={{ cursor: "pointer" }}>
            <path d={bp.path} fill="none" stroke="transparent" strokeWidth={20} />
            <path d={bp.path} fill="none" className={act ? "fl" : "fl-i"}
              stroke={act ? ARROW_ACT : "#c5cae9"} strokeWidth={act ? 2.5 : 2}
              markerEnd={act ? "url(#awa)" : "url(#aw)"} />
            {st && <g><circle cx={bp.lx} cy={bp.ly} r={13} fill={act ? ARROW_ACT : ARROW_CLR} />
              <text x={bp.lx} y={bp.ly + 4} textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: "#fff", pointerEvents: "none" }}>{st}</text></g>}
            {act && !sel && a.details.length > 0 && a.details.slice(0, 3).map((d, di) => (
              <g key={di}><rect x={bp.lx + 20} y={bp.ly - 10 + di * 17} width={Math.min(d.length * 5.5 + 16, 200)} height={15} rx={3} fill="#1a237e" opacity={0.9} />
                <text x={bp.lx + 28} y={bp.ly + 1 + di * 17} style={{ fontSize: 8.5, fill: "#fff", pointerEvents: "none" }}>{d.length > 34 ? d.slice(0, 33) + "…" : d}</text></g>
            ))}
          </g>
        );
      })}

      {/* Groups */}
      {diag.groups.map(g => {
        const p = pos[g.id]; if (!p) return null;
        const c = PALETTE[g.category] || PALETTE.processing;
        const isD = drag?.gid === g.id;
        const isS = sel?.type === "group" && sel.id === g.id;
        return (
          <g key={g.id}>
            <g onMouseDown={e => onDown(g.id, e)}
              onClick={e => { e.stopPropagation(); setSel({ type: "group", id: g.id }); }}
              style={{ cursor: isD ? "grabbing" : "grab" }}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={10}
                fill={c.bg} stroke={isS ? c.accent : c.border} strokeWidth={isS ? 2.5 : 1.2}
                filter={isD ? "url(#gsd)" : "url(#gs)"} />
              <rect x={p.x} y={p.y} width={p.w} height={34} rx={10} fill={c.headerBg} />
              <rect x={p.x} y={p.y + 24} width={p.w} height={10} fill={c.headerBg} />
              <rect x={p.x + 10} y={p.y} width={p.w - 20} height={3} rx={1.5} fill={c.accent} />
              <text x={p.x + p.w / 2} y={p.y + 24} textAnchor="middle"
                style={{ fontSize: 12, fontWeight: 700, fill: c.header, pointerEvents: "none" }}>{g.name}</text>
            </g>
            {compPos(g, p).map(({ cx, cy, comp }) => {
              const ip = findIconPath(comp.name, comp.icon);
              return (
                <g key={comp.id}>
                  {ip ? <image href={ip} x={cx - ISIZ / 2} y={cy - ISIZ / 2} width={ISIZ} height={ISIZ} filter="url(#is)" />
                    : <g><rect x={cx - 20} y={cy - 20} width={40} height={40} rx={8} fill="#f0f0f0" stroke="#ddd" strokeWidth={1} filter="url(#is)" />
                      <text x={cx} y={cy + 5} textAnchor="middle" style={{ fontSize: 14, fill: "#aaa" }}>?</text></g>}
                  <text x={cx} y={cy + ISIZ / 2 + 12} textAnchor="middle"
                    style={{ fontSize: 10, fontWeight: 500, fill: "#444", pointerEvents: "none" }}>
                    {comp.name.length > 14 ? comp.name.slice(0, 13) + "…" : comp.name}</text>
                  {comp.subtitle && <text x={cx} y={cy + ISIZ / 2 + 23} textAnchor="middle"
                    style={{ fontSize: 8, fill: "#aaa", pointerEvents: "none" }}>{comp.subtitle}</text>}
                </g>
              );
            })}
          </g>
        );
      })}
      <text x={cW - 10} y={cH - 10} textAnchor="end" style={{ fontSize: 9, fill: "#ddd" }}>Drag groups to reposition · Click to edit</text>
    </svg>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────
export default function Dashboard({ user }: { user: User }) {
  const { logout, isLoggingOut } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diag, setDiag] = useState<DiagData | null>(null);
  const [pos, setPos] = useState<Record<string, GPos>>({});
  const [sel, setSel] = useState<Sel>(null);
  const [dir, setDir] = useState<Dir>("horizontal");

  useEffect(() => { loadRegistry(); }, []);

  const updateDiag = useCallback((d: DiagData) => {
    setDiag(d);
    const np = { ...pos };
    d.groups.forEach(g => {
      const sz = gSize(g);
      if (np[g.id]) { np[g.id] = { ...np[g.id], w: sz.w, h: sz.h }; }
      else { const all = computePos(d.groups, d.flows, dir); if (all[g.id]) np[g.id] = all[g.id]; }
    });
    Object.keys(np).forEach(k => { if (!d.groups.find(g => g.id === k)) delete np[k]; });
    setPos(np);
  }, [pos, dir]);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(""); setDiag(null); setSel(null);
    try {
      const res = await fetch("/api/diagrams/generate", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ prompt }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      const data = await res.json();
      const d = data.diagram as DiagData;
      setDiag(d);
      setPos(computePos(d.groups, d.flows, dir));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [prompt, dir]);

  const relayout = (newDir: Dir) => {
    setDir(newDir);
    if (diag) setPos(computePos(diag.groups, diag.flows, newDir));
  };

  const reset = () => { if (diag) { setPos(computePos(diag.groups, diag.flows, dir)); setSel(null); } };
  const arrows = diag ? buildArrows(diag.groups, diag.flows) : [];

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.3s ease-out; }
        textarea:focus { border-color:#333!important; background:#fff!important; }
        input:focus { border-color:#aaa!important; }
      `}</style>

      {/* Top bar */}
      <div style={{ height: 52, padding: "0 20px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#212529", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>◇</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#212529" }}>ArchGen</span>
          <span style={{ fontSize: 9, background: "#f5f5f5", color: "#999", padding: "2px 6px", borderRadius: 3, fontWeight: 600 }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {diag && (
            <>
              {/* Layout toggle */}
              <div style={{ display: "flex", border: "1px solid #eee", borderRadius: 6, overflow: "hidden" }}>
                <button onClick={() => relayout("horizontal")}
                  style={{ padding: "4px 10px", fontSize: 11, border: "none", cursor: "pointer",
                    background: dir === "horizontal" ? "#212529" : "#fff", color: dir === "horizontal" ? "#fff" : "#999" }}>
                  ↔ Horizontal
                </button>
                <button onClick={() => relayout("vertical")}
                  style={{ padding: "4px 10px", fontSize: 11, border: "none", cursor: "pointer", borderLeft: "1px solid #eee",
                    background: dir === "vertical" ? "#212529" : "#fff", color: dir === "vertical" ? "#fff" : "#999" }}>
                  ↕ Vertical
                </button>
              </div>
              <button onClick={reset} style={{ background: "none", border: "1px solid #eee", padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#999", cursor: "pointer" }}>⟲ Reset</button>
              <button onClick={() => exportDrawio(diag, pos)} style={{ background: "#212529", color: "#fff", border: "none", padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>↓ .drawio</button>
            </>
          )}
          <span style={{ fontSize: 12, color: "#aaa" }}>{user.firstName || user.email}</span>
          <button onClick={() => logout()} disabled={isLoggingOut} style={{ background: "none", border: "1px solid #eee", padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#999", cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* Sidebar */}
        <div style={{ width: 300, borderRight: "1px solid #f0f0f0", padding: 14, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1 }}>DESCRIBE YOUR SYSTEM</div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
            placeholder="Describe your architecture..."
            style={{ width: "100%", minHeight: 110, padding: 10, border: "1px solid #eee", borderRadius: 8, fontSize: 12, color: "#333", outline: "none", resize: "vertical", lineHeight: 1.6, background: "#fafafa", boxSizing: "border-box" }}
          />
          <button onClick={generate} disabled={loading || !prompt.trim()}
            style={{ width: "100%", padding: "9px 0", background: loading ? "#666" : "#212529", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: !prompt.trim() ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading && <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {loading ? "Generating..." : "Generate Diagram"}
          </button>
          {error && <div style={{ padding: 8, borderRadius: 6, background: "#fff5f5", border: "1px solid #fecaca", color: "#dc2626", fontSize: 11 }}>{error}</div>}

          {diag && sel ? (
            <EditPanel diag={diag} setDiag={updateDiag} sel={sel} setSel={setSel} arrows={arrows} />
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 4 }}>TEMPLATES</div>
              {SAMPLES.map((s, i) => (
                <button key={i} onClick={() => setPrompt(s.prompt)} style={{ width: "100%", textAlign: "left", padding: "8px 10px", background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 6, cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>{s.label}</div>
                  <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{s.prompt.slice(0, 70)}...</div>
                </button>
              ))}
            </>
          )}

          {diag && (
            <div style={{ padding: 10, background: "#f8f9fa", borderRadius: 6, border: "1px solid #f0f0f0", marginTop: 4 }}>
              <div style={{ display: "flex", gap: 20 }}>
                {[{ n: diag.groups.length, l: "Groups" }, { n: diag.groups.reduce((s, g) => s + g.components.length, 0), l: "Services" }, { n: arrows.length, l: "Connections" }].map((s, i) => (
                  <div key={i}><div style={{ fontSize: 16, fontWeight: 700, color: "#212529" }}>{s.n}</div><div style={{ fontSize: 9, color: "#aaa" }}>{s.l}</div></div>
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
          {diag && Object.keys(pos).length > 0 && (
            <div className="fade-up" style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e5e5", display: "inline-block", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <Canvas diag={diag} setDiag={updateDiag} pos={pos} setPos={setPos} sel={sel} setSel={setSel} dir={dir} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
