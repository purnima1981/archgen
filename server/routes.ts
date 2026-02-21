import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const AVAILABLE_ICONS = `compute_engine, cloud_run, cloud_functions, app_engine, google_kubernetes_engine, cloud_gpu, cloud_tpu, batch, cloud_storage, bigquery, cloud_sql, cloud_spanner, firestore, bigtable, datastore, memorystore, filestore, persistent_disk, dataflow, dataproc, pubsub, data_catalog, dataprep, dataplex, datastream, analytics_hub, data_studio, looker, vertexai, ai_platform, automl, cloud_natural_language_api, cloud_vision_api, cloud_translation_api, speech-to-text, text-to-speech, dialogflow, document_ai, recommendations_ai, tensorflow_enterprise, cloud_load_balancing, cloud_cdn, cloud_dns, cloud_vpn, cloud_nat, cloud_armor, cloud_interconnect, virtual_private_cloud, traffic_director, identity_and_access_management, security_command_center, secret_manager, key_management_service, binary_authorization, identity_platform, cloud_audit_logs, cloud_build, artifact_registry, cloud_deploy, cloud_monitoring, cloud_logging, error_reporting, trace, cloud_scheduler, cloud_tasks, apigee_api_platform, cloud_api_gateway, cloud_endpoints, eventarc, workflows, connectors`;

const SYSTEM_PROMPT = `You are a senior solutions architect who creates architecture diagrams. Given a system description, output ONLY valid JSON — no markdown, no backticks, no explanation.

OUTPUT FORMAT:
{
  "title": "Concise System Title",
  "groups": [
    {
      "id": "grp_id",
      "name": "Group Name",
      "category": "actors|channels|ingestion|processing|ai|storage|serving|output|security|monitoring",
      "components": [
        {"id": "comp_id", "name": "Service Name", "icon": "icon_id", "subtitle": "Protocol or tech detail"}
      ]
    }
  ],
  "flows": [
    {"from": "comp_id", "to": "comp_id", "label": "What moves", "step": 1}
  ]
}

AVAILABLE ICONS (use these exact IDs in the "icon" field):
${AVAILABLE_ICONS}

If a component has no matching icon (e.g. a custom service, user persona, or non-GCP service), omit the "icon" field or set it to null.

LAYOUT RULES:
1. Create 4-7 groups, each with 2-4 components. Never 1 component alone. If a group would have 1, merge it.
2. Order groups by data flow: sources → entry points → processing → intelligence → storage → delivery → output.
3. Component names: 1-3 words, max 16 chars. Use real service names (e.g., "BigQuery" not "Data Warehouse").
4. Subtitles: short tech detail — protocol, format, or role. Max 18 chars. (e.g., "REST API", "Vector DB", "gRPC")
5. Component IDs: lowercase, 2-6 chars (e.g., "bq", "s3", "api_gw").

FLOW RULES:
1. 5-10 flows tracing the PRIMARY data path. Numbered steps forming a clear chain.
2. Flow labels describe WHAT moves (nouns): "Patient Records", "Embeddings", "Events". Not actions.
3. No circular flows. Path goes one direction, source to sink.

CATEGORIES:
- actors: Users, personas, external systems
- channels: User-facing interfaces (dashboards, apps, bots)
- ingestion: Data entry points (API gateways, streams, queues)
- processing: Compute/transform (functions, ETL, pipelines)
- ai: ML/AI services (training, inference, embeddings, feature stores)
- storage: Databases and stores (SQL, NoSQL, vector, cache, lake)
- serving: APIs and delivery (endpoints, CDN, load balancers)
- output: Dashboards, reports, notifications
- security: Auth, encryption, compliance
- monitoring: Observability, logging, alerting

---

EXAMPLE 1 — RAG Chatbot:

Input: "RAG chatbot using Confluence docs, Vertex AI embeddings, Cloud SQL pgvector, and Vertex AI served through a React app on Cloud Run"

Output:
{
  "title": "RAG Chatbot Platform",
  "groups": [
    {
      "id": "sources",
      "name": "Data Sources",
      "category": "actors",
      "components": [
        {"id": "conf", "name": "Confluence", "subtitle": "Wiki Pages"},
        {"id": "gdrive", "name": "Google Drive", "subtitle": "PDF/Docs"},
        {"id": "gcs", "name": "Cloud Storage", "icon": "cloud_storage", "subtitle": "Raw Files"}
      ]
    },
    {
      "id": "ingest",
      "name": "Ingestion Pipeline",
      "category": "ingestion",
      "components": [
        {"id": "func", "name": "Cloud Functions", "icon": "cloud_functions", "subtitle": "Doc Processor"},
        {"id": "ps", "name": "Pub/Sub", "icon": "pubsub", "subtitle": "Event Queue"},
        {"id": "embed", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Embeddings API"}
      ]
    },
    {
      "id": "store",
      "name": "Knowledge Store",
      "category": "storage",
      "components": [
        {"id": "pgvec", "name": "Cloud SQL", "icon": "cloud_sql", "subtitle": "pgvector"},
        {"id": "redis", "name": "Memorystore", "icon": "memorystore", "subtitle": "Session Cache"},
        {"id": "fstore", "name": "Firestore", "icon": "firestore", "subtitle": "Chat History"}
      ]
    },
    {
      "id": "ai_layer",
      "name": "AI Orchestration",
      "category": "ai",
      "components": [
        {"id": "rag", "name": "Cloud Run", "icon": "cloud_run", "subtitle": "RAG Engine"},
        {"id": "gen", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Gemini Pro"},
        {"id": "rank", "name": "Cloud Functions", "icon": "cloud_functions", "subtitle": "Reranker"}
      ]
    },
    {
      "id": "frontend",
      "name": "User Interface",
      "category": "channels",
      "components": [
        {"id": "web", "name": "Cloud Run", "icon": "cloud_run", "subtitle": "React App"},
        {"id": "lb", "name": "Load Balancer", "icon": "cloud_load_balancing", "subtitle": "HTTPS"},
        {"id": "cdn", "name": "Cloud CDN", "icon": "cloud_cdn", "subtitle": "Static Assets"}
      ]
    }
  ],
  "flows": [
    {"from": "conf", "to": "func", "label": "Raw Documents", "step": 1},
    {"from": "func", "to": "ps", "label": "Parsed Text", "step": 2},
    {"from": "ps", "to": "embed", "label": "Text Chunks", "step": 3},
    {"from": "embed", "to": "pgvec", "label": "Embeddings", "step": 4},
    {"from": "web", "to": "rag", "label": "User Query", "step": 5},
    {"from": "rag", "to": "pgvec", "label": "Vector Search", "step": 6},
    {"from": "rag", "to": "gen", "label": "Context + Query", "step": 7},
    {"from": "gen", "to": "web", "label": "Response", "step": 8}
  ]
}

---

EXAMPLE 2 — Healthcare AI:

Input: "Healthcare system with Epic EHR data, BigQuery, Vertex AI, served to clinician dashboard"

Output:
{
  "title": "Clinical AI Prediction Pipeline",
  "groups": [
    {
      "id": "data_src",
      "name": "Data Sources",
      "category": "ingestion",
      "components": [
        {"id": "ehr", "name": "Epic EHR", "subtitle": "FHIR R4"},
        {"id": "labs", "name": "Lab Systems", "subtitle": "HL7 v2"},
        {"id": "ps", "name": "Pub/Sub", "icon": "pubsub", "subtitle": "Event Stream"}
      ]
    },
    {
      "id": "data_plat",
      "name": "Data Platform",
      "category": "storage",
      "components": [
        {"id": "bq", "name": "BigQuery", "icon": "bigquery", "subtitle": "Data Lake"},
        {"id": "feat", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Feature Store"},
        {"id": "gcs", "name": "Cloud Storage", "icon": "cloud_storage", "subtitle": "Raw Data"}
      ]
    },
    {
      "id": "ml",
      "name": "AI/ML Layer",
      "category": "ai",
      "components": [
        {"id": "train", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Training"},
        {"id": "serve", "name": "Vertex AI", "icon": "vertexai", "subtitle": "Endpoints"},
        {"id": "aml", "name": "AutoML", "icon": "automl", "subtitle": "Tabular Models"}
      ]
    },
    {
      "id": "app",
      "name": "Application Layer",
      "category": "serving",
      "components": [
        {"id": "run", "name": "Cloud Run", "icon": "cloud_run", "subtitle": "REST API"},
        {"id": "apigee", "name": "Apigee", "icon": "apigee_api_platform", "subtitle": "API Gateway"},
        {"id": "iap", "name": "Identity Platform", "icon": "identity_platform", "subtitle": "OAuth 2.0"}
      ]
    },
    {
      "id": "iface",
      "name": "Clinical Interfaces",
      "category": "channels",
      "components": [
        {"id": "dash", "name": "Looker", "icon": "looker", "subtitle": "Web Dashboard"},
        {"id": "mobile", "name": "App Engine", "icon": "app_engine", "subtitle": "Mobile API"},
        {"id": "lb", "name": "Load Balancer", "icon": "cloud_load_balancing", "subtitle": "Global LB"}
      ]
    },
    {
      "id": "ops",
      "name": "Operations",
      "category": "monitoring",
      "components": [
        {"id": "mon", "name": "Monitoring", "icon": "cloud_monitoring", "subtitle": "Metrics"},
        {"id": "log", "name": "Logging", "icon": "cloud_logging", "subtitle": "Audit Trail"},
        {"id": "iam", "name": "Cloud IAM", "icon": "identity_and_access_management", "subtitle": "RBAC"}
      ]
    }
  ],
  "flows": [
    {"from": "ehr", "to": "ps", "label": "Patient Events", "step": 1},
    {"from": "ps", "to": "bq", "label": "Structured Records", "step": 2},
    {"from": "bq", "to": "feat", "label": "Feature Vectors", "step": 3},
    {"from": "feat", "to": "train", "label": "Training Data", "step": 4},
    {"from": "train", "to": "serve", "label": "Trained Model", "step": 5},
    {"from": "serve", "to": "run", "label": "Predictions", "step": 6},
    {"from": "run", "to": "apigee", "label": "API Response", "step": 7},
    {"from": "apigee", "to": "dash", "label": "Risk Scores", "step": 8}
  ]
}

---

Now generate a diagram for the user's description. Follow the exact same structure. Always include the "icon" field with an exact icon ID from the available list when the component is a GCP service. ONLY output the JSON object.`;

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
      console.error("Error fetching diagrams:", error);
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
      console.error("Error fetching diagram:", error);
      res.status(500).json({ error: "Failed to fetch diagram" });
    }
  });

  app.delete("/api/diagrams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const [diagram] = await db.select().from(diagrams)
        .where(and(eq(diagrams.id, id), eq(diagrams.userId, userId)));
      if (!diagram) return res.status(404).json({ error: "Not found" });
      await db.delete(diagrams).where(eq(diagrams.id, id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting diagram:", error);
      res.status(500).json({ error: "Failed to delete diagram" });
    }
  });

  return httpServer;
}
