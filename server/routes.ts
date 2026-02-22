import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const ICONS = `compute_engine,cloud_run,cloud_functions,app_engine,google_kubernetes_engine,cloud_gpu,cloud_tpu,batch,cloud_storage,bigquery,cloud_sql,cloud_spanner,firestore,bigtable,datastore,memorystore,filestore,persistent_disk,dataflow,dataproc,pubsub,data_catalog,dataprep,dataplex,datastream,analytics_hub,data_studio,looker,vertexai,ai_platform,automl,cloud_natural_language_api,cloud_vision_api,cloud_translation_api,speech-to-text,text-to-speech,dialogflow,document_ai,recommendations_ai,tensorflow_enterprise,cloud_load_balancing,cloud_cdn,cloud_dns,cloud_vpn,cloud_nat,cloud_armor,cloud_interconnect,virtual_private_cloud,traffic_director,identity_and_access_management,security_command_center,secret_manager,key_management_service,binary_authorization,identity_platform,cloud_audit_logs,cloud_build,artifact_registry,cloud_deploy,cloud_monitoring,cloud_logging,error_reporting,trace,cloud_scheduler,cloud_tasks,apigee_api_platform,cloud_api_gateway,cloud_endpoints,eventarc,workflows,connectors`;

const SYSTEM_PROMPT = `You are a senior cloud architect. Generate an architecture diagram showing data flowing from EXTERNAL SOURCES into GOOGLE CLOUD.

STRUCTURE:
1. First group = EXTERNAL SOURCES (category: "actors", cloud: "external")
   - Systems OUTSIDE GCP: on-prem DBs, AWS services, SaaS apps, users, IoT
   - icon: null (not GCP services)

2. Remaining groups = GCP SERVICES (category varies, cloud: "gcp")
   - Ordered left to right as pipeline: ingestion → processing → storage → ai → serving
   - Use exact GCP icon IDs. Each group has 1-3 components.

FLOWS: 5-8 flows numbered 1,2,3... NO gaps. Each connects components in DIFFERENT groups.
- label: WHAT data moves (specific: "Patient FHIR Bundle", "CDC Change Events")
- subtitle: HOW it connects (protocol + auth: "VPN / IAM Service Account", "TLS 1.3 / mTLS")

TRUST BOUNDARIES: Keep it simple. Only TWO:
- One "external" boundary around the sources group
- One "vpc" boundary around ALL GCP groups (one single VPC, not multiple)

SECURITY per flow: transport, auth, dataClassification (regulated/confidential/internal), private (boolean)
SECRETS: where credentials stored (Secret Manager, KMS, etc.)
THREATS: 3-5 realistic threats, STRIDE tagged (S/T/R/I/D/E), with mitigations

GCP Icons: ${ICONS}. Use exact IDs or null.

OUTPUT (JSON only, no markdown):
{
  "title": "System Title",
  "subtitle": "One sentence summary",
  "groups": [
    {"id":"gid","name":"Name","category":"actors|ingestion|processing|ai|storage|serving|output","cloud":"external|gcp",
     "components":[{"id":"cid","name":"Name (max 16)","icon":"gcp_icon_or_null","subtitle":"role"}]}
  ],
  "flows": [
    {"from":"compA","to":"compB","label":"What data","subtitle":"How: protocol / auth","step":1}
  ],
  "trustBoundaries": [
    {"id":"ext","name":"External / On-Prem","type":"external","groups":["source_grp_id"]},
    {"id":"vpc","name":"Project VPC","type":"vpc","groups":["all","gcp","group","ids"]}
  ],
  "security": {
    "flows": [{"step":1,"transport":"TLS 1.3","auth":"mTLS","dataClassification":"regulated","private":true}],
    "secrets": [{"component":"cid","store":"Secret Manager","credential":"what","rotation":"90 days"}]
  },
  "threats": [
    {"id":"T1","location":"1","locationType":"flow|component","stride":"S|T|R|I|D|E",
     "severity":"critical|high|medium|low","title":"Short title",
     "description":"Detail","impact":"What happens","mitigation":"Fix","compliance":"HIPAA|SOC2|null"}
  ]
}

EXAMPLE — "Transfer from AWS RDS to BigQuery":
{
  "title": "AWS to GCP Analytics Pipeline",
  "subtitle": "Database records from AWS RDS replicated into BigQuery for analytics and ML",
  "groups": [
    {"id":"src","name":"AWS Sources","category":"actors","cloud":"external","components":[
      {"id":"rds","name":"AWS RDS","icon":null,"subtitle":"PostgreSQL"},
      {"id":"s3","name":"AWS S3","icon":null,"subtitle":"Data Lake"}
    ]},
    {"id":"ingest","name":"Ingestion","category":"ingestion","cloud":"gcp","components":[
      {"id":"ds","name":"Datastream","icon":"datastream","subtitle":"CDC Replication"},
      {"id":"gcs","name":"Cloud Storage","icon":"cloud_storage","subtitle":"Landing Zone"}
    ]},
    {"id":"proc","name":"Processing","category":"processing","cloud":"gcp","components":[
      {"id":"df","name":"Dataflow","icon":"dataflow","subtitle":"ETL + Validation"}
    ]},
    {"id":"store","name":"Analytics","category":"storage","cloud":"gcp","components":[
      {"id":"bq","name":"BigQuery","icon":"bigquery","subtitle":"Data Warehouse"},
      {"id":"fs","name":"Feature Store","icon":"vertexai","subtitle":"ML Features"}
    ]},
    {"id":"serve","name":"Serving","category":"serving","cloud":"gcp","components":[
      {"id":"look","name":"Looker","icon":"looker","subtitle":"Dashboards"},
      {"id":"run","name":"Cloud Run","icon":"cloud_run","subtitle":"Data API"}
    ]}
  ],
  "flows": [
    {"from":"rds","to":"ds","label":"CDC Change Events","subtitle":"VPN Tunnel / IAM SA","step":1},
    {"from":"s3","to":"gcs","label":"Parquet Files","subtitle":"Storage Transfer / HMAC","step":2},
    {"from":"ds","to":"gcs","label":"Raw CDC Records","subtitle":"Internal / Workload Identity","step":3},
    {"from":"gcs","to":"df","label":"Staged Data","subtitle":"Internal / IAM","step":4},
    {"from":"df","to":"bq","label":"Clean Records","subtitle":"Streaming API / WI","step":5},
    {"from":"bq","to":"look","label":"Analytics Views","subtitle":"BQ API / OAuth 2.0","step":6},
    {"from":"bq","to":"run","label":"Query Results","subtitle":"BQ API / IAM SA","step":7}
  ],
  "trustBoundaries": [
    {"id":"ext","name":"AWS Account","type":"external","groups":["src"]},
    {"id":"vpc","name":"Project VPC","type":"vpc","groups":["ingest","proc","store","serve"]}
  ],
  "security": {
    "flows": [
      {"step":1,"transport":"VPN Tunnel","auth":"IAM Service Account","dataClassification":"confidential","private":true},
      {"step":2,"transport":"HTTPS","auth":"HMAC Key","dataClassification":"confidential","private":true},
      {"step":3,"transport":"Internal","auth":"Workload Identity","dataClassification":"confidential","private":true},
      {"step":4,"transport":"Internal","auth":"IAM","dataClassification":"confidential","private":true},
      {"step":5,"transport":"Internal gRPC","auth":"Workload Identity","dataClassification":"confidential","private":true},
      {"step":6,"transport":"HTTPS","auth":"OAuth 2.0","dataClassification":"internal","private":false},
      {"step":7,"transport":"Internal","auth":"IAM SA","dataClassification":"internal","private":true}
    ],
    "secrets": [
      {"component":"ds","store":"Secret Manager","credential":"RDS connection string","rotation":"90 days"},
      {"component":"gcs","store":"Secret Manager","credential":"AWS HMAC key","rotation":"180 days"},
      {"component":"bq","store":"KMS","credential":"CMEK encryption key","rotation":"365 days"}
    ]
  },
  "threats": [
    {"id":"T1","location":"1","locationType":"flow","stride":"I","severity":"high",
     "title":"VPN tunnel interception","description":"Cross-cloud VPN could be compromised",
     "impact":"Database records exposed","mitigation":"IPSec + app-layer TLS, VPN monitoring","compliance":"SOC2"},
    {"id":"T2","location":"bq","locationType":"component","stride":"I","severity":"high",
     "title":"Over-permissive BigQuery IAM","description":"Broad roles expose sensitive columns",
     "impact":"Unauthorized data access","mitigation":"Column-level security, authorized views","compliance":"SOC2"},
    {"id":"T3","location":"6","locationType":"flow","stride":"S","severity":"medium",
     "title":"Dashboard token theft","description":"OAuth token stolen via XSS",
     "impact":"Unauthorized analytics access","mitigation":"CSP headers, short TTL, IP binding","compliance":"SOC2"}
  ]
}

Only TWO trust boundaries: external + one VPC. Clean and simple.
Generate the COMPLETE architecture. Output ONLY JSON.`;

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  app.post("/api/diagrams/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });
      if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: "API key not configured" });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 8000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: prompt }] }),
      });

      if (!response.ok) { const e = await response.json(); throw new Error(e.error?.message || "API error"); }
      const data = await response.json();
      const dj = JSON.parse((data.content?.[0]?.text || "").replace(/```json\s*/g, "").replace(/```/g, "").trim());

      if (dj.flows && dj.groups) {
        const c2g: Record<string, string> = {};
        for (const g of dj.groups) for (const c of g.components) c2g[c.id] = g.id;
        const cross = dj.flows.filter((f: any) => { const a = c2g[f.from], b = c2g[f.to]; return a && b && a !== b; });
        cross.sort((a: any, b: any) => (a.step ?? 999) - (b.step ?? 999));
        for (let i = 0; i < cross.length; i++) cross[i].step = i + 1;
        dj.flows = cross;
        if (dj.security?.flows) {
          const newSec: any[] = [];
          cross.forEach((f: any, i: number) => {
            const sf = dj.security.flows.find((s: any) => s.step === f.step) || dj.security.flows[i] || {};
            newSec.push({ ...sf, step: i + 1 });
          });
          dj.security.flows = newSec;
        }
      }

      const userId = req.user.claims.sub;
      const [saved] = await db.insert(diagrams).values({ title: dj.title || "Untitled", prompt, diagramJson: JSON.stringify(dj), userId }).returning();
      res.json({ diagram: dj, saved });
    } catch (error: any) {
      console.error("Diagram error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to generate diagram" });
    }
  });

  app.get("/api/diagrams", isAuthenticated, async (req: any, res) => {
    try { res.json(await db.select().from(diagrams).where(eq(diagrams.userId, req.user.claims.sub)).orderBy(desc(diagrams.createdAt))); } catch { res.status(500).json({ error: "Failed" }); }
  });
  app.get("/api/diagrams/:id", isAuthenticated, async (req: any, res) => {
    try { const [d] = await db.select().from(diagrams).where(and(eq(diagrams.id, parseInt(req.params.id)), eq(diagrams.userId, req.user.claims.sub))); d ? res.json(d) : res.status(404).json({ error: "Not found" }); } catch { res.status(500).json({ error: "Failed" }); }
  });
  app.delete("/api/diagrams/:id", isAuthenticated, async (req: any, res) => {
    try { await db.delete(diagrams).where(and(eq(diagrams.id, parseInt(req.params.id)), eq(diagrams.userId, req.user.claims.sub))); res.status(204).send(); } catch { res.status(500).json({ error: "Failed" }); }
  });

  return httpServer;
}
