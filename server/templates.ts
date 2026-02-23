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
    { id: "src_mobile", name: "Mobile Apps", icon: null, subtitle: "User Events", zone: "sources", x: 100, y: 250, 
      details: { notes: "iOS/Android applications sending clickstream and user behavior events" } },
    { id: "src_web", name: "Web Apps", icon: null, subtitle: "Business Events", zone: "sources", x: 100, y: 350, 
      details: { notes: "Web applications producing business events via REST APIs" } },
    { id: "src_iot", name: "IoT Devices", icon: null, subtitle: "Sensor Data", zone: "sources", x: 100, y: 450, 
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
    { id: "con_analysts", name: "Analysts", icon: null, subtitle: "Dashboard Users", zone: "consumers", x: 1180, y: 250, 
      details: { notes: "Business analysts accessing Looker dashboards via SSO with MFA" } },
    { id: "con_apps", name: "Applications", icon: null, subtitle: "API Consumers", zone: "consumers", x: 1180, y: 350, 
      details: { notes: "Downstream applications consuming data via Cloud Run APIs with OAuth 2.0" } },
    { id: "con_engineers", name: "Engineers", icon: null, subtitle: "Platform Ops", zone: "consumers", x: 1180, y: 450, 
      details: { notes: "Data engineers managing pipelines via Composer UI and monitoring dashboards" } },

    // ── ALERT DESTINATIONS ──
    { id: "pagerduty", name: "PagerDuty", icon: null, subtitle: "P1 Incidents", zone: "consumers", x: 1180, y: 100, 
      details: { notes: "Critical alerts: pipeline failures, security incidents, service outages" } },
    { id: "slack", name: "Slack", icon: null, subtitle: "P2 Alerts", zone: "consumers", x: 1180, y: 550, 
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
    { id: "src_drive", name: "Google Drive", icon: null, subtitle: "Documents", zone: "sources", x: 100, y: 200, details: { notes: "Company documents: policies, procedures, knowledge base articles" } },
    { id: "src_conf", name: "Confluence", icon: null, subtitle: "Wiki Pages", zone: "sources", x: 100, y: 370, details: { notes: "Atlassian Confluence wiki and documentation pages" } },
    { id: "src_upload", name: "File Uploads", icon: null, subtitle: "User PDFs", zone: "sources", x: 100, y: 520, details: { notes: "Direct file uploads by users via web interface" } },
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
  { id: "streaming-analytics", name: "Enterprise Streaming Analytics", icon: "📊", description: "Production-ready streaming platform with comprehensive security, governance, disaster recovery, and cost management",
    tags: ["streaming", "stream", "real-time", "realtime", "event-driven", "pub/sub", "pubsub", "dataflow", "clickstream", "iot", "sensor", "kafka", "ingest", "medallion", "bronze", "silver", "gold", "data quality", "lineage"],
    diagram: STREAMING },
  { id: "cdc-migration", name: "CDC Migration", icon: "🔄", description: "Cross-cloud CDC from AWS/Oracle to GCP BigQuery",
    tags: ["cdc", "change data capture", "migration", "migrate", "replicate", "replication", "datastream", "aws to gcp", "cross-cloud", "rds", "oracle", "database migration", "hybrid cloud"],
    diagram: CDC_MIGRATION },
  { id: "rag-genai", name: "RAG / GenAI", icon: "🤖", description: "Document RAG chatbot with Vertex AI Gemini",
    tags: ["rag", "genai", "gen ai", "generative", "chatbot", "assistant", "copilot", "llm", "gemini", "gpt", "embedding", "vector", "pgvector", "document", "knowledge base", "ai assistant", "question answering"],
    diagram: RAG_GENAI },
];
