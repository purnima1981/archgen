import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";
import { ServicePalette, EnhancedNodePopover, EditingToolbar, GCP_SERVICES } from "../components/diagram-editor-components";

/* ── Icons ─────────────────────────────────────────── */
interface IconEntry { id: string; name: string; path: string; aliases: string[] }
let IC: IconEntry[] = [];
async function loadIcons() { if (IC.length) return; try { IC = (await (await fetch("/icons/registry.json")).json()).icons || []; } catch {} }
function iconUrl(n: string, h?: string): string | null {
  const l = (h || n).toLowerCase().trim();
  const m = IC.find(i => i.id === l) || IC.find(i => i.name.toLowerCase() === l) || IC.find(i => i.aliases.some(a => a === l || l.includes(a) || a.includes(l)));
  return m ? `/icons/gcp/${m.id}.svg` : null;
}

/* ── Category Colors ──────────────────────────────── */
const CAT: Record<string, { bg: string; border: string }> = {
  apigee_api_platform: { bg: "#e8eaf6", border: "#5c6bc0" }, pubsub: { bg: "#e3f2fd", border: "#1e88e5" },
  dataflow: { bg: "#e3f2fd", border: "#1565c0" }, bigquery: { bg: "#e3f2fd", border: "#1565c0" },
  cloud_run: { bg: "#e0f2f1", border: "#00897b" }, cloud_functions: { bg: "#e0f2f1", border: "#00897b" },
  looker: { bg: "#ede7f6", border: "#7e57c2" }, datastream: { bg: "#e3f2fd", border: "#1e88e5" },
  data_catalog: { bg: "#e3f2fd", border: "#1e88e5" }, cloud_storage: { bg: "#e8f5e9", border: "#43a047" },
  cloud_sql: { bg: "#e8f5e9", border: "#43a047" }, memorystore: { bg: "#e8f5e9", border: "#43a047" },
  cloud_vpn: { bg: "#fff8e1", border: "#f9a825" }, cloud_interconnect: { bg: "#fff8e1", border: "#f9a825" },
  cloud_natural_language_api: { bg: "#fce4ec", border: "#e53935" }, vertexai: { bg: "#f3e5f5", border: "#8e24aa" },
  document_ai: { bg: "#f3e5f5", border: "#8e24aa" }, cloud_monitoring: { bg: "#eceff1", border: "#546e7a" },
  cloud_logging: { bg: "#eceff1", border: "#546e7a" }, cloud_scheduler: { bg: "#eceff1", border: "#546e7a" },
  identity_platform: { bg: "#fff8e1", border: "#f9a825" },
};
const DEF_CAT = { bg: "#f5f5f5", border: "#bdbdbd" };
function getCat(ic?: string | null) { return (ic && CAT[ic]) || DEF_CAT; }

/* ── Types ────────────────────────────────────────── */
interface NodeDetails { project?: string; region?: string; serviceAccount?: string; iamRoles?: string; encryption?: string; monitoring?: string; retry?: string; alerting?: string; cost?: string; troubleshoot?: string; guardrails?: string; compliance?: string; notes?: string }
interface DiagNode { id: string; name: string; icon?: string | null; subtitle?: string; zone: "sources" | "cloud" | "consumers"; x: number; y: number; details?: NodeDetails }
interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean }
interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean; edgeType?: "data" | "control" | "observe" | "alert" }
interface Threat { id: string; target: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance?: string | null }
interface Phase { id: string; name: string; nodeIds: string[] }
interface OpsGroup { name: string; nodeIds: string[] }
interface Diagram { title: string; subtitle?: string; nodes: DiagNode[]; edges: DiagEdge[]; threats?: Threat[]; phases?: Phase[]; opsGroup?: OpsGroup }

const SEV: Record<string, string> = { critical: "#b71c1c", high: "#e53935", medium: "#fb8c00", low: "#fdd835" };
const THEMES: Record<string, { label: string; bg: string; grid?: boolean; gridColor?: string }> = {
  light: { label: "Light", bg: "#f8f9fa" },
  dotgrid: { label: "Dot Grid", bg: "#ffffff", grid: true, gridColor: "#e0e0e0" },
  blueprint: { label: "Blueprint", bg: "#0a1929", grid: true, gridColor: "#1a3a5c" },
  dark: { label: "Dark", bg: "#1e1e1e", grid: true, gridColor: "#333" },
};

/* ── Gate: boundary crossing point ────────────────── */
interface Gate { id: string; edgeId: string; x: number; y: number; direction: "in" | "out"; security: EdgeSecurity; fromName: string; toName: string; label: string }

/* ── Edge Popover ──────────────────────────────────── */
function EdgePop({ edge, fn, tn, threats, onClose }: { edge: DiagEdge; fn?: DiagNode; tn?: DiagNode; threats: Threat[]; onClose: () => void }) {
  const s = edge.security;
  return (<div style={{ width: 350, background: "#fff", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.2)", border: "1px solid #e8e8e8", overflow: "hidden", fontFamily: "'Inter',system-ui,sans-serif" }} onClick={e => e.stopPropagation()}>
    <div style={{ padding: "14px 16px 10px", background: "linear-gradient(135deg,#f5f5ff,#eee8ff)", borderBottom: "1px solid #e8e8ff", display: "flex", alignItems: "center", gap: 8 }}>
      {edge.step > 0 && <div style={{ width: 30, height: 30, borderRadius: 8, background: "#5c6bc0", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 900 }}>{edge.step}</div>}
      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{edge.label || "Connection"}</div><div style={{ fontSize: 10, color: "#888" }}>{fn?.name} → {tn?.name}</div></div>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#ccc", cursor: "pointer" }}>×</button></div>
    <div style={{ padding: "10px 14px" }}>
      {s && [{ l: "Transport", v: s.transport, c: "#1565c0" }, { l: "Authentication", v: s.auth, c: "#f57f17" }, { l: "Classification", v: s.classification, c: "#6a1b9a" }, { l: "Network", v: s.private ? "Private VPC" : "Internet / Public", c: s.private ? "#2e7d32" : "#c62828" }].map(f => (
        <div key={f.l} style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6, marginBottom: 4, borderLeft: `3px solid ${f.c}` }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: "#aaa", letterSpacing: .8 }}>{f.l.toUpperCase()}</div>
          <div style={{ fontSize: 11, color: "#333" }}>{f.v}</div></div>))}
      {edge.subtitle && <div style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6, marginTop: 4 }}><div style={{ fontSize: 8, fontWeight: 800, color: "#aaa", letterSpacing: .8 }}>DETAIL</div><div style={{ fontSize: 10, color: "#555" }}>{edge.subtitle}</div></div>}
      {threats.length > 0 && <div style={{ marginTop: 8 }}>{threats.map(t => (<div key={t.id} style={{ padding: 8, background: "#fff5f5", borderRadius: 6, marginBottom: 4, borderLeft: `3px solid ${SEV[t.severity]}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: SEV[t.severity] }}>{t.title}</div>
        <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{t.description}</div>
        <div style={{ fontSize: 9, color: "#2e7d32", marginTop: 3 }}>✓ {t.mitigation}</div></div>))}</div>}
    </div></div>);
}

/* ── Gate Popover (Boundary Security) ─────────────── */
function GatePop({ gate, threats, onClose }: { gate: Gate; threats: Threat[]; onClose: () => void }) {
  const s = gate.security;
  const isPrivate = s.private;
  return (<div style={{ width: 370, background: "#fff", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.25)", border: "1px solid #e8e8e8", overflow: "hidden", fontFamily: "'Inter',system-ui,sans-serif" }} onClick={e => e.stopPropagation()}>
    <div style={{ padding: "14px 16px 10px", background: gate.direction === "in" ? "linear-gradient(135deg,#e8f5e9,#c8e6c9)" : "linear-gradient(135deg,#fff3e0,#ffe0b2)", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: isPrivate ? "#2e7d32" : "#e65100", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{isPrivate ? "🔒" : "🌐"}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Trust Boundary {gate.direction === "in" ? "Entry" : "Exit"}</div>
        <div style={{ fontSize: 10, color: "#666" }}>{gate.fromName} → {gate.toName}</div>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#999", cursor: "pointer", lineHeight: 1 }}>×</button>
    </div>
    <div style={{ padding: "10px 14px", maxHeight: 380, overflowY: "auto" }}>
      {[{ l: "Transport / Encryption", v: s.transport, icon: "🔐", c: "#1565c0" },
        { l: "Authentication", v: s.auth, icon: "🔑", c: "#f57f17" },
        { l: "Data Classification", v: s.classification, icon: "🏷️", c: "#6a1b9a" },
        { l: "Network Boundary", v: isPrivate ? "Private VPC — no internet exposure" : "Internet — public endpoint", icon: isPrivate ? "☁️" : "🌍", c: isPrivate ? "#2e7d32" : "#c62828" },
      ].map(f => (
        <div key={f.l} style={{ padding: "8px 10px", background: "#f8f9fa", borderRadius: 8, marginBottom: 5, borderLeft: `3px solid ${f.c}` }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: "#aaa", letterSpacing: .8, marginBottom: 2 }}>{f.icon} {f.l.toUpperCase()}</div>
          <div style={{ fontSize: 11, color: "#333", lineHeight: 1.5 }}>{f.v}</div></div>))}
      {/* Exfiltration risk */}
      <div style={{ padding: "8px 10px", background: "#fff5f5", borderRadius: 8, marginBottom: 5, borderLeft: "3px solid #e53935" }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#e53935", letterSpacing: .8, marginBottom: 2 }}>⚠️ EXFILTRATION RISK</div>
        <div style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>{!isPrivate ? "Public endpoint — stolen credentials allow data extraction. Monitor for anomalous egress volume." : "VPC-internal — lateral movement required. Lower risk but monitor for insider threats."}</div>
      </div>
      {/* Guardrails */}
      <div style={{ padding: "8px 10px", background: "#e8f5e9", borderRadius: 8, marginBottom: 5, borderLeft: "3px solid #43a047" }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#2e7d32", letterSpacing: .8, marginBottom: 2 }}>🛡️ GUARDRAILS</div>
        <div style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>{isPrivate ? "VPC Service Controls, Private Google Access, no external IPs, DLP inline scan" : `Rate limiting, API quota, OAuth scope restriction, ${s.auth.includes("MFA") || s.auth.includes("SAML") ? "MFA enforced" : "recommend MFA"}`}</div>
      </div>
      {/* Compromise scenario */}
      <div style={{ padding: "8px 10px", background: "#fff8e1", borderRadius: 8, marginBottom: 5, borderLeft: "3px solid #f9a825" }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#f57f17", letterSpacing: .8, marginBottom: 2 }}>💥 COMPROMISE SCENARIO</div>
        <div style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>{!isPrivate ? `Attacker with stolen ${s.auth.split(" ")[0]} token can access data until token expires. Mitigation: short-lived tokens, IP binding, anomaly detection.` : "Requires compromised workload inside VPC. Blast radius limited by IAM least-privilege and VPC-SC perimeter."}</div>
      </div>
      {threats.length > 0 && threats.map(t => (<div key={t.id} style={{ padding: 8, background: "#fff5f5", borderRadius: 6, marginBottom: 4, borderLeft: `3px solid ${SEV[t.severity]}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: SEV[t.severity] }}>{t.title}</div>
        <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{t.description}</div>
        <div style={{ fontSize: 9, color: "#2e7d32", marginTop: 3 }}>✓ {t.mitigation}</div></div>))}
    </div></div>);
}

/* ═══ HIGHLIGHTS TAB ══════════════════════════════ */
function HighlightsTab({ diag }: { diag: Diagram }) {
  const dataEdges = diag.edges.filter(e => e.edgeType === "data" || !e.edgeType);
  const threats = diag.threats || [];
  const costNodes = diag.nodes.filter(n => n.details?.cost);
  const complianceSet = new Set<string>();
  diag.nodes.forEach(n => { if (n.details?.compliance) n.details.compliance.split(",").map(c => c.trim()).forEach(c => complianceSet.add(c)); });
  const cloudNodes = diag.nodes.filter(n => n.zone === "cloud");
  const srcNodes = diag.nodes.filter(n => n.zone === "sources");
  const conNodes = diag.nodes.filter(n => n.zone === "consumers");

  return (<div style={{ padding: "24px 28px", overflowY: "auto", height: "100%", fontFamily: "'Inter',system-ui,sans-serif" }}>
    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>{diag.title}</h2>
    {diag.subtitle && <p style={{ fontSize: 12, color: "#999", margin: "0 0 24px", fontStyle: "italic" }}>{diag.subtitle}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
      {[{ v: cloudNodes.length, l: "Cloud Services", icon: "☁️", color: "#1a73e8", bg: "#e8f0fe" }, { v: dataEdges.length, l: "Data Flows", icon: "🔗", color: "#34a853", bg: "#e6f4ea" }, { v: threats.length, l: "Threats", icon: "⚠️", color: "#ea4335", bg: "#fce8e6" }, { v: srcNodes.length + conNodes.length, l: "Endpoints", icon: "🔌", color: "#f9ab00", bg: "#fef7e0" }].map((s, i) => (
        <div key={i} style={{ padding: 16, background: s.bg, borderRadius: 12, textAlign: "center" }}><div style={{ fontSize: 24 }}>{s.icon}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.v}</div><div style={{ fontSize: 10, fontWeight: 600, color: "#888", marginTop: 2 }}>{s.l}</div></div>))}
    </div>
    {diag.phases && <div style={{ marginBottom: 28 }}><h3 style={{ fontSize: 13, fontWeight: 800, color: "#555", letterSpacing: .5, marginBottom: 12 }}>ARCHITECTURE PHASES</h3>
      <div style={{ display: "flex", gap: 8 }}>{diag.phases.map((p, i) => (<div key={p.id} style={{ flex: 1, padding: 14, background: "#f8f9fa", borderRadius: 10, border: "1px solid #eee" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><div style={{ width: 24, height: 24, borderRadius: 6, background: "#5c6bc0", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{i + 1}</div><span style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{p.name}</span></div>
        {p.nodeIds.map(nid => { const n = diag.nodes.find(x => x.id === nid); return n ? <div key={nid} style={{ fontSize: 10, color: "#666", padding: "2px 0", display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: getCat(n.icon).border }} />{n.name}</div> : null; })}
      </div>))}</div></div>}
    {costNodes.length > 0 && <div style={{ marginBottom: 28 }}><h3 style={{ fontSize: 13, fontWeight: 800, color: "#555", letterSpacing: .5, marginBottom: 12 }}>COST BREAKDOWN</h3>
      <div style={{ background: "#f8f9fa", borderRadius: 10, overflow: "hidden", border: "1px solid #eee" }}>{costNodes.map(n => (<div key={n.id} style={{ padding: "10px 14px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>{n.name}</span><span style={{ fontSize: 11, color: "#1a73e8", fontWeight: 600 }}>{n.details?.cost}</span></div>))}</div></div>}
    {complianceSet.size > 0 && <div style={{ marginBottom: 28 }}><h3 style={{ fontSize: 13, fontWeight: 800, color: "#555", letterSpacing: .5, marginBottom: 12 }}>COMPLIANCE</h3><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Array.from(complianceSet).map(c => (<div key={c} style={{ padding: "5px 12px", borderRadius: 20, background: "#e8f5e9", border: "1px solid #a5d6a7", fontSize: 11, fontWeight: 700, color: "#2e7d32" }}>{c}</div>))}</div></div>}
    {threats.length > 0 && <div><h3 style={{ fontSize: 13, fontWeight: 800, color: "#555", letterSpacing: .5, marginBottom: 12 }}>THREAT MODEL</h3>
      {threats.map(t => (<div key={t.id} style={{ padding: 12, background: "#fff", borderRadius: 10, border: "1px solid #eee", marginBottom: 8, borderLeft: `4px solid ${SEV[t.severity]}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><span style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{t.title}</span><span style={{ fontSize: 9, fontWeight: 700, color: SEV[t.severity], padding: "2px 8px", borderRadius: 10, background: SEV[t.severity] + "18" }}>{t.severity.toUpperCase()}</span></div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>{t.description}</div><div style={{ fontSize: 10, color: "#2e7d32" }}>✓ {t.mitigation}</div></div>))}</div>}
  </div>);
}

/* ═══ FLOW TAB ════════════════════════════════════ */
function FlowTab({ diag }: { diag: Diagram }) {
  const dataEdges = diag.edges.filter(e => (e.edgeType === "data" || !e.edgeType) && e.step > 0).sort((a, b) => a.step - b.step);
  const sourceEdges = diag.edges.filter(e => (e.edgeType === "data" || !e.edgeType) && e.step === 0 && e.crossesBoundary);

  return (<div style={{ padding: "24px 28px", overflowY: "auto", height: "100%", fontFamily: "'Inter',system-ui,sans-serif" }}>
    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>Data Flow</h2>
    <p style={{ fontSize: 12, color: "#999", margin: "0 0 24px", fontStyle: "italic" }}>End-to-end data journey through the architecture</p>
    {sourceEdges.length > 0 && <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: "#e8eaf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📡</div><div><div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Entry Points</div><div style={{ fontSize: 10, color: "#999" }}>Parallel data sources — no sequence order</div></div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 14, borderLeft: "2px solid #e0e0e0", paddingLeft: 16 }}>
        {sourceEdges.map(e => { const fn = diag.nodes.find(n => n.id === e.from), tn = diag.nodes.find(n => n.id === e.to), sec = e.security;
          return (<div key={e.id} style={{ padding: "10px 14px", background: "#fafafa", borderRadius: 8, border: "1px solid #f0f0f0" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{fn?.name} → {tn?.name}</div>
            <div style={{ fontSize: 10, color: "#5c6bc0", marginTop: 2 }}>{e.label}</div>
            {sec && <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 8, background: "#e3f2fd", color: "#1565c0", fontWeight: 600 }}>{sec.transport}</span>
              <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 8, background: "#fff8e1", color: "#f57f17", fontWeight: 600 }}>{sec.auth}</span>
              <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 8, background: sec.private ? "#e8f5e9" : "#fce4ec", color: sec.private ? "#2e7d32" : "#c62828", fontWeight: 600 }}>{sec.private ? "Private" : "Internet"}</span></div>}
          </div>); })}
      </div></div>}
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: "#e3f2fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔄</div><div><div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Processing Pipeline</div><div style={{ fontSize: 10, color: "#999" }}>Sequential data flow through cloud services</div></div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginLeft: 14 }}>
        {dataEdges.map((e, i) => { const fn = diag.nodes.find(n => n.id === e.from), tn = diag.nodes.find(n => n.id === e.to), sec = e.security, isLast = i === dataEdges.length - 1;
          return (<div key={e.id} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><div style={{ width: 32, height: 32, borderRadius: 8, background: e.crossesBoundary ? "#e65100" : "#5c6bc0", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, flexShrink: 0 }}>{e.step}</div>{!isLast && <div style={{ width: 2, flex: 1, background: "#e0e0e0", minHeight: 16 }} />}</div>
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{fn?.name} → {tn?.name}</div>
              <div style={{ fontSize: 11, color: "#5c6bc0", marginTop: 2 }}>{e.label}</div>
              {e.subtitle && <div style={{ fontSize: 10, color: "#999", marginTop: 2, fontStyle: "italic" }}>{e.subtitle}</div>}
              {sec && <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 8, background: "#e3f2fd", color: "#1565c0", fontWeight: 600 }}>{sec.transport}</span>
                <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 8, background: "#fff8e1", color: "#f57f17", fontWeight: 600 }}>{sec.auth}</span>
                <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 8, background: sec.private ? "#e8f5e9" : "#fce4ec", color: sec.private ? "#2e7d32" : "#c62828", fontWeight: 600 }}>{sec.private ? "Private" : "Internet"}</span></div>}
              {e.crossesBoundary && <div style={{ fontSize: 9, color: "#e65100", marginTop: 4, fontWeight: 600 }}>⚡ Crosses trust boundary</div>}
            </div></div>); })}
      </div></div>
    {diag.opsGroup && <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: "#eceff1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚙️</div><div><div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{diag.opsGroup.name}</div><div style={{ fontSize: 10, color: "#999" }}>Spans entire pipeline</div></div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: 14 }}>{diag.opsGroup.nodeIds.map(nid => { const n = diag.nodes.find(x => x.id === nid); return n ? (<div key={nid} style={{ padding: "8px 14px", background: "#f8f9fa", borderRadius: 8, border: "1px solid #eee" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#333" }}>{n.name}</div><div style={{ fontSize: 9, color: "#888" }}>{n.subtitle}</div>{n.details?.alerting && <div style={{ fontSize: 9, color: "#e65100", marginTop: 4 }}>{n.details.alerting.split("\n")[0]}</div>}</div>) : null; })}</div>
    </div>}
  </div>);
}

/* ═══ SVG CANVAS ═══════════════════════════════════ */
function DiagramCanvas({ diag, setDiag, popover, setPopover, theme }: { diag: Diagram; setDiag: (d: Diagram) => void; popover: any; setPopover: (p: any) => void; theme: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<string | null>(null);
  const [groupDrag, setGroupDrag] = useState<{ ids: string[]; sx: number; sy: number; starts: Record<string, { x: number; y: number }> } | null>(null);
  const isPan = useRef(false), panS = useRef({ x: 0, y: 0, px: 0, py: 0 }), dragS = useRef({ x: 0, y: 0, nx: 0, ny: 0 }), wasDrag = useRef(false);
  const diagRef = useRef(diag); diagRef.current = diag;
  const th = THEMES[theme] || THEMES.light;
  const isDark = theme === "blueprint" || theme === "dark";

  const fit = useCallback(() => {
    if (!ref.current || !diag.nodes.length) return;
    const r = ref.current.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    diag.nodes.forEach(n => { x0 = Math.min(x0, n.x - 100); y0 = Math.min(y0, n.y - 100); x1 = Math.max(x1, n.x + 180); y1 = Math.max(y1, n.y + 140); });
    const z = Math.min(r.width / (x1 - x0), r.height / (y1 - y0), 1.2) * 0.85;
    setZoom(z); setPan({ x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: (r.height - (y1 - y0) * z) / 2 - y0 * z });
  }, [diag.nodes]);
  useEffect(() => { setTimeout(fit, 80); }, [diag.nodes.length]);

  const onWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); const rc = ref.current?.getBoundingClientRect(); if (!rc) return; const mx = e.clientX - rc.left, my = e.clientY - rc.top, f = e.deltaY < 0 ? 1.1 : 0.9, nz = Math.max(0.08, Math.min(3, zoom * f)); setPan({ x: mx - (mx - pan.x) * (nz / zoom), y: my - (my - pan.y) * (nz / zoom) }); setZoom(nz); }, [zoom, pan]);
  const onDown = useCallback((e: React.MouseEvent) => { if (e.button === 0) { isPan.current = true; panS.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; } }, [pan]);

  const onMove = useCallback((e: React.MouseEvent) => {
    // Node drag
    if (drag) {
      const dx = (e.clientX - dragS.current.x) / zoom, dy = (e.clientY - dragS.current.y) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDrag.current = true;
      const cur = diagRef.current;
      setDiag({ ...cur, nodes: cur.nodes.map(n => n.id === drag ? { ...n, x: dragS.current.nx + dx, y: dragS.current.ny + dy } : n) });
      return;
    }
    // Group drag
    if (groupDrag) {
      const dx = (e.clientX - groupDrag.sx) / zoom, dy = (e.clientY - groupDrag.sy) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDrag.current = true;
      const cur = diagRef.current;
      setDiag({ ...cur, nodes: cur.nodes.map(n => {
        const s = groupDrag.starts[n.id];
        return s ? { ...n, x: s.x + dx, y: s.y + dy } : n;
      }) });
      return;
    }
    // Pan
    if (isPan.current) setPan({ x: panS.current.px + (e.clientX - panS.current.x), y: panS.current.py + (e.clientY - panS.current.y) });
  }, [drag, groupDrag, zoom, setDiag]);

  const onUp = useCallback(() => {
    isPan.current = false;
    if (drag) { setDrag(null); setTimeout(() => { wasDrag.current = false; }, 50); }
    if (groupDrag) { setGroupDrag(null); setTimeout(() => { wasDrag.current = false; }, 50); }
  }, [drag, groupDrag]);

  const startDrag = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const n = diag.nodes.find(x => x.id === id); if (!n) return; wasDrag.current = false; setDrag(id); dragS.current = { x: e.clientX, y: e.clientY, nx: n.x, ny: n.y }; };

  const startGroupDrag = (nodeIds: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    wasDrag.current = false;
    const starts: Record<string, { x: number; y: number }> = {};
    nodeIds.forEach(id => { const n = diag.nodes.find(x => x.id === id); if (n) starts[id] = { x: n.x, y: n.y }; });
    setGroupDrag({ ids: nodeIds, sx: e.clientX, sy: e.clientY, starts });
  };

  const dblClick = (type: "node" | "edge" | "gate", id: string, e: React.MouseEvent) => { e.stopPropagation(); if (wasDrag.current) return; const rc = ref.current?.getBoundingClientRect(); if (!rc) return; setPopover({ type, id, px: e.clientX - rc.left, py: e.clientY - rc.top }); };

  const updateNode = (id: string, patch: Partial<DiagNode>) => { setDiag({ ...diag, nodes: diag.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }); };

  const byZone = (z: string) => diag.nodes.filter(n => n.zone === z);
  const zBounds = (ns: DiagNode[], px: number, py: number, minW?: number) => { if (!ns.length) return null; const xs = ns.map(n => n.x), ys = ns.map(n => n.y); return { x: Math.min(...xs) - px - 10, y: Math.min(...ys) - py, w: Math.max(Math.max(...xs) - Math.min(...xs) + px * 2 + 80, minW || 0), h: Math.max(...ys) - Math.min(...ys) + py * 2 + 100 }; };
  const ortho = (fx: number, fy: number, tx: number, ty: number) => { const g = 40, x1 = fx + g, x4 = tx - g; if (Math.abs(fy - ty) < 14) return `M${x1},${fy} L${x4},${ty}`; const mx = (x1 + x4) / 2; return `M${x1},${fy} L${mx},${fy} L${mx},${ty} L${x4},${ty}`; };
  const orthoV = (fx: number, fy: number, tx: number, ty: number) => { const g = 40, ys = fy - g, yt = ty + g; if (Math.abs(fx - tx) < 14) return `M${fx},${ys} L${tx},${yt}`; const my = (ys + yt) / 2; return `M${fx},${ys} L${fx},${my} L${tx},${my} L${tx},${yt}`; };

  const BG = 68, ICO = 50;
  const srcB = zBounds(byZone("sources"), 65, 65, 170);
  const cloudB = zBounds(byZone("cloud"), 65, 55);
  const conB = zBounds(byZone("consumers"), 65, 65, 170);
  const allXs = diag.nodes.map(n => n.x);
  const cx = allXs.length ? (Math.min(...allXs) + Math.max(...allXs)) / 2 : 600;
  const topY = Math.min(...diag.nodes.map(n => n.y)) - 100;

  // Phase group bounds
  const phaseBounds = (diag.phases || []).map(p => {
    const ns = p.nodeIds.map(id => diag.nodes.find(n => n.id === id)).filter(Boolean) as DiagNode[];
    if (!ns.length) return null;
    const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
    return { ...p, x: Math.min(...xs) - 50, y: Math.min(...ys) - 45, w: Math.max(...xs) - Math.min(...xs) + 140, h: Math.max(...ys) - Math.min(...ys) + 140 };
  }).filter(Boolean) as (Phase & { x: number; y: number; w: number; h: number })[];

  // Ops group bounds
  let opsBound: { x: number; y: number; w: number; h: number } | null = null;
  if (diag.opsGroup) {
    const ns = diag.opsGroup.nodeIds.map(id => diag.nodes.find(n => n.id === id)).filter(Boolean) as DiagNode[];
    if (ns.length) {
      const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
      opsBound = { x: Math.min(...xs) - 60, y: Math.min(...ys) - 45, w: Math.max(...xs) - Math.min(...xs) + 180, h: Math.max(...ys) - Math.min(...ys) + 130 };
    }
  }

  // Compute boundary gates
  const gates: Gate[] = [];
  if (cloudB) {
    diag.edges.filter(e => e.crossesBoundary && e.security).forEach(edge => {
      const fn = diag.nodes.find(n => n.id === edge.from), tn = diag.nodes.find(n => n.id === edge.to);
      if (!fn || !tn || !edge.security) return;
      const srcIn = fn.zone === "sources" && tn.zone === "cloud";
      const cloudOut = fn.zone === "cloud" && tn.zone === "consumers";
      if (srcIn) gates.push({ id: `gate-${edge.id}`, edgeId: edge.id, x: cloudB.x, y: fn.y, direction: "in", security: edge.security!, fromName: fn.name, toName: tn.name, label: edge.label || "" });
      if (cloudOut) gates.push({ id: `gate-${edge.id}`, edgeId: edge.id, x: cloudB.x + cloudB.w, y: fn.y, direction: "out", security: edge.security!, fromName: fn.name, toName: tn.name, label: edge.label || "" });
    });
  }

  return (<div ref={ref} style={{ flex: 1, overflow: "hidden", position: "relative", cursor: drag || groupDrag ? "grabbing" : "grab", background: th.bg }}
    onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onClick={() => setPopover(null)}>
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      {th.grid && <defs><pattern id="gridp" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill={th.gridColor} /></pattern></defs>}
      {th.grid && <rect width="100%" height="100%" fill="url(#gridp)" />}

      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        <defs>
          <marker id="aG" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#43a047" /></marker>
          <marker id="aO" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#e65100" /></marker>
          <marker id="aD" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill={isDark ? "#78909c" : "#90a4ae"} /></marker>
          <marker id="aB" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#1a73e8" /></marker>
          <marker id="aC" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#7986cb" /></marker>
          <marker id="aR" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#e53935" /></marker>
          <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity=".08" /></filter>
        </defs>

        {/* Title */}
        <text x={cx} y={topY} textAnchor="middle" style={{ fontSize: 24, fontWeight: 800, fill: isDark ? "#e0e0e0" : "#111" }}>{diag.title}</text>
        {diag.subtitle && <text x={cx} y={topY + 22} textAnchor="middle" style={{ fontSize: 11, fill: isDark ? "#78909c" : "#999", fontStyle: "italic" }}>{diag.subtitle}</text>}

        {/* Zones */}
        {srcB && <g><rect x={srcB.x} y={srcB.y} width={srcB.w} height={srcB.h} rx={12} fill={isDark ? "#162032" : "#fafafa"} stroke={isDark ? "#2a4060" : "#bdbdbd"} strokeWidth={1.5} strokeDasharray="8 4" /><text x={srcB.x + srcB.w / 2} y={srcB.y + 18} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: isDark ? "#5a7a9a" : "#78909c", letterSpacing: 2 }}>SOURCES</text></g>}
        {cloudB && <g><rect x={cloudB.x} y={cloudB.y} width={cloudB.w} height={cloudB.h} rx={14} fill={isDark ? "#0d1f3c" : "#f5f9ff"} stroke={isDark ? "#1a4480" : "#4285f4"} strokeWidth={2} />
          <g transform={`translate(${cloudB.x + cloudB.w / 2 - 60},${cloudB.y - 14})`}><rect width={120} height={28} rx={6} fill="#4285f4" /><text x={60} y={19} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: "#fff", letterSpacing: .5 }}>Google Cloud</text></g></g>}
        {conB && <g><rect x={conB.x} y={conB.y} width={conB.w} height={conB.h} rx={12} fill={isDark ? "#162032" : "#fafafa"} stroke={isDark ? "#2a4060" : "#bdbdbd"} strokeWidth={1.5} strokeDasharray="8 4" /><text x={conB.x + conB.w / 2} y={conB.y + 18} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: isDark ? "#5a7a9a" : "#78909c", letterSpacing: 2 }}>CONSUMERS</text></g>}

        {/* Phase groups — draggable */}
        {phaseBounds.map((p, i) => (<g key={p.id} onMouseDown={e => startGroupDrag(p.nodeIds, e)} style={{ cursor: "move" }}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={10} fill={isDark ? "rgba(66,133,244,0.06)" : "rgba(66,133,244,0.04)"} stroke={isDark ? "rgba(66,133,244,0.2)" : "rgba(66,133,244,0.15)"} strokeWidth={1} strokeDasharray="5 3" />
          <text x={p.x + p.w / 2} y={p.y + 14} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: isDark ? "#5a8ac0" : "#90a4ae", letterSpacing: 1, pointerEvents: "none" }}>PHASE {i + 1}: {p.name.toUpperCase()}</text>
        </g>))}

        {/* Ops group — draggable */}
        {opsBound && diag.opsGroup && <g onMouseDown={e => startGroupDrag(diag.opsGroup!.nodeIds, e)} style={{ cursor: "move" }}>
          <rect x={opsBound.x} y={opsBound.y} width={opsBound.w} height={opsBound.h} rx={10} fill={isDark ? "rgba(84,110,122,0.1)" : "rgba(84,110,122,0.06)"} stroke={isDark ? "#37474f" : "#b0bec5"} strokeWidth={1.2} strokeDasharray="4 3" />
          <text x={opsBound.x + opsBound.w / 2} y={opsBound.y + 14} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: isDark ? "#607d8b" : "#90a4ae", letterSpacing: 1, pointerEvents: "none" }}>{(diag.opsGroup?.name || "OPS").toUpperCase()}</text>
        </g>}

        {/* Edges — CLEAN, no inline indicators */}
        {diag.edges.map(edge => {
          const fn = diag.nodes.find(n => n.id === edge.from), tn = diag.nodes.find(n => n.id === edge.to); if (!fn || !tn) return null;
          const isCtrl = edge.edgeType === "control", isObs = edge.edgeType === "observe", isAlert = edge.edgeType === "alert", isOps = isCtrl || isObs || isAlert;
          const isV = Math.abs(fn.y - tn.y) > Math.abs(fn.x - tn.x);
          const path = isV ? orthoV(fn.x, fn.y, tn.x, tn.y) : ortho(fn.x, fn.y, tn.x, tn.y);
          const mx = (fn.x + tn.x) / 2, my = (fn.y + tn.y) / 2;
          const sc = edge.security, sel = popover?.type === "edge" && popover.id === edge.id;
          let col: string, dash: string, w: number, mk: string;
          if (sel) { col = "#1a73e8"; dash = ""; w = 3; mk = "url(#aB)"; }
          else if (isAlert) { col = "#e53935"; dash = "6 4"; w = 1.5; mk = "url(#aR)"; }
          else if (isCtrl) { col = "#7986cb"; dash = "5 5"; w = 1.5; mk = "url(#aC)"; }
          else if (isObs) { col = isDark ? "#546e7a" : "#90a4ae"; dash = "3 5"; w = 1; mk = "url(#aD)"; }
          else if (sc?.private) { col = "#43a047"; dash = ""; w = 2; mk = "url(#aG)"; }
          else if (sc) { col = "#e65100"; dash = "6 4"; w = 2; mk = "url(#aO)"; }
          else { col = isDark ? "#546e7a" : "#90a4ae"; dash = "5 4"; w = 1.5; mk = "url(#aD)"; }

          return (<g key={edge.id}>
            <path d={path} fill="none" stroke="transparent" strokeWidth={20} onDoubleClick={e => dblClick("edge", edge.id, e)} style={{ cursor: "pointer" }} />
            <path d={path} fill="none" stroke={col} strokeWidth={w} strokeDasharray={dash} markerEnd={mk} />
            {edge.step > 0 && !isOps && <>
              <rect x={mx - 15} y={my - 15} width={30} height={30} rx={8} fill={sel ? "#1a73e8" : edge.crossesBoundary ? "#e65100" : "#5c6bc0"} filter="url(#sh)" onDoubleClick={e => dblClick("edge", edge.id, e)} style={{ cursor: "pointer" }} />
              <text x={mx} y={my + 5.5} textAnchor="middle" style={{ fontSize: 15, fontWeight: 900, fill: "#fff", pointerEvents: "none" }}>{edge.step}</text>
            </>}
            {isOps && edge.label && <text x={mx + (isV ? 14 : 0)} y={my + (isV ? 0 : -10)} textAnchor="middle" style={{ fontSize: 8, fill: isAlert ? "#e53935" : "#7986cb", fontStyle: "italic", fontWeight: 600, pointerEvents: "none" }}>{edge.label}</text>}
          </g>);
        })}

        {/* Boundary Gates — lock icons on cloud zone border */}
        {gates.map(gate => {
          const sel = popover?.type === "gate" && popover.id === gate.id;
          const isPriv = gate.security.private;
          const gateColor = isPriv ? "#43a047" : "#e65100";
          return (<g key={gate.id} onClick={e => { e.stopPropagation(); dblClick("gate", gate.id, e); }} style={{ cursor: "pointer" }}>
            <circle cx={gate.x} cy={gate.y} r={sel ? 12 : 10} fill={isDark ? "#1e1e1e" : "#fff"} stroke={sel ? "#1a73e8" : gateColor} strokeWidth={sel ? 2.5 : 2} filter="url(#sh)" />
            {/* Lock icon */}
            <g transform={`translate(${gate.x},${gate.y}) scale(0.5)`}>
              <rect x={-4} y={-0.5} width={8} height={6.5} rx={1.5} fill={gateColor} />
              <path d={`M-2.5,-0.5 L-2.5,-3.5 A2.5,2.5 0 0,1 2.5,-3.5 L2.5,-0.5`} fill="none" stroke={gateColor} strokeWidth={2} />
            </g>
          </g>);
        })}

        {/* Nodes */}
        {diag.nodes.map(node => {
          const ip = iconUrl(node.name, node.icon || undefined);
          const sel = popover?.type === "node" && popover.id === node.id;
          const th2 = (diag.threats || []).filter(t => t.target === node.id);
          const cat = getCat(node.icon);
          return (<g key={node.id} onMouseDown={e => startDrag(node.id, e)} onDoubleClick={e => dblClick("node", node.id, e)} style={{ cursor: drag === node.id ? "grabbing" : "pointer" }}>
            {sel && <rect x={node.x - BG / 2 - 6} y={node.y - BG / 2 - 6} width={BG + 12} height={BG + 12} rx={18} fill="none" stroke="#1a73e8" strokeWidth={2.5} strokeDasharray="5 3" />}
            <rect x={node.x - BG / 2} y={node.y - BG / 2} width={BG} height={BG} rx={14} fill={ip ? (isDark ? cat.border + "20" : cat.bg) : (isDark ? "#2a2a2a" : "#f5f5f5")} stroke={ip ? cat.border : (isDark ? "#444" : "#e0e0e0")} strokeWidth={sel ? 2.5 : 1.8} filter="url(#sh)" />
            {ip ? <image href={ip} x={node.x - ICO / 2} y={node.y - ICO / 2} width={ICO} height={ICO} /> : <text x={node.x} y={node.y + 7} textAnchor="middle" style={{ fontSize: 24, fill: isDark ? "#9fa8da" : "#5c6bc0" }}>☁</text>}
            <text x={node.x} y={node.y + BG / 2 + 16} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: isDark ? "#ccc" : "#222", pointerEvents: "none" }}>{node.name}</text>
            {node.subtitle && <text x={node.x} y={node.y + BG / 2 + 29} textAnchor="middle" style={{ fontSize: 9, fill: isDark ? "#666" : "#888", pointerEvents: "none" }}>{node.subtitle}</text>}
            {th2.length > 0 && <g transform={`translate(${node.x + BG / 2 - 4},${node.y - BG / 2 - 4})`}><polygon points="0,-10 -8,3 8,3" fill={SEV[th2[0].severity]} stroke={isDark ? "#1e1e1e" : "#fff"} strokeWidth={2} /><text y={0} textAnchor="middle" style={{ fontSize: 8, fontWeight: 900, fill: "#fff" }}>!</text></g>}
          </g>);
        })}
      </g>
    </svg>

    {/* Controls */}
    <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 5 }}>
      {[{ l: "+", f: () => setZoom(z => Math.min(3, z * 1.2)) }, { l: "−", f: () => setZoom(z => Math.max(.08, z * .8)) }].map((b, i) =>
        <button key={i} onClick={b.f} style={{ width: 32, height: 32, borderRadius: 8, background: isDark ? "#333" : "#fff", border: `1px solid ${isDark ? "#555" : "#e0e0e0"}`, fontSize: 16, color: isDark ? "#ccc" : "#333", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>{b.l}</button>)}
      <button onClick={fit} style={{ height: 32, padding: "0 12px", borderRadius: 8, background: isDark ? "#333" : "#fff", border: `1px solid ${isDark ? "#555" : "#e0e0e0"}`, fontSize: 11, fontWeight: 600, color: isDark ? "#ccc" : "#333", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>⊞ Fit</button>
      <div style={{ height: 32, padding: "0 10px", borderRadius: 8, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center" }}>{Math.round(zoom * 100)}%</div>
    </div>
    <div style={{ position: "absolute", bottom: 14, right: 14, background: "rgba(0,0,0,.5)", color: "#fff", padding: "6px 14px", borderRadius: 20, fontSize: 10 }}>Scroll zoom · Drag nodes/groups · Double-click details · Click 🔒 gates</div>
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
  const [tab, setTab] = useState<"diagram" | "highlights" | "flow">("diagram");
  const [theme, setTheme] = useState("light");
  const [showExport, setShowExport] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [saved, setSaved] = useState<any>(null);
  
  // Editing state variables
  const [editMode, setEditMode] = useState(false);
  const [showServicePalette, setShowServicePalette] = useState(false);
  const [history, setHistory] = useState<Diagram[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDirty, setIsDirty] = useState(false);
  const [originalDiagram, setOriginalDiagram] = useState<Diagram | null>(null);
  
  useEffect(() => { loadIcons() }, []);

  const generate = useCallback(async (directPrompt?: string) => {
    const p = directPrompt || prompt;
    if (!p.trim()) return; setLoading(true); setError(""); setDiag(null); setPopover(null); setSource(null); setTab("diagram");
    try {
      const res = await fetch("/api/diagrams/generate", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ prompt: p }) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = await res.json();
      setDiag(data.diagram as Diagram); 
      setSource(data.source);
      setSaved(data.saved);
    } catch (e: any) { setError(e.message) } setLoading(false);
  }, [prompt]);

  // Save diagram state to history for undo/redo
  const saveToHistory = useCallback((diagram: Diagram) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(diagram)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Initialize editing mode
  const startEditing = useCallback(() => {
    if (!diag) return;
    setEditMode(true);
    setOriginalDiagram(JSON.parse(JSON.stringify(diag)));
    setHistory([JSON.parse(JSON.stringify(diag))]);
    setHistoryIndex(0);
    setIsDirty(false);
  }, [diag]);

  // Update diagram and track changes
  const updateDiagram = useCallback((newDiagram: Diagram) => {
    setDiag(newDiagram);
    setIsDirty(true);
    saveToHistory(newDiagram);
  }, [setDiag, saveToHistory]);

  // Enhanced node update function
  const updateNode = useCallback((nodeId: string, patch: Partial<DiagNode>) => {
    if (!diag) return;
    const newDiagram = {
      ...diag,
      nodes: diag.nodes.map(node => 
        node.id === nodeId ? { ...node, ...patch } : node
      )
    };
    updateDiagram(newDiagram);
  }, [diag, updateDiagram]);

  // Delete node function
  const deleteNode = useCallback((nodeId: string) => {
    if (!diag) return;
    const newDiagram = {
      ...diag,
      nodes: diag.nodes.filter(node => node.id !== nodeId),
      edges: diag.edges.filter(edge => edge.from !== nodeId && edge.to !== nodeId),
      phases: diag.phases?.map(phase => ({
        ...phase,
        nodeIds: phase.nodeIds.filter(id => id !== nodeId)
      })) || [],
      opsGroup: diag.opsGroup ? {
        ...diag.opsGroup,
        nodeIds: diag.opsGroup.nodeIds.filter(id => id !== nodeId)
      } : undefined
    };
    updateDiagram(newDiagram);
  }, [diag, updateDiagram]);

  // Add new node function
  const addNode = useCallback((service: any) => {
    if (!diag) return;
    
    // Find a good position (avoid overlaps)
    const existingPositions = diag.nodes.map(n => ({ x: n.x, y: n.y }));
    let x = 400, y = 300;
    
    // Simple placement logic - find empty spot
    while (existingPositions.some(pos => Math.abs(pos.x - x) < 150 && Math.abs(pos.y - y) < 100)) {
      x += 180;
      if (x > 800) {
        x = 400;
        y += 120;
      }
    }

    const newNode: DiagNode = {
      id: `node_${Date.now()}`,
      name: service.name,
      icon: service.id,
      subtitle: service.subtitle,
      zone: "cloud", // Default to cloud, user can change
      x,
      y,
      details: {
        project: "your-project",
        region: "us-central1",
        encryption: "Google-managed encryption",
        monitoring: "Standard metrics available",
        cost: "Pay-as-you-use pricing",
        compliance: "SOC2",
        notes: `${service.name} component - edit to customize`
      }
    };

    const newDiagram = {
      ...diag,
      nodes: [...diag.nodes, newNode]
    };
    
    updateDiagram(newDiagram);
  }, [diag, updateDiagram]);

  // Save changes to database
  const saveChanges = useCallback(async () => {
    if (!diag || !saved || !isDirty) return;
    
    try {
      const response = await fetch(`/api/diagrams/${saved.id}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ diagram: diag })
      });

      if (!response.ok) {
        throw new Error("Failed to save changes");
      }

      const result = await response.json();
      setSaved(result.saved);
      setIsDirty(false);
      setOriginalDiagram(JSON.parse(JSON.stringify(diag)));
      
      console.log("✅ Changes saved successfully");
      setError("✅ Changes saved successfully");
      setTimeout(() => setError(""), 3000);
      
    } catch (err) {
      console.error("Failed to save changes:", err);
      setError("Failed to save changes. Please try again.");
    }
  }, [diag, saved, isDirty]);

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const exportDrawio = useCallback(() => {
    if (!diag) return;
    let id = 2; const cells: string[] = [], nm: Record<string, number> = {};
    const zones = [{ l: "SOURCES", ns: diag.nodes.filter(n => n.zone === "sources"), c: "#fafafa", s: "#bdbdbd", d: true }, { l: "Google Cloud", ns: diag.nodes.filter(n => n.zone === "cloud"), c: "#f0f7ff", s: "#4285f4", d: false }, { l: "CONSUMERS", ns: diag.nodes.filter(n => n.zone === "consumers"), c: "#fafafa", s: "#bdbdbd", d: true }];
    const zm: Record<string, number> = {};
    for (const z of zones) { if (!z.ns.length) continue; const xs = z.ns.map(n => n.x), ys = z.ns.map(n => n.y), p = 80; const zId = id++; cells.push(`<mxCell id="${zId}" value="${esc(z.l)}" style="rounded=1;whiteSpace=wrap;fillColor=${z.c};strokeColor=${z.s};${z.d ? "dashed=1;" : ""}fontStyle=1;fontSize=14;verticalAlign=top;container=1;collapsible=0;" vertex="1" parent="1"><mxGeometry x="${Math.min(...xs) - p}" y="${Math.min(...ys) - p}" width="${Math.max(...xs) - Math.min(...xs) + p * 2 + 80}" height="${Math.max(...ys) - Math.min(...ys) + p * 2 + 80}" as="geometry"/></mxCell>`); z.ns.forEach(n => { zm[n.id] = zId; }); }
    for (const n of diag.nodes) { const nId = id++; nm[n.id] = nId; const cat = getCat(n.icon); cells.push(`<mxCell id="${nId}" value="${esc(n.name)}${n.subtitle ? '<br><font style=&quot;font-size:9px&quot;>' + esc(n.subtitle) + '</font>' : ''}" style="rounded=1;whiteSpace=wrap;fillColor=${cat.bg};strokeColor=${cat.border};fontStyle=1;fontSize=11;" vertex="1" parent="${zm[n.id] || 1}"><mxGeometry x="${n.x - 60}" y="${n.y - 40}" width="120" height="80" as="geometry"/></mxCell>`); }
    for (const e of diag.edges) { const eId = id++, src = nm[e.from], tgt = nm[e.to]; if (!src || !tgt) continue; const isP = e.security?.private; const col = e.edgeType === "alert" ? "#e53935" : e.edgeType === "control" ? "#7986cb" : isP ? "#43a047" : "#e65100"; cells.push(`<mxCell id="${eId}" value="${e.step > 0 ? '(' + e.step + ') ' : ''}${esc(e.label || '')}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=${col};strokeWidth=2;${!isP ? 'dashed=1;' : ''}fontSize=9;" edge="1" source="${src}" target="${tgt}" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>`); }
    const xml = `<?xml version="1.0"?><mxfile><diagram name="${esc(diag.title)}" id="e"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join("")}</root></mxGraphModel></diagram></mxfile>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" })); a.download = `${diag.title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.drawio`; a.click();
  }, [diag]);
  const exportJSON = useCallback(() => { if (!diag) return; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(diag, null, 2)], { type: "application/json" })); a.download = `${diag.title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.json`; a.click(); }, [diag]);

  const TABS = [{ id: "diagram" as const, l: "Diagram", icon: "◇" }, { id: "highlights" as const, l: "Highlights", icon: "📊" }, { id: "flow" as const, l: "Flow", icon: "🔄" }];

  return (
    <div style={{ height: "100vh", display: "flex", fontFamily: "'Inter','DM Sans',system-ui,sans-serif", background: "#f0f2f5" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}textarea:focus{border-color:#1a73e8!important;box-shadow:0 0 0 3px rgba(26,115,232,.12)!important}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px}`}</style>

      {/* ── LEFT PANE ── */}
      <div style={{ width: 280, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e5e5", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#1a73e8,#4285f4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 900 }}>◇</div>
          <div><div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>ArchGen</div><div style={{ fontSize: 9, color: "#bbb" }}>Architecture Intelligence</div></div>
        </div>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0f0f0" }}>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); } }} placeholder="Describe your architecture..." rows={3} style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e5e5", borderRadius: 10, fontSize: 12, outline: "none", resize: "none", lineHeight: 1.5, background: "#fafafa", boxSizing: "border-box", transition: "all .15s" }} />
          <button onClick={() => generate()} disabled={!prompt.trim() || loading} style={{ width: "100%", marginTop: 8, padding: "9px 0", background: prompt.trim() ? "linear-gradient(135deg,#1a73e8,#4285f4)" : "#e0e0e0", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: prompt.trim() ? "pointer" : "default", transition: "all .15s" }}>
            {loading ? "Generating..." : "Generate Architecture"}</button>
          {error && <div style={{ marginTop: 6, padding: 8, borderRadius: 6, background: "#fff5f5", border: "1px solid #fecaca", color: "#dc2626", fontSize: 10 }}>{error}</div>}
        </div>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#bbb", letterSpacing: 1, marginBottom: 10 }}>TEMPLATES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[{ icon: "📊", name: "Enterprise Streaming", p: "enterprise streaming analytics platform with comprehensive security governance disaster recovery and cost management" },
              { icon: "🔄", name: "CDC Migration", p: "migrate from AWS RDS to BigQuery CDC" },
              { icon: "🤖", name: "RAG / GenAI", p: "RAG chatbot with Gemini and vector search" },
            ].map((t, i) => (<button key={i} onClick={() => { setPrompt(t.p); generate(t.p); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fafafa", border: "1px solid #eee", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all .12s" }} onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; e.currentTarget.style.borderColor = "#4285f4"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fafafa"; e.currentTarget.style.borderColor = "#eee"; }}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{t.name}</div></div>
            </button>))}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: "12px 16px", borderTop: "1px solid #f0f0f0" }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <button onClick={() => { setShowTheme(!showTheme); setShowExport(false); }} style={{ width: "100%", padding: "7px 12px", background: "#fafafa", border: "1px solid #eee", borderRadius: 8, fontSize: 11, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🎨 Theme: {THEMES[theme]?.label}</span><span style={{ color: "#bbb" }}>▾</span></button>
            {showTheme && <div style={{ position: "absolute", bottom: 38, left: 0, right: 0, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.12)", zIndex: 200, overflow: "hidden" }}>
              {Object.entries(THEMES).map(([k, v]) => (<button key={k} onClick={() => { setTheme(k); setShowTheme(false); }} style={{ width: "100%", padding: "9px 14px", background: theme === k ? "#f0f7ff" : "none", border: "none", borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left", fontSize: 11, fontWeight: theme === k ? 700 : 400, color: theme === k ? "#1a73e8" : "#555" }}>{v.label}</button>))}</div>}
          </div>
          {diag && <div style={{ position: "relative", marginBottom: 8 }}>
            <button onClick={() => { setShowExport(!showExport); setShowTheme(false); }} style={{ width: "100%", padding: "7px 12px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📥 Export</span><span>▾</span></button>
            {showExport && <div style={{ position: "absolute", bottom: 38, left: 0, right: 0, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.12)", zIndex: 200, overflow: "hidden" }}>
              <button onClick={() => { exportDrawio(); setShowExport(false); }} style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left", fontSize: 11 }}><b>📐 Draw.io</b><br /><span style={{ fontSize: 9, color: "#999" }}>Open in diagrams.net</span></button>
              <button onClick={() => { exportJSON(); setShowExport(false); }} style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 11 }}><b>📋 JSON</b><br /><span style={{ fontSize: 9, color: "#999" }}>Template data</span></button>
            </div>}
          </div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "#bbb" }}>{user.firstName || user.email}</span>
            <button onClick={() => logout()} style={{ padding: "4px 10px", background: "none", border: "1px solid #eee", borderRadius: 6, fontSize: 10, color: "#999", cursor: "pointer" }}>Logout</button>
          </div>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {diag && <div style={{ height: 44, padding: "0 20px", background: "#fff", borderBottom: "1px solid #e5e5e5", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {TABS.map(t => (<button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", background: tab === t.id ? "#f0f7ff" : "none", border: tab === t.id ? "1px solid #4285f4" : "1px solid transparent", borderRadius: 8, fontSize: 12, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "#1a73e8" : "#888", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all .12s" }}>
            <span>{t.icon}</span>{t.l}</button>))}
          <div style={{ flex: 1 }} />
          {source && <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 14, background: source === "template" ? "#e8f5e9" : "#fff3e0", color: source === "template" ? "#2e7d32" : "#e65100", fontWeight: 700 }}>{source === "template" ? "⚡ Template — instant, $0" : "🤖 AI Generated"}</span>}
        </div>}
        {!diag && !loading && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: THEMES[theme]?.bg || "#f8f9fa" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, color: "#e0e0e0", marginBottom: 16 }}>◇</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#bbb" }}>Type a prompt or pick a template to start</div>
            </div>
          </div>
        )}
        {loading && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
            <div style={{ width: 32, height: 32, border: "3px solid #e5e5e5", borderTopColor: "#1a73e8", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
            <div style={{ color: "#999", fontSize: 13 }}>Building your architecture...</div>
          </div>
        )}
        {diag && tab === "diagram" && (
          <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", background: THEMES[theme]?.bg || "#f8f9fa", overflow: "hidden" }}>
            
            {/* Edit Mode Toggle Button */}
            {!editMode && diag && (
              <div style={{ position: "absolute", top: 16, right: 16, zIndex: 100 }}>
                <button
                  onClick={startEditing}
                  style={{
                    background: "linear-gradient(135deg, #1a73e8, #4285f4)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(26, 115, 232, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  ✏️ Edit Architecture
                </button>
              </div>
            )}

            {/* Exit Edit Mode Button */}
            {editMode && (
              <div style={{ position: "absolute", top: 16, right: 16, zIndex: 100 }}>
                <button
                  onClick={() => {
                    if (isDirty && confirm("You have unsaved changes. Exit editing anyway?")) {
                      setDiag(originalDiagram!);
                    }
                    setEditMode(false);
                    setIsDirty(false);
                    setHistory([]);
                    setHistoryIndex(-1);
                    setOriginalDiagram(null);
                  }}
                  style={{
                    background: isDirty ? "#dc2626" : "#666",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {isDirty ? "✕ Exit (Unsaved)" : "✓ Done Editing"}
                </button>
              </div>
            )}

            {/* Editing Toolbar (only when in edit mode) */}
            {editMode && (
              <EditingToolbar
                onAddNode={() => setShowServicePalette(true)}
                onSave={saveChanges}
                onUndo={() => {
                  if (historyIndex > 0) {
                    const prevIndex = historyIndex - 1;
                    setHistoryIndex(prevIndex);
                    setDiag(history[prevIndex]);
                    setIsDirty(prevIndex !== 0);
                  }
                }}
                onRedo={() => {
                  if (historyIndex < history.length - 1) {
                    const nextIndex = historyIndex + 1;
                    setHistoryIndex(nextIndex);
                    setDiag(history[nextIndex]);
                    setIsDirty(true);
                  }
                }}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
                isDirty={isDirty}
              />
            )}

            {/* Enhanced Diagram Canvas */}
            <DiagramCanvas 
              diag={diag} 
              setDiag={editMode ? updateDiagram : setDiag}
              popover={popover} 
              setPopover={setPopover} 
              theme={theme}
            />

            {/* Enhanced popover for editing */}
            {popover && popover.type === "node" && (() => {
              const node = diag.nodes.find(n => n.id === popover.id);
              if (!node) return null;
              const threats = (diag.threats || []).filter(t => t.target === node.id);
              const cw = 800, ch = 600; // ref.current?.clientWidth || 800, ch = ref.current?.clientHeight || 600;
              const px = Math.min(popover.px + 10, cw - 450), py = Math.min(Math.max(popover.py - 60, 10), ch - 420);
              return (
                <div style={{ position: "absolute", left: px, top: py, zIndex: 200 }}>
                  <EnhancedNodePopover
                    node={node}
                    threats={threats}
                    onClose={() => setPopover(null)}
                    onUpdate={updateNode}
                    onDelete={deleteNode}
                  />
                </div>
              );
            })()}

            {/* Edge and Gate Popovers */}
            {popover && popover.type === "edge" && (() => {
              const edge = diag.edges.find(e => e.id === popover.id);
              if (!edge) return null;
              const threats = (diag.threats || []).filter(t => t.target === edge.id);
              const cw = 800, ch = 600;
              const px = Math.min(popover.px + 10, cw - 350), py = Math.min(Math.max(popover.py - 60, 10), ch - 300);
              return (
                <div style={{ position: "absolute", left: px, top: py, zIndex: 200 }}>
                  <EdgePop
                    edge={edge}
                    fn={diag.nodes.find(n => n.id === edge.from)}
                    tn={diag.nodes.find(n => n.id === edge.to)}
                    threats={threats}
                    onClose={() => setPopover(null)}
                  />
                </div>
              );
            })()}

            {popover && popover.type === "gate" && (() => {
              // Note: gates logic would need to be reconstructed here if needed
              return null;
            })()}

            {/* Service Palette */}
            <ServicePalette
              visible={showServicePalette}
              onClose={() => setShowServicePalette(false)}
              onAddNode={addNode}
            />
          </div>
        )}
        {diag && tab === "highlights" && <div style={{ flex: 1, overflow: "auto", background: "#fff" }}><HighlightsTab diag={diag} /></div>}
        {diag && tab === "flow" && <div style={{ flex: 1, overflow: "auto", background: "#fff" }}><FlowTab diag={diag} /></div>}
      </div>
    </div>
  );
}
