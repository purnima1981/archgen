import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

/* ── Icons ─────────────────────────────────────────── */
interface IconEntry { id: string; name: string; path: string; aliases: string[] }
let IC: IconEntry[] = [];
async function loadIcons() { if (IC.length) return; try { IC = (await (await fetch("/icons/registry.json")).json()).icons || []; } catch {} }
function iconUrl(n: string, h?: string): string | null {
  const l = (h || n).toLowerCase().trim();
  const m = IC.find(i => i.id === l) || IC.find(i => i.name.toLowerCase() === l) || IC.find(i => i.aliases.some(a => a === l || l.includes(a) || a.includes(l)));
  return m ? `/icons/gcp/${m.id}.svg` : null;
}

/* ── Category Colors (GCP-inspired) ──────────────── */
const CAT: Record<string, { bg: string; border: string }> = {
  apigee_api_platform: { bg: "#e8eaf6", border: "#5c6bc0" },
  cloud_api_gateway:   { bg: "#e8eaf6", border: "#5c6bc0" },
  pubsub:              { bg: "#e3f2fd", border: "#1e88e5" },
  dataflow:            { bg: "#e3f2fd", border: "#1565c0" },
  bigquery:            { bg: "#e3f2fd", border: "#1565c0" },
  cloud_run:           { bg: "#e0f2f1", border: "#00897b" },
  cloud_functions:     { bg: "#e0f2f1", border: "#00897b" },
  looker:              { bg: "#ede7f6", border: "#7e57c2" },
  datastream:          { bg: "#e3f2fd", border: "#1e88e5" },
  data_catalog:        { bg: "#e3f2fd", border: "#1e88e5" },
  cloud_storage:       { bg: "#e8f5e9", border: "#43a047" },
  cloud_sql:           { bg: "#e8f5e9", border: "#43a047" },
  firestore:           { bg: "#e8f5e9", border: "#43a047" },
  bigtable:            { bg: "#e8f5e9", border: "#43a047" },
  memorystore:         { bg: "#e8f5e9", border: "#43a047" },
  cloud_vpn:           { bg: "#fff8e1", border: "#f9a825" },
  cloud_interconnect:  { bg: "#fff8e1", border: "#f9a825" },
  cloud_armor:         { bg: "#fff8e1", border: "#f9a825" },
  virtual_private_cloud: { bg: "#fff8e1", border: "#f9a825" },
  cloud_natural_language_api: { bg: "#fce4ec", border: "#e53935" },
  vertexai:            { bg: "#f3e5f5", border: "#8e24aa" },
  document_ai:         { bg: "#f3e5f5", border: "#8e24aa" },
  cloud_monitoring:    { bg: "#eceff1", border: "#546e7a" },
  cloud_logging:       { bg: "#eceff1", border: "#546e7a" },
  cloud_scheduler:     { bg: "#eceff1", border: "#546e7a" },
  identity_platform:   { bg: "#fff8e1", border: "#f9a825" },
};
const DEFAULT_CAT = { bg: "#f5f5f5", border: "#bdbdbd" };
function getCat(iconId?: string | null) { return (iconId && CAT[iconId]) || DEFAULT_CAT; }

/* ── Types ─────────────────────────────────────────── */
interface NodeDetails { project?: string; region?: string; serviceAccount?: string; iamRoles?: string; encryption?: string; monitoring?: string; retry?: string; alerting?: string; cost?: string; troubleshoot?: string; guardrails?: string; compliance?: string; notes?: string }
interface DiagNode { id: string; name: string; icon?: string | null; subtitle?: string; zone: "sources" | "cloud" | "consumers"; x: number; y: number; details?: NodeDetails }
interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean }
interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean; edgeType?: "data" | "control" | "observe" }
interface Threat { id: string; target: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance?: string | null }
interface Diagram { title: string; subtitle?: string; nodes: DiagNode[]; edges: DiagEdge[]; threats?: Threat[] }
const SEV: Record<string, string> = { critical: "#d32f2f", high: "#e65100", medium: "#f9a825", low: "#66bb6a" };

/* ── Security Indicators ───────────────────────────── */
interface Indicator { type: "encrypt" | "authn" | "authz" | "network"; color: string; tip: string }
function getIndicators(sec?: EdgeSecurity): Indicator[] {
  if (!sec) return [];
  const ind: Indicator[] = [];
  const t = sec.transport.toLowerCase(), a = sec.auth.toLowerCase();
  if (t.includes("tls") || t.includes("ssl") || t.includes("ipsec") || t.includes("internal") || t.includes("grpc") || t.includes("private") || t.includes("dedicated"))
    ind.push({ type: "encrypt", color: "#1a73e8", tip: sec.transport });
  if (a.includes("oauth") || a.includes("jwt") || a.includes("api key") || a.includes("firebase") || a.includes("cert") || a.includes("token") || a.includes("saml") || a.includes("credential") || a.includes("secret"))
    ind.push({ type: "authn", color: "#f9a825", tip: sec.auth });
  if (a.includes("workload identity") || a.includes("iam") || a.includes("rbac") || a.includes("sso") || a.includes("mfa") || a.includes("db auth"))
    ind.push({ type: "authz", color: "#34a853", tip: "IAM/RBAC" });
  ind.push({ type: "network", color: sec.private ? "#34a853" : "#ea4335", tip: sec.private ? "Private VPC" : "Internet" });
  return ind;
}

/* ── Popover: Node ─────────────────────────────────── */
function NodePopover({ node, threats, onClose }: { node: DiagNode; threats: Threat[]; onClose: () => void }) {
  const d = node.details || {};
  const ip = iconUrl(node.name, node.icon || undefined);
  const fields = [
    { k: "project", l: "GCP Project" }, { k: "region", l: "Region" }, { k: "serviceAccount", l: "Service Account" },
    { k: "iamRoles", l: "IAM Roles" }, { k: "encryption", l: "Encryption" }, { k: "monitoring", l: "Monitoring" },
    { k: "retry", l: "Retry / Resilience" }, { k: "alerting", l: "Alerting" }, { k: "cost", l: "Cost" },
    { k: "troubleshoot", l: "Troubleshooting" }, { k: "guardrails", l: "Guardrails" },
    { k: "compliance", l: "Compliance" }, { k: "notes", l: "Notes" },
  ];
  const populated = fields.filter(f => (d as any)[f.k]);
  return (<div style={{ width: 380, maxHeight: 520, background: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.18)", border: "1px solid #e0e0e0", overflow: "hidden", fontFamily: "'Inter',system-ui,sans-serif" }} onClick={e => e.stopPropagation()}>
    <div style={{ padding: "12px 14px 8px", background: "#fafafa", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 10 }}>
      {ip ? <img src={ip} width={30} height={30} alt="" /> : <div style={{ width: 30, height: 30, borderRadius: 8, background: "#eceff1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>☁</div>}
      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{node.name}</div>{node.subtitle && <div style={{ fontSize: 10, color: "#888" }}>{node.subtitle}</div>}</div>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#bbb", cursor: "pointer" }}>×</button></div>
    <div style={{ padding: 12, overflowY: "auto", maxHeight: 420 }}>
      {populated.length === 0 && <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", padding: 16 }}>No operational details for this component</div>}
      {populated.map(f => (<div key={f.k} style={{ padding: "7px 9px", background: "#f8f9fa", borderRadius: 6, marginBottom: 4 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#999", letterSpacing: .5 }}>{f.l.toUpperCase()}</div>
        <div style={{ fontSize: 11, color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.5, marginTop: 1 }}>{(d as any)[f.k]}</div></div>))}
      {threats.length > 0 && <div style={{ marginTop: 6 }}><div style={{ fontSize: 8, fontWeight: 700, color: "#e53935", letterSpacing: .5, marginBottom: 3 }}>⚠ THREATS</div>
        {threats.map(t => (<div key={t.id} style={{ padding: 7, background: "#fff5f5", borderRadius: 5, marginBottom: 3, borderLeft: `3px solid ${SEV[t.severity]}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: SEV[t.severity] }}>{t.title}</div>
          <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{t.description}</div>
          <div style={{ fontSize: 9, color: "#2e7d32", marginTop: 2 }}>Fix: {t.mitigation}</div></div>))}</div>}
    </div></div>);
}

/* ── Popover: Edge ─────────────────────────────────── */
function EdgePopover({ edge, fromNode, toNode, threats, onClose }: { edge: DiagEdge; fromNode?: DiagNode; toNode?: DiagNode; threats: Threat[]; onClose: () => void }) {
  const s = edge.security;
  const indicators = getIndicators(s);
  return (<div style={{ width: 360, background: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.18)", border: "1px solid #e0e0e0", overflow: "hidden", fontFamily: "'Inter',system-ui,sans-serif" }} onClick={e => e.stopPropagation()}>
    <div style={{ padding: "12px 14px 8px", background: "#f5f5ff", borderBottom: "1px solid #e8e8ff", display: "flex", alignItems: "center", gap: 8 }}>
      {edge.step > 0 && <div style={{ width: 28, height: 28, borderRadius: 6, background: "#5c6bc0", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>{edge.step}</div>}
      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{edge.label || "Flow"}</div><div style={{ fontSize: 10, color: "#888" }}>{fromNode?.name} → {toNode?.name}</div></div>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#bbb", cursor: "pointer" }}>×</button></div>
    <div style={{ padding: 12 }}>
      {edge.subtitle && <div style={{ fontSize: 11, color: "#5c6bc0", fontStyle: "italic", marginBottom: 8 }}>{edge.subtitle}</div>}
      {indicators.length > 0 && <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {indicators.map((ind, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 12, background: ind.color + "18", border: `1px solid ${ind.color}44` }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: ind.color }} />
          <span style={{ fontSize: 9, fontWeight: 600, color: ind.color }}>{ind.tip}</span></div>))}
      </div>}
      {s && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
        {[{ l: "TRANSPORT", v: s.transport }, { l: "AUTH", v: s.auth }, { l: "DATA CLASS", v: s.classification }, { l: "NETWORK", v: s.private ? "🔒 Private VPC" : "🌐 Internet" }].map((item, i) => (
          <div key={i} style={{ padding: 7, background: i === 3 ? (s.private ? "#e8f5e9" : "#fff5f5") : "#f8f9fa", borderRadius: 5 }}>
            <div style={{ fontSize: 7, color: "#999", fontWeight: 700 }}>{item.l}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: i === 3 ? (s.private ? "#2e7d32" : "#c62828") : "#333", marginTop: 1 }}>{item.v}</div></div>))}</div>}
      {edge.crossesBoundary && <div style={{ padding: 5, background: "#fff3e0", borderRadius: 4, fontSize: 10, color: "#e65100", marginBottom: 6 }}>⚡ Crosses trust boundary</div>}
      {threats.map(t => (<div key={t.id} style={{ padding: 7, background: "#fff5f5", borderRadius: 5, borderLeft: `3px solid ${SEV[t.severity]}`, marginBottom: 3 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: SEV[t.severity] }}>{t.title}</div>
        <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{t.description}</div>
        <div style={{ fontSize: 9, color: "#2e7d32", marginTop: 2 }}>Fix: {t.mitigation}</div></div>))}</div></div>);
}

/* ── SVG Indicator Icons ───────────────────────────── */
function IndicatorIcons({ indicators, x, y }: { indicators: Indicator[]; x: number; y: number }) {
  if (!indicators.length) return null;
  const R = 8, GAP = 19;
  const startX = x - ((indicators.length - 1) * GAP) / 2;
  return (<g>
    {indicators.map((ind, i) => {
      const cx = startX + i * GAP, cy = y;
      return (<g key={i} transform={`translate(${cx},${cy})`}>
        <circle r={R} fill="#fff" stroke={ind.color} strokeWidth={1.5} />
        {ind.type === "encrypt" && <g transform="scale(0.55)">
          <rect x={-3.5} y={0} width={7} height={5.5} rx={1.2} fill={ind.color} />
          <path d={`M-2,0 L-2,-2.8 A2,2 0 0,1 2,-2.8 L2,0`} fill="none" stroke={ind.color} strokeWidth={1.8} />
        </g>}
        {ind.type === "authn" && <g transform="scale(0.55)">
          <circle cx={0} cy={-2} r={2.2} fill="none" stroke={ind.color} strokeWidth={1.8} />
          <line x1={0} y1={0} x2={0} y2={4} stroke={ind.color} strokeWidth={1.8} />
          <line x1={0} y1={3} x2={2} y2={2} stroke={ind.color} strokeWidth={1.5} />
        </g>}
        {ind.type === "authz" && <g transform="scale(0.55)">
          <path d="M0,-4.5 L4,0 L2.5,5 L-2.5,5 L-4,0 Z" fill="none" stroke={ind.color} strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M-1.2,0.5 L0,1.8 L2.5,-1.5" fill="none" stroke={ind.color} strokeWidth={1.5} strokeLinecap="round" />
        </g>}
        {ind.type === "network" && (ind.color === "#34a853"
          ? <g transform="scale(0.55)">
            <path d="M-3.5,1.5 Q-3.5,-1 -1,-2 Q0,-3.5 1.5,-2.5 Q3.5,-3 3.5,0 Q4.5,1.5 3,1.5 Z" fill={ind.color} stroke="none" />
          </g>
          : <g transform="scale(0.55)">
            <circle cx={0} cy={0} r={3.8} fill="none" stroke={ind.color} strokeWidth={1.5} />
            <line x1={-3.8} y1={0} x2={3.8} y2={0} stroke={ind.color} strokeWidth={1} />
            <ellipse cx={0} cy={0} rx={1.8} ry={3.8} fill="none" stroke={ind.color} strokeWidth={1} />
          </g>
        )}
      </g>);
    })}
  </g>);
}

/* ═══ SVG CANVAS ═══════════════════════════════════ */
function Canvas({ diag, setDiag, popover, setPopover }: { diag: Diagram; setDiag: (d: Diagram) => void; popover: any; setPopover: (p: any) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<string | null>(null);
  const isPan = useRef(false), panS = useRef({ x: 0, y: 0, px: 0, py: 0 }), dragS = useRef({ x: 0, y: 0, nx: 0, ny: 0 }), wasDrag = useRef(false);

  const fit = useCallback(() => {
    if (!ref.current || !diag.nodes.length) return;
    const r = ref.current.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    diag.nodes.forEach(n => { x0 = Math.min(x0, n.x - 90); y0 = Math.min(y0, n.y - 90); x1 = Math.max(x1, n.x + 170); y1 = Math.max(y1, n.y + 130); });
    const z = Math.min(r.width / (x1 - x0), r.height / (y1 - y0), 1.3) * 0.82;
    setZoom(z); setPan({ x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: (r.height - (y1 - y0) * z) / 2 - y0 * z });
  }, [diag.nodes]);
  useEffect(() => { setTimeout(fit, 80); }, [diag.nodes.length]);

  const onWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); const rc = ref.current?.getBoundingClientRect(); if (!rc) return; const mx = e.clientX - rc.left, my = e.clientY - rc.top, f = e.deltaY < 0 ? 1.1 : 0.9, nz = Math.max(0.1, Math.min(3, zoom * f)); setPan({ x: mx - (mx - pan.x) * (nz / zoom), y: my - (my - pan.y) * (nz / zoom) }); setZoom(nz); }, [zoom, pan]);
  const onDown = useCallback((e: React.MouseEvent) => { if (e.button === 0) { isPan.current = true; panS.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; } }, [pan]);
  const onMove = useCallback((e: React.MouseEvent) => { if (drag) { const dx = (e.clientX - dragS.current.x) / zoom, dy = (e.clientY - dragS.current.y) / zoom; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDrag.current = true; setDiag({ ...diag, nodes: diag.nodes.map(n => n.id === drag ? { ...n, x: dragS.current.nx + dx, y: dragS.current.ny + dy } : n) }); return; } if (isPan.current) setPan({ x: panS.current.px + (e.clientX - panS.current.x), y: panS.current.py + (e.clientY - panS.current.y) }); }, [drag, diag, zoom, setDiag]);
  const onUp = useCallback(() => { isPan.current = false; if (drag) { setDrag(null); setTimeout(() => { wasDrag.current = false; }, 50); } }, [drag]);
  const startDrag = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const n = diag.nodes.find(x => x.id === id); if (!n) return; wasDrag.current = false; setDrag(id); dragS.current = { x: e.clientX, y: e.clientY, nx: n.x, ny: n.y }; };
  const dblClick = (type: "node" | "edge", id: string, e: React.MouseEvent) => { e.stopPropagation(); if (wasDrag.current) return; const rc = ref.current?.getBoundingClientRect(); if (!rc) return; setPopover({ type, id, px: e.clientX - rc.left, py: e.clientY - rc.top }); };

  const byZone = (z: string) => diag.nodes.filter(n => n.zone === z);
  const zBounds = (ns: DiagNode[], padX: number, padY: number, minW?: number) => { if (!ns.length) return null; const xs = ns.map(n => n.x), ys = ns.map(n => n.y); return { x: Math.min(...xs) - padX - 10, y: Math.min(...ys) - padY, w: Math.max(Math.max(...xs) - Math.min(...xs) + padX * 2 + 80, minW || 0), h: Math.max(...ys) - Math.min(...ys) + padY * 2 + 90 }; };

  const ortho = (fx: number, fy: number, tx: number, ty: number) => {
    const gx = 38;
    const x1 = fx + gx, x4 = tx - gx;
    if (Math.abs(fy - ty) < 12) return `M${x1},${fy} L${x4},${ty}`;
    const mx = (x1 + x4) / 2;
    return `M${x1},${fy} L${mx},${fy} L${mx},${ty} L${x4},${ty}`;
  };
  const orthoVert = (fx: number, fy: number, tx: number, ty: number) => {
    const gy = 38;
    const ySrc = fy - gy, yTgt = ty + gy;
    if (Math.abs(fx - tx) < 12) return `M${fx},${ySrc} L${tx},${yTgt}`;
    const my = (ySrc + yTgt) / 2;
    return `M${fx},${ySrc} L${fx},${my} L${tx},${my} L${tx},${yTgt}`;
  };

  const ICON_SZ = 50; // icon image size
  const BG_SZ = 68;   // background rect size

  const srcNodes = byZone("sources"), cloudNodes = byZone("cloud"), conNodes = byZone("consumers");
  const srcB = zBounds(srcNodes, 65, 65, 170);
  const cloudB = zBounds(cloudNodes, 65, 55);
  const conB = zBounds(conNodes, 65, 65, 170);
  const allXs = diag.nodes.map(n => n.x);
  const centerX = allXs.length ? (Math.min(...allXs) + Math.max(...allXs)) / 2 : 600;
  const topY = Math.min(...diag.nodes.map(n => n.y)) - 90;

  return (<div ref={ref} style={{ flex: 1, overflow: "hidden", position: "relative", cursor: drag ? "grabbing" : "grab", background: "#f8f9fa" }}
    onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onClick={() => setPopover(null)}>
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        <defs>
          <marker id="aG" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#43a047" /></marker>
          <marker id="aO" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#e65100" /></marker>
          <marker id="aD" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#90a4ae" /></marker>
          <marker id="aB" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#1a73e8" /></marker>
          <marker id="aC" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#7986cb" /></marker>
          <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity=".08" /></filter>
        </defs>

        {/* Title */}
        <text x={centerX} y={topY} textAnchor="middle" style={{ fontSize: 24, fontWeight: 800, fill: "#111", letterSpacing: -.3 }}>{diag.title}</text>
        {diag.subtitle && <text x={centerX} y={topY + 22} textAnchor="middle" style={{ fontSize: 11, fill: "#999", fontStyle: "italic" }}>{diag.subtitle}</text>}

        {/* Source zone */}
        {srcB && <g><rect x={srcB.x} y={srcB.y} width={srcB.w} height={srcB.h} rx={12} fill="#fafafa" stroke="#bdbdbd" strokeWidth={1.5} strokeDasharray="8 4" /><text x={srcB.x + srcB.w / 2} y={srcB.y + 18} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: "#78909c", letterSpacing: 2 }}>SOURCES</text></g>}

        {/* Cloud zone */}
        {cloudB && <g><rect x={cloudB.x} y={cloudB.y} width={cloudB.w} height={cloudB.h} rx={14} fill="#f5f9ff" stroke="#4285f4" strokeWidth={2} />
          <g transform={`translate(${cloudB.x + cloudB.w / 2 - 60},${cloudB.y - 14})`}><rect width={120} height={28} rx={6} fill="#4285f4" /><text x={60} y={19} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: "#fff", letterSpacing: .5 }}>Google Cloud</text></g></g>}

        {/* Consumer zone */}
        {conB && <g><rect x={conB.x} y={conB.y} width={conB.w} height={conB.h} rx={12} fill="#fafafa" stroke="#bdbdbd" strokeWidth={1.5} strokeDasharray="8 4" /><text x={conB.x + conB.w / 2} y={conB.y + 18} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: "#78909c", letterSpacing: 2 }}>CONSUMERS</text></g>}

        {/* ── Edges ── */}
        {diag.edges.map(edge => {
          const fn = diag.nodes.find(n => n.id === edge.from), tn = diag.nodes.find(n => n.id === edge.to); if (!fn || !tn) return null;
          const isControl = edge.edgeType === "control", isObserve = edge.edgeType === "observe", isOps = isControl || isObserve;
          const isVert = Math.abs(fn.y - tn.y) > Math.abs(fn.x - tn.x);
          const path = isVert ? orthoVert(fn.x, fn.y, tn.x, tn.y) : ortho(fn.x, fn.y, tn.x, tn.y);
          const mx = (fn.x + tn.x) / 2, my = (fn.y + tn.y) / 2;
          const sc = edge.security, sel = popover?.type === "edge" && popover.id === edge.id;
          let col: string, dash: string, width: number, mk: string;
          if (sel) { col = "#1a73e8"; dash = ""; width = 3; mk = "url(#aB)"; }
          else if (isControl) { col = "#7986cb"; dash = "5 5"; width = 1.5; mk = "url(#aC)"; }
          else if (isObserve) { col = "#90a4ae"; dash = "3 5"; width = 1; mk = "url(#aD)"; }
          else if (sc?.private) { col = "#43a047"; dash = ""; width = 2; mk = "url(#aG)"; }
          else if (sc) { col = "#e65100"; dash = "6 4"; width = 2; mk = "url(#aO)"; }
          else { col = "#90a4ae"; dash = "5 4"; width = 1.5; mk = "url(#aD)"; }
          const indicators = !isOps ? getIndicators(sc) : [];

          return (<g key={edge.id}>
            <path d={path} fill="none" stroke="transparent" strokeWidth={20} onDoubleClick={e => dblClick("edge", edge.id, e)} style={{ cursor: "pointer" }} />
            <path d={path} fill="none" stroke={col} strokeWidth={width} strokeDasharray={dash} markerEnd={mk} />

            {/* Step badge — large filled rounded square */}
            {edge.step > 0 && !isOps && <>
              <rect x={mx - 15} y={my - 15} width={30} height={30} rx={7} fill={sel ? "#1a73e8" : "#5c6bc0"} filter="url(#nodeShadow)" onDoubleClick={e => dblClick("edge", edge.id, e)} style={{ cursor: "pointer" }} />
              <text x={mx} y={my + 5.5} textAnchor="middle" style={{ fontSize: 15, fontWeight: 900, fill: "#fff", pointerEvents: "none" }}>{edge.step}</text>
            </>}

            {/* Security indicators row — positioned between source and step badge */}
            {indicators.length > 0 && !isOps && (() => {
              const indX = (fn.x + mx) / 2 + 20;
              const indY = isVert ? (fn.y + my) / 2 : my - 24;
              return <IndicatorIcons indicators={indicators} x={isVert ? mx + 24 : indX} y={isVert ? indY : my} />;
            })()}

            {/* Control/observe label */}
            {isOps && edge.label && <text x={mx + (isVert ? 14 : 0)} y={my + (isVert ? 0 : -10)} textAnchor="middle" style={{ fontSize: 9, fill: "#7986cb", fontStyle: "italic", pointerEvents: "none" }}>{edge.label}</text>}
          </g>);
        })}

        {/* ── Nodes ── */}
        {diag.nodes.map(node => {
          const ip = iconUrl(node.name, node.icon || undefined);
          const sel = popover?.type === "node" && popover.id === node.id;
          const th = (diag.threats || []).filter(t => t.target === node.id);
          const cat = getCat(node.icon);
          return (<g key={node.id} onMouseDown={e => startDrag(node.id, e)} onDoubleClick={e => dblClick("node", node.id, e)} style={{ cursor: drag === node.id ? "grabbing" : "pointer" }}>
            {/* Selection ring */}
            {sel && <rect x={node.x - BG_SZ / 2 - 6} y={node.y - BG_SZ / 2 - 6} width={BG_SZ + 12} height={BG_SZ + 12} rx={18} fill="none" stroke="#1a73e8" strokeWidth={2.5} strokeDasharray="5 3" />}

            {/* Category colored background */}
            <rect x={node.x - BG_SZ / 2} y={node.y - BG_SZ / 2} width={BG_SZ} height={BG_SZ} rx={14}
              fill={ip ? cat.bg : (node.zone === "cloud" ? "#f5f5f5" : "#e8eaf6")}
              stroke={ip ? cat.border : (node.zone === "cloud" ? "#e0e0e0" : "#9fa8da")}
              strokeWidth={sel ? 2.5 : 1.8} filter="url(#nodeShadow)" />

            {/* Icon or fallback */}
            {ip ? <image href={ip} x={node.x - ICON_SZ / 2} y={node.y - ICON_SZ / 2} width={ICON_SZ} height={ICON_SZ} />
              : <text x={node.x} y={node.y + 7} textAnchor="middle" style={{ fontSize: 24, fill: "#5c6bc0" }}>☁</text>}

            {/* Labels */}
            <text x={node.x} y={node.y + BG_SZ / 2 + 16} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "#222", pointerEvents: "none" }}>{node.name}</text>
            {node.subtitle && <text x={node.x} y={node.y + BG_SZ / 2 + 29} textAnchor="middle" style={{ fontSize: 9, fill: "#888", pointerEvents: "none" }}>{node.subtitle}</text>}

            {/* Threat indicator */}
            {th.length > 0 && <g transform={`translate(${node.x + BG_SZ / 2 - 4},${node.y - BG_SZ / 2 - 4})`}>
              <polygon points="0,-10 -8,3 8,3" fill={SEV[th[0].severity]} stroke="#fff" strokeWidth={2} />
              <text y={0} textAnchor="middle" style={{ fontSize: 8, fontWeight: 900, fill: "#fff" }}>!</text>
            </g>}
          </g>);
        })}
      </g>
    </svg>

    {/* Popovers */}
    {popover && (() => {
      const cw = ref.current?.clientWidth || 800, ch = ref.current?.clientHeight || 600;
      const px = Math.min(popover.px + 10, cw - 400), py = Math.min(Math.max(popover.py - 60, 10), ch - 400);
      if (popover.type === "node") { const n = diag.nodes.find(x => x.id === popover.id); if (!n) return null; return <div style={{ position: "absolute", left: px, top: py, zIndex: 100 }}><NodePopover node={n} threats={(diag.threats || []).filter(t => t.target === n.id)} onClose={() => setPopover(null)} /></div>; }
      if (popover.type === "edge") { const e = diag.edges.find(x => x.id === popover.id); if (!e) return null; return <div style={{ position: "absolute", left: px, top: py, zIndex: 100 }}><EdgePopover edge={e} fromNode={diag.nodes.find(n => n.id === e.from)} toNode={diag.nodes.find(n => n.id === e.to)} threats={(diag.threats || []).filter(t => t.target === e.id)} onClose={() => setPopover(null)} /></div>; }
      return null;
    })()}

    {/* Legend */}
    <div style={{ position: "absolute", top: 12, right: 12, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10, padding: "10px 14px", fontSize: 10, display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 8, fontWeight: 800, color: "#999", letterSpacing: 1, marginBottom: 2 }}>CONNECTIONS</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 22, height: 2.5, background: "#43a047", borderRadius: 1 }} /><span style={{ color: "#555" }}>Private (VPC)</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 22, height: 0, borderTop: "2.5px dashed #e65100" }} /><span style={{ color: "#555" }}>Internet-facing</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 22, height: 0, borderTop: "1.5px dashed #7986cb" }} /><span style={{ color: "#555" }}>Control flow</span></div>
      <div style={{ fontSize: 8, fontWeight: 800, color: "#999", letterSpacing: 1, marginTop: 4, marginBottom: 2 }}>SECURITY</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width={16} height={16}><circle cx={8} cy={8} r={7} fill="#fff" stroke="#1a73e8" strokeWidth={1.5} /><g transform="translate(8,8) scale(0.55)"><rect x={-3.5} y={0} width={7} height={5.5} rx={1.2} fill="#1a73e8" /><path d="M-2,0 L-2,-2.8 A2,2 0 0,1 2,-2.8 L2,0" fill="none" stroke="#1a73e8" strokeWidth={1.8} /></g></svg><span style={{ color: "#555" }}>Encrypted</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width={16} height={16}><circle cx={8} cy={8} r={7} fill="#fff" stroke="#f9a825" strokeWidth={1.5} /><g transform="translate(8,8) scale(0.55)"><circle cx={0} cy={-2} r={2.2} fill="none" stroke="#f9a825" strokeWidth={1.8} /><line x1={0} y1={0} x2={0} y2={4} stroke="#f9a825" strokeWidth={1.8} /><line x1={0} y1={3} x2={2} y2={2} stroke="#f9a825" strokeWidth={1.5} /></g></svg><span style={{ color: "#555" }}>Auth (OAuth/JWT)</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width={16} height={16}><circle cx={8} cy={8} r={7} fill="#fff" stroke="#34a853" strokeWidth={1.5} /><g transform="translate(8,8) scale(0.55)"><path d="M0,-4.5 L4,0 L2.5,5 L-2.5,5 L-4,0 Z" fill="none" stroke="#34a853" strokeWidth={1.8} strokeLinejoin="round" /><path d="M-1.2,0.5 L0,1.8 L2.5,-1.5" fill="none" stroke="#34a853" strokeWidth={1.5} strokeLinecap="round" /></g></svg><span style={{ color: "#555" }}>IAM / RBAC</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width={16} height={16}><circle cx={8} cy={8} r={7} fill="#fff" stroke="#ea4335" strokeWidth={1.5} /><g transform="translate(8,8) scale(0.55)"><circle cx={0} cy={0} r={3.8} fill="none" stroke="#ea4335" strokeWidth={1.5} /><line x1={-3.8} y1={0} x2={3.8} y2={0} stroke="#ea4335" strokeWidth={1} /><ellipse cx={0} cy={0} rx={1.8} ry={3.8} fill="none" stroke="#ea4335" strokeWidth={1} /></g></svg><span style={{ color: "#555" }}>Internet</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width={16} height={16}><circle cx={8} cy={8} r={7} fill="#fff" stroke="#34a853" strokeWidth={1.5} /><g transform="translate(8,8) scale(0.55)"><path d="M-3.5,1.5 Q-3.5,-1 -1,-2 Q0,-3.5 1.5,-2.5 Q3.5,-3 3.5,0 Q4.5,1.5 3,1.5 Z" fill="#34a853" /></g></svg><span style={{ color: "#555" }}>Private VPC</span></div>
    </div>

    {/* Controls */}
    <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 5 }}>
      <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", border: "1px solid #e0e0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>+</button>
      <button onClick={() => setZoom(z => Math.max(.1, z * .8))} style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", border: "1px solid #e0e0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>−</button>
      <button onClick={fit} style={{ height: 32, padding: "0 12px", borderRadius: 8, background: "#fff", border: "1px solid #e0e0e0", fontSize: 11, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>⊞ Fit</button>
      <div style={{ height: 32, padding: "0 10px", borderRadius: 8, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center" }}>{Math.round(zoom * 100)}%</div>
    </div>
    <div style={{ position: "absolute", bottom: 14, right: 14, background: "rgba(0,0,0,.55)", color: "#fff", padding: "6px 14px", borderRadius: 20, fontSize: 10 }}>Scroll to zoom · Drag to pan · Double-click for details</div>
  </div>);
}

/* ═══ MAIN DASHBOARD ═══════════════════════════════ */
export default function Dashboard({ user }: { user: User }) {
  const { logout } = useAuth();
  const [diag, setDiag] = useState<Diagram | null>(null);
  const [popover, setPopover] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => { loadIcons() }, []);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return; setLoading(true); setError(""); setDiag(null); setPopover(null); setSource(null);
    try {
      const res = await fetch("/api/diagrams/generate", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ prompt }) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = await res.json();
      setDiag(data.diagram as Diagram); setSource(data.source);
    } catch (e: any) { setError(e.message) } setLoading(false);
  }, [prompt]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter','DM Sans',system-ui,sans-serif", background: "#f8f9fa" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}textarea:focus{border-color:#1a73e8!important}`}</style>
      <div style={{ height: 52, padding: "0 18px", background: "#fff", borderBottom: "1px solid #e5e5e5", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: "#1a73e8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 800 }}>◇</div>
        <span style={{ fontSize: 15, fontWeight: 800 }}>ArchGen</span>
        {diag && <span style={{ fontSize: 12, color: "#888" }}>— {diag.title}</span>}
        {source && <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: source === "template" ? "#e8f5e9" : "#fff3e0", color: source === "template" ? "#2e7d32" : "#e65100", fontWeight: 700 }}>{source === "template" ? "⚡ Template" : "🤖 AI Generated"}</span>}
        <div style={{ flex: 1 }} />
        {diag && <button onClick={() => { setDiag(null); setPopover(null); setError(""); setSource(null); }} style={{ padding: "5px 12px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>← New</button>}
        <span style={{ fontSize: 11, color: "#aaa" }}>{user.firstName || user.email}</span>
        <button onClick={() => logout()} style={{ padding: "5px 12px", background: "none", border: "1px solid #e5e5e5", borderRadius: 7, fontSize: 11, color: "#999", cursor: "pointer" }}>Logout</button>
      </div>

      {!diag && !loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 560, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
            <div style={{ fontSize: 52, color: "#e0e0e0" }}>◇</div>
            <div style={{ color: "#444", fontSize: 18, fontWeight: 700 }}>Describe the architecture you need</div>
            <div style={{ color: "#bbb", fontSize: 12 }}>Natural language — we'll find the right template instantly</div>
            <div style={{ width: "100%", display: "flex", gap: 8 }}>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); } }} placeholder='e.g. "streaming analytics on GCP" or "migrate from AWS RDS to BigQuery"...' rows={2} style={{ flex: 1, padding: "12px 16px", border: "1px solid #ddd", borderRadius: 12, fontSize: 14, outline: "none", resize: "none", lineHeight: 1.5, background: "#fff" }} />
              <button onClick={generate} disabled={!prompt.trim()} style={{ padding: "0 22px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: prompt.trim() ? 1 : .4, whiteSpace: "nowrap" }}>Generate</button>
            </div>
            {error && <div style={{ padding: 10, borderRadius: 8, background: "#fff5f5", border: "1px solid #fecaca", color: "#dc2626", fontSize: 11, width: "100%" }}>{error}</div>}
            <div style={{ color: "#bbb", fontSize: 11, marginTop: 8 }}>or try one of these</div>
            <div style={{ display: "flex", gap: 14 }}>
              {[{ icon: "📊", name: "Streaming Analytics", p: "streaming analytics pipeline on GCP" },
                { icon: "🔄", name: "CDC Migration", p: "migrate data from AWS RDS to BigQuery using CDC" },
                { icon: "🤖", name: "RAG Chatbot", p: "RAG chatbot with document search and Gemini" },
              ].map((t, i) => (
                <button key={i} onClick={() => setPrompt(t.p)}
                  style={{ padding: "16px 20px", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.04)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 165, transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,.1)"; e.currentTarget.style.borderColor = "#1a73e8"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.04)"; e.currentTarget.style.borderColor = "#e0e0e0"; e.currentTarget.style.transform = "none"; }}>
                  <span style={{ fontSize: 32 }}>{t.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{t.name}</span></button>))}
            </div>
          </div>
        </div>
      ) : loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 32, height: 32, border: "3px solid #e5e5e5", borderTopColor: "#1a73e8", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
          <div style={{ color: "#999", fontSize: 14 }}>Finding the right architecture...</div>
        </div>
      ) : diag ? <Canvas diag={diag} setDiag={setDiag} popover={popover} setPopover={setPopover} /> : null}
    </div>
  );
}
