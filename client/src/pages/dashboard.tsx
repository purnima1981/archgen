import { useState, useCallback, useEffect } from "react";
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

const FLOW_COLORS = ["#5c6bc0", "#5c6bc0", "#5c6bc0", "#5c6bc0", "#5c6bc0", "#5c6bc0", "#5c6bc0", "#5c6bc0", "#5c6bc0", "#5c6bc0"];

const SAMPLES = [
  { label: "Healthcare AI Pipeline", prompt: "Healthcare AI system: Patient data from Epic EHR flows through FHIR API gateway to a data lake in BigQuery. Vertex AI trains clinical prediction models using feature store. Models are deployed via Cloud Run API serving predictions to a React clinician dashboard and a mobile app for nurses. Include monitoring and security layers." },
  { label: "E-commerce Platform", prompt: "E-commerce recommendation system: User clickstream from web and mobile apps flows through API Gateway to Pub/Sub streams. Cloud Functions processes events into Firestore user profiles. Vertex AI trains recommendation models nightly. Results cached in Memorystore Redis, served through Cloud Run GraphQL API to the React storefront. Include Identity Platform for auth." },
  { label: "RAG Chatbot Platform", prompt: "RAG chatbot: Internal documents from SharePoint, Confluence, and Google Drive are chunked and embedded via Vertex AI embedding API, stored in Cloud SQL with pgvector. User queries come through a React chat UI, hit a Cloud Run orchestrator that does retrieval, augments the prompt, calls Vertex AI for generation, and returns responses. Include Memorystore Redis for conversation cache." },
];

// ─── TYPES ─────────────────────────────────────────────────
interface DiagramData {
  title: string;
  groups: Array<{ id: string; name: string; category: string; components: Array<{ id: string; name: string; icon?: string; subtitle?: string }> }>;
  flows: Array<{ from: string; to: string; label?: string; step?: number }>;
}
interface CompLayout { cx: number; cy: number; name: string; icon?: string; subtitle?: string; iconPath: string | null; groupIdx: number; }
interface FlowLayout { from: string; to: string; label?: string; step?: number; path: string; color: string; labelX: number; labelY: number; }
interface GroupLayout { x: number; y: number; w: number; h: number; name: string; category: string; }
interface LayoutResult { groups: GroupLayout[]; comps: Record<string, CompLayout>; flows: FlowLayout[]; w: number; h: number; title: string; }

// ─── HORIZONTAL PIPELINE LAYOUT ────────────────────────────
// Groups are columns left → right. Components stack vertically in each column.
// This creates a natural pipeline flow that reads left to right.

const ISIZ = 48;       // icon size
const CELL_W = 120;    // width per component cell
const CELL_H = 90;     // height per component cell
const COL_PAD = 24;    // padding inside group column
const COL_HDR = 34;    // group header height
const COL_GAP = 60;    // gap between group columns
const MARGIN = 50;
const TITLE_H = 50;

function computeLayout(diag: DiagramData): LayoutResult {
  const groups = diag.groups || [];
  const comps: Record<string, CompLayout> = {};

  // Each group becomes a column
  const colSizes = groups.map(g => {
    const n = g.components?.length || 1;
    return {
      w: CELL_W + 2 * COL_PAD,
      h: COL_HDR + n * CELL_H + COL_PAD,
      n,
    };
  });

  // Max column height
  const maxH = Math.max(...colSizes.map(c => c.h));

  // Position columns left to right
  let curX = MARGIN;
  const gLayouts: GroupLayout[] = [];

  groups.forEach((g, gi) => {
    const sz = colSizes[gi];
    const gx = curX;
    const gy = MARGIN + TITLE_H;
    const gh = maxH; // all columns same height for alignment

    gLayouts.push({
      x: gx, y: gy, w: sz.w, h: gh,
      name: g.name, category: g.category || "processing",
    });

    // Stack components vertically, centered in column
    const startY = gy + COL_HDR + COL_PAD;
    const totalCompH = sz.n * CELL_H;
    const offsetY = (gh - COL_HDR - COL_PAD - totalCompH) / 2; // center vertically

    (g.components || []).forEach((comp, ci) => {
      const cx = gx + sz.w / 2;
      const cy = startY + offsetY + ci * CELL_H + CELL_H / 2;
      comps[comp.id] = {
        cx, cy,
        name: comp.name, icon: comp.icon, subtitle: comp.subtitle,
        iconPath: findIconPath(comp.name, comp.icon),
        groupIdx: gi,
      };
    });

    curX += sz.w + COL_GAP;
  });

  const totW = curX - COL_GAP + MARGIN;
  const totH = MARGIN + TITLE_H + maxH + MARGIN;

  // ── Flow routing with clean curves ──
  const flows: FlowLayout[] = [];

  (diag.flows || []).forEach((f, fi) => {
    const fr = comps[f.from];
    const to = comps[f.to];
    if (!fr || !to) return;

    const color = "#5c6bc0"; // consistent indigo for all flow lines
    const pad = ISIZ / 2 + 8;

    const dx = to.cx - fr.cx;
    const dy = to.cy - fr.cy;

    let sx: number, sy: number, ex: number, ey: number;
    let path: string;

    if (Math.abs(dx) > 30) {
      // Horizontal: exit right, enter left (or vice versa)
      sx = dx > 0 ? fr.cx + pad : fr.cx - pad;
      sy = fr.cy;
      ex = dx > 0 ? to.cx - pad : to.cx + pad;
      ey = to.cy;

      // Smooth cubic bezier curve
      const ctrl = Math.abs(dx) * 0.4;
      path = `M${sx},${sy} C${sx + (dx > 0 ? ctrl : -ctrl)},${sy} ${ex - (dx > 0 ? ctrl : -ctrl)},${ey} ${ex},${ey}`;
    } else {
      // Vertical: exit bottom, enter top (or vice versa)
      sx = fr.cx;
      sy = dy > 0 ? fr.cy + pad : fr.cy - pad;
      ex = to.cx;
      ey = dy > 0 ? to.cy - pad : to.cy + pad;

      const ctrl = Math.abs(dy) * 0.4;
      path = `M${sx},${sy} C${sx},${sy + (dy > 0 ? ctrl : -ctrl)} ${ex},${ey - (dy > 0 ? ctrl : -ctrl)} ${ex},${ey}`;
    }

    const labelX = (sx + ex) / 2;
    const labelY = (sy + ey) / 2;

    flows.push({ from: f.from, to: f.to, label: f.label, step: f.step, path, color, labelX, labelY });
  });

  return { groups: gLayouts, comps, flows, w: totW, h: totH, title: diag.title };
}

// ─── EXPORT ────────────────────────────────────────────────
function exportDrawio(layout: LayoutResult) {
  let cid = 10;
  const cs: string[] = [];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const cMap: Record<string, string> = {};

  layout.groups.forEach(g => {
    const col = PALETTE[g.category] || PALETTE.processing;
    const id = `c${++cid}`;
    cs.push(`<mxCell id="${id}" value="${esc(g.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${col.bg};strokeColor=${col.border};verticalAlign=top;fontStyle=1;fontSize=11;fontColor=${col.header};arcSize=4;spacingTop=4;" vertex="1" parent="1"><mxGeometry x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" as="geometry"/></mxCell>`);
  });
  Object.entries(layout.comps).forEach(([compId, c]) => {
    const id = `c${++cid}`; cMap[compId] = id;
    cs.push(`<mxCell id="${id}" value="${esc(c.name)}" style="shape=image;verticalLabelPosition=bottom;labelBackgroundColor=default;verticalAlign=top;aspect=fixed;fontSize=10;" vertex="1" parent="1"><mxGeometry x="${c.cx - 24}" y="${c.cy - 24}" width="48" height="48" as="geometry"/></mxCell>`);
  });
  layout.flows.forEach(f => {
    const src = cMap[f.from], tgt = cMap[f.to];
    if (!src || !tgt) return;
    const id = `c${++cid}`;
    cs.push(`<mxCell id="${id}" value="${f.step || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=${f.color};strokeWidth=2;endArrow=blockThin;endFill=1;fontSize=10;fontStyle=1;fontColor=${f.color};" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile><diagram name="Architecture"><mxGraphModel><root>\n<mxCell id="0"/><mxCell id="1" parent="0"/>\n${cs.join("\n")}\n</root></mxGraphModel></diagram></mxfile>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  a.download = `${layout.title?.replace(/\s+/g, "_") || "architecture"}.drawio`;
  a.click();
}

// ─── SVG RENDERER ──────────────────────────────────────────
function DiagramSVG({ layout }: { layout: LayoutResult }) {
  const [hComp, setHComp] = useState<string | null>(null);
  const [hFlow, setHFlow] = useState<number | null>(null);

  return (
    <svg width={layout.w} height={layout.h} viewBox={`0 0 ${layout.w} ${layout.h}`}
      style={{ display: "block", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <defs>
        <marker id="arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0,10 3.5,0 7" fill="#5c6bc0" />
        </marker>
        <marker id="arr-h" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0,10 3.5,0 7" fill="#3949ab" />
        </marker>
        <marker id="arr-g" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0,10 3.5,0 7" fill="#bbb" />
        </marker>
        <filter id="ico-sh"><feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" /></filter>
        <filter id="ico-hi"><feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.16" /></filter>
      </defs>

      <rect width={layout.w} height={layout.h} fill="#ffffff" />

      {/* Title */}
      <text x={layout.w / 2} y={38} textAnchor="middle"
        style={{ fontSize: 18, fontWeight: 700, fill: "#111" }}>
        {layout.title}
      </text>

      {/* Groups as columns */}
      {layout.groups.map((g, i) => {
        const c = PALETTE[g.category] || PALETTE.processing;
        return (
          <g key={`g${i}`}>
            <rect x={g.x} y={g.y} width={g.w} height={g.h}
              rx={10} fill={c.bg} stroke={c.border} strokeWidth={1} opacity={0.6} />
            {/* Header */}
            <rect x={g.x} y={g.y} width={g.w} height={30} rx={10} fill={c.headerBg} opacity={0.7} />
            <rect x={g.x} y={g.y + 20} width={g.w} height={10} fill={c.headerBg} opacity={0.7} />
            {/* Top accent */}
            <rect x={g.x} y={g.y} width={g.w} height={4} rx={2} fill={c.accent} />
            <text x={g.x + g.w / 2} y={g.y + 22} textAnchor="middle"
              style={{ fontSize: 11, fontWeight: 700, fill: c.header }}>
              {g.name}
            </text>
          </g>
        );
      })}

      {/* Flows — smooth curves */}
      {layout.flows.map((f, i) => {
        const active = hFlow === i || (hComp !== null && (f.from === hComp || f.to === hComp));
        return (
          <g key={`f${i}`} onMouseEnter={() => setHFlow(i)} onMouseLeave={() => setHFlow(null)}
            style={{ cursor: "pointer" }}>
            <path d={f.path} fill="none" stroke="transparent" strokeWidth={18} />
            <path d={f.path} fill="none"
              stroke={active ? "#3949ab" : "#c5cae9"}
              strokeWidth={active ? 2.5 : 1.5}
              markerEnd={active ? "url(#arr-h)" : "url(#arr-g)"}
              style={{ transition: "all 0.2s" }}
            />
            {/* Step badge */}
            {f.step != null && (
              <g>
                <circle cx={f.labelX} cy={f.labelY} r={12}
                  fill={active ? "#3949ab" : "#5c6bc0"} />
                <text x={f.labelX} y={f.labelY + 4} textAnchor="middle"
                  style={{ fontSize: 10, fontWeight: 800, fill: "#fff" }}>
                  {f.step}
                </text>
              </g>
            )}
            {/* Hover label */}
            {active && f.label && (
              <g>
                <rect x={f.labelX - 55} y={f.labelY - 28} width={110} height={18} rx={4}
                  fill="#1a237e" opacity={0.92} />
                <text x={f.labelX} y={f.labelY - 16} textAnchor="middle"
                  style={{ fontSize: 9, fill: "#fff" }}>
                  {f.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Components */}
      {Object.entries(layout.comps).map(([id, c]) => {
        const active = hComp === id ||
          (hFlow !== null && layout.flows[hFlow] &&
            (layout.flows[hFlow].from === id || layout.flows[hFlow].to === id));
        return (
          <g key={id} onMouseEnter={() => setHComp(id)} onMouseLeave={() => setHComp(null)}
            style={{ cursor: "pointer" }}>
            {c.iconPath ? (
              <image href={c.iconPath}
                x={c.cx - ISIZ / 2} y={c.cy - ISIZ / 2}
                width={ISIZ} height={ISIZ}
                filter={active ? "url(#ico-hi)" : "url(#ico-sh)"}
                style={{ transition: "filter 0.15s" }}
              />
            ) : (
              <g>
                <rect x={c.cx - 22} y={c.cy - 22} width={44} height={44} rx={10}
                  fill="#f0f0f0" stroke="#ddd" strokeWidth={1}
                  filter={active ? "url(#ico-hi)" : "url(#ico-sh)"} />
                <text x={c.cx} y={c.cy + 5} textAnchor="middle"
                  style={{ fontSize: 16, fill: "#aaa" }}>?</text>
              </g>
            )}
            <text x={c.cx} y={c.cy + ISIZ / 2 + 14} textAnchor="middle"
              style={{
                fontSize: 10, fontWeight: active ? 600 : 500,
                fill: active ? "#111" : "#444",
              }}>
              {c.name.length > 16 ? c.name.slice(0, 15) + "…" : c.name}
            </text>
            {active && c.subtitle && (
              <text x={c.cx} y={c.cy + ISIZ / 2 + 26} textAnchor="middle"
                style={{ fontSize: 8, fill: "#999" }}>
                {c.subtitle}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────
export default function Dashboard({ user }: { user: User }) {
  const { logout, isLoggingOut } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState<LayoutResult | null>(null);

  useEffect(() => { loadRegistry(); }, []);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(""); setLayout(null);
    try {
      const res = await fetch("/api/diagrams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Generation failed"); }
      const data = await res.json();
      setLayout(computeLayout(data.diagram as DiagramData));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [prompt]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {layout && (
            <button onClick={() => exportDrawio(layout)} style={{
              background: "#212529", color: "#fff", border: "none",
              padding: "6px 14px", borderRadius: 6, fontSize: 12,
              fontWeight: 600, cursor: "pointer",
            }}>↓ Export .drawio</button>
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

          {layout && (
            <div style={{ padding: 12, background: "#f8f9fa", borderRadius: 6, border: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", gap: 24 }}>
                {[
                  { n: layout.groups.length, l: "Groups" },
                  { n: Object.keys(layout.comps).length, l: "Components" },
                  { n: layout.flows.length, l: "Flows" },
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

        {/* Canvas - horizontal scroll */}
        <div style={{ flex: 1, overflow: "auto", padding: 24, background: "#f5f5f5" }}>
          {!layout && !loading && (
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
          {layout && (
            <div className="fade-up" style={{
              background: "#fff", borderRadius: 10, border: "1px solid #e5e5e5",
              display: "inline-block",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <DiagramSVG layout={layout} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
