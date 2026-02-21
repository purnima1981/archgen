import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

// ─── ICON REGISTRY ─────────────────────────────────────────
interface IconEntry {
  id: string; name: string; path: string; aliases: string[];
}
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

  // Exact match on id
  let m = ICON_REGISTRY.find(i => i.id === lower);
  if (m) return `/icons/gcp/${m.id}.svg`;

  // Exact match on name
  m = ICON_REGISTRY.find(i => i.name.toLowerCase() === lower);
  if (m) return `/icons/gcp/${m.id}.svg`;

  // Alias match
  m = ICON_REGISTRY.find(i => i.aliases.some(a => a === lower || lower.includes(a) || a.includes(lower)));
  if (m) return `/icons/gcp/${m.id}.svg`;

  // Fuzzy: check if icon id words appear in the name
  const words = lower.replace(/[_-]/g, " ").split(/\s+/);
  m = ICON_REGISTRY.find(i => {
    const iwords = i.id.replace(/_/g, " ").split(/\s+/);
    return iwords.every(w => words.some(nw => nw.includes(w) || w.includes(nw)));
  });
  if (m) return `/icons/gcp/${m.id}.svg`;

  return null;
}

// ─── COLOR SYSTEM ──────────────────────────────────────────
const PALETTE: Record<string, {
  bg: string; border: string; headerBg: string; header: string; accent: string;
}> = {
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

const FLOW_COLORS = [
  "#e53935", "#fb8c00", "#43a047", "#1e88e5", "#7e57c2",
  "#00acc1", "#f4511e", "#3949ab", "#00897b", "#c62828",
];

const SAMPLES = [
  {
    label: "Healthcare AI Pipeline",
    prompt: "Healthcare AI system: Patient data from Epic EHR flows through FHIR API gateway to a data lake in BigQuery. Vertex AI trains clinical prediction models using feature store. Models are deployed via Cloud Run API serving predictions to a React clinician dashboard and a mobile app for nurses. Include monitoring and security layers."
  },
  {
    label: "E-commerce Platform",
    prompt: "E-commerce recommendation system: User clickstream from web and mobile apps flows through API Gateway to Pub/Sub streams. Cloud Functions processes events into Firestore user profiles. Vertex AI trains recommendation models nightly. Results cached in Memorystore Redis, served through Cloud Run GraphQL API to the React storefront. Include Identity Platform for auth."
  },
  {
    label: "RAG Chatbot Platform",
    prompt: "RAG chatbot: Internal documents from SharePoint, Confluence, and Google Drive are chunked and embedded via Vertex AI embedding API, stored in Cloud SQL with pgvector. User queries come through a React chat UI, hit a Cloud Run orchestrator that does retrieval, augments the prompt, calls Vertex AI for generation, and returns responses. Include Memorystore Redis for conversation cache."
  },
];

// ─── LAYOUT ENGINE ─────────────────────────────────────────
interface DiagramData {
  title: string;
  groups: Array<{
    id: string; name: string; category: string;
    components: Array<{ id: string; name: string; icon?: string; subtitle?: string }>;
  }>;
  flows: Array<{ from: string; to: string; label?: string; step?: number }>;
}

interface CompLayout {
  x: number; y: number; cx: number; cy: number;
  name: string; icon?: string; subtitle?: string; iconPath: string | null;
}

interface LayoutResult {
  groups: Array<any>;
  comps: Record<string, CompLayout>;
  flows: Array<any>;
  w: number; h: number; title: string;
}

const ICON_W = 100;     // component cell width
const ICON_H = 80;      // component cell height (icon 48 + text ~20 + gap)
const ICON_SZ = 48;     // rendered icon size
const ICON_GAP = 16;    // gap between icons
const GP = 20;           // group padding
const GH = 28;           // group header height
const GGX = 36;          // gap between group columns
const GGY = 36;          // gap between group rows
const MARGIN = 50;
const TITLE_H = 44;

function computeLayout(diag: DiagramData): LayoutResult {
  const groups = diag.groups || [];
  const compPos: Record<string, CompLayout> = {};

  // Each group: how many icons in a row
  const gSizes = groups.map(g => {
    const n = g.components?.length || 1;
    const cols = Math.min(n, 3);
    const rows = Math.ceil(n / cols);
    return {
      w: cols * ICON_W + (cols - 1) * ICON_GAP + 2 * GP,
      h: GH + rows * ICON_H + (rows - 1) * ICON_GAP + 2 * GP,
      cols, rows
    };
  });

  // Grid: 3 columns (or 2 if ≤4 groups)
  const COLS = groups.length <= 4 ? 2 : 3;

  // Column widths
  const colW: number[] = [];
  for (let c = 0; c < COLS; c++) {
    let mx = 0;
    for (let g = c; g < groups.length; g += COLS) mx = Math.max(mx, gSizes[g].w);
    colW.push(mx || 280);
  }

  // Row heights
  const numRows = Math.ceil(groups.length / COLS);
  const rowH: number[] = [];
  for (let r = 0; r < numRows; r++) {
    let mx = 0;
    for (let c = 0; c < COLS; c++) {
      const gi = r * COLS + c;
      if (gi < groups.length) mx = Math.max(mx, gSizes[gi].h);
    }
    rowH.push(mx);
  }

  // Positions
  const colX = [MARGIN];
  for (let c = 1; c < COLS; c++) colX.push(colX[c - 1] + colW[c - 1] + GGX);

  const rowY = [MARGIN + TITLE_H];
  for (let r = 1; r < numRows; r++) rowY.push(rowY[r - 1] + rowH[r - 1] + GGY);

  const gLayouts: any[] = [];
  groups.forEach((g, gi) => {
    const row = Math.floor(gi / COLS);
    const col = gi % COLS;
    const sz = gSizes[gi];
    const gx = colX[col] + (colW[col] - sz.w) / 2;
    const gy = rowY[row];

    gLayouts.push({ ...g, x: gx, y: gy, w: sz.w, h: sz.h, category: g.category || "processing" });

    (g.components || []).forEach((comp, ci) => {
      const cr = Math.floor(ci / sz.cols);
      const cc = ci % sz.cols;
      const cx = gx + GP + cc * (ICON_W + ICON_GAP) + ICON_W / 2;
      const cy = gy + GH + GP + cr * (ICON_H + ICON_GAP) + ICON_SZ / 2;

      compPos[comp.id] = {
        x: cx - ICON_W / 2,
        y: gy + GH + GP + cr * (ICON_H + ICON_GAP),
        cx, cy,
        name: comp.name,
        icon: comp.icon,
        subtitle: comp.subtitle,
        iconPath: findIconPath(comp.name, comp.icon),
      };
    });
  });

  const totW = colX[COLS - 1] + colW[COLS - 1] + MARGIN;
  const totH = rowY[numRows - 1] + rowH[numRows - 1] + MARGIN;

  // Flows
  const flows = (diag.flows || []).map((f, fi) => {
    const fr = compPos[f.from];
    const to = compPos[f.to];
    if (!fr || !to) return null;

    const dx = to.cx - fr.cx, dy = to.cy - fr.cy;
    let sx: number, sy: number, ex: number, ey: number;

    if (Math.abs(dx) >= Math.abs(dy)) {
      sx = dx > 0 ? fr.cx + ICON_SZ / 2 + 2 : fr.cx - ICON_SZ / 2 - 2;
      sy = fr.cy;
      ex = dx > 0 ? to.cx - ICON_SZ / 2 - 2 : to.cx + ICON_SZ / 2 + 2;
      ey = to.cy;
    } else {
      sx = fr.cx;
      sy = dy > 0 ? fr.cy + ICON_SZ / 2 + 2 : fr.cy - ICON_SZ / 2 - 2;
      ex = to.cx;
      ey = dy > 0 ? to.cy - ICON_SZ / 2 - 2 : to.cy + ICON_SZ / 2 + 2;
    }

    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    const path = Math.abs(dx) >= Math.abs(dy)
      ? `M${sx},${sy} L${mx},${sy} L${mx},${ey} L${ex},${ey}`
      : `M${sx},${sy} L${sx},${my} L${ex},${my} L${ex},${ey}`;

    const color = FLOW_COLORS[fi % FLOW_COLORS.length];
    return { ...f, sx, sy, ex, ey, path, midX: mx, midY: my, color };
  }).filter(Boolean);

  return { groups: gLayouts, comps: compPos, flows, w: totW, h: totH, title: diag.title };
}

// ─── EXPORT .drawio ────────────────────────────────────────
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
    const id = `c${++cid}`;
    cMap[compId] = id;
    cs.push(`<mxCell id="${id}" value="${esc(c.name)}" style="shape=image;verticalLabelPosition=bottom;labelBackgroundColor=default;verticalAlign=top;aspect=fixed;imageAspect=0;image=${c.iconPath || ''};fontSize=10;fontFamily=Helvetica;" vertex="1" parent="1"><mxGeometry x="${c.cx - 24}" y="${c.cy - 24}" width="48" height="48" as="geometry"/></mxCell>`);
  });

  layout.flows.forEach(f => {
    const src = cMap[f.from], tgt = cMap[f.to];
    if (!src || !tgt) return;
    const id = `c${++cid}`;
    cs.push(`<mxCell id="${id}" value="${f.step || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=${f.color || '#666'};strokeWidth=2;endArrow=blockThin;endFill=1;fontSize=10;fontStyle=1;fontColor=${f.color || '#666'};" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile><diagram name="Architecture"><mxGraphModel><root>\n<mxCell id="0"/><mxCell id="1" parent="0"/>\n${cs.join("\n")}\n</root></mxGraphModel></diagram></mxfile>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  a.download = `${layout.title?.replace(/\s+/g, "_") || "architecture"}.drawio`;
  a.click();
}

// ─── SVG DIAGRAM RENDERER ──────────────────────────────────
function DiagramSVG({ layout }: { layout: LayoutResult }) {
  const [hComp, setHComp] = useState<string | null>(null);
  const [hFlow, setHFlow] = useState<number | null>(null);

  return (
    <svg width={layout.w} height={layout.h} viewBox={`0 0 ${layout.w} ${layout.h}`}
      style={{ display: "block", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <defs>
        {FLOW_COLORS.map((c, i) => (
          <marker key={i} id={`a${i}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0,8 3,0 6" fill={c} />
          </marker>
        ))}
        <marker id="ag" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#ccc" />
        </marker>
        <filter id="ico-sh"><feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" /></filter>
        <filter id="ico-sh-h"><feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.15" /></filter>
      </defs>

      <rect width={layout.w} height={layout.h} fill="#ffffff" />

      {/* Title */}
      <text x={layout.w / 2} y={34} textAnchor="middle"
        style={{ fontSize: 18, fontWeight: 700, fill: "#111" }}>
        {layout.title}
      </text>

      {/* Flows (behind) */}
      {layout.flows.map((f: any, i: number) => {
        const active = hFlow === i || (hComp !== null && (f.from === hComp || f.to === hComp));
        const ci = i % FLOW_COLORS.length;
        return (
          <g key={`f${i}`} onMouseEnter={() => setHFlow(i)} onMouseLeave={() => setHFlow(null)}
            style={{ cursor: "pointer" }}>
            <path d={f.path} fill="none" stroke="transparent" strokeWidth={16} />
            <path d={f.path} fill="none"
              stroke={active ? f.color : "#d4d4d4"}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={active ? "6,3" : "none"}
              markerEnd={active ? `url(#a${ci})` : "url(#ag)"}
              style={{ transition: "all 0.15s" }}
            />
            {f.step != null && (
              <g>
                <rect x={f.midX - 11} y={f.midY - 11} width={22} height={22} rx={5}
                  fill={active ? f.color : "#fb8c00"} />
                <text x={f.midX} y={f.midY + 5} textAnchor="middle"
                  style={{ fontSize: 11, fontWeight: 800, fill: "#fff" }}>
                  {f.step}
                </text>
              </g>
            )}
            {active && f.label && (
              <g>
                <rect x={f.midX - 55} y={f.midY - 30} width={110} height={18} rx={4}
                  fill="#222" opacity={0.92} />
                <text x={f.midX} y={f.midY - 18} textAnchor="middle"
                  style={{ fontSize: 9, fill: "#fff" }}>
                  {f.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Groups */}
      {layout.groups.map((g: any, i: number) => {
        const c = PALETTE[g.category] || PALETTE.processing;
        return (
          <g key={`g${i}`}>
            <rect x={g.x} y={g.y} width={g.w} height={g.h}
              rx={8} fill={c.bg} stroke={c.border} strokeWidth={1.2} opacity={0.7} />
            {/* Header */}
            <rect x={g.x} y={g.y} width={g.w} height={26} rx={8} fill={c.headerBg} opacity={0.8} />
            <rect x={g.x} y={g.y + 18} width={g.w} height={8} fill={c.headerBg} opacity={0.8} />
            {/* Left accent bar */}
            <rect x={g.x} y={g.y} width={4} height={g.h} rx={2} fill={c.accent} />
            <text x={g.x + 14} y={g.y + 18}
              style={{ fontSize: 11, fontWeight: 700, fill: c.header }}>
              {g.name}
            </text>
          </g>
        );
      })}

      {/* Component icons */}
      {Object.entries(layout.comps).map(([id, c]: [string, CompLayout]) => {
        const active = hComp === id ||
          (hFlow !== null && layout.flows[hFlow] &&
            (layout.flows[hFlow].from === id || layout.flows[hFlow].to === id));

        return (
          <g key={id} onMouseEnter={() => setHComp(id)} onMouseLeave={() => setHComp(null)}
            style={{ cursor: "pointer" }}>
            {/* Icon */}
            {c.iconPath ? (
              <image
                href={c.iconPath}
                x={c.cx - ICON_SZ / 2}
                y={c.cy - ICON_SZ / 2}
                width={ICON_SZ}
                height={ICON_SZ}
                filter={active ? "url(#ico-sh-h)" : "url(#ico-sh)"}
                style={{ transition: "filter 0.15s" }}
              />
            ) : (
              <g>
                <rect
                  x={c.cx - 20} y={c.cy - 20}
                  width={40} height={40} rx={8}
                  fill="#e8eaed" stroke="#dadce0" strokeWidth={1}
                  filter={active ? "url(#ico-sh-h)" : "url(#ico-sh)"}
                />
                <text x={c.cx} y={c.cy + 4} textAnchor="middle"
                  style={{ fontSize: 14, fill: "#9aa0a6" }}>?</text>
              </g>
            )}
            {/* Service name */}
            <text x={c.cx} y={c.cy + ICON_SZ / 2 + 14} textAnchor="middle"
              style={{
                fontSize: 10, fontWeight: active ? 600 : 500,
                fill: active ? "#111" : "#444",
                transition: "all 0.15s",
              }}>
              {c.name.length > 16 ? c.name.slice(0, 15) + "…" : c.name}
            </text>
            {/* Subtitle on hover */}
            {active && c.subtitle && (
              <text x={c.cx} y={c.cy + ICON_SZ / 2 + 26} textAnchor="middle"
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

// ─── MAIN DASHBOARD ────────────────────────────────────────
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
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Generation failed");
      }
      const data = await res.json();
      const diag = data.diagram as DiagramData;
      setLayout(computeLayout(diag));
    } catch (e: any) {
      setError(e.message);
    }
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
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: "#212529",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12,
          }}>◇</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#212529" }}>ArchGen</span>
          <span style={{
            fontSize: 9, background: "#f5f5f5", color: "#999",
            padding: "2px 6px", borderRadius: 3, fontWeight: 600,
          }}>BETA</span>
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
          <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1 }}>
            DESCRIBE YOUR SYSTEM
          </div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
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
            {loading && (
              <div style={{
                width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite",
              }} />
            )}
            {loading ? "Generating..." : "Generate Diagram"}
          </button>

          {error && (
            <div style={{
              padding: 10, borderRadius: 6, background: "#fff5f5",
              border: "1px solid #fecaca", color: "#dc2626", fontSize: 12,
            }}>{error}</div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 6 }}>
            TEMPLATES
          </div>
          {SAMPLES.map((s, i) => (
            <button key={i} onClick={() => setPrompt(s.prompt)} style={{
              width: "100%", textAlign: "left", padding: "10px 12px",
              background: "#fafafa", border: "1px solid #f0f0f0",
              borderRadius: 6, cursor: "pointer",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{s.label}</div>
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 3, lineHeight: 1.4 }}>
                {s.prompt.slice(0, 80)}...
              </div>
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

        {/* Canvas */}
        <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#f5f5f5" }}>
          {!layout && !loading && (
            <div style={{
              height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 10,
            }}>
              <div style={{ fontSize: 40, color: "#ddd" }}>◇</div>
              <div style={{ color: "#bbb", fontSize: 13 }}>Describe a system to generate its architecture diagram</div>
            </div>
          )}
          {loading && (
            <div style={{
              height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 16,
            }}>
              <div style={{
                width: 28, height: 28, border: "3px solid #e5e5e5",
                borderTopColor: "#212529", borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }} />
              <div style={{ color: "#999", fontSize: 13 }}>Generating architecture diagram...</div>
            </div>
          )}
          {layout && (
            <div className="fade-up" style={{
              background: "#fff", borderRadius: 8, border: "1px solid #e5e5e5",
              display: "inline-block", minWidth: "100%",
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
