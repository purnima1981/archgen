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

/* ── Types ─────────────────────────────────────────── */
interface NodeDetails { project?: string; region?: string; serviceAccount?: string; iamRoles?: string; encryption?: string; monitoring?: string; retry?: string; alerting?: string; cost?: string; troubleshoot?: string; guardrails?: string; compliance?: string; notes?: string }
interface DiagNode { id: string; name: string; icon?: string | null; subtitle?: string; zone: "sources" | "cloud" | "consumers"; x: number; y: number; details?: NodeDetails }
interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean }
interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean }
interface Threat { id: string; target: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance?: string | null }
interface Diagram { title: string; subtitle?: string; nodes: DiagNode[]; edges: DiagEdge[]; threats?: Threat[] }
const SEV: Record<string, string> = { critical: "#d32f2f", high: "#e65100", medium: "#f9a825", low: "#66bb6a" };

/* ── Popover: Node ─────────────────────────────────── */
function NodePopover({ node, threats, onClose, onChange }: { node: DiagNode; threats: Threat[]; onClose: () => void; onChange: (n: DiagNode) => void }) {
  const [tab, setTab] = useState<"info" | "edit">("info");
  const d = node.details || {};
  const ip = iconUrl(node.name, node.icon || undefined);
  const upD = (k: string, v: string) => onChange({ ...node, details: { ...d, [k]: v } });
  const fields = [
    { k: "project", l: "GCP Project", p: "acme-prod-123" }, { k: "region", l: "Region", p: "us-central1" },
    { k: "serviceAccount", l: "Service Account", p: "sa-name@proj.iam" }, { k: "iamRoles", l: "IAM Roles", p: "roles/..." },
    { k: "encryption", l: "Encryption", p: "CMEK / Google-managed" }, { k: "monitoring", l: "Monitoring", p: "Metrics..." },
    { k: "retry", l: "Retry / Resilience", p: "Strategy, DLQ..." }, { k: "alerting", l: "Alerting", p: "P1→PagerDuty" },
    { k: "cost", l: "Cost", p: "$X/unit" }, { k: "troubleshoot", l: "Troubleshooting", p: "When X check Y" },
    { k: "guardrails", l: "Guardrails", p: "VPC-SC, policies" }, { k: "compliance", l: "Compliance", p: "SOC2, HIPAA" },
    { k: "notes", l: "Notes", p: "Context" },
  ];
  const populated = fields.filter(f => (d as any)[f.k]);
  return (<div style={{ width: 380, maxHeight: 520, background: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.18)", border: "1px solid #e0e0e0", overflow: "hidden", fontFamily: "'Inter',system-ui,sans-serif" }} onClick={e => e.stopPropagation()}>
    <div style={{ padding: "12px 14px 8px", background: "#fafafa", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 10 }}>
      {ip ? <img src={ip} width={30} height={30} alt="" /> : <div style={{ width: 30, height: 30, borderRadius: 8, background: "#eceff1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>☁</div>}
      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{node.name}</div>{node.subtitle && <div style={{ fontSize: 10, color: "#888" }}>{node.subtitle}</div>}</div>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#bbb", cursor: "pointer" }}>×</button></div>
    <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0" }}>
      {(["info", "edit"] as const).map(t => <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "7px 0", fontSize: 11, fontWeight: 600, border: "none", borderBottom: tab === t ? "2px solid #1a73e8" : "2px solid transparent", color: tab === t ? "#1a73e8" : "#999", background: "none", cursor: "pointer" }}>{t === "info" ? "Details" : "Edit"}</button>)}</div>
    <div style={{ padding: 12, overflowY: "auto", maxHeight: 380 }}>
      {tab === "info" ? (<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {populated.length === 0 && <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", padding: 16 }}>No details yet — switch to Edit</div>}
        {populated.map(f => (<div key={f.k} style={{ padding: "7px 9px", background: "#f8f9fa", borderRadius: 6 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: "#999", letterSpacing: .5 }}>{f.l.toUpperCase()}</div>
          <div style={{ fontSize: 11, color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.5, marginTop: 1 }}>{(d as any)[f.k]}</div></div>))}
        {threats.length > 0 && <div style={{ marginTop: 6 }}><div style={{ fontSize: 8, fontWeight: 700, color: "#e53935", letterSpacing: .5, marginBottom: 3 }}>⚠ THREATS</div>
          {threats.map(t => (<div key={t.id} style={{ padding: 7, background: "#fff5f5", borderRadius: 5, marginBottom: 3, borderLeft: `3px solid ${SEV[t.severity]}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: SEV[t.severity] }}>{t.title}</div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{t.description}</div>
            <div style={{ fontSize: 9, color: "#2e7d32", marginTop: 2 }}>Fix: {t.mitigation}</div></div>))}</div>}
      </div>) : (<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 8, fontWeight: 700, color: "#999" }}>NAME</label>
            <input value={node.name} onChange={e => onChange({ ...node, name: e.target.value })} style={{ width: "100%", padding: "4px 6px", border: "1px solid #eee", borderRadius: 4, fontSize: 12, outline: "none", boxSizing: "border-box" }} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 8, fontWeight: 700, color: "#999" }}>SUBTITLE</label>
            <input value={node.subtitle || ""} onChange={e => onChange({ ...node, subtitle: e.target.value })} style={{ width: "100%", padding: "4px 6px", border: "1px solid #eee", borderRadius: 4, fontSize: 12, outline: "none", boxSizing: "border-box" }} /></div></div>
        {fields.map(f => (<div key={f.k}><label style={{ fontSize: 8, fontWeight: 700, color: "#999" }}>{f.l.toUpperCase()}</label>
          <textarea value={(d as any)[f.k] || ""} onChange={e => upD(f.k, e.target.value)} placeholder={f.p} rows={(d as any)[f.k]?.includes?.("\n") ? 3 : 1} style={{ width: "100%", padding: "4px 6px", border: "1px solid #eee", borderRadius: 4, fontSize: 11, outline: "none", resize: "vertical", boxSizing: "border-box" }} /></div>))}
      </div>)}</div></div>);
}

/* ── Popover: Edge ─────────────────────────────────── */
function EdgePopover({ edge, fromNode, toNode, threats, onClose }: { edge: DiagEdge; fromNode?: DiagNode; toNode?: DiagNode; threats: Threat[]; onClose: () => void }) {
  const s = edge.security;
  return (<div style={{ width: 340, background: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.18)", border: "1px solid #e0e0e0", overflow: "hidden", fontFamily: "'Inter',system-ui,sans-serif" }} onClick={e => e.stopPropagation()}>
    <div style={{ padding: "12px 14px 8px", background: "#f5f5ff", borderBottom: "1px solid #e8e8ff", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: "#5c6bc0", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800 }}>{edge.step}</div>
      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{edge.label || "Flow"}</div><div style={{ fontSize: 10, color: "#888" }}>{fromNode?.name} → {toNode?.name}</div></div>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#bbb", cursor: "pointer" }}>×</button></div>
    <div style={{ padding: 12 }}>
      {edge.subtitle && <div style={{ fontSize: 11, color: "#5c6bc0", fontStyle: "italic", marginBottom: 8 }}>{edge.subtitle}</div>}
      {s && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
        {[{ l: "TRANSPORT", v: s.transport }, { l: "AUTH", v: s.auth }, { l: "DATA CLASS", v: s.classification }, { l: "NETWORK", v: s.private ? "🔒 Private" : "🌐 Internet" }].map((item, i) => (
          <div key={i} style={{ padding: 7, background: i === 3 ? (s.private ? "#e8f5e9" : "#fff5f5") : "#f8f9fa", borderRadius: 5 }}>
            <div style={{ fontSize: 7, color: "#999", fontWeight: 700 }}>{item.l}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: i === 3 ? (s.private ? "#2e7d32" : "#c62828") : "#333", marginTop: 1 }}>{item.v}</div></div>))}</div>}
      {edge.crossesBoundary && <div style={{ padding: 5, background: "#fff3e0", borderRadius: 4, fontSize: 10, color: "#e65100", marginBottom: 6 }}>⚡ Crosses trust boundary — authentication required</div>}
      {threats.map(t => (<div key={t.id} style={{ padding: 7, background: "#fff5f5", borderRadius: 5, borderLeft: `3px solid ${SEV[t.severity]}`, marginBottom: 3 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: SEV[t.severity] }}>{t.title}</div>
        <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{t.description}</div>
        <div style={{ fontSize: 9, color: "#2e7d32", marginTop: 2 }}>Fix: {t.mitigation}</div></div>))}</div></div>);
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
    diag.nodes.forEach(n => { x0 = Math.min(x0, n.x - 60); y0 = Math.min(y0, n.y - 60); x1 = Math.max(x1, n.x + 140); y1 = Math.max(y1, n.y + 100); });
    const z = Math.min(r.width / (x1 - x0), r.height / (y1 - y0), 1.5) * 0.82;
    setZoom(z); setPan({ x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: (r.height - (y1 - y0) * z) / 2 - y0 * z });
  }, [diag.nodes]);

  useEffect(() => { setTimeout(fit, 50); }, [diag.nodes.length]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault(); const rc = ref.current?.getBoundingClientRect(); if (!rc) return;
    const mx = e.clientX - rc.left, my = e.clientY - rc.top, f = e.deltaY < 0 ? 1.1 : 0.9, nz = Math.max(0.15, Math.min(3, zoom * f));
    setPan({ x: mx - (mx - pan.x) * (nz / zoom), y: my - (my - pan.y) * (nz / zoom) }); setZoom(nz);
  }, [zoom, pan]);
  const onDown = useCallback((e: React.MouseEvent) => { if (e.button === 0) { isPan.current = true; panS.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; } }, [pan]);
  const onMove = useCallback((e: React.MouseEvent) => {
    if (drag) { const dx = (e.clientX - dragS.current.x) / zoom, dy = (e.clientY - dragS.current.y) / zoom; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDrag.current = true; setDiag({ ...diag, nodes: diag.nodes.map(n => n.id === drag ? { ...n, x: dragS.current.nx + dx, y: dragS.current.ny + dy } : n) }); return; }
    if (isPan.current) setPan({ x: panS.current.px + (e.clientX - panS.current.x), y: panS.current.py + (e.clientY - panS.current.y) });
  }, [drag, diag, zoom, setDiag]);
  const onUp = useCallback(() => { isPan.current = false; if (drag) { setDrag(null); setTimeout(() => { wasDrag.current = false; }, 50); } }, [drag]);
  const startDrag = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const n = diag.nodes.find(x => x.id === id); if (!n) return; wasDrag.current = false; setDrag(id); dragS.current = { x: e.clientX, y: e.clientY, nx: n.x, ny: n.y }; };
  const dblClick = (type: "node" | "edge", id: string, e: React.MouseEvent) => { e.stopPropagation(); if (wasDrag.current) return; const rc = ref.current?.getBoundingClientRect(); if (!rc) return; setPopover({ type, id, px: e.clientX - rc.left, py: e.clientY - rc.top }); };
  const updateNode = (u: DiagNode) => setDiag({ ...diag, nodes: diag.nodes.map(n => n.id === u.id ? u : n) });

  const byZone = (z: string) => diag.nodes.filter(n => n.zone === z);
  const zBounds = (ns: DiagNode[], p: number) => { if (!ns.length) return null; const xs = ns.map(n => n.x), ys = ns.map(n => n.y); return { x: Math.min(...xs) - p, y: Math.min(...ys) - p - 10, w: Math.max(...xs) - Math.min(...xs) + p * 2 + 60, h: Math.max(...ys) - Math.min(...ys) + p * 2 + 80 }; };
  const ortho = (fx: number, fy: number, tx: number, ty: number) => { const r = 34, x1 = fx + r, x4 = tx - r; if (Math.abs(fy - ty) < 6) return `M${x1},${fy} L${x4},${ty}`; const mx = (x1 + x4) / 2; return `M${x1},${fy} L${mx},${fy} L${mx},${ty} L${x4},${ty}`; };
  const SZ = 52;

  return (<div ref={ref} style={{ flex: 1, overflow: "hidden", position: "relative", cursor: drag ? "grabbing" : "grab" }}
    onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onClick={() => setPopover(null)}>
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        <defs>
          <marker id="aG" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 .5,7 3,0 5.5" fill="#43a047" /></marker>
          <marker id="aO" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 .5,7 3,0 5.5" fill="#ff9800" /></marker>
          <marker id="aD" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 .5,7 3,0 5.5" fill="#90a4ae" /></marker>
          <marker id="aB" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 .5,7 3,0 5.5" fill="#1a73e8" /></marker>
        </defs>
        {/* Title */}
        <text x={600} y={36} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: "#111" }}>{diag.title}</text>
        {diag.subtitle && <text x={600} y={54} textAnchor="middle" style={{ fontSize: 10, fill: "#888", fontStyle: "italic" }}>{diag.subtitle}</text>}
        {/* Zones */}
        {[{ ns: byZone("sources"), p: 40, fill: "#fafafa", stroke: "#bdbdbd", dash: "6 3", label: "SOURCES", lc: "#78909c" },
          { ns: byZone("consumers"), p: 40, fill: "#fafafa", stroke: "#bdbdbd", dash: "6 3", label: "CONSUMERS", lc: "#78909c" }
        ].map(({ ns, p, fill, stroke, dash, label, lc }) => { const b = zBounds(ns, p); if (!b) return null; return <g key={label}><rect x={b.x} y={b.y + 40} width={b.w} height={b.h} rx={8} fill={fill} stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} /><text x={b.x + b.w / 2} y={b.y + 56} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: lc, letterSpacing: .5 }}>{label}</text></g>; })}
        {(() => { const ns = byZone("cloud"), b = zBounds(ns, 50); if (!b) return null; return <g><rect x={b.x} y={b.y + 40} width={b.w} height={b.h} rx={10} fill="#f0f7ff" stroke="#4285f4" strokeWidth={1.8} /><g transform={`translate(${b.x + 10},${b.y + 44})`}><rect width={112} height={20} rx={4} fill="#4285f4" /><text x={8} y={14} style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }}>Google Cloud</text></g></g>; })()}
        {/* Edges */}
        {diag.edges.map(edge => {
          const fn = diag.nodes.find(n => n.id === edge.from), tn = diag.nodes.find(n => n.id === edge.to); if (!fn || !tn) return null;
          const path = ortho(fn.x + 30, fn.y, tn.x - 30, tn.y), mx = (fn.x + tn.x) / 2, my = (fn.y + tn.y) / 2;
          const sc = edge.security, col = sc?.private ? "#43a047" : sc ? "#ff9800" : "#90a4ae";
          const sel = popover?.type === "edge" && popover.id === edge.id;
          const mk = sel ? "url(#aB)" : sc?.private ? "url(#aG)" : sc ? "url(#aO)" : "url(#aD)";
          return (<g key={edge.id}>
            <path d={path} fill="none" stroke="transparent" strokeWidth={16} onDoubleClick={e => dblClick("edge", edge.id, e)} style={{ cursor: "pointer" }} />
            <path d={path} fill="none" stroke={sel ? "#1a73e8" : col} strokeWidth={sel ? 2.5 : 1.8} strokeDasharray={sc?.private ? "" : "5 3"} markerEnd={mk} />
            <rect x={mx - 11} y={my - 11} width={22} height={22} rx={5} fill={sel ? "#1a73e8" : "#5c6bc0"} onDoubleClick={e => dblClick("edge", edge.id, e)} style={{ cursor: "pointer" }} />
            <text x={mx} y={my + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "#fff", pointerEvents: "none" }}>{edge.step}</text>
            {edge.crossesBoundary && <g onDoubleClick={e => dblClick("edge", edge.id, e)} style={{ cursor: "pointer" }} transform={`translate(${mx + 15},${my - 6})`}>
              <circle r={7} fill="#fff" stroke={sc?.private ? "#43a047" : "#e53935"} strokeWidth={1.5} />
              <g transform="translate(-3.5,-4) scale(.55)"><rect x={2} y={6} width={10} height={7} rx={1.5} fill={sc?.private ? "#43a047" : "#e53935"} /><path d="M4,6 L4,3 A3,3 0 0,1 10,3 L10,6" fill="none" stroke={sc?.private ? "#43a047" : "#e53935"} strokeWidth={1.8} /></g></g>}
          </g>);
        })}
        {/* Nodes */}
        {diag.nodes.map(node => {
          const ip = iconUrl(node.name, node.icon || undefined), sel = popover?.type === "node" && popover.id === node.id;
          const th = (diag.threats || []).filter(t => t.target === node.id);
          return (<g key={node.id} onMouseDown={e => startDrag(node.id, e)} onDoubleClick={e => dblClick("node", node.id, e)} style={{ cursor: drag === node.id ? "grabbing" : "pointer" }}>
            {sel && <circle cx={node.x} cy={node.y} r={SZ / 2 + 8} fill="none" stroke="#1a73e8" strokeWidth={2} strokeDasharray="4 2" />}
            {ip ? <image href={ip} x={node.x - SZ / 2} y={node.y - SZ / 2} width={SZ} height={SZ} />
              : <g><rect x={node.x - SZ / 2} y={node.y - SZ / 2} width={SZ} height={SZ} rx={10} fill={node.zone === "cloud" ? "#f5f5f5" : "#eceff1"} stroke={node.zone === "cloud" ? "#e0e0e0" : "#90a4ae"} strokeWidth={1.5} /><text x={node.x} y={node.y + 5} textAnchor="middle" style={{ fontSize: 18, fill: "#78909c" }}>☁</text></g>}
            <text x={node.x} y={node.y + SZ / 2 + 14} textAnchor="middle" style={{ fontSize: 10, fontWeight: 600, fill: "#333", pointerEvents: "none" }}>{node.name}</text>
            {node.subtitle && <text x={node.x} y={node.y + SZ / 2 + 25} textAnchor="middle" style={{ fontSize: 8, fill: "#999", pointerEvents: "none" }}>{node.subtitle}</text>}
            {th.length > 0 && <g transform={`translate(${node.x + SZ / 2 - 2},${node.y - SZ / 2 - 2})`}><polygon points="0,-8 -6,2 6,2" fill={SEV[th[0].severity]} stroke="#fff" strokeWidth={1} /><text y={0} textAnchor="middle" style={{ fontSize: 6, fontWeight: 800, fill: "#fff" }}>!</text></g>}
          </g>);
        })}
      </g>
    </svg>
    {/* Popovers */}
    {popover && (() => {
      const cw = ref.current?.clientWidth || 800, ch = ref.current?.clientHeight || 600;
      const px = Math.min(popover.px + 10, cw - 400), py = Math.min(Math.max(popover.py - 60, 10), ch - 400);
      if (popover.type === "node") { const n = diag.nodes.find(x => x.id === popover.id); if (!n) return null; return <div style={{ position: "absolute", left: px, top: py, zIndex: 100 }}><NodePopover node={n} threats={(diag.threats || []).filter(t => t.target === n.id)} onClose={() => setPopover(null)} onChange={updateNode} /></div>; }
      if (popover.type === "edge") { const e = diag.edges.find(x => x.id === popover.id); if (!e) return null; return <div style={{ position: "absolute", left: px, top: py, zIndex: 100 }}><EdgePopover edge={e} fromNode={diag.nodes.find(n => n.id === e.from)} toNode={diag.nodes.find(n => n.id === e.to)} threats={(diag.threats || []).filter(t => t.target === e.id)} onClose={() => setPopover(null)} /></div>; }
      return null;
    })()}
    {/* Controls */}
    <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 4 }}>
      <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} style={{ width: 30, height: 30, borderRadius: 6, background: "#fff", border: "1px solid #e0e0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
      <button onClick={() => setZoom(z => Math.max(.15, z * .8))} style={{ width: 30, height: 30, borderRadius: 6, background: "#fff", border: "1px solid #e0e0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
      <button onClick={fit} style={{ height: 30, padding: "0 10px", borderRadius: 6, background: "#fff", border: "1px solid #e0e0e0", fontSize: 11, cursor: "pointer" }}>⊞ Fit</button>
      <div style={{ height: 30, padding: "0 8px", borderRadius: 6, background: "rgba(0,0,0,.5)", color: "#fff", fontSize: 10, display: "flex", alignItems: "center" }}>{Math.round(zoom * 100)}%</div>
    </div>
    <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,.5)", color: "#fff", padding: "5px 12px", borderRadius: 16, fontSize: 10 }}>Scroll to zoom · Drag to pan · Double-click for details</div>
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter','DM Sans',system-ui,sans-serif", background: "#fafafa" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}textarea:focus{border-color:#1a73e8!important}`}</style>
      <div style={{ height: 48, padding: "0 16px", background: "#fff", borderBottom: "1px solid #e5e5e5", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: "#1a73e8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11 }}>◇</div>
        <span style={{ fontSize: 14, fontWeight: 700 }}>ArchGen</span>
        {diag && <span style={{ fontSize: 12, color: "#888" }}>— {diag.title}</span>}
        {source && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: source === "template" ? "#e8f5e9" : "#fff3e0", color: source === "template" ? "#2e7d32" : "#e65100", fontWeight: 600 }}>{source === "template" ? "⚡ Template" : "🤖 AI Generated"}</span>}
        <div style={{ flex: 1 }} />
        {diag && <button onClick={() => { setDiag(null); setPopover(null); setError(""); setSource(null); }} style={{ padding: "4px 10px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>← New</button>}
        <span style={{ fontSize: 11, color: "#aaa" }}>{user.firstName || user.email}</span>
        <button onClick={() => logout()} style={{ padding: "4px 10px", background: "none", border: "1px solid #e5e5e5", borderRadius: 6, fontSize: 11, color: "#999", cursor: "pointer" }}>Logout</button>
      </div>

      {!diag && !loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 560, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <div style={{ fontSize: 48, color: "#e0e0e0" }}>◇</div>
            <div style={{ color: "#555", fontSize: 16, fontWeight: 600 }}>Describe the architecture you need</div>
            <div style={{ color: "#bbb", fontSize: 12 }}>Natural language — we'll find the right template instantly</div>
            <div style={{ width: "100%", display: "flex", gap: 8 }}>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); } }} placeholder='e.g. "streaming analytics on GCP" or "migrate from AWS RDS to BigQuery"...' rows={2} style={{ flex: 1, padding: "10px 14px", border: "1px solid #ddd", borderRadius: 10, fontSize: 13, outline: "none", resize: "none", lineHeight: 1.5, background: "#fff" }} />
              <button onClick={generate} disabled={!prompt.trim()} style={{ padding: "0 20px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: prompt.trim() ? 1 : .4, whiteSpace: "nowrap" }}>Generate</button>
            </div>
            {error && <div style={{ padding: 8, borderRadius: 6, background: "#fff5f5", border: "1px solid #fecaca", color: "#dc2626", fontSize: 11, width: "100%" }}>{error}</div>}
            <div style={{ color: "#bbb", fontSize: 11, marginTop: 8 }}>or try one of these</div>
            <div style={{ display: "flex", gap: 12 }}>
              {[{ icon: "📊", name: "Streaming Analytics", p: "streaming analytics pipeline on GCP" },
                { icon: "🔄", name: "CDC Migration", p: "migrate data from AWS RDS to BigQuery using CDC" },
                { icon: "🤖", name: "RAG Chatbot", p: "RAG chatbot with document search and Gemini" },
              ].map((t, i) => (
                <button key={i} onClick={() => { setPrompt(t.p); setTimeout(() => { /* auto-submit */ const btn = document.querySelector('[data-gen]') as HTMLButtonElement; if (btn) btn.click(); }, 50); }}
                  style={{ padding: "14px 18px", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.04)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 160, transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.1)"; e.currentTarget.style.borderColor = "#1a73e8"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.04)"; e.currentTarget.style.borderColor = "#e0e0e0"; }}>
                  <span style={{ fontSize: 28 }}>{t.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{t.name}</span></button>))}
            </div>
          </div>
        </div>
      ) : loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 28, height: 28, border: "3px solid #e5e5e5", borderTopColor: "#1a73e8", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
          <div style={{ color: "#999", fontSize: 13 }}>Finding the right architecture...</div>
        </div>
      ) : diag ? <Canvas diag={diag} setDiag={setDiag} popover={popover} setPopover={setPopover} /> : null}
    </div>
  );
}
