import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const ICONS = `compute_engine,cloud_run,cloud_functions,app_engine,google_kubernetes_engine,cloud_gpu,cloud_tpu,batch,cloud_storage,bigquery,cloud_sql,cloud_spanner,firestore,bigtable,datastore,memorystore,filestore,persistent_disk,dataflow,dataproc,pubsub,data_catalog,dataprep,dataplex,datastream,analytics_hub,data_studio,looker,vertexai,ai_platform,automl,cloud_natural_language_api,cloud_vision_api,cloud_translation_api,speech-to-text,text-to-speech,dialogflow,document_ai,recommendations_ai,tensorflow_enterprise,cloud_load_balancing,cloud_cdn,cloud_dns,cloud_vpn,cloud_nat,cloud_armor,cloud_interconnect,virtual_private_cloud,traffic_director,identity_and_access_management,security_command_center,secret_manager,key_management_service,binary_authorization,identity_platform,cloud_audit_logs,cloud_build,artifact_registry,cloud_deploy,cloud_monitoring,cloud_logging,error_reporting,trace,cloud_scheduler,cloud_tasks,apigee_api_platform,cloud_api_gateway,cloud_endpoints,eventarc,workflows,connectors`;

const SYSTEM_PROMPT = `You are a senior cloud security architect. Generate an architecture diagram that tells a COMPLETE DATA STORY — what data moves, how systems connect, how it's secured, and where risks exist.

THINK IN THIS ORDER:

1. DATA JOURNEY: Trace data from origin to destination, left to right. Create 5-7 groups as pipeline stages. Each has 2-3 components.

2. FLOWS: Create 5-8 flows numbered 1,2,3... connecting components in DIFFERENT groups. Each flow describes:
   - label: WHAT data moves (be specific: "Patient FHIR Bundle", not just "data")
   - subtitle: HOW it connects (protocol + auth: "TLS 1.3 via Interconnect / mTLS")

3. TRUST BOUNDARIES: What network zones exist?
   - "external" = outside your control (users, on-prem, SaaS)
   - "dmz" = internet-facing controlled (API gateway, WAF)
   - "vpc" = private cloud network
   - "restricted" = highest security (PII/PHI storage, keys)

4. SECURITY per flow: transport, auth method, data classification, private or public

5. SECRETS: Where are credentials stored? (Secret Manager, CyberArk, KMS, Vault)

6. THREATS: Realistic threats at critical points. Use STRIDE (S=Spoofing, T=Tampering, R=Repudiation, I=InfoDisclosure, D=DoS, E=ElevationOfPrivilege). Include specific mitigations.

Icons: ${ICONS}. Use exact IDs or null.
Categories: actors, channels, ingestion, processing, ai, storage, serving, output, security, monitoring

OUTPUT (JSON only, no markdown):
{
  "title": "System Title",
  "subtitle": "One sentence: what enters and what comes out",
  "groups": [
    {"id":"gid","name":"Stage Name","category":"cat",
     "components":[{"id":"cid","name":"Name (max 16)","icon":"icon_or_null","subtitle":"role"}]}
  ],
  "flows": [
    {"from":"compA","to":"compB","label":"What data","subtitle":"How: protocol / auth","step":1}
  ],
  "trustBoundaries": [
    {"id":"tb1","name":"Zone Name","type":"external|dmz|vpc|restricted","groups":["gid1","gid2"]}
  ],
  "security": {
    "flows": [
      {"step":1,"transport":"TLS 1.3","auth":"mTLS","dataClassification":"regulated","private":true}
    ],
    "secrets": [
      {"component":"cid","store":"Secret Manager","credential":"DB password","rotation":"90 days"}
    ]
  },
  "threats": [
    {"id":"T1","location":"1","locationType":"flow|component","stride":"I",
     "severity":"critical|high|medium|low","title":"Short title",
     "description":"Specific threat","impact":"What happens",
     "mitigation":"Specific fix","compliance":"HIPAA|PCI|GDPR|SOC2|null"}
  ]
}

EXAMPLE — "Healthcare AI: EHR → BigQuery → Vertex AI → dashboard":
{
  "title": "Clinical Risk Prediction Pipeline",
  "subtitle": "Patient records from EHR are processed, scored by ML, and risk predictions displayed to clinicians",
  "groups": [
    {"id":"src","name":"Clinical Sources","category":"actors","components":[
      {"id":"ehr","name":"Epic EHR","icon":null,"subtitle":"FHIR R4 Server"},
      {"id":"labs","name":"Lab Systems","icon":null,"subtitle":"HL7 v2 Feed"}]},
    {"id":"entry","name":"API & Ingestion","category":"ingestion","components":[
      {"id":"gw","name":"Apigee Gateway","icon":"apigee_api_platform","subtitle":"WAF + Rate Limit"},
      {"id":"ps","name":"Pub/Sub","icon":"pubsub","subtitle":"Event Buffer"}]},
    {"id":"proc","name":"Processing","category":"processing","components":[
      {"id":"df","name":"Dataflow","icon":"dataflow","subtitle":"ETL + DLP Scan"},
      {"id":"gcs","name":"Cloud Storage","icon":"cloud_storage","subtitle":"Raw FHIR Zone"}]},
    {"id":"store","name":"Analytics","category":"storage","components":[
      {"id":"bq","name":"BigQuery","icon":"bigquery","subtitle":"PHI Data Lake"},
      {"id":"fs","name":"Feature Store","icon":"vertexai","subtitle":"ML Features"}]},
    {"id":"ml","name":"AI / ML","category":"ai","components":[
      {"id":"vtx","name":"Vertex AI","icon":"vertexai","subtitle":"Training + Endpoints"}]},
    {"id":"serve","name":"Application","category":"serving","components":[
      {"id":"run","name":"Cloud Run","icon":"cloud_run","subtitle":"Prediction API"},
      {"id":"dash","name":"Looker","icon":"looker","subtitle":"Clinician Dashboard"}]}
  ],
  "flows": [
    {"from":"ehr","to":"gw","label":"Patient FHIR Bundle","subtitle":"TLS 1.3 via Cloud Interconnect / mTLS cert","step":1},
    {"from":"gw","to":"ps","label":"Validated FHIR Events","subtitle":"Internal / IAM Service Account","step":2},
    {"from":"ps","to":"df","label":"Raw Event Stream","subtitle":"Push Subscription / IAM","step":3},
    {"from":"df","to":"bq","label":"Clean Patient Records","subtitle":"Internal VPC / Workload Identity","step":4},
    {"from":"bq","to":"vtx","label":"Training Features","subtitle":"BigQuery Read / ML Service Account","step":5},
    {"from":"vtx","to":"run","label":"Risk Score Prediction","subtitle":"Internal gRPC / IAM","step":6},
    {"from":"run","to":"dash","label":"Risk Score JSON","subtitle":"HTTPS / OAuth 2.0 + MFA","step":7}
  ],
  "trustBoundaries": [
    {"id":"onprem","name":"Hospital Network","type":"external","groups":["src"]},
    {"id":"dmz","name":"API DMZ","type":"dmz","groups":["entry"]},
    {"id":"vpc","name":"Data VPC","type":"vpc","groups":["proc","store","ml"]},
    {"id":"svc","name":"Serving VPC","type":"vpc","groups":["serve"]}
  ],
  "security": {
    "flows": [
      {"step":1,"transport":"TLS 1.3 via Interconnect","auth":"mTLS client cert","dataClassification":"regulated","private":true},
      {"step":2,"transport":"TLS 1.3","auth":"IAM Service Account","dataClassification":"regulated","private":true},
      {"step":3,"transport":"Internal gRPC","auth":"IAM","dataClassification":"regulated","private":true},
      {"step":4,"transport":"Internal","auth":"Workload Identity","dataClassification":"regulated","private":true},
      {"step":5,"transport":"Internal","auth":"ML Service Account","dataClassification":"confidential","private":true},
      {"step":6,"transport":"Internal gRPC","auth":"IAM","dataClassification":"confidential","private":true},
      {"step":7,"transport":"HTTPS","auth":"OAuth 2.0 + MFA","dataClassification":"confidential","private":false}
    ],
    "secrets": [
      {"component":"gw","store":"Secret Manager","credential":"EHR mTLS client certificate","rotation":"yearly"},
      {"component":"bq","store":"KMS","credential":"CMEK encryption key","rotation":"365 days"},
      {"component":"run","store":"Secret Manager","credential":"OAuth client secret","rotation":"90 days"}
    ]
  },
  "threats": [
    {"id":"T1","location":"1","locationType":"flow","stride":"I","severity":"critical",
     "title":"PHI exposed crossing trust boundary",
     "description":"Patient records cross from hospital to cloud. Interconnect failure could route via public internet.",
     "impact":"HIPAA breach, $1.5M+ fine","mitigation":"VPC Service Controls, failover VPN not public, DLP on ingress","compliance":"HIPAA"},
    {"id":"T2","location":"bq","locationType":"component","stride":"I","severity":"high",
     "title":"BigQuery over-permissive IAM",
     "description":"PHI accessible if IAM roles too broad",
     "impact":"Unauthorized PHI access","mitigation":"Column-level security, authorized views, audit logs","compliance":"HIPAA"},
    {"id":"T3","location":"7","locationType":"flow","stride":"S","severity":"high",
     "title":"Dashboard session hijacking",
     "description":"Internet-facing dashboard vulnerable to token theft",
     "impact":"Attacker sees patient risk scores","mitigation":"Short-lived tokens, IP binding, Cloud Armor WAF","compliance":"HIPAA"}
  ]
}

7 flows numbered 1-7, all cross-group, left to right. Each tells WHAT moves and HOW.
Generate the COMPLETE story. Output ONLY JSON.`;

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

      // Post-process: remove within-group flows, force sequential numbering
      if (dj.flows && dj.groups) {
        const c2g: Record<string, string> = {};
        for (const g of dj.groups) for (const c of g.components) c2g[c.id] = g.id;
        const cross = dj.flows.filter((f: any) => { const a = c2g[f.from], b = c2g[f.to]; return a && b && a !== b; });
        cross.sort((a: any, b: any) => (a.step ?? 999) - (b.step ?? 999));
        for (let i = 0; i < cross.length; i++) cross[i].step = i + 1;
        dj.flows = cross;
        // Re-align security.flows steps
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
