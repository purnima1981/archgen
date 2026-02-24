// ═══ TEMPLATE: SOURCES LAYER (LAYER 1) — TECHNICAL BLUEPRINT ═══

export interface NodeDetails { project?: string; region?: string; serviceAccount?: string; iamRoles?: string; encryption?: string; monitoring?: string; retry?: string; alerting?: string; cost?: string; troubleshoot?: string; guardrails?: string; compliance?: string; notes?: string }
export interface DiagNode { id: string; name: string; icon?: string | null; subtitle?: string; zone: "sources" | "cloud" | "consumers" | "connectivity"; x: number; y: number; details?: NodeDetails }
export interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean }
export interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean; edgeType?: "data" | "control" | "observe" | "alert" }
export interface Threat { id: string; target: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance?: string | null }
export interface Phase { id: string; name: string; nodeIds: string[] }
export interface OpsGroup { name: string; nodeIds: string[] }
export interface Diagram { title: string; subtitle?: string; layout?: string; nodes: DiagNode[]; edges: DiagEdge[]; threats?: Threat[]; phases?: Phase[]; opsGroup?: OpsGroup }
export interface Template { id: string; name: string; icon: string; description: string; tags: string[]; diagram: Diagram }

export function matchTemplate(input: string): Template | null {
  const q = input.toLowerCase();
  let best: Template | null = null, bestScore = 0, bestHits = 0;
  for (const t of TEMPLATES) {
    let score = 0, hits = 0;
    for (const tag of t.tags) { if (q.includes(tag)) { score += tag.length; hits++; } }
    if (score > bestScore) { bestScore = score; best = t; bestHits = hits; }
  }
  return (bestScore >= 12 && bestHits >= 3) ? best : null;
}

// ═══ SOURCES LAYER ═══════════════════════════════════
const SOURCES_LAYER: Diagram = {
  title: "Layer 1: Sources",
  subtitle: "8 Source Categories · External systems feeding data into the platform",
  layout: "blueprint",

  phases: [
    { id: "sources", name: "Layer 1: Sources", nodeIds: ["src_rdb", "src_nosql", "src_saas", "src_files", "src_apis", "src_stream", "src_unstructured", "src_legacy"] },
  ],
  opsGroup: { name: "Next Layer", nodeIds: ["boundary_conn"] },

  nodes: [
    // ── 8 SOURCE CATEGORIES ──
    { id: "src_rdb", name: "Relational DB", icon: null, subtitle: "Oracle · PG · MySQL · SQL Server · Cloud SQL · Spanner", zone: "sources", x: 100, y: 200, details: {
      notes: "On-prem and cloud-hosted RDBMS systems.\n\n• Batch Pull: JDBC extract → scheduled full/incremental loads\n• CDC: LogMiner (Oracle), CT (SQL Server), WAL (PostgreSQL)\n• Federated: BigQuery federated queries for Cloud SQL / Spanner",
      encryption: "TLS in transit | TDE or CMEK at rest",
      guardrails: "Service account per source, credentials in Secret Manager, VPN or Private IP for on-prem",
      compliance: "SOC2, HIPAA (if PHI present)"
    }},
    { id: "src_nosql", name: "NoSQL", icon: null, subtitle: "MongoDB · DynamoDB · Cassandra · Firestore", zone: "sources", x: 250, y: 200, details: {
      notes: "Document, key-value, and wide-column stores.\n\n• CDC: MongoDB Change Streams, DynamoDB Streams\n• Bulk Export: mongodump → GCS, DynamoDB export to S3 then transfer\n• API Pull: REST/SDK-based extraction for smaller datasets",
      encryption: "TLS in transit | Provider-managed encryption at rest",
      guardrails: "Connection string + credentials in Secret Manager, VPN for self-hosted",
      compliance: "SOC2"
    }},
    { id: "src_saas", name: "SaaS / CRM", icon: null, subtitle: "Salesforce · Workday · ServiceNow · SAP", zone: "sources", x: 400, y: 200, details: {
      notes: "Cloud SaaS platforms with API-based extraction.\n\n• API Pull: REST/SOAP with pagination, rate-limit handling\n• CDC: Salesforce CDC streams, SAP SLT replication\n• Managed: Fivetran, BigQuery DTS native SaaS connectors",
      encryption: "TLS 1.2+ in transit | Vendor-managed AES-256 at rest",
      guardrails: "OAuth 2.0 tokens in Secret Manager, respect vendor rate limits (e.g. Salesforce 100K/day)",
      compliance: "SOC2, GDPR (PII in CRM/HR data)"
    }},
    { id: "src_files", name: "Files / SFTP", icon: null, subtitle: "CSV · Parquet · Excel · partner drops", zone: "sources", x: 550, y: 200, details: {
      notes: "Batch file drops from partners, vendors, or internal systems.\n\n• SFTP Poll: Cloud Function polls on schedule → writes to GCS\n• Cross-Cloud: Storage Transfer Service (S3 → GCS native)\n• Event-Driven: GCS notification → triggers processing",
      encryption: "SSH/SFTP encrypted channel | PGP for file-level encryption if required",
      guardrails: "SSH key pairs in Secret Manager, schema check on landing, file integrity checksums",
      compliance: "SOC2"
    }},
    { id: "src_apis", name: "APIs", icon: null, subtitle: "REST · GraphQL · webhooks", zone: "sources", x: 700, y: 200, details: {
      notes: "External and internal HTTP endpoints.\n\n• Pull: Cloud Function/Run calls API on schedule → writes to GCS/BQ\n• Push: Webhook → Cloud Function HTTP trigger → Pub/Sub buffer\n• Managed: Fivetran custom connector, Apigee gateway",
      encryption: "TLS 1.2+ in transit | HMAC signature verification for webhooks",
      guardrails: "OAuth 2.0 or API keys in Secret Manager, retry with backoff, dead-letter queue for failed webhooks",
      compliance: "SOC2"
    }},
    { id: "src_stream", name: "Event Streams", icon: null, subtitle: "Kafka · Confluent · Kinesis · IoT", zone: "sources", x: 850, y: 200, details: {
      notes: "High-volume real-time event producers.\n\n• Subscribe: Pub/Sub ← Kafka Connect, or Dataflow KafkaIO consumer\n• Bridge: Kafka → Pub/Sub connector for cloud-native consumption\n• Cross-Cloud: Kinesis → Dataflow KinesisIO → GCS/BQ",
      encryption: "TLS for inter-broker and client communication | SASL or mTLS authentication",
      guardrails: "Partition-aware consumption, exactly-once semantics, backpressure handling",
      compliance: "SOC2"
    }},
    { id: "src_unstructured", name: "Unstructured", icon: null, subtitle: "PDFs · images · audio · email", zone: "sources", x: 1000, y: 200, details: {
      notes: "Content requiring OCR, NLP, or ML before structured use.\n\n• Land: Drop raw files into GCS landing zone\n• Process: Document AI (OCR) → extract text → structured JSON\n• Enrich: Vertex AI for NLP, classification, entity extraction",
      encryption: "TLS in transit | CMEK on GCS landing bucket",
      guardrails: "Async pipeline: land → Pub/Sub notification → processing, service account with Storage Object Creator",
      compliance: "SOC2, HIPAA (if scanned medical docs)"
    }},
    { id: "src_legacy", name: "Legacy", icon: null, subtitle: "z/OS · DB2 · VSAM · MQ · COBOL", zone: "sources", x: 1150, y: 200, details: {
      notes: "Mainframes and AS/400 systems with limited APIs.\n\n• File Extract: COBOL batch job → flat file → SFTP/GCS → BQ load\n• Connector: Mainframe Connector for Google Cloud (Precisely)\n• MQ Bridge: MQ → Pub/Sub bridge for message-based integration",
      encryption: "z/OS dataset encryption (DFSMS) | TLS for network | SNA encryption for legacy protocols",
      guardrails: "Dedicated Interconnect, mainframe credentials in CyberArk → Secret Manager, EBCDIC → UTF-8 conversion",
      compliance: "SOC2, PCI-DSS (if financial mainframe)"
    }},

    // ── CONNECTIVITY BOUNDARY (next layer hint) ──
    { id: "boundary_conn", name: "🔒 Layer 2: Connectivity", icon: null, subtitle: "VPN · Auth · Secrets · Firewall · mTLS · Rate Limiting", zone: "connectivity", x: 600, y: 400, details: {
      notes: "★ TRUST BOUNDARY\n\nAll sources must pass through connectivity controls before entering the platform.\n\n• VPN / Interconnect (on-prem, cross-cloud)\n• Authentication (OAuth, SAML, API keys)\n• Secrets Manager (CyberArk → Secret Manager chain)\n• Firewall Rules (IP allowlist, port control)\n• mTLS (certificate-based mutual auth)\n• Rate Limiting (throttle, backoff, quotas)",
      encryption: "IPsec (VPN) | TLS 1.3 | mTLS for high-security",
      compliance: "SOC2, ISO 27001"
    }},
  ],

  edges: [
    { id: "s1", from: "src_rdb", to: "boundary_conn", label: "JDBC / CDC", step: 1, security: { transport: "TLS 1.2+", auth: "Service Account", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s2", from: "src_nosql", to: "boundary_conn", label: "Change Streams", step: 1, security: { transport: "TLS", auth: "Connection String", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s3", from: "src_saas", to: "boundary_conn", label: "OAuth API", step: 1, security: { transport: "TLS 1.3", auth: "OAuth 2.0", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s4", from: "src_files", to: "boundary_conn", label: "SFTP / S3", step: 1, security: { transport: "SSH / TLS", auth: "SSH Keys", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s5", from: "src_apis", to: "boundary_conn", label: "HTTPS", step: 1, security: { transport: "TLS 1.2+", auth: "API Key / OAuth", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s6", from: "src_stream", to: "boundary_conn", label: "SASL / mTLS", step: 1, security: { transport: "TLS", auth: "SASL / mTLS", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s7", from: "src_unstructured", to: "boundary_conn", label: "Upload / SFTP", step: 1, security: { transport: "TLS / SSH", auth: "Service Account", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s8", from: "src_legacy", to: "boundary_conn", label: "Interconnect", step: 1, security: { transport: "IPsec / MACsec", auth: "Mainframe Creds", classification: "restricted", private: true }, crossesBoundary: true, edgeType: "data" },
  ],

  threats: [
    { id: "t1", target: "src_saas", stride: "Spoofing", severity: "high", title: "OAuth Token Theft", description: "Stolen OAuth refresh tokens used to impersonate extraction service", impact: "Unauthorized data extraction from SaaS source", mitigation: "Short-lived tokens, token rotation, IP allowlisting at SaaS provider, Secret Manager versioning", compliance: "SOC2 CC6.1" },
    { id: "t2", target: "src_rdb", stride: "Information Disclosure", severity: "critical", title: "Credential Leakage", description: "Database credentials exposed in code, logs, or environment variables", impact: "Direct access to source database, data exfiltration", mitigation: "All credentials in Secret Manager, no plaintext in code or CI/CD, audit logging on secret access", compliance: "SOC2 CC6.1, ISO 27001" },
    { id: "t3", target: "src_stream", stride: "Tampering", severity: "high", title: "Message Injection", description: "Malicious events injected into Kafka/streaming source", impact: "Poisoned data flowing into data lake", mitigation: "mTLS for producer auth, schema validation via Schema Registry, input validation at ingestion", compliance: "SOC2 CC8.1" },
    { id: "t4", target: "src_legacy", stride: "Denial of Service", severity: "medium", title: "Mainframe Overload", description: "Extraction jobs overwhelm mainframe MIPS capacity", impact: "Production mainframe degradation affecting business operations", mitigation: "Scheduled extraction during batch windows, rate limiting, MIPS budgeting with mainframe team", compliance: null },
    { id: "t5", target: "boundary_conn", stride: "Elevation of Privilege", severity: "high", title: "VPN Tunnel Compromise", description: "Compromised VPN endpoint grants network access to GCP", impact: "Lateral movement from on-prem to cloud resources", mitigation: "VPC Service Controls, micro-segmentation, Zero Trust (BeyondCorp), no broad network trust", compliance: "SOC2 CC6.6" },
  ],
};

// ═══ REGISTRY ═════════════════════════════════════
export const TEMPLATES: Template[] = [
  {
    id: "sources-layer",
    name: "Layer 1: Sources",
    icon: "🗄️",
    description: "All 8 external source categories feeding data into the enterprise data platform: databases, SaaS, files, APIs, streams, unstructured, and legacy",
    tags: ["sources", "source", "layer 1", "ingestion sources", "external", "database", "saas", "crm", "erp", "salesforce", "oracle", "kafka", "sftp", "api", "webhook", "mainframe", "legacy", "nosql", "mongodb", "postgresql", "sql server", "workday", "servicenow", "sap", "unstructured", "files", "streaming", "event", "data sources"],
    diagram: SOURCES_LAYER,
  },
];
