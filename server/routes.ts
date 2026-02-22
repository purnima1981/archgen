// ═══ ENHANCED ROUTES WITH CHAIN OF THOUGHT ═══

import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { diagrams } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { matchTemplate, TEMPLATES } from "./templates";
import { 
  REQUIREMENTS_PROMPT, 
  PRINCIPLES_PROMPT, 
  COMPONENTS_PROMPT, 
  ASSEMBLY_PROMPT, 
  DIAGRAM_PROMPT,
  type ChainOfThoughtStep,
  type ArchitectureReasoning 
} from "./chain-of-thought-generator";

// In-memory storage for chain-of-thought sessions (could be moved to database)
const reasoningSessions = new Map<string, ArchitectureReasoning>();

async function callClaude(prompt: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("No Anthropic API key configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "x-api-key": process.env.ANTHROPIC_API_KEY!, 
      "anthropic-version": "2023-06-01" 
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", 
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "API error");
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // GET templates list
  app.get("/api/templates", isAuthenticated, (_req, res) => {
    res.json(TEMPLATES.map(t => ({ id: t.id, name: t.name, icon: t.icon, description: t.description })));
  });

  // GET specific template by ID
  app.get("/api/templates/:id", isAuthenticated, (req, res) => {
    const t = TEMPLATES.find(t => t.id === req.params.id);
    t ? res.json(t.diagram) : res.status(404).json({ error: "Template not found" });
  });

  // POST generate — ORIGINAL simple generation (keyword match + LLM fallback)
  app.post("/api/diagrams/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      // Step 1: Try keyword matching (instant, free)
      const matched = matchTemplate(prompt);
      if (matched) {
        const diagram = JSON.parse(JSON.stringify(matched.diagram));
        const userId = req.user.claims.sub;
        const [saved] = await db.insert(diagrams).values({
          title: diagram.title, prompt, diagramJson: JSON.stringify(diagram), userId
        }).returning();
        return res.json({ diagram, saved, source: "template", templateId: matched.id });
      }

      // Step 2: LLM fallback (simple single-shot)
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(400).json({ error: "No matching template found. Add an API key for custom generation." });
      }

      const ICONS = `compute_engine,cloud_run,cloud_functions,app_engine,google_kubernetes_engine,cloud_storage,bigquery,cloud_sql,cloud_spanner,firestore,bigtable,memorystore,dataflow,dataproc,pubsub,data_catalog,dataplex,datastream,looker,vertexai,document_ai,cloud_vpn,cloud_armor,cloud_interconnect,virtual_private_cloud,identity_and_access_management,secret_manager,key_management_service,binary_authorization,identity_platform,cloud_build,artifact_registry,cloud_deploy,cloud_monitoring,cloud_logging,cloud_scheduler,apigee_api_platform,cloud_api_gateway,eventarc,workflows`;

      const systemPrompt = `You are a principal cloud architect. Generate architecture as JSON.
Icons: ${ICONS}. Use exact IDs or null for non-GCP.
Output: {"title":"","subtitle":"","nodes":[{"id":"","name":"","icon":"","subtitle":"","zone":"sources|cloud|consumers","x":0,"y":0,"details":{"project":"","region":"","serviceAccount":"","iamRoles":"","encryption":"","monitoring":"","retry":"","alerting":"","cost":"","troubleshoot":"","guardrails":"","compliance":"","notes":""}}],"edges":[{"id":"","from":"","to":"","label":"","subtitle":"","step":1,"security":{"transport":"","auth":"","classification":"","private":true},"crossesBoundary":false,"edgeType":"data|control|observe|alert"}],"threats":[{"id":"","target":"","stride":"","severity":"","title":"","description":"","impact":"","mitigation":"","compliance":""}],"phases":[{"id":"","name":"","nodeIds":[]}],"opsGroup":{"name":"","nodeIds":[]}}
Rules: sources x~100, cloud x=350-1050, consumers x~1250. Source edges step=0 (parallel). Internal steps start at 1. Include phases, opsGroup, alert destinations (PagerDuty/Slack in consumers zone). Output ONLY valid JSON.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 8000,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }]
        }),
      });

      if (!response.ok) { const e = await response.json(); throw new Error(e.error?.message || "API error"); }
      const data = await response.json();
      const dj = JSON.parse((data.content?.[0]?.text || "").replace(/```json\s*/g, "").replace(/```/g, "").trim());

      const userId = req.user.claims.sub;
      const [saved] = await db.insert(diagrams).values({ title: dj.title || "Untitled", prompt, diagramJson: JSON.stringify(dj), userId }).returning();
      res.json({ diagram: dj, saved, source: "llm" });
    } catch (error: any) {
      console.error("Diagram error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to generate diagram" });
    }
  });

  // POST NEW: Chain-of-thought architecture generation
  app.post("/api/diagrams/generate-cot", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      const userId = req.user.claims.sub;
      const sessionId = `${userId}-${Date.now()}`;

      // Initialize chain-of-thought session
      const reasoning: ArchitectureReasoning = {
        id: sessionId,
        prompt,
        userId,
        createdAt: new Date(),
        steps: [
          { step: 1, title: "Requirements Analysis", content: "", editable: true, completed: false },
          { step: 2, title: "Architecture Principles", content: "", editable: true, completed: false },
          { step: 3, title: "Component Design", content: "", editable: true, completed: false },
          { step: 4, title: "Architecture Assembly", content: "", editable: true, completed: false },
          { step: 5, title: "Final Diagram", content: "", editable: false, completed: false }
        ]
      };

      reasoningSessions.set(sessionId, reasoning);

      res.json({ 
        sessionId, 
        reasoning: {
          id: reasoning.id,
          prompt: reasoning.prompt,
          steps: reasoning.steps
        }
      });
    } catch (error: any) {
      console.error("CoT init error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to initialize reasoning" });
    }
  });

  // POST execute specific step in chain-of-thought
  app.post("/api/diagrams/cot-step/:sessionId/:step", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId, step } = req.params;
      const { customInput } = req.body; // Allow user to override/edit the input
      const userId = req.user.claims.sub;

      const reasoning = reasoningSessions.get(sessionId);
      if (!reasoning || reasoning.userId !== userId) {
        return res.status(404).json({ error: "Reasoning session not found" });
      }

      const stepNum = parseInt(step);
      const currentStep = reasoning.steps[stepNum - 1];
      if (!currentStep) {
        return res.status(400).json({ error: "Invalid step number" });
      }

      let prompt = "";
      let content = "";

      // Execute the appropriate reasoning step
      switch (stepNum) {
        case 1: // Requirements Analysis
          prompt = REQUIREMENTS_PROMPT.replace("{prompt}", customInput || reasoning.prompt);
          content = await callClaude(prompt);
          break;

        case 2: // Architecture Principles  
          const requirements = reasoning.steps[0].content;
          if (!requirements) {
            return res.status(400).json({ error: "Requirements analysis must be completed first" });
          }
          prompt = PRINCIPLES_PROMPT.replace("{requirements}", customInput || requirements);
          content = await callClaude(prompt);
          break;

        case 3: // Component Design
          const principles = reasoning.steps[1].content;
          if (!principles) {
            return res.status(400).json({ error: "Architecture principles must be completed first" });
          }
          prompt = COMPONENTS_PROMPT
            .replace("{requirements}", reasoning.steps[0].content)
            .replace("{principles}", customInput || principles);
          content = await callClaude(prompt);
          break;

        case 4: // Architecture Assembly
          const components = reasoning.steps[2].content;
          if (!components) {
            return res.status(400).json({ error: "Component design must be completed first" });
          }
          prompt = ASSEMBLY_PROMPT
            .replace("{requirements}", reasoning.steps[0].content)
            .replace("{principles}", reasoning.steps[1].content)
            .replace("{components}", customInput || components);
          content = await callClaude(prompt);
          break;

        case 5: // Final Diagram Generation
          const specification = reasoning.steps[3].content;
          if (!specification) {
            return res.status(400).json({ error: "Architecture assembly must be completed first" });
          }
          
          const ICONS = `compute_engine,cloud_run,cloud_functions,app_engine,google_kubernetes_engine,cloud_storage,bigquery,cloud_sql,cloud_spanner,firestore,bigtable,memorystore,dataflow,dataproc,pubsub,data_catalog,dataplex,datastream,looker,vertexai,document_ai,cloud_vpn,cloud_armor,cloud_interconnect,virtual_private_cloud,identity_and_access_management,secret_manager,key_management_service,binary_authorization,identity_platform,cloud_build,artifact_registry,cloud_deploy,cloud_monitoring,cloud_logging,cloud_scheduler,apigee_api_platform,cloud_api_gateway,eventarc,workflows`;
          
          const diagramPrompt = `${DIAGRAM_PROMPT.replace("{specification}", specification)}

Available GCP icons: ${ICONS}. Use exact IDs or null for external systems.

Output the complete diagram JSON following this exact schema:
{"title":"","subtitle":"","nodes":[{"id":"","name":"","icon":"","subtitle":"","zone":"sources|cloud|consumers","x":0,"y":0,"details":{"project":"","region":"","serviceAccount":"","iamRoles":"","encryption":"","monitoring":"","retry":"","alerting":"","cost":"","troubleshoot":"","guardrails":"","compliance":"","notes":""}}],"edges":[{"id":"","from":"","to":"","label":"","subtitle":"","step":1,"security":{"transport":"","auth":"","classification":"","private":true},"crossesBoundary":false,"edgeType":"data|control|observe|alert"}],"threats":[{"id":"","target":"","stride":"","severity":"","title":"","description":"","impact":"","mitigation":"","compliance":""}],"phases":[{"id":"","name":"","nodeIds":[]}],"opsGroup":{"name":"","nodeIds":[]}}

Rules: 
- Sources at x~100, cloud components x=280-1000, consumers x~1180
- Use diamond flow layout like the examples  
- Include comprehensive operational details for each component
- Number main data flow steps sequentially
- Include security controls, governance, and operations components
- Output ONLY valid JSON, no markdown formatting.`;

          content = await callClaude(diagramPrompt);
          
          try {
            // Parse the diagram JSON and save it
            const cleanContent = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();
            const diagram = JSON.parse(cleanContent);
            reasoning.finalDiagram = diagram;
            
            // Save to database
            const [saved] = await db.insert(diagrams).values({
              title: diagram.title || "Chain-of-Thought Architecture",
              prompt: reasoning.prompt,
              diagramJson: JSON.stringify(diagram),
              userId
            }).returning();
            
            content = JSON.stringify({ diagram, saved }, null, 2);
          } catch (parseError) {
            console.error("Failed to parse diagram JSON:", parseError);
            return res.status(500).json({ error: "Failed to generate valid diagram JSON" });
          }
          break;

        default:
          return res.status(400).json({ error: "Invalid step number" });
      }

      // Update the step
      currentStep.content = content;
      currentStep.completed = true;
      reasoningSessions.set(sessionId, reasoning);

      res.json({
        step: currentStep,
        reasoning: {
          id: reasoning.id,
          prompt: reasoning.prompt,
          steps: reasoning.steps,
          finalDiagram: reasoning.finalDiagram
        }
      });

    } catch (error: any) {
      console.error("CoT step error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to execute reasoning step" });
    }
  });

  // PUT edit a specific step in chain-of-thought
  app.put("/api/diagrams/cot-step/:sessionId/:step", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId, step } = req.params;
      const { content } = req.body;
      const userId = req.user.claims.sub;

      const reasoning = reasoningSessions.get(sessionId);
      if (!reasoning || reasoning.userId !== userId) {
        return res.status(404).json({ error: "Reasoning session not found" });
      }

      const stepNum = parseInt(step);
      const currentStep = reasoning.steps[stepNum - 1];
      if (!currentStep) {
        return res.status(400).json({ error: "Invalid step number" });
      }

      // Update the step content
      currentStep.content = content;
      currentStep.completed = true;
      
      // Mark subsequent steps as incomplete since they may need to be regenerated
      for (let i = stepNum; i < reasoning.steps.length; i++) {
        reasoning.steps[i].completed = false;
        if (i > stepNum - 1) reasoning.steps[i].content = "";
      }

      reasoningSessions.set(sessionId, reasoning);

      res.json({
        step: currentStep,
        reasoning: {
          id: reasoning.id,
          prompt: reasoning.prompt,
          steps: reasoning.steps
        }
      });

    } catch (error: any) {
      console.error("CoT edit error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to edit step" });
    }
  });

  // GET chain-of-thought session
  app.get("/api/diagrams/cot/:sessionId", isAuthenticated, (req: any, res) => {
    const { sessionId } = req.params;
    const userId = req.user.claims.sub;

    const reasoning = reasoningSessions.get(sessionId);
    if (!reasoning || reasoning.userId !== userId) {
      return res.status(404).json({ error: "Reasoning session not found" });
    }

    res.json({
      reasoning: {
        id: reasoning.id,
        prompt: reasoning.prompt,
        steps: reasoning.steps,
        finalDiagram: reasoning.finalDiagram
      }
    });
  });

  // CRUD for saved diagrams (unchanged)
  app.get("/api/diagrams", isAuthenticated, async (req: any, res) => {
    try { res.json(await db.select().from(diagrams).where(eq(diagrams.userId, req.user.claims.sub)).orderBy(desc(diagrams.createdAt))); } catch { res.status(500).json({ error: "Failed" }); }
  });
  app.get("/api/diagrams/:id", isAuthenticated, async (req: any, res) => {
    try { const [d] = await db.select().from(diagrams).where(and(eq(diagrams.id, parseInt(req.params.id)), eq(diagrams.userId, req.user.claims.sub))); d ? res.json(d) : res.status(404).json({ error: "Not found" }); } catch { res.status(500).json({ error: "Failed" }); }
  });
  app.delete("/api/diagrams/:id", isAuthenticated, async (req: any, res) => {
    try { await db.delete(diagrams).where(and(eq(diagrams.id, parseInt(req.params.id)), eq(diagrams.userId, req.user.claims.sub))); res.status(204).send(); } catch { res.status(500).json({ error: "Failed" }); }
  });

  // PUT edit diagram
  app.put("/api/diagrams/:id/edit", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { diagram } = req.body;
      const userId = req.user.claims.sub;

      if (!diagram) {
        return res.status(400).json({ error: "Diagram data is required" });
      }

      // Validate diagram structure
      if (!diagram.title || !diagram.nodes || !Array.isArray(diagram.nodes)) {
        return res.status(400).json({ error: "Invalid diagram structure" });
      }

      // Update the diagram in database
      const [updated] = await db.update(diagrams)
        .set({ 
          diagramJson: JSON.stringify(diagram),
          title: diagram.title || "Edited Architecture"
        })
        .where(and(eq(diagrams.id, parseInt(id)), eq(diagrams.userId, userId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Diagram not found or access denied" });
      }

      console.log(`✏️ Diagram ${id} edited by user ${userId}`);

      res.json({ 
        success: true, 
        diagram,
        saved: updated,
        message: "Diagram updated successfully"
      });

    } catch (error: any) {
      console.error("Edit diagram error:", error?.message || error);
      res.status(500).json({ error: "Failed to save diagram changes" });
    }
  });

  return httpServer;
}
