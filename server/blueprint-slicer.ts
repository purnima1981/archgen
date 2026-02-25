// ═══ BLUEPRINT SLICER ═══════════════════════════════
// Uses Claude Haiku to pick relevant nodes from the master blueprint,
// then code handles positioning, edges, and sequencing.
// Cost: ~$0.005 per request

import type { Diagram, DiagNode, DiagEdge, Phase } from "./templates";

// Layer order for sequencing (data flows top-to-bottom through these)
const LAYER_ORDER = [
  { prefix: "src_",   zone: "sources" as const,      layer: "L1" },
  { prefix: "conn_",  zone: "connectivity" as const,  layer: "L2" },
  { prefix: "ing_",   zone: "cloud" as const,         layer: "L3" },
  { prefix: "lake_",  zone: "cloud" as const,         layer: "L4" },
  { prefix: "proc_",  zone: "cloud" as const,         layer: "L5" },
  { prefix: "bronze", zone: "cloud" as const,         layer: "L6" },
  { prefix: "silver", zone: "cloud" as const,         layer: "L6" },
  { prefix: "gold",   zone: "cloud" as const,         layer: "L6" },
  { prefix: "serve_", zone: "cloud" as const,         layer: "L7" },
  { prefix: "con_",   zone: "consumers" as const,     layer: "L8" },
  { prefix: "pillar_",zone: "cloud" as const,         layer: "P"  },
];

function getLayer(nodeId: string): string {
  for (const l of LAYER_ORDER) {
    if (nodeId.startsWith(l.prefix) || nodeId === l.prefix) return l.layer;
  }
  return "unknown";
}

// Build compact catalog for Haiku (minimize tokens)
function buildCatalog(blueprint: Diagram): string {
  const groups: Record<string, string[]> = {};
  for (const n of blueprint.nodes) {
    const layer = getLayer(n.id);
    if (!groups[layer]) groups[layer] = [];
    groups[layer].push(`${n.id}:${n.name}`);
  }
  const lines: string[] = [];
  const layerNames: Record<string, string> = {
    L1: "Sources", L2: "Connectivity", L3: "Ingestion", L4: "Data Lake",
    L5: "Processing", L6: "Medallion", L7: "Serving", L8: "Consumers", P: "Pillars"
  };
  for (const [layer, items] of Object.entries(groups)) {
    lines.push(`${layer} ${layerNames[layer] || layer}: ${items.join(", ")}`);
  }
  return lines.join("\n");
}

// Build the Haiku prompt
function buildSlicerPrompt(catalog: string, userPrompt: string): string {
  return `You are a principal GCP data architect designing production systems. Given a master blueprint catalog and a user request, design the optimal architecture.

MASTER BLUEPRINT CATALOG:
${catalog}

USER REQUEST: "${userPrompt}"

Think through each layer like an architect:

1. SOURCES: Which source systems are involved? Why?
2. CONNECTIVITY: How do we authenticate and connect? OAuth, service accounts, VPN, mTLS? Which identity provider? Where do secrets live?
3. INGESTION (L3): CDC vs batch vs streaming? Why this tool over alternatives? (e.g., Datastream vs Fivetran for Salesforce: Datastream = native GCP, no egress cost, VPC-SC compatible; Fivetran = managed, 300+ connectors, faster setup)
4. DATA LAKE (L4): Raw landing — GCS for files, BQ staging for structured? Partitioning strategy?
5. PROCESSING (L5): ELT in BigQuery SQL vs Dataflow for streaming? DLP for PII scanning? Vendor ETL?
6. MEDALLION (L6): Always bronze→silver→gold. What transforms at each stage?
7. SERVING (L7): BI via Looker? APIs via Cloud Run? Data sharing via Analytics Hub?
8. CONSUMERS (L8): Who consumes? Analysts (dashboards), data scientists (notebooks), apps (APIs)?
9. PILLARS: Security (IAM, encryption, DLP), Governance (lineage, catalog, quality), Observability (monitoring, logging, alerting), Orchestration (scheduling, cost)
10. EDGES: Define the COMPLETE sequential data flow. Every edge must have a descriptive label showing WHAT flows and HOW (protocol, pattern).

OUTPUT ONLY THIS JSON (no markdown, no explanation):
{
  "title": "specific title",
  "subtitle": "brief description with key tool choices",
  "nodes": ["node_id_1", "node_id_2", ...],
  "edges": [
    {"from": "src_x", "to": "conn_y", "label": "OAuth 2.0 REST", "step": 1},
    {"from": "conn_y", "to": "ing_z", "label": "CDC Stream (WAL)", "step": 2}
  ],
  "decisions": [
    {
      "layer": "L3 Ingestion",
      "chosen": "Datastream",
      "reason": "Native GCP CDC, no egress cost, VPC-SC compatible, auto-backfill",
      "alternatives": "Fivetran (managed, 300+ connectors), Pub/Sub + Functions (event-driven)"
    }
  ],
  "flow_summary": "Salesforce CRM data flows via OAuth REST → Secret Manager stores tokens → Datastream captures CDC events → lands raw in GCS (Avro) → BigQuery staging → DLP scans PII → bronze (raw, typed) → silver (cleaned, conformed) → gold (aggregated KPIs) → Looker dashboards for sales ops",
  "security_notes": "OAuth 2.0 with short-lived tokens rotated in Secret Manager, VPC-SC perimeter around BQ+GCS, column-level DLP masking for PII (email, phone), IAM least-privilege per service",
  "governance_notes": "Dataplex auto-discovery + quality rules at each medallion gate, Data Catalog tags for PII/classification, Cloud Audit Logs for all access",
  "orchestration_notes": "Cloud Composer DAG: hourly CDC check → quality gate → medallion promotion → SLA monitoring → PagerDuty on breach"
}`;
}

// Position nodes with no overlaps, no gaps
// BG=68 (node box), step badges=20px, edges need clearance
// Minimum center-to-center: 160px horizontal, 180px vertical

function positionNodes(nodes: DiagNode[], keepIds: Set<string>): DiagNode[] {
  const positioned: DiagNode[] = [];

  // Group by zone + layer
  const zoneNodes: Record<string, DiagNode[]> = {
    sources: [], connectivity: [], cloud_L3: [], cloud_L4: [], cloud_L5: [],
    cloud_L6: [], cloud_L7: [], cloud_P: [], consumers: []
  };

  for (const n of nodes) {
    if (!keepIds.has(n.id)) continue;
    const layer = getLayer(n.id);
    if (n.zone === "sources") zoneNodes.sources.push(n);
    else if (n.zone === "connectivity") zoneNodes.connectivity.push(n);
    else if (n.zone === "consumers") zoneNodes.consumers.push(n);
    else if (layer === "P") zoneNodes.cloud_P.push(n);
    else if (zoneNodes[`cloud_${layer}`]) zoneNodes[`cloud_${layer}`].push(n);
  }

  // Constants
  const SPACING_X = 180;  // horizontal between nodes
  const SPACING_Y = 180;  // vertical between layers
  const COL_GAP = 220;    // gap between major columns (sources, connectivity, cloud, pillars, consumers)

  // ── Column 1: Sources (left) ──
  const srcX = 100;
  const startY = 200;
  zoneNodes.sources.forEach((n, i) => {
    positioned.push({ ...n, x: srcX, y: startY + i * SPACING_Y });
  });

  // ── Column 2: Connectivity ──
  const connX = srcX + COL_GAP;
  zoneNodes.connectivity.forEach((n, i) => {
    positioned.push({ ...n, x: connX, y: startY + i * SPACING_Y });
  });

  // ── Column 3: Cloud layers (each layer = horizontal row) ──
  const cloudStartX = connX + COL_GAP;
  const cloudLayers = ["L3", "L4", "L5", "L6", "L7"];

  // Compute max cloud width for pillar/consumer placement
  let maxCloudRight = cloudStartX;

  cloudLayers.forEach((layerKey, li) => {
    const layerNodes = zoneNodes[`cloud_${layerKey}`] || [];
    const layerY = startY + li * SPACING_Y;

    // Center the row: if multiple nodes, spread them evenly
    layerNodes.forEach((n, i) => {
      const x = cloudStartX + i * SPACING_X;
      positioned.push({ ...n, x, y: layerY });
      maxCloudRight = Math.max(maxCloudRight, x);
    });
  });

  // ── Column 4: Pillars (right of cloud) ──
  const pillarX = maxCloudRight + COL_GAP;
  zoneNodes.cloud_P.forEach((n, i) => {
    positioned.push({ ...n, x: pillarX, y: startY + i * SPACING_Y });
  });

  // ── Column 5: Consumers (right of pillars) ──
  const consumerX = pillarX + COL_GAP;
  zoneNodes.consumers.forEach((n, i) => {
    positioned.push({ ...n, x: consumerX, y: startY + i * SPACING_Y });
  });

  // ── Vertical centering: align shorter columns to the middle of the tallest ──
  const groups = [
    { key: "sources", nodes: zoneNodes.sources },
    { key: "connectivity", nodes: zoneNodes.connectivity },
    { key: "consumers", nodes: zoneNodes.consumers },
    { key: "pillars", nodes: zoneNodes.cloud_P },
  ];

  // Find the cloud total height (tallest column)
  const cloudHeight = (cloudLayers.length - 1) * SPACING_Y;
  const cloudCenterY = startY + cloudHeight / 2;

  for (const g of groups) {
    if (g.nodes.length === 0) continue;
    const groupHeight = (g.nodes.length - 1) * SPACING_Y;
    const groupCenterY = startY + groupHeight / 2;
    const offsetY = cloudCenterY - groupCenterY;

    if (Math.abs(offsetY) > 20) {
      // Shift this group's positioned nodes to center-align with cloud
      const ids = new Set(g.nodes.map(n => n.id));
      for (const p of positioned) {
        if (ids.has(p.id)) p.y += offsetY;
      }
    }
  }

  return positioned;
}

// Build phases from the sliced nodes
function buildPhases(nodes: DiagNode[]): Phase[] {
  const phaseMap: Record<string, { name: string; ids: string[] }> = {
    L1: { name: "Sources", ids: [] },
    L2: { name: "Connectivity & Access", ids: [] },
    L3: { name: "Ingestion", ids: [] },
    L4: { name: "Data Lake", ids: [] },
    L5: { name: "Processing", ids: [] },
    L6: { name: "Medallion Architecture", ids: [] },
    L7: { name: "Serving & Delivery", ids: [] },
    L8: { name: "Consumers", ids: [] },
  };

  for (const n of nodes) {
    const layer = getLayer(n.id);
    if (layer !== "P" && layer !== "unknown" && phaseMap[layer]) {
      phaseMap[layer].ids.push(n.id);
    }
  }

  return Object.entries(phaseMap)
    .filter(([_, v]) => v.ids.length > 0)
    .map(([k, v]) => ({ id: k.toLowerCase(), name: `Layer ${k.replace("L", "")}: ${v.name}`, nodeIds: v.ids }));
}

// Build edges with proper security metadata
function buildEdges(rawEdges: { from: string; to: string; label: string; step: number }[], nodeMap: Map<string, DiagNode>): DiagEdge[] {
  return rawEdges
    .filter(e => nodeMap.has(e.from) && nodeMap.has(e.to))
    .map((e, i) => {
      const fromNode = nodeMap.get(e.from)!;
      const toNode = nodeMap.get(e.to)!;
      const crossesBoundary = fromNode.zone !== toNode.zone;
      const isPrivate = fromNode.zone === "cloud" && toNode.zone === "cloud";

      return {
        id: `e${i + 1}`,
        from: e.from,
        to: e.to,
        label: e.label,
        step: e.step,
        security: {
          transport: crossesBoundary ? "TLS 1.3" : "VPC Internal",
          auth: crossesBoundary ? "OAuth 2.0 / mTLS" : "IAM Service Account",
          classification: isPrivate ? "internal" : "confidential",
          private: isPrivate,
        },
        crossesBoundary,
        edgeType: "data" as const,
      };
    });
}

// Main slicer function
export async function sliceBlueprint(
  blueprint: Diagram,
  userPrompt: string,
  apiKey: string
): Promise<{ diagram: Diagram; tokensUsed: { input: number; output: number } }> {

  const catalog = buildCatalog(blueprint);
  const prompt = buildSlicerPrompt(catalog, userPrompt);

  // Call Haiku
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Haiku API error");
  }

  const data = await response.json();
  const text = (data.content?.[0]?.text || "").replace(/```json\s*/g, "").replace(/```/g, "").trim();
  const result = JSON.parse(text);

  const tokensUsed = {
    input: data.usage?.input_tokens || 0,
    output: data.usage?.output_tokens || 0,
  };

  // Build node map from blueprint
  const allNodeMap = new Map<string, DiagNode>();
  for (const n of blueprint.nodes) allNodeMap.set(n.id, n);

  // Filter to only requested nodes
  const keepIds = new Set<string>(result.nodes || []);
  const keptNodes = blueprint.nodes.filter(n => keepIds.has(n.id));

  // Position with no overlaps
  const positioned = positionNodes(keptNodes, keepIds);

  // Build node map for edges
  const posNodeMap = new Map<string, DiagNode>();
  for (const n of positioned) posNodeMap.set(n.id, n);

  // Build edges with sequencing
  const edges = buildEdges(result.edges || [], posNodeMap);

  // Build phases
  const phases = buildPhases(positioned);

  // Build opsGroup from pillars
  const pillarIds = positioned.filter(n => n.id.startsWith("pillar_")).map(n => n.id);

  const diagram: Diagram = {
    title: result.title || `Architecture: ${userPrompt.slice(0, 50)}`,
    subtitle: result.subtitle || `Derived from GCP Enterprise Blueprint · ${positioned.length} components`,
    layout: positioned.length > 20 ? "gcp_blueprint" : undefined,
    nodes: positioned,
    edges,
    threats: blueprint.threats?.filter(t => keepIds.has(t.target)) || [],
    phases,
    opsGroup: pillarIds.length > 0 ? { name: "Crosscutting Pillars", nodeIds: pillarIds } : undefined,
  };

  // Embed architectural context into node details where relevant
  if (result.decisions || result.flow_summary || result.security_notes) {
    // Add flow summary + decisions to a virtual "architecture" note on the first cloud node
    const contextNotes: string[] = [];
    if (result.flow_summary) contextNotes.push(`📋 Flow: ${result.flow_summary}`);
    if (result.security_notes) contextNotes.push(`🔒 Security: ${result.security_notes}`);
    if (result.governance_notes) contextNotes.push(`📊 Governance: ${result.governance_notes}`);
    if (result.orchestration_notes) contextNotes.push(`⚙️ Orchestration: ${result.orchestration_notes}`);
    if (result.decisions?.length) {
      contextNotes.push(`\n🏗️ Architecture Decisions:`);
      for (const d of result.decisions) {
        contextNotes.push(`• ${d.layer}: ${d.chosen} — ${d.reason}${d.alternatives ? ` (Alt: ${d.alternatives})` : ""}`);
      }
    }

    // Attach to diagram subtitle for visibility
    if (result.flow_summary) {
      diagram.subtitle = result.flow_summary;
    }

    // Enrich individual node details with decision context
    if (result.decisions) {
      for (const d of result.decisions) {
        // Find the chosen node and enrich its notes
        const chosenNode = diagram.nodes.find(n =>
          n.name.toLowerCase().includes(d.chosen.toLowerCase()) ||
          d.chosen.toLowerCase().includes(n.name.toLowerCase())
        );
        if (chosenNode && chosenNode.details) {
          const existing = chosenNode.details.notes || "";
          chosenNode.details.notes = `${existing}\n\n🏗️ Why ${d.chosen}: ${d.reason}${d.alternatives ? `\n↔️ Alternatives: ${d.alternatives}` : ""}`.trim();
        }
      }
    }

    // Store full context as metadata (not a visible node)
    (diagram as any)._architectureContext = contextNotes.join("\n\n");
  }

  return { diagram, tokensUsed };
}
