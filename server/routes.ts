import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const ICONS = `compute_engine,cloud_run,cloud_functions,app_engine,google_kubernetes_engine,cloud_gpu,cloud_tpu,batch,cloud_storage,bigquery,cloud_sql,cloud_spanner,firestore,bigtable,datastore,memorystore,filestore,persistent_disk,dataflow,dataproc,pubsub,data_catalog,dataprep,dataplex,datastream,analytics_hub,data_studio,looker,vertexai,ai_platform,automl,cloud_natural_language_api,cloud_vision_api,cloud_translation_api,speech-to-text,text-to-speech,dialogflow,document_ai,recommendations_ai,tensorflow_enterprise,cloud_load_balancing,cloud_cdn,cloud_dns,cloud_vpn,cloud_nat,cloud_armor,cloud_interconnect,virtual_private_cloud,traffic_director,identity_and_access_management,security_command_center,secret_manager,key_management_service,binary_authorization,identity_platform,cloud_audit_logs,cloud_build,artifact_registry,cloud_deploy,cloud_monitoring,cloud_logging,error_reporting,trace,cloud_scheduler,cloud_tasks,apigee_api_platform,cloud_api_gateway,cloud_endpoints,eventarc,workflows,connectors`;

const SYSTEM_PROMPT = `You are a senior cloud security architect. Given a system description, generate a LEFT-TO-RIGHT pipeline architecture with security analysis and threat modeling.

ARCHITECTURE RULES:
- Create 4-6 groups ordered left to right as pipeline stages
- Each group has 2-3 components
- Create 5-8 flows connecting components in DIFFERENT groups only
- Flows are numbered 1,2,3,4... with NO gaps
- The flow chain reads left to right: a clear data journey from source to destination
- NEVER connect two components in the same group
- Icons: use exact IDs from this list or null: ${ICONS}

TRUST BOUNDARIES:
- "external" = outside your control (users, on-prem, third-party)
- "dmz" = internet-facing controlled zone (API gateways, load balancers)
- "vpc" = private cloud network (compute, databases)
- "restricted" = highest security (secrets, regulated data)

SECURITY: For each flow describe transport, auth, data sensitivity. List where secrets are stored.

THREATS: For each flow and sensitive component, identify realistic threats using STRIDE (S=Spoofing, T=Tampering, R=Repudiation, I=InfoDisclosure, D=DoS, E=ElevationOfPrivilege). Be specific with mitigations.

OUTPUT (JSON only, no markdown, no explanation):
{
  "title": "Short Title",
  "groups": [
    {"id": "grp_id", "name": "Name", "category": "actors|channels|ingestion|processing|ai|storage|serving|output|security|monitoring",
     "components": [{"id": "comp_id", "name": "Name (max 16 chars)", "icon": "icon_id_or_null", "subtitle": "detail"}]}
  ],
  "flows": [
    {"from": "comp_in_groupA", "to": "comp_in_groupB", "label": "What moves", "step": 1}
  ],
  "trustBoundaries": [
    {"id": "tb_id", "name": "Name", "type": "external|dmz|vpc|restricted", "groups": ["grp_id1","grp_id2"]}
  ],
  "security": {
    "flows": [
      {"step": 1, "transport": "TLS 1.3", "auth": "OAuth 2.0", "dataClassification": "public|internal|confidential|regulated", "private": true}
    ],
    "secrets": [
      {"component": "comp_id", "store": "Secret Manager|CyberArk|Vault|KMS", "credential": "what credential", "rotation": "90 days"}
    ],
    "identity": {"provider": "Okta|Azure AD|Google", "protocol": "SAML|OAuth|OIDC", "userAuth": "method", "serviceAuth": "method"}
  },
  "threats": [
    {"id": "T1", "location": "1", "locationType": "flow|component", "stride": "S|T|R|I|D|E",
     "severity": "critical|high|medium|low", "title": "Short title",
     "description": "Specific threat description", "impact": "What happens",
     "mitigation": "Specific technical fix", "compliance": "HIPAA|PCI|GDPR|SOC2|null"}
  ]
}

EXAMPLE for "Healthcare AI: EHR → BigQuery → Vertex AI → dashboard":
{
  "title": "Clinical AI Pipeline",
  "groups": [
    {"id":"src","name":"Clinical Sources","category":"actors","components":[
      {"id":"ehr","name":"Epic EHR","icon":null,"subtitle":"FHIR R4"},
      {"id":"labs","name":"Lab Systems","icon":null,"subtitle":"HL7 v2"}]},
    {"id":"ingest","name":"Ingestion","category":"ingestion","components":[
      {"id":"gw","name":"API Gateway","icon":"cloud_api_gateway","subtitle":"FHIR Proxy"},
      {"id":"ps","name":"Pub/Sub","icon":"pubsub","subtitle":"Events"}]},
    {"id":"store","name":"Data Lake","category":"storage","components":[
      {"id":"bq","name":"BigQuery","icon":"bigquery","subtitle":"PHI Lake"},
      {"id":"gcs","name":"Cloud Storage","icon":"cloud_storage","subtitle":"Raw FHIR"}]},
    {"id":"ml","name":"AI/ML","category":"ai","components":[
      {"id":"vtx","name":"Vertex AI","icon":"vertexai","subtitle":"Training"},
      {"id":"ep","name":"Vertex AI","icon":"vertexai","subtitle":"Endpoints"}]},
    {"id":"app","name":"Application","category":"serving","components":[
      {"id":"run","name":"Cloud Run","icon":"cloud_run","subtitle":"API"},
      {"id":"dash","name":"Looker","icon":"looker","subtitle":"Dashboard"}]}
  ],
  "flows": [
    {"from":"ehr","to":"gw","label":"Patient Records","step":1},
    {"from":"gw","to":"ps","label":"Validated Events","step":2},
    {"from":"ps","to":"bq","label":"Structured Data","step":3},
    {"from":"bq","to":"vtx","label":"Training Features","step":4},
    {"from":"vtx","to":"run","label":"Predictions","step":5},
    {"from":"run","to":"dash","label":"Risk Scores","step":6}
  ],
  "trustBoundaries": [
    {"id":"onprem","name":"Hospital Network","type":"external","groups":["src"]},
    {"id":"dmz","name":"API DMZ","type":"dmz","groups":["ingest"]},
    {"id":"vpc","name":"Analytics VPC","type":"vpc","groups":["store","ml"]},
    {"id":"srv","name":"Serving Zone","type":"vpc","groups":["app"]}
  ],
  "security": {
    "flows": [
      {"step":1,"transport":"TLS 1.3 via Interconnect","auth":"mTLS","dataClassification":"regulated","private":true},
      {"step":2,"transport":"TLS 1.3","auth":"IAM","dataClassification":"regulated","private":true},
      {"step":3,"transport":"Internal gRPC","auth":"IAM","dataClassification":"regulated","private":true},
      {"step":4,"transport":"Internal","auth":"Workload Identity","dataClassification":"confidential","private":true},
      {"step":5,"transport":"TLS 1.3","auth":"IAM SA","dataClassification":"confidential","private":true},
      {"step":6,"transport":"TLS 1.3","auth":"OAuth 2.0 + MFA","dataClassification":"confidential","private":false}
    ],
    "secrets": [
      {"component":"gw","store":"Secret Manager","credential":"EHR client cert","rotation":"yearly"},
      {"component":"bq","store":"KMS","credential":"CMEK key","rotation":"365 days"}
    ],
    "identity":{"provider":"Azure AD + Google","protocol":"SAML 2.0","userAuth":"OAuth + MFA","serviceAuth":"Workload Identity"}
  },
  "threats": [
    {"id":"T1","location":"1","locationType":"flow","stride":"I","severity":"critical",
     "title":"PHI in transit exposure","description":"Patient data crosses from hospital to cloud over network boundary",
     "impact":"HIPAA breach, $1.5M+ fine","mitigation":"VPC Service Controls, Cloud Interconnect only, DLP on ingress","compliance":"HIPAA"},
    {"id":"T2","location":"bq","locationType":"component","stride":"I","severity":"high",
     "title":"BigQuery over-permissive IAM","description":"Broad IAM could expose PHI to unauthorized users",
     "impact":"Unauthorized PHI access","mitigation":"Column-level security, authorized views, audit logs","compliance":"HIPAA"},
    {"id":"T3","location":"6","locationType":"flow","stride":"S","severity":"high",
     "title":"Dashboard session hijack","description":"Public-facing dashboard vulnerable to token theft",
     "impact":"Attacker sees patient risk scores","mitigation":"Short-lived tokens, IP binding, Cloud Armor WAF","compliance":"HIPAA"},
    {"id":"T4","location":"ps","locationType":"component","stride":"I","severity":"medium",
     "title":"Dead-letter retains PHI","description":"Failed messages with PHI sit without TTL",
     "impact":"Stale PHI beyond retention","mitigation":"CMEK encryption, 7-day TTL, DLP scan","compliance":"HIPAA"}
  ]
}

6 flows numbered 1-6, no gaps, all cross-group, left to right. Generate for user's system. Output ONLY JSON.`;

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
      const dj = JSON.parse(clean);

      // ── POST-PROCESS: fix flows ──
      if (dj.flows && dj.groups) {
        // Build comp→group map
        const c2g: Record<string, string> = {};
        for (const g of dj.groups) for (const c of g.components) c2g[c.id] = g.id;

        // Remove within-group flows
        const crossFlows = dj.flows.filter((f: any) => {
          const a = c2g[f.from], b = c2g[f.to];
          return a && b && a !== b;
        });

        // Sort by whatever step the LLM gave, then OVERWRITE with 1,2,3...
        crossFlows.sort((a: any, b: any) => (a.step ?? 999) - (b.step ?? 999));
        for (let i = 0; i < crossFlows.length; i++) {
          crossFlows[i].step = i + 1;
        }
        dj.flows = crossFlows;

        // Rebuild security.flows to match new step numbers
        if (dj.security?.flows && Array.isArray(dj.security.flows)) {
          const secMap: Record<number, any> = {};
          for (const sf of dj.security.flows) secMap[sf.step] = sf;
          dj.security.flows = crossFlows.map((f: any, i: number) => {
            // Try to find a security entry — match by index since steps were renumbered
            const orig = dj.security.flows[i] || {};
            return { ...orig, step: f.step };
          });
        }
      }

      const userId = req.user.claims.sub;
      const [saved] = await db.insert(diagrams).values({
        title: dj.title || "Untitled",
        prompt,
        diagramJson: JSON.stringify(dj),
        userId,
      }).returning();

      res.json({ diagram: dj, saved });
    } catch (error: any) {
      console.error("Diagram error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to generate diagram" });
    }
  });

  app.get("/api/diagrams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      res.json(await db.select().from(diagrams).where(eq(diagrams.userId, userId)).orderBy(desc(diagrams.createdAt)));
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
