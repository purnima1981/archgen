import { Express, Request, Response } from "express";
import { isAuthenticated } from "./auth";
import { matchTemplate, TEMPLATES } from "./templates";
import { storage } from "./storage";

export function registerRoutes(app: Express) {
  // ── Template endpoints ──
  app.get("/api/templates", isAuthenticated, (_req: Request, res: Response) => {
    res.json(TEMPLATES.map(t => ({ id: t.id, name: t.name, icon: t.icon, description: t.description })));
  });

  app.get("/api/templates/:id", isAuthenticated, (req: Request, res: Response) => {
    const t = TEMPLATES.find(x => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: "Template not found" });
    res.json(t);
  });

  // ── Generate: template match FIRST ($0), LLM fallback ──
  app.post("/api/diagrams/generate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      // 1. Try keyword match (instant, free)
      const match = matchTemplate(prompt);
      if (match) {
        return res.json({ diagram: match.diagram, source: "template", templateId: match.id });
      }

      // 2. LLM fallback
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "No API key configured. Try a template instead." });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: `You are a GCP architecture generator. Return ONLY valid JSON matching this schema:
{
  "title": "string",
  "subtitle": "string",
  "nodes": [{ "id": "string", "name": "string", "icon": "gcp_icon_id|null", "subtitle": "string", "zone": "sources|cloud|consumers", "x": number, "y": number, "details": { "monitoring": "string", "alerting": "string", "cost": "string", "retry": "string", "guardrails": "string", "compliance": "string" } }],
  "edges": [{ "id": "string", "from": "node_id", "to": "node_id", "label": "string", "subtitle": "string", "step": number, "security": { "transport": "string", "auth": "string", "classification": "string", "private": boolean }, "crossesBoundary": boolean, "edgeType": "data|control|observe|alert" }],
  "threats": [{ "id": "string", "target": "node_or_edge_id", "stride": "S|T|R|I|D|E", "severity": "critical|high|medium|low", "title": "string", "description": "string", "impact": "string", "mitigation": "string" }],
  "phases": [{ "id": "string", "name": "string", "nodeIds": ["string"] }],
  "opsGroup": { "name": "string", "nodeIds": ["string"] }
}
Source edges (step=0) are parallel entry points. Internal flow steps start at 1. Include phases, opsGroup, and alert destination nodes (PagerDuty, Slack etc in consumers zone). Use GCP icon IDs like: pubsub, dataflow, bigquery, cloud_storage, cloud_run, cloud_functions, apigee_api_platform, cloud_sql, vertexai, cloud_monitoring, cloud_logging, cloud_scheduler, looker, datastream, memorystore, identity_platform, cloud_vpn, cloud_interconnect, document_ai, data_catalog, cloud_natural_language_api.`,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Anthropic API error:", err);
        return res.status(502).json({ error: "AI generation failed. Try a template." });
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(502).json({ error: "Invalid AI response. Try a template." });

      const diagram = JSON.parse(jsonMatch[0]);
      res.json({ diagram, source: "llm" });
    } catch (err: any) {
      console.error("Generate error:", err);
      res.status(500).json({ error: err.message || "Generation failed" });
    }
  });

  // ── CRUD for saved diagrams ──
  app.get("/api/diagrams", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.json([]);
      const diagrams = await storage.getDiagramsByUser(userId);
      res.json(diagrams);
    } catch { res.json([]); }
  });

  app.get("/api/diagrams/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const diagram = await storage.getDiagram(parseInt(req.params.id));
      if (!diagram) return res.status(404).json({ error: "Not found" });
      res.json(diagram);
    } catch { res.status(500).json({ error: "Failed to fetch" }); }
  });

  app.delete("/api/diagrams/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteDiagram(parseInt(req.params.id));
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Failed to delete" }); }
  });
}
