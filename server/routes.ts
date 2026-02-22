import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const ICONS = `compute_engine,cloud_run,cloud_functions,app_engine,google_kubernetes_engine,cloud_gpu,cloud_tpu,batch,cloud_storage,bigquery,cloud_sql,cloud_spanner,firestore,bigtable,datastore,memorystore,filestore,persistent_disk,dataflow,dataproc,pubsub,data_catalog,dataprep,dataplex,datastream,analytics_hub,data_studio,looker,vertexai,ai_platform,automl,cloud_natural_language_api,cloud_vision_api,cloud_translation_api,speech-to-text,text-to-speech,dialogflow,document_ai,recommendations_ai,tensorflow_enterprise,cloud_load_balancing,cloud_cdn,cloud_dns,cloud_vpn,cloud_nat,cloud_armor,cloud_interconnect,virtual_private_cloud,traffic_director,identity_and_access_management,security_command_center,secret_manager,key_management_service,binary_authorization,identity_platform,cloud_audit_logs,cloud_build,artifact_registry,cloud_deploy,cloud_monitoring,cloud_logging,error_reporting,trace,cloud_scheduler,cloud_tasks,apigee_api_platform,cloud_api_gateway,cloud_endpoints,eventarc,workflows,connectors`;

const SYSTEM_PROMPT = `You are a senior cloud security architect. Given a system description, generate a COMPLETE architecture story that covers: what the system is, where it lives, how it's protected, and where it could break.

You are telling a story with four chapters:

═══════════════════════════════════════════════════
CHAPTER 1: WHAT IS IT? (Architecture)
═══════════════════════════════════════════════════
- 4-6 groups, ordered left-to-right as pipeline stages
- Each group has 2-3 components with icons
- 5-8 flows numbered sequentially (1,2,3...), connecting components in DIFFERENT groups
- Flows go left to right through the pipeline

Available icons: ${ICONS}
Use exact icon IDs. Use null if no match.

═══════════════════════════════════════════════════
CHAPTER 2: WHERE DOES IT LIVE? (Trust Boundaries)
═══════════════════════════════════════════════════
Every system has network zones. Identify them:
- "external" — outside your control (users, third-party APIs, SaaS, on-prem systems)
- "dmz" — internet-facing but controlled (API gateways, load balancers, CDN)
- "vpc" — private cloud network (compute, databases, ML)
- "restricted" — highest security zone (secrets, PII/PHI storage, encryption keys)

Each trust boundary wraps one or more groups. A flow crossing boundaries is a security-critical transition.

═══════════════════════════════════════════════════
CHAPTER 3: HOW IS IT PROTECTED? (Security)
═══════════════════════════════════════════════════
For each flow, describe the security posture:
- transport: "TLS 1.3", "mTLS", "VPN", "Cloud Interconnect", "plaintext"
- auth: "OAuth 2.0", "API Key", "Service Account", "IAM", "mTLS cert", "none"
- dataClassification: "public", "internal", "confidential", "regulated"
- private: true/false (does this go over public internet?)

Also identify where secrets/credentials are stored:
- What service needs credentials?
- Where are they stored? (Secret Manager, CyberArk, Vault, env vars, hardcoded)
- What credential? (DB password, API key, service account key, OAuth secret)

And the identity chain:
- Who/what authenticates? (end users, service accounts, external systems)
- How? (SAML, OAuth, Workload Identity, API key)
- Where? (Identity Platform, Okta, Azure AD, IAM)

═══════════════════════════════════════════════════
CHAPTER 4: WHERE COULD IT BREAK? (Threats)
═══════════════════════════════════════════════════
For EACH flow and EACH sensitive component, identify realistic threats:
- Use STRIDE: (S)poofing, (T)ampering, (R)epudiation, (I)nfo Disclosure, (D)oS, (E)levation
- Severity: "critical", "high", "medium", "low"
- Be specific: not "data could leak" but "PHI in BigQuery accessible via overly-permissive IAM role"
- Include real mitigation: not "add security" but "Enable VPC Service Controls, restrict BigQuery to authorized service accounts only"
- Flag compliance: HIPAA, PCI-DSS, GDPR, SOC2 where relevant

═══════════════════════════════════════════════════
OUTPUT FORMAT (JSON only, no markdown)
═══════════════════════════════════════════════════
{
  "title": "System Title",

  "groups": [
    {
      "id": "grp_id",
      "name": "Group Name",
      "category": "actors|channels|ingestion|processing|ai|storage|serving|output|security|monitoring",
      "components": [
        {"id": "comp_id", "name": "Display Name", "icon": "icon_id_or_null", "subtitle": "detail"}
      ]
    }
  ],

  "flows": [
    {
      "from": "comp_id_in_group_A",
      "to": "comp_id_in_group_B",
      "label": "What data moves",
      "step": 1
    }
  ],

  "trustBoundaries": [
    {
      "id": "boundary_id",
      "name": "Boundary Name",
      "type": "external|dmz|vpc|restricted",
      "groups": ["grp_id_1", "grp_id_2"]
    }
  ],

  "security": {
    "flows": [
      {
        "step": 1,
        "transport": "TLS 1.3",
        "auth": "OAuth 2.0",
        "dataClassification": "regulated",
        "private": false
      }
    ],
    "secrets": [
      {
        "component": "comp_id",
        "store": "Secret Manager",
        "credential": "Database password",
        "rotation": "90 days"
      }
    ],
    "identity": {
      "provider": "Okta",
      "protocol": "SAML 2.0",
      "userAuth": "OAuth 2.0 + MFA",
      "serviceAuth": "Workload Identity Federation"
    }
  },

  "threats": [
    {
      "id": "T1",
      "location": "flow_step_number_or_comp_id",
      "locationType": "flow|component",
      "stride": "I",
      "severity": "critical|high|medium|low",
      "title": "Short threat title",
      "description": "Specific description of the threat",
      "impact": "What happens if exploited",
      "mitigation": "Specific technical fix",
      "compliance": "HIPAA|PCI|GDPR|SOC2|null"
    }
  ]
}

═══════════════════════════════════════════════════
EXAMPLE
═══════════════════════════════════════════════════
Input: "Healthcare AI: Epic EHR data → BigQuery → Vertex AI → clinician dashboard"

{
  "title": "Clinical AI Prediction Pipeline",
  "groups": [
    {"id": "src", "name": "Clinical Sources", "category": "actors", "components": [
      {"id": "ehr", "name": "Epic EHR", "icon": null, "subtitle": "FHIR R4"},
      {"id": "labs", "name": "Lab Systems", "icon": null, "subtitle": "HL7 v2"}
    ]},
    {"id": "ingest", "name": "Ingestion Layer", "category": "ingestion", "components": [
      {"id": "gw", "name": "API Gateway", "icon": "cloud_api_gateway", "subtitle": "FHIR Proxy"},
      {"id": "ps", "name": "Pub/Sub", "icon": "pubsub", "subtitle": "Events"}
    ]},
    {"id": "store", "name": "Data Platform", "category": "storage", "components": [
      {"id": "bq", "name": "BigQuery", "icon": "bigquery", "subtitle": "PHI Lake"},
      {"id": "gcs", "name": "Cloud Storage", "icon": "cloud_storage", "subtitle": "Raw FHIR"}
    ]},
    {"id": "ml", "name": "AI/ML", "category": "ai", "components": [
      {"id": "vtx", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Training"},
      {"id": "ep", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Endpoints"}
    ]},
    {"id": "app", "name": "Application", "category": "serving", "components": [
      {"id": "run", "name": "Cloud Run", "icon": "cloud_run", "subtitle": "API"},
      {"id": "dash", "name": "Looker", "icon": "looker", "subtitle": "Dashboard"}
    ]}
  ],
  "flows": [
    {"from": "ehr", "to": "gw", "label": "Patient Records", "step": 1},
    {"from": "gw", "to": "ps", "label": "Validated Events", "step": 2},
    {"from": "ps", "to": "bq", "label": "Structured Data", "step": 3},
    {"from": "bq", "to": "vtx", "label": "Training Features", "step": 4},
    {"from": "vtx", "to": "ep", "label": "Trained Model", "step": 5},
    {"from": "ep", "to": "run", "label": "Predictions", "step": 6},
    {"from": "run", "to": "dash", "label": "Risk Scores", "step": 7}
  ],
  "trustBoundaries": [
    {"id": "onprem", "name": "Hospital Network", "type": "external", "groups": ["src"]},
    {"id": "dmz", "name": "API DMZ", "type": "dmz", "groups": ["ingest"]},
    {"id": "vpc", "name": "Analytics VPC", "type": "vpc", "groups": ["store", "ml"]},
    {"id": "serve", "name": "Serving VPC", "type": "vpc", "groups": ["app"]}
  ],
  "security": {
    "flows": [
      {"step": 1, "transport": "TLS 1.3 over Cloud Interconnect", "auth": "mTLS + OAuth 2.0", "dataClassification": "regulated", "private": true},
      {"step": 2, "transport": "TLS 1.3", "auth": "IAM Service Account", "dataClassification": "regulated", "private": true},
      {"step": 3, "transport": "Internal gRPC", "auth": "IAM", "dataClassification": "regulated", "private": true},
      {"step": 4, "transport": "Internal", "auth": "IAM + Workload Identity", "dataClassification": "confidential", "private": true},
      {"step": 5, "transport": "Internal gRPC", "auth": "IAM", "dataClassification": "confidential", "private": true},
      {"step": 6, "transport": "TLS 1.3", "auth": "IAM Service Account", "dataClassification": "confidential", "private": true},
      {"step": 7, "transport": "TLS 1.3", "auth": "OAuth 2.0 + MFA", "dataClassification": "confidential", "private": false}
    ],
    "secrets": [
      {"component": "gw", "store": "Secret Manager", "credential": "EHR API client certificate", "rotation": "yearly"},
      {"component": "run", "store": "Secret Manager", "credential": "Vertex AI endpoint key", "rotation": "90 days"},
      {"component": "bq", "store": "KMS", "credential": "CMEK encryption key", "rotation": "365 days"}
    ],
    "identity": {
      "provider": "Azure AD (hospital) + Google Identity (internal)",
      "protocol": "SAML 2.0 + OAuth 2.0",
      "userAuth": "OAuth 2.0 with MFA",
      "serviceAuth": "Workload Identity Federation (no exported keys)"
    }
  },
  "threats": [
    {
      "id": "T1", "location": "1", "locationType": "flow",
      "stride": "I", "severity": "critical",
      "title": "PHI exposed crossing trust boundary",
      "description": "Patient records cross from hospital network to cloud. Interconnect failure could route via public internet.",
      "impact": "HIPAA breach, up to $1.5M fine per incident",
      "mitigation": "Enforce VPC Service Controls, Cloud Interconnect with failover VPN (not public), enable DLP scanning on ingress",
      "compliance": "HIPAA"
    },
    {
      "id": "T2", "location": "bq", "locationType": "component",
      "stride": "I", "severity": "high",
      "title": "BigQuery over-permissive IAM",
      "description": "PHI data in BigQuery accessible if IAM roles are too broad. Any project member could query patient data.",
      "impact": "Unauthorized PHI access, HIPAA violation",
      "mitigation": "Column-level security, authorized views, VPC Service Controls perimeter, audit BigQuery Data Access logs",
      "compliance": "HIPAA"
    },
    {
      "id": "T3", "location": "7", "locationType": "flow",
      "stride": "S", "severity": "high",
      "title": "Dashboard session hijacking",
      "description": "Clinician dashboard exposed to internet. Stolen session tokens could give attacker access to predictions.",
      "impact": "Unauthorized access to patient risk scores",
      "mitigation": "Short-lived tokens, bind to IP, Cloud Armor WAF, require MFA re-auth for sensitive views",
      "compliance": "HIPAA"
    },
    {
      "id": "T4", "location": "run", "locationType": "component",
      "stride": "E", "severity": "medium",
      "title": "Cloud Run privilege escalation",
      "description": "Cloud Run service account has Vertex AI access. Compromised container could access all ML endpoints.",
      "impact": "Attacker could invoke or poison ML predictions",
      "mitigation": "Least-privilege SA, Binary Authorization for container images, Cloud Audit Logs on Vertex API calls",
      "compliance": "SOC2"
    },
    {
      "id": "T5", "location": "ps", "locationType": "component",
      "stride": "I", "severity": "medium",
      "title": "Pub/Sub dead-letter retains PHI",
      "description": "Failed messages go to dead-letter topic. PHI sits there without encryption or TTL.",
      "impact": "Stale PHI accessible beyond retention policy",
      "mitigation": "CMEK on dead-letter topic, 7-day retention policy, DLP scan on dead-letter subscription",
      "compliance": "HIPAA"
    }
  ]
}

Generate the full story for the user's system. Output ONLY valid JSON.`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/diagrams/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });
      if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: "Anthropic API key not configured." });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Anthropic API error");
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
      const diagramJson = JSON.parse(clean);

      // POST-PROCESS flows: remove within-group, renumber
      if (diagramJson.flows && diagramJson.groups) {
        const c2g: Record<string, string> = {};
        for (const g of diagramJson.groups) {
          for (const c of g.components) c2g[c.id] = g.id;
        }
        diagramJson.flows = diagramJson.flows.filter((f: any) => {
          const fg = c2g[f.from], tg = c2g[f.to];
          return fg && tg && fg !== tg;
        });
        diagramJson.flows.sort((a: any, b: any) => (a.step || 999) - (b.step || 999));
        diagramJson.flows.forEach((f: any, i: number) => { f.step = i + 1; });

        // Also renumber security.flows to match
        if (diagramJson.security?.flows) {
          const oldToNew: Record<number, number> = {};
          diagramJson.flows.forEach((f: any, i: number) => {
            // Find matching security flow by old step
            oldToNew[f.step] = i + 1;
          });
          // Re-index security flows to match new step numbers
          const newSecFlows: any[] = [];
          diagramJson.flows.forEach((f: any) => {
            const secFlow = diagramJson.security.flows.find((sf: any) => sf.step === f.step);
            if (secFlow) newSecFlows.push({ ...secFlow, step: f.step });
          });
          diagramJson.security.flows = newSecFlows;
        }

        // Renumber threat flow references too
        if (diagramJson.threats) {
          diagramJson.threats.forEach((t: any) => {
            if (t.locationType === "flow") {
              const stepNum = parseInt(t.location);
              if (!isNaN(stepNum)) {
                const matchingFlow = diagramJson.flows.find((f: any) => f.step === stepNum);
                if (matchingFlow) t.location = String(matchingFlow.step);
              }
            }
          });
        }
      }

      const userId = req.user.claims.sub;
      const [saved] = await db.insert(diagrams).values({
        title: diagramJson.title || "Untitled",
        prompt,
        diagramJson: JSON.stringify(diagramJson),
        userId,
      }).returning();

      res.json({ diagram: diagramJson, saved });
    } catch (error: any) {
      console.error("Diagram generation error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to generate diagram" });
    }
  });

  app.get("/api/diagrams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await db.select().from(diagrams).where(eq(diagrams.userId, userId)).orderBy(desc(diagrams.createdAt));
      res.json(result);
    } catch (e) { res.status(500).json({ error: "Failed" }); }
  });

  app.get("/api/diagrams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [d] = await db.select().from(diagrams).where(and(eq(diagrams.id, parseInt(req.params.id)), eq(diagrams.userId, userId)));
      if (!d) return res.status(404).json({ error: "Not found" });
      res.json(d);
    } catch (e) { res.status(500).json({ error: "Failed" }); }
  });

  app.delete("/api/diagrams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await db.delete(diagrams).where(and(eq(diagrams.id, parseInt(req.params.id)), eq(diagrams.userId, userId)));
      res.status(204).send();
    } catch (e) { res.status(500).json({ error: "Failed" }); }
  });

  return httpServer;
}
