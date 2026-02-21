import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const ICONS = `compute_engine,cloud_run,cloud_functions,app_engine,google_kubernetes_engine,cloud_gpu,cloud_tpu,batch,cloud_storage,bigquery,cloud_sql,cloud_spanner,firestore,bigtable,datastore,memorystore,filestore,persistent_disk,dataflow,dataproc,pubsub,data_catalog,dataprep,dataplex,datastream,analytics_hub,data_studio,looker,vertexai,ai_platform,automl,cloud_natural_language_api,cloud_vision_api,cloud_translation_api,speech-to-text,text-to-speech,dialogflow,document_ai,recommendations_ai,tensorflow_enterprise,cloud_load_balancing,cloud_cdn,cloud_dns,cloud_vpn,cloud_nat,cloud_armor,cloud_interconnect,virtual_private_cloud,traffic_director,identity_and_access_management,security_command_center,secret_manager,key_management_service,binary_authorization,identity_platform,cloud_audit_logs,cloud_build,artifact_registry,cloud_deploy,cloud_monitoring,cloud_logging,error_reporting,trace,cloud_scheduler,cloud_tasks,apigee_api_platform,cloud_api_gateway,cloud_endpoints,eventarc,workflows,connectors`;

const SYSTEM_PROMPT = `You are a cloud solutions architect. Given a system description, produce a JSON architecture diagram.

IMPORTANT RULES:
1. Create 4-7 groups. Each group has 2-4 components. Groups represent pipeline stages.
2. Every component gets a unique short id (like "bq", "run1", "dash").
3. Flows connect components in DIFFERENT groups only. NEVER create a flow between two components in the same group.
4. Flows are numbered sequentially: 1, 2, 3, 4, 5, 6... NO gaps, NO skipping.
5. The flow chain tells the data story from source to destination.
6. Every flow MUST have a descriptive label (what data moves).
7. For icons, use exact IDs from: ${ICONS}. Set null if no match.

CRITICAL FLOW RULES:
- Flows ONLY between DIFFERENT groups. If comp A and comp B are in the same group, do NOT connect them.
- Number every flow starting at 1. If you have 6 flows, they are numbered 1,2,3,4,5,6.
- The chain should be continuous: step N's target group is usually step N+1's source group.

Categories: actors, channels, ingestion, processing, ai, storage, serving, output, security, monitoring

OUTPUT FORMAT (JSON only, no markdown):
{
  "title": "Short Title",
  "groups": [
    {
      "id": "grp_id",
      "name": "Group Name",
      "category": "category",
      "components": [
        {"id": "comp_id", "name": "Display Name", "icon": "icon_id_or_null", "subtitle": "detail"}
      ]
    }
  ],
  "flows": [
    {"from": "comp_id_in_group_A", "to": "comp_id_in_group_B", "label": "What moves", "step": 1}
  ]
}

EXAMPLE:
Input: "Healthcare AI: EHR data → BigQuery → Vertex AI → dashboard"

{
  "title": "Clinical AI Pipeline",
  "groups": [
    {
      "id": "src", "name": "Data Sources", "category": "actors",
      "components": [
        {"id": "ehr", "name": "Epic EHR", "icon": null, "subtitle": "FHIR R4"},
        {"id": "labs", "name": "Lab Systems", "icon": null, "subtitle": "HL7"}
      ]
    },
    {
      "id": "ingest", "name": "Ingestion", "category": "ingestion",
      "components": [
        {"id": "ps", "name": "Pub/Sub", "icon": "pubsub", "subtitle": "Events"},
        {"id": "df", "name": "Dataflow", "icon": "dataflow", "subtitle": "ETL"}
      ]
    },
    {
      "id": "store", "name": "Data Lake", "category": "storage",
      "components": [
        {"id": "bq", "name": "BigQuery", "icon": "bigquery", "subtitle": "Analytics"},
        {"id": "gcs", "name": "Cloud Storage", "icon": "cloud_storage", "subtitle": "Raw"}
      ]
    },
    {
      "id": "ml", "name": "AI/ML", "category": "ai",
      "components": [
        {"id": "vtx", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Training"},
        {"id": "ep", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Endpoints"}
      ]
    },
    {
      "id": "app", "name": "Serving", "category": "serving",
      "components": [
        {"id": "run", "name": "Cloud Run", "icon": "cloud_run", "subtitle": "API"},
        {"id": "lb", "name": "Load Balancer", "icon": "cloud_load_balancing", "subtitle": "HTTPS"}
      ]
    },
    {
      "id": "ui", "name": "Frontends", "category": "channels",
      "components": [
        {"id": "dash", "name": "Looker", "icon": "looker", "subtitle": "Dashboard"},
        {"id": "mob", "name": "App Engine", "icon": "app_engine", "subtitle": "Mobile"}
      ]
    }
  ],
  "flows": [
    {"from": "ehr", "to": "ps", "label": "Patient Events", "step": 1},
    {"from": "ps", "to": "df", "label": "Raw Stream", "step": 2},
    {"from": "df", "to": "bq", "label": "Structured Data", "step": 3},
    {"from": "bq", "to": "vtx", "label": "Training Data", "step": 4},
    {"from": "vtx", "to": "run", "label": "Model Serving", "step": 5},
    {"from": "run", "to": "dash", "label": "Predictions", "step": 6}
  ]
}

Note: 6 flows, numbered 1-6, every flow crosses groups, no within-group flows.
Generate for the user's description. Output ONLY JSON.`;

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

      // POST-PROCESS: Force sequential numbering on cross-group flows
      if (diagramJson.flows && diagramJson.groups) {
        const c2g: Record<string, string> = {};
        (diagramJson.groups as any[]).forEach((g: any) =>
          (g.components as any[]).forEach((c: any) => { c2g[c.id] = g.id; })
        );
        // Remove any within-group flows
        diagramJson.flows = (diagramJson.flows as any[]).filter((f: any) => {
          const fg = c2g[f.from], tg = c2g[f.to];
          return fg && tg && fg !== tg;
        });
        // Re-number sequentially 1, 2, 3...
        // Sort by existing step first to preserve intended order
        diagramJson.flows.sort((a: any, b: any) => (a.step || 999) - (b.step || 999));
        diagramJson.flows.forEach((f: any, i: number) => { f.step = i + 1; });
      }

      const userId = req.user.claims.sub;
      const [saved] = await db.insert(diagrams).values({
        title: diagramJson.title || "Untitled Diagram",
        prompt,
        diagramJson: JSON.stringify(diagramJson),
        userId,
      }).returning();

      res.json({ diagram: diagramJson, saved });
    } catch (error: any) {
      console.error("Error generating diagram:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to generate diagram" });
    }
  });

  app.get("/api/diagrams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await db.select().from(diagrams)
        .where(eq(diagrams.userId, userId))
        .orderBy(desc(diagrams.createdAt));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch diagrams" });
    }
  });

  app.get("/api/diagrams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const [diagram] = await db.select().from(diagrams)
        .where(and(eq(diagrams.id, id), eq(diagrams.userId, userId)));
      if (!diagram) return res.status(404).json({ error: "Not found" });
      res.json(diagram);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch diagram" });
    }
  });

  app.delete("/api/diagrams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await db.delete(diagrams).where(and(eq(diagrams.id, id), eq(diagrams.userId, userId)));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete diagram" });
    }
  });

  return httpServer;
}
