import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";
import { ServicePalette, EnhancedNodePopover, EdgeEditPop, EditingToolbar, GCP_SERVICES } from "../components/diagram-editor-components";

/* ── Icons ─────────────────────────────────────────── */
interface IconEntry { id: string; name: string; path: string; aliases: string[] }
let IC: IconEntry[] = [];
async function loadIcons() { if (IC.length) return; try { IC = (await (await fetch("/icons/registry.json")).json()).icons || []; } catch {} }
function iconUrl(n: string, h?: string): string | null {
  const l = (h || n).toLowerCase().trim();
  // 1. Exact ID match (most reliable — templates set icon: "bigquery" etc)
  const byId = IC.find(i => i.id === l);
  if (byId) return byId.path.includes('/vendor/') ? `/icons/vendor/${byId.id}.svg` : `/icons/gcp/${byId.id}.svg`;
  // 2. Exact name match
  const byName = IC.find(i => i.name.toLowerCase() === l);
  if (byName) return byName.path.includes('/vendor/') ? `/icons/vendor/${byName.id}.svg` : `/icons/gcp/${byName.id}.svg`;
  // 3. Exact alias match only (no substring — prevents redis→memorystore, kafka→pubsub)
  const byAlias = IC.find(i => i.aliases.some(a => a === l));
  if (byAlias) return byAlias.path.includes('/vendor/') ? `/icons/vendor/${byAlias.id}.svg` : `/icons/gcp/${byAlias.id}.svg`;
  // 4. Normalized: strip "cloud_" prefix, underscores, spaces
  const norm = l.replace(/[-_\s]/g, "").replace(/^cloud/, "");
  const byNorm = IC.find(i => i.id.replace(/[-_\s]/g, "").replace(/^cloud/, "") === norm);
  if (byNorm) return byNorm.path.includes('/vendor/') ? `/icons/vendor/${byNorm.id}.svg` : `/icons/gcp/${byNorm.id}.svg`;
  return null;
}

/* ── Category Colors ──────────────────────────────── */
const CAT: Record<string, { bg: string; border: string }> = {
  // GCP
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
  cloud_composer: { bg: "#e8f5e9", border: "#43a047" }, dataproc: { bg: "#e3f2fd", border: "#1565c0" },
  dataplex: { bg: "#e8f5e9", border: "#2e7d32" }, analytics_hub: { bg: "#e3f2fd", border: "#1565c0" },
  security_command_center: { bg: "#ffebee", border: "#c62828" },
  // Databases
  postgresql: { bg: "#e3f2fd", border: "#336791" }, mysql: { bg: "#e0f7fa", border: "#00758f" },
  oracle: { bg: "#fbe9e7", border: "#c74634" }, sqlserver: { bg: "#ffebee", border: "#cc2927" },
  mongodb: { bg: "#e8f5e9", border: "#001e2b" }, snowflake: { bg: "#e0f7fa", border: "#29b5e8" },
  teradata: { bg: "#fff3e0", border: "#f37440" }, redis: { bg: "#ffebee", border: "#dc382d" },
  alloydb: { bg: "#e3f2fd", border: "#1a73e8" },
  // SaaS
  salesforce: { bg: "#e0f2f1", border: "#00a1e0" }, servicenow: { bg: "#e8f5e9", border: "#81b5a1" },
  workday: { bg: "#fff3e0", border: "#f5820d" }, sap: { bg: "#e3f2fd", border: "#0070f2" },
  atlassian: { bg: "#e3f2fd", border: "#0052cc" },
  // Streaming
  kafka: { bg: "#eceff1", border: "#231f20" }, confluent: { bg: "#e8eaf6", border: "#173361" },
  // Security
  cyberark: { bg: "#e3f2fd", border: "#00467f" }, wiz: { bg: "#e8eaf6", border: "#2462e4" },
  keeper: { bg: "#e3f2fd", border: "#0d47a1" }, entra_id: { bg: "#e3f2fd", border: "#0078d4" },
  // Observability
  splunk: { bg: "#e8f5e9", border: "#65a637" }, dynatrace: { bg: "#e3f2fd", border: "#1496ff" },
  datadog: { bg: "#ede7f6", border: "#632ca6" }, grafana: { bg: "#fff3e0", border: "#f46800" },
  pagerduty: { bg: "#e8f5e9", border: "#06ac38" },
  // AWS
  aws_s3: { bg: "#e8f5e9", border: "#3f8624" }, aws_rds: { bg: "#e3f2fd", border: "#2e73b8" },
  aws_kinesis: { bg: "#ede7f6", border: "#8c4fff" }, aws_redshift: { bg: "#ede7f6", border: "#8c4fff" },
  aws_lambda: { bg: "#fff3e0", border: "#ff9900" },
  // People
  external_users: { bg: "#e3f2fd", border: "#1565c0" }, internal_users: { bg: "#eceff1", border: "#546e7a" },
  admin_user: { bg: "#ffebee", border: "#b71c1c" }, developer: { bg: "#e0f2f1", border: "#37474f" },
  analyst: { bg: "#e0f2f1", border: "#00695c" },
  // Infrastructure
  sftp_server: { bg: "#eceff1", border: "#455a64" }, rest_api: { bg: "#fff3e0", border: "#ff6f00" },
  onprem_server: { bg: "#eceff1", border: "#78909c" }, mainframe: { bg: "#eceff1", border: "#263238" },
  webhook: { bg: "#ffebee", border: "#c62828" }, slack: { bg: "#fff3e0", border: "#ecb22e" },
  github: { bg: "#eceff1", border: "#24292f" }, fivetran: { bg: "#e3f2fd", border: "#0073ff" },
  dbt: { bg: "#fbe9e7", border: "#ff694b" }, azure: { bg: "#e3f2fd", border: "#0078d4" },
};
const DEF_CAT = { bg: "#f5f5f5", border: "#bdbdbd" };
// Layer colors for blueprint/capability-map nodes (no icons)
// Matched to BlueprintView (BP_LAYERS, MEDAL_ZONES, connectivity)
const LAYER_CAT: Record<string, { bg: string; border: string }> = {
  src_: { bg: "#eceff1", border: "#546e7a" },     // slate gray (Layer 1)
  conn_: { bg: "#fdf2f8", border: "#be185d" },    // pink/rose (Layer 2 — connectivity)
  ing_: { bg: "#eff6ff", border: "#1d4ed8" },     // blue (Layer 3)
  lake_: { bg: "#ecfdf5", border: "#047857" },    // emerald (Layer 4)
  raw_landing: { bg: "#ecfdf5", border: "#047857" },  // emerald (Layer 4)
  proc_: { bg: "#f5f3ff", border: "#6d28d9" },    // purple (Layer 5)
  bronze: { bg: "#fef3c7", border: "#f59e0b" },   // amber (Layer 6)
  silver: { bg: "#f9fafb", border: "#9ca3af" },   // cool gray (Layer 6)
  gold: { bg: "#fef9c3", border: "#eab308" },     // gold (Layer 6)
  serve_: { bg: "#fff7ed", border: "#c2410c" },   // burnt orange (Layer 7)
  pillar_: { bg: "#fce4ec", border: "#ad1457" },   // dark pink (crosscutting)
  con_: { bg: "#ecfeff", border: "#0e7490" },     // teal (Layer 8)
};
function getCat(ic?: string | null, nodeId?: string) {
  if (ic && CAT[ic]) return CAT[ic];
  if (nodeId) {
    if (LAYER_CAT[nodeId]) return LAYER_CAT[nodeId];
    for (const [prefix, cat] of Object.entries(LAYER_CAT)) {
      if (prefix.endsWith("_") && nodeId.startsWith(prefix)) return cat;
    }
  }
  return DEF_CAT;
}

/* ── Types ────────────────────────────────────────── */
interface NodeDetails { project?: string; region?: string; serviceAccount?: string; iamRoles?: string; encryption?: string; monitoring?: string; retry?: string; alerting?: string; cost?: string; troubleshoot?: string; guardrails?: string; compliance?: string; notes?: string }
interface DiagNode { id: string; name: string; icon?: string | null; subtitle?: string; zone: "sources" | "cloud" | "consumers" | "connectivity"; x: number; y: number; details?: NodeDetails }
interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean; network?: string; vpcsc?: string; dlp?: string; keyRotation?: string; egressPolicy?: string; compliance?: string }
interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean; edgeType?: "data" | "control" | "observe" | "alert" }
interface Threat { id: string; target: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance?: string | null }
interface Phase { id: string; name: string; nodeIds: string[] }
interface OpsGroup { name: string; nodeIds: string[] }
interface Diagram { title: string; subtitle?: string; layout?: string; nodes: DiagNode[]; edges: DiagEdge[]; threats?: Threat[]; phases?: Phase[]; opsGroup?: OpsGroup }

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
        {p.nodeIds.map(nid => { const n = diag.nodes.find(x => x.id === nid); return n ? <div key={nid} style={{ fontSize: 10, color: "#666", padding: "2px 0", display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: getCat(n.icon, n.id).border }} />{n.name}</div> : null; })}
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

/* ═══ BLUEPRINT VIEW — Capability Map Renderer (v9 layout) ═══ */
const BP_LAYERS = [
  { prefix: "con_", num: 8, name: "CONSUMERS", tag: "Experience", bg: "#ecfeff", border: "#67e8f9", numBg: "#0e7490", nameC: "#0e7490", tagBg: "#cffafe", tagC: "#155e75", capBg: "#fff", capBd: "#a5f3fc", capC: "#134e4a" },
  { prefix: "serve_", num: 7, name: "SERVING & DELIVERY", tag: "Deliver", bg: "#fff7ed", border: "#fdba74", numBg: "#c2410c", nameC: "#c2410c", tagBg: "#ffedd5", tagC: "#9a3412", capBg: "#fff", capBd: "#fed7aa", capC: "#7c2d12" },
  { prefix: "medal_", num: 6, name: "MEDALLION ARCHITECTURE", tag: "Curate", bg: "#fffbeb", border: "#fcd34d", numBg: "#d97706", nameC: "#b45309", tagBg: "#fef3c7", tagC: "#92400e", capBg: "", capBd: "", capC: "" },
  { prefix: "proc_", num: 5, name: "PROCESSING & TRANSFORMATION", tag: "Transform", bg: "#f5f3ff", border: "#c4b5fd", numBg: "#6d28d9", nameC: "#6d28d9", tagBg: "#ede9fe", tagC: "#5b21b6", capBg: "#fff", capBd: "#ddd6fe", capC: "#3b0764" },
  { prefix: "lake_", num: 4, name: "DATA LAKE — RAW LANDING", tag: "Land", bg: "#ecfdf5", border: "#6ee7b7", numBg: "#047857", nameC: "#047857", tagBg: "#d1fae5", tagC: "#065f46", capBg: "#fff", capBd: "#a7f3d0", capC: "#064e3b" },
  { prefix: "ing_", num: 3, name: "INGESTION", tag: "All 5 Patterns", bg: "#eff6ff", border: "#93c5fd", numBg: "#1d4ed8", nameC: "#1d4ed8", tagBg: "#dbeafe", tagC: "#1e40af", capBg: "#fff", capBd: "#bfdbfe", capC: "#1e3a5f" },
];
const BP_PILLARS = [
  { id: "pillar_sec", color: "#dc2626", bg: "#fef2f2", itemBg: "#fee2e2", itemC: "#991b1b", descC: "#b91c1c", badgeBg: "#fecaca", badgeC: "#991b1b", badges: ["SOC2", "ISO 27001", "HIPAA", "PCI-DSS"] },
  { id: "pillar_gov", color: "#2563eb", bg: "#eff6ff", itemBg: "#dbeafe", itemC: "#1e3a8a", descC: "#1d4ed8", badgeBg: "#bfdbfe", badgeC: "#1e3a8a", badges: ["GDPR", "CCPA", "HIPAA", "DATA MESH"] },
  { id: "pillar_obs", color: "#d97706", bg: "#fffbeb", itemBg: "#fef3c7", itemC: "#92400e", descC: "#b45309", badgeBg: "#fde68a", badgeC: "#92400e", badges: ["SLO/SLA", "MTTR", "DORA"] },
  { id: "pillar_orch", color: "#7c3aed", bg: "#f5f3ff", itemBg: "#ede9fe", itemC: "#4c1d95", descC: "#6d28d9", badgeBg: "#ddd6fe", badgeC: "#4c1d95", badges: ["FINOPS", "TAGGING", "QUOTAS"] },
];
const MEDAL_ZONES = [
  { id: "bronze", bg: "#fef3c7", bd: "#f59e0b", lblC: "#b45309", desc: "Ingested · schema-applied · deduplicated" },
  { id: "silver", bg: "#f9fafb", bd: "#9ca3af", lblC: "#4b5563", desc: "Cleaned · conformed · business rules" },
  { id: "gold", bg: "#fef9c3", bd: "#eab308", lblC: "#a16207", desc: "Curated · aggregated · consumption-ready" },
];

function BlueprintView({ diag, popover, setPopover }: { diag: Diagram; popover: any; setPopover: (p: any) => void }) {
  const connRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pillarRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [selectedCap, setSelectedCap] = useState<string | null>(null);

  const getNode = (id: string) => diag.nodes.find(n => n.id === id);
  const nodesByPrefix = (pfx: string) => diag.nodes.filter(n => n.id.startsWith(pfx));

  // Draw connector arrows from platform box edge to pillars
  useEffect(() => {
    const draw = () => {
      const svg = svgRef.current;
      const col = connRef.current;
      if (!svg || !col) return;
      const colRect = col.getBoundingClientRect();
      let paths = "";
      BP_PILLARS.forEach(p => {
        const el = pillarRefs.current[p.id];
        if (!el) return;
        const pRect = el.getBoundingClientRect();
        const pY = pRect.top + pRect.height / 2 - colRect.top;
        const endX = colRect.width;
        paths += `<circle cx="1" cy="${pY}" r="3.5" fill="${p.color}" opacity="0.7"/>`;
        paths += `<line x1="5" y1="${pY}" x2="${endX - 7}" y2="${pY}" stroke="${p.color}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.45"/>`;
        paths += `<polygon points="${endX - 1},${pY} ${endX - 8},${pY - 4} ${endX - 8},${pY + 4}" fill="${p.color}" opacity="0.6"/>`;
      });
      svg.innerHTML = paths;
    };
    setTimeout(draw, 100);
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [diag]);

  const capClick = (nodeId: string) => {
    if (selectedCap === nodeId) { setSelectedCap(null); setPopover(null); }
    else { setSelectedCap(nodeId); setPopover({ type: "node", id: nodeId }); }
  };

  const CapBox = ({ nodeId, style }: { nodeId: string; style: React.CSSProperties }) => {
    const n = getNode(nodeId);
    if (!n) return null;
    const isSel = selectedCap === nodeId;
    return (
      <div onClick={() => capClick(nodeId)} style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 7, cursor: "pointer", transition: "all 0.12s", outline: isSel ? "2px solid #1a73e8" : "none", outlineOffset: 1, ...style }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 3px 8px rgba(0,0,0,0.06)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}>
        <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2 }}>{n.name}</div>
        {n.subtitle && <div style={{ fontSize: 8, opacity: 0.5, marginTop: 1 }}>{n.subtitle}</div>}
      </div>
    );
  };

  const FlowArrow = () => (
    <div style={{ display: "flex", justifyContent: "center", gap: 24, padding: "5px 0" }}>
      {[0,1,2].map(i => (
        <svg key={i} width="2" height="22" viewBox="0 0 2 22" style={{ overflow: "visible" }}>
          <line x1="1" y1="22" x2="1" y2="6" stroke="#94a3b8" strokeWidth="1.5" />
          <polygon points="1,0 -3.5,8 5.5,8" fill="#94a3b8" />
        </svg>
      ))}
    </div>
  );

  const srcNodes = nodesByPrefix("src_");
  const connNodes = nodesByPrefix("conn_");
  const pillarNodes = BP_PILLARS.map(p => getNode(p.id)).filter(Boolean);

  // Get pillar sub-capabilities from details.notes
  const parsePillarItems = (nodeId: string): { name: string; desc: string }[] => {
    const n = getNode(nodeId);
    if (!n?.details?.notes) return [];
    const lines = n.details.notes.split("\n").filter(l => l.trim().startsWith("•"));
    return lines.map(l => {
      const clean = l.replace(/^[•\s]+/, "").trim();
      const paren = clean.match(/^([^(]+)\(([^)]+)\)/);
      if (paren) return { name: paren[1].trim(), desc: paren[2].trim() };
      return { name: clean, desc: "" };
    });
  };

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#fff", padding: "24px 32px 20px", fontFamily: "Inter, -apple-system, sans-serif" }}>
      {/* Title */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: "#111", letterSpacing: -0.3, margin: 0 }}>{diag.title}</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* ═══ UPPER: Platform + Connectors + Pillars ═══ */}
        <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>

          {/* Platform Group Box */}
          <div style={{ flex: 1, border: "2px solid #94a3b8", borderRadius: 14, padding: 14, background: "#f8fafc", position: "relative" }}>
            <div style={{ position: "absolute", top: -9, left: 20, background: "#fff", padding: "0 10px", fontSize: 8.5, fontWeight: 800, color: "#64748b", letterSpacing: 1.5, textTransform: "uppercase" as const }}>YOUR DATA PLATFORM</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {BP_LAYERS.map((layer, li) => {
                const isLast = li === BP_LAYERS.length - 1;
                const isMedallion = layer.prefix === "medal_";
                return (
                  <div key={layer.prefix}>
                    <div style={{ borderRadius: 10, padding: "10px 14px", border: `1.5px solid ${layer.border}`, background: layer.bg }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff", background: layer.numBg, flexShrink: 0 }}>{layer.num}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: layer.nameC }}>{layer.name}</div>
                        <div style={{ marginLeft: "auto", fontSize: 7.5, fontWeight: 700, padding: "2px 8px", borderRadius: 8, letterSpacing: 0.4, textTransform: "uppercase" as const, background: layer.tagBg, color: layer.tagC }}>{layer.tag}</div>
                      </div>
                      {isMedallion ? (
                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          {MEDAL_ZONES.map((mz, mi) => (
                            <div key={mz.id} style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
                              <div onClick={() => capClick(mz.id)} style={{ flex: 1, padding: "12px 10px", borderRadius: 8, textAlign: "center", border: `2px solid ${mz.bd}`, background: mz.bg, cursor: "pointer", outline: selectedCap === mz.id ? "2px solid #1a73e8" : "none", outlineOffset: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: mz.lblC }}>{mz.id.toUpperCase()}</div>
                                <div style={{ fontSize: 8, opacity: 0.45, marginTop: 2 }}>{getNode(mz.id)?.subtitle || mz.desc}</div>
                              </div>
                              {mi < MEDAL_ZONES.length - 1 && <div style={{ fontSize: 16, color: "#d0d0d0", flexShrink: 0 }}>→</div>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {nodesByPrefix(layer.prefix).map(n => (
                            <CapBox key={n.id} nodeId={n.id} style={{ background: layer.capBg, border: `1px solid ${layer.capBd}`, color: layer.capC, ...(layer.prefix === "lake_" ? { flex: 2 } : {}) }} />
                          ))}
                        </div>
                      )}
                    </div>
                    {!isLast && <FlowArrow />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connector Column */}
          <div ref={connRef} style={{ width: 44, flexShrink: 0, position: "relative" }}>
            <svg ref={svgRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }} />
          </div>

          {/* Pillars */}
          <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            {BP_PILLARS.map(p => {
              const node = getNode(p.id);
              const items = parsePillarItems(p.id);
              return (
                <div key={p.id} ref={el => { pillarRefs.current[p.id] = el; }} style={{ flex: 1, borderRadius: 10, padding: "12px 14px", borderLeft: `4px solid ${p.color}`, background: p.bg, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(0,0,0,0.06)", color: p.descC }}>{node?.name || p.id}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, flex: 1 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ padding: "5px 9px", borderRadius: 6, background: p.itemBg, color: p.itemC, display: "flex", flexDirection: "column", gap: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 9, fontWeight: 700 }}>{item.name}</span>
                        </div>
                        {item.desc && <div style={{ fontSize: 7.5, opacity: 0.55, paddingLeft: 9, lineHeight: 1.3, color: p.descC }}>{item.desc}</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {p.badges.map(b => <span key={b} style={{ fontSize: 7, fontWeight: 700, padding: "2px 6px", borderRadius: 4, letterSpacing: 0.3, textTransform: "uppercase" as const, background: p.badgeBg, color: p.badgeC }}>{b}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ LOWER: Aligned to platform width only ═══ */}
        <div style={{ display: "flex" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Trust Boundary */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0" }}>
              <div style={{ flex: 1, borderTop: "2px dashed #e11d48", opacity: 0.3 }} />
              <div style={{ padding: "2px 14px", fontSize: 7.5, fontWeight: 800, color: "#e11d48", letterSpacing: 1.5, textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>▲ Trust Boundary ▲</div>
              <div style={{ flex: 1, borderTop: "2px dashed #e11d48", opacity: 0.3 }} />
            </div>

            {/* Connectivity Layer */}
            <div style={{ border: "2px solid #f472b6", borderRadius: 12, padding: "10px 14px", background: "#fdf2f8", position: "relative" }}>
              <div style={{ position: "absolute", top: -9, left: 20, background: "#fff", padding: "0 10px", fontSize: 8.5, fontWeight: 800, color: "#be185d", letterSpacing: 1.2, textTransform: "uppercase" as const }}>CONNECTIVITY & ACCESS — HANDSHAKE LAYER</div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: "#be185d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff", flexShrink: 0 }}>②</div>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#be185d" }}>Connectivity & Access</div>
                <div style={{ marginLeft: "auto", fontSize: 7.5, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "#fce7f3", color: "#9d174d", letterSpacing: 0.4, textTransform: "uppercase" as const }}>Trust Boundary</div>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {connNodes.map(n => (
                  <CapBox key={n.id} nodeId={n.id} style={{ background: "#fff", border: "1px solid #f9a8d4", color: "#831843" }} />
                ))}
              </div>
            </div>

            {/* Flow arrow */}
            <div style={{ display: "flex", justifyContent: "center", gap: 24, padding: "5px 0" }}>
              {[0,1,2].map(i => (
                <svg key={i} width="2" height="22" viewBox="0 0 2 22" style={{ overflow: "visible" }}>
                  <line x1="1" y1="22" x2="1" y2="6" stroke="#94a3b8" strokeWidth="1.5" />
                  <polygon points="1,0 -3.5,8 5.5,8" fill="#94a3b8" />
                </svg>
              ))}
            </div>

            {/* Sources (external) */}
            <div style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: "10px 14px", background: "#f9fafb", position: "relative" }}>
              <div style={{ position: "absolute", top: -9, left: 20, background: "#fff", padding: "0 10px", fontSize: 8.5, fontWeight: 800, color: "#6b7280", letterSpacing: 1.2, textTransform: "uppercase" as const }}>EXTERNAL — SOURCE SYSTEMS (YOU DON'T OWN THESE)</div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, padding: "4px 0 0" }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: "#4b5563", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff", flexShrink: 0 }}>①</div>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#4b5563" }}>Source Systems</div>
                <div style={{ marginLeft: "auto", fontSize: 7.5, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "#f3f4f6", color: "#6b7280", letterSpacing: 0.4, textTransform: "uppercase" as const }}>8 Categories</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(diag.phases || []).filter(p => p.name.startsWith("L1")).map(phase => {
                  const label = phase.name.replace(/^L1\s*·\s*/, "");
                  const nodes = phase.nodeIds.map(id => getNode(id)).filter(Boolean);
                  if (!nodes.length) return null;
                  return (
                    <div key={phase.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px" }}>
                      <div style={{ fontSize: 7.5, fontWeight: 800, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 4, paddingBottom: 3, borderBottom: "1px solid #f3f4f6" }}>{label}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {nodes.map((n: any) => (
                          <div key={n.id} onClick={() => capClick(n.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 4px", borderRadius: 4, cursor: "pointer", outline: selectedCap === n.id ? "2px solid #1a73e8" : "none", outlineOffset: 1 }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ""; }}>
                            {n.icon && <img src={iconUrl(n.name, n.icon)} alt="" style={{ width: 16, height: 16, flexShrink: 0 }} />}
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#374151", lineHeight: 1.2 }}>{n.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {/* Fallback if no L1 phases */}
                {!(diag.phases || []).some(p => p.name.startsWith("L1")) && srcNodes.map(n => (
                  <CapBox key={n.id} nodeId={n.id} style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#374151" }} />
                ))}
              </div>
            </div>
          </div>
          {/* Spacer to match connector + pillar width */}
          <div style={{ width: 324, flexShrink: 0 }} />
        </div>
      </div>

    </div>
  );
}

/* ═══ GCP BLUEPRINT VIEW — STANDALONE, NO SHARED CODE WITH ENTERPRISE ═══ */
function GCPBlueprintView({ diag, popover, setPopover }: { diag: Diagram; popover: any; setPopover: (p: any) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isPan = useRef(false), panS = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const fit = useCallback(() => {
    if (!canvasRef.current || !contentRef.current) return;
    const cr = canvasRef.current.getBoundingClientRect();
    const el = contentRef.current;
    const cw = el.scrollWidth, ch = el.scrollHeight;
    const z = Math.min(cr.width / cw, cr.height / ch, 1.2) * 0.92;
    setZoom(z);
    setPan({ x: (cr.width - cw * z) / 2, y: Math.max(8, (cr.height - ch * z) / 2) });
  }, []);
  useEffect(() => { setTimeout(fit, 120); }, [fit]);

  const onWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); const rc = canvasRef.current?.getBoundingClientRect(); if (!rc) return; const mx = e.clientX - rc.left, my = e.clientY - rc.top, f = e.deltaY < 0 ? 1.1 : 0.9, nz = Math.max(0.15, Math.min(3, zoom * f)); setPan({ x: mx - (mx - pan.x) * (nz / zoom), y: my - (my - pan.y) * (nz / zoom) }); setZoom(nz); }, [zoom, pan]);
  const onDown = useCallback((e: React.MouseEvent) => { if (e.button === 0) { isPan.current = true; panS.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; } }, [pan]);
  const onMove = useCallback((e: React.MouseEvent) => { if (isPan.current) setPan({ x: panS.current.px + (e.clientX - panS.current.x), y: panS.current.py + (e.clientY - panS.current.y) }); }, []);
  const onUp = useCallback(() => { isPan.current = false; }, []);
  const g = (id: string) => diag.nodes.find(n => n.id === id);
  const byPfx = (p: string) => diag.nodes.filter(n => n.id.startsWith(p));
  const click = (id: string) => { if (sel === id) { setSel(null); setPopover(null); } else { setSel(id); setPopover({ type: "node", id }); } };
  const selBorder = (id: string) => sel === id ? "2px solid #1a73e8" : "none";

  // Icon lookup for pillar sub-items
  const pillarIconMap: Record<string, string> = {
    "Cloud IAM": "identity_and_access_management", "KMS": "key_management_service", "CMEK": "key_management_service",
    "VPC Service Controls": "virtual_private_cloud", "Security Command Center": "security_command_center",
    "Cloud Armor": "cloud_armor", "Wiz": "wiz", "Splunk SIEM": "splunk", "Splunk": "splunk",
    "Dataplex": "dataplex", "Data Catalog": "data_catalog", "Data Lineage": "data_catalog", "Cloud DLP": "cloud_natural_language_api",
    "Cloud Monitoring": "cloud_monitoring", "Cloud Logging": "cloud_logging", "Error Reporting": "error_reporting",
    "PagerDuty": "pagerduty", "Dynatrace": "dynatrace", "Datadog": "datadog", "Grafana": "grafana",
    "Cloud Composer": "cloud_composer", "Cloud Scheduler": "cloud_scheduler",
  };

  // Parse pillar bullet items
  const pillarItems = (id: string) => {
    const n = g(id);
    if (!n?.details?.notes) return [];
    return n.details.notes.split("\n").filter(l => l.trim().startsWith("•")).map(l => {
      const c = l.replace(/^[•\s]+/, "").trim();
      const m = c.match(/^([^(]+)\(([^)]+)\)/);
      const name = m ? m[1].trim() : c;
      // Find icon: try full name first, then first word before " · "
      const firstName = name.split(/\s*·\s*/)[0].trim();
      const ico = pillarIconMap[firstName] || pillarIconMap[name] || null;
      return { name: firstName, icon: ico };
    });
  };

  // Icon card — the core reusable piece
  const IC = ({ id, bg, border: bd }: { id: string; bg?: string; border?: string }) => {
    const n = g(id);
    if (!n) return null;
    const ic = n.icon ? iconUrl(n.name, n.icon) : null;
    const cat = getCat(n.icon, n.id);
    return (
      <div onClick={() => click(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", outline: selBorder(id), outlineOffset: 2, borderRadius: 8, padding: 2 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: bg || cat.bg, border: `1.5px solid ${bd || cat.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          {ic ? <img src={ic} alt="" style={{ width: 30, height: 30 }} /> : <div style={{ fontSize: 7, fontWeight: 800, color: "#666", textAlign: "center", lineHeight: 1.1 }}>{n.name.split(/[\s\/]/)[0]}</div>}
        </div>
        <div style={{ fontSize: 7, fontWeight: 700, color: "#333", textAlign: "center", lineHeight: 1.15 }}>{n.name}</div>
      </div>
    );
  };

  // Source groups
  const srcGroups = [
    { label: "SaaS / ERP", ids: ["src_salesforce", "src_workday", "src_servicenow", "src_sap"] },
    { label: "Databases", ids: ["src_oracle", "src_sqlserver", "src_postgresql", "src_mongodb"] },
    { label: "Streaming", ids: ["src_kafka"] },
    { label: "Files", ids: ["src_sftp"] },
    { label: "APIs", ids: ["src_rest_api"] },
    { label: "Legacy", ids: ["src_mainframe"] },
  ];

  // Connectivity groups
  const connGroups = [
    { label: "Identity & Auth", ids: ["conn_cloud_identity", "conn_identity_platform", "conn_iam"] },
    { label: "Vendor Identity", ids: ["conn_entra_id", "conn_cyberark", "conn_keeper"], vendor: true },
    { label: "Secrets & Network", ids: ["conn_secret_manager", "conn_vpn", "conn_interconnect", "conn_vpc", "conn_armor", "conn_dns"] },
    { label: "API Management", ids: ["conn_apigee", "conn_api_gateway"] },
  ];

  // GCP layers
  const layers = [
    { num: "L7–L8", title: "Serving & Consumption", color: "#0E7490", combined: true, groups: [
      { label: "Delivery", ids: ["serve_looker", "serve_run", "serve_hub", "serve_bi_engine"] },
      { label: "APIs", ids: ["conn_apigee", "conn_api_gateway"] },
      { label: "Consumers", ids: ["con_looker", "con_sheets", "con_vertex", "con_run", "con_hub", "con_powerbi", "con_tableau", "con_slicer"] },
    ] },
    { num: "L6", title: "Medallion", color: "#D97706", ids: ["bronze", "silver", "gold"] },
    { num: "L5", title: "Processing", color: "#6D28D9", ids: ["proc_dataflow", "proc_dataproc", "proc_bq_sql", "proc_dlp", "proc_matillion"] },
    { num: "L4", title: "Data Lake", color: "#047857", ids: ["lake_gcs", "lake_bq_staging"] },
    { num: "L3", title: "Ingestion", color: "#0369A1", ids: ["ing_datastream", "ing_pubsub", "ing_dataflow", "ing_functions", "ing_fivetran", "ing_matillion"] },
  ];

  // Pillars
  const pillars = [
    { id: "pillar_sec", color: "#DC2626", bg: "#FEF2F2" },
    { id: "pillar_gov", color: "#2563EB", bg: "#EFF6FF" },
    { id: "pillar_obs", color: "#D97706", bg: "#FFFBEB" },
    { id: "pillar_orch", color: "#7C3AED", bg: "#F5F3FF" },
  ];

  // Arrow
  const Arr = ({ color = "#94A3B8" }: { color?: string }) => (
    <div style={{ display: "flex", alignItems: "center", padding: "0 2px", flexShrink: 0 }}>
      <svg width="16" height="10"><line x1="0" y1="5" x2="10" y2="5" stroke={color} strokeWidth="1.5" strokeDasharray="3 2"/><polygon points="10,1.5 16,5 10,8.5" fill={color}/></svg>
    </div>
  );

  return (
    <div ref={canvasRef} style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", background: "#FAFAFD", flex: 1, overflow: "hidden", position: "relative", cursor: isPan.current ? "grabbing" : "grab" }}
      onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}>
      <div ref={contentRef} style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#1F2937", margin: 0, letterSpacing: -0.3 }}>{diag.title}</h1>
        <p style={{ fontSize: 9, color: "#6B7280", margin: "2px 0 0 0" }}>{diag.subtitle}</p>
      </div>

      <div style={{ width: 1800, display: "flex", flexDirection: "column", gap: 6 }}>

        {/* ═══ MAIN ROW: Sources → Connectivity → GCP Box ═══ */}
        <div style={{ display: "flex", gap: 4, alignItems: "stretch" }}>

          {/* ── SOURCES (Layer 1) ── */}
          <div style={{ width: 160, minWidth: 160, borderRadius: 10, border: "2px solid #D1D5DB", background: "#F9FAFB", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: "#4B5563", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.8, paddingBottom: 4, borderBottom: "1.5px solid #E5E7EB" }}>Layer 1 — Sources</div>
            {srcGroups.map(grp => {
              const nodes = grp.ids.map(id => g(id)).filter(Boolean);
              if (!nodes.length) return null;
              return (
                <div key={grp.label} style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 6px" }}>
                  <div style={{ fontSize: 6.5, fontWeight: 800, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3, paddingBottom: 2, borderBottom: "1px solid #F3F4F6" }}>{grp.label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))", gap: 4, justifyItems: "center" }}>
                    {nodes.map((n: any) => <IC key={n.id} id={n.id} />)}
                  </div>
                </div>
              );
            })}
          </div>

          <Arr color="#6B7280" />

          {/* ── CONNECTIVITY (Layer 2) ── */}
          <div style={{ width: 160, minWidth: 160, borderRadius: 10, border: "2px dashed #7C3AED40", background: "#7C3AED05", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: "#7C3AED", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.8, paddingBottom: 4, borderBottom: "1.5px solid #7C3AED20" }}>Layer 2 — Connectivity</div>
            {connGroups.map(grp => {
              const nodes = grp.ids.map(id => g(id)).filter(Boolean);
              if (!nodes.length) return null;
              return (
                <div key={grp.label} style={{ background: grp.vendor ? "#FFF8E1" : "#FFF", border: `1px ${grp.vendor ? "dashed" : "solid"} ${grp.vendor ? "#33415150" : "#7C3AED20"}`, borderRadius: 6, padding: "4px 6px" }}>
                  <div style={{ fontSize: 6.5, fontWeight: 800, color: grp.vendor ? "#334151" : "#7C3AED", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3, paddingBottom: 2, borderBottom: "1px solid #F3F4F6" }}>{grp.label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))", gap: 4, justifyItems: "center" }}>
                    {nodes.map((n: any) => <IC key={n.id} id={n.id} bg={grp.vendor ? "#FFF8E1" : undefined} border={grp.vendor ? "#33415140" : undefined} />)}
                  </div>
                </div>
              );
            })}
          </div>

          <Arr color="#4285F4" />

          {/* ── GCP CLOUD BOX (Layers 3–8 + Pillars) ── */}
          <div style={{ flex: 1, borderRadius: 12, border: "3px solid #4285F4", background: "#F0F6FF", padding: "14px 10px 10px 10px", position: "relative", display: "flex", gap: 16 }}>
            <div style={{ position: "absolute", top: -11, left: 14, background: "#4285F4", color: "#FFF", fontSize: 8, fontWeight: 800, padding: "2px 10px", borderRadius: 14, letterSpacing: 0.6 }}>☁️ GOOGLE CLOUD PLATFORM — Layers 3–8</div>

            {/* Layers stack */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, marginTop: 2 }}>
              {layers.map((layer: any, li: number) => (
                <div key={layer.num}>
                  <div style={{ background: `${layer.color}06`, borderRadius: 8, border: `1.5px solid ${layer.color}30`, padding: "6px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, paddingBottom: 3, borderBottom: `1px solid ${layer.color}20` }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: layer.color }}>{layer.num}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: layer.color, textTransform: "uppercase", letterSpacing: 0.3 }}>{layer.title}</span>
                    </div>
                    {layer.combined ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {layer.groups.map((grp: any) => (
                          <div key={grp.label}>
                            <div style={{ fontSize: 6.5, fontWeight: 800, color: layer.color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3, paddingBottom: 2, borderBottom: `1px solid ${layer.color}15` }}>{grp.label}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 6, justifyItems: "center" }}>
                              {grp.ids.map((id: string) => g(id) ? <IC key={id} id={id} bg={`${layer.color}08`} border={`${layer.color}40`} /> : null)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 6, justifyItems: "center" }}>
                        {layer.ids.map((id: string) => g(id) ? <IC key={id} id={id} bg={`${layer.color}08`} border={`${layer.color}40`} /> : null)}
                      </div>
                    )}
                  </div>
                  {li < layers.length - 1 && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "3px 0" }}>
                      <svg width="2" height="18" viewBox="0 0 2 18" style={{ overflow: "visible" }}>
                        <line x1="1" y1="18" x2="1" y2="6" stroke="#94A3B8" strokeWidth="1.5" />
                        <polygon points="1,0 -2.5,8 4.5,8" fill="#94A3B8" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pillars (right side) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2, width: 220, flexShrink: 0 }}>
              {pillars.map(p => {
                const node = g(p.id);
                const items = pillarItems(p.id);
                const pic = node?.icon ? iconUrl(node.name, node.icon) : null;
                return (
                  <div key={p.id} onClick={() => click(p.id)} style={{ flex: 1, background: p.bg, borderRadius: 8, border: `1.5px solid ${p.color}35`, padding: "6px 8px", cursor: "pointer", outline: selBorder(p.id), outlineOffset: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, paddingBottom: 3, borderBottom: `1px solid ${p.color}20` }}>
                      {pic && <img src={pic} alt="" style={{ width: 18, height: 18 }} />}
                      <div style={{ fontSize: 7, fontWeight: 800, color: p.color, letterSpacing: 0.3 }}>{node?.name || p.id}</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 4, justifyItems: "center" }}>
                      {items.map((item, j) => {
                        const icoPath = item.icon ? iconUrl(item.name, item.icon) : null;
                        return (
                          <div key={j} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${p.color}10`, border: `1.5px solid ${p.color}30`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                              {icoPath ? <img src={icoPath} alt="" style={{ width: 30, height: 30 }} /> : <div style={{ fontSize: 7, fontWeight: 800, color: p.color, opacity: 0.5, textAlign: "center", lineHeight: 1.1 }}>{item.name.split(/[\s\/]/)[0]}</div>}
                            </div>
                            <div style={{ fontSize: 7, fontWeight: 700, color: `${p.color}BB`, textAlign: "center", lineHeight: 1.15 }}>{item.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ LEGEND ═══ */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, padding: "4px 0", borderTop: "1px solid #E5E7EB" }}>
          {[
            { color: "#4285F4", label: "GCP (Layers 3–8)", style: "solid", w: 3 },
            { color: "#6B7280", label: "L1 Sources (External)", style: "solid", w: 2 },
            { color: "#7C3AED", label: "L2 Connectivity", style: "dashed", w: 2 },
            { color: "#334151", label: "⬡ Vendor (non-GCP)", style: "dashed", w: 1.5 },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 14, height: 7, borderRadius: 2, border: `${item.w}px ${item.style} ${item.color}`, background: item.style === "solid" ? `${item.color}12` : "transparent" }} />
              <span style={{ fontSize: 7, fontWeight: 600, color: "#6B7280" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      </div>

    {/* Controls */}
    <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 5, zIndex: 10 }}>
      {[{ l: "+", f: () => setZoom(z => Math.min(3, z * 1.2)) }, { l: "−", f: () => setZoom(z => Math.max(.15, z * .8)) }].map((b, i) =>
        <button key={i} onClick={b.f} style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", border: "1px solid #e0e0e0", fontSize: 16, color: "#333", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>{b.l}</button>)}
      <button onClick={fit} style={{ height: 32, padding: "0 12px", borderRadius: 8, background: "#fff", border: "1px solid #e0e0e0", fontSize: 11, fontWeight: 600, color: "#333", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>⊞ Fit</button>
      <div style={{ height: 32, padding: "0 10px", borderRadius: 8, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center" }}>{Math.round(zoom * 100)}%</div>
    </div>
    <div style={{ position: "absolute", bottom: 14, right: 14, background: "rgba(0,0,0,.5)", color: "#fff", padding: "6px 14px", borderRadius: 20, fontSize: 10, zIndex: 10 }}>Scroll zoom · Drag to pan</div>
    </div>
  );
}

/* ═══ SVG CANVAS ═══════════════════════════════════ */
function DiagramCanvas({ diag, setDiag, popover, setPopover, theme, onDragEnd, connectMode, connectSource, onConnectClick }: { diag: Diagram; setDiag: (d: Diagram) => void; popover: any; setPopover: (p: any) => void; theme: string; onDragEnd?: (d: Diagram) => void; connectMode?: boolean; connectSource?: string | null; onConnectClick?: (nodeId: string) => void }) {
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
    if (drag) {
      if (wasDrag.current && onDragEnd) onDragEnd(diagRef.current);
      setDrag(null); setTimeout(() => { wasDrag.current = false; }, 50);
    }
    if (groupDrag) {
      if (wasDrag.current && onDragEnd) onDragEnd(diagRef.current);
      setGroupDrag(null); setTimeout(() => { wasDrag.current = false; }, 50);
    }
  }, [drag, groupDrag, onDragEnd]);

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
  const zBounds = (ns: DiagNode[], px: number, py: number, minW?: number) => { if (!ns.length) return null; const xs = ns.map(n => n.x), ys = ns.map(n => n.y); return { x: Math.min(...xs) - px, y: Math.min(...ys) - py, w: Math.max(Math.max(...xs) - Math.min(...xs) + px * 2 + 80, minW || 0), h: Math.max(...ys) - Math.min(...ys) + py * 2 + 80 }; };
  // Smart edge routing: exits/enters correct side of node based on relative position
  const R = 38; // half node + small gap (BG=68 → 34 + 4)
  const edgePath = (fx: number, fy: number, tx: number, ty: number): { path: string; mx: number; my: number } => {
    const dx = tx - fx, dy = ty - fy;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    // Mostly horizontal
    if (adx > ady * 0.4) {
      const signX = dx > 0 ? 1 : -1;
      const x1 = fx + R * signX, x4 = tx - R * signX;
      if (ady < 14) { return { path: `M${x1},${fy} L${x4},${ty}`, mx: (x1 + x4) / 2, my: fy }; }
      const midX = (x1 + x4) / 2;
      return { path: `M${x1},${fy} L${midX},${fy} L${midX},${ty} L${x4},${ty}`, mx: midX, my: (fy + ty) / 2 };
    }
    // Mostly vertical
    const signY = dy > 0 ? 1 : -1;
    const y1 = fy + R * signY, y4 = ty - R * signY;
    if (adx < 14) { return { path: `M${fx},${y1} L${tx},${y4}`, mx: fx, my: (y1 + y4) / 2 }; }
    const midY = (y1 + y4) / 2;
    return { path: `M${fx},${y1} L${fx},${midY} L${tx},${midY} L${tx},${y4}`, mx: (fx + tx) / 2, my: midY };
  };

  const BG = 68, ICO = 50;
  const srcB = zBounds(byZone("sources"), 85, 80, 200);
  const cloudB = zBounds(byZone("cloud"), 80, 75);
  const conB = zBounds(byZone("consumers"), 85, 80, 200);
  const allXs = diag.nodes.map(n => n.x);
  const cx = allXs.length ? (Math.min(...allXs) + Math.max(...allXs)) / 2 : 600;
  const topY = Math.min(...diag.nodes.map(n => n.y)) - 100;

  // Phase group bounds
  const phaseBounds = (diag.phases || []).map(p => {
    const ns = p.nodeIds.map(id => diag.nodes.find(n => n.id === id)).filter(Boolean) as DiagNode[];
    if (!ns.length) return null;
    const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
    return { ...p, x: Math.min(...xs) - 55, y: Math.min(...ys) - 60, w: Math.max(...xs) - Math.min(...xs) + 150, h: Math.max(...ys) - Math.min(...ys) + 160 };
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
          <marker id="aP" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 .5,9 3.5,0 6.5" fill="#f472b6" /></marker>
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

        {/* Phase groups — for L1, L2, and Vendor (L3-L7 are shown as layer bands inside GCP) */}
        {phaseBounds.filter(p => p.name.includes("L1") || p.name.includes("L2") || p.name.includes("Vendor")).map((p, i) => {
          const isL2 = p.name.includes("L2");
          return (<g key={p.id} onMouseDown={e => startGroupDrag(p.nodeIds, e)} style={{ cursor: "move" }}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={10} fill={isL2 ? "rgba(244,114,182,0.06)" : "rgba(148,163,184,0.04)"} stroke={isL2 ? "rgba(244,114,182,0.3)" : "rgba(148,163,184,0.2)"} strokeWidth={1} strokeDasharray="5 3" />
            <text x={p.x + p.w / 2} y={p.y - 6} textAnchor="middle" style={{ fontSize: 8, fontWeight: 700, fill: isL2 ? "#be185d" : "#78909c", letterSpacing: 1, pointerEvents: "none" }}>{p.name.toUpperCase()}</text>
          </g>);
        })}

        {/* Layer bands matching Enterprise Blueprint BP_LAYERS colors exactly */}
        {(() => {
          const layerDefs = [
            { prefix: "L7", num: 7, label: "SERVING & DELIVERY", bg: "#fff7ed", border: "#fdba74", text: "#c2410c", numBg: "#c2410c" },
            { prefix: "L6", num: 6, label: "MEDALLION ARCHITECTURE", bg: "#fffbeb", border: "#fcd34d", text: "#d97706", numBg: "#d97706" },
            { prefix: "L5", num: 5, label: "PROCESSING & TRANSFORMATION", bg: "#f5f3ff", border: "#c4b5fd", text: "#6d28d9", numBg: "#6d28d9" },
            { prefix: "L4", num: 4, label: "DATA LAKE — RAW LANDING", bg: "#ecfdf5", border: "#6ee7b7", text: "#047857", numBg: "#047857" },
            { prefix: "L3", num: 3, label: "INGESTION", bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", numBg: "#1d4ed8" },
          ];
          const boxes: (typeof layerDefs[0] & { x: number; y: number; w: number; h: number })[] = [];
          layerDefs.forEach(ld => {
            const lp = phaseBounds.filter(p => p.name.startsWith(ld.prefix));
            if (!lp.length) return;
            const allNodes = lp.flatMap(p => p.nodeIds);
            const ns = allNodes.map(id => diag.nodes.find(n => n.id === id)).filter(Boolean) as DiagNode[];
            if (!ns.length) return;
            const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
            const gx = Math.min(...xs) - 70, gy = Math.min(...ys) - 55;
            const gw = Math.max(...xs) - Math.min(...xs) + 180;
            const gh = Math.max(...ys) - Math.min(...ys) + 150;
            boxes.push({ ...ld, x: gx, y: gy, w: gw, h: gh });
          });
          return (<g>
            {/* Layer bands */}
            {boxes.map((b) => (<g key={b.prefix}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={14} fill={b.bg} stroke={b.border} strokeWidth={1.5} />
              <g transform={`translate(${b.x + 10},${b.y + 12})`}>
                <rect width={22} height={22} rx={6} fill={b.numBg} />
                <text x={11} y={16} textAnchor="middle" style={{ fontSize: 12, fontWeight: 900, fill: "#fff" }}>{b.num}</text>
              </g>
              <text x={b.x + 40} y={b.y + 27} style={{ fontSize: 10, fontWeight: 800, fill: b.text, letterSpacing: 1 }}>{b.label}</text>
            </g>))}
            {/* Arrow: L2 connectivity phases → L3 (bottom of cloud) */}
            {boxes.length > 0 && (() => {
              const l2Phases = phaseBounds.filter(p => p.name.includes("L2"));
              const l3 = boxes[boxes.length - 1];
              if (!l2Phases.length) return null;
              const l2Right = Math.max(...l2Phases.map(p => p.x + p.w));
              const l2MidY = (Math.min(...l2Phases.map(p => p.y)) + Math.max(...l2Phases.map(p => p.y + p.h))) / 2;
              const x1 = l2Right, y1 = l2MidY;
              const x2 = l3.x, y2 = l3.y + l3.h / 2;
              const midX = (x1 + x2) / 2;
              return <path d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`} fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="6 3" />;
            })()}
            {/* Arrows: Sources → L2 connectivity */}
            {srcB && (() => {
              const l2Phases = phaseBounds.filter(p => p.name.includes("L2"));
              if (!l2Phases.length) return null;
              const l2Left = Math.min(...l2Phases.map(p => p.x));
              const l2Top = Math.min(...l2Phases.map(p => p.y));
              const l2Bot = Math.max(...l2Phases.map(p => p.y + p.h));
              return [0.25, 0.5, 0.75].map((f, i) => {
                const x1 = srcB.x + srcB.w, y1 = srcB.y + srcB.h * f;
                const y2 = l2Top + (l2Bot - l2Top) * f;
                const midX = (x1 + l2Left) / 2;
                return <path key={`s-l2-${i}`} d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${l2Left},${y2}`} fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="6 3" />;
              });
            })()}
            {/* Arrows between layers going upward: L3→L4→L5→L6→L7 */}
            {[...boxes].reverse().slice(0, -1).map((b, i, arr) => {
              const nb = [...boxes].reverse()[i + 1]; // next layer up
              const x1 = b.x + b.w / 2, y1 = b.y;
              const x2 = nb.x + nb.w / 2, y2 = nb.y + nb.h;
              const midY = (y1 + y2) / 2;
              return <path key={`up-${i}`} d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`} fill="none" stroke={nb.border} strokeWidth={1.5} strokeDasharray="6 3" />;
            })}
            {/* Arrow: L7 (top) → Consumers */}
            {conB && boxes.length > 0 && (() => {
              const l7 = boxes[0]; // L7 is first (top)
              const x1 = l7.x + l7.w, y1 = l7.y + l7.h / 2;
              const x2 = conB.x, y2 = conB.y + conB.h / 2;
              const midX = (x1 + x2) / 2;
              return <path d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`} fill="none" stroke="#67e8f9" strokeWidth={1.5} strokeDasharray="6 3" />;
            })()}
          </g>);
        })()}

        {/* Ops group — draggable */}
        {opsBound && diag.opsGroup && <g onMouseDown={e => startGroupDrag(diag.opsGroup!.nodeIds, e)} style={{ cursor: "move" }}>
          <rect x={opsBound.x} y={opsBound.y} width={opsBound.w} height={opsBound.h} rx={10} fill={isDark ? "rgba(84,110,122,0.1)" : "rgba(84,110,122,0.06)"} stroke={isDark ? "#37474f" : "#b0bec5"} strokeWidth={1.2} strokeDasharray="4 3" />
          <text x={opsBound.x + opsBound.w / 2} y={opsBound.y + 14} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: isDark ? "#607d8b" : "#90a4ae", letterSpacing: 1, pointerEvents: "none" }}>{(diag.opsGroup?.name || "OPS").toUpperCase()}</text>
        </g>}

        {/* Edges */}
        {diag.edges.map(edge => {
          const fn = diag.nodes.find(n => n.id === edge.from), tn = diag.nodes.find(n => n.id === edge.to); if (!fn || !tn) return null;
          const isCtrl = edge.edgeType === "control", isObs = edge.edgeType === "observe", isAlert = edge.edgeType === "alert", isOps = isCtrl || isObs || isAlert;
          const { path, mx, my } = edgePath(fn.x, fn.y, tn.x, tn.y);
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
            {isOps && edge.label && (() => {
              // Position label offset from path to avoid node overlap
              const dx = tn.x - fn.x, dy = tn.y - fn.y;
              const isVert = Math.abs(dy) > Math.abs(dx);
              const lx = isVert ? mx + 18 : mx;
              const ly = isVert ? my : my - 12;
              return (<g>
                <rect x={lx - 24} y={ly - 8} width={48} height={12} rx={3} fill={isDark ? "#1e1e1e" : "#fff"} fillOpacity={0.85} />
                <text x={lx} y={ly + 1} textAnchor="middle" style={{ fontSize: 7, fill: isAlert ? "#e53935" : isCtrl ? "#7986cb" : "#78909c", fontWeight: 600, pointerEvents: "none" }}>{edge.label}</text>
              </g>);
            })()}
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
          const ip = node.icon ? iconUrl(node.name, node.icon) : null;
          const sel = popover?.type === "node" && popover.id === node.id;
          const isConnSrc = connectMode && connectSource === node.id;
          const th2 = (diag.threats || []).filter(t => t.target === node.id);
          const cat = getCat(node.icon, node.id);
          return (<g key={node.id}
            onMouseDown={e => { if (connectMode) return; startDrag(node.id, e); }}
            onClick={e => { if (connectMode && onConnectClick) { e.stopPropagation(); onConnectClick(node.id); } }}
            onDoubleClick={e => { if (!connectMode) dblClick("node", node.id, e); }}
            style={{ cursor: connectMode ? "crosshair" : drag === node.id ? "grabbing" : "pointer" }}>
            {(sel || isConnSrc) && <rect x={node.x - BG / 2 - 6} y={node.y - BG / 2 - 6} width={BG + 12} height={BG + 12} rx={18} fill="none" stroke={isConnSrc ? "#e65100" : "#1a73e8"} strokeWidth={2.5} strokeDasharray="5 3" />}
            <rect x={node.x - BG / 2} y={node.y - BG / 2} width={BG} height={BG} rx={14} fill={ip ? (isDark ? cat.border + "20" : cat.bg) : (isDark ? cat.border + "30" : cat.bg)} stroke={isConnSrc ? "#e65100" : cat.border} strokeWidth={sel || isConnSrc ? 2.5 : 1.8} filter="url(#sh)" />
            {ip && <image href={ip} x={node.x - ICO / 2} y={node.y - ICO / 2} width={ICO} height={ICO} />}
            {!ip && <text x={node.x} y={node.y + 5} textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: isDark ? cat.border : cat.border, letterSpacing: 0.5, opacity: 0.7 }}>{node.name.length <= 8 ? node.name.toUpperCase() : node.name.split(/[\s\/]/)[0].toUpperCase()}</text>}
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
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const diagAreaRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { loadIcons() }, []);

  const loadTemplate = useCallback(async (templateId: string) => {
    setLoading(true); setError(""); setDiag(null); setPopover(null); setSource(null); setTab("diagram");
    try {
      const res = await fetch(`/api/templates/${templateId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Template not found");
      const diagram = await res.json();
      setDiag(diagram as Diagram);
      setSource("template");
    } catch (e: any) { setError(e.message) } setLoading(false);
  }, []);

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

  // Update edge function
  const updateEdge = useCallback((edgeId: string, patch: Partial<DiagEdge>) => {
    if (!diag) return;
    const newDiagram = { ...diag, edges: diag.edges.map(e => e.id === edgeId ? { ...e, ...patch } : e) };
    updateDiagram(newDiagram);
    setPopover(null);
  }, [diag, updateDiagram]);

  // Delete edge function
  const deleteEdge = useCallback((edgeId: string) => {
    if (!diag) return;
    const newDiagram = { ...diag, edges: diag.edges.filter(e => e.id !== edgeId) };
    updateDiagram(newDiagram);
    setPopover(null);
  }, [diag, updateDiagram]);

  // Connect mode: handle node click to create edge
  const handleConnectClick = useCallback((nodeId: string) => {
    if (!diag || !connectMode) return;
    if (!connectSource) {
      setConnectSource(nodeId);
      return;
    }
    if (connectSource === nodeId) { setConnectSource(null); return; }
    const fromNode = diag.nodes.find(n => n.id === connectSource);
    const toNode = diag.nodes.find(n => n.id === nodeId);
    const crosses = fromNode && toNode ? fromNode.zone !== toNode.zone : false;
    const maxStep = Math.max(0, ...diag.edges.filter(e => !e.edgeType || e.edgeType === "data").map(e => e.step));
    const newEdge: DiagEdge = {
      id: `edge_${Date.now()}`, from: connectSource, to: nodeId,
      label: "", step: maxStep + 1, edgeType: "data", crossesBoundary: crosses,
    };
    updateDiagram({ ...diag, edges: [...diag.edges, newEdge] });
    setConnectSource(null);
    setConnectMode(false);
  }, [diag, connectMode, connectSource, updateDiagram]);

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
    const zo: Record<string, { x: number; y: number }> = {}; // zone origins per node
    for (const z of zones) { if (!z.ns.length) continue; const xs = z.ns.map(n => n.x), ys = z.ns.map(n => n.y), p = 80; const zx = Math.min(...xs) - p, zy = Math.min(...ys) - p; const zId = id++; cells.push(`<mxCell id="${zId}" value="${esc(z.l)}" style="rounded=1;whiteSpace=wrap;fillColor=${z.c};strokeColor=${z.s};${z.d ? "dashed=1;" : ""}fontStyle=1;fontSize=14;verticalAlign=top;container=1;collapsible=0;" vertex="1" parent="1"><mxGeometry x="${zx}" y="${zy}" width="${Math.max(...xs) - Math.min(...xs) + p * 2 + 80}" height="${Math.max(...ys) - Math.min(...ys) + p * 2 + 80}" as="geometry"/></mxCell>`); z.ns.forEach(n => { zm[n.id] = zId; zo[n.id] = { x: zx, y: zy }; }); }
    for (const n of diag.nodes) { const nId = id++; nm[n.id] = nId; const cat = getCat(n.icon, n.id); const origin = zo[n.id] || { x: 0, y: 0 }; cells.push(`<mxCell id="${nId}" value="${esc(n.name)}${n.subtitle ? '&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;' + esc(n.subtitle) + '&lt;/font&gt;' : ''}" style="rounded=1;whiteSpace=wrap;fillColor=${cat.bg};strokeColor=${cat.border};fontStyle=1;fontSize=11;" vertex="1" parent="${zm[n.id] || 1}"><mxGeometry x="${n.x - 60 - origin.x}" y="${n.y - 40 - origin.y}" width="120" height="80" as="geometry"/></mxCell>`); }
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
            {[{ icon: "🏗️", name: "Data Analytics Blueprint", id: "blueprint-analytics", p: "enterprise data analytics platform blueprint with all layers" },
              { icon: "📊", name: "Enterprise Streaming", id: "streaming-analytics", p: "enterprise streaming analytics platform with comprehensive security governance disaster recovery and cost management" },
              { icon: "🔄", name: "CDC Migration", id: "cdc-migration", p: "migrate from AWS RDS to BigQuery CDC" },
              { icon: "🤖", name: "RAG / GenAI", id: "rag-genai", p: "RAG chatbot with Gemini and vector search" },
              { icon: "🗄️", name: "GCP Technical Blueprint", id: "gcp-technical-blueprint", p: "gcp technical blueprint sources connectivity identity secrets network vpn" },
            ].map((t, i) => (<button key={i} onClick={() => { setPrompt(t.p); loadTemplate(t.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fafafa", border: "1px solid #eee", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all .12s" }} onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; e.currentTarget.style.borderColor = "#4285f4"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fafafa"; e.currentTarget.style.borderColor = "#eee"; }}>
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
          {source && diag?.layout !== "blueprint" && <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 14, background: source === "template" ? "#e8f5e9" : "#fff3e0", color: source === "template" ? "#2e7d32" : "#e65100", fontWeight: 700 }}>{source === "template" ? "⚡ Template — instant, $0" : "🤖 AI Generated"}</span>}
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
        {diag && tab === "diagram" && diag.layout === "blueprint" && (
          <BlueprintView diag={diag} popover={popover} setPopover={setPopover} />
        )}
        {diag && tab === "diagram" && diag.layout === "gcp_blueprint" && (
          <GCPBlueprintView diag={diag} popover={popover} setPopover={setPopover} />
        )}
        {diag && tab === "diagram" && diag.layout !== "blueprint" && diag.layout !== "gcp_blueprint" && (
          <div ref={diagAreaRef} style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", background: THEMES[theme]?.bg || "#f8f9fa", overflow: "hidden" }}>
            
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
                    setConnectMode(false);
                    setConnectSource(null);
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
                connectMode={connectMode}
                onToggleConnect={() => { setConnectMode(!connectMode); setConnectSource(null); }}
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
              setDiag={setDiag}
              popover={popover} 
              setPopover={setPopover} 
              theme={theme}
              onDragEnd={editMode ? (d: Diagram) => { setIsDirty(true); saveToHistory(d); } : undefined}
              connectMode={connectMode}
              connectSource={connectSource}
              onConnectClick={editMode ? handleConnectClick : undefined}
            />

            {/* Enhanced popover for editing */}
            {popover && popover.type === "node" && (() => {
              const node = diag.nodes.find(n => n.id === popover.id);
              if (!node) return null;
              const threats = (diag.threats || []).filter(t => t.target === node.id);
              const rc = diagAreaRef.current?.getBoundingClientRect();
              const cw = rc?.width || 1200, ch = rc?.height || 800;
              const px = Math.min(popover.px + 10, cw - 470), py = Math.min(Math.max(popover.py - 60, 10), ch - 440);
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

            {/* Edge Popover — editable */}
            {popover && popover.type === "edge" && (() => {
              const edge = diag.edges.find(e => e.id === popover.id);
              if (!edge) return null;
              const rc = diagAreaRef.current?.getBoundingClientRect();
              const cw = rc?.width || 1200, ch = rc?.height || 800;
              const px = Math.min(popover.px + 10, cw - 420), py = Math.min(Math.max(popover.py - 60, 10), ch - 450);
              return (
                <div style={{ position: "absolute", left: px, top: py, zIndex: 200 }}>
                  <EdgeEditPop
                    edge={edge}
                    nodes={diag.nodes}
                    onClose={() => setPopover(null)}
                    onUpdate={updateEdge}
                    onDelete={deleteEdge}
                  />
                </div>
              );
            })()}

            {popover && popover.type === "gate" && (() => {
              // Compute gates from diagram data
              const cloudNodes = diag.nodes.filter(n => n.zone === "cloud");
              if (!cloudNodes.length) return null;
              const cxs = cloudNodes.map(n => n.x), cys = cloudNodes.map(n => n.y);
              const cB = { x: Math.min(...cxs) - 80, y: Math.min(...cys) - 75, w: Math.max(...cxs) - Math.min(...cxs) + 240, h: Math.max(...cys) - Math.min(...cys) + 230 };
              const allGates: Gate[] = [];
              diag.edges.filter(e => e.crossesBoundary && e.security).forEach(edge => {
                const fn = diag.nodes.find(n => n.id === edge.from), tn = diag.nodes.find(n => n.id === edge.to);
                if (!fn || !tn || !edge.security) return;
                if (fn.zone === "sources" && tn.zone === "cloud") allGates.push({ id: `gate-${edge.id}`, edgeId: edge.id, x: cB.x, y: fn.y, direction: "in", security: edge.security, fromName: fn.name, toName: tn.name, label: edge.label || "" });
                if (fn.zone === "cloud" && tn.zone === "consumers") allGates.push({ id: `gate-${edge.id}`, edgeId: edge.id, x: cB.x + cB.w, y: fn.y, direction: "out", security: edge.security, fromName: fn.name, toName: tn.name, label: edge.label || "" });
              });
              const gate = allGates.find(g => g.id === popover.id);
              if (!gate) return null;
              const threats = (diag.threats || []).filter(t => t.target === gate.edgeId);
              const rc = diagAreaRef.current?.getBoundingClientRect();
              const cw = rc?.width || 1200, ch = rc?.height || 800;
              const px = Math.min(popover.px + 10, cw - 390), py = Math.min(Math.max(popover.py - 60, 10), ch - 450);
              return (
                <div style={{ position: "absolute", left: px, top: py, zIndex: 200 }}>
                  <GatePop gate={gate} threats={threats} onClose={() => setPopover(null)} />
                </div>
              );
            })()}

            {/* Service Palette */}
            <ServicePalette
              visible={showServicePalette}
              onClose={() => setShowServicePalette(false)}
              onAddNode={addNode}
              resolveIcon={iconUrl}
            />
          </div>
        )}
        {diag && tab === "highlights" && <div style={{ flex: 1, overflow: "auto", background: "#fff" }}><HighlightsTab diag={diag} /></div>}
        {diag && tab === "flow" && <div style={{ flex: 1, overflow: "auto", background: "#fff" }}><FlowTab diag={diag} /></div>}
      </div>
    </div>
  );
}
