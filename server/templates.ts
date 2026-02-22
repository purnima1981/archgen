// ═══ TEMPLATE LIBRARY + KEYWORD MATCHING ENGINE ═══

export interface NodeDetails { project?: string; region?: string; serviceAccount?: string; iamRoles?: string; encryption?: string; monitoring?: string; retry?: string; alerting?: string; cost?: string; troubleshoot?: string; guardrails?: string; compliance?: string; notes?: string }
export interface DiagNode { id: string; name: string; icon?: string | null; subtitle?: string; zone: "sources" | "cloud" | "consumers"; x: number; y: number; details?: NodeDetails }
export interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean }
export interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean; edgeType?: "data" | "control" | "observe" }
export interface Threat { id: string; target: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance?: string | null }
export interface Diagram { title: string; subtitle?: string; nodes: DiagNode[]; edges: DiagEdge[]; threats?: Threat[] }
export interface Template { id: string; name: string; icon: string; description: string; tags: string[]; diagram: Diagram }

// ── KEYWORD MATCHER ───────────────────────────────
export function matchTemplate(input: string): Template | null {
  const q = input.toLowerCase();
  let best: Template | null = null, bestScore = 0;
  for (const t of TEMPLATES) {
    let score = 0;
    for (const tag of t.tags) {
      if (q.includes(tag)) score += tag.length;
    }
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return bestScore >= 4 ? best : null;
}

// ═══ TEMPLATE 1: STREAMING ANALYTICS ══════════════
const STREAMING: Diagram = {
  title: "Streaming Analytics Pipeline",
  subtitle: "Real-time event processing from sources through GCP into analytics and serving",
  nodes: [
    // Sources — x=100, well inside zone padding
    { id: "src_app", name: "Application", icon: null, subtitle: "Event Producer", zone: "sources", x: 100, y: 230, details: { notes: "Primary application producing business events" } },
    { id: "src_mobile", name: "Mobile App", icon: null, subtitle: "User Events", zone: "sources", x: 100, y: 400, details: { notes: "iOS/Android clickstream and user actions" } },
    { id: "src_iot", name: "IoT Devices", icon: null, subtitle: "Sensor Data", zone: "sources", x: 100, y: 570, details: { notes: "Telemetry from edge devices" } },

    // Cloud — Ingestion column (x=380)
    { id: "apigee", name: "Apigee", icon: "apigee_api_platform", subtitle: "API Gateway", zone: "cloud", x: 380, y: 230,
      details: { project: "", region: "us-central1", serviceAccount: "sa-apigee@PROJECT.iam", iamRoles: "roles/apigee.apiAdminV2", encryption: "TLS 1.3 termination", monitoring: "API latency P99 < 200ms, error rate, request volume", retry: "Client retry with backoff. 429 rate limiting at 1000 req/s.", alerting: "Error rate > 5% → PagerDuty P2\nLatency P99 > 500ms → Slack P2", cost: "~$3/M API calls", troubleshoot: "Check Apigee Analytics → error breakdown by proxy.\nDebug trace for specific failing requests.\nCheck backend health if 502/503.", guardrails: "OAuth 2.0 required, rate limit per client ID, request body max 10MB", compliance: "SOC2" } },
    { id: "pubsub", name: "Pub/Sub", icon: "pubsub", subtitle: "Event Bus", zone: "cloud", x: 380, y: 400,
      details: { project: "", region: "us-central1", serviceAccount: "sa-pubsub@PROJECT.iam", iamRoles: "roles/pubsub.publisher, roles/pubsub.subscriber", encryption: "Google-managed at rest + in transit", monitoring: "Oldest unacked msg age, publish rate, backlog size, dead letter depth", retry: "Exponential backoff 10s→600s.\nDead letter topic after 5 failed attempts.\n7-day retention for replay.", alerting: "Backlog age > 5min → Slack P2\nDead letter count > 0 → PagerDuty P1\nPublish error rate > 1% → Slack P2", cost: "$40/TB ingested. Batch publish (1000 msgs/req) to optimize.", troubleshoot: "Backlog growing → check Dataflow health, verify subscriber acking.\nDead letters → check message format, consumer logs.\nHigh latency → check push endpoint response time.", guardrails: "Schema Registry validation, ordering key on entity_id, message dedup", compliance: "SOC2" } },

    // Cloud — Processing column (x=600)
    { id: "dataflow", name: "Dataflow", icon: "dataflow", subtitle: "Stream Processor", zone: "cloud", x: 600, y: 310,
      details: { project: "", region: "us-central1", serviceAccount: "sa-dataflow@PROJECT.iam", iamRoles: "roles/dataflow.worker, roles/bigquery.dataEditor, roles/storage.objectCreator", encryption: "CMEK via Cloud KMS for temp data and shuffle", monitoring: "System lag, data freshness, elements/sec, worker CPU/mem, autoscaler events", retry: "At-least-once with checkpointing every 30s.\nAutoscale: min 1, max 20 workers.\nFailed elements → error topic.", alerting: "System lag > 60s → PagerDuty P1\nWorker errors > 10/min → Slack P2\nAutoscaling at max → PagerDuty P2", cost: "Streaming: $0.069/vCPU-hr. Batch FlexRS: 60% discount.\nTip: n1-standard-2 for most jobs.", troubleshoot: "High lag → increase max workers or fix hot keys.\nOOM → increase memory type or fix GroupByKey skew.\nStuck → check Dataflow UI for bottleneck stage.", guardrails: "Private IPs only, VPC-SC perimeter, Workload Identity", compliance: "SOC2" } },
    { id: "dlp", name: "Cloud DLP", icon: "cloud_natural_language_api", subtitle: "Privacy Scanner", zone: "cloud", x: 600, y: 510,
      details: { project: "", serviceAccount: "sa-dlp@PROJECT.iam", iamRoles: "roles/dlp.user", monitoring: "Findings per scan, PII types detected, scan latency", retry: "Retry on 429/503. Async for large datasets.", alerting: "High-risk PII (SSN, CC) found → PagerDuty P1\nScan failures → Slack P2", cost: "$1-3/GB inspected. Sample 10% to reduce cost.", troubleshoot: "False positives → tune likelihood threshold.\nMissing PII → add custom infoTypes.\nSlow → reduce template scope.", guardrails: "Inspect ALL data BEFORE storing. De-identify for ML. Column masking in BQ.", compliance: "HIPAA, GDPR, SOC2" } },

    // Cloud — Storage column (x=830)
    { id: "gcs", name: "Cloud Storage", icon: "cloud_storage", subtitle: "Data Lake (Bronze)", zone: "cloud", x: 830, y: 230,
      details: { project: "", region: "us-central1", serviceAccount: "sa-storage@PROJECT.iam", iamRoles: "roles/storage.objectCreator (write), roles/storage.objectViewer (read)", encryption: "CMEK via Cloud KMS, 90-day rotation", monitoring: "Object count, total size, request count, egress volume", retry: "Client retry with backoff on 5xx. Resumable uploads for large objects.", alerting: "Storage > 10TB → budget alert P3\nUnexpected SA access → security P1", cost: "$0.020/GB/mo Standard. Lifecycle: Nearline 30d, Coldline 90d, Archive 365d.", troubleshoot: "Permission denied → check IAM + VPC-SC.\nSlow → parallel composite uploads.\n403 cross-project → check org policy.", guardrails: "Bucket Lock, Object Versioning, VPC-SC, no public access", compliance: "SOC2" } },
    { id: "bigquery", name: "BigQuery", icon: "bigquery", subtitle: "Warehouse (Silver/Gold)", zone: "cloud", x: 830, y: 430,
      details: { project: "", region: "us-central1", serviceAccount: "sa-bq@PROJECT.iam", iamRoles: "roles/bigquery.dataEditor (ETL), roles/bigquery.dataViewer (dash), roles/bigquery.jobUser", encryption: "CMEK. Column-level security on PII via policy tags.", monitoring: "Slot utilization, bytes processed, streaming buffer, query count, row freshness", retry: "Streaming: retry 503 with backoff. Batch: Composer retry 3x, 5min delay.", alerting: "Slots > 80% → Slack P3\nQuery > $100 → PagerDuty P2\nStreaming errors > 1% → PagerDuty P1\nFreshness > 1hr → Slack P2", cost: "On-demand $6.25/TB. Flat-rate $0.04/slot-hr. BI Engine $25.50/GB/mo.", troubleshoot: "Slow → check INFORMATION_SCHEMA.JOBS, add partitioning.\nHigh cost → audit top 10 queries.\nStreaming lag → check Dataflow output.", guardrails: "Authorized views, column ACL via policy tags, audit all access, no EXPORT without approval", compliance: "SOC2, HIPAA (with BAA)" } },

    // Cloud — Serving column (x=1060)
    { id: "looker", name: "Looker", icon: "looker", subtitle: "Dashboards", zone: "cloud", x: 1060, y: 260,
      details: { project: "", serviceAccount: "sa-looker@PROJECT.iam", iamRoles: "roles/bigquery.dataViewer", encryption: "TLS in transit, Looker-managed at rest", monitoring: "Dashboard load time, query count, cache hit rate, user sessions", alerting: "Errors > 5% → Slack P2\nCache hit < 50% → Slack P3", cost: "Platform license + per-user. BI Engine for sub-second queries.", troubleshoot: "Slow → check BQ query, enable aggregate awareness.\nNo data → check connection creds.\nStale → check PDT schedule.", guardrails: "SSO via SAML/OIDC, row-level permissions, disable CSV for sensitive data", compliance: "SOC2" } },
    { id: "cloudrun", name: "Cloud Run", icon: "cloud_run", subtitle: "Data API", zone: "cloud", x: 1060, y: 450,
      details: { project: "", region: "us-central1", serviceAccount: "sa-api@PROJECT.iam", iamRoles: "roles/run.invoker, roles/bigquery.dataViewer", encryption: "TLS auto, CMEK for container images", monitoring: "Request count, latency P50/P95/P99, instance count, memory, cold starts", retry: "Auto-retry 503. Client: circuit breaker + exponential backoff.", alerting: "P99 > 2s → Slack P2\n5xx > 1% → PagerDuty P1\nCold starts > 10% → Slack P3", cost: "Per request + vCPU-s. Min instances=1 ~$15/mo to avoid cold starts.", troubleshoot: "Latency → increase min instances. 503 → check concurrency limit.\nOOM → increase memory.", guardrails: "Binary Auth, VPC connector, IAM invoker auth, container scanning", compliance: "SOC2" } },

    // Cloud — Operations row (x spread, y=670)
    { id: "composer", name: "Composer", icon: "cloud_scheduler", subtitle: "Orchestrator", zone: "cloud", x: 470, y: 670,
      details: { project: "", region: "us-central1", serviceAccount: "sa-composer@PROJECT.iam", monitoring: "DAG success rate, task duration, scheduler heartbeat, worker utilization", retry: "Task: 3 retries, 5min delay. DAG: SLA miss detection. Dead-letter for failed tasks.", alerting: "DAG failure → PagerDuty P1\nSLA miss → Slack P2\nScheduler down → PagerDuty P1", cost: "Small: ~$350-500/mo. Medium: ~$800/mo. Use deferrable operators to save.", troubleshoot: "DAG stuck → check Airflow task logs, upstream deps.\nOOM → scale env.\nScheduler lag → check DB utilization.", guardrails: "Private IP, Secret Manager for creds, RBAC for DAG access", compliance: "SOC2" } },
    { id: "monitoring", name: "Monitoring", icon: "cloud_monitoring", subtitle: "Observability", zone: "cloud", x: 710, y: 670,
      details: { monitoring: "Pipeline lag, throughput, error rates, data freshness, cost burn rate, SLO burn rate", alerting: "P1 → PagerDuty (pipeline down)\nP2 → Slack (degraded)\nP3 → Email (cost, capacity)", cost: "Free for GCP metrics. Custom: $0.258/metric/mo after 2500.", troubleshoot: "Metrics missing → check scope. Dashboard stale → check ingestion delay (≤3min).\nAlerts not firing → verify channel + condition.", guardrails: "Alert on silence (meta-monitoring). Runbooks on every P1. Quarterly alert review.", compliance: "SOC2" } },
    { id: "logging", name: "Cloud Logging", icon: "cloud_logging", subtitle: "Audit Trail", zone: "cloud", x: 950, y: 670,
      details: { monitoring: "Log volume/day, error rate, audit patterns, log-based metrics", alerting: "Unexpected admin action → Security P1\nLog volume > 2x → Slack P3 (cost)", cost: "$0.50/GiB after 50GiB free. Route to GCS for cheap long-term.", troubleshoot: "Missing → check exclusion filters. High cost → add filters for noisy sources.", guardrails: "Sinks to BQ for analysis. Locked buckets for compliance. Org-level audit collection.", compliance: "SOC2, HIPAA (audit trail)" } },

    // Consumers — x=1280
    { id: "con_analysts", name: "Analysts", icon: null, subtitle: "BI Consumers", zone: "consumers", x: 1280, y: 260, details: { notes: "Business analysts accessing Looker dashboards via SSO" } },
    { id: "con_apps", name: "Applications", icon: null, subtitle: "API Consumers", zone: "consumers", x: 1280, y: 450, details: { notes: "Downstream apps calling data API via OAuth 2.0" } },
  ],
  edges: [
    // Source → Cloud (boundary crossings)
    { id: "e1", from: "src_app", to: "apigee", label: "Business Events", subtitle: "HTTPS / OAuth 2.0 + API Key", step: 1, security: { transport: "TLS 1.3", auth: "OAuth 2.0 + API Key", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e2", from: "src_mobile", to: "pubsub", label: "Clickstream Events", subtitle: "HTTPS / Firebase Auth JWT", step: 2, security: { transport: "TLS 1.3", auth: "Firebase Auth JWT", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e3", from: "src_iot", to: "pubsub", label: "Sensor Telemetry", subtitle: "MQTT over TLS / X.509 cert", step: 3, security: { transport: "TLS 1.2 (MQTT)", auth: "X.509 device cert", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    // Internal data flows
    { id: "e4", from: "apigee", to: "pubsub", label: "Validated Events", subtitle: "Internal gRPC / Workload Identity", step: 4, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e5", from: "pubsub", to: "dataflow", label: "Event Stream", subtitle: "Push subscription / Workload Identity", step: 5, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e6", from: "dataflow", to: "gcs", label: "Raw Events (Bronze)", subtitle: "GCS client / Workload Identity", step: 6, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e7", from: "dataflow", to: "bigquery", label: "Clean Records (Silver)", subtitle: "BQ Storage Write API / Workload Identity", step: 7, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e8", from: "bigquery", to: "looker", label: "Analytics Queries", subtitle: "BQ API / OAuth 2.0 SSO", step: 8, security: { transport: "HTTPS", auth: "OAuth 2.0 SSO", classification: "internal", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e9", from: "bigquery", to: "cloudrun", label: "Query Results", subtitle: "BQ API / Workload Identity", step: 9, security: { transport: "Internal", auth: "Workload Identity", classification: "internal", private: true }, crossesBoundary: false, edgeType: "data" },
    // Cloud → Consumer (boundary crossings)
    { id: "e10", from: "looker", to: "con_analysts", label: "Dashboards", subtitle: "HTTPS / SAML SSO + MFA", step: 10, security: { transport: "TLS 1.3", auth: "SAML SSO + MFA", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e11", from: "cloudrun", to: "con_apps", label: "JSON Responses", subtitle: "HTTPS / OAuth 2.0 Bearer", step: 11, security: { transport: "TLS 1.3", auth: "OAuth 2.0 Bearer", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    // DLP → Dataflow (security scan)
    { id: "e_dlp", from: "dlp", to: "dataflow", label: "PII Scan", subtitle: "Inspects stream for sensitive data", step: 0, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "control" },
    // Ops connections (observe)
    { id: "e_comp_df", from: "composer", to: "dataflow", label: "Orchestrates", subtitle: "Triggers and monitors jobs", step: 0, security: { transport: "Internal", auth: "Workload Identity", classification: "internal", private: true }, crossesBoundary: false, edgeType: "control" },
    { id: "e_comp_bq", from: "composer", to: "bigquery", label: "Schedules", subtitle: "Batch loads and transforms", step: 0, security: { transport: "Internal", auth: "Workload Identity", classification: "internal", private: true }, crossesBoundary: false, edgeType: "control" },
  ],
  threats: [
    { id: "T1", target: "e1", stride: "S", severity: "high", title: "API key compromise", description: "Stolen or leaked API key allows unauthorized event injection", impact: "Malicious data enters pipeline, corrupts analytics", mitigation: "Rotate keys quarterly. IP allowlisting. Anomaly detection on event patterns.", compliance: "SOC2" },
    { id: "T2", target: "pubsub", stride: "D", severity: "medium", title: "Event bus flooding", description: "Buggy or malicious producer floods Pub/Sub", impact: "Dataflow overwhelmed, cost spike, data delays", mitigation: "Quotas per publisher SA. Apigee rate limiting. Autoscale max limit. Budget alerts.", compliance: "SOC2" },
    { id: "T3", target: "bigquery", stride: "I", severity: "high", title: "Over-permissive BQ access", description: "Overly broad IAM exposes sensitive columns to unauthorized users", impact: "PII/financial data leaked, compliance violation", mitigation: "Column-level security via policy tags. Authorized views. Quarterly access review. VPC-SC.", compliance: "SOC2, HIPAA" },
    { id: "T4", target: "e10", stride: "S", severity: "medium", title: "Dashboard session hijack", description: "SSO session token stolen via XSS or session fixation", impact: "Unauthorized analytics access", mitigation: "CSP headers. Short session TTL. IP-bound sessions. MFA. Session logging.", compliance: "SOC2" },
  ],
};

// ═══ TEMPLATE 2: CDC MIGRATION ════════════════════
const CDC_MIGRATION: Diagram = {
  title: "Cross-Cloud CDC Migration Pipeline",
  subtitle: "Real-time CDC replication from AWS RDS and on-prem databases to GCP BigQuery",
  nodes: [
    { id: "src_rds", name: "AWS RDS", icon: null, subtitle: "PostgreSQL Source", zone: "sources", x: 100, y: 260, details: { notes: "AWS RDS PostgreSQL with logical replication (wal_level=logical)" } },
    { id: "src_s3", name: "AWS S3", icon: null, subtitle: "Data Lake Files", zone: "sources", x: 100, y: 430, details: { notes: "Historical exports, CSV/Parquet for batch backfill" } },
    { id: "src_oracle", name: "On-Prem Oracle", icon: null, subtitle: "Legacy Database", zone: "sources", x: 100, y: 590, details: { notes: "Oracle 12c+ with LogMiner for CDC" } },
    { id: "vpn", name: "Cloud VPN", icon: "cloud_vpn", subtitle: "Encrypted Tunnel", zone: "cloud", x: 360, y: 260,
      details: { project: "", region: "us-central1", encryption: "IPSec IKEv2, AES-256-GCM", monitoring: "Tunnel status, bandwidth, packet loss", retry: "Auto tunnel re-establishment", alerting: "Tunnel down → PagerDuty P1\nBandwidth > 80% → Slack P2", cost: "~$0.075/hr per tunnel + egress", troubleshoot: "Down → check peer gateway, IKE config.\nSlow → check bandwidth, consider Interconnect.", guardrails: "Dedicated gateway per env. PSK in Secret Manager.", compliance: "SOC2" } },
    { id: "interconnect", name: "Interconnect", icon: "cloud_interconnect", subtitle: "Dedicated Link", zone: "cloud", x: 360, y: 590,
      details: { project: "", encryption: "MACsec L2 + app-layer TLS", monitoring: "Link status, bandwidth, light levels", alerting: "Link down → PagerDuty P1", cost: "10Gbps: ~$1,700/mo", guardrails: "Redundant attachments in different zones", compliance: "SOC2, HIPAA" } },
    { id: "sts", name: "Transfer Service", icon: "cloud_storage", subtitle: "S3 Batch Transfer", zone: "cloud", x: 360, y: 430,
      details: { project: "", monitoring: "Job status, bytes transferred", retry: "Auto retry. Incremental: new/changed only.", alerting: "Failure → Slack P2", cost: "Free service. Pay GCS + S3 egress.", troubleshoot: "Failed → check IAM on S3. Slow → object count issue.", guardrails: "AWS IAM role via Workload Identity Federation (no keys)", compliance: "SOC2" } },
    { id: "datastream", name: "Datastream", icon: "datastream", subtitle: "CDC Capture", zone: "cloud", x: 560, y: 260,
      details: { project: "", region: "us-central1", serviceAccount: "sa-datastream@PROJECT.iam", monitoring: "CDC lag, throughput, unsupported events", retry: "Auto retry, resumes from checkpoint", alerting: "CDC lag > 5min → PagerDuty P1\nUnsupported events → Slack P2", cost: "Free first 500GB/mo, then $0.10/GB", troubleshoot: "Lag → check source DB load, bandwidth.\nUnsupported events → DDL changes.\nPaused → check IAM, network.", guardrails: "Allowlist tables, filter system tables, schema validation", compliance: "SOC2" } },
    { id: "gcs_land", name: "Cloud Storage", icon: "cloud_storage", subtitle: "Landing Zone", zone: "cloud", x: 760, y: 310,
      details: { project: "", region: "us-central1", encryption: "CMEK, 90-day rotation", monitoring: "Object count, new objects/hr", alerting: "No new objects in 1hr → Slack P2", cost: "$0.020/GB/mo. Delete after 90d.", guardrails: "Separate bucket per source. Versioning. VPC-SC.", compliance: "SOC2" } },
    { id: "dataflow", name: "Dataflow", icon: "dataflow", subtitle: "ETL Processor", zone: "cloud", x: 760, y: 490,
      details: { project: "", region: "us-central1", serviceAccount: "sa-dataflow@PROJECT.iam", monitoring: "Elements processed, lag, freshness", retry: "At-least-once. Dead letter table for failures.", alerting: "Lag > 120s → PagerDuty P1\nDead letters → Slack P2", cost: "Streaming $0.069/vCPU-hr. Batch FlexRS 60% off.", guardrails: "Private IPs, VPC-SC, schema validation on read", compliance: "SOC2" } },
    { id: "catalog", name: "Data Catalog", icon: "data_catalog", subtitle: "Metadata", zone: "cloud", x: 560, y: 670, details: { monitoring: "Tagged assets, policy coverage", guardrails: "Mandatory tags: classification, owner, SLA", compliance: "SOC2" } },
    { id: "bigquery", name: "BigQuery", icon: "bigquery", subtitle: "Target Warehouse", zone: "cloud", x: 970, y: 380,
      details: { project: "", region: "us-central1", encryption: "CMEK, column-level security on PII", monitoring: "Row freshness, slot utilization, streaming buffer", retry: "Streaming: retry 503. Batch: Composer retry 3x.", alerting: "Freshness > 15min → PagerDuty P2\nSlots > 80% → Slack P3", cost: "On-demand $6.25/TB. Flat-rate for predictable.", guardrails: "Authorized views, column ACL, audit all access", compliance: "SOC2, HIPAA" } },
    { id: "looker", name: "Looker", icon: "looker", subtitle: "Migration Dashboard", zone: "cloud", x: 1120, y: 280, details: { monitoring: "CDC lag dashboard, quality scores, progress", guardrails: "SSO, row-level permissions", compliance: "SOC2" } },
    { id: "cloudrun", name: "Cloud Run", icon: "cloud_run", subtitle: "Data API", zone: "cloud", x: 1120, y: 480, details: { project: "", region: "us-central1", guardrails: "Binary Auth, VPC connector", compliance: "SOC2" } },
    { id: "composer", name: "Composer", icon: "cloud_scheduler", subtitle: "Orchestrator", zone: "cloud", x: 760, y: 670, details: { monitoring: "DAG success rate", alerting: "DAG failure → PagerDuty P1", cost: "~$400/mo", compliance: "SOC2" } },
    { id: "monitoring", name: "Monitoring", icon: "cloud_monitoring", subtitle: "Observability", zone: "cloud", x: 970, y: 670, details: { monitoring: "CDC lag, freshness SLOs, throughput", alerting: "P1 → PagerDuty, P2 → Slack", compliance: "SOC2" } },
    { id: "con_dash", name: "Stakeholders", icon: null, subtitle: "Migration Tracking", zone: "consumers", x: 1320, y: 280, details: { notes: "Stakeholders tracking migration via Looker" } },
    { id: "con_api", name: "Applications", icon: null, subtitle: "Migrated Apps", zone: "consumers", x: 1320, y: 480, details: { notes: "Apps switching from AWS reads to GCP API" } },
  ],
  edges: [
    { id: "e1", from: "src_rds", to: "vpn", label: "CDC WAL Stream", subtitle: "Logical replication / TLS + VPN", step: 1, security: { transport: "IPSec + TLS", auth: "DB creds in Secret Manager", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "e2", from: "src_s3", to: "sts", label: "Historical Files", subtitle: "HTTPS / Workload Identity Federation", step: 2, security: { transport: "TLS 1.3", auth: "WIF (no keys)", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e3", from: "src_oracle", to: "interconnect", label: "Oracle CDC", subtitle: "Dedicated circuit / mTLS", step: 3, security: { transport: "Dedicated + TLS", auth: "mTLS + DB creds", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "e4", from: "vpn", to: "datastream", label: "Encrypted CDC", subtitle: "Private network / WI", step: 4, security: { transport: "Private", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e5", from: "interconnect", to: "datastream", label: "Oracle CDC", subtitle: "Private / WI", step: 5, security: { transport: "Private", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e6", from: "datastream", to: "gcs_land", label: "CDC JSON Files", subtitle: "GCS API / WI", step: 6, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e7", from: "sts", to: "gcs_land", label: "Batch Files", subtitle: "Internal / WI", step: 7, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e8", from: "gcs_land", to: "dataflow", label: "Raw for ETL", subtitle: "GCS notification / WI", step: 8, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e9", from: "dataflow", to: "bigquery", label: "Clean Records", subtitle: "BQ Storage Write / WI", step: 9, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e10", from: "bigquery", to: "looker", label: "Analytics", subtitle: "BQ API / OAuth SSO", step: 10, security: { transport: "HTTPS", auth: "OAuth SSO", classification: "internal", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e11", from: "bigquery", to: "cloudrun", label: "API Queries", subtitle: "BQ API / WI", step: 11, security: { transport: "Internal", auth: "Workload Identity", classification: "internal", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e12", from: "looker", to: "con_dash", label: "Reports", subtitle: "HTTPS / SAML SSO", step: 12, security: { transport: "TLS 1.3", auth: "SAML SSO", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e13", from: "cloudrun", to: "con_api", label: "API Responses", subtitle: "HTTPS / OAuth 2.0", step: 13, security: { transport: "TLS 1.3", auth: "OAuth 2.0", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e_comp", from: "composer", to: "dataflow", label: "Orchestrates", subtitle: "Triggers batch ETL", step: 0, crossesBoundary: false, edgeType: "control" },
  ],
  threats: [
    { id: "T1", target: "e1", stride: "T", severity: "high", title: "VPN tunnel intercept", description: "MITM on CDC stream via VPN compromise", impact: "Sensitive DB records exposed", mitigation: "IPSec + app-layer TLS. Rotate PSK quarterly. Monitor anomalies.", compliance: "SOC2" },
    { id: "T2", target: "datastream", stride: "I", severity: "high", title: "CDC data tampering", description: "Unauthorized modification in landing zone before ETL", impact: "Corrupted warehouse data", mitigation: "Object versioning. Checksum validation. Immutable bucket.", compliance: "SOC2" },
    { id: "T3", target: "e2", stride: "S", severity: "medium", title: "Cross-cloud credential theft", description: "AWS IAM credentials stolen", impact: "Unauthorized source data access", mitigation: "Workload Identity Federation (no static keys). Short-lived tokens. Audit logs.", compliance: "SOC2" },
    { id: "T4", target: "bigquery", stride: "I", severity: "high", title: "Schema drift", description: "Source DDL change breaks CDC/ETL silently", impact: "Data loss or pipeline failure", mitigation: "Schema validation in Dataflow. DDL alerts from Datastream. Catalog lineage.", compliance: "SOC2" },
  ],
};

// ═══ TEMPLATE 3: RAG / GENAI ══════════════════════
const RAG_GENAI: Diagram = {
  title: "RAG / GenAI Application",
  subtitle: "Document ingestion, embedding, vector search, and grounded generation with Vertex AI Gemini",
  nodes: [
    { id: "src_drive", name: "Google Drive", icon: null, subtitle: "Documents", zone: "sources", x: 100, y: 230, details: { notes: "Team documents, policies, knowledge base" } },
    { id: "src_conf", name: "Confluence", icon: null, subtitle: "Wiki Pages", zone: "sources", x: 100, y: 390, details: { notes: "Engineering wiki, runbooks via REST API" } },
    { id: "src_upload", name: "File Uploads", icon: null, subtitle: "User PDFs", zone: "sources", x: 100, y: 550, details: { notes: "User-uploaded PDFs, DOCX via web UI" } },
    { id: "functions", name: "Cloud Functions", icon: "cloud_functions", subtitle: "Webhook Handler", zone: "cloud", x: 350, y: 230,
      details: { project: "", region: "us-central1", serviceAccount: "sa-ingest@PROJECT.iam", monitoring: "Invocation count, error rate", retry: "3 auto retries", alerting: "Errors > 5% → Slack P2", cost: "Free 2M/mo, then $0.40/M", guardrails: "60s timeout, 256MB max", compliance: "SOC2" } },
    { id: "pubsub", name: "Pub/Sub", icon: "pubsub", subtitle: "Document Queue", zone: "cloud", x: 350, y: 390,
      details: { monitoring: "Backlog, processing rate", retry: "Dead letter after 5", alerting: "Backlog > 100 → Slack P2", cost: "$40/TB", compliance: "SOC2" } },
    { id: "docai", name: "Document AI", icon: "document_ai", subtitle: "PDF Extraction", zone: "cloud", x: 550, y: 230,
      details: { project: "", monitoring: "Pages processed, accuracy", retry: "Retry on 429/503", alerting: "Failures > 5% → Slack P2", cost: "$0.01-0.10/page", troubleshoot: "Poor extraction → try different processor.\nSlow → use async for >5 pages.", compliance: "SOC2" } },
    { id: "chunker", name: "Cloud Run", icon: "cloud_run", subtitle: "Text Chunker", zone: "cloud", x: 550, y: 390,
      details: { project: "", monitoring: "Docs processed, chunks created, avg chunk size", retry: "Pub/Sub delivery retry", alerting: "Errors > 5% → Slack P2", cost: "~$15/mo", troubleshoot: "Chunks too large → adjust splitter (512 tokens, 50 overlap).\nSlow → increase concurrency.", guardrails: "Max 512 tokens/chunk, 50 overlap. Metadata preserved.", compliance: "SOC2" } },
    { id: "dlp", name: "Cloud DLP", icon: "cloud_natural_language_api", subtitle: "PII Guard", zone: "cloud", x: 550, y: 550,
      details: { monitoring: "PII findings per query", alerting: "PII in prompt → log + strip", cost: "$1-3/GB", guardrails: "Scan input BEFORE Gemini. Strip PII from context. Never include PII in generation.", compliance: "GDPR, SOC2" } },
    { id: "embeddings", name: "Vertex AI", icon: "vertexai", subtitle: "Embeddings API", zone: "cloud", x: 750, y: 300,
      details: { project: "", monitoring: "Requests/sec, latency, tokens", retry: "Retry 429 with backoff. Batch for bulk.", alerting: "Latency > 500ms → Slack P3", cost: "text-embedding-004: $0.025/1K chars", troubleshoot: "Rate limited → reduce batch. Dimension mismatch → verify model version.", guardrails: "768 dims. Batch up to 250 texts/request.", compliance: "SOC2" } },
    { id: "vectordb", name: "Cloud SQL", icon: "cloud_sql", subtitle: "pgvector Store", zone: "cloud", x: 750, y: 480,
      details: { project: "", region: "us-central1", encryption: "CMEK, SSL required", monitoring: "Connection count, query latency, storage size", retry: "PgBouncer pooling. Auto-reconnect.", alerting: "Connections > 80% → Slack P2\nLatency > 100ms → Slack P3", cost: "db-custom-2-4096: ~$50/mo", troubleshoot: "Slow search → check HNSW index, increase ef_search.\nConnection errors → check pool, max_connections.", guardrails: "Private IP only. SSL required. IAM DB auth. Regular VACUUM.", compliance: "SOC2" } },
    { id: "orchestrator", name: "Cloud Run", icon: "cloud_run", subtitle: "RAG Orchestrator", zone: "cloud", x: 960, y: 300,
      details: { project: "", region: "us-central1", monitoring: "Query count, latency P99, retrieval quality (MRR), generation cost", retry: "Retry Gemini 503. Circuit breaker after 3.", alerting: "P99 > 5s → PagerDuty P2\nGemini errors > 5% → PagerDuty P1\nCost/query > $0.10 → Slack P3", cost: "Cloud Run ~$30/mo + Gemini ~$0.005/query", troubleshoot: "Bad answers → check retrieval quality, tune top_k.\nSlow → cache frequent queries.\nHigh cost → reduce max_tokens.", guardrails: "Max 10 chunks/query. Max 1000 output tokens. System prompt isolated. Grounding verification.", compliance: "SOC2" } },
    { id: "gemini", name: "Gemini", icon: "vertexai", subtitle: "LLM Generation", zone: "cloud", x: 960, y: 480,
      details: { project: "", monitoring: "Tokens in/out, latency, safety triggers, grounding score", retry: "Retry 503/429. Fallback to cache.", alerting: "Safety filter > 5% → review prompts\nCost > budget → throttle", cost: "Flash: $0.075/1M in, $0.30/1M out. Pro: 7x more.", troubleshoot: "Bad answers → improve prompt, add few-shot.\nHallucination → enable grounding, add citations.\nSlow → use Flash, reduce context.", guardrails: "Injection protection. Safety filters. Grounding with citations. Temperature 0.1 factual.", compliance: "SOC2" } },
    { id: "cache", name: "Memorystore", icon: "memorystore", subtitle: "Response Cache", zone: "cloud", x: 1120, y: 400,
      details: { cost: "Redis 1GB ~$35/mo. >30% hit rate = net savings.", guardrails: "Cache key = embedding similarity >0.95. TTL 1hr factual, 15min dynamic.", compliance: "SOC2" } },
    { id: "firebase", name: "Identity Platform", icon: "identity_platform", subtitle: "User Auth", zone: "cloud", x: 1120, y: 230, details: { monitoring: "Auth success rate, active users", guardrails: "MFA for admin. Rate limit logins. TTL 4hr.", compliance: "SOC2" } },
    { id: "monitoring", name: "Monitoring", icon: "cloud_monitoring", subtitle: "Observability", zone: "cloud", x: 600, y: 670, details: { monitoring: "Retrieval quality, latency, token cost, user satisfaction", alerting: "P1 → PagerDuty, P2 → Slack", compliance: "SOC2" } },
    { id: "logging", name: "Cloud Logging", icon: "cloud_logging", subtitle: "Prompt Audit", zone: "cloud", x: 860, y: 670, details: { monitoring: "Every prompt + response logged", guardrails: "Redact PII before logging. Locked retention.", compliance: "SOC2" } },
    { id: "con_users", name: "End Users", icon: null, subtitle: "Chat Interface", zone: "consumers", x: 1320, y: 370, details: { notes: "Users via React UI with streaming responses" } },
  ],
  edges: [
    { id: "e1", from: "src_drive", to: "functions", label: "Doc Change Events", subtitle: "Drive webhook / OAuth 2.0", step: 1, security: { transport: "TLS 1.3", auth: "OAuth 2.0", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e2", from: "src_conf", to: "functions", label: "Page Updates", subtitle: "REST API / Token", step: 2, security: { transport: "TLS 1.3", auth: "API Token", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e3", from: "src_upload", to: "pubsub", label: "Uploaded Files", subtitle: "HTTPS / Firebase Auth", step: 3, security: { transport: "TLS 1.3", auth: "Firebase JWT", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e4", from: "functions", to: "pubsub", label: "Doc Events", subtitle: "Internal / WI", step: 4, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e5", from: "pubsub", to: "docai", label: "PDFs", subtitle: "Push sub / WI", step: 5, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e6", from: "pubsub", to: "chunker", label: "Text Docs", subtitle: "Push sub / WI", step: 6, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e7", from: "docai", to: "chunker", label: "Extracted Text", subtitle: "Internal / WI", step: 7, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e8", from: "chunker", to: "embeddings", label: "Text Chunks", subtitle: "Vertex API / WI", step: 8, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e9", from: "embeddings", to: "vectordb", label: "Vectors", subtitle: "PostgreSQL / IAM DB auth", step: 9, security: { transport: "SSL", auth: "IAM DB auth", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e10", from: "orchestrator", to: "vectordb", label: "Search", subtitle: "SQL / IAM DB auth", step: 10, security: { transport: "SSL", auth: "IAM DB auth", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e11", from: "orchestrator", to: "gemini", label: "Context + Query", subtitle: "Vertex API / WI", step: 11, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, crossesBoundary: false, edgeType: "data" },
    { id: "e12", from: "orchestrator", to: "con_users", label: "Streamed Response", subtitle: "HTTPS SSE / Firebase Auth", step: 12, security: { transport: "TLS 1.3", auth: "Firebase JWT", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "e_dlp", from: "dlp", to: "orchestrator", label: "PII Scan", subtitle: "Scans input before generation", step: 0, crossesBoundary: false, edgeType: "control" },
  ],
  threats: [
    { id: "T1", target: "orchestrator", stride: "T", severity: "critical", title: "Prompt injection", description: "Malicious input overrides system prompt", impact: "LLM leaks system prompt or internal data", mitigation: "Separate system/user prompts. Injection classifier. Output filtering.", compliance: "SOC2" },
    { id: "T2", target: "e3", stride: "I", severity: "high", title: "Malicious doc upload", description: "Adversarial content poisons knowledge base", impact: "Incorrect/harmful answers", mitigation: "Malware scan. Content moderation. Source attribution.", compliance: "SOC2" },
    { id: "T3", target: "gemini", stride: "I", severity: "high", title: "Hallucination", description: "Gemini generates factually incorrect info", impact: "Users act on wrong info", mitigation: "Grounding + citations. Confidence scoring. 'I don't know' fallback.", compliance: "SOC2" },
    { id: "T4", target: "vectordb", stride: "I", severity: "medium", title: "Stale embeddings", description: "Source updated but embeddings not regenerated", impact: "Outdated answers", mitigation: "Webhook re-indexing. Daily freshness check. Timestamp in metadata.", compliance: "SOC2" },
  ],
};

// ═══ TEMPLATE REGISTRY ════════════════════════════
export const TEMPLATES: Template[] = [
  { id: "streaming-analytics", name: "Streaming Analytics", icon: "📊", description: "Real-time event processing with Pub/Sub, Dataflow, and BigQuery",
    tags: ["streaming", "stream", "real-time", "realtime", "real time", "event", "events", "pub/sub", "pubsub", "dataflow", "analytics", "clickstream", "iot", "sensor", "event-driven", "event driven", "kafka", "stream processing", "pipeline", "ingest", "ingestion"],
    diagram: STREAMING },
  { id: "cdc-migration", name: "CDC Migration", icon: "🔄", description: "Cross-cloud CDC replication from AWS/Oracle to GCP BigQuery",
    tags: ["cdc", "migration", "migrate", "replicate", "replication", "datastream", "aws to gcp", "aws", "cross-cloud", "cross cloud", "rds", "oracle", "mysql", "postgresql", "postgres", "database migration", "data migration", "hybrid", "vpn", "interconnect", "transfer"],
    diagram: CDC_MIGRATION },
  { id: "rag-genai", name: "RAG / GenAI", icon: "🤖", description: "Document RAG chatbot with Vertex AI Gemini and vector search",
    tags: ["rag", "genai", "gen ai", "generative", "chatbot", "chat bot", "assistant", "copilot", "llm", "gemini", "openai", "gpt", "embedding", "embeddings", "vector", "vector search", "pgvector", "document", "knowledge base", "ai assistant", "conversational", "question answering", "qa"],
    diagram: RAG_GENAI },
];
