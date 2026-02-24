// ═══ TEMPLATE LIBRARY + KEYWORD MATCHING ENGINE ═══

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
  // Require at least 3 distinct tag matches AND score >= 12 to use a template
  // Otherwise fall through to LLM for custom generation
  return (bestScore >= 12 && bestHits >= 3) ? best : null;
}

// ═══ TEMPLATE 1: STREAMING ANALYTICS (DIAMOND LAYOUT) ══════════════
const STREAMING: Diagram = {
  title: "Enterprise Streaming Analytics Platform",
  subtitle: "Production-ready real-time event processing with security, governance, and disaster recovery",

  phases: [
    { id: "security", name: "Security Perimeter", nodeIds: ["cloud_armor", "iam", "kms"] },
    { id: "ingest", name: "Ingestion", nodeIds: ["apigee", "pubsub"] },
    { id: "process", name: "Processing", nodeIds: ["dataflow", "dlp"] },
    { id: "storage", name: "Storage", nodeIds: ["gcs", "bigquery"] },
    { id: "serve", name: "Serving", nodeIds: ["looker", "cloudrun"] },
  ],
  opsGroup: { name: "Operations", nodeIds: ["composer", "monitoring", "logging"] },

  nodes: [
    // ── SOURCES (Left edge, x=100) ──
    { id: "src_mobile", name: "Mobile Apps", icon: "external_users", subtitle: "User Events", zone: "sources", x: 100, y: 250, 
      details: { notes: "iOS/Android applications sending clickstream and user behavior events" } },
    { id: "src_web", name: "Web Apps", icon: "external_users", subtitle: "Business Events", zone: "sources", x: 100, y: 350, 
      details: { notes: "Web applications producing business events via REST APIs" } },
    { id: "src_iot", name: "IoT Devices", icon: "webhook", subtitle: "Sensor Data", zone: "sources", x: 100, y: 450, 
      details: { notes: "Edge devices and sensors transmitting telemetry data" } },

    // ── PHASE 1: SECURITY PERIMETER (x=280) ──
    { id: "cloud_armor", name: "Cloud Armor", icon: "cloud_armor", subtitle: "WAF & DDoS", zone: "cloud", x: 280, y: 180,
      details: { 
        project: "streaming-platform", 
        region: "global", 
        encryption: "TLS 1.3 termination at edge", 
        monitoring: "Blocked requests by rule type, DDoS attack events, rule effectiveness metrics", 
        alerting: "DDoS attack detected → Security P1\nBlocked requests > 10K/min → Security P2", 
        cost: "$5/security policy/mo + $1/million requests processed", 
        guardrails: "OWASP Top 10 protection rules, rate limiting per client IP, geo-blocking for high-risk regions", 
        compliance: "SOC2, PCI DSS" 
      } 
    },
    { id: "iam", name: "IAM", icon: "identity_and_access_management", subtitle: "Identity & Access", zone: "cloud", x: 280, y: 350,
      details: { 
        project: "streaming-platform", 
        monitoring: "Failed authentication attempts, unusual role bindings, privilege escalation attempts", 
        alerting: "Admin role binding created → Security P1\nFailed auth > 100/hr → Security P2", 
        cost: "Free service", 
        guardrails: "No basic roles, Workload Identity Federation only, least privilege access patterns", 
        compliance: "SOC2, ISO27001" 
      } 
    },
    { id: "kms", name: "KMS", icon: "key_management_service", subtitle: "Encryption Keys", zone: "cloud", x: 280, y: 520,
      details: { 
        project: "streaming-platform", 
        region: "us-central1", 
        encryption: "HSM-backed keys with 90-day automatic rotation", 
        monitoring: "Key usage patterns, rotation compliance status", 
        alerting: "Key rotation overdue → Security P1\nUnauthorized key access → Security P1", 
        cost: "$0.06/key version/month + $0.03/10K crypto operations", 
        guardrails: "Hardware security modules, automatic key rotation, separation of duties", 
        compliance: "SOC2, PCI DSS, FIPS 140-2 Level 3" 
      } 
    },

    // ── PHASE 2: INGESTION (x=460) ──
    { id: "apigee", name: "Apigee", icon: "apigee_api_platform", subtitle: "API Management", zone: "cloud", x: 460, y: 250,
      details: { 
        project: "streaming-platform", 
        region: "us-central1", 
        encryption: "TLS 1.3 termination, mTLS to backend services", 
        monitoring: "API latency P50/P99, error rate by status code, quota consumption per developer", 
        alerting: "Error rate > 5% → PagerDuty P2\nLatency P99 > 500ms → Slack P2", 
        cost: "$3/million API calls + $1000/month platform fee", 
        guardrails: "OAuth 2.0 + API key authentication, per-client rate limiting, circuit breaker patterns", 
        compliance: "SOC2, PCI DSS" 
      } 
    },
    { id: "pubsub", name: "Pub/Sub", icon: "pubsub", subtitle: "Message Queue", zone: "cloud", x: 460, y: 450,
      details: { 
        project: "streaming-platform", 
        region: "us-central1", 
        encryption: "CMEK encryption at rest and in transit", 
        monitoring: "Message backlog depth, publish/pull rates, dead letter queue size", 
        alerting: "Message backlog > 5 minutes → Slack P2\nDead letter queue depth > 0 → PagerDuty P1", 
        cost: "$40/TB for message ingestion + $40/TB for message delivery", 
        guardrails: "Schema Registry enforcement, exactly-once delivery semantics, message ordering by key", 
        compliance: "SOC2, HIPAA, GDPR" 
      } 
    },

    // ── PHASE 3: PROCESSING (x=640) ──
    { id: "dataflow", name: "Dataflow", icon: "dataflow", subtitle: "Stream Processing", zone: "cloud", x: 640, y: 300,
      details: { 
        project: "streaming-platform", 
        region: "us-central1", 
        encryption: "CMEK encryption for all temporary storage and pipeline state", 
        monitoring: "System lag metrics, elements processed per second, worker autoscaling events", 
        alerting: "System lag > 60 seconds → PagerDuty P1\nProcessing errors > 10/min → Slack P2", 
        cost: "$0.069/vCPU-hour for streaming workloads + $0.011/GB memory", 
        guardrails: "Private IP workers only, VPC Service Controls enforced, Workload Identity Federation", 
        compliance: "SOC2, HIPAA, GDPR" 
      } 
    },
    { id: "dlp", name: "DLP", icon: "cloud_natural_language_api", subtitle: "Data Loss Prevention", zone: "cloud", x: 640, y: 450,
      details: { 
        project: "streaming-platform", 
        encryption: "Data processed in-memory only, no persistent storage of content", 
        monitoring: "PII findings by information type, scan latency, false positive rates", 
        alerting: "High-risk PII detected (SSN, credit cards) → PagerDuty P1", 
        cost: "$1-3/GB scanned (use sampling strategies to optimize costs)", 
        guardrails: "Scan all data streams before storage, automatic de-identification for analytics", 
        compliance: "HIPAA, GDPR, CCPA, SOC2" 
      } 
    },

    // ── PHASE 4: STORAGE (x=820) ──
    { id: "gcs", name: "Cloud Storage", icon: "cloud_storage", subtitle: "Data Lake", zone: "cloud", x: 820, y: 250,
      details: { 
        project: "streaming-platform", 
        region: "us-central1", 
        encryption: "CMEK with 90-day automatic key rotation", 
        monitoring: "Total storage size, access patterns, lifecycle policy effectiveness", 
        alerting: "Unexpected access patterns → Security P1\nStorage costs > budget → Finance P2", 
        cost: "$0.020/GB/month standard storage + automated lifecycle policies", 
        guardrails: "Bucket Lock for retention compliance, object versioning, VPC Service Controls", 
        compliance: "SOC2, HIPAA, GDPR" 
      } 
    },
    { id: "bigquery", name: "BigQuery", icon: "bigquery", subtitle: "Data Warehouse", zone: "cloud", x: 820, y: 450,
      details: { 
        project: "streaming-platform", 
        region: "us-central1", 
        encryption: "CMEK encryption with column-level access controls", 
        monitoring: "Query performance metrics, slot utilization, data freshness SLAs", 
        alerting: "Query costs > $500/day → Finance P2\nData freshness > 4 hours → Data Engineering P2", 
        cost: "$5/TB active storage + $6.25/TB query processing", 
        guardrails: "Row-level security policies, authorized views only, comprehensive audit logging", 
        compliance: "SOC2, HIPAA, GDPR, PCI DSS" 
      } 
    },

    // ── PHASE 5: SERVING (x=1000) ──
    { id: "looker", name: "Looker", icon: "looker", subtitle: "Business Intelligence", zone: "cloud", x: 1000, y: 250,
      details: { 
        encryption: "TLS 1.3 in transit, SSO integration with MFA", 
        monitoring: "Dashboard load times, user session activity, cache hit ratios", 
        alerting: "Dashboard load time > 10 seconds → UX P2\nLogin failures > 5% → Security P2", 
        cost: "$3000/month platform license + $25/user/month", 
        guardrails: "SSO via SAML/OIDC, row-level security enforcement, embedded analytics capabilities", 
        compliance: "SOC2, HIPAA, GDPR" 
      } 
    },
    { id: "cloudrun", name: "Cloud Run", icon: "cloud_run", subtitle: "API Services", zone: "cloud", x: 1000, y: 450,
      details: { 
        project: "streaming-platform", 
        region: "us-central1", 
        encryption: "TLS termination with encrypted connections to data sources", 
        monitoring: "Request latency P50/P99, error rates, cold start frequency", 
        alerting: "5xx error rate > 1% → PagerDuty P1\nP99 latency > 2 seconds → Slack P2", 
        cost: "Pay-per-request pricing with minimum instances for warm starts", 
        guardrails: "Binary Authorization for container security, VPC connector for private networking", 
        compliance: "SOC2, HIPAA, GDPR" 
      } 
    },

    // ── OPERATIONS (Bottom row, y=600) ──
    { id: "composer", name: "Composer", icon: "cloud_composer", subtitle: "Orchestration", zone: "cloud", x: 460, y: 600,
      details: { 
        project: "streaming-platform", 
        region: "us-central1", 
        encryption: "Private IP GKE cluster with CMEK-encrypted persistent disks", 
        monitoring: "DAG success rates, task duration, scheduler heartbeat, worker resource utilization", 
        alerting: "DAG failure → PagerDuty P1\nSLA breach (>4hr delay) → PagerDuty P2", 
        cost: "Small environment ~$400/month + compute costs for workers", 
        guardrails: "Private IP cluster only, Secret Manager integration, RBAC policies", 
        compliance: "SOC2, HIPAA, GDPR" 
      } 
    },
    { id: "monitoring", name: "Monitoring", icon: "cloud_monitoring", subtitle: "Observability", zone: "cloud", x: 640, y: 600,
      details: { 
        project: "streaming-platform", 
        region: "global", 
        monitoring: "SLI/SLO compliance rates, alert fatigue metrics, dashboard usage statistics", 
        alerting: "SLO burn rate exceeds threshold → PagerDuty P1/P2 based on severity", 
        cost: "Free for Google Cloud metrics, custom metrics $0.258/metric/month", 
        guardrails: "SLO-based alerting strategy, runbook documentation for all P1 alerts", 
        compliance: "SOC2" 
      } 
    },
    { id: "logging", name: "Logging", icon: "cloud_logging", subtitle: "Audit Logs", zone: "cloud", x: 820, y: 600,
      details: { 
        project: "streaming-platform", 
        region: "global", 
        encryption: "Google-managed encryption with customer-managed log sinks", 
        monitoring: "Log ingestion volume per day, audit log completeness, sink health status", 
        alerting: "Unexpected admin actions → Security P1\nLog volume spike > 5x → Operations P2", 
        cost: "$0.50/GiB ingested after 50GiB free per month", 
        guardrails: "Organization-level log sinks, 7-year retention for compliance data", 
        compliance: "SOC2, HIPAA, GDPR, PCI DSS" 
      } 
    },

    // ── CONSUMERS (Right edge, x=1180) ──
    { id: "con_analysts", name: "Analysts", icon: "analyst", subtitle: "Dashboard Users", zone: "consumers", x: 1180, y: 250, 
      details: { notes: "Business analysts accessing Looker dashboards via SSO with MFA" } },
    { id: "con_apps", name: "Applications", icon: "rest_api", subtitle: "API Consumers", zone: "consumers", x: 1180, y: 350, 
      details: { notes: "Downstream applications consuming data via Cloud Run APIs with OAuth 2.0" } },
    { id: "con_engineers", name: "Engineers", icon: "developer", subtitle: "Platform Ops", zone: "consumers", x: 1180, y: 450, 
      details: { notes: "Data engineers managing pipelines via Composer UI and monitoring dashboards" } },

    // ── ALERT DESTINATIONS ──
    { id: "pagerduty", name: "PagerDuty", icon: "pagerduty", subtitle: "P1 Incidents", zone: "consumers", x: 1180, y: 100, 
      details: { notes: "Critical alerts: pipeline failures, security incidents, service outages" } },
    { id: "slack", name: "Slack", icon: "slack", subtitle: "P2 Alerts", zone: "consumers", x: 1180, y: 550, 
      details: { notes: "Performance degradation warnings, capacity alerts, data quality issues" } },
  ],

  edges: [
    // ── DATA FLOW (numbered sequence) ──
    { id: "flow1", from: "src_mobile", to: "cloud_armor", label: "HTTPS", step: 1, security: { transport: "TLS 1.3", auth: "OAuth 2.0", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "flow2", from: "src_web", to: "cloud_armor", label: "HTTPS", step: 1, security: { transport: "TLS 1.3", auth: "OAuth 2.0", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "flow3", from: "src_iot", to: "cloud_armor", label: "MQTT/TLS", step: 1, security: { transport: "TLS 1.2", auth: "X.509 cert", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    
    { id: "flow4", from: "cloud_armor", to: "apigee", label: "Filtered", step: 2, security: { transport: "Internal", auth: "Google-managed", classification: "confidential", private: true }, edgeType: "data" },
    { id: "flow5", from: "apigee", to: "pubsub", label: "Validated", step: 3, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "flow6", from: "pubsub", to: "dataflow", label: "Stream", step: 4, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    
    { id: "flow7", from: "dataflow", to: "gcs", label: "Archive", step: 5, security: { transport: "Internal", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    { id: "flow8", from: "dataflow", to: "bigquery", label: "Process", step: 5, security: { transport: "Internal gRPC", auth: "Workload Identity", classification: "confidential", private: true }, edgeType: "data" },
    
    { id: "flow9", from: "bigquery", to: "looker", label: "Query", step: 6, security: { transport: "HTTPS", auth: "OAuth 2.0", classification: "internal", private: true }, edgeType: "data" },
    { id: "flow10", from: "bigquery", to: "cloudrun", label: "API", step: 6, security: { transport: "Internal", auth: "Workload Identity", classification: "internal", private: true }, edgeType: "data" },
    
    { id: "flow11", from: "looker", to: "con_analysts", label: "Dashboards", step: 7, security: { transport: "TLS 1.3", auth: "SAML SSO", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "flow12", from: "cloudrun", to: "con_apps", label: "JSON API", step: 7, security: { transport: "TLS 1.3", auth: "OAuth 2.0", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },

    // ── SECURITY CONTROLS ──
    { id: "sec1", from: "iam", to: "apigee", label: "Auth", step: 0, security: { transport: "Internal", auth: "IAM", classification: "restricted", private: true }, edgeType: "control" },
    { id: "sec2", from: "kms", to: "pubsub", label: "Encrypt", step: 0, security: { transport: "Internal", auth: "Workload Identity", classification: "restricted", private: true }, edgeType: "control" },
    { id: "sec3", from: "dlp", to: "dataflow", label: "PII Scan", step: 0, security: { transport: "Internal", auth: "Workload Identity", classification: "restricted", private: true }, edgeType: "control" },

    // ── OPERATIONS ──
    { id: "ops1", from: "composer", to: "dataflow", label: "Orchestrate", step: 0, security: { transport: "Internal", auth: "Workload Identity", classification: "control", private: true }, edgeType: "control" },
    { id: "ops2", from: "monitoring", to: "pagerduty", label: "P1 Alerts", step: 0, security: { transport: "HTTPS webhook", auth: "API Key", classification: "alert", private: false }, crossesBoundary: true, edgeType: "alert" },
    { id: "ops3", from: "monitoring", to: "slack", label: "P2 Alerts", step: 0, security: { transport: "HTTPS webhook", auth: "Bot Token", classification: "alert", private: false }, crossesBoundary: true, edgeType: "alert" },
    
    // ── OBSERVABILITY ──
    { id: "obs1", from: "monitoring", to: "apigee", label: "Metrics", step: 0, security: { transport: "Internal", auth: "Workload Identity", classification: "telemetry", private: true }, edgeType: "observe" },
    { id: "obs2", from: "monitoring", to: "dataflow", label: "Metrics", step: 0, security: { transport: "Internal", auth: "Workload Identity", classification: "telemetry", private: true }, edgeType: "observe" },
    { id: "obs3", from: "logging", to: "gcs", label: "Archive", step: 0, security: { transport: "Internal", auth: "Workload Identity", classification: "audit", private: true }, edgeType: "data" },
  ],

  threats: [
    { id: "T1", target: "flow1", stride: "S", severity: "high", title: "API credential theft", description: "OAuth tokens stolen from mobile app", impact: "Unauthorized data injection", mitigation: "Short-lived tokens, device attestation, anomaly detection", compliance: "SOC2" },
    { id: "T2", target: "cloud_armor", stride: "D", severity: "medium", title: "DDoS amplification", description: "Attacker overwhelms WAF with requests", impact: "Service unavailability", mitigation: "Rate limiting, geographic blocking, auto-scaling", compliance: "SOC2" },
    { id: "T3", target: "pubsub", stride: "T", severity: "high", title: "Message tampering", description: "Malicious messages injected into queue", impact: "Data corruption downstream", mitigation: "Message signing, schema validation, DLP scanning", compliance: "SOC2" },
    { id: "T4", target: "bigquery", stride: "I", severity: "critical", title: "Data exfiltration", description: "Over-privileged access to sensitive columns", impact: "PII leak, compliance violation", mitigation: "Column-level security, authorized views, audit logging", compliance: "SOC2, HIPAA, GDPR" },
    { id: "T5", target: "flow11", stride: "S", severity: "medium", title: "Session hijacking", description: "SSO session stolen via XSS", impact: "Unauthorized dashboard access", mitigation: "CSP headers, SameSite cookies, MFA", compliance: "SOC2" },
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
    { id: "src_rds", name: "AWS RDS", icon: "aws_rds", subtitle: "PostgreSQL", zone: "sources", x: 100, y: 250, details: { notes: "Logical replication enabled (wal_level=logical)" } },
    { id: "src_s3", name: "AWS S3", icon: "aws_s3", subtitle: "Historical Files", zone: "sources", x: 750, y: 400, details: { notes: "CSV/Parquet batch backfill exports" } },
    { id: "src_oracle", name: "On-Prem Oracle", icon: "oracle", subtitle: "Legacy DB", zone: "sources", x: 750, y: 200, details: { notes: "Oracle 12c+ with LogMiner for CDC" } },
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
    { id: "composer", name: "Composer", icon: "cloud_composer", subtitle: "Orchestrator", zone: "cloud", x: 450, y: 720, details: { alerting: "DAG failure → PagerDuty P1", cost: "~$400/mo", compliance: "SOC2" } },
    { id: "catalog", name: "Data Catalog", icon: "data_catalog", subtitle: "Metadata & Lineage", zone: "cloud", x: 660, y: 720, details: { guardrails: "Mandatory tags: owner, classification, SLA", compliance: "SOC2" } },
    { id: "monitoring", name: "Monitoring", icon: "cloud_monitoring", subtitle: "Observability", zone: "cloud", x: 870, y: 720, details: { monitoring: "CDC lag, freshness SLOs, throughput", compliance: "SOC2" } },
    { id: "con_dash", name: "Stakeholders", icon: "analyst", subtitle: "Migration Tracking", zone: "consumers", x: 1230, y: 300, details: { notes: "Project stakeholders via Looker" } },
    { id: "con_api", name: "Applications", icon: "rest_api", subtitle: "Migrated Apps", zone: "consumers", x: 1230, y: 460, details: { notes: "Apps switching to GCP API" } },
    { id: "pagerduty", name: "PagerDuty", icon: "pagerduty", subtitle: "P1 Incidents", zone: "consumers", x: 1230, y: 650, details: { notes: "Critical: pipeline down" } },
    { id: "slack", name: "Slack", icon: "slack", subtitle: "P2 Alerts", zone: "consumers", x: 1230, y: 760, details: { notes: "Degraded performance" } },
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
    { id: "c2", from: "cloudrun", to: "con_api", label: "JSON API", step: 10, security: { transport: "TLS 1.3", auth: "OAuth Bearer", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "op1", from: "composer", to: "dataflow", label: "Orchestrate", step: 0, edgeType: "control" },
    { id: "op2", from: "composer", to: "bigquery", label: "Schedule ETL", step: 0, edgeType: "control" },
    { id: "a1", from: "monitoring", to: "pagerduty", label: "P1 Incidents", step: 0, edgeType: "alert" },
    { id: "a2", from: "monitoring", to: "slack", label: "P2 Alerts", step: 0, edgeType: "alert" },
  ],
  threats: [
    { id: "T1", target: "s1", stride: "S", severity: "high", title: "VPN credential compromise", description: "Stolen VPN certs allow tunnel access", impact: "Unauthorized data access", mitigation: "Certificate rotation, IP allowlisting, monitoring", compliance: "SOC2" },
    { id: "T2", target: "datastream", stride: "D", severity: "medium", title: "CDC lag spike", description: "Source DB overload causes lag", impact: "Stale data in BQ", mitigation: "Source DB monitoring, connection pooling", compliance: "SOC2" },
    { id: "T3", target: "bigquery", stride: "I", severity: "high", title: "Over-permissive access", description: "Migration team has broad access", impact: "Data leak during migration", mitigation: "Temporary access, column-level perms", compliance: "SOC2, HIPAA" },
  ],
};

// ═══ TEMPLATE 3: RAG / GENAI ══════════════════════
const RAG_GENAI: Diagram = {
  title: "RAG / GenAI Application",
  subtitle: "Document ingestion, embedding, vector search, and grounded generation with Vertex AI Gemini",
  phases: [
    { id: "ingest", name: "Phase 1: Ingest & Index", nodeIds: ["functions", "pubsub", "chunker", "embeddings", "vectordb"] },
    { id: "search", name: "Phase 2: Search & Generate", nodeIds: ["orchestrator", "cache", "firebase", "gemini"] },
  ],
  opsGroup: { name: "Operations", nodeIds: ["monitoring", "logging"] },
  nodes: [
    { id: "src_drive", name: "Google Drive", icon: "external_users", subtitle: "Documents", zone: "sources", x: 100, y: 200, details: { notes: "Company documents: policies, procedures, knowledge base articles" } },
    { id: "src_conf", name: "Confluence", icon: "atlassian", subtitle: "Wiki Pages", zone: "sources", x: 100, y: 370, details: { notes: "Atlassian Confluence wiki and documentation pages" } },
    { id: "src_upload", name: "File Uploads", icon: "sftp_server", subtitle: "User PDFs", zone: "sources", x: 100, y: 520, details: { notes: "Direct file uploads by users via web interface" } },
    { id: "functions", name: "Cloud Functions", icon: "cloud_functions", subtitle: "Webhook Handler", zone: "cloud", x: 340, y: 280,
      details: { monitoring: "Invocation count, errors, duration", cost: "Pay per invocation ~$0.0000004/invocation", compliance: "SOC2" } },
    { id: "pubsub", name: "Pub/Sub", icon: "pubsub", subtitle: "Event Queue", zone: "cloud", x: 340, y: 420,
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
    { id: "con_users", name: "End Users", icon: "external_users", subtitle: "Chat Interface", zone: "consumers", x: 1230, y: 420, details: { notes: "React UI with streaming" } },
    { id: "pagerduty", name: "PagerDuty", icon: "pagerduty", subtitle: "P1 Incidents", zone: "consumers", x: 1230, y: 620, details: { notes: "Critical: Gemini down" } },
    { id: "slack", name: "Slack", icon: "slack", subtitle: "P2 Alerts", zone: "consumers", x: 1230, y: 740, details: { notes: "Quality degradation" } },
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

// ═══ TEMPLATE 4: ENTERPRISE DATA ANALYTICS BLUEPRINT (CAPABILITY MAP v9) ══════════════
const BLUEPRINT: Diagram = {
  title: "Enterprise Data Analytics Platform",
  subtitle: "Platform Agnostic · 8 Layers · 4 Pillars · 42 Capabilities",
  layout: "blueprint",

  phases: [
    { id: "connectivity", name: "Layer 2: Connectivity & Access", nodeIds: ["conn_vpn","conn_peer","conn_fw","conn_auth","conn_sa","conn_secrets","conn_mtls","conn_rate"] },
    { id: "ingestion", name: "Layer 3: Ingestion", nodeIds: ["ing_batch","ing_cdc","ing_stream","ing_file","ing_api"] },
    { id: "datalake", name: "Layer 4: Data Lake", nodeIds: ["lake_object","lake_relational"] },
    { id: "processing", name: "Layer 5: Processing & Transformation", nodeIds: ["proc_elt","proc_stream","proc_quality","proc_enrich","proc_pii"] },
    { id: "medallion", name: "Layer 6: Medallion Architecture", nodeIds: ["bronze","silver","gold"] },
    { id: "serving", name: "Layer 7: Serving & Delivery", nodeIds: ["serve_semantic","serve_api","serve_market","serve_retl"] },
  ],
  opsGroup: { name: "Crosscutting Pillars", nodeIds: ["pillar_sec","pillar_gov","pillar_obs","pillar_orch"] },

  nodes: [
    // ── SOURCES (Layer 1 — external) ──
    { id: "src_rdb", name: "Relational DB", icon: null, subtitle: "Oracle · PG · MySQL · SQL Server", zone: "sources", x: 100, y: 100, details: { notes: "On-premise and cloud-hosted relational databases.\nTypical ingestion: batch extract or CDC replication.\nRequires: JDBC drivers, service accounts, network access." } },
    { id: "src_nosql", name: "NoSQL", icon: null, subtitle: "Mongo · Dynamo · Cassandra", zone: "sources", x: 250, y: 100, details: { notes: "Document, key-value, wide-column stores.\nTypical ingestion: API-based export, change streams." } },
    { id: "src_saas", name: "SaaS / CRM", icon: null, subtitle: "Salesforce · SAP · Workday", zone: "sources", x: 400, y: 100, details: { notes: "Cloud SaaS platforms with API-based extraction.\nRequires: OAuth, rate-limit handling, incremental sync." } },
    { id: "src_files", name: "Files / SFTP", icon: null, subtitle: "CSV · Parquet · Excel", zone: "sources", x: 550, y: 100, details: { notes: "Batch file drops from partners, vendors, or internal systems.\nLanding zone pattern with schema validation on arrival." } },
    { id: "src_apis", name: "APIs", icon: null, subtitle: "REST · GraphQL · webhooks", zone: "sources", x: 700, y: 100, details: { notes: "External and internal APIs providing structured data.\nIncludes: social media, ads, SaaS webhooks, partner feeds." } },
    { id: "src_stream", name: "Event Streams", icon: null, subtitle: "Kafka · IoT · clickstream", zone: "sources", x: 850, y: 100, details: { notes: "High-volume real-time event producers.\nRequires: backpressure handling, exactly-once semantics." } },
    { id: "src_unstructured", name: "Unstructured", icon: null, subtitle: "PDFs · images · audio · email", zone: "sources", x: 1000, y: 100, details: { notes: "Unstructured content requiring OCR, NLP, or ML processing." } },
    { id: "src_legacy", name: "Legacy", icon: null, subtitle: "COBOL · MQ · flat files", zone: "sources", x: 1150, y: 100, details: { notes: "Legacy systems with limited connectivity.\nRequires: custom connectors, file-based integration, MQ bridging." } },

    // ── CONNECTIVITY (Layer 2 — handshake / trust boundary) ──
    { id: "conn_vpn", name: "VPN / Private Link", icon: null, subtitle: "Secure network tunnels", zone: "connectivity", x: 100, y: 250, details: { notes: "Site-to-site VPN or cloud Private Link for secure connectivity.\nSupports: IPsec, WireGuard, AWS PrivateLink, Azure Private Endpoint, GCP Private Service Connect." } },
    { id: "conn_peer", name: "Network Peering", icon: null, subtitle: "VPC / VNET cross-connect", zone: "connectivity", x: 250, y: 250, details: { notes: "Direct cloud network peering for low-latency source access.\nSupports: VPC peering, Transit Gateway, Azure VNET peering." } },
    { id: "conn_fw", name: "Firewall Rules", icon: null, subtitle: "IP allowlist, port control", zone: "connectivity", x: 400, y: 250, details: { notes: "Network-level access control for all source connections.\nCapabilities: IP allowlisting, port-level rules, egress filtering, WAF." } },
    { id: "conn_auth", name: "Authentication", icon: null, subtitle: "OAuth · SAML · API keys", zone: "connectivity", x: 550, y: 250, details: { notes: "Identity verification for source system access.\nSupports: OAuth 2.0, SAML SSO, API key management, LDAP, token exchange." } },
    { id: "conn_sa", name: "Service Accounts", icon: null, subtitle: "Workload identity, IAM bindings", zone: "connectivity", x: 700, y: 250, details: { notes: "Machine-to-machine auth for automated pipelines.\nSupports: Workload Identity Federation, managed service accounts." } },
    { id: "conn_secrets", name: "Secrets Manager", icon: null, subtitle: "Vault · rotation · no plaintext", zone: "connectivity", x: 850, y: 250, details: { notes: "External credential storage for source system passwords, tokens, keys.\nCapabilities: automatic rotation, audit logging, dynamic secrets." } },
    { id: "conn_mtls", name: "mTLS / Certificates", icon: null, subtitle: "Mutual auth, cert rotation", zone: "connectivity", x: 1000, y: 250, details: { notes: "Certificate-based mutual authentication for high-security connections.\nSupports: X.509 certs, auto-rotation, CA management." } },
    { id: "conn_rate", name: "Rate Limiting", icon: null, subtitle: "Throttle, backoff, quotas", zone: "connectivity", x: 1150, y: 250, details: { notes: "Protect source systems from overload during extraction.\nCapabilities: configurable rate limits, exponential backoff, circuit breakers." } },

    // ── INGESTION (Layer 3) ──
    { id: "ing_batch", name: "Batch Pull", icon: null, subtitle: "Scheduled extract", zone: "cloud", x: 100, y: 400, details: { notes: "Scheduled full or incremental extracts.\nPatterns: Full refresh, incremental watermark, snapshot diff.\nSupports: JDBC pull, API pagination, bulk export." } },
    { id: "ing_cdc", name: "CDC / Replication", icon: null, subtitle: "Change data capture", zone: "cloud", x: 250, y: 400, details: { notes: "Log-based change data capture for low-latency replication.\nSupports: binlog (MySQL), WAL (PostgreSQL), LogMiner (Oracle)." } },
    { id: "ing_stream", name: "Stream Ingestion", icon: null, subtitle: "Real-time events", zone: "cloud", x: 400, y: 400, details: { notes: "Event-driven ingestion for real-time data.\nSupports: message bus subscription, IoT telemetry, clickstream capture." } },
    { id: "ing_file", name: "File Transfer", icon: null, subtitle: "SFTP / bulk drops", zone: "cloud", x: 550, y: 400, details: { notes: "Managed file transfer with validation.\nSupports: SFTP polling, S3/GCS/ADLS transfer, partner file drops." } },
    { id: "ing_api", name: "API Ingestion", icon: null, subtitle: "REST / webhooks", zone: "cloud", x: 700, y: 400, details: { notes: "API-based data collection.\nSupports: REST polling, GraphQL queries, webhook receivers, OAuth token management." } },

    // ── DATA LAKE (Layer 4) ──
    { id: "lake_object", name: "Object Storage", icon: null, subtitle: "Files · Parquet · JSON · Avro · unmodified source dumps", zone: "cloud", x: 100, y: 550, details: { notes: "Immutable object store for raw source data as-is.\nPurpose: audit trail, reprocessing, debugging.\nRetention: 90-365 days. Format: source-native." } },
    { id: "lake_relational", name: "Relational Landing", icon: null, subtitle: "Staging tables · schema-on-write · RDBMS scratch area", zone: "cloud", x: 550, y: 550, details: { notes: "Relational staging area for structured source data.\nPurpose: schema validation, type enforcement, initial quality checks." } },

    // ── PROCESSING (Layer 5) ──
    { id: "proc_elt", name: "Batch ELT Engine", icon: null, subtitle: "Scheduled transforms", zone: "cloud", x: 100, y: 700, details: { notes: "Core transformation engine for batch workloads.\nCapabilities: SQL transforms, joins, aggregations, SCD handling, deduplication." } },
    { id: "proc_stream", name: "Stream Processing", icon: null, subtitle: "Real-time compute", zone: "cloud", x: 250, y: 700, details: { notes: "Real-time event processing engine.\nCapabilities: windowed aggregations, sessionization, late-data handling, watermarks." } },
    { id: "proc_quality", name: "Data Quality", icon: null, subtitle: "Validation & profiling", zone: "cloud", x: 400, y: 700, details: { notes: "Data quality checks at every medallion transition.\nCapabilities: schema validation, null checks, referential integrity, anomaly detection." } },
    { id: "proc_enrich", name: "Enrichment / Joins", icon: null, subtitle: "Lookups & ref data", zone: "cloud", x: 550, y: 700, details: { notes: "Data enrichment and cross-source joins.\nCapabilities: reference data lookups, geo-enrichment, master data joins." } },
    { id: "proc_pii", name: "PII Masking", icon: null, subtitle: "Detection & redaction", zone: "cloud", x: 700, y: 700, details: { notes: "Automatic PII/PHI detection and masking.\nCapabilities: regex + ML detection, tokenization, hashing, column-level encryption." } },

    // ── MEDALLION (Layer 6) ──
    { id: "bronze", name: "Bronze", icon: null, subtitle: "Ingested · schema-applied · deduplicated", zone: "cloud", x: 200, y: 850, details: { notes: "Schema-applied, deduplicated, typed data.\nQuality gate: schema validation pass required.\nAccess: data engineers." } },
    { id: "silver", name: "Silver", icon: null, subtitle: "Cleaned · conformed · business rules", zone: "cloud", x: 450, y: 850, details: { notes: "Business-rule applied, conformed data.\nQuality gate: referential integrity + business rules pass.\nAccess: analysts + engineers." } },
    { id: "gold", name: "Gold", icon: null, subtitle: "Curated · aggregated · consumption-ready", zone: "cloud", x: 700, y: 850, details: { notes: "Aggregated, modeled, optimized for consumption.\nQuality gate: metric reconciliation + SLA freshness.\nAccess: all authorized consumers." } },

    // ── SERVING (Layer 7) ──
    { id: "serve_semantic", name: "Semantic / Metrics Layer", icon: null, subtitle: "Definitions & dimensions", zone: "cloud", x: 100, y: 1000, details: { notes: "Centralized metric definitions and dimensional model.\nCapabilities: reusable measures, governed dimensions, caching." } },
    { id: "serve_api", name: "API Gateway", icon: null, subtitle: "Data-as-a-service", zone: "cloud", x: 350, y: 1000, details: { notes: "Expose gold-layer data via managed APIs.\nCapabilities: rate limiting, authentication, versioning, usage analytics." } },
    { id: "serve_market", name: "Data Marketplace", icon: null, subtitle: "Discovery & sharing", zone: "cloud", x: 600, y: 1000, details: { notes: "Self-service data discovery and access management.\nCapabilities: dataset catalog, access requests, data products." } },
    { id: "serve_retl", name: "Reverse ETL", icon: null, subtitle: "Push to SaaS", zone: "cloud", x: 850, y: 1000, details: { notes: "Sync curated data back to operational systems.\nCapabilities: CRM enrichment, marketing activation, SaaS writeback." } },

    // ── CONSUMERS (Layer 8) ──
    { id: "con_bi", name: "BI Dashboards", icon: null, subtitle: "Executive & operational", zone: "consumers", x: 100, y: 1150, details: { notes: "Interactive dashboards for business stakeholders.\nConsumes: Gold layer via semantic layer." } },
    { id: "con_self", name: "Self-Service Analytics", icon: null, subtitle: "Ad-hoc exploration", zone: "consumers", x: 300, y: 1150, details: { notes: "Self-service query and exploration tools.\nConsumes: Silver + Gold layers with governed access." } },
    { id: "con_embed", name: "Embedded Analytics", icon: null, subtitle: "In-app insights", zone: "consumers", x: 500, y: 1150, details: { notes: "Analytics embedded in operational applications.\nConsumes: Gold layer via API or embedded SDK." } },
    { id: "con_ds", name: "Data Science", icon: null, subtitle: "ML & notebooks", zone: "consumers", x: 700, y: 1150, details: { notes: "Data science workbenches for exploration and modeling.\nConsumes: Silver + Gold layers." } },
    { id: "con_apps", name: "Downstream Apps", icon: null, subtitle: "Operational systems", zone: "consumers", x: 900, y: 1150, details: { notes: "Operational systems consuming curated data.\nConsumes: Gold layer via APIs or Reverse ETL." } },

    // ── PILLARS (crosscutting) ──
    { id: "pillar_sec", name: "\uD83D\uDD12 Security & Identity", icon: null, subtitle: "IAM / Encryption / Secrets / Network", zone: "cloud", x: 1200, y: 300, details: {
      notes: "\u2605 NON-NEGOTIABLE PILLAR\n\n\u2022 IAM / RBAC (Least-privilege roles per layer)\n\u2022 Encryption at Rest (AES-256, CMEK key rotation)\n\u2022 Encryption in Transit (TLS 1.3, mTLS for services)\n\u2022 Secrets Management (Internal vault, key rotation)\n\u2022 Network Perimeter (VPC, private endpoints, firewall)",
      encryption: "At rest: AES-256 CMEK | In transit: TLS 1.3",
      iamRoles: "Platform Admin, Data Engineer, Analyst, Viewer",
      compliance: "SOC2, ISO 27001, HIPAA, PCI-DSS"
    }},
    { id: "pillar_gov", name: "\uD83D\uDCCB Governance & Quality", icon: null, subtitle: "Catalog / Lineage / DLP / Classification", zone: "cloud", x: 1200, y: 550, details: {
      notes: "\u2605 NON-NEGOTIABLE PILLAR\n\n\u2022 Data Catalog (Search, discover, tag all assets)\n\u2022 Data Lineage (End-to-end provenance tracking)\n\u2022 DLP / Privacy (Auto PII detection & masking)\n\u2022 Quality Rules (Automated checks per zone gate)\n\u2022 Data Classification (Sensitivity labels & retention)",
      compliance: "GDPR, CCPA, HIPAA"
    }},
    { id: "pillar_obs", name: "\uD83D\uDCE1 Observability & Ops", icon: null, subtitle: "Monitor / Log / Alert / SLA", zone: "cloud", x: 1200, y: 750, details: {
      notes: "\u2605 NON-NEGOTIABLE PILLAR\n\n\u2022 Pipeline Monitoring (Latency, throughput, error rates)\n\u2022 Centralized Logging (Structured logs, full audit trail)\n\u2022 Alerting / Incidents (P1 \u2192 page \u00b7 P2 \u2192 Slack \u00b7 P3 \u2192 email)\n\u2022 SLA / Freshness (Data arrival SLOs per zone)",
      monitoring: "Pipeline health, zone freshness, consumer SLAs",
      alerting: "P1 \u2192 PagerDuty | P2 \u2192 Slack | P3 \u2192 Email"
    }},
    { id: "pillar_orch", name: "\u2699\uFE0F Orchestration & Cost", icon: null, subtitle: "DAGs / Scheduling / Budget / Chargeback", zone: "cloud", x: 1200, y: 950, details: {
      notes: "\u2605 NON-NEGOTIABLE PILLAR\n\n\u2022 Workflow / DAGs (Dependency-aware execution)\n\u2022 Scheduling (Cron, event-trigger, SLA-aware)\n\u2022 Budget Alerts (80% / 100% thresholds per team)\n\u2022 Cost Attribution (Label-based chargeback per BU)",
      cost: "Budget alerts at 80%/100% threshold per team/project"
    }},
  ],

  edges: [
    { id: "s1", from: "src_rdb", to: "conn_vpn", label: "Connect", step: 1, crossesBoundary: true, edgeType: "data" },
    { id: "s2", from: "src_saas", to: "conn_auth", label: "OAuth", step: 1, crossesBoundary: true, edgeType: "data" },
    { id: "s3", from: "src_apis", to: "conn_rate", label: "Throttle", step: 1, crossesBoundary: true, edgeType: "data" },
    { id: "s4", from: "src_stream", to: "conn_mtls", label: "mTLS", step: 1, crossesBoundary: true, edgeType: "data" },
    { id: "c1", from: "conn_vpn", to: "ing_batch", label: "Extract", step: 2, edgeType: "data" },
    { id: "c2", from: "conn_auth", to: "ing_cdc", label: "Replicate", step: 2, edgeType: "data" },
    { id: "c3", from: "conn_mtls", to: "ing_stream", label: "Subscribe", step: 2, edgeType: "data" },
    { id: "c4", from: "conn_fw", to: "ing_file", label: "Transfer", step: 2, edgeType: "data" },
    { id: "c5", from: "conn_rate", to: "ing_api", label: "Poll", step: 2, edgeType: "data" },
    { id: "d1", from: "ing_batch", to: "lake_object", label: "Land", step: 3, edgeType: "data" },
    { id: "d2", from: "ing_cdc", to: "lake_relational", label: "Stage", step: 3, edgeType: "data" },
    { id: "d3", from: "ing_stream", to: "lake_object", label: "Land", step: 3, edgeType: "data" },
    { id: "d4", from: "ing_file", to: "lake_object", label: "Land", step: 3, edgeType: "data" },
    { id: "d5", from: "ing_api", to: "lake_relational", label: "Stage", step: 3, edgeType: "data" },
    { id: "d6", from: "lake_object", to: "proc_elt", label: "Transform", step: 4, edgeType: "data" },
    { id: "d7", from: "lake_relational", to: "proc_elt", label: "Transform", step: 4, edgeType: "data" },
    { id: "d8", from: "lake_object", to: "proc_stream", label: "Process", step: 4, edgeType: "data" },
    { id: "m1", from: "proc_elt", to: "bronze", label: "Schema Apply", step: 5, edgeType: "data" },
    { id: "m2", from: "bronze", to: "silver", label: "Clean & Conform", step: 6, edgeType: "data" },
    { id: "m3", from: "silver", to: "gold", label: "Curate & Model", step: 7, edgeType: "data" },
    { id: "q1", from: "proc_quality", to: "bronze", label: "Quality Gate", step: 0, edgeType: "observe" },
    { id: "q2", from: "proc_quality", to: "silver", label: "Quality Gate", step: 0, edgeType: "observe" },
    { id: "q3", from: "proc_pii", to: "bronze", label: "PII Scan", step: 0, edgeType: "observe" },
    { id: "q4", from: "proc_enrich", to: "silver", label: "Enrich", step: 0, edgeType: "data" },
    { id: "g1", from: "gold", to: "serve_semantic", label: "Metrics", step: 8, edgeType: "data" },
    { id: "g2", from: "gold", to: "serve_api", label: "API", step: 8, edgeType: "data" },
    { id: "g3", from: "gold", to: "serve_market", label: "Publish", step: 8, edgeType: "data" },
    { id: "g4", from: "gold", to: "serve_retl", label: "Sync", step: 8, edgeType: "data" },
    { id: "x1", from: "serve_semantic", to: "con_bi", label: "Dashboards", step: 9, edgeType: "data" },
    { id: "x2", from: "serve_semantic", to: "con_self", label: "Explore", step: 9, edgeType: "data" },
    { id: "x3", from: "serve_api", to: "con_embed", label: "Embed", step: 9, edgeType: "data" },
    { id: "x4", from: "serve_api", to: "con_apps", label: "Consume", step: 9, edgeType: "data" },
    { id: "x5", from: "serve_market", to: "con_ds", label: "Discover", step: 9, edgeType: "data" },
    { id: "x6", from: "serve_retl", to: "con_apps", label: "Writeback", step: 9, edgeType: "data" },
    { id: "p1", from: "pillar_orch", to: "proc_elt", label: "Orchestrate", step: 0, edgeType: "control" },
    { id: "p2", from: "pillar_obs", to: "gold", label: "SLA Track", step: 0, edgeType: "observe" },
    { id: "p3", from: "pillar_gov", to: "silver", label: "Lineage", step: 0, edgeType: "observe" },
    { id: "p4", from: "pillar_sec", to: "ing_batch", label: "IAM", step: 0, edgeType: "control" },
  ],

  threats: [
    { id: "t1", target: "conn_auth", stride: "Spoofing", severity: "high", title: "Source Credential Compromise", description: "Stolen OAuth tokens or API keys used to impersonate source extraction", impact: "Unauthorized data extraction, data exfiltration", mitigation: "Short-lived tokens, Workload Identity Federation, IP allowlisting", compliance: "SOC2 CC6.1" },
    { id: "t2", target: "lake_object", stride: "Tampering", severity: "critical", title: "Raw Data Modification", description: "Unauthorized modification of immutable raw landing zone", impact: "Audit trail compromised, data integrity lost", mitigation: "Object versioning, write-once policies, access logging, immutable retention", compliance: "SOC2 CC8.1" },
    { id: "t3", target: "gold", stride: "Information Disclosure", severity: "high", title: "PII Exposure in Gold Layer", description: "Unmasked PII flowing through to consumption-ready datasets", impact: "Privacy violation, regulatory fines", mitigation: "DLP scanning at Bronze to Silver transition, column-level masking, access controls", compliance: "GDPR Art. 5, CCPA, HIPAA" },
    { id: "t4", target: "serve_api", stride: "Denial of Service", severity: "medium", title: "API Rate Abuse", description: "Excessive API calls exhausting platform resources", impact: "Service degradation for all consumers", mitigation: "Rate limiting, quotas per consumer, auto-scaling, circuit breakers" },
    { id: "t5", target: "pillar_orch", stride: "Elevation of Privilege", severity: "high", title: "Orchestrator Privilege Escalation", description: "Compromised orchestrator service account", impact: "Full pipeline control, data manipulation", mitigation: "Least-privilege SA per DAG, Workload Identity, audit logging", compliance: "SOC2 CC6.3" },
  ],
};
// ═══ TEMPLATE 5: SOURCES LAYER (LAYER 1) — TECHNICAL BLUEPRINT ═══
const SOURCES_LAYER: Diagram = {
  title: "Layer 1: Sources — GCP Technical Blueprint",
  subtitle: "19 Approved Tools · 6 Categories · All external systems feeding data into the GCP platform",

  phases: [
    { id: "saas", name: "SaaS / ERP", nodeIds: ["src_salesforce", "src_workday", "src_servicenow", "src_sap"] },
    { id: "databases", name: "Databases", nodeIds: ["src_oracle", "src_sqlserver", "src_postgresql", "src_mongodb", "src_cloud_sql", "src_cloud_spanner"] },
    { id: "streaming", name: "Event Streams", nodeIds: ["src_kafka", "src_confluent", "src_kinesis"] },
    { id: "file", name: "File / Object", nodeIds: ["src_sftp", "src_s3"] },
    { id: "api", name: "APIs", nodeIds: ["src_rest_api", "src_webhook"] },
    { id: "legacy", name: "Legacy", nodeIds: ["src_onprem", "src_mainframe"] },
  ],
  opsGroup: { name: "Next Layer", nodeIds: ["boundary_conn"] },

  nodes: [
    // ── SaaS / ERP (row 1) ──
    { id: "src_salesforce", name: "Salesforce", icon: "salesforce", subtitle: "CRM · REST/Bulk API · CDC", zone: "sources", x: 100, y: 200, details: {
      notes: "Cloud CRM platform exposing accounts, contacts, opportunities, cases, and custom objects via REST/Bulk APIs and Change Data Capture streams.\n\nUse when: CRM data (sales, support, customer 360) needs to land in the warehouse.",
      encryption: "In transit: TLS 1.3 | At rest: Salesforce Shield AES-256 (if licensed) | Auth: OAuth 2.0",
      monitoring: "API call count vs 100K/day limit, CDC event lag, Bulk API job status",
      alerting: "API limit > 80% → Slack P2 | CDC lag > 30 min → PagerDuty P2",
      cost: "API calls included in Salesforce license, CDC requires Platform Events allocation",
      guardrails: "OAuth 2.0 tokens in Secret Manager, respect rate limits (100K/day), incremental sync via SystemModstamp",
      compliance: "SOC2, GDPR (PII in CRM data)"
    }},
    { id: "src_workday", name: "Workday", icon: "workday", subtitle: "HCM/Finance · SOAP/REST · RaaS", zone: "sources", x: 250, y: 200, details: {
      notes: "Cloud HCM/Finance platform exposing employees, payroll, benefits, org structure, and financials via SOAP/REST APIs and RaaS reports.\n\nUse when: HR, payroll, or financial data needs to land in the warehouse.",
      encryption: "In transit: TLS 1.2+ | At rest: AES-256 (Workday-managed) | Auth: WS-Security (SOAP), OAuth 2.0 (REST)",
      monitoring: "RaaS report execution time, API response latency, data freshness",
      alerting: "Extract failure → PagerDuty P2 | Data > 8hr stale → Slack P2",
      cost: "API access included in Workday license tier",
      guardrails: "OAuth 2.0 tokens in Secret Manager, concurrent request limits, ISU (Integration System User) with minimal scope",
      compliance: "SOC2, GDPR, HIPAA (payroll/benefits data)"
    }},
    { id: "src_servicenow", name: "ServiceNow", icon: "servicenow", subtitle: "ITSM · Table API · Import Sets", zone: "sources", x: 400, y: 200, details: {
      notes: "Cloud ITSM platform exposing incidents, changes, CMDB CIs, requests, and knowledge articles via REST Table API and Import Sets.\n\nUse when: IT operations data (incidents, CMDB, change history) needs to land in the warehouse.",
      encryption: "In transit: TLS 1.2+ | At rest: AES-256 (ServiceNow-managed) | Auth: OAuth 2.0 or basic auth",
      monitoring: "Table API pagination count, Import Set job status, record counts per sync",
      alerting: "Sync failure → Slack P2 | CMDB drift detected → P3",
      cost: "API included in ServiceNow license, governed by ACLs",
      guardrails: "OAuth 2.0 in Secret Manager, sysparm_query filters for incremental pulls, ACL-scoped integration user",
      compliance: "SOC2"
    }},
    { id: "src_sap", name: "SAP", icon: "sap", subtitle: "ERP · OData/BAPI/IDoc/SLT", zone: "sources", x: 550, y: 200, details: {
      notes: "ERP system exposing finance, supply chain, procurement, and HR data via OData APIs, BAPIs, IDocs, or SLT replication.\n\nUse when: ERP transactional data (GL, AP, AR, inventory) needs to land in the warehouse.",
      encryption: "In transit: TLS 1.2+, SNC for RFC connections | At rest: SAP HANA data volume encryption (AES-256) | Auth: OAuth 2.0, X.509, or SAML",
      monitoring: "SLT replication lag, OData batch job duration, IDoc queue depth",
      alerting: "SLT lag > 15 min → PagerDuty P1 | OData timeout → Slack P2",
      cost: "BigQuery Connector for SAP licensed separately, SLT requires SAP DMIS add-on",
      guardrails: "Dedicated RFC user with minimal authorizations, SLT table filtering, delta-only replication",
      compliance: "SOC2, SOX (financial data)"
    }},

    // ── Databases (row 2) ──
    { id: "src_oracle", name: "Oracle", icon: "oracle", subtitle: "RDBMS · LogMiner CDC · JDBC", zone: "sources", x: 100, y: 300, details: {
      notes: "Enterprise RDBMS running on-prem or OCI, exposing tables via JDBC, LogMiner-based CDC, or Oracle GoldenGate.\n\nUse when: Oracle transactional data needs CDC replication or bulk extraction to GCP.",
      encryption: "In transit: Native Network Encryption or TLS | At rest: TDE (AES-256) | Auth: JDBC wallet credentials, Kerberos, or LDAP",
      monitoring: "LogMiner lag, archive log generation rate, JDBC connection pool utilization",
      alerting: "CDC lag > 10 min → PagerDuty P1 | Archive log space < 20% → P1",
      cost: "Oracle licensing (CPU-based), GoldenGate licensed separately",
      guardrails: "Dedicated extraction user with SELECT + LOGMINING grants only, VPN/Interconnect required, supplemental logging enabled",
      compliance: "SOC2, HIPAA, PCI-DSS"
    }},
    { id: "src_sqlserver", name: "SQL Server", icon: "sqlserver", subtitle: "RDBMS · CT/CDC · Always On", zone: "sources", x: 900, y: 200, details: {
      notes: "Microsoft RDBMS running on-prem, Azure, or VMs, exposing tables via JDBC/ODBC, Change Tracking (CT), CDC, or Always On replicas.\n\nUse when: SQL Server data needs CDC replication or bulk extraction to GCP.",
      encryption: "In transit: TLS 1.2+ | At rest: TDE (AES-256), Always Encrypted for column-level | Auth: Windows Auth, SQL Auth, Azure AD",
      monitoring: "CT version cleanup lag, CDC capture job latency, AG replica sync status",
      alerting: "CDC capture job stopped → PagerDuty P1 | CT retention exceeded → P2",
      cost: "SQL Server licensing (per-core), Azure SQL per-DTU or vCore pricing",
      guardrails: "Read from AG secondary replica to avoid prod impact, CT/CDC enabled per table, dedicated login with db_datareader + CT permissions",
      compliance: "SOC2, HIPAA"
    }},
    { id: "src_postgresql", name: "PostgreSQL", icon: "postgresql", subtitle: "RDBMS · WAL · Logical Replication", zone: "sources", x: 1050, y: 200, details: {
      notes: "Open-source RDBMS running on-prem, VMs, or managed services, exposing tables via JDBC and logical replication slots.\n\nUse when: PostgreSQL data needs CDC or bulk extraction to GCP.",
      encryption: "In transit: SSL/TLS | At rest: pgcrypto or filesystem-level; managed services use provider encryption | Auth: SCRAM-SHA-256, LDAP, or cert-based",
      monitoring: "Replication slot lag (bytes), WAL file count, logical decoding throughput",
      alerting: "Replication slot lag > 1GB → PagerDuty P1 (risk of WAL bloat) | Connection refused → P1",
      cost: "Open source (free), Cloud SQL for PostgreSQL ~$0.017/hr (db-f1-micro)",
      guardrails: "wal_level=logical, dedicated replication user, monitor replication slot to prevent WAL disk bloat",
      compliance: "SOC2"
    }},
    { id: "src_mongodb", name: "MongoDB", icon: "mongodb", subtitle: "NoSQL · Change Streams · mongodump", zone: "sources", x: 1200, y: 200, details: {
      notes: "Document database exposing collections via Change Streams for CDC or mongodump/mongoexport for bulk extraction.\n\nUse when: NoSQL document data needs to land in the warehouse.",
      encryption: "In transit: TLS | At rest: WiredTiger AES-256; Atlas supports AWS KMS / GCP KMS | Auth: SCRAM-SHA-256, X.509, LDAP",
      monitoring: "Change Stream resume token lag, oplog window size, cursor idle time",
      alerting: "Oplog window < 2hr → PagerDuty P1 | Change Stream cursor lost → P1",
      cost: "Atlas: from $0.08/hr (M10). Self-managed: free Community edition",
      guardrails: "Replica set required for Change Streams, resume token persisted to GCS for crash recovery, read from secondary preferred",
      compliance: "SOC2"
    }},
    { id: "src_cloud_sql", name: "Cloud SQL", icon: "cloud_sql", subtitle: "Managed MySQL/PG/SS · HA · PITR", zone: "sources", x: 1350, y: 200, details: {
      notes: "Managed MySQL, PostgreSQL, or SQL Server on GCP with automated backups, patching, and HA.\n\nUse when: GCP-native relational data (app backends) needs to land in the warehouse.",
      encryption: "In transit: TLS 1.2+ (enforced) | At rest: CMEK via Cloud KMS (AES-256) | Auth: IAM database authentication, Cloud SQL Auth Proxy",
      monitoring: "CPU/memory utilization, replication lag, connection count, storage auto-resize events",
      alerting: "HA failover triggered → PagerDuty P1 | CPU > 90% sustained → P2 | Storage > 90% → P1",
      cost: "~$0.017/hr (db-f1-micro) to ~$6.60/hr (db-highmem-64). HA doubles cost.",
      guardrails: "Private IP only (no public), IAM-based auth via Auth Proxy, automated backups with PITR, cross-region read replicas for DR",
      compliance: "SOC2, HIPAA, PCI-DSS"
    }},
    { id: "src_cloud_spanner", name: "Cloud Spanner", icon: "cloud_spanner", subtitle: "Global DB · 99.999% SLA · Zero RPO", zone: "sources", x: 1500, y: 200, details: {
      notes: "Globally distributed, strongly consistent relational DB with 99.999% SLA for multi-region configurations.\n\nUse when: Globally distributed transactional data needs to land in the warehouse.",
      encryption: "In transit: TLS (Google-managed) | At rest: Google default AES-256 or CMEK via Cloud KMS | Auth: IAM + fine-grained access control (row/column)",
      monitoring: "Node CPU utilization (target < 65%), request latency P99, storage utilization",
      alerting: "CPU > 65% → auto-scale or P2 | Latency P99 > 100ms → P2",
      cost: "$0.90/node-hour (regional), $2.70/node-hour (multi-region). Storage: $0.30/GB/mo",
      guardrails: "Multi-region for 99.999% SLA (Enterprise Plus required), BigQuery federated queries for extraction, Dataflow SpannerIO for bulk reads",
      compliance: "SOC2, HIPAA, PCI-DSS, FedRAMP"
    }},

    // ── Event Streams (row 3, left) ──
    { id: "src_kafka", name: "Apache Kafka", icon: "kafka", subtitle: "Self-Managed · Pub-Sub · MirrorMaker", zone: "sources", x: 100, y: 400, details: {
      notes: "Distributed event streaming platform for high-throughput, low-latency publish-subscribe messaging and event sourcing.\n\nUse when: Real-time event streams need to be ingested into GCP (clickstream, IoT, transactions).",
      encryption: "In transit: TLS for inter-broker and client | At rest: depends on underlying storage | Auth: SASL/PLAIN, SASL/SCRAM, mTLS, OAUTHBEARER",
      monitoring: "Consumer group lag, broker under-replicated partitions, request latency, ISR shrink events",
      alerting: "Consumer lag > 100K messages → PagerDuty P1 | Under-replicated partitions → P1",
      cost: "Self-managed: infrastructure cost. Typical 3-broker cluster ~$500-2000/mo on GCE",
      guardrails: "acks=all for durability, min.insync.replicas=2, MirrorMaker 2 for cross-DC replication, mTLS for producer auth",
      compliance: "SOC2"
    }},
    { id: "src_confluent", name: "Confluent Cloud", icon: "confluent", subtitle: "Managed Kafka · Schema Registry · ksqlDB", zone: "sources", x: 250, y: 400, details: {
      notes: "Managed Kafka service with Schema Registry, ksqlDB, connectors, and multi-cloud support.\n\nUse when: Managed Kafka streams need ingestion into GCP without self-managing brokers.",
      encryption: "In transit: TLS 1.2+ | At rest: AES-256 (Confluent-managed) | Auth: RBAC + ACLs, API keys, or OAuth",
      monitoring: "Cluster throughput (MB/s), consumer lag, Schema Registry compatibility checks",
      alerting: "Consumer lag > threshold → PagerDuty P1 | Schema compatibility failure → Slack P2",
      cost: "Basic: $0.04/GB ingress. Standard: $0.11/GB. Dedicated: from $3.33/hr",
      guardrails: "Cluster Linking for cross-region DR, Schema Registry enforced (BACKWARD compatibility), RBAC per topic",
      compliance: "SOC2, HIPAA, PCI-DSS, ISO 27001"
    }},
    { id: "src_kinesis", name: "AWS Kinesis", icon: "aws_kinesis", subtitle: "Cross-Cloud · Data Streams · Firehose", zone: "sources", x: 400, y: 400, details: {
      notes: "AWS managed streaming service for real-time data ingestion at scale (Data Streams + Firehose).\n\nUse when: Cross-cloud streaming data from AWS needs to land in GCP.",
      encryption: "In transit: TLS | At rest: AWS KMS SSE (AES-256) | Auth: AWS IAM policies, KMS key policies",
      monitoring: "GetRecords latency, iterator age, shard count, Firehose delivery lag",
      alerting: "Iterator age > 5 min → PagerDuty P1 | Firehose delivery failure → P1",
      cost: "$0.015/shard-hour + $0.014/million PUT payload units + AWS egress",
      guardrails: "Dataflow KinesisIO consumer with checkpointing, Workload Identity Federation for cross-cloud auth (no static AWS keys)",
      compliance: "SOC2"
    }},

    // ── File / Object (row 3, middle) ──
    { id: "src_sftp", name: "SFTP Server", icon: "sftp_server", subtitle: "Partner File Drops · Batch", zone: "sources", x: 600, y: 400, details: {
      notes: "Secure file transfer endpoint for batch file drops (CSV, JSON, XML, flat files) from partners or legacy systems.\n\nUse when: Partners or legacy systems push files on a schedule for batch ingestion.",
      encryption: "In transit: SSH/SFTP (encrypted channel) | At rest: PGP/GPG for file-level encryption if required | Auth: SSH key pairs, password, or certificate",
      monitoring: "File arrival time vs SLA, file size anomalies, transfer success/failure count",
      alerting: "Expected file missing > 1hr past SLA → PagerDuty P2 | File size 0 bytes → P2",
      cost: "SFTP server hosting, or managed SFTP (AWS Transfer Family ~$0.30/hr + $0.04/GB)",
      guardrails: "SSH keys in Secret Manager, file checksum validation on arrival, landing zone with schema-on-read validation",
      compliance: "SOC2"
    }},
    { id: "src_s3", name: "AWS S3", icon: "aws_s3", subtitle: "Cross-Cloud Objects · CRR · STS", zone: "sources", x: 750, y: 450, details: {
      notes: "AWS object storage service. Cross-cloud source for files, data lake exports, or partner data drops.\n\nUse when: Files or data lake objects in AWS S3 need to transfer to GCS/BQ.",
      encryption: "In transit: TLS | At rest: SSE-S3 (AES-256), SSE-KMS, or SSE-C | Auth: AWS IAM + bucket policies, STS temporary credentials",
      monitoring: "Storage Transfer Service job success/failure, bytes transferred, transfer duration",
      alerting: "Transfer job failed → PagerDuty P2 | Transfer duration > 2x baseline → Slack P2",
      cost: "AWS S3 storage + egress ($0.09/GB). Storage Transfer Service: free (pay GCS + egress only)",
      guardrails: "Workload Identity Federation for cross-cloud auth (no static AWS keys), Storage Transfer Service for native S3→GCS",
      compliance: "SOC2"
    }},

    // ── APIs (row 3, right) ──
    { id: "src_rest_api", name: "REST API", icon: "rest_api", subtitle: "Generic HTTP/JSON · Scheduled Pull", zone: "sources", x: 950, y: 400, details: {
      notes: "Any HTTP/REST endpoint exposing data via JSON/XML payloads. Covers custom APIs, SaaS APIs not listed elsewhere.\n\nUse when: A custom or niche SaaS API needs to be pulled into GCP on a schedule.",
      encryption: "In transit: TLS 1.2+ | Auth: varies — OAuth 2.0, API key, bearer token, mTLS",
      monitoring: "API response codes, response time, records per pull, rate limit remaining",
      alerting: "HTTP 4xx/5xx > 5% → Slack P2 | Rate limit hit → P2",
      cost: "Depends on API provider pricing. Cloud Function invocation: ~$0.40/million",
      guardrails: "All credentials in Secret Manager, exponential backoff on retry, pagination handling, idempotent writes",
      compliance: "SOC2"
    }},
    { id: "src_webhook", name: "Webhook", icon: "webhook", subtitle: "Push-Based Events · HMAC · Real-Time", zone: "sources", x: 1100, y: 400, details: {
      notes: "Push-based HTTP callback that sends event payloads when something happens in the source system.\n\nUse when: Real-time event notifications (payment completed, ticket created) need immediate ingestion.",
      encryption: "In transit: TLS | Auth: HMAC signature verification for payload integrity, source-specific auth",
      monitoring: "Webhook delivery rate, signature validation failures, Pub/Sub backlog depth",
      alerting: "Signature validation failure spike → Security P1 | Delivery gap > 15 min → PagerDuty P2",
      cost: "Cloud Function/Run: ~$0.40/million invocations. Pub/Sub: $40/TB",
      guardrails: "HMAC signature verification mandatory, Pub/Sub buffer for durability (31-day retention), dead-letter topic for failures",
      compliance: "SOC2"
    }},

    // ── Legacy (row 4) ──
    { id: "src_onprem", name: "On-Prem Server", icon: "onprem_server", subtitle: "Hybrid Connectivity · VPN · Interconnect", zone: "sources", x: 1300, y: 400, details: {
      notes: "On-premises application or database server requiring hybrid connectivity to GCP for data extraction.\n\nUse when: Legacy on-prem systems need connectivity to GCP via VPN or Interconnect.",
      encryption: "In transit: IPsec (VPN) or MACsec (Interconnect) | At rest: varies by on-prem system | Auth: on-prem credentials in CyberArk → Secret Manager",
      monitoring: "VPN tunnel status, Interconnect link utilization, extraction job success",
      alerting: "VPN tunnel down → PagerDuty P1 | Interconnect utilization > 80% → P2",
      cost: "Cloud VPN: ~$0.075/hr per tunnel. Interconnect: $0.05-0.08/hr (VLAN attachment)",
      guardrails: "Redundant VPN tunnels or Interconnect attachments, VPC Service Controls, no direct public IP exposure",
      compliance: "SOC2, ISO 27001"
    }},
    { id: "src_mainframe", name: "Mainframe", icon: "mainframe", subtitle: "z/OS · DB2 · VSAM · COBOL · EBCDIC", zone: "sources", x: 1450, y: 400, details: {
      notes: "Legacy IBM z/OS or AS/400 systems exposing data via VSAM, DB2, IMS, or batch file extracts (EBCDIC).\n\nUse when: Mainframe data (COBOL copybooks, DB2 tables, VSAM files) needs to land in GCP.",
      encryption: "In transit: z/OS dataset encryption (DFSMS), TLS for network, SNA encryption for legacy protocols | Auth: RACF/ACF2 credentials in CyberArk → Secret Manager",
      monitoring: "Batch job completion (JES2), MIPS consumption during extraction, file transfer byte counts",
      alerting: "Batch job ABEND → PagerDuty P1 | MIPS budget exceeded → P1",
      cost: "MIPS-based mainframe cost (most expensive source). Interconnect: ~$0.05-0.08/hr",
      guardrails: "Extract during batch windows only, MIPS budgeting with mainframe team, EBCDIC→UTF-8 conversion, COBOL copybook parser",
      compliance: "SOC2, PCI-DSS (financial mainframe)"
    }},

    // ── CONNECTIVITY BOUNDARY (next layer) ──
    { id: "boundary_conn", name: "🔒 Layer 2: Connectivity", icon: null, subtitle: "VPN · Auth · Secrets · Firewall · mTLS · Rate Limiting", zone: "connectivity", x: 800, y: 600, details: {
      notes: "★ TRUST BOUNDARY\n\nAll sources must pass through connectivity controls before entering the platform.\n\n• VPN / Interconnect (on-prem, cross-cloud)\n• Authentication (OAuth, SAML, API keys)\n• Secrets Manager (CyberArk → Secret Manager chain)\n• Firewall Rules (IP allowlist, port control)\n• mTLS (certificate-based mutual auth)\n• Rate Limiting (throttle, backoff, quotas)",
      encryption: "IPsec (VPN) | TLS 1.3 | mTLS for high-security",
      compliance: "SOC2, ISO 27001"
    }},
  ],

  edges: [
    // SaaS → Connectivity
    { id: "s1", from: "src_salesforce", to: "boundary_conn", label: "OAuth REST", step: 1, security: { transport: "TLS 1.3", auth: "OAuth 2.0", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s2", from: "src_workday", to: "boundary_conn", label: "OAuth/SOAP", step: 1, security: { transport: "TLS 1.2+", auth: "OAuth 2.0 / WS-Security", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s3", from: "src_servicenow", to: "boundary_conn", label: "OAuth REST", step: 1, security: { transport: "TLS 1.2+", auth: "OAuth 2.0", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s4", from: "src_sap", to: "boundary_conn", label: "OData / SLT", step: 1, security: { transport: "TLS 1.2+", auth: "X.509 / OAuth", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    // Databases → Connectivity
    { id: "s5", from: "src_oracle", to: "boundary_conn", label: "LogMiner CDC", step: 1, security: { transport: "TLS / NNE", auth: "JDBC Wallet", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s6", from: "src_sqlserver", to: "boundary_conn", label: "CT CDC", step: 1, security: { transport: "TLS 1.2+", auth: "SQL / Windows Auth", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s7", from: "src_postgresql", to: "boundary_conn", label: "WAL CDC", step: 1, security: { transport: "SSL/TLS", auth: "SCRAM-SHA-256", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s8", from: "src_mongodb", to: "boundary_conn", label: "Change Streams", step: 1, security: { transport: "TLS", auth: "SCRAM-SHA-256", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s9", from: "src_cloud_sql", to: "boundary_conn", label: "Auth Proxy", step: 1, security: { transport: "TLS 1.2+", auth: "IAM DB Auth", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s10", from: "src_cloud_spanner", to: "boundary_conn", label: "IAM gRPC", step: 1, security: { transport: "TLS", auth: "IAM", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    // Streams → Connectivity
    { id: "s11", from: "src_kafka", to: "boundary_conn", label: "SASL / mTLS", step: 1, security: { transport: "TLS", auth: "SASL / mTLS", classification: "confidential", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s12", from: "src_confluent", to: "boundary_conn", label: "API Key / RBAC", step: 1, security: { transport: "TLS 1.2+", auth: "API Keys", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s13", from: "src_kinesis", to: "boundary_conn", label: "STS Cross-Cloud", step: 1, security: { transport: "TLS", auth: "AWS IAM STS", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    // File → Connectivity
    { id: "s14", from: "src_sftp", to: "boundary_conn", label: "SSH/SFTP", step: 1, security: { transport: "SSH", auth: "SSH Key Pair", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s15", from: "src_s3", to: "boundary_conn", label: "STS Transfer", step: 1, security: { transport: "TLS", auth: "STS Temp Creds", classification: "internal", private: false }, crossesBoundary: true, edgeType: "data" },
    // APIs → Connectivity
    { id: "s16", from: "src_rest_api", to: "boundary_conn", label: "HTTPS", step: 1, security: { transport: "TLS 1.2+", auth: "API Key / OAuth", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    { id: "s17", from: "src_webhook", to: "boundary_conn", label: "HMAC Push", step: 1, security: { transport: "TLS", auth: "HMAC Signature", classification: "confidential", private: false }, crossesBoundary: true, edgeType: "data" },
    // Legacy → Connectivity
    { id: "s18", from: "src_onprem", to: "boundary_conn", label: "VPN/Interconnect", step: 1, security: { transport: "IPsec", auth: "On-Prem Creds", classification: "restricted", private: true }, crossesBoundary: true, edgeType: "data" },
    { id: "s19", from: "src_mainframe", to: "boundary_conn", label: "Interconnect", step: 1, security: { transport: "IPsec / MACsec", auth: "RACF via CyberArk", classification: "restricted", private: true }, crossesBoundary: true, edgeType: "data" },
  ],

  threats: [
    { id: "t1", target: "src_salesforce", stride: "Spoofing", severity: "high", title: "OAuth Token Theft", description: "Stolen OAuth refresh tokens used to impersonate extraction service", impact: "Unauthorized CRM data extraction, customer data exfiltration", mitigation: "Short-lived tokens, token rotation, IP allowlisting at Salesforce, Secret Manager versioning", compliance: "SOC2 CC6.1" },
    { id: "t2", target: "src_oracle", stride: "Information Disclosure", severity: "critical", title: "Database Credential Leakage", description: "JDBC credentials exposed in code, logs, or environment variables", impact: "Direct access to production Oracle database, data exfiltration", mitigation: "All credentials in Secret Manager (via CyberArk sync), no plaintext in code/CI, audit logging on secret access", compliance: "SOC2 CC6.1, ISO 27001" },
    { id: "t3", target: "src_kafka", stride: "Tampering", severity: "high", title: "Message Injection", description: "Malicious events injected into Kafka topic by compromised producer", impact: "Poisoned data flowing into data lake, downstream corruption", mitigation: "mTLS for all producers, Schema Registry enforcement, input validation at ingestion layer", compliance: "SOC2 CC8.1" },
    { id: "t4", target: "src_mainframe", stride: "Denial of Service", severity: "medium", title: "Mainframe MIPS Overload", description: "Extraction jobs consume excessive MIPS during peak hours", impact: "Production mainframe degradation affecting core business transactions", mitigation: "Scheduled extraction during batch windows only, MIPS budgeting with mainframe team, rate limiting", compliance: null },
    { id: "t5", target: "boundary_conn", stride: "Elevation of Privilege", severity: "high", title: "VPN Tunnel Compromise", description: "Compromised VPN endpoint grants network-level access to GCP VPC", impact: "Lateral movement from on-prem to cloud resources", mitigation: "VPC Service Controls, micro-segmentation, Zero Trust (BeyondCorp), no broad network trust", compliance: "SOC2 CC6.6" },
    { id: "t6", target: "src_cloud_spanner", stride: "Information Disclosure", severity: "high", title: "Over-Privileged Federated Query", description: "BigQuery federated query exposes Spanner data beyond intended scope", impact: "Sensitive transactional data accessible to unauthorized analysts", mitigation: "Fine-grained IAM on Spanner, authorized views in BigQuery, column-level security, audit logs", compliance: "SOC2, HIPAA" },
  ],
};


const GCP_TECHNICAL_BLUEPRINT: Diagram = {
  title: "GCP Technical Blueprint",
  subtitle: "All 8 Layers · L1 Sources → L2 Connectivity → L3 Ingestion → L4 Data Lake → L5 Processing → L6 Medallion → L7 Serving → L8 Consumers",

  phases: [
    // Layer 1: Sources
    { id: "saas", name: "L1 · SaaS / ERP", nodeIds: ["src_salesforce", "src_workday", "src_servicenow", "src_sap"] },
    { id: "databases", name: "L1 · Databases", nodeIds: ["src_oracle", "src_sqlserver", "src_postgresql", "src_mongodb", "src_cloud_sql", "src_cloud_spanner"] },
    { id: "streaming", name: "L1 · Event Streams", nodeIds: ["src_kafka", "src_confluent", "src_kinesis"] },
    { id: "file", name: "L1 · File / Object", nodeIds: ["src_sftp", "src_s3"] },
    { id: "api", name: "L1 · APIs", nodeIds: ["src_rest_api", "src_webhook"] },
    { id: "legacy", name: "L1 · Legacy", nodeIds: ["src_onprem", "src_mainframe"] },
    // Layer 2: Connectivity (GCP tools)
    { id: "identity", name: "L2 · Identity (GCP)", nodeIds: ["conn_cloud_identity", "conn_identity_platform"] },
    { id: "secrets", name: "L2 · Secrets (GCP)", nodeIds: ["conn_secret_manager"] },
    { id: "network", name: "L2 · Network", nodeIds: ["conn_vpn", "conn_interconnect", "conn_vpc", "conn_vpc_sc", "conn_armor", "conn_dns"] },
    { id: "api_mgmt", name: "L2 · API Management", nodeIds: ["conn_apigee", "conn_api_gateway"] },
    // Vendor Identity & Secrets (outside GCP)
    { id: "vendor_identity", name: "Vendor · Identity & Secrets", nodeIds: ["conn_entra_id", "conn_cyberark", "conn_keeper"] },
    // Layer 3: Ingestion (GCP tools)
    { id: "ingestion", name: "L3 · Ingestion", nodeIds: ["ing_datastream", "ing_pubsub", "ing_dataflow", "ing_functions"] },
    // Vendor Ingestion (outside GCP)
    { id: "vendor_ingestion", name: "Vendor · Ingestion", nodeIds: ["ing_fivetran"] },
    // Layer 4: Data Lake
    { id: "datalake", name: "L4 · Data Lake", nodeIds: ["lake_gcs", "lake_bq_staging"] },
    // Layer 5: Processing
    { id: "processing", name: "L5 · Processing", nodeIds: ["proc_dataflow", "proc_dataproc", "proc_dataplex"] },
    // Layer 6: Medallion
    { id: "medallion", name: "L6 · Medallion", nodeIds: ["medal_bronze", "medal_silver", "medal_gold"] },
    // Layer 7: Serving
    { id: "serving", name: "L7 · Serving", nodeIds: ["serve_looker", "serve_run", "serve_hub"] },
    // Vendor Observability & Security (outside GCP)
    { id: "vendor_obs", name: "Vendor · Observability & Security", nodeIds: ["pillar_splunk", "pillar_dynatrace", "pillar_datadog", "pillar_grafana", "pillar_pagerduty", "pillar_wiz"] },
  ],
  opsGroup: { name: "Crosscutting Pillars (GCP)", nodeIds: ["pillar_monitor", "pillar_logging", "pillar_scc", "pillar_composer", "pillar_catalog"] },

  nodes: [
    // ── SaaS / ERP (row 1) ──
    { id: "src_salesforce", name: "Salesforce", icon: "salesforce", subtitle: "CRM · REST/Bulk API · CDC", zone: "sources", x: 100, y: 100, details: {
      notes: "Cloud CRM platform exposing accounts, contacts, opportunities, cases, and custom objects via REST/Bulk APIs and Change Data Capture streams.\n\nUse when: CRM data (sales, support, customer 360) needs to land in the warehouse.",
      encryption: "In transit: TLS 1.3 | At rest: Salesforce Shield AES-256 (if licensed) | Auth: OAuth 2.0",
      monitoring: "API call count vs 100K/day limit, CDC event lag, Bulk API job status",
      alerting: "API limit > 80% → Slack P2 | CDC lag > 30 min → PagerDuty P2",
      cost: "API calls included in Salesforce license, CDC requires Platform Events allocation",
      guardrails: "OAuth 2.0 tokens in Secret Manager, respect rate limits (100K/day), incremental sync via SystemModstamp",
      compliance: "SOC2, GDPR (PII in CRM data)"
    }},
    { id: "src_workday", name: "Workday", icon: "workday", subtitle: "HCM/Finance · SOAP/REST · RaaS", zone: "sources", x: 300, y: 100, details: {
      notes: "Cloud HCM/Finance platform exposing employees, payroll, benefits, org structure, and financials via SOAP/REST APIs and RaaS reports.\n\nUse when: HR, payroll, or financial data needs to land in the warehouse.",
      encryption: "In transit: TLS 1.2+ | At rest: AES-256 (Workday-managed) | Auth: WS-Security (SOAP), OAuth 2.0 (REST)",
      monitoring: "RaaS report execution time, API response latency, data freshness",
      alerting: "Extract failure → PagerDuty P2 | Data > 8hr stale → Slack P2",
      cost: "API access included in Workday license tier",
      guardrails: "OAuth 2.0 tokens in Secret Manager, concurrent request limits, ISU (Integration System User) with minimal scope",
      compliance: "SOC2, GDPR, HIPAA (payroll/benefits data)"
    }},
    { id: "src_servicenow", name: "ServiceNow", icon: "servicenow", subtitle: "ITSM · Table API · Import Sets", zone: "sources", x: 100, y: 260, details: {
      notes: "Cloud ITSM platform exposing incidents, changes, CMDB CIs, requests, and knowledge articles via REST Table API and Import Sets.\n\nUse when: IT operations data (incidents, CMDB, change history) needs to land in the warehouse.",
      encryption: "In transit: TLS 1.2+ | At rest: AES-256 (ServiceNow-managed) | Auth: OAuth 2.0 or basic auth",
      monitoring: "Table API pagination count, Import Set job status, record counts per sync",
      alerting: "Sync failure → Slack P2 | CMDB drift detected → P3",
      cost: "API included in ServiceNow license, governed by ACLs",
      guardrails: "OAuth 2.0 in Secret Manager, sysparm_query filters for incremental pulls, ACL-scoped integration user",
      compliance: "SOC2"
    }},
    { id: "src_sap", name: "SAP", icon: "sap", subtitle: "ERP · OData/BAPI/IDoc/SLT", zone: "sources", x: 300, y: 260, details: {
      notes: "ERP system exposing finance, supply chain, procurement, and HR data via OData APIs, BAPIs, IDocs, or SLT replication.\n\nUse when: ERP transactional data (GL, AP, AR, inventory) needs to land in the warehouse.",
      encryption: "In transit: TLS 1.2+, SNC for RFC connections | At rest: SAP HANA data volume encryption (AES-256) | Auth: OAuth 2.0, X.509, or SAML",
      monitoring: "SLT replication lag, OData batch job duration, IDoc queue depth",
      alerting: "SLT lag > 15 min → PagerDuty P1 | OData timeout → Slack P2",
      cost: "BigQuery Connector for SAP licensed separately, SLT requires SAP DMIS add-on",
      guardrails: "Dedicated RFC user with minimal authorizations, SLT table filtering, delta-only replication",
      compliance: "SOC2, SOX (financial data)"
    }},

    // ── Databases (row 2) ──
    { id: "src_oracle", name: "Oracle", icon: "oracle", subtitle: "RDBMS · LogMiner CDC · JDBC", zone: "sources", x: 100, y: 460, details: {
      notes: "Enterprise RDBMS running on-prem or OCI, exposing tables via JDBC, LogMiner-based CDC, or Oracle GoldenGate.\n\nUse when: Oracle transactional data needs CDC replication or bulk extraction to GCP.",
      encryption: "In transit: Native Network Encryption or TLS | At rest: TDE (AES-256) | Auth: JDBC wallet credentials, Kerberos, or LDAP",
      monitoring: "LogMiner lag, archive log generation rate, JDBC connection pool utilization",
      alerting: "CDC lag > 10 min → PagerDuty P1 | Archive log space < 20% → P1",
      cost: "Oracle licensing (CPU-based), GoldenGate licensed separately",
      guardrails: "Dedicated extraction user with SELECT + LOGMINING grants only, VPN/Interconnect required, supplemental logging enabled",
      compliance: "SOC2, HIPAA, PCI-DSS"
    }},
    { id: "src_sqlserver", name: "SQL Server", icon: "sqlserver", subtitle: "RDBMS · CT/CDC · Always On", zone: "sources", x: 300, y: 460, details: {
      notes: "Microsoft RDBMS running on-prem, Azure, or VMs, exposing tables via JDBC/ODBC, Change Tracking (CT), CDC, or Always On replicas.\n\nUse when: SQL Server data needs CDC replication or bulk extraction to GCP.",
      encryption: "In transit: TLS 1.2+ | At rest: TDE (AES-256), Always Encrypted for column-level | Auth: Windows Auth, SQL Auth, Azure AD",
      monitoring: "CT version cleanup lag, CDC capture job latency, AG replica sync status",
      alerting: "CDC capture job stopped → PagerDuty P1 | CT retention exceeded → P2",
      cost: "SQL Server licensing (per-core), Azure SQL per-DTU or vCore pricing",
      guardrails: "Read from AG secondary replica to avoid prod impact, CT/CDC enabled per table, dedicated login with db_datareader + CT permissions",
      compliance: "SOC2, HIPAA"
    }},
    { id: "src_postgresql", name: "PostgreSQL", icon: "postgresql", subtitle: "RDBMS · WAL · Logical Replication", zone: "sources", x: 100, y: 620, details: {
      notes: "Open-source RDBMS running on-prem, VMs, or managed services, exposing tables via JDBC and logical replication slots.\n\nUse when: PostgreSQL data needs CDC or bulk extraction to GCP.",
      encryption: "In transit: SSL/TLS | At rest: pgcrypto or filesystem-level; managed services use provider encryption | Auth: SCRAM-SHA-256, LDAP, or cert-based",
      monitoring: "Replication slot lag (bytes), WAL file count, logical decoding throughput",
      alerting: "Replication slot lag > 1GB → PagerDuty P1 (risk of WAL bloat) | Connection refused → P1",
      cost: "Open source (free), Cloud SQL for PostgreSQL ~$0.017/hr (db-f1-micro)",
      guardrails: "wal_level=logical, dedicated replication user, monitor replication slot to prevent WAL disk bloat",
      compliance: "SOC2"
    }},
    { id: "src_mongodb", name: "MongoDB", icon: "mongodb", subtitle: "NoSQL · Change Streams · mongodump", zone: "sources", x: 300, y: 620, details: {
      notes: "Document database exposing collections via Change Streams for CDC or mongodump/mongoexport for bulk extraction.\n\nUse when: NoSQL document data needs to land in the warehouse.",
      encryption: "In transit: TLS | At rest: WiredTiger AES-256; Atlas supports AWS KMS / GCP KMS | Auth: SCRAM-SHA-256, X.509, LDAP",
      monitoring: "Change Stream resume token lag, oplog window size, cursor idle time",
      alerting: "Oplog window < 2hr → PagerDuty P1 | Change Stream cursor lost → P1",
      cost: "Atlas: from $0.08/hr (M10). Self-managed: free Community edition",
      guardrails: "Replica set required for Change Streams, resume token persisted to GCS for crash recovery, read from secondary preferred",
      compliance: "SOC2"
    }},
    { id: "src_cloud_sql", name: "Cloud SQL", icon: "cloud_sql", subtitle: "Managed MySQL/PG/SS · HA · PITR", zone: "sources", x: 100, y: 780, details: {
      notes: "Managed MySQL, PostgreSQL, or SQL Server on GCP with automated backups, patching, and HA.\n\nUse when: GCP-native relational data (app backends) needs to land in the warehouse.",
      encryption: "In transit: TLS 1.2+ (enforced) | At rest: CMEK via Cloud KMS (AES-256) | Auth: IAM database authentication, Cloud SQL Auth Proxy",
      monitoring: "CPU/memory utilization, replication lag, connection count, storage auto-resize events",
      alerting: "HA failover triggered → PagerDuty P1 | CPU > 90% sustained → P2 | Storage > 90% → P1",
      cost: "~$0.017/hr (db-f1-micro) to ~$6.60/hr (db-highmem-64). HA doubles cost.",
      guardrails: "Private IP only (no public), IAM-based auth via Auth Proxy, automated backups with PITR, cross-region read replicas for DR",
      compliance: "SOC2, HIPAA, PCI-DSS"
    }},
    { id: "src_cloud_spanner", name: "Cloud Spanner", icon: "cloud_spanner", subtitle: "Global DB · 99.999% SLA · Zero RPO", zone: "sources", x: 300, y: 780, details: {
      notes: "Globally distributed, strongly consistent relational DB with 99.999% SLA for multi-region configurations.\n\nUse when: Globally distributed transactional data needs to land in the warehouse.",
      encryption: "In transit: TLS (Google-managed) | At rest: Google default AES-256 or CMEK via Cloud KMS | Auth: IAM + fine-grained access control (row/column)",
      monitoring: "Node CPU utilization (target < 65%), request latency P99, storage utilization",
      alerting: "CPU > 65% → auto-scale or P2 | Latency P99 > 100ms → P2",
      cost: "$0.90/node-hour (regional), $2.70/node-hour (multi-region). Storage: $0.30/GB/mo",
      guardrails: "Multi-region for 99.999% SLA (Enterprise Plus required), BigQuery federated queries for extraction, Dataflow SpannerIO for bulk reads",
      compliance: "SOC2, HIPAA, PCI-DSS, FedRAMP"
    }},

    // ── Event Streams (row 3, left) ──
    { id: "src_kafka", name: "Apache Kafka", icon: "kafka", subtitle: "Self-Managed · Pub-Sub · MirrorMaker", zone: "sources", x: 100, y: 980, details: {
      notes: "Distributed event streaming platform for high-throughput, low-latency publish-subscribe messaging and event sourcing.\n\nUse when: Real-time event streams need to be ingested into GCP (clickstream, IoT, transactions).",
      encryption: "In transit: TLS for inter-broker and client | At rest: depends on underlying storage | Auth: SASL/PLAIN, SASL/SCRAM, mTLS, OAUTHBEARER",
      monitoring: "Consumer group lag, broker under-replicated partitions, request latency, ISR shrink events",
      alerting: "Consumer lag > 100K messages → PagerDuty P1 | Under-replicated partitions → P1",
      cost: "Self-managed: infrastructure cost. Typical 3-broker cluster ~$500-2000/mo on GCE",
      guardrails: "acks=all for durability, min.insync.replicas=2, MirrorMaker 2 for cross-DC replication, mTLS for producer auth",
      compliance: "SOC2"
    }},
    { id: "src_confluent", name: "Confluent Cloud", icon: "confluent", subtitle: "Managed Kafka · Schema Registry · ksqlDB", zone: "sources", x: 300, y: 980, details: {
      notes: "Managed Kafka service with Schema Registry, ksqlDB, connectors, and multi-cloud support.\n\nUse when: Managed Kafka streams need ingestion into GCP without self-managing brokers.",
      encryption: "In transit: TLS 1.2+ | At rest: AES-256 (Confluent-managed) | Auth: RBAC + ACLs, API keys, or OAuth",
      monitoring: "Cluster throughput (MB/s), consumer lag, Schema Registry compatibility checks",
      alerting: "Consumer lag > threshold → PagerDuty P1 | Schema compatibility failure → Slack P2",
      cost: "Basic: $0.04/GB ingress. Standard: $0.11/GB. Dedicated: from $3.33/hr",
      guardrails: "Cluster Linking for cross-region DR, Schema Registry enforced (BACKWARD compatibility), RBAC per topic",
      compliance: "SOC2, HIPAA, PCI-DSS, ISO 27001"
    }},
    { id: "src_kinesis", name: "AWS Kinesis", icon: "aws_kinesis", subtitle: "Cross-Cloud · Data Streams · Firehose", zone: "sources", x: 100, y: 1140, details: {
      notes: "AWS managed streaming service for real-time data ingestion at scale (Data Streams + Firehose).\n\nUse when: Cross-cloud streaming data from AWS needs to land in GCP.",
      encryption: "In transit: TLS | At rest: AWS KMS SSE (AES-256) | Auth: AWS IAM policies, KMS key policies",
      monitoring: "GetRecords latency, iterator age, shard count, Firehose delivery lag",
      alerting: "Iterator age > 5 min → PagerDuty P1 | Firehose delivery failure → P1",
      cost: "$0.015/shard-hour + $0.014/million PUT payload units + AWS egress",
      guardrails: "Dataflow KinesisIO consumer with checkpointing, Workload Identity Federation for cross-cloud auth (no static AWS keys)",
      compliance: "SOC2"
    }},

    // ── File / Object (row 3, middle) ──
    { id: "src_sftp", name: "SFTP Server", icon: "sftp_server", subtitle: "Partner File Drops · Batch", zone: "sources", x: 100, y: 1340, details: {
      notes: "Secure file transfer endpoint for batch file drops (CSV, JSON, XML, flat files) from partners or legacy systems.\n\nUse when: Partners or legacy systems push files on a schedule for batch ingestion.",
      encryption: "In transit: SSH/SFTP (encrypted channel) | At rest: PGP/GPG for file-level encryption if required | Auth: SSH key pairs, password, or certificate",
      monitoring: "File arrival time vs SLA, file size anomalies, transfer success/failure count",
      alerting: "Expected file missing > 1hr past SLA → PagerDuty P2 | File size 0 bytes → P2",
      cost: "SFTP server hosting, or managed SFTP (AWS Transfer Family ~$0.30/hr + $0.04/GB)",
      guardrails: "SSH keys in Secret Manager, file checksum validation on arrival, landing zone with schema-on-read validation",
      compliance: "SOC2"
    }},
    { id: "src_s3", name: "AWS S3", icon: "aws_s3", subtitle: "Cross-Cloud Objects · CRR · STS", zone: "sources", x: 300, y: 1340, details: {
      notes: "AWS object storage service. Cross-cloud source for files, data lake exports, or partner data drops.\n\nUse when: Files or data lake objects in AWS S3 need to transfer to GCS/BQ.",
      encryption: "In transit: TLS | At rest: SSE-S3 (AES-256), SSE-KMS, or SSE-C | Auth: AWS IAM + bucket policies, STS temporary credentials",
      monitoring: "Storage Transfer Service job success/failure, bytes transferred, transfer duration",
      alerting: "Transfer job failed → PagerDuty P2 | Transfer duration > 2x baseline → Slack P2",
      cost: "AWS S3 storage + egress ($0.09/GB). Storage Transfer Service: free (pay GCS + egress only)",
      guardrails: "Workload Identity Federation for cross-cloud auth (no static AWS keys), Storage Transfer Service for native S3→GCS",
      compliance: "SOC2"
    }},

    // ── APIs (row 3, right) ──
    { id: "src_rest_api", name: "REST API", icon: "rest_api", subtitle: "Generic HTTP/JSON · Scheduled Pull", zone: "sources", x: 100, y: 1500, details: {
      notes: "Any HTTP/REST endpoint exposing data via JSON/XML payloads. Covers custom APIs, SaaS APIs not listed elsewhere.\n\nUse when: A custom or niche SaaS API needs to be pulled into GCP on a schedule.",
      encryption: "In transit: TLS 1.2+ | Auth: varies — OAuth 2.0, API key, bearer token, mTLS",
      monitoring: "API response codes, response time, records per pull, rate limit remaining",
      alerting: "HTTP 4xx/5xx > 5% → Slack P2 | Rate limit hit → P2",
      cost: "Depends on API provider pricing. Cloud Function invocation: ~$0.40/million",
      guardrails: "All credentials in Secret Manager, exponential backoff on retry, pagination handling, idempotent writes",
      compliance: "SOC2"
    }},
    { id: "src_webhook", name: "Webhook", icon: "webhook", subtitle: "Push-Based Events · HMAC · Real-Time", zone: "sources", x: 300, y: 1500, details: {
      notes: "Push-based HTTP callback that sends event payloads when something happens in the source system.\n\nUse when: Real-time event notifications (payment completed, ticket created) need immediate ingestion.",
      encryption: "In transit: TLS | Auth: HMAC signature verification for payload integrity, source-specific auth",
      monitoring: "Webhook delivery rate, signature validation failures, Pub/Sub backlog depth",
      alerting: "Signature validation failure spike → Security P1 | Delivery gap > 15 min → PagerDuty P2",
      cost: "Cloud Function/Run: ~$0.40/million invocations. Pub/Sub: $40/TB",
      guardrails: "HMAC signature verification mandatory, Pub/Sub buffer for durability (31-day retention), dead-letter topic for failures",
      compliance: "SOC2"
    }},

    // ── Legacy (row 4) ──
    { id: "src_onprem", name: "On-Prem Server", icon: "onprem_server", subtitle: "Hybrid Connectivity · VPN · Interconnect", zone: "sources", x: 100, y: 1660, details: {
      notes: "On-premises application or database server requiring hybrid connectivity to GCP for data extraction.\n\nUse when: Legacy on-prem systems need connectivity to GCP via VPN or Interconnect.",
      encryption: "In transit: IPsec (VPN) or MACsec (Interconnect) | At rest: varies by on-prem system | Auth: on-prem credentials in CyberArk → Secret Manager",
      monitoring: "VPN tunnel status, Interconnect link utilization, extraction job success",
      alerting: "VPN tunnel down → PagerDuty P1 | Interconnect utilization > 80% → P2",
      cost: "Cloud VPN: ~$0.075/hr per tunnel. Interconnect: $0.05-0.08/hr (VLAN attachment)",
      guardrails: "Redundant VPN tunnels or Interconnect attachments, VPC Service Controls, no direct public IP exposure",
      compliance: "SOC2, ISO 27001"
    }},
    { id: "src_mainframe", name: "Mainframe", icon: "mainframe", subtitle: "z/OS · DB2 · VSAM · COBOL · EBCDIC", zone: "sources", x: 300, y: 1660, details: {
      notes: "Legacy IBM z/OS or AS/400 systems exposing data via VSAM, DB2, IMS, or batch file extracts (EBCDIC).\n\nUse when: Mainframe data (COBOL copybooks, DB2 tables, VSAM files) needs to land in GCP.",
      encryption: "In transit: z/OS dataset encryption (DFSMS), TLS for network, SNA encryption for legacy protocols | Auth: RACF/ACF2 credentials in CyberArk → Secret Manager",
      monitoring: "Batch job completion (JES2), MIPS consumption during extraction, file transfer byte counts",
      alerting: "Batch job ABEND → PagerDuty P1 | MIPS budget exceeded → P1",
      cost: "MIPS-based mainframe cost (most expensive source). Interconnect: ~$0.05-0.08/hr",
      guardrails: "Extract during batch windows only, MIPS budgeting with mainframe team, EBCDIC→UTF-8 conversion, COBOL copybook parser",
      compliance: "SOC2, PCI-DSS (financial mainframe)"
    }},

    // ══════════════════════════════════════════════════
    // ── LAYER 2: CONNECTIVITY (14 tools) ─────────────
    // ══════════════════════════════════════════════════

    // ── Identity & Auth (row 3) ──
    { id: "conn_entra_id", name: "Entra ID", icon: "entra_id", subtitle: "Enterprise IdP · SSO · MFA · Conditional Access", zone: "sources", x: 650, y: 100, details: {
      notes: "Microsoft cloud identity platform providing SSO, MFA, conditional access, and user/group directory. Federates into GCP Cloud Identity via SAML 2.0.\n\nUse when: Organization uses Microsoft 365 and needs SSO into GCP console, Looker, and SaaS tools.",
      encryption: "In transit: TLS 1.2+ | Tokens: SAML signed + encrypted | Auth: SAML 2.0 / OIDC",
      monitoring: "Sign-in failure rate, conditional access blocks, risky sign-in detections",
      alerting: "Risky sign-in → Security P1 | MFA bypass attempt → Security P1",
      cost: "Free (basic SSO). Premium P1: $6/user/mo. P2: $9/user/mo",
      guardrails: "Conditional access: require MFA + compliant device for GCP. Block legacy auth protocols.",
      compliance: "SOC2, ISO 27001, HIPAA"
    }},
    { id: "conn_cloud_identity", name: "Cloud Identity", icon: "identity_and_access_management", subtitle: "GCP Identity Broker · SAML Federation · Group Sync", zone: "connectivity", x: 850, y: 100, details: {
      notes: "Google-managed identity service receiving SAML federation from Entra ID, mapping users/groups to GCP IAM roles.\n\nUse when: Required layer between enterprise IdP and GCP IAM. All GCP access flows through Cloud Identity.",
      encryption: "In transit: Google-managed TLS | Tokens: SAML encrypted",
      monitoring: "GCDS sync status, login audit events, admin activity logs",
      alerting: "GCDS sync failure → PagerDuty P2 | Super admin login → Security P1",
      cost: "Free: unlimited users. Premium: $7.20/user/mo (device mgmt)",
      guardrails: "GCDS or SCIM provisioning. No local passwords — federated only.",
      compliance: "SOC2, ISO 27001"
    }},
    { id: "conn_identity_platform", name: "Identity Platform", icon: "identity_platform", subtitle: "Customer Auth · OIDC · Social Login · Phone MFA", zone: "connectivity", x: 650, y: 260, details: {
      notes: "Customer-facing auth service supporting OIDC, SAML, social logins, email/password, and phone auth for app end-users.\n\nUse when: External users (patients, partners, customers) authenticate to consume data via apps or embedded BI.",
      encryption: "In transit: TLS | Tokens: JWT | At rest: Google-managed",
      monitoring: "Auth success/failure rate, sign-up volume, MFA enrollment",
      alerting: "Auth failure > 10% → P2 | Brute force detected → Security P1",
      cost: "Free: 50K MAU. Then $0.0055/MAU",
      guardrails: "Enable MFA, block disposable emails, rate limit auth attempts",
      compliance: "SOC2"
    }},

    // ── Credential & Secrets (row 3, continued) ──
    { id: "conn_cyberark", name: "CyberArk", icon: "cyberark", subtitle: "Enterprise PAM · Vault · Auto-Rotation · Secrets Hub", zone: "sources", x: 650, y: 460, details: {
      notes: "Enterprise PAM platform: privileged credential vault, automated rotation, session recording, JIT access. Secrets Hub syncs secrets to GCP Secret Manager.\n\nUse when: Master vault for all privileged credentials (SA keys, DB passwords, API tokens). Source of truth; Secret Manager is runtime accessor.",
      encryption: "At rest: AES-256 vault | In transit: TLS 1.2+ | HSM for master key",
      monitoring: "Credential rotation success, vault access audit, session recordings",
      alerting: "Rotation failure → PagerDuty P1 | Unauthorized vault access → Security P1",
      cost: "CyberArk license (per-user PAM). Privilege Cloud SaaS pricing varies.",
      guardrails: "All privileged creds in CyberArk. Secrets Hub auto-syncs to Secret Manager. No manual secret management.",
      compliance: "SOC2, ISO 27001, PCI-DSS, HIPAA"
    }},
    { id: "conn_keeper", name: "Keeper", icon: "keeper", subtitle: "Team Passwords · Zero-Knowledge · Sharing", zone: "sources", x: 850, y: 460, details: {
      notes: "Zero-knowledge password management for team/personal credential storage, sharing, and basic rotation.\n\nUse when: Team-level secrets and developer credentials not requiring full PAM.",
      encryption: "AES-256 + PBKDF2 client-side. Zero-knowledge: Keeper never sees plaintext. TLS in transit.",
      monitoring: "Vault access logs, sharing audit, password strength reports",
      alerting: "Breach watch alert → Security P2",
      cost: "Business: $3.75/user/mo. Enterprise: $5/user/mo",
      guardrails: "SSO via Entra ID. Enforce password policies. No direct GCP integration — human-use only.",
      compliance: "SOC2, ISO 27001"
    }},
    { id: "conn_secret_manager", name: "Secret Manager", icon: "secret_manager", subtitle: "Runtime Secrets · Versioning · IAM · CMEK", zone: "connectivity", x: 650, y: 620, details: {
      notes: "GCP-native secret storage with versioning, automatic replication, and IAM-controlled access. Apps read secrets at runtime via API.\n\nUse when: Runtime secret access for Cloud Functions, Cloud Run, Composer DAGs. Receives synced secrets from CyberArk Secrets Hub.",
      encryption: "At rest: CMEK via Cloud KMS (AES-256) | In transit: TLS | Auth: IAM",
      monitoring: "Secret access audit logs, version count, replication lag",
      alerting: "Unauthorized access attempt → Security P1 | Secret not rotated > 90 days → P2",
      cost: "$0.06/10K access ops. $0.06/secret version/mo. Replication: free.",
      guardrails: "CyberArk Secrets Hub is sole writer. Applications are readers only. IAM per-secret. Audit every access.",
      compliance: "SOC2, ISO 27001, HIPAA"
    }},

    // ── Network (row 4) ──
    { id: "conn_vpn", name: "Cloud VPN", icon: "cloud_vpn", subtitle: "IPsec Tunnels · HA VPN · 99.99% SLA", zone: "connectivity", x: 650, y: 820, details: {
      notes: "Managed IPsec VPN tunnels connecting on-prem or other cloud networks to GCP VPC over public internet.\n\nUse when: Hybrid connectivity for low-to-medium bandwidth (<3 Gbps/tunnel). HA VPN provides 99.99% SLA with 2 tunnels.",
      encryption: "IPsec with IKEv2. AES-128/256-CBC or AES-128/256-GCM.",
      monitoring: "Tunnel status (up/down), bandwidth utilization, packet loss",
      alerting: "Tunnel down → PagerDuty P1 | Bandwidth > 80% → P2",
      cost: "~$0.075/hr per tunnel. HA VPN: 2 tunnels minimum = ~$0.15/hr",
      guardrails: "Always use HA VPN (2 tunnels). BGP via Cloud Router. No Classic VPN for production.",
      compliance: "SOC2"
    }},
    { id: "conn_interconnect", name: "Cloud Interconnect", icon: "cloud_interconnect", subtitle: "Dedicated/Partner · 10-100 Gbps · MACsec", zone: "connectivity", x: 850, y: 820, details: {
      notes: "Dedicated (10/100 Gbps) or Partner (50 Mbps–50 Gbps) physical link between on-prem and GCP, bypassing public internet.\n\nUse when: High bandwidth (>1 Gbps), low latency, or data must not traverse public internet.",
      encryption: "MACsec (802.1AE) for Dedicated. IPsec over Interconnect also supported.",
      monitoring: "Link utilization, BGP session status, light levels (Dedicated)",
      alerting: "Link down → PagerDuty P1 | Utilization > 80% → P2",
      cost: "Dedicated: $0.05-0.08/hr per VLAN attachment. Partner: varies by provider.",
      guardrails: "Redundant attachments across 2 edge availability domains for 99.99% SLA.",
      compliance: "SOC2, ISO 27001"
    }},
    { id: "conn_vpc", name: "VPC", icon: "virtual_private_cloud", subtitle: "Global Network · Subnets · Firewall Rules · Private Access", zone: "connectivity", x: 650, y: 980, details: {
      notes: "Global virtual network with regional subnets, firewall rules, Private Google Access, and VPC Peering.\n\nUse when: Foundation for all GCP networking. Every project needs at least one VPC.",
      encryption: "Google encrypts all VM-to-VM traffic within VPC automatically.",
      monitoring: "Firewall rule hit counts, VPC Flow Logs, Private Google Access usage",
      alerting: "Firewall deny spike → Security P2 | Unexpected egress → P1",
      cost: "VPC: free. VPC Flow Logs: $0.50/GB ingested into Logging.",
      guardrails: "Shared VPC for central management. Private Google Access enabled. No default network.",
      compliance: "SOC2"
    }},
    { id: "conn_vpc_sc", name: "VPC Service Controls", icon: "security_command_center", subtitle: "Data Exfiltration Prevention · Service Perimeter", zone: "connectivity", x: 850, y: 980, details: {
      notes: "Service perimeter preventing data exfiltration from GCP APIs (BQ, GCS, etc.) to unauthorized networks or projects.\n\nUse when: Required for sensitive data workloads (PHI, PII, financial). Prevents BQ data from being copied outside perimeter.",
      encryption: "Policy enforcement layer — works with CMEK on underlying services.",
      monitoring: "Perimeter violations (dry-run mode), access level evaluations",
      alerting: "Perimeter violation → Security P1 | New ingress/egress policy change → audit alert",
      cost: "Free (included with GCP).",
      guardrails: "Dry-run before enforce. Perimeter around all data projects. Access levels for CI/CD.",
      compliance: "SOC2, HIPAA, PCI-DSS, FedRAMP"
    }},
    { id: "conn_armor", name: "Cloud Armor", icon: "cloud_armor", subtitle: "WAF · DDoS Protection · Geo-Blocking", zone: "connectivity", x: 650, y: 1140, details: {
      notes: "WAF and DDoS protection at Google's network edge, applied to external HTTP(S) load balancers.\n\nUse when: External-facing APIs or web apps need DDoS, SQLi, XSS, or geo-based blocking.",
      encryption: "TLS termination at load balancer. Policies applied before traffic reaches backends.",
      monitoring: "Request rate, blocked requests by rule, DDoS attack events",
      alerting: "DDoS attack detected → Security P1 | Rule block rate > threshold → P2",
      cost: "Standard: $0.75/policy/mo + $0.01/10K requests. Plus: $200/mo + $0.01/10K req.",
      guardrails: "OWASP top-10 rules enabled. Geo-blocking for non-served regions. Rate limiting per IP.",
      compliance: "SOC2"
    }},
    { id: "conn_dns", name: "Cloud DNS", icon: "cloud_dns", subtitle: "Managed DNS · Private Zones · DNSSEC · 100% SLA", zone: "connectivity", x: 850, y: 1140, details: {
      notes: "Managed DNS with public zones, private zones, forwarding, and peering. 100% availability SLA.\n\nUse when: Name resolution for all GCP services, hybrid DNS with on-prem, private zones for internal service discovery.",
      encryption: "DNSSEC for public zones. Internal DNS over Google encrypted backbone.",
      monitoring: "Query rate, NXDOMAIN rate, DNSSEC validation failures",
      alerting: "DNSSEC validation failure → P2 | Query latency spike → P2",
      cost: "$0.20/zone/mo + $0.40/million queries.",
      guardrails: "DNSSEC enabled for public zones. Private zones for internal. DNS forwarding for hybrid.",
      compliance: "SOC2"
    }},

    // ── API Management (row 4, continued) ──
    { id: "conn_apigee", name: "Apigee", icon: "apigee_api_platform", subtitle: "Full API Lifecycle · Portal · Analytics · Monetization", zone: "connectivity", x: 650, y: 1340, details: {
      notes: "Full-lifecycle API management: gateway, developer portal, analytics, monetization, rate limiting, and policy enforcement.\n\nUse when: Curated data exposed as managed, monetized APIs with developer portal and analytics.",
      encryption: "TLS 1.2+ at edge. CMEK for analytics. OAuth 2.0, API keys, JWT for auth.",
      monitoring: "API latency, error rate, traffic by consumer, quota usage",
      alerting: "Error rate > 5% → PagerDuty P2 | Latency P99 > 2s → P2",
      cost: "Evaluation: free. Standard: $500/mo. Enterprise: custom pricing.",
      guardrails: "Rate limiting per consumer. OAuth enforcement. Threat protection policies. No API key in URL.",
      compliance: "SOC2, PCI-DSS"
    }},
    { id: "conn_api_gateway", name: "API Gateway", icon: "cloud_api_gateway", subtitle: "Serverless Proxy · Cloud Functions / Cloud Run", zone: "connectivity", x: 850, y: 1340, details: {
      notes: "Lightweight serverless API gateway for routing, auth, and rate limiting in front of Cloud Functions or Cloud Run.\n\nUse when: Simple API proxy when Apigee is overkill. Quick setup for internal or low-complexity APIs.",
      encryption: "TLS in transit. API keys, JWT, or Google ID tokens for auth.",
      monitoring: "Request count, latency, 4xx/5xx rates",
      alerting: "5xx rate > 5% → P2 | Latency > 1s → P2",
      cost: "$3.50/million calls (first 2M free).",
      guardrails: "Use for internal APIs only. External APIs → Apigee.",
      compliance: "SOC2"
    }},

    // ── LAYER 3: INGESTION ──
    { id: "ing_datastream", name: "Datastream", icon: "datastream", subtitle: "CDC · MySQL/PG/Oracle → BQ", zone: "cloud", x: 1100, y: 740, details: { notes: "Serverless CDC replication from relational sources to BigQuery and Cloud Storage.", cost: "$0.10/GB processed", compliance: "SOC2, ISO 27001" }},
    { id: "ing_pubsub", name: "Pub/Sub", icon: "pubsub", subtitle: "Event Streaming · At-least-once", zone: "cloud", x: 1300, y: 740, details: { notes: "Serverless event ingestion for real-time streams, IoT, clickstream.", cost: "$40/TiB ingested", compliance: "SOC2, ISO 27001" }},
    { id: "ing_dataflow", name: "Dataflow", icon: "dataflow", subtitle: "Stream & Batch Ingestion", zone: "cloud", x: 1500, y: 740, details: { notes: "Apache Beam runner for both stream and batch ingestion pipelines.", cost: "$0.056/vCPU·hr + $0.003/GB·hr", compliance: "SOC2, ISO 27001" }},
    { id: "ing_functions", name: "Cloud Functions", icon: "cloud_functions", subtitle: "Serverless Triggers", zone: "cloud", x: 1100, y: 890, details: { notes: "Lightweight event-driven ingestion for webhooks, API polling, file triggers.", cost: "$0.40/million invocations", compliance: "SOC2" }},
    { id: "ing_fivetran", name: "Fivetran", icon: "fivetran", subtitle: "Managed SaaS Connectors", zone: "sources", x: 300, y: 890, details: { notes: "300+ pre-built connectors for SaaS sources. Managed schema, incremental sync.", cost: "Per Monthly Active Row pricing", compliance: "SOC2, ISO 27001" }},

    // ── LAYER 4: DATA LAKE ──
    { id: "lake_gcs", name: "Cloud Storage", icon: "cloud_storage", subtitle: "Raw Landing · Parquet/JSON/Avro", zone: "cloud", x: 1100, y: 580, details: { notes: "Immutable object store for raw source data. Landing zone for files, exports, and CDC snapshots.", cost: "$0.020/GB/mo (Standard)", compliance: "SOC2, ISO 27001, HIPAA" }},
    { id: "lake_bq_staging", name: "BigQuery Staging", icon: "bigquery", subtitle: "Relational Landing · Schema-on-write", zone: "cloud", x: 1300, y: 580, details: { notes: "Staging datasets in BigQuery for structured source data. Schema validation and type enforcement.", cost: "$6.25/TB queried (on-demand)", compliance: "SOC2, ISO 27001, HIPAA" }},

    // ── LAYER 5: PROCESSING ──
    { id: "proc_dataflow", name: "Dataflow", icon: "dataflow", subtitle: "Batch & Stream ELT", zone: "cloud", x: 1100, y: 420, details: { notes: "Core ELT engine for transforms, joins, aggregations, deduplication.", cost: "$0.056/vCPU·hr", compliance: "SOC2, ISO 27001" }},
    { id: "proc_dataproc", name: "Dataproc", icon: "dataproc", subtitle: "Spark / Heavy Transforms", zone: "cloud", x: 1300, y: 420, details: { notes: "Managed Spark/Hadoop for complex transformations, ML feature engineering.", cost: "$0.01/vCPU·hr (on top of Compute)", compliance: "SOC2, ISO 27001" }},
    { id: "proc_dataplex", name: "Dataplex", icon: "dataplex", subtitle: "Data Quality & Profiling", zone: "cloud", x: 1500, y: 420, details: { notes: "Auto data quality checks, profiling, and validation at every medallion transition.", cost: "$0.05/GB scanned", compliance: "SOC2, ISO 27001" }},

    // ── LAYER 6: MEDALLION ──
    { id: "medal_bronze", name: "Bronze", icon: "bigquery", subtitle: "Schema-applied · Deduplicated", zone: "cloud", x: 1100, y: 260, details: { notes: "BigQuery dataset: ingested data with schema applied, deduplicated, typed. Quality gate required." }},
    { id: "medal_silver", name: "Silver", icon: "bigquery", subtitle: "Cleaned · Conformed · Business Rules", zone: "cloud", x: 1300, y: 260, details: { notes: "BigQuery dataset: cleaned, business rules applied, cross-source conformed, PII masked." }},
    { id: "medal_gold", name: "Gold", icon: "bigquery", subtitle: "Curated · Aggregated · Consumption-ready", zone: "cloud", x: 1500, y: 260, details: { notes: "BigQuery dataset: star schema, aggregated metrics, SLA-tracked, consumption-ready." }},

    // ── LAYER 7: SERVING ──
    { id: "serve_looker", name: "Looker", icon: "looker", subtitle: "Semantic Layer · BI", zone: "cloud", x: 1100, y: 100, details: { notes: "Semantic modeling layer (LookML) for governed metrics, dashboards, and self-service analytics.", cost: "$5,000/mo (Standard)", compliance: "SOC2, ISO 27001" }},
    { id: "serve_run", name: "Cloud Run", icon: "cloud_run", subtitle: "Data APIs · Serverless", zone: "cloud", x: 1300, y: 100, details: { notes: "Serverless container platform serving data APIs for applications and embedded analytics.", cost: "$0.00002400/vCPU·sec", compliance: "SOC2" }},
    { id: "serve_hub", name: "Analytics Hub", icon: "analytics_hub", subtitle: "Data Marketplace · Sharing", zone: "cloud", x: 1500, y: 100, details: { notes: "Data exchange for publishing and subscribing to shared datasets across teams and orgs.", cost: "Free (BQ storage costs apply)", compliance: "SOC2, ISO 27001" }},

    // ── LAYER 8: CONSUMERS ──
    { id: "con_bi", name: "BI Users", icon: "analyst", subtitle: "Dashboards · Reports", zone: "consumers", x: 1800, y: 100, details: { notes: "Business analysts consuming dashboards and reports via Looker." }},
    { id: "con_ds", name: "Data Scientists", icon: "developer", subtitle: "Notebooks · ML", zone: "consumers", x: 1800, y: 200, details: { notes: "Data scientists accessing gold datasets for ML and advanced analytics." }},
    { id: "con_apps", name: "Applications", icon: "external_users", subtitle: "APIs · Embedded", zone: "consumers", x: 1800, y: 300, details: { notes: "Downstream apps consuming data via Cloud Run APIs and embedded analytics." }},

    // ── CROSSCUTTING PILLARS ──
    // Observability
    { id: "pillar_monitor", name: "Cloud Monitoring", icon: "cloud_monitoring", subtitle: "Metrics · Alerts · SLOs", zone: "cloud", x: 1700, y: 100, details: { notes: "Pipeline metrics, SLO tracking, alerting across all layers.", compliance: "SOC2" }},
    { id: "pillar_logging", name: "Cloud Logging", icon: "cloud_logging", subtitle: "Audit · Debug · Compliance", zone: "cloud", x: 1700, y: 250, details: { notes: "Centralized logging for audit trails, debugging, compliance evidence.", compliance: "SOC2, ISO 27001" }},
    { id: "pillar_splunk", name: "Splunk", icon: "splunk", subtitle: "SIEM · Log Analytics", zone: "consumers", x: 1900, y: 500, details: { notes: "Enterprise SIEM and log analytics. Ingests Cloud Logging exports for advanced correlation, threat detection, and compliance dashboards.", compliance: "SOC2, ISO 27001, HIPAA" }},
    { id: "pillar_dynatrace", name: "Dynatrace", icon: "dynatrace", subtitle: "APM · Full-stack Observability", zone: "consumers", x: 1900, y: 650, details: { notes: "Full-stack APM with AI-powered root cause analysis. Monitors Dataflow, Cloud Run, Composer performance.", compliance: "SOC2, ISO 27001" }},
    { id: "pillar_datadog", name: "Datadog", icon: "datadog", subtitle: "Metrics · Traces · Dashboards", zone: "consumers", x: 2100, y: 500, details: { notes: "Unified metrics, traces, and logs. GCP integration for BigQuery, Dataflow, GKE monitoring.", compliance: "SOC2, ISO 27001" }},
    { id: "pillar_grafana", name: "Grafana", icon: "grafana", subtitle: "Visualization · Alerts", zone: "consumers", x: 2100, y: 650, details: { notes: "Open-source dashboarding for Cloud Monitoring, Prometheus, and custom pipeline metrics.", compliance: "SOC2" }},
    { id: "pillar_pagerduty", name: "PagerDuty", icon: "pagerduty", subtitle: "Incident Management · On-call", zone: "consumers", x: 1900, y: 800, details: { notes: "Incident response and on-call management. Receives alerts from Cloud Monitoring, Splunk, Datadog.", compliance: "SOC2" }},
    // Security
    { id: "pillar_wiz", name: "Wiz", icon: "wiz", subtitle: "CSPM · Cloud Security Posture", zone: "consumers", x: 2100, y: 800, details: { notes: "Agentless cloud security posture management. Scans GCP for misconfigurations, vulnerabilities, and compliance gaps.", compliance: "SOC2, ISO 27001, CIS" }},
    { id: "pillar_scc", name: "Security Command Center", icon: "security_command_center", subtitle: "GCP-native Security · Findings", zone: "cloud", x: 1700, y: 400, details: { notes: "GCP-native security and risk management. Asset inventory, vulnerability scanning, threat detection.", compliance: "SOC2, ISO 27001, CIS" }},
    // Orchestration & Governance
    { id: "pillar_composer", name: "Cloud Composer", icon: "cloud_composer", subtitle: "Orchestration · DAGs", zone: "cloud", x: 1700, y: 550, details: { notes: "Managed Airflow for pipeline orchestration, dependency management, scheduling.", cost: "$0.35/vCPU·hr", compliance: "SOC2" }},
    { id: "pillar_catalog", name: "Data Catalog", icon: "data_catalog", subtitle: "Lineage · Governance · Discovery", zone: "cloud", x: 1700, y: 700, details: { notes: "Metadata management, data lineage, discovery, and access governance.", compliance: "SOC2, ISO 27001" }},
  ],

  edges: [],

  threats: [
    // Layer 1 threats
    { id: "t1", target: "src_salesforce", stride: "Spoofing", severity: "high", title: "OAuth Token Theft", description: "Stolen OAuth refresh tokens used to impersonate extraction service", impact: "Unauthorized CRM data extraction, customer data exfiltration", mitigation: "Short-lived tokens, token rotation, IP allowlisting at Salesforce, Secret Manager versioning", compliance: "SOC2 CC6.1" },
    { id: "t2", target: "src_oracle", stride: "Information Disclosure", severity: "critical", title: "Database Credential Leakage", description: "JDBC credentials exposed in code, logs, or environment variables", impact: "Direct access to production Oracle database, data exfiltration", mitigation: "All credentials in Secret Manager (via CyberArk sync), no plaintext in code/CI, audit logging on secret access", compliance: "SOC2 CC6.1, ISO 27001" },
    { id: "t3", target: "src_kafka", stride: "Tampering", severity: "high", title: "Message Injection", description: "Malicious events injected into Kafka topic by compromised producer", impact: "Poisoned data flowing into data lake, downstream corruption", mitigation: "mTLS for all producers, Schema Registry enforcement, input validation at ingestion layer", compliance: "SOC2 CC8.1" },
    { id: "t4", target: "src_mainframe", stride: "Denial of Service", severity: "medium", title: "Mainframe MIPS Overload", description: "Extraction jobs consume excessive MIPS during peak hours", impact: "Production mainframe degradation affecting core business transactions", mitigation: "Scheduled extraction during batch windows only, MIPS budgeting with mainframe team, rate limiting", compliance: null },
    // Layer 2 threats
    { id: "t5", target: "conn_vpn", stride: "Elevation of Privilege", severity: "high", title: "VPN Tunnel Compromise", description: "Compromised VPN endpoint grants network-level access to GCP VPC", impact: "Lateral movement from on-prem to cloud resources", mitigation: "VPC Service Controls, micro-segmentation, Zero Trust (BeyondCorp), no broad network trust", compliance: "SOC2 CC6.6" },
    { id: "t6", target: "conn_entra_id", stride: "Spoofing", severity: "critical", title: "Federated Identity Hijack", description: "Compromised Entra ID tenant federates malicious users into GCP", impact: "Full GCP access via spoofed SAML assertions", mitigation: "Conditional access (MFA + device compliance), SAML assertion signing verification, Cloud Audit Logs monitoring", compliance: "SOC2 CC6.1, ISO 27001" },
    { id: "t7", target: "conn_secret_manager", stride: "Information Disclosure", severity: "critical", title: "Secret Exfiltration", description: "Over-privileged service account reads secrets beyond its scope", impact: "Credential theft enabling lateral access across systems", mitigation: "Least-privilege IAM per-secret, CyberArk as sole writer, audit every access, VPC-SC perimeter", compliance: "SOC2 CC6.3, HIPAA" },
    { id: "t8", target: "conn_vpc_sc", stride: "Tampering", severity: "high", title: "Service Perimeter Bypass", description: "Data exfiltrated via misconfigured ingress/egress rules or access levels", impact: "Sensitive data (PHI, PII) copied outside the perimeter", mitigation: "Dry-run validation before enforcement, regular perimeter audit, restrict egress to known projects only", compliance: "SOC2, HIPAA, PCI-DSS" },
    { id: "t9", target: "conn_cyberark", stride: "Denial of Service", severity: "high", title: "Vault Sync Failure", description: "CyberArk Secrets Hub fails to sync credentials to Secret Manager", impact: "Pipeline failures across all sources using rotated credentials", mitigation: "Monitoring on sync job status, alerting on staleness > 1hr, fallback to previous secret version", compliance: "SOC2 CC7.2" },
  ],
};

// ═══ REGISTRY ═════════════════════════════════════
export const TEMPLATES: Template[] = [
  { id: "blueprint-analytics", name: "Enterprise Data Analytics Blueprint", icon: "🏗️", description: "Platform-agnostic capability map with all non-negotiable layers: medallion storage, governance, security, observability, orchestration",
    tags: ["blueprint", "enterprise", "data analytics", "analytics platform", "data platform", "capability map", "capability", "medallion", "bronze", "silver", "gold", "data lake", "lakehouse", "data warehouse", "platform", "reference architecture", "data engineering", "non-negotiable", "governance", "security", "observability", "orchestration", "end-to-end", "full stack", "complete", "all layers"],
    diagram: BLUEPRINT },
  { id: "streaming-analytics", name: "Enterprise Streaming Analytics", icon: "📊", description: "Production-ready streaming platform with comprehensive security, governance, disaster recovery, and cost management",
    tags: ["streaming", "stream", "real-time", "realtime", "event-driven", "pub/sub", "pubsub", "dataflow", "clickstream", "iot", "sensor", "kafka", "ingest", "medallion", "bronze", "silver", "gold", "data quality", "lineage"],
    diagram: STREAMING },
  { id: "cdc-migration", name: "CDC Migration", icon: "🔄", description: "Cross-cloud CDC from AWS/Oracle to GCP BigQuery",
    tags: ["cdc", "change data capture", "migration", "migrate", "replicate", "replication", "datastream", "aws to gcp", "cross-cloud", "rds", "oracle", "database migration", "hybrid cloud"],
    diagram: CDC_MIGRATION },
  { id: "rag-genai", name: "RAG / GenAI", icon: "🤖", description: "Document RAG chatbot with Vertex AI Gemini",
    tags: ["rag", "genai", "gen ai", "generative", "chatbot", "assistant", "copilot", "llm", "gemini", "gpt", "embedding", "vector", "pgvector", "document", "knowledge base", "ai assistant", "question answering"],
    diagram: RAG_GENAI },
  { id: "gcp-technical-blueprint", name: "GCP Technical Blueprint", icon: "🏗️", description: "Enterprise GCP technical blueprint with all 8 layers: Sources, Connectivity, Ingestion, Data Lake, Processing, Medallion, Serving, Consumers + crosscutting pillars",
    tags: ["gcp", "technical blueprint", "gcp blueprint", "sources", "source", "connectivity", "layer 1", "layer 2", "identity", "secrets", "network", "vpn", "interconnect", "vpc", "entra", "cyberark", "secret manager", "apigee", "database", "saas", "crm", "erp", "salesforce", "oracle", "kafka", "sftp", "api", "webhook", "mainframe", "legacy", "nosql", "mongodb", "postgresql", "sql server", "workday", "servicenow", "sap", "cloud armor", "dns", "firewall", "ingestion", "datastream", "pubsub", "dataflow", "bigquery", "medallion", "bronze", "silver", "gold", "looker", "serving", "consumers"],
    diagram: GCP_TECHNICAL_BLUEPRINT },
];
