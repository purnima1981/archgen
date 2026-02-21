import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const ICONS = `compute_engine,cloud_run,cloud_functions,app_engine,google_kubernetes_engine,cloud_gpu,cloud_tpu,batch,cloud_storage,bigquery,cloud_sql,cloud_spanner,firestore,bigtable,datastore,memorystore,filestore,persistent_disk,dataflow,dataproc,pubsub,data_catalog,dataprep,dataplex,datastream,analytics_hub,data_studio,looker,vertexai,ai_platform,automl,cloud_natural_language_api,cloud_vision_api,cloud_translation_api,speech-to-text,text-to-speech,dialogflow,document_ai,recommendations_ai,tensorflow_enterprise,cloud_load_balancing,cloud_cdn,cloud_dns,cloud_vpn,cloud_nat,cloud_armor,cloud_interconnect,virtual_private_cloud,traffic_director,identity_and_access_management,security_command_center,secret_manager,key_management_service,binary_authorization,identity_platform,cloud_audit_logs,cloud_build,artifact_registry,cloud_deploy,cloud_monitoring,cloud_logging,error_reporting,trace,cloud_scheduler,cloud_tasks,apigee_api_platform,cloud_api_gateway,cloud_endpoints,eventarc,workflows,connectors`;

const SYSTEM_PROMPT = `You are a cloud architect. Generate a LEFT-TO-RIGHT pipeline architecture diagram.

LAYOUT RULE: The diagram reads LEFT → RIGHT. Group 1 is leftmost, last group is rightmost. Data flows from left to right through the pipeline stages.

RULES:
1. Create 4-6 groups ordered as pipeline stages (left to right).
2. Each group has 2-3 components. Components in a group are related services at the same pipeline stage.
3. Create 5-8 flows. EACH flow connects one component to one component in a DIFFERENT group.
4. Flows are numbered 1, 2, 3, 4, 5... with NO gaps. Step 1 starts at the leftmost group.
5. The flow chain should read left to right: step 1 exits group 1, step 2 exits group 1 or 2, etc.
6. NEVER create flows between components in the SAME group.
7. Every flow has a short label describing what data moves.
8. For icons use exact IDs from: ${ICONS}. Use null if no match.

Categories: actors, channels, ingestion, processing, ai, storage, serving, output, security, monitoring

OUTPUT (JSON only):
{
  "title": "Short Title",
  "groups": [
    {
      "id": "grp_id",
      "name": "Group Name",
      "category": "category_name",
      "components": [
        {"id": "comp_id", "name": "Display Name", "icon": "icon_id_or_null", "subtitle": "detail"}
      ]
    }
  ],
  "flows": [
    {"from": "comp_in_group_A", "to": "comp_in_group_B", "label": "What moves", "step": 1}
  ]
}

EXAMPLE:
{
  "title": "Clinical AI Pipeline",
  "groups": [
    {"id": "src", "name": "Data Sources", "category": "actors", "components": [
      {"id": "ehr", "name": "Epic EHR", "icon": null, "subtitle": "FHIR R4"},
      {"id": "labs", "name": "Lab Systems", "icon": null, "subtitle": "HL7"}
    ]},
    {"id": "ingest", "name": "Ingestion", "category": "ingestion", "components": [
      {"id": "ps", "name": "Pub/Sub", "icon": "pubsub", "subtitle": "Events"},
      {"id": "df", "name": "Dataflow", "icon": "dataflow", "subtitle": "ETL"}
    ]},
    {"id": "store", "name": "Data Lake", "category": "storage", "components": [
      {"id": "bq", "name": "BigQuery", "icon": "bigquery", "subtitle": "Analytics"},
      {"id": "gcs", "name": "Cloud Storage", "icon": "cloud_storage", "subtitle": "Raw"}
    ]},
    {"id": "ml", "name": "AI/ML", "category": "ai", "components": [
      {"id": "vtx", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Training"},
      {"id": "ep", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Endpoints"}
    ]},
    {"id": "app", "name": "Serving", "category": "serving", "components": [
      {"id": "run", "name": "Cloud Run", "icon": "cloud_run", "subtitle": "API"},
      {"id": "dash", "name": "Looker", "icon": "looker", "subtitle": "Dashboard"}
    ]}
  ],
  "flows": [
    {"from": "ehr", "to": "ps", "label": "Patient Events", "step": 1},
    {"from": "ps", "to": "df", "label": "Raw Stream", "step": 2},
    {"from": "df", "to": "bq", "label": "Clean Records", "step": 3},
    {"from": "bq", "to": "vtx", "label": "Training Data", "step": 4},
    {"from": "vtx", "to": "ep", "label": "Trained Model", "step": 5},
    {"from": "ep", "to": "run", "label": "Predictions", "step": 6},
    {"from": "run", "to": "dash", "label": "Risk Scores", "step": 7}
  ]
}

7 steps, numbered 1-7, no gaps, all cross-group, flows left to right.
Output ONLY valid JSON.`;

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
          max_tokens: 4000,
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

      // POST-PROCESS: Remove within-group flows, renumber sequentially
      if (diagramJson.flows && diagramJson.groups) {
        const c2g: Record<string, string> = {};
        for (const g of diagramJson.groups) {
          for (const c of g.components) { c2g[c.id] = g.id; }
        }
        // Filter: only cross-group flows
        diagramJson.flows = diagramJson.flows.filter((f: any) => {
          const fg = c2g[f.from], tg = c2g[f.to];
          return fg && tg && fg !== tg;
        });
        // Sort by original step, then renumber 1,2,3...
        diagramJson.flows.sort((a: any, b: any) => (a.step || 999) - (b.step || 999));
        diagramJson.flows.forEach((f: any, i: number) => { f.step = i + 1; });
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
