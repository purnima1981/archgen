import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { matchTemplate, TEMPLATES } from "./templates";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // GET templates list (for frontend template gallery)
  app.get("/api/templates", isAuthenticated, (_req, res) => {
    res.json(TEMPLATES.map(t => ({ id: t.id, name: t.name, icon: t.icon, description: t.description })));
  });

  // GET specific template by ID
  app.get("/api/templates/:id", isAuthenticated, (req, res) => {
    const t = TEMPLATES.find(t => t.id === req.params.id);
    t ? res.json(t.diagram) : res.status(404).json({ error: "Template not found" });
  });

  // POST generate — keyword match first, LLM fallback
  app.post("/api/diagrams/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      // Step 1: Try keyword matching (instant, free)
      const matched = matchTemplate(prompt);
      if (matched) {
        const diagram = JSON.parse(JSON.stringify(matched.diagram)); // deep clone
        const userId = req.user.claims.sub;
        const [saved] = await db.insert(diagrams).values({
          title: diagram.title, prompt, diagramJson: JSON.stringify(diagram), userId
        }).returning();
        return res.json({ diagram, saved, source: "template", templateId: matched.id });
      }

      // Step 2: LLM fallback (for truly custom requests)
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(400).json({ error: "No matching template found. Add an API key for custom generation." });
      }

      const ICONS = `compute_engine,cloud_run,cloud_functions,app_engine,google_kubernetes_engine,cloud_storage,bigquery,cloud_sql,cloud_spanner,firestore,bigtable,memorystore,dataflow,dataproc,pubsub,data_catalog,dataplex,datastream,looker,vertexai,document_ai,cloud_vpn,cloud_armor,cloud_interconnect,virtual_private_cloud,identity_and_access_management,secret_manager,key_management_service,binary_authorization,identity_platform,cloud_build,artifact_registry,cloud_deploy,cloud_monitoring,cloud_logging,cloud_scheduler,apigee_api_platform,cloud_api_gateway,eventarc,workflows`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 8000,
          system: `You are a principal cloud architect. Generate architecture as JSON.
Icons: ${ICONS}. Use exact IDs or null for non-GCP.
Output: {"title":"","subtitle":"","nodes":[{"id":"","name":"","icon":"","subtitle":"","zone":"sources|cloud|consumers","x":0,"y":0,"details":{"project":"","region":"","serviceAccount":"","iamRoles":"","encryption":"","monitoring":"","retry":"","alerting":"","cost":"","troubleshoot":"","guardrails":"","compliance":"","notes":""}}],"edges":[{"id":"","from":"","to":"","label":"","subtitle":"","step":1,"security":{"transport":"","auth":"","classification":"","private":true},"crossesBoundary":false}],"threats":[{"id":"","target":"","stride":"","severity":"","title":"","description":"","impact":"","mitigation":"","compliance":""}]}
Rules: sources x~80, cloud x=300-1050, consumers x~1230. Rows y~140 apart. Ops row y~530. crossesBoundary=true at source↔cloud or cloud↔consumer. Include ops row (orchestrator, monitoring, logging). Output ONLY valid JSON.`,
          messages: [{ role: "user", content: prompt }]
        }),
      });

      if (!response.ok) { const e = await response.json(); throw new Error(e.error?.message || "API error"); }
      const data = await response.json();
      const dj = JSON.parse((data.content?.[0]?.text || "").replace(/```json\s*/g, "").replace(/```/g, "").trim());
      if (dj.edges) { dj.edges.sort((a: any, b: any) => (a.step ?? 999) - (b.step ?? 999)); dj.edges.forEach((e: any, i: number) => { e.step = i + 1; }); }

      const userId = req.user.claims.sub;
      const [saved] = await db.insert(diagrams).values({ title: dj.title || "Untitled", prompt, diagramJson: JSON.stringify(dj), userId }).returning();
      res.json({ diagram: dj, saved, source: "llm" });
    } catch (error: any) {
      console.error("Diagram error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to generate diagram" });
    }
  });

  // CRUD
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
