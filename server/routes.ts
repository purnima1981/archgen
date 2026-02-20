import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const SYSTEM_PROMPT = `You are an architecture diagram generator. Given a description, output ONLY valid JSON (no markdown, no backticks, no explanation).

{
  "title": "System Name",
  "groups": [
    {
      "id": "unique_id",
      "name": "Group Name",
      "category": "actors|channels|ingestion|processing|ai|storage|serving|output|security|monitoring",
      "components": [
        {"id": "comp_id", "name": "Service Name", "subtitle": "Brief desc"}
      ]
    }
  ],
  "flows": [
    {"from": "comp_id", "to": "comp_id", "label": "Description", "step": 1}
  ]
}

Rules:
- 3-8 logical groups matching the architecture
- 1-6 components per group
- Categories: actors, channels, ingestion, processing, ai, storage, serving, output, security, monitoring
- Flows trace main data path with numbered steps (1-12 max)
- Short component IDs like "bq", "vertex", "api_gw"
- Short names (2-3 words max)
- Groups in logical order: actors → channels → ingestion → processing → ai → storage → serving → output
- ONLY output JSON`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Generate diagram via Claude
  app.post("/api/diagrams/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(400).json({ error: "Anthropic API key not configured." });
      }

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

      // Save to database
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

  // List user's diagrams
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

  // Get single diagram
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

  // Delete diagram
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
