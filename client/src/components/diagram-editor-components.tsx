// ═══ COMPREHENSIVE DIAGRAM EDITOR ═══

import React, { useState } from "react";

// Types shared with dashboard.tsx
interface DiagNode {
  id: string;
  name: string;
  icon?: string | null;
  subtitle?: string;
  zone: "sources" | "cloud" | "consumers";
  x: number;
  y: number;
  details?: {
    project?: string;
    region?: string;
    encryption?: string;
    monitoring?: string;
    alerting?: string;
    cost?: string;
    guardrails?: string;
    compliance?: string;
    notes?: string;
  };
}

interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean; network?: string; vpcsc?: string; dlp?: string; keyRotation?: string; egressPolicy?: string; compliance?: string }
interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean; edgeType?: "data" | "control" | "observe" | "alert" }

interface Threat {
  id: string;
  target: string;
  stride: string;
  severity: string;
  title: string;
  description: string;
  impact: string;
  mitigation: string;
  compliance?: string | null;
}

/* ── GCP Services Palette ──────────────────────── */
const GCP_SERVICES = [
  { id: "compute_engine", name: "Compute Engine", subtitle: "Virtual Machines", category: "Compute" },
  { id: "cloud_run", name: "Cloud Run", subtitle: "Serverless Containers", category: "Compute" },
  { id: "cloud_functions", name: "Cloud Functions", subtitle: "Serverless Functions", category: "Compute" },
  { id: "google_kubernetes_engine", name: "GKE", subtitle: "Kubernetes", category: "Compute" },
  
  { id: "cloud_storage", name: "Cloud Storage", subtitle: "Object Storage", category: "Storage" },
  { id: "bigquery", name: "BigQuery", subtitle: "Data Warehouse", category: "Storage" },
  { id: "cloud_sql", name: "Cloud SQL", subtitle: "Managed SQL", category: "Storage" },
  { id: "firestore", name: "Firestore", subtitle: "NoSQL Database", category: "Storage" },
  
  { id: "pubsub", name: "Pub/Sub", subtitle: "Messaging", category: "Analytics" },
  { id: "dataflow", name: "Dataflow", subtitle: "Stream Processing", category: "Analytics" },
  { id: "dataproc", name: "Dataproc", subtitle: "Spark/Hadoop", category: "Analytics" },
  { id: "looker", name: "Looker", subtitle: "Business Intelligence", category: "Analytics" },
  
  { id: "cloud_load_balancing", name: "Load Balancer", subtitle: "Traffic Distribution", category: "Network" },
  { id: "cloud_armor", name: "Cloud Armor", subtitle: "WAF & DDoS", category: "Network" },
  { id: "cloud_vpn", name: "Cloud VPN", subtitle: "Secure Tunnel", category: "Network" },
  { id: "virtual_private_cloud", name: "VPC", subtitle: "Private Network", category: "Network" },
  
  { id: "identity_and_access_management", name: "IAM", subtitle: "Identity & Access", category: "Security" },
  { id: "key_management_service", name: "KMS", subtitle: "Key Management", category: "Security" },
  { id: "secret_manager", name: "Secret Manager", subtitle: "Secrets Vault", category: "Security" },
  
  { id: "cloud_monitoring", name: "Monitoring", subtitle: "Observability", category: "Operations" },
  { id: "cloud_logging", name: "Logging", subtitle: "Log Management", category: "Operations" },
  { id: "cloud_scheduler", name: "Scheduler", subtitle: "Cron Jobs", category: "Operations" },
];

/* ── Service Palette Component ──────────────────── */
function ServicePalette({ onAddNode, visible, onClose, resolveIcon }: { 
  onAddNode: (service: any) => void; 
  visible: boolean; 
  onClose: () => void;
  resolveIcon?: (name: string, hint?: string) => string | null;
}) {
  const [selectedCategory, setSelectedCategory] = useState("Compute");
  const categories = Array.from(new Set(GCP_SERVICES.map(s => s.category)));
  const filteredServices = GCP_SERVICES.filter(s => s.category === selectedCategory);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        width: "600px", maxHeight: "500px", background: "#fff",
        borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: "16px 20px", background: "linear-gradient(135deg, #4285f4, #1a73e8)",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Add GCP Service</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.9 }}>Choose a service to add to your architecture</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e0e0e0" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
                padding: "6px 12px", background: selectedCategory === cat ? "#e3f2fd" : "#f8f9fa",
                color: selectedCategory === cat ? "#1565c0" : "#666", border: "1px solid #e0e0e0",
                borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: selectedCategory === cat ? 700 : 400
              }}>{cat}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: "16px 20px", maxHeight: "300px", overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {filteredServices.map(service => {
              const ip = resolveIcon ? resolveIcon(service.name, service.id) : null;
              return (
                <button key={service.id} onClick={() => { onAddNode(service); onClose(); }} style={{
                  padding: "12px", background: "#fff", border: "2px solid #e0e0e0", borderRadius: 8,
                  textAlign: "left", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 12
                }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#4285f4"; e.currentTarget.style.background = "#f8fbff"; }}
                   onMouseLeave={e => { e.currentTarget.style.borderColor = "#e0e0e0"; e.currentTarget.style.background = "#fff"; }}>
                  {ip ? <img src={ip} width={24} height={24} alt="" /> : <div style={{ width: 24, height: 24, borderRadius: 6, background: "#e8eaf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#5c6bc0" }}>☁</div>}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{service.name}</div>
                    <div style={{ fontSize: 10, color: "#666" }}>{service.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Enhanced Node Popover (Full Editing) ────────── */
function EnhancedNodePopover({ node, threats, onClose, onUpdate, onDelete }: { 
  node: DiagNode; threats: Threat[]; onClose: () => void; 
  onUpdate: (id: string, patch: Partial<DiagNode>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: node.name, subtitle: node.subtitle || "", zone: node.zone, details: { ...node.details }
  });

  const handleSave = () => {
    onUpdate(node.id, { name: formData.name, subtitle: formData.subtitle || undefined, zone: formData.zone as any, details: { ...formData.details } });
    setEditing(false);
  };
  const handleDetailChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, details: { ...prev.details, [field]: value } }));
  };

  const detailFields = [
    { key: "project", label: "GCP Project" }, { key: "region", label: "Region" },
    { key: "encryption", label: "Encryption" }, { key: "monitoring", label: "Monitoring" },
    { key: "alerting", label: "Alerting" }, { key: "cost", label: "Cost" },
    { key: "guardrails", label: "Guardrails" }, { key: "compliance", label: "Compliance" },
    { key: "notes", label: "Notes" }
  ];

  return (
    <div style={{ width: 450, maxHeight: 600, background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: "1px solid #e8e8e8", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #fafbfc, #f0f2f5)", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#e8eaf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>☁</div>
        <div style={{ flex: 1 }}>
          {editing ? (<>
            <input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} style={{ fontSize: 16, fontWeight: 700, border: "2px solid #4285f4", borderRadius: 6, padding: "4px 8px", width: "100%", outline: "none", background: "#fff" }} />
            <input value={formData.subtitle} onChange={e => setFormData(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Subtitle (optional)" style={{ fontSize: 11, border: "1px solid #ddd", borderRadius: 4, padding: "4px 8px", width: "100%", marginTop: 4, outline: "none" }} />
            <select value={formData.zone} onChange={e => setFormData(prev => ({ ...prev, zone: e.target.value as any }))} style={{ fontSize: 11, border: "1px solid #ddd", borderRadius: 4, padding: "4px 8px", marginTop: 4, outline: "none" }}>
              <option value="sources">Sources</option><option value="cloud">Cloud</option><option value="consumers">Consumers</option>
            </select>
          </>) : (<>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#333" }}>{node.name}</div>
            {node.subtitle && <div style={{ fontSize: 11, color: "#666" }}>{node.subtitle}</div>}
            <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{node.zone}</div>
          </>)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {editing ? (<>
            <button onClick={handleSave} style={{ background: "#4caf50", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓ Save</button>
            <button onClick={() => { setEditing(false); setFormData({ name: node.name, subtitle: node.subtitle || "", zone: node.zone, details: { ...node.details } }); }} style={{ background: "#666", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>✕</button>
          </>) : (<>
            <button onClick={() => setEditing(true)} style={{ background: "#1a73e8", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Edit</button>
            <button onClick={() => { if (confirm(`Delete ${node.name}?`)) { onDelete(node.id); onClose(); } }} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🗑️ Delete</button>
          </>)}
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#ccc", cursor: "pointer" }}>×</button>
        </div>
      </div>
      <div style={{ padding: "16px 20px", maxHeight: 400, overflow: "auto" }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {detailFields.map(field => (
              <div key={field.key}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{field.label}</label>
                <textarea value={(formData.details as any)[field.key] || ""} onChange={e => handleDetailChange(field.key, e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}...`} rows={field.key === 'notes' ? 4 : 2} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
              </div>
            ))}
          </div>
        ) : (<>
          {detailFields.filter(f => (node.details as any)?.[f.key]).map(field => (
            <div key={field.key} style={{ padding: "10px 12px", background: "#f8f9fa", borderRadius: 8, marginBottom: 8, borderLeft: "3px solid #e0e0e0" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#aaa", letterSpacing: 0.8, marginBottom: 4 }}>{field.label.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{(node.details as any)[field.key]}</div>
            </div>
          ))}
          {threats.length > 0 && <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#e53935", letterSpacing: 0.8, marginBottom: 8 }}>⚠ SECURITY THREATS</div>
            {threats.map(threat => (
              <div key={threat.id} style={{ padding: 10, background: "#fff5f5", borderRadius: 6, marginBottom: 6, borderLeft: `3px solid ${threat.severity === 'critical' ? '#b71c1c' : threat.severity === 'high' ? '#e53935' : '#fb8c00'}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: threat.severity === 'critical' ? '#b71c1c' : threat.severity === 'high' ? '#e53935' : '#fb8c00' }}>{threat.title}</div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{threat.description}</div>
                <div style={{ fontSize: 10, color: "#2e7d32", marginTop: 4 }}>✓ {threat.mitigation}</div>
              </div>
            ))}
          </div>}
        </>)}
      </div>
    </div>
  );
}

/* ── Edge Edit Popover (NEW — edit/delete/re-endpoint edges) ── */
function EdgeEditPop({ edge, nodes, onClose, onUpdate, onDelete }: {
  edge: DiagEdge; nodes: DiagNode[]; onClose: () => void;
  onUpdate: (edgeId: string, patch: Partial<DiagEdge>) => void;
  onDelete: (edgeId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const fn = nodes.find(n => n.id === edge.from);
  const tn = nodes.find(n => n.id === edge.to);
  const [form, setForm] = useState({
    label: edge.label || "", subtitle: edge.subtitle || "", step: edge.step,
    from: edge.from, to: edge.to, edgeType: edge.edgeType || "data",
    crossesBoundary: edge.crossesBoundary || false,
    transport: edge.security?.transport || "", auth: edge.security?.auth || "",
    classification: edge.security?.classification || "", isPrivate: edge.security?.private || false,
  });

  const handleSave = () => {
    const fromNode = nodes.find(n => n.id === form.from);
    const toNode = nodes.find(n => n.id === form.to);
    const crosses = fromNode && toNode ? fromNode.zone !== toNode.zone : form.crossesBoundary;
    onUpdate(edge.id, {
      label: form.label || undefined, subtitle: form.subtitle || undefined,
      step: form.step, from: form.from, to: form.to, edgeType: form.edgeType as any,
      crossesBoundary: crosses,
      security: (form.transport || form.auth) ? {
        transport: form.transport, auth: form.auth, classification: form.classification, private: form.isPrivate,
      } : edge.security,
    });
    setEditing(false);
  };

  return (
    <div style={{ width: 400, background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.3)", border: "1px solid #e8e8e8", overflow: "hidden", fontFamily: "'Inter',system-ui,sans-serif" }} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", background: "linear-gradient(135deg,#f5f5ff,#eee8ff)", borderBottom: "1px solid #e8e8ff", display: "flex", alignItems: "center", gap: 8 }}>
        {edge.step > 0 && <div style={{ width: 30, height: 30, borderRadius: 8, background: edge.crossesBoundary ? "#e65100" : "#5c6bc0", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 900 }}>{edge.step}</div>}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{edge.label || "Connection"}</div>
          <div style={{ fontSize: 10, color: "#888" }}>{fn?.name || edge.from} → {tn?.name || edge.to}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {editing ? (<>
            <button onClick={handleSave} style={{ background: "#4caf50", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓ Save</button>
            <button onClick={() => setEditing(false)} style={{ background: "#666", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>✕</button>
          </>) : (<>
            <button onClick={() => setEditing(true)} style={{ background: "#1a73e8", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Edit</button>
            <button onClick={() => { if (confirm("Delete this connection?")) { onDelete(edge.id); onClose(); } }} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🗑️</button>
          </>)}
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#ccc", cursor: "pointer" }}>×</button>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: "12px 16px", maxHeight: 420, overflowY: "auto" }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: .5 }}>LABEL</label>
              <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", marginTop: 2 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: .5 }}>SUBTITLE / DETAIL</label>
              <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", marginTop: 2 }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: .5 }}>STEP #</label>
                <input type="number" value={form.step} onChange={e => setForm({ ...form, step: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", marginTop: 2 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: .5 }}>TYPE</label>
                <select value={form.edgeType} onChange={e => setForm({ ...form, edgeType: e.target.value as any })} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", marginTop: 2 }}>
                  <option value="data">Data</option><option value="control">Control</option>
                  <option value="observe">Observe</option><option value="alert">Alert</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: .5 }}>FROM</label>
                <select value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", marginTop: 2 }}>
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: .5 }}>TO</label>
                <select value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", marginTop: 2 }}>
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #eee", paddingTop: 10, marginTop: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: .5, marginBottom: 6 }}>SECURITY</div>
              <input value={form.transport} onChange={e => setForm({ ...form, transport: e.target.value })} placeholder="Transport (e.g. TLS 1.3)" style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", marginBottom: 6 }} />
              <input value={form.auth} onChange={e => setForm({ ...form, auth: e.target.value })} placeholder="Auth (e.g. OAuth 2.0)" style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", marginBottom: 6 }} />
              <input value={form.classification} onChange={e => setForm({ ...form, classification: e.target.value })} placeholder="Classification (e.g. Confidential)" style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, outline: "none", marginBottom: 6 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#555", cursor: "pointer" }}>
                <input type="checkbox" checked={form.isPrivate} onChange={e => setForm({ ...form, isPrivate: e.target.checked })} /> Private (VPC internal)
              </label>
            </div>
          </div>
        ) : (<>
          {edge.security && [
            { l: "Transport", v: edge.security.transport, c: "#1565c0", icon: "🔐" },
            { l: "Authentication", v: edge.security.auth, c: "#f57f17", icon: "🔑" },
            { l: "Classification", v: edge.security.classification, c: "#6a1b9a", icon: "🏷️" },
            { l: "Network", v: edge.security.private ? "Private VPC" : "Internet / Public", c: edge.security.private ? "#2e7d32" : "#c62828", icon: edge.security.private ? "☁️" : "🌍" },
          ].map(f => (
            <div key={f.l} style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6, marginBottom: 4, borderLeft: `3px solid ${f.c}` }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: "#aaa", letterSpacing: .8 }}>{f.icon} {f.l.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: "#333" }}>{f.v}</div>
            </div>
          ))}
          {edge.subtitle && <div style={{ padding: "6px 10px", background: "#f8f9fa", borderRadius: 6, marginTop: 4 }}><div style={{ fontSize: 8, fontWeight: 800, color: "#aaa", letterSpacing: .8 }}>DETAIL</div><div style={{ fontSize: 10, color: "#555" }}>{edge.subtitle}</div></div>}
          {!edge.security && !edge.subtitle && <div style={{ padding: "12px", textAlign: "center", color: "#bbb", fontSize: 11 }}>Double-click and press Edit to add security details</div>}
        </>)}
      </div>
    </div>
  );
}

/* ── Editing Toolbar ──────────────────────────── */
function EditingToolbar({ onAddNode, onSave, onUndo, onRedo, canUndo, canRedo, isDirty, connectMode, onToggleConnect }: {
  onAddNode: () => void; onSave: () => void; onUndo: () => void; onRedo: () => void;
  canUndo: boolean; canRedo: boolean; isDirty: boolean;
  connectMode?: boolean; onToggleConnect?: () => void;
}) {
  return (
    <div style={{
      position: "absolute", top: 16, left: 16, background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)", border: "1px solid #e0e0e0", borderRadius: 10,
      padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, zIndex: 100,
      boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
    }}>
      <button onClick={onAddNode} title="Add GCP Service" style={{
        background: "linear-gradient(135deg, #4285f4, #1a73e8)", color: "#fff", border: "none",
        borderRadius: 6, padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 4
      }}>➕ Add Service</button>

      {onToggleConnect && <>
        <div style={{ width: 1, height: 24, background: "#e0e0e0" }} />
        <button onClick={onToggleConnect} title="Draw connection between nodes" style={{
          background: connectMode ? "#e65100" : "none", color: connectMode ? "#fff" : "#555",
          border: connectMode ? "none" : "1px solid #ddd", borderRadius: 6,
          padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4
        }}>{connectMode ? "🔗 Click target..." : "🔗 Connect"}</button>
      </>}

      <div style={{ width: 1, height: 24, background: "#e0e0e0" }} />

      <button onClick={onUndo} disabled={!canUndo} title="Undo" style={{
        background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "6px 10px",
        fontSize: 12, cursor: canUndo ? "pointer" : "default", opacity: canUndo ? 1 : 0.5
      }}>↶</button>
      <button onClick={onRedo} disabled={!canRedo} title="Redo" style={{
        background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "6px 10px",
        fontSize: 12, cursor: canRedo ? "pointer" : "default", opacity: canRedo ? 1 : 0.5
      }}>↷</button>

      <div style={{ width: 1, height: 24, background: "#e0e0e0" }} />

      <button onClick={onSave} disabled={!isDirty} style={{
        background: isDirty ? "#4caf50" : "#e0e0e0", color: "#fff", border: "none",
        borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700,
        cursor: isDirty ? "pointer" : "default", display: "flex", alignItems: "center", gap: 4
      }}>💾 {isDirty ? "Save Changes" : "Saved"}</button>
    </div>
  );
}

export { ServicePalette, EnhancedNodePopover, EdgeEditPop, EditingToolbar, GCP_SERVICES };
export type { DiagNode, DiagEdge, EdgeSecurity, Threat };
