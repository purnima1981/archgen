// ═══ TEMPLATE LIBRARY + KEYWORD MATCHING ENGINE ═══

export interface NodeDetails { project?: string; region?: string; serviceAccount?: string; iamRoles?: string; encryption?: string; monitoring?: string; retry?: string; alerting?: string; cost?: string; troubleshoot?: string; guardrails?: string; compliance?: string; notes?: string }
export interface DiagNode { id: string; name: string; icon?: string | null; subtitle?: string; zone: "sources" | "cloud" | "consumers"; x: number; y: number; details?: NodeDetails }
export interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean }
export interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean; edgeType?: "data" | "control" | "observe" | "alert" }
export interface Threat { id: string; target: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance?: string | null }
export interface Phase { id: string; name: string; nodeIds: string[] }
export interface OpsGroup { name: string; nodeIds: string[] }
export interface Diagram { title: string; subtitle?: string; nodes: DiagNode[]; edges: DiagEdge[]; threats?: Threat[]; phases?: Phase[]; opsGroup?: OpsGroup }
export interface Template { id: string; name: string; icon: string; description: string; tags: string[]; diagram: Diagram }

export function matchTemplate(input: string): Template | null {
  const q = input.toLowerCase();
  let best: Template | null = null, bestScore = 0;
  for (const t of TEMPLATES) {
    let score = 0;
    for (const tag of t.tags) { if (q.includes(tag)) score += tag.length; }
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return bestScore >= 4 ? best : null;
}

// ═══ TEMPLATE 1: STREAMING ANALYTICS ══════════════
const STREAMING: Diagram = {
  title: "Streaming Analytics Pipeline",
  subtitle: "Real-time event processing from sources through GCP into analytics and serving",

  phases: [
    { id: "ingest", name: "Ingest", nodeIds: ["apigee", "pubsub"] },
    { id: "process", name: "Process", nodeIds: ["dataflow", "dlp"] },
    { id: "serve", name: "Store & Serve", nodeIds: ["gcs", "bigquery", "looker", "cloudrun"] },
  ],
  opsGroup: { name: "Operations (Cross-Cutting)", nodeIds: ["composer", "monitoring", "logging"] },

  nodes: [
    // ── SOURCES (x=100) ──
    { id: "src_app", name: "Application", icon: null, subtitle: "Event Producer", zone: "sources", x: 100, y: 150, details: { notes: "Primary application producing business events via REST API" } },
    { id: "src_mobile", name: "Mobile App", icon: null, subtitle: "User Events", zone: "sources", x: 100, y: 350, details: { notes: "iOS/Android clickstream and user actions" } },
    { id: "src_iot", name: "IoT Devices", icon: null, subtitle: "Sensor Data", zone: "sources", x: 100, y: 530, details: { notes: "Telemetry from edge devices via MQTT" } },

    // ── PHASE 1: INGEST (x=370) ──
    { id: "apigee", name: "Apigee", icon: "apigee_api_platform", subtitle: "API Gateway", zone: "cloud", x: 370, y: 150,
      details: { project: "", region: "us-central1", serviceAccount: "sa-apigee@PROJECT.iam", iamRoles: "roles/apigee.apiAdminV2", encryption: "TLS 1.3 termination", monitoring: "API latency P99 < 200ms, error rate, request volume", retry: "Client retry with backoff. 429 rate limiting at 1000 req/s.", alerting: "Error rate > 5% → PagerDuty P2\nLatency P99 > 500ms → Slack", cost: "~$3/M API calls", troubleshoot: "Check Apigee Analytics → error breakdown by proxy.\nDebug trace for failing requests.\nCheck backend health if 502/503.", guardrails: "OAuth 2.0 required, rate limit per client ID, body max 10MB", compliance: "SOC2" } },
    { id: "pubsub", name: "Pub/Sub", icon: "pubsub", subtitle: "Event Bus", zone: "cloud", x: 370, y: 400,
      details: { project: "", region: "us-central1", serviceAccount: "sa-pubsub@PROJECT.iam", iamRoles: "roles/pubsub.publisher, roles/pubsub.subscriber", encryption: "Google-managed at rest + in transit", monitoring: "Oldest unacked msg age, publish rate, backlog, dead letter depth", retry: "Exponential backoff 10s→600s. Dead letter after 5 attempts. 7-day retention.", alerting: "Backlog > 5min → Slack P2\nDead letter > 0 → PagerDuty P1", cost: "$40/TB ingested", troubleshoot: "Backlog growing → check Dataflow health.\nDead letters → check message format.\nHigh latency → check push endpoint.", guardrails: "Schema Registry, ordering key on entity_id, dedup by ID", compliance: "SOC2" } },

    // ── PHASE 2: PROCESS (x=620) ──
    { id: "dataflow", name: "Dataflow", icon: "dataflow", subtitle: "Stream Processor", zone: "cloud", x: 620, y: 260,
      details: { project: "", region: "us-central1", serviceAccount: "sa-dataflow@PROJECT.iam", iamRoles: "roles/dataflow.worker, roles/bigquery.dataEditor", encryption: "CMEK via Cloud KMS", monitoring: "System lag, data freshness, elements/sec, CPU/mem, autoscaler", retry: "At-least-once, checkpoint every 30s. Autoscale 1-20. Failed → error topic.", alerting: "Lag > 60s → PagerDuty P1\nErrors > 10/min → Slack P2\nMax autoscale → PagerDuty P2", cost: "$0.069/vCPU-hr streaming. FlexRS 60% off batch.", troubleshoot: "High lag → increase workers or fix hot keys.\nOOM → increase memory.\nStuck → check UI for bottleneck stage.", guardrails: "Private IPs only, VPC-SC, Workload Identity", compliance: "SOC2" } },
    { id: "dlp", name: "Cloud DLP", icon: "cloud_natural_language_api", subtitle: "PII Scanner", zone: "cloud", x: 620, y: 490,
      details: { serviceAccount: "sa-dlp@PROJECT.iam", monitoring: "Findings per scan, PII types, latency", retry: "Retry 429/503. Async for large datasets.", alerting: "High-risk PII (SSN, CC) → PagerDuty P1", cost: "$1-3/GB. Sample 10% to reduce.", troubleshoot: "False positives → tune threshold.\nMissing PII → add custom infoTypes.", guardrails: "Inspect ALL data BEFORE storing. De-identify for ML. Column masking.", compliance: "HIPAA, GDPR, SOC2" } },

    // ── PHASE 3: STORE & SERVE (x=870, x=1080) ──
    { id: "gcs", name: "Cloud Storage", icon: "cloud_storage", subtitle: "Data Lake (Bronze)", zone: "cloud", x: 870, y: 150,
      details: { project: "", region: "us-central1", encryption: "CMEK, 90-day rotation", monitoring: "Object count, size, request count", retry: "Client retry on 5xx. Resumable uploads.", alerting: "Storage > 10TB → budget P3\nUnexpected access → security P1", cost: "$0.020/GB/mo. Lifecycle: Nearline 30d → Coldline 90d → Archive 365d.", guardrails: "Bucket Lock, Versioning, VPC-SC, no public access", compliance: "SOC2" } },
    { id: "bigquery", name: "BigQuery", icon: "bigquery", subtitle: "Warehouse (Silver/Gold)", zone: "cloud", x: 870, y: 380,
      details: { project: "", region: "us-central1", encryption: "CMEK. Column-level security via policy tags.", monitoring: "Slot utilization, bytes processed, streaming buffer, freshness", retry: "Streaming: retry 503. Batch: Composer 3x retry.", alerting: "Slots > 80% → Slack P3\nQuery > $100 → PagerDuty P2\nStreaming errors > 1% → PagerDuty P1", cost: "On-demand $6.25/TB. Flat-rate $0.04/slot-hr. BI Engine $25.50/GB/mo.", troubleshoot: "Slow → check INFORMATION_SCHEMA, add partitioning.\nHigh cost → audit top queries.\nStreaming lag → check Dataflow.", guardrails: "Authorized views, column ACL, audit all access", compliance: "SOC2, HIPAA" } },
    { id: "looker", name: "Looker", icon: "looker", subtitle: "Dashboards", zone: "cloud", x: 1080, y: 150,
      details: { encryption: "TLS in transit", monitoring: "Dashboard load time, cache hit rate", alerting: "Errors > 5% → Slack P2", cost: "Platform license + per-user. BI Engine for sub-second.", guardrails: "SSO via SAML/OIDC, row-level permissions", compliance: "SOC2" } },
    { id: "cloudrun", name: "Cloud Run", icon: "cloud_run", subtitle: "Data API", zone: "cloud", x: 1080, y: 380,
      details: { project: "", region: "us-central1", monitoring: "Request count, latency P99, cold starts", retry: "Auto-retry 503. Circuit breaker.", alerting: "P99 > 2s → Slack P2\n5xx > 1% → PagerDuty P1", cost: "Per request. Min instances=1 ~$15/mo.", guardrails: "Binary Auth, VPC connector, IAM invoker", compliance: "SOC2" } },

    // ── OPS GROUP (y=680, all same row) ──
    { id: "composer", name: "Composer", icon: "cloud_scheduler", subtitle: "Orchestrator", zone: "cloud", x: 480, y: 680,
      details: { monitoring: "DAG success rate, task duration, heartbeat", retry: "Task: 3 retries, 5min delay. SLA miss detection.", alerting: "DAG failure → PagerDuty P1\nSLA miss → Slack P2", cost: "Small: ~$400/mo", guardrails: "Private IP, Secret Manager, RBAC", compliance: "SOC2" } },
    { id: "monitoring", name: "Cloud Monitoring", icon: "cloud_monitoring", subtitle: "Metrics & Alerts", zone: "cloud", x: 730, y: 680,
      details: { monitoring: "Pipeline lag, throughput, errors, freshness, cost burn, SLO burn rate", alerting: "P1 → PagerDuty\nP2 → Slack\nP3 → Email", cost: "Free for GCP metrics. Custom: $0.258/metric/mo.", guardrails: "Alert on silence (meta-monitoring). Runbooks on every P1.", compliance: "SOC2" } },
    { id: "logging", name: "Cloud Logging", icon: "cloud_logging", subtitle: "Audit & Archive", zone: "cloud", x: 970, y: 680,
      details: { monitoring: "Log volume/day, error rate, audit patterns", alerting: "Unexpected admin action → Security P1\nLog volume > 2x → Slack P3", cost: "$0.50/GiB after 50GiB free. Route to GCS for cheap archive.", guardrails: "Sinks to BQ for analysis. Locked buckets. Org-level collection.", compliance: "SOC2, HIPAA" } },

    // ── CONSUMERS + ALERT DESTINATIONS (x=1300) ──
    { id: "con_analysts", name: "Analysts", icon: null, subtitle: "BI Consumers", zone: "consumers", x: 1300, y: 150, details: { notes: "Business analysts via SSO" } },
    { id: "con_apps", name: "Applications", icon: null, subtitle: "API Consumers", zone: "consumers", x: 1300, y: 380, details: { notes: "Downstream apps via OAuth 2.0" } },
    { id: "pagerduty", name: "PagerDuty", icon: null, subtitle: "P1 Incidents", zone: "consumers", x: 1300, y: 600, details: { notes: "Critical alerts: pipeline down, data loss risk" } },
    { id: "slack", name: "Slack", icon: null, subtitle: "P2 Alerts", zone: "consumers", x: 1300, y: 730, details: { notes: "Degraded performance, high latency warnings" } },
    { id: "email_notif", name: "Email", icon: null, subtitle: "P3 Notifications", zone: "consumers", x: 1300, y: 860, details: { notes: "Budget alerts, capacity planning, weekly reports" } },
  ],

  edges: [
    // ── Source → Cloud (PARALLEL entry, step=0, no numbers) ──
    { id: "s1", from: "src_app", to: "apigee", label: "Business Events", subtitle: "HTTPS / OAuth 2.0 + API Key", step: 0, security: { transport: "TLS 1.3", auth: "OAuth 2.0 + API Key", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s2", from: "src_mobile", to: "pubsub", label: "Clickstream", subtitle: "HTTPS / Firebase Auth JWT", step: 0, security: { transport: "TLS 1.3", auth: "Firebase Auth JWT", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s3", from: "src_iot", to: "pubsub", label: "Telemetry", subtitle: "MQTT over TLS / X.509 cert", step: 0, security: { transport: "TLS 1.2 (MQTT)", auth: "X.509 device cert", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },

    // ── Internal data flow (steps start at 1) ──
    { id: "d1", from: "apigee", to: "pubsub", label: "Validated Events", subtitle: "Internal gRPC / Workload Identity", step: 1, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d2", from: "pubsub", to: "dataflow", label: "Event Stream", subtitle: "Push subscription / Workload Identity", step: 2, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d3", from: "dataflow", to: "gcs", label: "Raw (Bronze)", subtitle: "GCS client / Workload Identity", step: 3, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d4", from: "dataflow", to: "bigquery", label: "Clean (Silver)", subtitle: "BQ Storage Write API / WI", step: 4, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d5", from: "bigquery", to: "looker", label: "Analytics", subtitle: "BQ API / OAuth 2.0 SSO", step: 5, security: { transport: "HTTPS", auth: "OAuth 2.0 SSO", classification: "internal", private: true }, edgeType: "data" },
    { id: "d6", from: "bigquery", to: "cloudrun", label: "Query Results", subtitle: "BQ API / Workload Identity", step: 6, security: { transport: "Internal", auth: "Workload Identity", classification: "internal", private: true }, edgeType: "data" },

    // ── Cloud → Consumers (boundary crossings) ──
    { id: "c1", from: "looker", to: "con_analysts", label: "Dashboards", subtitle: "HTTPS / SAML SSO + MFA", step: 7, security: { transport: "TLS 1.3", auth: "SAML SSO + MFA", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "c2", from: "cloudrun", to: "con_apps", label: "JSON API", subtitle: "HTTPS / OAuth 2.0 Bearer", step: 8, security: { transport: "TLS 1.3", auth: "OAuth 2.0 Bearer", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },

    // ── DLP → Dataflow (security scan) ──
    { id: "sec1", from: "dlp", to: "dataflow", label: "PII Scan", subtitle: "Inspects stream before processing", step: 0, edgeType: "control" },

    // ── Ops control ──
    { id: "op1", from: "composer", to: "dataflow", label: "Orchestrate", step: 0, edgeType: "control" },
    { id: "op2", from: "composer", to: "bigquery", label: "Schedule", step: 0, edgeType: "control" },

    // ── Alert destinations ──
    { id: "a1", from: "monitoring", to: "pagerduty", label: "P1 Incidents", step: 0, security: { transport: "HTTPS webhook", auth: "API Key", classification: "internal", private: false }, edgeType: "alert" },
    { id: "a2", from: "monitoring", to: "slack", label: "P2 Alerts", step: 0, security: { transport: "HTTPS webhook", auth: "Bot Token", classification: "internal", private: false }, edgeType: "alert" },
    { id: "a3", from: "monitoring", to: "email_notif", label: "P3 Reports", step: 0, security: { transport: "SMTP/SendGrid", auth: "API Key", classification: "internal", private: false }, edgeType: "alert" },
    { id: "a4", from: "logging", to: "gcs", label: "Log Archive", step: 0, edgeType: "observe" },
  ],

  threats: [
    { id: "T1", target: "s1", stride: "S", severity: "high", title: "API key compromise", description: "Stolen API key allows unauthorized event injection", impact: "Malicious data corrupts analytics", mitigation: "Rotate keys quarterly. IP allowlisting. Anomaly detection.", compliance: "SOC2" },
    { id: "T2", target: "pubsub", stride: "D", severity: "medium", title: "Event bus flooding", description: "Buggy producer floods Pub/Sub", impact: "Dataflow overwhelmed, cost spike", mitigation: "Quotas per publisher. Rate limiting. Budget alerts.", compliance: "SOC2" },
    { id: "T3", target: "bigquery", stride: "I", severity: "high", title: "Over-permissive access", description: "Broad IAM exposes PII columns", impact: "Data leak, compliance violation", mitigation: "Column-level security. Authorized views. Quarterly review.", compliance: "SOC2, HIPAA" },
    { id: "T4", target: "c1", stride: "S", severity: "medium", title: "Session hijack", description: "SSO token stolen via XSS", impact: "Unauthorized dashboard access", mitigation: "CSP headers. Short TTL. IP-bound sessions. MFA.", compliance: "SOC2" },
  ],
};

// ═══ TEMPLATE 2: CDC MIGRATION ════════════════════
const CDC_MIGRATION: Diagram = {
  title: "Cross-Cloud CDC Migration Pipeline",
  subtitle: "Real-time CDC replication from AWS RDS and on-prem databases to GCP BigQuery",
  phases: [
    { id: "connect", name: "Connect", nodeIds: ["vpn", "sts", "interconnect"] },
    { id: "capture", name: "Capture & Land", nodeIds: ["datastream", "gcs_land"] },
    { id: "transform", name: "Transform & Load", nodeIds: ["dataflow", "bigquery", "looker", "cloudrun"] },
  ],
  opsGroup: { name: "Operations", nodeIds: ["composer", "catalog", "monitoring"] },
  nodes: [
    { id: "src_rds", name: "AWS RDS", icon: null, subtitle: "PostgreSQL", zone: "sources", x: 100, y: 250, details: { notes: "Logical replication enabled (wal_level=logical)" } },
    { id: "src_s3", name: "AWS S3", icon: null, subtitle: "Historical Files", zone: "sources", x: 100, y: 420, details: { notes: "CSV/Parquet batch backfill exports" } },
    { id: "src_oracle", name: "On-Prem Oracle", icon: null, subtitle: "Legacy DB", zone: "sources", x: 100, y: 580, details: { notes: "Oracle 12c+ with LogMiner for CDC" } },
    { id: "vpn", name: "Cloud VPN", icon: "cloud_vpn", subtitle: "Encrypted Tunnel", zone: "cloud", x: 350, y: 250,
      details: { encryption: "IPSec IKEv2, AES-256-GCM", monitoring: "Tunnel status, bandwidth, packet loss", alerting: "Tunnel down → PagerDuty P1", cost: "~$0.075/hr + egress", compliance: "SOC2" } },
    { id: "sts", name: "Transfer Service", icon: "cloud_storage", subtitle: "S3 Batch Transfer", zone: "cloud", x: 350, y: 420,
      details: { monitoring: "Job status, bytes transferred", cost: "Free. Pay GCS + S3 egress.", guardrails: "Workload Identity Federation (no keys)", compliance: "SOC2" } },
    { id: "interconnect", name: "Interconnect", icon: "cloud_interconnect", subtitle: "Dedicated Link", zone: "cloud", x: 350, y: 580,
      details: { encryption: "MACsec L2 + app TLS", alerting: "Link down → PagerDuty P1", cost: "10Gbps: ~$1,700/mo", compliance: "SOC2, HIPAA" } },
    { id: "datastream", name: "Datastream", icon: "datastream", subtitle: "CDC Capture", zone: "cloud", x: 570, y: 280,
      details: { monitoring: "CDC lag, throughput, unsupported events", alerting: "CDC lag > 5min → PagerDuty P1", cost: "Free first 500GB/mo then $0.10/GB", compliance: "SOC2" } },
    { id: "gcs_land", name: "Cloud Storage", icon: "cloud_storage", subtitle: "Landing Zone", zone: "cloud", x: 570, y: 450,
      details: { encryption: "CMEK", monitoring: "Object count, new objects/hr", cost: "$0.020/GB/mo", compliance: "SOC2" } },
    { id: "dataflow", name: "Dataflow", icon: "dataflow", subtitle: "ETL Processor", zone: "cloud", x: 790, y: 360,
      details: { monitoring: "Elements processed, lag, freshness", alerting: "Lag > 120s → PagerDuty P1", cost: "$0.069/vCPU-hr", compliance: "SOC2" } },
    { id: "bigquery", name: "BigQuery", icon: "bigquery", subtitle: "Target Warehouse", zone: "cloud", x: 1000, y: 300,
      details: { encryption: "CMEK, column-level security", alerting: "Freshness > 15min → PagerDuty P2", cost: "$6.25/TB", compliance: "SOC2, HIPAA" } },
    { id: "looker", name: "Looker", icon: "looker", subtitle: "Migration Dashboard", zone: "cloud", x: 1000, y: 460, details: { guardrails: "SSO, row-level perms", compliance: "SOC2" } },
    { id: "cloudrun", name: "Cloud Run", icon: "cloud_run", subtitle: "Data API", zone: "cloud", x: 1000, y: 560, details: { guardrails: "Binary Auth, VPC connector", compliance: "SOC2" } },
    { id: "composer", name: "Composer", icon: "cloud_scheduler", subtitle: "Orchestrator", zone: "cloud", x: 450, y: 720, details: { alerting: "DAG failure → PagerDuty P1", cost: "~$400/mo", compliance: "SOC2" } },
    { id: "catalog", name: "Data Catalog", icon: "data_catalog", subtitle: "Metadata & Lineage", zone: "cloud", x: 660, y: 720, details: { guardrails: "Mandatory tags: owner, classification, SLA", compliance: "SOC2" } },
    { id: "monitoring", name: "Monitoring", icon: "cloud_monitoring", subtitle: "Observability", zone: "cloud", x: 870, y: 720, details: { monitoring: "CDC lag, freshness SLOs, throughput", compliance: "SOC2" } },
    { id: "con_dash", name: "Stakeholders", icon: null, subtitle: "Migration Tracking", zone: "consumers", x: 1230, y: 300, details: { notes: "Project stakeholders via Looker" } },
    { id: "con_api", name: "Applications", icon: null, subtitle: "Migrated Apps", zone: "consumers", x: 1230, y: 460, details: { notes: "Apps switching to GCP API" } },
    { id: "pagerduty", name: "PagerDuty", icon: null, subtitle: "P1 Incidents", zone: "consumers", x: 1230, y: 650, details: { notes: "Critical: pipeline down" } },
    { id: "slack", name: "Slack", icon: null, subtitle: "P2 Alerts", zone: "consumers", x: 1230, y: 760, details: { notes: "Degraded performance" } },
  ],
  edges: [
    { id: "s1", from: "src_rds", to: "vpn", label: "CDC WAL Stream", step: 0, security: { transport: "IPSec + TLS", auth: "DB creds in Secret Manager", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s2", from: "src_s3", to: "sts", label: "Historical Files", step: 0, security: { transport: "TLS 1.3", auth: "Workload Identity Federation", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s3", from: "src_oracle", to: "interconnect", label: "Oracle CDC", step: 0, security: { transport: "Dedicated + TLS", auth: "mTLS + DB creds", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "d1", from: "vpn", to: "datastream", label: "Encrypted CDC", step: 1, security: { transport: "Private", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d2", from: "interconnect", to: "datastream", label: "Oracle Events", step: 2, security: { transport: "Private", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d3", from: "sts", to: "gcs_land", label: "Batch Files", step: 3, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d4", from: "datastream", to: "gcs_land", label: "CDC JSON", step: 4, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d5", from: "gcs_land", to: "dataflow", label: "Raw for ETL", step: 5, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d6", from: "dataflow", to: "bigquery", label: "Clean Records", step: 6, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d7", from: "bigquery", to: "looker", label: "Analytics", step: 7, security: { transport: "HTTPS", auth: "OAuth SSO", classification: "internal", private: true }, edgeType: "data" },
    { id: "d8", from: "bigquery", to: "cloudrun", label: "API Queries", step: 8, security: { transport: "Internal", auth: "Workload Identity", classification: "internal", private: true }, edgeType: "data" },
    { id: "c1", from: "looker", to: "con_dash", label: "Reports", step: 9, security: { transport: "TLS 1.3", auth: "SAML SSO", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "c2", from: "cloudrun", to: "con_api", label: "API Responses", step: 10, security: { transport: "TLS 1.3", auth: "OAuth 2.0", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "op1", from: "composer", to: "dataflow", label: "Orchestrate", step: 0, edgeType: "control" },
    { id: "a1", from: "monitoring", to: "pagerduty", label: "P1 Incidents", step: 0, edgeType: "alert" },
    { id: "a2", from: "monitoring", to: "slack", label: "P2 Alerts", step: 0, edgeType: "alert" },
  ],
  threats: [
    { id: "T1", target: "s1", stride: "T", severity: "high", title: "VPN tunnel intercept", description: "MITM on CDC stream", impact: "Sensitive records exposed", mitigation: "IPSec + app TLS. Rotate PSK quarterly.", compliance: "SOC2" },
    { id: "T2", target: "datastream", stride: "I", severity: "high", title: "CDC data tampering", description: "Unauthorized modification before ETL", impact: "Corrupted warehouse", mitigation: "Object versioning. Checksum validation.", compliance: "SOC2" },
    { id: "T3", target: "bigquery", stride: "I", severity: "high", title: "Schema drift", description: "Source DDL change breaks pipeline", impact: "Data loss", mitigation: "Schema validation. DDL alerts. Catalog lineage.", compliance: "SOC2" },
  ],
};

// ═══ TEMPLATE 3: RAG / GENAI ══════════════════════
const RAG_GENAI: Diagram = {
  title: "RAG / GenAI Application",
  subtitle: "Document ingestion, embedding, vector search, and grounded generation with Vertex AI Gemini",
  phases: [
    { id: "ingest", name: "Ingest", nodeIds: ["functions", "pubsub", "docai"] },
    { id: "embed", name: "Embed & Index", nodeIds: ["chunker", "embeddings", "dlp"] },
    { id: "serve", name: "Search & Generate", nodeIds: ["vectordb", "orchestrator", "gemini", "cache", "firebase"] },
  ],
  opsGroup: { name: "Operations", nodeIds: ["monitoring", "logging"] },
  nodes: [
    { id: "src_drive", name: "Google Drive", icon: null, subtitle: "Documents", zone: "sources", x: 100, y: 230, details: { notes: "Team docs, policies, KB articles" } },
    { id: "src_conf", name: "Confluence", icon: null, subtitle: "Wiki Pages", zone: "sources", x: 100, y: 400, details: { notes: "Engineering wiki via REST API" } },
    { id: "src_upload", name: "File Uploads", icon: null, subtitle: "User PDFs", zone: "sources", x: 100, y: 560, details: { notes: "PDFs, DOCX via web UI" } },
    { id: "functions", name: "Cloud Functions", icon: "cloud_functions", subtitle: "Webhook Handler", zone: "cloud", x: 340, y: 230,
      details: { monitoring: "Invocations, error rate", cost: "Free 2M/mo", compliance: "SOC2" } },
    { id: "pubsub", name: "Pub/Sub", icon: "pubsub", subtitle: "Doc Queue", zone: "cloud", x: 340, y: 400,
      details: { monitoring: "Backlog, processing rate", cost: "$40/TB", compliance: "SOC2" } },
    { id: "docai", name: "Document AI", icon: "document_ai", subtitle: "PDF Extraction", zone: "cloud", x: 340, y: 560,
      details: { monitoring: "Pages processed, accuracy", cost: "$0.01-0.10/page", compliance: "SOC2" } },
    { id: "chunker", name: "Cloud Run", icon: "cloud_run", subtitle: "Text Chunker", zone: "cloud", x: 560, y: 300,
      details: { monitoring: "Docs processed, chunks created", cost: "~$15/mo", guardrails: "512 tokens/chunk, 50 overlap", compliance: "SOC2" } },
    { id: "embeddings", name: "Vertex AI", icon: "vertexai", subtitle: "Embeddings API", zone: "cloud", x: 560, y: 470,
      details: { monitoring: "Requests/sec, latency", cost: "$0.025/1K chars", guardrails: "768 dims, batch ≤250", compliance: "SOC2" } },
    { id: "dlp", name: "Cloud DLP", icon: "cloud_natural_language_api", subtitle: "PII Guard", zone: "cloud", x: 560, y: 600,
      details: { monitoring: "PII findings", guardrails: "Scan before Gemini. Strip PII.", compliance: "GDPR, SOC2" } },
    { id: "vectordb", name: "Cloud SQL", icon: "cloud_sql", subtitle: "pgvector Store", zone: "cloud", x: 790, y: 290,
      details: { encryption: "CMEK, SSL required", monitoring: "Connections, query latency", cost: "~$50/mo", guardrails: "Private IP, IAM DB auth", compliance: "SOC2" } },
    { id: "orchestrator", name: "Cloud Run", icon: "cloud_run", subtitle: "RAG Orchestrator", zone: "cloud", x: 790, y: 460,
      details: { monitoring: "Query count, P99, retrieval MRR", alerting: "P99 > 5s → PagerDuty P2\nGemini errors > 5% → PagerDuty P1", cost: "~$30/mo + Gemini ~$0.005/query", guardrails: "Max 10 chunks/query. 1000 output tokens. Grounding.", compliance: "SOC2" } },
    { id: "gemini", name: "Gemini", icon: "vertexai", subtitle: "LLM Generation", zone: "cloud", x: 790, y: 600,
      details: { monitoring: "Tokens in/out, safety triggers", cost: "Flash: $0.075/1M in", guardrails: "Injection protection. Safety filters. Temperature 0.1.", compliance: "SOC2" } },
    { id: "cache", name: "Memorystore", icon: "memorystore", subtitle: "Response Cache", zone: "cloud", x: 1010, y: 350,
      details: { cost: "Redis 1GB ~$35/mo", guardrails: "TTL 1hr factual, 15min dynamic", compliance: "SOC2" } },
    { id: "firebase", name: "Identity Platform", icon: "identity_platform", subtitle: "User Auth", zone: "cloud", x: 1010, y: 500,
      details: { guardrails: "MFA for admin. Rate limit. TTL 4hr.", compliance: "SOC2" } },
    { id: "monitoring", name: "Monitoring", icon: "cloud_monitoring", subtitle: "Observability", zone: "cloud", x: 530, y: 740, details: { monitoring: "Retrieval quality, latency, cost", compliance: "SOC2" } },
    { id: "logging", name: "Cloud Logging", icon: "cloud_logging", subtitle: "Prompt Audit", zone: "cloud", x: 770, y: 740, details: { guardrails: "Redact PII. Locked retention.", compliance: "SOC2" } },
    { id: "con_users", name: "End Users", icon: null, subtitle: "Chat Interface", zone: "consumers", x: 1230, y: 420, details: { notes: "React UI with streaming" } },
    { id: "pagerduty", name: "PagerDuty", icon: null, subtitle: "P1 Incidents", zone: "consumers", x: 1230, y: 620, details: { notes: "Critical: Gemini down" } },
    { id: "slack", name: "Slack", icon: null, subtitle: "P2 Alerts", zone: "consumers", x: 1230, y: 740, details: { notes: "Quality degradation" } },
  ],
  edges: [
    { id: "s1", from: "src_drive", to: "functions", label: "Doc Changes", step: 0, security: { transport: "TLS 1.3", auth: "OAuth 2.0", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s2", from: "src_conf", to: "functions", label: "Page Updates", step: 0, security: { transport: "TLS 1.3", auth: "API Token", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s3", from: "src_upload", to: "pubsub", label: "Uploaded Files", step: 0, security: { transport: "TLS 1.3", auth: "Firebase JWT", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "d1", from: "functions", to: "pubsub", label: "Doc Events", step: 1, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d2", from: "pubsub", to: "docai", label: "PDFs", step: 2, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d3", from: "pubsub", to: "chunker", label: "Text Docs", step: 3, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d4", from: "docai", to: "chunker", label: "Extracted Text", step: 4, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d5", from: "chunker", to: "embeddings", label: "Chunks", step: 5, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d6", from: "embeddings", to: "vectordb", label: "Vectors", step: 6, security: { transport: "SSL", auth: "IAM DB auth", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d7", from: "orchestrator", to: "vectordb", label: "Search", step: 7, security: { transport: "SSL", auth: "IAM DB auth", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d8", from: "orchestrator", to: "gemini", label: "Context + Query", step: 8, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "d9", from: "orchestrator", to: "con_users", label: "Streamed Response", step: 9, security: { transport: "TLS 1.3", auth: "Firebase JWT", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "sec1", from: "dlp", to: "orchestrator", label: "PII Scan", step: 0, edgeType: "control" },
    { id: "a1", from: "monitoring", to: "pagerduty", label: "P1", step: 0, edgeType: "alert" },
    { id: "a2", from: "monitoring", to: "slack", label: "P2", step: 0, edgeType: "alert" },
  ],
  threats: [
    { id: "T1", target: "orchestrator", stride: "T", severity: "critical", title: "Prompt injection", description: "Malicious input overrides system prompt", impact: "Leaks internal data", mitigation: "Separate prompts. Injection classifier. Output filter.", compliance: "SOC2" },
    { id: "T2", target: "s3", stride: "I", severity: "high", title: "Malicious doc upload", description: "Adversarial content poisons KB", impact: "Harmful answers", mitigation: "Malware scan. Content moderation. Attribution.", compliance: "SOC2" },
    { id: "T3", target: "gemini", stride: "I", severity: "high", title: "Hallucination", description: "Incorrect info generated", impact: "Users act on wrong data", mitigation: "Grounding + citations. Confidence scoring.", compliance: "SOC2" },
  ],
};

// ═══ REGISTRY ═════════════════════════════════════
export const TEMPLATES: Template[] = [
  { id: "streaming-analytics", name: "Streaming Analytics", icon: "📊", description: "Real-time event processing with Pub/Sub, Dataflow, BigQuery",
    tags: ["streaming", "stream", "real-time", "realtime", "event", "pub/sub", "pubsub", "dataflow", "analytics", "clickstream", "iot", "sensor", "event-driven", "kafka", "pipeline", "ingest"],
    diagram: STREAMING },
  { id: "cdc-migration", name: "CDC Migration", icon: "🔄", description: "Cross-cloud CDC from AWS/Oracle to GCP BigQuery",
    tags: ["cdc", "migration", "migrate", "replicate", "replication", "datastream", "aws to gcp", "aws", "cross-cloud", "rds", "oracle", "postgresql", "database migration", "hybrid", "vpn", "interconnect", "transfer"],
    diagram: CDC_MIGRATION },
  { id: "rag-genai", name: "RAG / GenAI", icon: "🤖", description: "Document RAG chatbot with Vertex AI Gemini",
    tags: ["rag", "genai", "gen ai", "generative", "chatbot", "assistant", "copilot", "llm", "gemini", "gpt", "embedding", "vector", "pgvector", "document", "knowledge base", "ai assistant", "question answering"],
    diagram: RAG_GENAI },
];
