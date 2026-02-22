// ─── Types ───────────────────────────────────────────────────────────────────

export interface ArchitectureRequest {
  prompt: string;
  cloudProvider?: "gcp" | "aws" | "azure" | "multi-cloud";
  context?: string;
}

export interface ThinkingPhase {
  phase: string;
  reasoning: string;
  timestamp: number;
}

export interface ArchComponent {
  id: string;
  name: string;
  type: ComponentType;
  layer: ArchLayer;
  provider?: string;
  description: string;
  properties?: Record<string, string>;
}

export interface ArchConnection {
  from: string;
  to: string;
  protocol: string;
  label?: string;
  encrypted: boolean;
  crossesTrustBoundary: boolean;
  direction: "unidirectional" | "bidirectional";
}

export interface TrustBoundary {
  id: string;
  name: string;
  componentIds: string[];
  securityZone: "public" | "dmz" | "private" | "restricted";
}

export interface ArchitectureBlueprint {
  title: string;
  summary: string;
  thinkingTrace: ThinkingPhase[];
  components: ArchComponent[];
  connections: ArchConnection[];
  trustBoundaries: TrustBoundary[];
  layers: Record<ArchLayer, string[]>;
  concerns: ArchitecturalConcerns;
  recommendations: string[];
}

export interface ArchitecturalConcerns {
  security: ConcernDetail[];
  networking: ConcernDetail[];
  observability: ConcernDetail[];
  governance: ConcernDetail[];
  auth: ConcernDetail[];
  cost: ConcernDetail[];
}

export interface ConcernDetail {
  area: string;
  description: string;
  components: string[];
  severity: "critical" | "high" | "medium" | "low";
}

export type ComponentType =
  | "compute"
  | "database"
  | "storage"
  | "network"
  | "security"
  | "ai-ml"
  | "monitoring"
  | "gateway"
  | "queue"
  | "cache"
  | "identity"
  | "governance"
  | "external"
  | "client"
  | "cdn"
  | "container"
  | "serverless";

export type ArchLayer =
  | "client"
  | "edge"
  | "ingress"
  | "application"
  | "ai-ml"
  | "data"
  | "platform"
  | "observability"
  | "security"
  | "governance";

// ─── System Prompts for Each Thinking Phase ──────────────────────────────────

const ARCHITECT_PERSONA = `You are a principal cloud architect with 20+ years of experience designing 
mission-critical systems for Fortune 100 companies. You think like a paranoid security engineer, 
a network topology expert, an SRE who's been paged at 3am, and a governance officer who's survived 
SOC2/ISO27001/FedRAMP audits — all at once.

You NEVER produce a lazy diagram. You always consider:
- What happens when this gets attacked?
- What happens at 100x scale?
- What can't we see when things break?
- Who has access to what and why?
- What does the auditor ask about?

You know the FULL catalog of every major cloud provider's services — not just the obvious ones.
When someone says "RAG on Vertex AI", you don't just think Vertex + BigQuery. You think:
Model Armor, VPC Service Controls, Cloud Armor, Private Service Connect, Vertex AI Pipelines,
Feature Store, Model Registry, Experiment Tracking, Endpoint monitoring, Cloud Trace, 
Error Reporting, Binary Authorization, Artifact Registry, Secret Manager, Cloud KMS, 
IAM Workload Identity Federation, and tools like IBM watsonx.governance, Maxim AI for evaluation,
LangSmith/LangFuse for tracing, Weights & Biases for experiment tracking.

You output ONLY valid JSON — no markdown, no backticks, no preamble.`;

const PHASE_PROMPTS = {
  decompose: `PHASE 1: USE CASE DECOMPOSITION

Analyze the user's request and decompose it into:
1. **Core Workflow**: What is the primary data/request flow end-to-end?
2. **Actors**: Who/what interacts with this system (users, services, admins, CI/CD)?
3. **Data Classification**: What data is involved? PII? Confidential? Public?
4. **Integration Points**: What external systems, APIs, or data sources are involved?
5. **Non-Functional Requirements**: Infer latency, availability, scale, and compliance needs.
6. **Exposure Model**: Is this internal-only, external-facing, or hybrid?

Output JSON:
{
  "workflow": "string describing the core flow",
  "actors": [{"name": "string", "type": "human|service|admin|pipeline", "external": boolean}],
  "dataClassification": "public|internal|confidential|restricted",
  "integrations": [{"name": "string", "type": "string", "direction": "inbound|outbound|bidirectional"}],
  "nfrs": {"latency": "string", "availability": "string", "scale": "string", "compliance": ["string"]},
  "exposureModel": "internal|external|hybrid",
  "inferredRequirements": ["string"]
}`,

  discover: `PHASE 2: COMPONENT DISCOVERY

Given the decomposed use case, enumerate ALL components needed — go deep, not shallow.

For each component think:
- Is there a managed service for this?
- What's the security-hardened version?
- What's the enterprise-grade monitoring for this?
- What tools exist for governance/evaluation of this?
- Am I missing a caching/queue/CDN layer?
- What about secrets management, key management, certificate management?
- What about WAF, DDoS protection, bot detection?
- What about model evaluation, drift detection, A/B testing?
- What third-party tools complement this (Maxim AI, IBM watsonx, Datadog, etc.)?

Output JSON array of components:
[{
  "id": "unique-kebab-id",
  "name": "Display Name",
  "type": "compute|database|storage|network|security|ai-ml|monitoring|gateway|queue|cache|identity|governance|external|client|cdn|container|serverless",
  "layer": "client|edge|ingress|application|ai-ml|data|platform|observability|security|governance",
  "provider": "gcp|aws|azure|third-party|open-source",
  "description": "What it does in this architecture",
  "properties": {"key": "value pairs for relevant config"}
}]

Be exhaustive. A real architecture has 20-50+ components, not 5-10.`,

  security_sweep: `PHASE 3: ARCHITECTURAL CONCERNS SWEEP

For EVERY component discovered, systematically evaluate these cross-cutting concerns:

**Security**: Encryption at rest & in transit, key rotation, vulnerability scanning, binary authorization, 
supply chain security, data loss prevention, threat modeling (STRIDE), secrets management.

**Networking**: VPC design, subnet segmentation, private connectivity (Private Service Connect, PrivateLink), 
firewall rules, DNS, load balancing, CDN, DDoS protection, egress controls, network policies.

**Observability**: Structured logging, distributed tracing, metrics/SLIs/SLOs, alerting, 
error tracking, cost monitoring, AI-specific monitoring (drift, latency, token usage, hallucination rates).

**Governance**: Data lineage, model registry, experiment tracking, approval workflows, 
audit logging, compliance mapping, policy-as-code, responsible AI evaluation.

**Auth**: Identity provider, service-to-service auth, user auth, API key management, 
OAuth/OIDC flows, RBAC/ABAC, workload identity, just-in-time access.

**Cost**: Resource right-sizing, committed use discounts, spot/preemptible instances, 
storage tiering, egress cost optimization, FinOps tagging.

Output JSON:
{
  "security": [{"area": "string", "description": "string", "components": ["component-ids"], "severity": "critical|high|medium|low"}],
  "networking": [...],
  "observability": [...],
  "governance": [...],
  "auth": [...],
  "cost": [...]
}`,

  connections: `PHASE 4: CONNECTION MAPPING

Map every connection between components. For each connection determine:
1. Protocol (HTTPS, gRPC, WebSocket, TCP, pub/sub, internal API, VPC peering, etc.)
2. Is it encrypted? How?
3. Does it cross a trust boundary (public→private, external→internal)?
4. Direction of data flow
5. What auth mechanism protects this connection?

Also define trust boundaries — groups of components that share a security zone.

Output JSON:
{
  "connections": [{
    "from": "component-id",
    "to": "component-id",
    "protocol": "string",
    "label": "short description",
    "encrypted": boolean,
    "crossesTrustBoundary": boolean,
    "direction": "unidirectional|bidirectional",
    "authMechanism": "string"
  }],
  "trustBoundaries": [{
    "id": "boundary-id",
    "name": "Display Name",
    "componentIds": ["component-ids"],
    "securityZone": "public|dmz|private|restricted"
  }]
}`,

  synthesize: `PHASE 5: FINAL SYNTHESIS

Combine all previous analysis into a final architecture blueprint. Produce:
1. A clear title for this architecture
2. A 2-3 sentence executive summary
3. The complete component list (refined from Phase 2)
4. All connections (from Phase 4)
5. Trust boundaries (from Phase 4)
6. Layer mapping (which components belong to which architectural layer)
7. Top 5-10 actionable recommendations ranked by impact

Output the COMPLETE blueprint as JSON:
{
  "title": "string",
  "summary": "string",
  "components": [full component objects],
  "connections": [full connection objects],
  "trustBoundaries": [full boundary objects],
  "layers": {"client": ["ids"], "edge": ["ids"], ...},
  "recommendations": ["string"]
}`
};

// ─── Raw Anthropic API call (no SDK) ─────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Anthropic API error ${response.status}: ${(err as any)?.error?.message || response.statusText}`
    );
  }

  const data: any = await response.json();
  const text = data.content
    ?.filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("") || "{}";

  return text;
}

// ─── Core Generator Class ────────────────────────────────────────────────────

export class ChainOfThoughtGenerator {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.model = model || "claude-sonnet-4-20250514";
  }

  async generate(request: ArchitectureRequest): Promise<ArchitectureBlueprint> {
    const thinkingTrace: ThinkingPhase[] = [];
    const provider = request.cloudProvider || "gcp";

    const decomposition = await this.runPhase(
      "decompose",
      PHASE_PROMPTS.decompose,
      `Analyze this architecture request for ${provider.toUpperCase()}:\n\n"${request.prompt}"${
        request.context ? `\n\nAdditional context: ${request.context}` : ""
      }`,
      thinkingTrace
    );

    const components = await this.runPhase(
      "discover",
      PHASE_PROMPTS.discover,
      `Based on this decomposed use case, discover ALL components needed:\n\n${JSON.stringify(decomposition, null, 2)}\n\nCloud provider preference: ${provider.toUpperCase()}`,
      thinkingTrace
    );

    const concerns = await this.runPhase(
      "security_sweep",
      PHASE_PROMPTS.security_sweep,
      `Evaluate architectural concerns for these components:\n\n${JSON.stringify(components, null, 2)}\n\nUse case context:\n${JSON.stringify(decomposition, null, 2)}`,
      thinkingTrace
    );

    const connectionMap = await this.runPhase(
      "connections",
      PHASE_PROMPTS.connections,
      `Map all connections between these components:\n\n${JSON.stringify(components, null, 2)}\n\nSecurity concerns to address:\n${JSON.stringify(concerns, null, 2)}`,
      thinkingTrace
    );

    const blueprint = await this.runPhase(
      "synthesize",
      PHASE_PROMPTS.synthesize,
      `Synthesize the final architecture blueprint from all phases:\n\nDecomposition:\n${JSON.stringify(decomposition, null, 2)}\n\nComponents:\n${JSON.stringify(components, null, 2)}\n\nConcerns:\n${JSON.stringify(concerns, null, 2)}\n\nConnections:\n${JSON.stringify(connectionMap, null, 2)}`,
      thinkingTrace
    );

    return {
      title: blueprint.title || "Architecture Blueprint",
      summary: blueprint.summary || "",
      thinkingTrace,
      components: blueprint.components || components,
      connections: blueprint.connections || connectionMap.connections || [],
      trustBoundaries: blueprint.trustBoundaries || connectionMap.trustBoundaries || [],
      layers: blueprint.layers || this.buildLayerMap(blueprint.components || components),
      concerns: concerns as ArchitecturalConcerns,
      recommendations: blueprint.recommendations || [],
    };
  }

  async *generateStream(
    request: ArchitectureRequest
  ): AsyncGenerator<{ phase: string; status: "started" | "completed"; data?: any }> {
    const thinkingTrace: ThinkingPhase[] = [];
    const provider = request.cloudProvider || "gcp";
    const phases = ["decompose", "discover", "security_sweep", "connections", "synthesize"] as const;

    const prompts: Record<string, (prev: Record<string, any>) => string> = {
      decompose: () =>
        `Analyze this architecture request for ${provider.toUpperCase()}:\n\n"${request.prompt}"${
          request.context ? `\n\nAdditional context: ${request.context}` : ""
        }`,
      discover: (prev) =>
        `Based on this decomposed use case, discover ALL components needed:\n\n${JSON.stringify(prev.decompose, null, 2)}\n\nCloud provider preference: ${provider.toUpperCase()}`,
      security_sweep: (prev) =>
        `Evaluate architectural concerns for these components:\n\n${JSON.stringify(prev.discover, null, 2)}\n\nUse case context:\n${JSON.stringify(prev.decompose, null, 2)}`,
      connections: (prev) =>
        `Map all connections between these components:\n\n${JSON.stringify(prev.discover, null, 2)}\n\nSecurity concerns to address:\n${JSON.stringify(prev.security_sweep, null, 2)}`,
      synthesize: (prev) =>
        `Synthesize the final architecture blueprint from all phases:\n\nDecomposition:\n${JSON.stringify(prev.decompose, null, 2)}\n\nComponents:\n${JSON.stringify(prev.discover, null, 2)}\n\nConcerns:\n${JSON.stringify(prev.security_sweep, null, 2)}\n\nConnections:\n${JSON.stringify(prev.connections, null, 2)}`,
    };

    const results: Record<string, any> = {};

    for (const phase of phases) {
      yield { phase, status: "started" };

      const phasePrompt = (PHASE_PROMPTS as any)[phase];
      const userMessage = prompts[phase](results);
      const result = await this.runPhase(phase, phasePrompt, userMessage, thinkingTrace);
      results[phase] = result;

      yield { phase, status: "completed", data: result };
    }
  }

  private async runPhase(
    phaseName: string,
    phaseSystemPrompt: string,
    userMessage: string,
    trace: ThinkingPhase[]
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const text = await callClaude(
        `${ARCHITECT_PERSONA}\n\n${phaseSystemPrompt}`,
        userMessage,
        this.apiKey,
        this.model
      );

      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      trace.push({
        phase: phaseName,
        reasoning: `Completed ${phaseName} phase — identified ${
          Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
        } items`,
        timestamp: Date.now() - startTime,
      });

      return parsed;
    } catch (error: any) {
      trace.push({
        phase: phaseName,
        reasoning: `Phase ${phaseName} encountered error: ${error.message}`,
        timestamp: Date.now() - startTime,
      });

      if (phaseName === "discover") return [];
      if (phaseName === "connections") return { connections: [], trustBoundaries: [] };
      return {};
    }
  }

  private buildLayerMap(components: ArchComponent[]): Record<ArchLayer, string[]> {
    const layers: Record<ArchLayer, string[]> = {
      client: [], edge: [], ingress: [], application: [],
      "ai-ml": [], data: [], platform: [], observability: [],
      security: [], governance: [],
    };

    for (const comp of components) {
      if (comp.layer && layers[comp.layer]) {
        layers[comp.layer].push(comp.id);
      }
    }

    return layers;
  }
}

// ─── Convenience Exports ─────────────────────────────────────────────────────

export async function generateArchitecture(
  request: ArchitectureRequest
): Promise<ArchitectureBlueprint> {
  const generator = new ChainOfThoughtGenerator();
  return generator.generate(request);
}

export async function* streamArchitecture(request: ArchitectureRequest) {
  const generator = new ChainOfThoughtGenerator();
  yield* generator.generateStream(request);
}

export default ChainOfThoughtGenerator;
