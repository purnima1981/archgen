# ArchGen — AI Architecture Diagram Generator

## The Problem

Enterprise architects spend hours manually drawing architecture diagrams in Visio, Lucidchart, or Draw.io. The results are static images that can't generate infrastructure code, don't enforce architectural consistency, and go stale the moment they're exported.

Expensive EA tools like LeanIX ($40K+/yr) solve governance but not rapid diagram creation. Diagram-as-code tools (Mermaid, Structurizr) require hand-coding every node and edge.

## What ArchGen Does

Describe your system in plain English. Get back a production-quality, interactive architecture diagram — with real cloud service icons, data flow arrows, protocol labels, and layered layout — in seconds.

Then export it as editable PowerPoint or architecture-as-code (Mermaid, Structurizr DSL).

```
"Build a real-time streaming analytics platform on GCP with
 Pub/Sub ingestion, Dataflow processing, BigQuery warehouse,
 Looker dashboards, and Cloud Composer orchestration"
```

**→ Interactive SVG diagram with 12 architecture layers, proper GCP icons, numbered data flow, and export options.**

---

## How It Works — The Intelligence Pipeline

ArchGen isn't just "ask an LLM to draw boxes." It uses a Chain-of-Thought (COT) generation pipeline backed by an organization-aware knowledge base. This is what makes the output architecturally sound, not just visually pretty.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE BASE (Org-Specific)                    │
│                                                                     │
│  Well-Architected Principles  ·  Approved Tools & Services          │
│  Org Templates & Standards    ·  Reference Architectures            │
│  Industry Compliance Reqs     ·  Past Diagram Library               │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌──────────────┐    ┌──────────────────────────┐    ┌────────────────┐
│  User Prompt │───▶│   Search & Classify      │───▶│  COT Generator │
│              │    │                          │    │                │
│ "Give us an  │    │  Identify sources/targets│    │  Applies org   │
│  architecture│    │  Match patterns from KB  │    │  principles +  │
│  to process  │    │  Detect industry context │    │  templates to  │
│  data from   │    │  Check diagram KB        │    │  build steps   │
│  SQL Server" │    │                          │    │  1 and 2       │
└──────────────┘    └──────────┬───────────────┘    └───────┬────────┘
                               │                            │
                          ┌────▼────┐                       ▼
                          │ < 10%   │              ┌────────────────┐
                          │ confid? │──── Yes ────▶│  Fallback LLM  │
                          └────┬────┘              │  (raw generate)│
                               │ No                └───────┬────────┘
                               ▼                           │
                    ┌─────────────────────┐                │
                    │  Generate           │◀───────────────┘
                    │  Architecture       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Human-in-the-Loop  │
                    │  Architect Review   │
                    │  (approve / refine) │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
   ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
   │ Architecture │  │  RFD/ARB Decks  │  │  Automated Docs  │
   │   Diagrams   │  │  (Editable PPTX)│  │  & Centralized   │
   │              │  │                 │  │  Metadata         │
   └──────────────┘  └─────────────────┘  └──────────────────┘
```

### Why This Matters

The KB-first approach means ArchGen generates architectures that are **consistent with your organization's standards** — not generic cloud diagrams. The COT generator doesn't just pick services; it reasons through steps using your approved toolchain, compliance requirements, and proven patterns.

When confidence is high (pattern match + known sources), generation is fast and deterministic. When the prompt is novel or ambiguous, the system falls back to the full LLM with all available context, and the architect reviews before anything ships.

### Product Value

1. **50% reduction in solution design time** — architects describe, ArchGen generates
2. **Automated documentation** — reduces friction between architecture, engineering, and ops teams
3. **Consistent templates and flows** — eliminates back-and-forth on standards and design patterns
4. **Healthy team relationships** — shared visual language, less "that's not what I meant" across teams

---

## Features

### AI-Powered Generation
Natural language prompt → org-aware Chain-of-Thought reasoning → structured architecture JSON. The engine doesn't just call an LLM — it searches your organization's knowledge base (approved tools, Well-Architected principles, compliance requirements, past diagrams) before generating. It tells the story of how data moves through your system, using services your org actually uses.

### Interactive Diagram Canvas
Custom SVG rendering engine with pan, zoom, drag-to-reposition, hover highlighting (connected edges glow, unrelated nodes fade), inline rename, and node deletion. No React Flow dependency — purpose-built for architecture diagrams.

### 12-Layer Architecture Model
Every generated diagram is evaluated against a comprehensive layer model — from Client/Presentation through Connectivity, Identity, API Gateway, Ingestion, Processing, Orchestration, Storage, Analytics, Monitoring, Governance, and Output/Delivery. Not every layer appears in every diagram, but the engine considers all of them.

### Multi-Cloud Support
Toggle between **AWS**, **GCP**, and **Azure** — all service names, icons, and infrastructure details swap automatically. Same logical architecture, cloud-native services.

| Concern | AWS | GCP | Azure |
|:---|:---|:---|:---|
| Compute | ECS Fargate, Lambda | Cloud Run, Functions | Container Apps, Functions |
| Event Bus | MSK, EventBridge | Pub/Sub, Dataflow | Event Hubs, Service Bus |
| Database | Aurora, DynamoDB | Cloud SQL, Firestore | SQL Database, Cosmos DB |
| Orchestration | Step Functions | Workflows, Composer | Logic Apps, Durable Functions |
| Monitoring | CloudWatch, X-Ray | Cloud Monitoring, Trace | Monitor, App Insights |

### Export Formats
- **Editable PPTX** — PowerPoint with real shapes and editable text, not embedded screenshots
- **Architecture as Code** — export as Mermaid (`.mmd` with proper subgraph nesting), Structurizr DSL (C4 model), or Python Diagrams (mingrammer)

### Smart Icon System
60+ SVG icons covering GCP services, AWS services, vendor tools (dbt, Fivetran, Snowflake, Kafka), personas (analyst, developer, admin), and external systems (SFTP, mainframe, webhooks). Icon resolution is keyword-aware — "Kafka" maps to the Kafka icon, "PostgreSQL" maps to the database cylinder, with layer-based fallbacks.

### Knowledge Base & Semantic Routing
Architecture patterns and GCP product metadata stored in PostgreSQL with pgvector embeddings. Prompts are classified via Claude Haiku into matching patterns, source products, and industry context — with keyword fallback when embeddings aren't available.

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   React SPA  │────▶│  Express + TS    │────▶│  Python Engine    │
│  SVG Canvas  │     │  API Server      │     │  generate.py      │
│  Tailwind    │     │  Drizzle ORM     │     │  kb_query.py      │
│  DM Sans     │     │  Session Auth    │     │  gcp_blueprint.py │
└──────────────┘     └──────┬───────────┘     └──────┬────────────┘
                            │                        │
                     ┌──────▼───────────┐     ┌──────▼────────────┐
                     │  PostgreSQL 16   │     │  Claude API       │
                     │  pgvector        │     │  (Sonnet + Haiku) │
                     │  Session Store   │     │  Voyage AI embeds │
                     └──────────────────┘     └───────────────────┘
```

### Stack

| Layer | Technology |
|:---|:---|
| **Frontend** | React 18 + Vite, custom SVG canvas, Tailwind CSS, DM Sans / JetBrains Mono |
| **Server** | Express + TypeScript, Drizzle ORM, express-session + connect-pg-simple |
| **Engine** | Python 3.11 — prompt routing, blueprint generation, auto-wiring |
| **Database** | PostgreSQL 16 with pgvector for semantic search |
| **AI** | Claude Sonnet (diagram generation), Claude Haiku (prompt classification), Voyage AI (embeddings) |
| **Auth** | Email/password with server-side sessions |
| **Build** | esbuild (server), Vite (client) |
| **Hosting** | Railway (recommended) or any Node.js + PostgreSQL host |

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16+
- Python 3.11+ (for engine)

### Local Development

```bash
# Clone
git clone https://github.com/purnima1981/ArchGen.git
cd ArchGen

# Install dependencies
npm install

# Python engine dependencies (optional, for KB + semantic routing)
pip install psycopg2-binary

# Environment
cp .env.example .env
# Edit .env — add DATABASE_URL, SESSION_SECRET, ANTHROPIC_API_KEY

# Push database schema
npm run db:push

# (Optional) Seed knowledge base
python server/engine/kb_seed.py

# Start dev server
npm run dev
```

App runs at **http://localhost:5000**.

### Environment Variables

| Variable | Required | Description |
|:---|:---|:---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random string for session encryption |
| `ANTHROPIC_API_KEY` | No | Enables AI diagram generation |
| `VOYAGE_API_KEY` | No | Enables semantic embedding search |

---

## Deployment

### Railway (Recommended)

1. Create a project on [railway.app](https://railway.app)
2. Add a **PostgreSQL** database service
3. Connect your GitHub repo — Railway auto-detects Node.js
4. Set environment variables:
   - `DATABASE_URL` — auto-linked from PostgreSQL service
   - `SESSION_SECRET` — generate with `openssl rand -hex 32`
   - `ANTHROPIC_API_KEY` — your Anthropic key
5. Build command: `npm run build && npx drizzle-kit push`

Railway handles the rest — builds, deploys, and serves on a public URL.

---

## Project Structure

```
ArchGen/
├── client/
│   ├── public/
│   │   └── icons/           # SVG icon library (GCP, AWS, vendor)
│   │       └── registry.json # Icon metadata + aliases
│   ├── src/
│   │   └── main.tsx         # React entry point
│   └── index.html
├── server/
│   ├── engine/
│   │   ├── generate.py      # CLI entry — prompt → diagram JSON
│   │   ├── gcp_blueprint.py # GCP product catalog, wiring rules, layout
│   │   ├── kb_seed.py       # Seed pgvector knowledge base
│   │   └── kb_query.py      # Semantic search + Haiku classifier
│   ├── templates.ts         # Reference architecture templates
│   └── ...                  # Express routes, auth, Drizzle schema
├── .env.example
├── package.json
└── README.md
```

---

## Reference Architecture Patterns

ArchGen ships with curated, production-tested patterns:

| Pattern | Description |
|:---|:---|
| **B2B Data Distribution** | Multi-source ingestion → warehouse → governed distribution to partners |
| **Real-time Streaming Analytics** | Pub/Sub → Dataflow → BigQuery → Looker with SLO monitoring |
| **E-commerce Platform** | CDN → API Gateway → microservices → CQRS event store |
| **ML Training & Serving** | Feature store → training pipeline → model registry → A/B serving |
| **Multi-tenant SaaS** | Tenant isolation, shared compute, per-tenant storage partitioning |
| **Event-Driven Microservices** | Choreography/orchestration patterns with saga compensation |
| **Data Mesh** | Domain-oriented data products with federated governance |
| **Healthcare Integration** | FHIR/HL7 interop with HIPAA-compliant data handling |

Each pattern includes service mappings per cloud, wiring rules, and compliance annotations.

---

## Diagram Quality Standards

ArchGen diagrams follow **C4 Model Level 2** (Container Diagram) conventions:

- Every service node shows **label**, **technology**, and **infrastructure detail**
- External systems use **dashed borders**
- Connection lines carry **protocol labels** (HTTPS, gRPC, AMQP, JDBC)
- Solid arrows = synchronous flow · Dashed arrows = async/event-driven · Dotted = storage access
- Color-coded **layer bands** with labeled headers
- Proper SVG icons for every node — never emoji or Unicode symbols
- Auto-generated legend explaining line types and color coding

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/api/auth/register` | Sign up (email, password, firstName, lastName) |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/user` | Current user (requires session) |
| POST | `/api/logout` | Sign out |

### Diagrams
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/api/generate` | Prompt → diagram JSON |
| GET | `/api/templates` | List reference architecture patterns |
| POST | `/api/export/mermaid` | Export diagram as Mermaid code |
| POST | `/api/export/structurizr` | Export diagram as Structurizr DSL |
| POST | `/api/export/pptx` | Export diagram as editable PowerPoint |

---

## Roadmap

- [x] GCP blueprint engine with 60+ product nodes
- [x] Interactive SVG canvas with drag/edit
- [x] Multi-cloud service mapping (GCP, AWS, Azure)
- [x] pgvector semantic search for prompt routing
- [x] Claude Haiku prompt classification
- [x] Reference architecture template library
- [ ] Architecture as code export (Mermaid, Structurizr DSL, Python Diagrams)
- [ ] Editable PPTX export with shapes
- [ ] STRIDE threat model generation
- [ ] Team collaboration + shared diagram workspaces
- [ ] Version history + diff view
- [ ] Cost estimation per architecture
- [ ] Custom icon upload
- [ ] API access for CI/CD integration

---

## Contributing

ArchGen is in active development. If you're an enterprise architect, solutions architect, or platform engineer and want to contribute reference patterns, cloud service mappings, or Terraform modules — open an issue or PR.

---

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/purnima1981">@purnima1981</a><br/>
  <em>Because architecture diagrams should tell data flow stories, not just show boxes.</em>
</p>
