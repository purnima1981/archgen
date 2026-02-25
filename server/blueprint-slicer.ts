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
  return `You are an expert GCP data architect. Given a master blueprint catalog and a user request, select ONLY the relevant nodes and define the data flow.

MASTER BLUEPRINT CATALOG:
${catalog}

USER REQUEST: "${userPrompt}"

RULES:
1. Pick ONLY nodes relevant to the user's request
2. Always include: at least 1 source, relevant connectivity, full data path through layers (L3→L4→L5→L6→L7), at least 1 consumer
3. Always include bronze, silver, gold (medallion is mandatory)
4. Include 2-4 relevant pillars
5. Define edges as sequential flow: source→connectivity→ingestion→lake→processing→medallion→serving→consumer
6. Step numbers must be sequential: 1, 2, 3, 4... representing the data flow order
7. Give the diagram a specific title based on the user's request

OUTPUT ONLY THIS JSON (no markdown, no explanation):
{
  "title": "specific title for this pattern",
  "subtitle": "brief description",
  "nodes": ["node_id_1", "node_id_2", ...],
  "edges": [
    {"from": "node_id", "to": "node_id", "label": "short label", "step": 1},
    {"from": "node_id", "to": "node_id", "label": "short label", "step": 2}
  ]
}`;
}

// Position nodes with no overlaps, no gaps
interface PositionConfig {
  sources: { x: number; startY: number; spacingY: number };
  connectivity: { x: number; startY: number; spacingY: number };
  cloud: { startX: number; spacingX: number; startY: number; spacingY: number };
  consumers: { x: number; startY: number; spacingY: number };
}

const POS: PositionConfig = {
  sources:      { x: 100,  startY: 150, spacingY: 120 },
  connectivity: { x: 320,  startY: 150, spacingY: 120 },
  cloud:        { startX: 540, spacingX: 160, startY: 150, spacingY: 130 },
  consumers:    { x: 1200, startY: 150, spacingY: 120 },
};

// Cloud sub-layers get their own row
const CLOUD_LAYER_Y: Record<string, number> = {
  L3: 150,   // Ingestion
  L4: 300,   // Data Lake
  L5: 450,   // Processing
  L6: 600,   // Medallion
  L7: 750,   // Serving
  P:  150,   // Pillars (right column, starting same Y as ingestion)
};

function positionNodes(nodes: DiagNode[], keepIds: Set<string>): DiagNode[] {
  const positioned: DiagNode[] = [];
  const counters: Record<string, number> = {};

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
    else zoneNodes[`cloud_${layer}`]?.push(n);
  }

  // Position sources — vertical stack
  zoneNodes.sources.forEach((n, i) => {
    positioned.push({ ...n, x: POS.sources.x, y: POS.sources.startY + i * POS.sources.spacingY });
  });

  // Position connectivity — vertical stack
  zoneNodes.connectivity.forEach((n, i) => {
    positioned.push({ ...n, x: POS.connectivity.x, y: POS.connectivity.startY + i * POS.connectivity.spacingY });
  });

  // Position cloud layers — each layer is a horizontal row
  for (const layerKey of ["L3", "L4", "L5", "L6", "L7"]) {
    const layerNodes = zoneNodes[`cloud_${layerKey}`] || [];
    const baseY = CLOUD_LAYER_Y[layerKey];
    layerNodes.forEach((n, i) => {
      positioned.push({ ...n, x: POS.cloud.startX + i * POS.cloud.spacingX, y: baseY });
    });
  }

  // Position pillars — right column
  const pillarX = 1050;
  zoneNodes.cloud_P.forEach((n, i) => {
    positioned.push({ ...n, x: pillarX, y: POS.consumers.startY + i * 160 });
  });

  // Position consumers — vertical stack at right
  zoneNodes.consumers.forEach((n, i) => {
    positioned.push({ ...n, x: POS.consumers.x, y: POS.consumers.startY + i * POS.consumers.spacingY });
  });

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
      max_tokens: 2000,
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

  return { diagram, tokensUsed };
}
