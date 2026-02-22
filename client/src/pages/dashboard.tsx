import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

/* ── Icons ─────────────────────────────────────────── */
interface IconEntry { id: string; name: string; path: string; aliases: string[] }
let IC: IconEntry[] = [];
async function loadIcons() { if (IC.length) return; try { IC = (await (await fetch("/icons/registry.json")).json()).icons || []; } catch {} }
function iconPath(n: string, h?: string): string | null {
  const l = (h || n).toLowerCase().trim();
  const m = IC.find(i => i.id === l) || IC.find(i => i.name.toLowerCase() === l) || IC.find(i => i.aliases.some(a => a === l || l.includes(a) || a.includes(l)));
  return m ? `/icons/gcp/${m.id}.svg` : null;
}

/* ── Palette ───────────────────────────────────────── */
const P: Record<string, { bg: string; bd: string; hc: string; ac: string }> = {
  actors:{bg:"#f8f9fa",bd:"#cfd8dc",hc:"#37474f",ac:"#546e7a"},
  channels:{bg:"#e8f5e9",bd:"#a5d6a7",hc:"#1b5e20",ac:"#43a047"},
  ingestion:{bg:"#fff3e0",bd:"#ffcc80",hc:"#e65100",ac:"#fb8c00"},
  processing:{bg:"#ede7f6",bd:"#b39ddb",hc:"#4527a0",ac:"#7e57c2"},
  ai:{bg:"#e3f2fd",bd:"#90caf9",hc:"#0d47a1",ac:"#1e88e5"},
  storage:{bg:"#fce4ec",bd:"#f48fb1",hc:"#880e4f",ac:"#e91e63"},
  serving:{bg:"#e0f7fa",bd:"#80deea",hc:"#006064",ac:"#00acc1"},
  output:{bg:"#fff8e1",bd:"#ffe082",hc:"#f57f17",ac:"#ffb300"},
  security:{bg:"#ffebee",bd:"#ef9a9a",hc:"#b71c1c",ac:"#e53935"},
  monitoring:{bg:"#e1f5fe",bd:"#81d4fa",hc:"#01579b",ac:"#039be5"},
};
const TB: Record<string, { s: string; f: string; l: string }> = {
  external:{s:"#78909c",f:"rgba(120,144,156,.04)",l:"#546e7a"},
  dmz:{s:"#ff9800",f:"rgba(255,152,0,.04)",l:"#e65100"},
  vpc:{s:"#4285f4",f:"rgba(66,133,244,.03)",l:"#1a73e8"},
  restricted:{s:"#ab47bc",f:"rgba(171,71,188,.04)",l:"#6a1b9a"},
};
const SEV: Record<string, string> = { critical:"#d32f2f", high:"#e65100", medium:"#f9a825", low:"#66bb6a" };

const SAMPLES = [
  { label: "Healthcare AI Pipeline", prompt: "Healthcare AI system: Patient data from Epic EHR and PACS imaging flows through FHIR API gateway to BigQuery. Vertex AI trains clinical prediction models. Cloud Run serves predictions to clinician Looker dashboard." },
  { label: "AWS to GCP Migration", prompt: "Transfer data from AWS RDS PostgreSQL and S3 data lake to GCP. Use Datastream for CDC replication, Dataflow for ETL, BigQuery for warehouse, Looker for dashboards, Cloud Run for data API." },
  { label: "RAG Chatbot", prompt: "RAG chatbot: Documents from Google Drive and Confluence chunked and embedded via Vertex AI, stored in Cloud SQL pgvector. User queries through React UI hit Cloud Run orchestrator, retrieval, Vertex AI Gemini generation, returns responses with citations." },
];

/* ── Types ──────────────────────────────────────────── */
interface CompDetails { project?: string; region?: string; resource?: string; serviceAccount?: string; iamRoles?: string[]; encryption?: string; monitoring?: string; guardrails?: string; compliance?: string[]; notes?: string }
interface Comp { id: string; name: string; icon?: string; subtitle?: string; details?: CompDetails }
interface Grp { id: string; name: string; category: string; cloud?: string; components: Comp[] }
interface Flow { from: string; to: string; label?: string; subtitle?: string; step?: number }
interface TBound { id: string; name: string; type: string; groups: string[] }
interface SecFlow { step: number; transport: string; auth: string; dataClassification: string; private: boolean }
interface Secret { component: string; store: string; credential: string; rotation: string }
interface Threat { id: string; location: string; locationType: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance: string | null }
interface CrossCutting { monitoring?: { tool?: string; alerting?: string; logging?: string; tracing?: string }; cicd?: { tool?: string; registry?: string; deploy?: string; iac?: string }; governance?: { catalog?: string; lineage?: string; orgPolicy?: string; tags?: Record<string, string> } }
interface Diag {
  title: string; subtitle?: string; groups: Grp[]; flows: Flow[];
  trustBoundaries?: TBound[]; security?: { flows?: SecFlow[]; secrets?: Secret[] }; threats?: Threat[];
  crossCutting?: CrossCutting;
}
type Sel = { t: "comp"; id: string } | { t: "f"; idx: number } | { t: "lock"; idx: number } | { t: "th"; id: string } | { t: "cross" } | null;

/* ── Helpers ────────────────────────────────────────── */
function secColor(sf?: SecFlow) {
  if (!sf) return "#90a4ae";
  if (sf.private) return "#43a047";
  if (sf.auth && sf.auth.toLowerCase() !== "none") return "#ff9800";
  return "#e53935";
}
function isExternal(g: Grp, tbs?: TBound[]): boolean {
  return g.cloud === "external" || g.category === "actors" || !!(tbs?.some(tb => tb.type === "external" && tb.groups.includes(g.id)));
}
function topoSort(gs: Grp[], fs: Flow[]) {
  const c2g: Record<string, string> = {}; gs.forEach(g => g.components.forEach(c => { c2g[c.id] = g.id }));
  const adj: Record<string, Set<string>> = {}, ind: Record<string, number> = {};
  gs.forEach(g => { adj[g.id] = new Set(); ind[g.id] = 0 });
  fs.forEach(f => { const a = c2g[f.from], b = c2g[f.to]; if (a && b && a !== b && !adj[a].has(b)) { adj[a].add(b); ind[b]++ } });
  const cols: string[][] = [], vis = new Set<string>();
  let q = gs.map(g => g.id).filter(id => ind[id] === 0);
  while (q.length) { cols.push([...q]); q.forEach(id => vis.add(id)); const nx: string[] = []; q.forEach(id => adj[id].forEach(t => { ind[t]--; if (!ind[t] && !vis.has(t)) nx.push(t) })); q = nx; }
  gs.forEach(g => { if (!vis.has(g.id)) cols.push([g.id]) });
  return cols;
}

/* ═══ LAYOUT ENGINE ════════════════════════════════ */
interface CPos { x: number; y: number; comp: Comp; grpId: string; category: string; isExt: boolean }

const ICON_SZ = 52;
const SRC_LANE_W = 180;
const COL_W = 170;
const COL_GAP = 50;
const ROW_H = 110;
const TOP_PAD = 80;
const SIDE_PAD = 50;
const CLOUD_GAP = 50;
const CLOUD_PAD = 30;
const CROSS_H = 70;

function computeLayout(diag: Diag) {
  const extGrpIds = new Set<string>();
  const gcpGrpIds: string[] = [];
  diag.groups.forEach(g => { if (isExternal(g, diag.trustBoundaries)) extGrpIds.add(g.id); else gcpGrpIds.push(g.id); });

  const gcpGroups = diag.groups.filter(g => gcpGrpIds.includes(g.id));
  const gcpCols = topoSort(gcpGroups, diag.flows);

  const positions: CPos[] = [];

  // External source positions
  const extGroups = diag.groups.filter(g => extGrpIds.has(g.id));
  let srcLabel = extGroups.map(g => g.name).join(" / ") || "Sources";
  let srcRow = 0;
  extGroups.forEach(g => {
    g.components.forEach(comp => {
      positions.push({ x: SIDE_PAD + SRC_LANE_W / 2, y: TOP_PAD + CLOUD_PAD + 30 + srcRow * ROW_H, comp, grpId: g.id, category: g.category, isExt: true });
      srcRow++;
    });
  });

  // GCP column positions
  const cloudX = SIDE_PAD + SRC_LANE_W + CLOUD_GAP;
  let maxGcpRow = 0;
  const colHeaders: { label: string; x: number; cat: string }[] = [];
  gcpCols.forEach((col, ci) => {
    let colRow = 0;
    const colX = cloudX + CLOUD_PAD + ci * (COL_W + COL_GAP);
    const grps = col.map(gid => diag.groups.find(g => g.id === gid)).filter(Boolean) as Grp[];
    colHeaders.push({ label: grps.map(g => g.name).join(" / "), x: colX, cat: grps[0]?.category || "processing" });
    grps.forEach(g => {
      g.components.forEach(comp => {
        positions.push({ x: colX + COL_W / 2, y: TOP_PAD + CLOUD_PAD + 30 + colRow * ROW_H, comp, grpId: g.id, category: g.category, isExt: false });
        colRow++;
      });
    });
    maxGcpRow = Math.max(maxGcpRow, colRow);
  });

  const numCols = gcpCols.length;
  const cloudW = CLOUD_PAD * 2 + numCols * COL_W + Math.max(0, numCols - 1) * COL_GAP;
  const bodyH = Math.max(srcRow, maxGcpRow) * ROW_H + 60;
  const cloudH = bodyH + CLOUD_PAD;

  const hasCross = !!(diag.crossCutting && (diag.crossCutting.monitoring?.tool || diag.crossCutting.cicd?.tool || diag.crossCutting.governance?.catalog));

  const W = cloudX + cloudW + SIDE_PAD;
  const H = TOP_PAD + cloudH + (hasCross ? CROSS_H + 10 : 0) + 20;

  const srcRect = extGroups.length > 0 ? { x: SIDE_PAD - 10, y: TOP_PAD, w: SRC_LANE_W + 20, h: cloudH, label: srcLabel } : null;
  const cloudRect = { x: cloudX, y: TOP_PAD, w: cloudW, h: cloudH };

  // TB zones inside cloud
  const tbZones: { tb: TBound; x: number; y: number; w: number; h: number; col: any }[] = [];
  (diag.trustBoundaries || []).forEach(tb => {
    if (tb.type === "external") return;
    const gcpInTb = tb.groups.filter(gid => gcpGrpIds.includes(gid));
    if (!gcpInTb.length) return;
    const colIndices: number[] = [];
    gcpCols.forEach((col, ci) => { if (col.some(gid => gcpInTb.includes(gid))) colIndices.push(ci); });
    if (!colIndices.length) return;
    const minC = Math.min(...colIndices), maxC = Math.max(...colIndices);
    const zx = cloudX + CLOUD_PAD + minC * (COL_W + COL_GAP) - 10;
    const zw = (maxC - minC + 1) * (COL_W + COL_GAP) - COL_GAP + 20;
    tbZones.push({ tb, x: zx, y: TOP_PAD + 24, w: zw, h: cloudH - 30, col: TB[tb.type] || TB.vpc });
  });

  return { positions, srcRect, cloudRect, colHeaders, tbZones, W, H, hasCross, cloudX, cloudW };
}

// Orthogonal arrow path
function orthoPath(sx: number, sy: number, tx: number, ty: number): string {
  const pad = ICON_SZ / 2 + 8;
  const x1 = sx + pad, x4 = tx - pad;
  if (Math.abs(sy - ty) < 4) return `M${x1},${sy} L${x4},${ty}`;
  const midX = (x1 + x4) / 2;
  return `M${x1},${sy} L${midX},${sy} L${midX},${ty} L${x4},${ty}`;
}

/* ═══ DETAIL PANELS ════════════════════════════════ */
function DetailInput({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (<div style={{ marginBottom: 6 }}>
    <label style={{ fontSize: 9, fontWeight: 700, color: "#999", letterSpacing: .3, display: "block", marginBottom: 2 }}>{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "—"} style={{ width: "100%", padding: "4px 7px", border: "1px solid #eee", borderRadius: 4, fontSize: 11, outline: "none", boxSizing: "border-box", fontFamily: mono ? "'Fira Code',monospace" : "inherit", color: "#333", background: value ? "#fff" : "#fafafa" }} />
  </div>);
}

function CompDetailPanel({ comp, diag, setDiag, onClose }: { comp: Comp; diag: Diag; setDiag: (d: Diag) => void; onClose: () => void }) {
  const d = comp.details || {};
  const secrets = (diag.security?.secrets || []).filter(s => s.component === comp.id);
  const threats = (diag.threats || []).filter(t => t.locationType === "component" && t.location === comp.id);
  const upD = (field: string, val: string) => {
    const nd = { ...d, [field]: val };
    setDiag({ ...diag, groups: diag.groups.map(g => ({ ...g, components: g.components.map(c => c.id === comp.id ? { ...c, details: nd } : c) })) });
  };
  const ip = iconPath(comp.name, comp.icon);
  return (<div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {ip && <img src={ip} width={28} height={28} alt="" />}
        <div><div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{comp.name}</div>
          {comp.subtitle && <div style={{ fontSize: 10, color: "#888" }}>{comp.subtitle}</div>}</div></div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>×</button></div>

    <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 4, marginBottom: 4 }}>INFRASTRUCTURE</div>
    <DetailInput label="GCP Project" value={d.project || ""} onChange={v => upD("project", v)} placeholder="acme-prod-123" mono />
    <DetailInput label="Region" value={d.region || ""} onChange={v => upD("region", v)} placeholder="us-central1" mono />
    <DetailInput label="Resource" value={d.resource || ""} onChange={v => upD("resource", v)} placeholder="dataset: clinical_fhir" mono />

    <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>🔐 IDENTITY & ACCESS</div>
    <DetailInput label="Service Account" value={d.serviceAccount || ""} onChange={v => upD("serviceAccount", v)} placeholder="sa-pipeline@acme.iam" mono />
    <DetailInput label="IAM Roles" value={(d.iamRoles || []).join(", ")} onChange={v => upD("iamRoles" as any, v)} placeholder="roles/bigquery.dataEditor" mono />

    <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>🔑 ENCRYPTION</div>
    <DetailInput label="Encryption" value={d.encryption || ""} onChange={v => upD("encryption", v)} placeholder="CMEK via KMS, 90-day rotate" />

    <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>📊 MONITORING</div>
    <DetailInput label="Monitoring" value={d.monitoring || ""} onChange={v => upD("monitoring", v)} placeholder="row_count alert → PagerDuty" />

    <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>🛡 GUARDRAILS</div>
    <DetailInput label="Guardrails" value={d.guardrails || ""} onChange={v => upD("guardrails", v)} placeholder="VPC-SC, column-level security" />

    <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>📋 COMPLIANCE</div>
    <DetailInput label="Compliance" value={(d.compliance || []).join(", ")} onChange={v => upD("compliance" as any, v)} placeholder="HIPAA, SOC2" />
    <DetailInput label="Notes" value={d.notes || ""} onChange={v => upD("notes", v)} placeholder="PHI data — restricted access" />

    {secrets.length > 0 && (<div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#ff9800", letterSpacing: 1, marginBottom: 4 }}>🔑 SECRETS</div>
      {secrets.map((s, i) => (<div key={i} style={{ padding: 6, background: "#fff8e1", borderRadius: 5, marginBottom: 3, fontSize: 10 }}>
        <div><b>{s.credential}</b></div>
        <div style={{ color: "#888" }}>{s.store} · rotate {s.rotation}</div></div>))}</div>)}

    {threats.length > 0 && (<div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#e53935", letterSpacing: 1, marginBottom: 4 }}>⚠ THREATS</div>
      {threats.map(t => (<div key={t.id} style={{ padding: 6, background: "#fff5f5", borderRadius: 5, marginBottom: 3, border: `1px solid ${SEV[t.severity]}22` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: SEV[t.severity] }}>{t.title}</div>
        <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{t.description}</div>
        <div style={{ fontSize: 9, color: "#43a047", marginTop: 2 }}>Fix: {t.mitigation}</div></div>))}</div>)}
  </div>);
}

function FlowDetailPanel({ flow, diag, idx, onClose }: { flow: Flow; diag: Diag; idx: number; onClose: () => void }) {
  const sf = diag.security?.flows?.find(s => s.step === flow.step);
  const threats = (diag.threats || []).filter(t => t.locationType === "flow" && t.location === String(flow.step));
  const fromComp = diag.groups.flatMap(g => g.components).find(c => c.id === flow.from);
  const toComp = diag.groups.flatMap(g => g.components).find(c => c.id === flow.to);
  const fromIp = fromComp ? iconPath(fromComp.name, fromComp.icon) : null;
  const toIp = toComp ? iconPath(toComp.name, toComp.icon) : null;
  return (<div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: "#5c6bc0", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>{flow.step}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{flow.label || "Flow"}</div></div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 20, padding: 0 }}>×</button></div>

    <div style={{ padding: 10, background: "#f5f5ff", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {fromIp ? <img src={fromIp} width={22} height={22} alt="" /> : <span style={{ fontSize: 14 }}>☁</span>}
        <span style={{ fontSize: 11, fontWeight: 600 }}>{fromComp?.name || flow.from}</span></div>
      <span style={{ color: "#5c6bc0", fontWeight: 700 }}>→</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {toIp ? <img src={toIp} width={22} height={22} alt="" /> : <span style={{ fontSize: 14 }}>☁</span>}
        <span style={{ fontSize: 11, fontWeight: 600 }}>{toComp?.name || flow.to}</span></div></div>

    {flow.subtitle && <div style={{ fontSize: 11, color: "#5c6bc0", fontStyle: "italic" }}>{flow.subtitle}</div>}

    {sf && (<>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 8 }}>SECURITY</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ padding: 8, background: "#f8f9fa", borderRadius: 6 }}><div style={{ fontSize: 8, color: "#999", fontWeight: 700 }}>TRANSPORT</div><div style={{ fontSize: 11, fontWeight: 600, color: "#333", marginTop: 2 }}>{sf.transport}</div></div>
        <div style={{ padding: 8, background: "#f8f9fa", borderRadius: 6 }}><div style={{ fontSize: 8, color: "#999", fontWeight: 700 }}>AUTH</div><div style={{ fontSize: 11, fontWeight: 600, color: "#333", marginTop: 2 }}>{sf.auth}</div></div>
        <div style={{ padding: 8, background: "#f8f9fa", borderRadius: 6 }}><div style={{ fontSize: 8, color: "#999", fontWeight: 700 }}>DATA CLASS</div><div style={{ fontSize: 11, fontWeight: 600, color: sf.dataClassification === "regulated" ? "#c62828" : sf.dataClassification === "confidential" ? "#e65100" : "#333", marginTop: 2 }}>{sf.dataClassification}</div></div>
        <div style={{ padding: 8, background: sf.private ? "#e8f5e9" : "#fff5f5", borderRadius: 6 }}><div style={{ fontSize: 8, color: "#999", fontWeight: 700 }}>NETWORK</div><div style={{ fontSize: 11, fontWeight: 600, color: sf.private ? "#2e7d32" : "#c62828", marginTop: 2 }}>{sf.private ? "🔒 Private" : "⚠ Internet-facing"}</div></div></div>
    </>)}

    {threats.length > 0 && (<div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#e53935", letterSpacing: 1, marginBottom: 4 }}>⚠ THREATS ON THIS FLOW</div>
      {threats.map(t => (<div key={t.id} style={{ padding: 8, background: "#fff5f5", borderRadius: 6, marginBottom: 4, borderLeft: `3px solid ${SEV[t.severity]}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: SEV[t.severity], color: "#fff" }}>{t.severity.toUpperCase()}</span><span style={{ fontSize: 11, fontWeight: 600 }}>{t.title}</span></div>
        <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>{t.description}</div>
        <div style={{ fontSize: 10, color: "#e65100", marginTop: 2 }}>Impact: {t.impact}</div>
        <div style={{ fontSize: 10, color: "#2e7d32", marginTop: 2 }}>Fix: {t.mitigation}</div>
        {t.compliance && t.compliance !== "null" && <div style={{ fontSize: 9, color: "#1a73e8", marginTop: 2 }}>📋 {t.compliance}</div>}
      </div>))}</div>)}
  </div>);
}

function LockDetailPanel({ flow, diag, onClose }: { flow: Flow; diag: Diag; onClose: () => void }) {
  const sf = diag.security?.flows?.find(s => s.step === flow.step);
  if (!sf) return null;
  const fromN = diag.groups.flatMap(g => g.components).find(c => c.id === flow.from)?.name || flow.from;
  const toN = diag.groups.flatMap(g => g.components).find(c => c.id === flow.to)?.name || flow.to;
  return (<div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: sf.private ? "#43a047" : "#e53935", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{sf.private ? "🔒" : "⚠"}</div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Connection Security</div></div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 20, padding: 0 }}>×</button></div>
    <div style={{ fontSize: 11, color: "#666" }}>Step {flow.step}: {fromN} → {toN}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
      {[{ l: "Transport Layer", v: sf.transport, icon: "🔗" }, { l: "Authentication", v: sf.auth, icon: "🪪" }, { l: "Data Classification", v: sf.dataClassification, icon: "📊" }].map((item, i) => (
        <div key={i} style={{ padding: 10, background: "#f8f9fa", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{item.icon}</span>
          <div><div style={{ fontSize: 8, color: "#999", fontWeight: 700, letterSpacing: .5 }}>{item.l.toUpperCase()}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#333", marginTop: 1 }}>{item.v}</div></div></div>))}
      <div style={{ padding: 10, background: sf.private ? "#e8f5e9" : "#fff5f5", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>{sf.private ? "🛡" : "🌐"}</span>
        <div><div style={{ fontSize: 8, color: "#999", fontWeight: 700, letterSpacing: .5 }}>NETWORK PATH</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: sf.private ? "#2e7d32" : "#c62828", marginTop: 1 }}>{sf.private ? "Private — VPC internal or VPN/Interconnect" : "Internet-facing — requires edge protection"}</div></div></div>
    </div>
  </div>);
}

function CrossCuttingPanel({ cc, onClose }: { cc: CrossCutting; onClose: () => void }) {
  return (<div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Cross-Cutting Concerns</div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 20, padding: 0 }}>×</button></div>
    {cc.monitoring && (<div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#1a73e8", letterSpacing: 1, marginBottom: 4 }}>📊 MONITORING & OBSERVABILITY</div>
      {[{ l: "Tool", v: cc.monitoring.tool }, { l: "Alerting", v: cc.monitoring.alerting }, { l: "Logging", v: cc.monitoring.logging }, { l: "Tracing", v: cc.monitoring.tracing }].filter(x => x.v).map((x, i) => (
        <div key={i} style={{ padding: 6, background: "#f0f7ff", borderRadius: 5, marginBottom: 3, fontSize: 10 }}><b>{x.l}:</b> {x.v}</div>))}</div>)}
    {cc.cicd && (<div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#7e57c2", letterSpacing: 1, marginBottom: 4 }}>🚀 CI/CD & DEPLOYMENT</div>
      {[{ l: "Build", v: cc.cicd.tool }, { l: "Registry", v: cc.cicd.registry }, { l: "Deploy", v: cc.cicd.deploy }, { l: "IaC", v: cc.cicd.iac }].filter(x => x.v).map((x, i) => (
        <div key={i} style={{ padding: 6, background: "#f3e5f5", borderRadius: 5, marginBottom: 3, fontSize: 10 }}><b>{x.l}:</b> {x.v}</div>))}</div>)}
    {cc.governance && (<div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#43a047", letterSpacing: 1, marginBottom: 4 }}>📋 GOVERNANCE</div>
      {[{ l: "Catalog", v: cc.governance.catalog }, { l: "Lineage", v: cc.governance.lineage }, { l: "Org Policy", v: cc.governance.orgPolicy }].filter(x => x.v).map((x, i) => (
        <div key={i} style={{ padding: 6, background: "#e8f5e9", borderRadius: 5, marginBottom: 3, fontSize: 10 }}><b>{x.l}:</b> {x.v}</div>))}</div>)}
  </div>);
}

/* ═══ CANVAS ═══════════════════════════════════════ */
function Canvas({ diag, sel, setSel }: { diag: Diag; sel: Sel; setSel: (s: Sel) => void }) {
  const layout = computeLayout(diag);
  const { positions, srcRect, cloudRect, colHeaders, tbZones, W, H, hasCross, cloudX, cloudW } = layout;
  const findPos = (cid: string) => positions.find(p => p.comp.id === cid);

  // Threat markers
  const threatMarkers = (diag.threats || []).map(th => {
    if (th.locationType === "component") { const cp = findPos(th.location); if (cp) return { th, x: cp.x + ICON_SZ / 2 + 2, y: cp.y - ICON_SZ / 2 - 2 }; }
    if (th.locationType === "flow") { const step = parseInt(th.location); const f = diag.flows.find(fl => fl.step === step); if (!f) return null; const sp = findPos(f.from), tp = findPos(f.to); if (sp && tp) return { th, x: (sp.x + tp.x) / 2, y: Math.min(sp.y, tp.y) - 24 }; }
    return null;
  }).filter(Boolean) as { th: Threat; x: number; y: number }[];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", fontFamily: "'Inter','DM Sans',system-ui,sans-serif" }} onClick={() => setSel(null)}>
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0.5,7 3,0 5.5" fill="#90a4ae" /></marker>
        <marker id="arrG" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0.5,7 3,0 5.5" fill="#43a047" /></marker>
        <marker id="arrO" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0.5,7 3,0 5.5" fill="#ff9800" /></marker>
        <marker id="arrR" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0.5,7 3,0 5.5" fill="#e53935" /></marker>
        <marker id="arrA" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0.5,7 3,0 5.5" fill="#1a73e8" /></marker>
        <filter id="sh"><feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity=".06" /></filter>
      </defs>
      <rect width={W} height={H} fill="#fff" rx={0} />

      {/* Title */}
      <text x={W / 2} y={28} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: "#111" }}>{diag.title}</text>
      {diag.subtitle && <text x={W / 2} y={46} textAnchor="middle" style={{ fontSize: 10, fill: "#888", fontStyle: "italic" }}>{diag.subtitle}</text>}

      {/* Source lane */}
      {srcRect && (<g>
        <rect x={srcRect.x} y={srcRect.y} width={srcRect.w} height={srcRect.h} rx={8} fill="#fafafa" stroke="#bdbdbd" strokeWidth={1.5} strokeDasharray="6 3" />
        <text x={srcRect.x + srcRect.w / 2} y={srcRect.y + 16} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: "#78909c", letterSpacing: .5 }}>{srcRect.label.toUpperCase()}</text>
      </g>)}

      {/* Cloud boundary */}
      <rect x={cloudRect.x} y={cloudRect.y} width={cloudRect.w} height={cloudRect.h} rx={10} fill="#f0f7ff" stroke="#4285f4" strokeWidth={1.8} />
      <g transform={`translate(${cloudRect.x + 10},${cloudRect.y + 4})`}>
        <rect width={112} height={20} rx={4} fill="#4285f4" />
        <text x={8} y={14} style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }}>Google Cloud</text></g>

      {/* TB zones */}
      {tbZones.map(({ tb, x, y, w, h, col }) => (<g key={tb.id}>
        <rect x={x} y={y} width={w} height={h} rx={6} fill={col.f} stroke={col.s} strokeWidth={1.2} strokeDasharray="5 3" />
        <text x={x + 6} y={y + 12} style={{ fontSize: 8, fontWeight: 700, fill: col.l, letterSpacing: .5 }}>{tb.name.toUpperCase()}</text></g>))}

      {/* Column headers */}
      {colHeaders.map((ch, i) => {
        const c = P[ch.cat] || P.processing;
        return <text key={i} x={ch.x + COL_W / 2} y={TOP_PAD + CLOUD_PAD + 18} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: c.hc, letterSpacing: .3 }}>{ch.label}</text>;
      })}

      {/* Arrows */}
      {diag.flows.map((f, fi) => {
        const sp = findPos(f.from), tp = findPos(f.to);
        if (!sp || !tp) return null;
        const step = f.step || fi + 1;
        const sf = diag.security?.flows?.find(s => s.step === step);
        const sc = secColor(sf);
        const isSel = (sel?.t === "f" && sel.idx === fi) || (sel?.t === "lock" && sel.idx === fi);
        const color = isSel ? "#1a73e8" : sc;
        const markerMap: Record<string, string> = { "#43a047": "url(#arrG)", "#ff9800": "url(#arrO)", "#e53935": "url(#arrR)", "#90a4ae": "url(#arr)" };
        const marker = isSel ? "url(#arrA)" : (markerMap[sc] || "url(#arr)");
        const path = orthoPath(sp.x, sp.y, tp.x, tp.y);
        const midX = (sp.x + tp.x) / 2, midY = (sp.y + tp.y) / 2;

        return (<g key={`f${fi}`}>
          {/* Invisible wide hit area for arrow */}
          <path d={path} fill="none" stroke="transparent" strokeWidth={18} onClick={e => { e.stopPropagation(); setSel({ t: "f", idx: fi }); }} style={{ cursor: "pointer" }} />
          {/* Visible arrow */}
          <path d={path} fill="none" stroke={color} strokeWidth={isSel ? 2.5 : 1.8} markerEnd={marker} strokeDasharray={sf?.private ? "" : "4 3"} />

          {/* Step badge */}
          <rect x={midX - 12} y={midY - 12} width={24} height={24} rx={5} fill={isSel ? "#1a73e8" : "#5c6bc0"} onClick={e => { e.stopPropagation(); setSel({ t: "f", idx: fi }); }} style={{ cursor: "pointer" }} />
          <text x={midX} y={midY + 4.5} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: "#fff", pointerEvents: "none" }}>{step}</text>

          {/* Lock icon — CLICKABLE */}
          {sf && (<g onClick={e => { e.stopPropagation(); setSel({ t: "lock", idx: fi }); }} style={{ cursor: "pointer" }} transform={`translate(${midX + 16},${midY - 8})`}>
            <circle r={9} fill="#fff" stroke={sf.private ? "#43a047" : "#e53935"} strokeWidth={1.5} />
            {sf.private ? (<g transform="translate(-5,-6) scale(0.7)"><rect x={2} y={6} width={10} height={7} rx={1.5} fill="#43a047" /><path d="M4,6 L4,3 A3,3 0 0,1 10,3 L10,6" fill="none" stroke="#43a047" strokeWidth={1.5} /></g>)
              : (<text y={4} textAnchor="middle" style={{ fontSize: 10, fill: "#e53935" }}>!</text>)}
          </g>)}

          {/* Label above arrow on hover/select */}
          {isSel && f.label && <text x={midX} y={midY - 20} textAnchor="middle" style={{ fontSize: 9, fontWeight: 600, fill: "#1a73e8", pointerEvents: "none" }}>{f.label}</text>}
          {isSel && f.subtitle && <text x={midX} y={midY + 24} textAnchor="middle" style={{ fontSize: 8, fill: "#5c6bc0", fontStyle: "italic", pointerEvents: "none" }}>{f.subtitle}</text>}
        </g>);
      })}

      {/* Components */}
      {positions.map(p => {
        const ip = iconPath(p.comp.name, p.comp.icon);
        const isSel = sel?.t === "comp" && sel.id === p.comp.id;
        const secrets = (diag.security?.secrets || []).filter(s => s.component === p.comp.id);
        return (<g key={p.comp.id} onClick={e => { e.stopPropagation(); setSel({ t: "comp", id: p.comp.id }); }} style={{ cursor: "pointer" }}>
          {isSel && <circle cx={p.x} cy={p.y} r={ICON_SZ / 2 + 8} fill="none" stroke="#1a73e8" strokeWidth={2} />}
          {ip ? <image href={ip} x={p.x - ICON_SZ / 2} y={p.y - ICON_SZ / 2} width={ICON_SZ} height={ICON_SZ} filter="url(#sh)" />
            : <g><rect x={p.x - ICON_SZ / 2} y={p.y - ICON_SZ / 2} width={ICON_SZ} height={ICON_SZ} rx={10} fill={p.isExt ? "#eceff1" : "#f5f5f5"} stroke={p.isExt ? "#90a4ae" : "#e0e0e0"} strokeWidth={1.5} filter="url(#sh)" /><text x={p.x} y={p.y + 5} textAnchor="middle" style={{ fontSize: 18, fill: p.isExt ? "#546e7a" : "#bbb" }}>{p.isExt ? "☁" : "?"}</text></g>}
          <text x={p.x} y={p.y + ICON_SZ / 2 + 14} textAnchor="middle" style={{ fontSize: 10, fontWeight: 600, fill: "#333", pointerEvents: "none" }}>{p.comp.name.length > 18 ? p.comp.name.slice(0, 17) + "…" : p.comp.name}</text>
          {p.comp.subtitle && <text x={p.x} y={p.y + ICON_SZ / 2 + 26} textAnchor="middle" style={{ fontSize: 8, fill: "#999", pointerEvents: "none" }}>{p.comp.subtitle}</text>}
          {secrets.length > 0 && <g transform={`translate(${p.x + ICON_SZ / 2 - 2},${p.y - ICON_SZ / 2 - 2})`}><circle r={7} fill="#fff" stroke="#ff9800" strokeWidth={1.2} /><text y={3} textAnchor="middle" style={{ fontSize: 7 }}>🔑</text></g>}
        </g>);
      })}

      {/* Threat markers */}
      {threatMarkers.map(({ th, x, y }) => { const isSel = sel?.t === "th" && sel.id === th.id; const col = SEV[th.severity];
        return (<g key={th.id} onClick={e => { e.stopPropagation(); setSel({ t: "th", id: th.id }); }} style={{ cursor: "pointer" }}>
          <polygon points={`${x},${y - 9} ${x - 7},${y + 3} ${x + 7},${y + 3}`} fill={isSel ? "#fff" : col} stroke={col} strokeWidth={1.5} />
          <text x={x} y={y} textAnchor="middle" style={{ fontSize: 7, fontWeight: 800, fill: isSel ? col : "#fff", pointerEvents: "none" }}>!</text></g>); })}

      {/* Cross-cutting band */}
      {hasCross && diag.crossCutting && (<g onClick={e => { e.stopPropagation(); setSel({ t: "cross" }); }} style={{ cursor: "pointer" }}>
        <rect x={cloudRect.x} y={cloudRect.y + cloudRect.h + 10} width={cloudRect.w} height={CROSS_H - 15} rx={8} fill={sel?.t === "cross" ? "#e8eaf6" : "#f5f5f5"} stroke={sel?.t === "cross" ? "#5c6bc0" : "#e0e0e0"} strokeWidth={1.2} />
        <g transform={`translate(${cloudRect.x + 16},${cloudRect.y + cloudRect.h + 28})`}>
          {[
            diag.crossCutting.monitoring?.tool && { icon: "📊", label: `Monitoring: ${diag.crossCutting.monitoring.tool}`, sub: diag.crossCutting.monitoring.alerting ? `→ ${diag.crossCutting.monitoring.alerting}` : "" },
            diag.crossCutting.cicd?.tool && { icon: "🚀", label: `CI/CD: ${diag.crossCutting.cicd.tool}`, sub: diag.crossCutting.cicd.iac || "" },
            diag.crossCutting.governance?.catalog && { icon: "📋", label: `Governance: ${diag.crossCutting.governance.catalog}`, sub: diag.crossCutting.governance.lineage || "" },
          ].filter(Boolean).map((item: any, i) => (
            <g key={i} transform={`translate(${i * (cloudRect.w / 3 - 10)},0)`}>
              <text y={0} style={{ fontSize: 9, fontWeight: 700, fill: "#555" }}>{item.icon} {item.label}</text>
              {item.sub && <text y={14} style={{ fontSize: 8, fill: "#999" }}>{item.sub}</text>}
            </g>))}
        </g>
      </g>)}
    </svg>
  );
}

/* ═══ MAIN DASHBOARD ═══════════════════════════════ */
export default function Dashboard({ user }: { user: User }) {
  const { logout, isLoggingOut } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diag, setDiag] = useState<Diag | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  useEffect(() => { loadIcons() }, []);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return; setLoading(true); setError(""); setDiag(null); setSel(null);
    try { const res = await fetch("/api/diagrams/generate", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ prompt }) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const d = (await res.json()).diagram as Diag; setDiag(d);
    } catch (e: any) { setError(e.message) } setLoading(false);
  }, [prompt]);

  // Sidebar content based on selection
  function renderSidebar() {
    if (!diag) return (<>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 4 }}>TEMPLATES</div>
      {SAMPLES.map((s, i) => (<button key={i} onClick={() => setPrompt(s.prompt)} style={{ width: "100%", textAlign: "left", padding: "8px 10px", background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 6, cursor: "pointer" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>{s.label}</div><div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{s.prompt.slice(0, 70)}...</div></button>))}</>);

    if (sel?.t === "comp") {
      const comp = diag.groups.flatMap(g => g.components).find(c => c.id === sel.id);
      if (comp) return <CompDetailPanel comp={comp} diag={diag} setDiag={setDiag} onClose={() => setSel(null)} />;
    }
    if (sel?.t === "f") {
      const flow = diag.flows[sel.idx];
      if (flow) return <FlowDetailPanel flow={flow} diag={diag} idx={sel.idx} onClose={() => setSel(null)} />;
    }
    if (sel?.t === "lock") {
      const flow = diag.flows[sel.idx];
      if (flow) return <LockDetailPanel flow={flow} diag={diag} onClose={() => setSel(null)} />;
    }
    if (sel?.t === "th") {
      const th = diag.threats?.find(t => t.id === sel.id);
      if (th) return (<div style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: SEV[th.severity] }}>⚠ {th.severity.toUpperCase()} THREAT</span>
          <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 20, padding: 0 }}>×</button></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 6 }}>{th.title}</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}><span style={{ padding: "2px 6px", background: "#f0f0f0", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>STRIDE: {th.stride}</span>
          {th.compliance && th.compliance !== "null" && <span style={{ padding: "2px 6px", background: "#e3f2fd", borderRadius: 3, fontSize: 9, fontWeight: 700, color: "#1a73e8" }}>{th.compliance}</span>}</div>
        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6, marginBottom: 8 }}>{th.description}</div>
        <div style={{ padding: 8, background: "#fff5f5", borderRadius: 6, fontSize: 11, marginBottom: 6 }}><b style={{ color: "#c62828" }}>Impact:</b> {th.impact}</div>
        <div style={{ padding: 8, background: "#e8f5e9", borderRadius: 6, fontSize: 11 }}><b style={{ color: "#2e7d32" }}>Mitigation:</b> {th.mitigation}</div>
      </div>);
    }
    if (sel?.t === "cross" && diag.crossCutting) {
      return <CrossCuttingPanel cc={diag.crossCutting} onClose={() => setSel(null)} />;
    }

    // Default: overview
    const threats = diag.threats || [];
    const sortedThreats = [...threats].sort((a, b) => { const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }; return (o[a.severity] ?? 4) - (o[b.severity] ?? 4); });
    return (<>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1 }}>CLICK ANYTHING TO SEE DETAILS</div>
      <div style={{ padding: 8, background: "#f0f7ff", borderRadius: 6, fontSize: 10, color: "#1a73e8", lineHeight: 1.5 }}>
        🔵 Click an <b>icon</b> — infrastructure details<br />
        🔗 Click an <b>arrow</b> — data flow details<br />
        🔒 Click a <b>lock</b> — connection security<br />
        ⚠ Click a <b>triangle</b> — threat details<br />
        📊 Click the <b>bottom band</b> — monitoring & governance
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 8 }}>DATA JOURNEY</div>
      {diag.flows.map((f, i) => (<div key={i} onClick={() => setSel({ t: "f", idx: i })} style={{ padding: "5px 8px", background: sel?.t === "f" && sel.idx === i ? "#f0f0ff" : "#fafafa", border: "1px solid #f0f0f0", borderRadius: 6, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 10, fontWeight: 700, color: "#5c6bc0", minWidth: 32 }}>Step {f.step}</span><span style={{ fontSize: 10, fontWeight: 600, color: "#333" }}>{f.label}</span></div>
        {f.subtitle && <div style={{ fontSize: 8, color: "#999", marginTop: 1, marginLeft: 38 }}>{f.subtitle}</div>}</div>))}
      {sortedThreats.length > 0 && (<><div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: 1, marginTop: 8 }}>THREATS</div>
        {sortedThreats.map(t => (<button key={t.id} onClick={() => setSel({ t: "th", id: t.id })} style={{ width: "100%", textAlign: "left", padding: "5px 8px", marginBottom: 2, borderRadius: 5, cursor: "pointer", background: "#fafafa", border: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: SEV[t.severity], flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div></div></button>))}</>)}
      <div style={{ padding: 10, background: "#f8f9fa", borderRadius: 6, border: "1px solid #f0f0f0", marginTop: "auto" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{[{ n: diag.groups.flatMap(g => g.components).length, l: "Services" }, { n: diag.flows.length, l: "Flows" }, { n: threats.length, l: "Threats" }].map((s, i) => (<div key={i}><div style={{ fontSize: 14, fontWeight: 700, color: "#212529" }}>{s.n}</div><div style={{ fontSize: 8, color: "#aaa" }}>{s.l}</div></div>))}</div></div>
    </>);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter','DM Sans',system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp .3s ease-out}textarea:focus{border-color:#333!important;background:#fff!important}`}</style>

      {/* Header */}
      <div style={{ height: 52, padding: "0 20px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#1a73e8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>◇</div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>ArchGen</span>
          <span style={{ fontSize: 9, background: "#e8f0fe", color: "#1a73e8", padding: "2px 6px", borderRadius: 3, fontWeight: 600 }}>BETA</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#aaa" }}>{user.firstName || user.email}</span>
          <button onClick={() => logout()} disabled={isLoggingOut} style={{ background: "none", border: "1px solid #eee", padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#999", cursor: "pointer" }}>Logout</button></div></div>

      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* Sidebar */}
        <div style={{ width: 310, borderRight: "1px solid #f0f0f0", padding: 14, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flexShrink: 0 }}>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate() }} placeholder="Describe your architecture..." style={{ width: "100%", minHeight: 80, padding: 10, border: "1px solid #eee", borderRadius: 8, fontSize: 12, color: "#333", outline: "none", resize: "vertical", lineHeight: 1.6, background: "#fafafa", boxSizing: "border-box" }} />
          <button onClick={generate} disabled={loading || !prompt.trim()} style={{ width: "100%", padding: "9px 0", background: loading ? "#666" : "#1a73e8", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: !prompt.trim() ? .3 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading && <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .6s linear infinite" }} />}
            {loading ? "Generating..." : "Generate Architecture"}</button>
          {error && <div style={{ padding: 8, borderRadius: 6, background: "#fff5f5", border: "1px solid #fecaca", color: "#dc2626", fontSize: 11 }}>{error}</div>}
          {renderSidebar()}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#fafafa" }}>
          {!diag && !loading && <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}><div style={{ fontSize: 48, color: "#e0e0e0" }}>◇</div><div style={{ color: "#bbb", fontSize: 13 }}>Describe a system to generate its architecture</div></div>}
          {loading && <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}><div style={{ width: 28, height: 28, border: "3px solid #e5e5e5", borderTopColor: "#1a73e8", borderRadius: "50%", animation: "spin .7s linear infinite" }} /><div style={{ color: "#999", fontSize: 13 }}>Analyzing architecture patterns...</div></div>}
          {diag && <div className="fade-up" style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e5e5", display: "inline-block", boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
            <Canvas diag={diag} sel={sel} setSel={setSel} /></div>}
        </div>
      </div>
    </div>
  );
}
