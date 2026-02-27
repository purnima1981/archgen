"""
Diagram Builder v2 — Zone-based layout engine

LAYOUT:
                      L8 CONSUMERS (top, outside)
                            ↑
  OUTSIDE LEFT     ┌─── GCP BOX ────────────────────────────┐
  ┌─────────┐      │                                        │
  │ EXT ID  │──→   │  SECURITY   ORCH    SERVING (L7)       │
  │ Entra   │      │  (L2)              top of GCP          │
  │ CyberArk│      │  left col          │                   │
  └─────────┘      │                    PIPELINE  MEDALLION  │
  ┌─────────┐      │                    (L3-L5)   (L6)  OBS │
  │ SOURCE  │═VPN═→│                    bottom-up  b-up     │
  │ Oracle  │      │                                        │
  │ Kafka   │      └────────────────────────────────────────┘
  └─────────┘            │              │              │
                         ▼              ▼              ▼
                    ┌─────────┐  ┌──────────┐  ┌──────────┐
                    │ EXT LOG │  │          │  │EXT ALERT │
                    │ Splunk  │  │          │  │PagerDuty │
                    │Dynatrace│  │          │  │ Wiz      │
                    └─────────┘  └──────────┘  └──────────┘

Data flows BOTTOM-UP inside GCP: Ingestion → Landing → Processing → Medallion → Serving
"""

from typing import Set, Dict, List, Any

# ═══════════════════════════════════════════════════════════
# ID BRIDGE — gcp_blueprint.py IDs → diagram_builder.py IDs
# gcp_blueprint uses prefixed IDs (src_kafka, conn_iam, ing_pubsub)
# diagram_builder uses its own IDs (kafka_stream, cloud_iam, pubsub)
# This map bridges the two so auto_wire() output renders correctly.
# ═══════════════════════════════════════════════════════════

ID_MAP: Dict[str, str] = {
    # Sources (L1)
    "src_oracle": "oracle_db", "src_sqlserver": "sqlserver_db",
    "src_postgresql": "postgresql_db", "src_mongodb": "mongodb_db",
    "src_mysql": "oracle_db",  # fallback
    "src_s3": "aws_s3", "src_salesforce": "salesforce",
    "src_workday": "workday", "src_servicenow": "servicenow_src",
    "src_sap": "sap_src", "src_kafka": "kafka_stream",
    "src_cloud_sql": "cloud_sql", "src_sftp": "sftp_server",
    # Connectivity (L2)
    "conn_iam": "cloud_iam", "conn_cloud_identity": "cloud_iam",
    "conn_secret_manager": "secret_manager", "conn_vpn": "cloud_vpn",
    "conn_vpc": "vpc", "conn_armor": "cloud_armor",
    "conn_apigee": "apigee", "conn_entra_id": "entra_id",
    "conn_cyberark": "cyberark",
    # Ingestion (L3)
    "ing_pubsub": "pubsub", "ing_dataflow": "dataflow_ing",
    "ing_datastream": "datastream", "ing_functions": "cloud_functions",
    "ing_fivetran": "fivetran", "ing_matillion": "matillion",
    # Landing (L4)
    "lake_gcs": "gcs_raw", "lake_bq_staging": "bq_staging",
    # Processing (L5)
    "proc_bq_sql": "dataform", "proc_dataflow": "dataflow_proc",
    "proc_dataproc": "dataproc", "proc_dlp": "cloud_dlp",
    "proc_matillion": "matillion",
    # Serving (L7)
    "serve_looker": "looker", "serve_run": "cloud_run",
    "serve_hub": "analytics_hub", "serve_bi_engine": "looker",
    # Consumers (L8)
    "con_looker": "analysts", "con_run": "downstream_sys",
    "con_hub": "downstream_sys", "con_powerbi": "executives",
    "con_vertex": "data_scientists",
    # Pillars → Crosscutting
    "pillar_sec": "scc_pillar", "pillar_gov": "dataplex",
    "pillar_obs": "cloud_monitoring", "pillar_orch": "cloud_composer",
}

# Zone mapping: gcp_blueprint layer prefixes → diagram_builder zones
BLUEPRINT_ZONE_MAP: Dict[str, str] = {
    "L1": "source", "L2": "gcp-security", "L3": "ingestion",
    "L4": "landing", "L5": "processing", "L6": "medallion",
    "L7": "serving", "L8": "consumer",
}


def _resolve_keep_set(keep_set: Set[str]) -> Set[str]:
    """Translate gcp_blueprint IDs to diagram_builder IDs."""
    resolved = set()
    for pid in keep_set:
        if pid in PRODUCTS:
            resolved.add(pid)  # direct match (bronze, silver, gold)
        elif pid in ID_MAP and ID_MAP[pid] in PRODUCTS:
            resolved.add(ID_MAP[pid])
        else:
            # Dynamic: try to create product from gcp_blueprint NODES
            try:
                from gcp_blueprint import NODES as BP_NODES
                bp_node = BP_NODES.get(pid)
                if bp_node:
                    zone = _guess_zone(pid, bp_node)
                    PRODUCTS[pid] = {
                        "name": bp_node.get("name", pid),
                        "icon": bp_node.get("icon"),
                        "zone": zone,
                        "subtitle": bp_node.get("subtitle", ""),
                    }
                    resolved.add(pid)
            except ImportError:
                pass
    return resolved


def _guess_zone(pid: str, bp_node: dict) -> str:
    """Guess diagram_builder zone from gcp_blueprint node."""
    layer = bp_node.get("layer", "")
    zone = bp_node.get("zone", "")
    # Map by layer prefix
    if pid.startswith("src_"): return "source"
    if pid.startswith("conn_"): return "gcp-security"
    if pid.startswith("ing_"): return "ingestion"
    if pid.startswith("lake_"): return "landing"
    if pid.startswith("proc_"): return "processing"
    if pid.startswith("serve_"): return "serving"
    if pid.startswith("con_"): return "consumer"
    if pid.startswith("pillar_"): return "governance"
    if zone == "sources": return "source"
    if zone == "consumers": return "consumer"
    if zone == "connectivity": return "gcp-security"
    return "gcp-security"  # safe default inside GCP box


# ═══════════════════════════════════════════════════════════
# COLOR SYSTEM v2 — SEMANTIC
# ═══════════════════════════════════════════════════════════
# Blue/Navy  = TRUST (security, identity, GCP)
# Green      = DATA IN MOTION (pipeline, healthy)
# Orange     = CONTROL (orchestration) + ALERTING
# Purple     = INTELLIGENCE (serving, ML, BI)
# Gray/Slate = EXTERNAL (third-party, outside)
# Teal/Cyan  = OBSERVATION + OUTPUT (monitoring, consumers)

COLORS = {
    "gcp":       "#1A73E8",
    "security":  "#1E3A5F",
    "pipeline":  "#137333",
    "medallion": "#1B5E20",
    "serving":   "#6A1B9A",
    "orch":      "#E65100",
    "gcpObs":    "#00695C",
    "source":    "#546E7A",
    "extId":     "#37474F",
    "consumer":  "#00838F",
    "extLog":    "#455A64",
    "extAlert":  "#BF360C",
    "governance":"#00695C",
    # Node-specific
    "ingestion": "#137333",
    "landing":   "#2E7D32",
    "processing":"#388E3C",
    "bronze":    "#795548",
    "silver":    "#78909C",
    "gold":      "#FF8F00",
}

# ═══════════════════════════════════════════════════════════
# PRODUCT CATALOG
# ═══════════════════════════════════════════════════════════

PRODUCTS: Dict[str, Dict[str, Any]] = {
    # ── L1: Sources (outside-left) ──
    "oracle_db":       {"name": "Oracle DB",        "icon": "oracle",      "zone": "source",   "subtitle": "On-prem RDBMS"},
    "sqlserver_db":    {"name": "SQL Server",        "icon": "sqlserver",   "zone": "source",   "subtitle": "On-prem RDBMS"},
    "postgresql_db":   {"name": "PostgreSQL",        "icon": "postgresql",  "zone": "source",   "subtitle": "WAL-based CDC"},
    "mongodb_db":      {"name": "MongoDB",           "icon": "mongodb",     "zone": "source",   "subtitle": "Change streams"},
    "aws_s3":          {"name": "AWS S3",            "icon": "aws_s3",      "zone": "source",   "subtitle": "Cross-cloud"},
    "salesforce":      {"name": "Salesforce",        "icon": "salesforce",  "zone": "source",   "subtitle": "CRM SaaS"},
    "workday":         {"name": "Workday",           "icon": "workday",     "zone": "source",   "subtitle": "HCM SaaS"},
    "servicenow_src":  {"name": "ServiceNow",        "icon": "servicenow",  "zone": "source",   "subtitle": "ITSM SaaS"},
    "sap_src":         {"name": "SAP ERP",           "icon": "sap",         "zone": "source",   "subtitle": "OData/BAPI"},
    "kafka_stream":    {"name": "Kafka",             "icon": "kafka",       "zone": "source",   "subtitle": "Event streaming"},
    "cloud_sql":       {"name": "Cloud SQL",         "icon": "cloud_sql",   "zone": "source",   "subtitle": "GCP-native DB"},
    "sftp_server":     {"name": "SFTP Server",       "icon": "sftp_server", "zone": "source",   "subtitle": "Legacy file transfer"},

    # ── L2: GCP Security (left column inside GCP) ──
    "cloud_iam":       {"name": "Cloud IAM",         "icon": "identity_and_access_management", "zone": "gcp-security", "subtitle": "Identity & Access"},
    "cloud_kms":       {"name": "Cloud KMS",         "icon": "key_management_service",         "zone": "gcp-security", "subtitle": "CMEK encryption"},
    "secret_manager":  {"name": "Secret Manager",    "icon": "secret_manager",  "zone": "gcp-security", "subtitle": "Credential vault"},
    "vpc":             {"name": "VPC Network",       "icon": "virtual_private_cloud", "zone": "gcp-security", "subtitle": "Private network"},
    "vpc_sc":          {"name": "VPC-SC",            "icon": "cloud_armor",     "zone": "gcp-security", "subtitle": "Service perimeter"},
    "cloud_armor":     {"name": "Cloud Armor",       "icon": "cloud_armor",     "zone": "gcp-security", "subtitle": "WAF / DDoS"},
    "cloud_vpn":       {"name": "Cloud VPN",         "icon": "cloud_vpn",       "zone": "gcp-security", "subtitle": "IPSec tunnel"},
    "apigee":          {"name": "Apigee",            "icon": "apigee_api_platform", "zone": "gcp-security", "subtitle": "API gateway"},

    # ── External Identity (outside-left) ──
    "entra_id":        {"name": "Entra ID (AAD)",    "icon": "entra_id",    "zone": "ext-identity", "subtitle": "SSO / Federation"},
    "cyberark":        {"name": "CyberArk",          "icon": "cyberark",    "zone": "ext-identity", "subtitle": "PAM vault"},

    # ── L3: Ingestion (inside GCP, bottom of pipeline) ──
    "datastream":      {"name": "Datastream",        "icon": "datastream",      "zone": "ingestion",  "subtitle": "Serverless CDC"},
    "pubsub":          {"name": "Pub/Sub",           "icon": "pubsub",          "zone": "ingestion",  "subtitle": "Message bus"},
    "dataflow_ing":    {"name": "Dataflow",          "icon": "dataflow",        "zone": "ingestion",  "subtitle": "Stream ingestion"},
    "bq_dts":          {"name": "BQ Data Transfer",  "icon": "bigquery",        "zone": "ingestion",  "subtitle": "Scheduled loads"},
    "cloud_functions": {"name": "Cloud Functions",   "icon": "cloud_functions", "zone": "ingestion",  "subtitle": "Serverless pull"},
    "fivetran":        {"name": "Fivetran",          "icon": "fivetran",        "zone": "ingestion",  "subtitle": "Managed ELT"},
    "matillion":       {"name": "Matillion",         "icon": "dataflow",        "zone": "ingestion",  "subtitle": "Visual ETL"},
    "data_fusion":     {"name": "Data Fusion",       "icon": "connectors",      "zone": "ingestion",  "subtitle": "Visual ETL (SAP)"},
    "storage_transfer":{"name": "Storage Transfer",  "icon": "cloud_storage",   "zone": "ingestion",  "subtitle": "Bulk file moves"},

    # ── L4: Landing ──
    "gcs_raw":         {"name": "GCS Raw Zone",      "icon": "cloud_storage",   "zone": "landing",    "subtitle": "Landing bucket"},
    "bq_staging":      {"name": "BQ Staging",        "icon": "bigquery",        "zone": "landing",    "subtitle": "Staging datasets"},

    # ── L5: Processing ──
    "dataform":        {"name": "Dataform",          "icon": "dbt",             "zone": "processing", "subtitle": "SQL ELT (dbt)"},
    "dataflow_proc":   {"name": "Dataflow",          "icon": "dataflow",        "zone": "processing", "subtitle": "Stream processing"},
    "dataproc":        {"name": "Dataproc",          "icon": "dataproc",        "zone": "processing", "subtitle": "Spark / Hadoop"},

    # ── L6: Medallion ──
    "bronze":          {"name": "Bronze",            "icon": "bigquery",  "zone": "medallion", "subtitle": "Raw / deduplicated"},
    "silver":          {"name": "Silver",            "icon": "bigquery",  "zone": "medallion", "subtitle": "Cleaned / conformed"},
    "gold":            {"name": "Gold",              "icon": "bigquery",  "zone": "medallion", "subtitle": "Curated / aggregated"},

    # ── L7: Serving (top of GCP) ──
    "looker":          {"name": "Looker",            "icon": "looker",        "zone": "serving",  "subtitle": "Governed BI"},
    "looker_studio":   {"name": "Looker Studio",     "icon": "looker",        "zone": "serving",  "subtitle": "Free dashboards"},
    "power_bi":        {"name": "Power BI",          "icon": "data_studio",   "zone": "serving",  "subtitle": "Self-service BI"},
    "cloud_run":       {"name": "Cloud Run",         "icon": "cloud_run",     "zone": "serving",  "subtitle": "API serving"},
    "vertex_ai":       {"name": "Vertex AI",         "icon": "vertexai",      "zone": "serving",  "subtitle": "ML platform"},
    "analytics_hub":   {"name": "Analytics Hub",     "icon": "analytics_hub", "zone": "serving",  "subtitle": "Data exchange"},

    # ── L8: Consumers (top, outside GCP) ──
    "analysts":        {"name": "Analysts",          "icon": "analyst",     "zone": "consumer",  "subtitle": "BI users"},
    "data_scientists": {"name": "Data Scientists",   "icon": "developer",   "zone": "consumer",  "subtitle": "ML / notebooks"},
    "downstream_sys":  {"name": "Downstream Systems","icon": "rest_api",    "zone": "consumer",  "subtitle": "API consumers"},
    "executives":      {"name": "Executives",        "icon": "admin_user",  "zone": "consumer",  "subtitle": "C-suite reports"},

    # ── Orchestration (inside GCP, own box) ──
    "cloud_composer":  {"name": "Cloud Composer",    "icon": "cloud_composer",  "zone": "orchestration", "subtitle": "Airflow DAGs"},
    "cloud_scheduler": {"name": "Cloud Scheduler",   "icon": "cloud_scheduler", "zone": "orchestration", "subtitle": "Cron triggers"},

    # ── GCP Observability (inside GCP, own box) ──
    "cloud_monitoring":{"name": "Cloud Monitoring",  "icon": "cloud_monitoring","zone": "gcp-obs",  "subtitle": "Metrics & alerts"},
    "cloud_logging":   {"name": "Cloud Logging",     "icon": "cloud_logging",   "zone": "gcp-obs",  "subtitle": "Centralized logs"},
    "audit_logs":      {"name": "Audit Logs",        "icon": "cloud_audit_logs","zone": "gcp-obs",  "subtitle": "Compliance trail"},
    "scc_pillar":      {"name": "Security Command Center", "icon": "security_command_center", "zone": "gcp-obs", "subtitle": "Security posture"},

    # ── Governance (inside GCP, own box) ──
    "dataplex":        {"name": "Dataplex",          "icon": "dataplex",    "zone": "governance",  "subtitle": "Data governance"},
    "data_catalog":    {"name": "Data Catalog",      "icon": "data_catalog","zone": "governance",  "subtitle": "Metadata / lineage"},
    "dataplex_dq":     {"name": "Dataplex DQ",       "icon": "dataplex",    "zone": "governance",  "subtitle": "Data quality"},
    "cloud_dlp":       {"name": "Cloud DLP",         "icon": "security_command_center", "zone": "governance", "subtitle": "PII detection"},

    # ── External Alerting (outside, below GCP) ──
    "pagerduty_inc":   {"name": "PagerDuty",         "icon": "pagerduty",   "zone": "ext-alert",  "subtitle": "Incident management"},
    "wiz_cspm":        {"name": "Wiz",               "icon": "wiz",         "zone": "ext-alert",  "subtitle": "Cloud security"},
    "archer_grc":      {"name": "RSA Archer",        "icon": "security_command_center", "zone": "ext-alert", "subtitle": "GRC platform"},

    # ── External Logging (outside, below GCP) ──
    "splunk_siem":     {"name": "Splunk SIEM",       "icon": "splunk",      "zone": "ext-log",    "subtitle": "Security events"},
    "dynatrace_apm":   {"name": "Dynatrace",         "icon": "dynatrace",   "zone": "ext-log",    "subtitle": "APM"},
}


# ═══════════════════════════════════════════════════════════
# SORT PRIORITIES (within zones)
# ═══════════════════════════════════════════════════════════

SORT_PRIORITY = {
    # Medallion: bronze → silver → gold (bottom to top)
    "bronze": 0, "silver": 1, "gold": 2,
    # Landing
    "gcs_raw": 0, "bq_staging": 1,
    # Processing
    "dataform": 0, "dataflow_proc": 1, "dataproc": 2,
    # Security
    "cloud_iam": 0, "cloud_kms": 1, "secret_manager": 2,
    "vpc": 3, "vpc_sc": 4, "cloud_armor": 5, "cloud_vpn": 6, "apigee": 7,
    # Serving
    "looker": 0, "looker_studio": 1, "power_bi": 2,
    "vertex_ai": 3, "cloud_run": 4, "analytics_hub": 5,
    # Consumers
    "analysts": 0, "executives": 1, "data_scientists": 2, "downstream_sys": 3,
    # Observability: monitoring first, then logging, then audit
    "cloud_monitoring": 0, "cloud_logging": 1, "audit_logs": 2, "scc_pillar": 3,
    # Governance
    "dataplex": 0, "data_catalog": 1, "dataplex_dq": 2, "cloud_dlp": 3,
    # External alert
    "pagerduty_inc": 0, "wiz_cspm": 1, "archer_grc": 2,
    # External log
    "splunk_siem": 0, "dynatrace_apm": 1,
}


# ═══════════════════════════════════════════════════════════
# EDGE RULES
# ═══════════════════════════════════════════════════════════

EDGE_RULES = [
    # Source → Ingestion
    {"from_any": ["oracle_db", "sqlserver_db", "postgresql_db"], "to": "datastream",   "label": "CDC", "edgeType": "data", "security": {"transport": "TLS 1.3 + IPSec", "auth": "Service Account", "classification": "PII / Confidential", "private": True}},
    {"from_any": ["mongodb_db"],                                 "to": "datastream",   "label": "Change stream", "edgeType": "data", "security": {"transport": "TLS 1.3", "auth": "x509 cert", "classification": "PII", "private": True}},
    {"from_any": ["kafka_stream"],                               "to": "pubsub",       "label": "Events", "edgeType": "data", "security": {"transport": "TLS 1.3", "auth": "SASL/OAuth", "classification": "Transactional", "private": True}},
    {"from_any": ["aws_s3"],                                     "to": "bq_dts",       "label": "S3 → BQ", "edgeType": "data"},
    {"from_any": ["aws_s3"],                                     "to": "storage_transfer", "label": "Bulk copy", "edgeType": "data"},
    {"from_any": ["salesforce", "workday", "servicenow_src"],    "to": "cloud_functions", "label": "API pull", "edgeType": "data"},
    {"from_any": ["salesforce", "workday", "servicenow_src"],    "to": "fivetran",     "label": "Managed ELT", "edgeType": "data"},
    {"from_any": ["sap_src"],                                    "to": "data_fusion",  "label": "OData", "edgeType": "data"},
    {"from_any": ["sftp_server"],                                "to": "cloud_functions", "label": "File pull", "edgeType": "data"},
    {"from_any": ["cloud_sql"],                                  "to": "datastream",   "label": "CDC", "edgeType": "data"},

    # Ingestion → Landing
    {"from_any": ["datastream", "cloud_functions", "data_fusion", "storage_transfer"], "to": "gcs_raw", "label": "Raw files", "edgeType": "data"},
    {"from_any": ["bq_dts", "fivetran", "matillion", "dataflow_ing"], "to": "bq_staging", "label": "Direct load", "edgeType": "data"},
    {"from_any": ["pubsub"], "to": "dataflow_ing", "label": "Stream", "edgeType": "data"},

    # Landing → Processing
    {"from_any": ["gcs_raw"],    "to": "dataform",     "label": "ELT", "edgeType": "data"},
    {"from_any": ["gcs_raw"],    "to": "dataflow_proc","label": "Process", "edgeType": "data"},
    {"from_any": ["gcs_raw"],    "to": "dataproc",     "label": "Spark", "edgeType": "data"},
    {"from_any": ["bq_staging"], "to": "dataform",     "label": "SQL transform", "edgeType": "data"},
    {"from_any": ["bq_staging"], "to": "dataflow_proc","label": "Process", "edgeType": "data"},
    {"from_any": ["bq_staging"], "to": "dataproc",     "label": "Spark job", "edgeType": "data"},

    # Processing → Medallion
    {"from_any": ["dataform", "dataflow_proc", "dataproc"], "to": "bronze", "label": "Ingest", "edgeType": "data"},
    {"from_any": ["bronze"],  "to": "silver", "label": "Clean", "edgeType": "data"},
    {"from_any": ["silver"],  "to": "gold",   "label": "Curate", "edgeType": "data"},

    # Medallion → Serving
    {"from_any": ["gold"], "to": "looker",       "label": "Governed BI", "edgeType": "data"},
    {"from_any": ["gold"], "to": "looker_studio", "label": "Dashboards", "edgeType": "data"},
    {"from_any": ["gold"], "to": "power_bi",     "label": "DirectQuery", "edgeType": "data"},
    {"from_any": ["gold"], "to": "vertex_ai",    "label": "Features", "edgeType": "data"},
    {"from_any": ["gold"], "to": "cloud_run",    "label": "API", "edgeType": "data"},
    {"from_any": ["gold"], "to": "analytics_hub","label": "Data share", "edgeType": "data"},

    # Serving → Consumers
    {"from_any": ["looker", "looker_studio", "power_bi"], "to": "analysts",       "label": "Reports", "edgeType": "data"},
    {"from_any": ["looker"],      "to": "executives",     "label": "Exec reports", "edgeType": "data"},
    {"from_any": ["vertex_ai"],   "to": "data_scientists","label": "ML models", "edgeType": "data"},
    {"from_any": ["cloud_run"],   "to": "downstream_sys", "label": "REST API", "edgeType": "data"},
    {"from_any": ["analytics_hub"],"to": "downstream_sys","label": "Data share", "edgeType": "data"},

    # Identity federation
    {"from_any": ["entra_id"],  "to": "cloud_iam",      "label": "SSO", "edgeType": "identity"},
    {"from_any": ["cyberark"],  "to": "secret_manager",  "label": "Cred sync", "edgeType": "identity"},

    # Orchestration control
    {"from_any": ["cloud_composer"],  "to": "dataform",     "label": "Trigger", "edgeType": "control"},
    {"from_any": ["cloud_composer"],  "to": "dataflow_proc","label": "Trigger", "edgeType": "control"},
    {"from_any": ["cloud_composer"],  "to": "dataproc",     "label": "Trigger", "edgeType": "control"},
    {"from_any": ["cloud_scheduler"],"to": "cloud_functions","label": "Cron", "edgeType": "control"},

    # Observability internal
    {"from_any": ["audit_logs"],      "to": "cloud_logging",   "label": "Logs", "edgeType": "observe"},
    {"from_any": ["cloud_logging"],   "to": "cloud_monitoring","label": "Metrics", "edgeType": "observe"},

    # Observability → External
    {"from_any": ["cloud_monitoring"],"to": "pagerduty_inc",  "label": "Alerts", "edgeType": "alert"},
    {"from_any": ["cloud_monitoring"],"to": "wiz_cspm",       "label": "Posture", "edgeType": "alert"},
    {"from_any": ["cloud_logging"],   "to": "splunk_siem",    "label": "Log export", "edgeType": "observe"},
    {"from_any": ["cloud_logging"],   "to": "dynatrace_apm",  "label": "Traces", "edgeType": "observe"},

    # ── Cross-cutting: Security governs pipeline access ──
    {"from_any": ["cloud_iam"],       "to": "datastream",      "label": "Authorize", "edgeType": "identity"},
    {"from_any": ["cloud_iam"],       "to": "dataflow_ing",    "label": "Authorize", "edgeType": "identity"},
    {"from_any": ["cloud_iam"],       "to": "pubsub",          "label": "Authorize", "edgeType": "identity"},
    {"from_any": ["cloud_iam"],       "to": "cloud_functions", "label": "Authorize", "edgeType": "identity"},
    {"from_any": ["cloud_iam"],       "to": "looker",          "label": "RBAC", "edgeType": "identity"},
    {"from_any": ["cloud_iam"],       "to": "cloud_run",       "label": "RBAC", "edgeType": "identity"},
    {"from_any": ["vpc", "vpc_sc"],   "to": "datastream",      "label": "Perimeter", "edgeType": "identity"},
    {"from_any": ["vpc", "vpc_sc"],   "to": "pubsub",          "label": "Perimeter", "edgeType": "identity"},
    {"from_any": ["cloud_armor"],     "to": "cloud_run",       "label": "WAF", "edgeType": "identity"},
    {"from_any": ["cloud_armor"],     "to": "apigee",          "label": "WAF", "edgeType": "identity"},

    # ── Cross-cutting: Pipeline → Observability (emits metrics/logs) ──
    {"from_any": ["datastream", "cloud_functions", "data_fusion", "dataflow_ing", "pubsub"], "to": "cloud_logging", "label": "Logs", "edgeType": "observe"},
    {"from_any": ["dataform", "dataflow_proc", "dataproc"],       "to": "cloud_logging", "label": "Logs", "edgeType": "observe"},
    {"from_any": ["looker", "cloud_run", "analytics_hub"],        "to": "cloud_monitoring", "label": "Metrics", "edgeType": "observe"},

    # ── Cross-cutting: Governance spans data pipeline ──
    {"from_any": ["dataplex", "dataplex_dq"], "to": "gold",   "label": "Quality", "edgeType": "control"},
    {"from_any": ["cloud_dlp"],               "to": "bronze",  "label": "PII scan", "edgeType": "control"},
    {"from_any": ["data_catalog"],            "to": "gold",    "label": "Lineage", "edgeType": "control"},
]


# ═══════════════════════════════════════════════════════════
# ZONE-GRID-FIRST LAYOUT ENGINE
# Zones define the grid. Nodes fill the grid.
# GAP between every pair of adjacent zones is CONSTANT.
# ═══════════════════════════════════════════════════════════

import math

# ── Grid constants ──
GAP        = 40    # between EVERY pair of adjacent zones — constant, always
GCP_PAD    = 25    # GCP wrapper inset around children
GCP_LABEL  = 36    # space for "Google Cloud" pill at top of GCP
ZONE_PAD   = 36    # internal padding inside each zone
LABEL_H    = 28    # room for zone label text at top
NODE_W     = 82    # node card size
NODE_HALF  = 41    # half of NODE_W
H_SPACE    = 150   # horizontal spacing between node centers
V_SPACE    = 140   # vertical spacing between node row centers
MEDAL_SPACE = 170  # horizontal spacing for medallion tiers (wider)

# ── Column widths ──
COL_L_W    = 180   # left GCP column:  security, governance  (1-node wide)
COL_C_W    = 480   # center GCP column: serving, pipeline+medallion (3-wide for medallion)
COL_R_W    = 300   # right GCP column:  orchestration, observability (2-wide)
OUTSIDE_W  = 180   # outside-left zones: ext-identity, source (1-wide)

# ── Derived X positions ──
OUTSIDE_X  = 30
GCP_X      = OUTSIDE_X + OUTSIDE_W + GAP                       # 230
COL_L_X    = GCP_X + GCP_PAD                                   # 245
COL_C_X    = COL_L_X + COL_L_W + GAP                           # 445
COL_R_X    = COL_C_X + COL_C_W + GAP                           # 945
GCP_W      = (COL_R_X + COL_R_W + GCP_PAD) - GCP_X             # 1030


def _zone_h(count: int, max_cols: int = 2) -> int:
    """Height of a zone rect containing `count` nodes in `max_cols` columns."""
    if count == 0:
        return 0
    rows = math.ceil(count / max_cols)
    return LABEL_H + ZONE_PAD + (rows - 1) * V_SPACE + NODE_W + ZONE_PAD


def _section_h(count: int, max_cols: int = 2) -> int:
    """Height of a raw node section (no zone label/padding overhead)."""
    if count == 0:
        return 0
    rows = math.ceil(count / max_cols)
    return (rows - 1) * V_SPACE + NODE_W


def _zone_w(count: int, max_cols: int = 2, h_space: int = H_SPACE) -> int:
    """Width of a zone rect for `count` nodes."""
    if count == 0:
        return 0
    cols = min(count, max_cols)
    return 2 * ZONE_PAD + (cols - 1) * h_space + NODE_W


# ═══════════════════════════════════════════════════════════
# ZONE METADATA — geometry computed per-diagram in build_diagram()
# ═══════════════════════════════════════════════════════════

ZONE_DEFS = [
    # ── Outside zones ──
    {"id": "consumer",      "label": "CONSUMERS (L8)",              "color": COLORS["consumer"],    "dashed": True,
     "parent": None,            "zIndex": 0, "bg": "#E0F7FA"},
    {"id": "ext-identity",  "label": "EXTERNAL IDENTITY",           "color": COLORS["extId"],       "dashed": True,
     "parent": None,            "zIndex": 0, "bg": "#ECEFF1"},
    {"id": "source",        "label": "ON-PREM SOURCE (L1)",         "color": COLORS["source"],      "dashed": True,
     "parent": None,            "zIndex": 0, "bg": "#ECEFF1"},
    # ── GCP boundary ──
    {"id": "gcp",           "label": "GOOGLE CLOUD PLATFORM",       "color": COLORS["gcp"],         "dashed": False, "filled": True,
     "parent": None,            "zIndex": 1, "bg": "#E8F0FE"},
    # ── GCP children ──
    {"id": "gcp-security",  "label": "CONNECTIVITY & IDENTITY (L2)","color": COLORS["security"],    "dashed": True,
     "parent": "gcp",          "zIndex": 2, "bg": "#E8EAF6"},
    {"id": "serving",       "label": "SERVING & DELIVERY (L7)",     "color": COLORS["serving"],     "dashed": True,
     "parent": "gcp",          "zIndex": 2, "bg": "#F3E5F5"},
    {"id": "orchestration", "label": "ORCHESTRATION",               "color": COLORS["orch"],        "dashed": True,
     "parent": "gcp",          "zIndex": 2, "bg": "#FFF3E0"},
    {"id": "data-pipeline", "label": "DATA PIPELINE (L3→L6)",       "color": COLORS["pipeline"],    "dashed": True,
     "parent": "gcp",          "zIndex": 2, "bg": "#E8F5E9"},
    {"id": "gcp-obs",       "label": "OBSERVABILITY (GCP)",         "color": COLORS["gcpObs"],      "dashed": True,
     "parent": "gcp",          "zIndex": 2, "bg": "#E0F2F1"},
    {"id": "governance",    "label": "GOVERNANCE",                  "color": COLORS["governance"],  "dashed": True,
     "parent": "gcp",          "zIndex": 2, "bg": "#E0F2F1"},
    # ── Medallion (inside data-pipeline) ──
    {"id": "medallion",     "label": "MEDALLION ARCHITECTURE",      "color": COLORS["gold"],        "dashed": False, "filled": True,
     "parent": "data-pipeline","zIndex": 3, "bg": "#FFF8E1"},
    # ── External zones below GCP ──
    {"id": "ext-log",       "label": "EXTERNAL LOGGING",            "color": COLORS["extLog"],      "dashed": True,
     "parent": None,            "zIndex": 0, "bg": "#ECEFF1"},
    {"id": "ext-alert",     "label": "EXTERNAL ALERTING",           "color": COLORS["extAlert"],    "dashed": True,
     "parent": None,            "zIndex": 0, "bg": "#FBE9E7"},
]

_ZONE_BY_ID = {zd["id"]: zd for zd in ZONE_DEFS}

# Zones that live inside GCP
GCP_ZONES = {"gcp-security", "ingestion", "landing", "processing",
             "medallion", "serving", "orchestration", "gcp-obs", "governance"}

# For pipeline zones, merge L3-L6 into one visual zone "data-pipeline"
PIPELINE_ZONES = {"ingestion", "landing", "processing", "medallion"}


# ═══════════════════════════════════════════════════════════
# BUILD DIAGRAM
# ═══════════════════════════════════════════════════════════

def _make_node(pid: str, prod: dict, x: int, y: int) -> dict:
    # Map our zone names → canvas-compatible zones
    ZONE_MAP = {
        "source":       "sources",
        "ext-identity": "sources",
        "gcp-security": "cloud",
        "ingestion":    "cloud",
        "landing":      "cloud",
        "processing":   "cloud",
        "medallion":    "cloud",
        "serving":      "cloud",
        "orchestration":"cloud",
        "gcp-obs":      "cloud",
        "governance":   "cloud",
        "consumer":     "consumers",
        "ext-alert":    "external",     # separate — not in cloud or consumers
        "ext-log":      "external",     # separate — not in cloud or consumers
    }
    return {
        "id": pid,
        "name": prod["name"],
        "icon": prod["icon"],
        "subtitle": prod["subtitle"],
        "zone": ZONE_MAP.get(prod["zone"], "cloud"),  # backward-compatible
        "subZone": prod["zone"],                       # our new zone system
        "x": x,
        "y": y,
        "details": {"notes": "Selected by knowledge engine"},
    }


def _place_in_zone(pids: list, zx: int, zy: int, zw: int,
                   max_cols: int = 2, h_space: int = H_SPACE) -> List[dict]:
    """Place nodes in a centered grid inside a zone rect. Returns node dicts."""
    if not pids:
        return []
    cols = min(len(pids), max_cols)
    grid_w = (cols - 1) * h_space + NODE_W
    grid_x = zx + (zw - grid_w) / 2  # center grid horizontally
    nx0 = grid_x + NODE_HALF
    ny0 = zy + LABEL_H + ZONE_PAD + NODE_HALF
    result = []
    for i, pid in enumerate(pids):
        c = i % max_cols
        r = i // max_cols
        result.append(_make_node(pid, PRODUCTS[pid], int(nx0 + c * h_space), int(ny0 + r * V_SPACE)))
    return result


def _place_raw(pids: list, zx: int, zw: int, start_y: int,
               max_cols: int = 2, h_space: int = H_SPACE) -> List[dict]:
    """Place nodes in a centered grid at start_y (no zone label overhead)."""
    if not pids:
        return []
    cols = min(len(pids), max_cols)
    grid_w = (cols - 1) * h_space + NODE_W
    grid_x = zx + (zw - grid_w) / 2
    nx0 = grid_x + NODE_HALF
    ny0 = start_y + NODE_HALF
    result = []
    for i, pid in enumerate(pids):
        c = i % max_cols
        r = i // max_cols
        result.append(_make_node(pid, PRODUCTS[pid], int(nx0 + c * h_space), int(ny0 + r * V_SPACE)))
    return result


def build_diagram(keep_set: Set[str], title: str,
                  decisions: List[str], anti_patterns: List[str]) -> dict:
    """
    Convert a keep_set of product IDs into a full Diagram JSON.
    Zone-grid-first: zones define the grid, nodes fill the grid.
    GAP between every adjacent zone pair is constant.
    """
    # ── Resolve gcp_blueprint IDs → diagram_builder IDs ──
    resolved = _resolve_keep_set(keep_set)

    nodes: List[dict] = []
    edges: List[dict] = []

    # ── Bucket products by zone ──
    zone_buckets: Dict[str, List[str]] = {}
    for pid in sorted(resolved):
        prod = PRODUCTS.get(pid)
        if not prod:
            continue
        z = prod["zone"]
        zone_buckets.setdefault(z, []).append(pid)

    # Sort within each zone by priority
    for z in zone_buckets:
        zone_buckets[z].sort(key=lambda p: (SORT_PRIORITY.get(p, 50), p))

    # ── Count nodes per zone ──
    def _n(z: str) -> int:
        return len(zone_buckets.get(z, []))

    n_consumer   = _n("consumer")
    n_ext_id     = _n("ext-identity")
    n_source     = _n("source")
    n_security   = _n("gcp-security")
    n_serving    = _n("serving")
    n_orch       = _n("orchestration")
    n_obs        = _n("gcp-obs")
    n_governance = _n("governance")
    n_medallion  = _n("medallion")
    n_processing = _n("processing")
    n_landing    = _n("landing")
    n_ingestion  = _n("ingestion")
    n_ext_log    = _n("ext-log")
    n_ext_alert  = _n("ext-alert")

    has_gcp = any(_n(z) > 0 for z in GCP_ZONES)

    # ══════════════════════════════════════════════
    # PHASE 1: Compute zone rectangles
    # ══════════════════════════════════════════════
    zone_rects: Dict[str, Dict[str, int]] = {}  # zone_id → {x, y, w, h}

    # ── GCP internal column heights ──

    # LEFT column: security (top) → governance (bottom)
    h_security   = _zone_h(n_security, 1)
    h_governance = _zone_h(n_governance, 1)
    col_l_parts  = [h for h in [h_security, h_governance] if h > 0]
    col_l_h      = sum(col_l_parts) + max(0, len(col_l_parts) - 1) * GAP

    # CENTER column: serving (top) → data-pipeline (bottom)
    h_serving    = _zone_h(n_serving, 2)

    # Pipeline internals (stacked top-down inside pipeline zone)
    h_medallion_z = _zone_h(n_medallion, 3)   # has its own zone rect with label
    h_processing  = _section_h(n_processing, 2)  # raw node section
    h_landing     = _section_h(n_landing, 2)
    h_ingestion   = _section_h(n_ingestion, 2)
    pipe_sections = []
    if h_medallion_z > 0: pipe_sections.append(h_medallion_z)
    if h_processing > 0:  pipe_sections.append(h_processing)
    if h_landing > 0:     pipe_sections.append(h_landing)
    if h_ingestion > 0:   pipe_sections.append(h_ingestion)
    h_pipeline = 0
    if pipe_sections:
        h_pipeline = (LABEL_H + ZONE_PAD
                      + sum(pipe_sections)
                      + max(0, len(pipe_sections) - 1) * GAP
                      + ZONE_PAD)

    col_c_parts = [h for h in [h_serving, h_pipeline] if h > 0]
    col_c_h     = sum(col_c_parts) + max(0, len(col_c_parts) - 1) * GAP

    # RIGHT column: obs (top) → orchestration (bottom)
    h_orch = _zone_h(n_orch, 2)
    h_obs  = _zone_h(n_obs, 2)
    col_r_parts = [h for h in [h_obs, h_orch] if h > 0]
    col_r_h     = sum(col_r_parts) + max(0, len(col_r_parts) - 1) * GAP

    # GCP height
    gcp_inner_h = max(col_l_h, col_c_h, col_r_h, 0)
    gcp_h = GCP_PAD + GCP_LABEL + gcp_inner_h + GCP_PAD if has_gcp else 0

    # ── Consumer zone (above GCP) ──
    h_consumer = _zone_h(n_consumer, 4)
    con_w = max(_zone_w(n_consumer, 4), 200) if n_consumer else 0
    consumer_y = 80
    consumer_x = int(GCP_X + (GCP_W - con_w) / 2) if con_w else 0

    if n_consumer:
        zone_rects["consumer"] = {"x": consumer_x, "y": consumer_y, "w": con_w, "h": h_consumer}

    # ── GCP zone ──
    gcp_y = (consumer_y + h_consumer + GAP) if n_consumer else 80
    gcp_inner_top = gcp_y + GCP_PAD + GCP_LABEL  # below pill label

    if has_gcp:
        zone_rects["gcp"] = {"x": GCP_X, "y": gcp_y, "w": GCP_W, "h": gcp_h}

    # ── LEFT column zones ──
    y_cursor = gcp_inner_top

    if n_security:
        zone_rects["gcp-security"] = {"x": COL_L_X, "y": y_cursor, "w": COL_L_W, "h": h_security}
        y_cursor += h_security + GAP

    if n_governance:
        zone_rects["governance"] = {"x": COL_L_X, "y": y_cursor, "w": COL_L_W, "h": h_governance}

    # ── CENTER column zones ──
    y_cursor = gcp_inner_top

    if n_serving:
        zone_rects["serving"] = {"x": COL_C_X, "y": y_cursor, "w": COL_C_W, "h": h_serving}
        y_cursor += h_serving + GAP

    if h_pipeline > 0:
        pipe_x = COL_C_X
        pipe_y = y_cursor
        zone_rects["data-pipeline"] = {"x": pipe_x, "y": pipe_y, "w": COL_C_W, "h": h_pipeline}

        # Internal cursor within pipeline
        py = pipe_y + LABEL_H + ZONE_PAD

        if n_medallion:
            zone_rects["medallion"] = {"x": pipe_x + ZONE_PAD // 2, "y": py,
                                       "w": COL_C_W - ZONE_PAD, "h": h_medallion_z}
            py += h_medallion_z + GAP

        # processing, landing, ingestion Y offsets stored for node placement
        proc_y = py if n_processing else 0
        if n_processing:
            py += h_processing + GAP

        land_y = py if n_landing else 0
        if n_landing:
            py += h_landing + GAP

        ing_y = py if n_ingestion else 0

    # ── RIGHT column zones ──
    y_cursor = gcp_inner_top

    if n_obs:
        zone_rects["gcp-obs"] = {"x": COL_R_X, "y": y_cursor, "w": COL_R_W, "h": h_obs}
        y_cursor += h_obs + GAP

    if n_orch:
        zone_rects["orchestration"] = {"x": COL_R_X, "y": y_cursor, "w": COL_R_W, "h": h_orch}

    # ── Outside-left zones (ext-identity, source) ──
    y_cursor = gcp_y  # align with GCP top

    if n_ext_id:
        h_ext_id = _zone_h(n_ext_id, 1)
        zone_rects["ext-identity"] = {"x": OUTSIDE_X, "y": y_cursor, "w": OUTSIDE_W, "h": h_ext_id}
        y_cursor += h_ext_id + GAP

    if n_source:
        h_source = _zone_h(n_source, 1)
        zone_rects["source"] = {"x": OUTSIDE_X, "y": y_cursor, "w": OUTSIDE_W, "h": h_source}

    # ── External zones below GCP ──
    ext_y = gcp_y + gcp_h + GAP if has_gcp else gcp_y + GAP

    if n_ext_log:
        elw = max(_zone_w(n_ext_log, 2), 200)
        zone_rects["ext-log"] = {"x": GCP_X, "y": ext_y, "w": elw, "h": _zone_h(n_ext_log, 2)}

    if n_ext_alert:
        eaw = max(_zone_w(n_ext_alert, 2), 200)
        ea_x = (zone_rects["ext-log"]["x"] + zone_rects["ext-log"]["w"] + GAP) if "ext-log" in zone_rects else GCP_X
        zone_rects["ext-alert"] = {"x": ea_x, "y": ext_y, "w": eaw, "h": _zone_h(n_ext_alert, 2)}

    # ══════════════════════════════════════════════
    # PHASE 2: Place nodes inside zones
    # ══════════════════════════════════════════════

    # Consumer
    if n_consumer and "consumer" in zone_rects:
        zr = zone_rects["consumer"]
        nodes.extend(_place_in_zone(zone_buckets["consumer"], zr["x"], zr["y"], zr["w"], max_cols=4))

    # External identity
    if n_ext_id and "ext-identity" in zone_rects:
        zr = zone_rects["ext-identity"]
        nodes.extend(_place_in_zone(zone_buckets["ext-identity"], zr["x"], zr["y"], zr["w"], max_cols=1))

    # Source
    if n_source and "source" in zone_rects:
        zr = zone_rects["source"]
        nodes.extend(_place_in_zone(zone_buckets["source"], zr["x"], zr["y"], zr["w"], max_cols=1))

    # Security
    if n_security and "gcp-security" in zone_rects:
        zr = zone_rects["gcp-security"]
        nodes.extend(_place_in_zone(zone_buckets["gcp-security"], zr["x"], zr["y"], zr["w"], max_cols=1))

    # Serving (all serving nodes in center column, 2-col grid)
    if n_serving and "serving" in zone_rects:
        zr = zone_rects["serving"]
        nodes.extend(_place_in_zone(zone_buckets["serving"], zr["x"], zr["y"], zr["w"], max_cols=2))

    # Orchestration
    if n_orch and "orchestration" in zone_rects:
        zr = zone_rects["orchestration"]
        nodes.extend(_place_in_zone(zone_buckets["orchestration"], zr["x"], zr["y"], zr["w"], max_cols=2))

    # Observability
    if n_obs and "gcp-obs" in zone_rects:
        zr = zone_rects["gcp-obs"]
        nodes.extend(_place_in_zone(zone_buckets["gcp-obs"], zr["x"], zr["y"], zr["w"], max_cols=2))

    # Governance
    if n_governance and "governance" in zone_rects:
        zr = zone_rects["governance"]
        nodes.extend(_place_in_zone(zone_buckets["governance"], zr["x"], zr["y"], zr["w"], max_cols=1))

    # Pipeline internals
    if h_pipeline > 0:
        pipe_r = zone_rects["data-pipeline"]

        # Medallion (inside its own sub-zone)
        if n_medallion and "medallion" in zone_rects:
            mr = zone_rects["medallion"]
            medal_list = zone_buckets["medallion"]
            medal_order = {"bronze": 0, "silver": 1, "gold": 2}
            medal_list.sort(key=lambda p: medal_order.get(p, 5))
            nodes.extend(_place_in_zone(medal_list, mr["x"], mr["y"], mr["w"],
                                        max_cols=3, h_space=MEDAL_SPACE))

        # Processing (raw section, no zone rect)
        if n_processing:
            nodes.extend(_place_raw(zone_buckets["processing"],
                                    pipe_r["x"], pipe_r["w"], proc_y, max_cols=2))

        # Landing
        if n_landing:
            nodes.extend(_place_raw(zone_buckets["landing"],
                                    pipe_r["x"], pipe_r["w"], land_y, max_cols=2))

        # Ingestion
        if n_ingestion:
            nodes.extend(_place_raw(zone_buckets["ingestion"],
                                    pipe_r["x"], pipe_r["w"], ing_y, max_cols=2))

    # External logging
    if n_ext_log and "ext-log" in zone_rects:
        zr = zone_rects["ext-log"]
        nodes.extend(_place_in_zone(zone_buckets["ext-log"], zr["x"], zr["y"], zr["w"], max_cols=2))

    # External alerting
    if n_ext_alert and "ext-alert" in zone_rects:
        zr = zone_rects["ext-alert"]
        nodes.extend(_place_in_zone(zone_buckets["ext-alert"], zr["x"], zr["y"], zr["w"], max_cols=2))

    # ══════════════════════════════════════════════
    # PHASE 3: Build zone output for frontend
    # ══════════════════════════════════════════════
    zones_out = []
    for zd in ZONE_DEFS:
        zid = zd["id"]
        if zid in zone_rects:
            zr = zone_rects[zid]
            zones_out.append({**zd, "x": zr["x"], "y": zr["y"], "w": zr["w"], "h": zr["h"]})

    # ══════════════════════════════════════════════
    # EDGES
    # ══════════════════════════════════════════════
    node_ids = {n["id"] for n in nodes}
    edge_id = 0
    seen_pairs: set = set()

    for rule in EDGE_RULES:
        to_id = rule["to"]
        if to_id not in node_ids:
            continue
        from_ids = [fid for fid in rule["from_any"] if fid in node_ids]
        for fid in from_ids:
            pair = (fid, to_id)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            edge_id += 1

            edge: Dict[str, Any] = {
                "id": f"e{edge_id}",
                "from": fid,
                "to": to_id,
                "label": rule.get("label", ""),
                "edgeType": rule.get("edgeType", "data"),
            }

            # Boundary crossing
            from_zone = PRODUCTS.get(fid, {}).get("zone", "")
            to_zone = PRODUCTS.get(to_id, {}).get("zone", "")
            if from_zone == "source" and to_zone in GCP_ZONES:
                edge["crossesBoundary"] = True
            if to_zone == "consumer":
                edge["crossesBoundary"] = True

            # Security metadata
            if "security" in rule:
                edge["security"] = rule["security"]

            edges.append(edge)

    # ══════════════════════════════════════════════
    # PHASES — named to match canvas layer band renderer
    # Canvas looks for phases prefixed: L3, L4, L5, L6, L7
    # ══════════════════════════════════════════════
    phase_map = [
        ("l1",   "L1 — Sources",              {"source"}),
        ("l2",   "L2 — Connectivity & Identity", {"gcp-security", "ext-identity"}),
        ("l3",   "L3 — Ingestion",            {"ingestion"}),
        ("l4",   "L4 — Landing",              {"landing"}),
        ("l5",   "L5 — Processing",           {"processing"}),
        ("l6",   "L6 — Medallion",            {"medallion"}),
        ("l7",   "L7 — Serving",              {"serving"}),
        ("l8",   "L8 — Consumers",            {"consumer"}),
    ]
    phases = []
    for pid, pname, zone_set in phase_map:
        nids = [n["id"] for n in nodes if PRODUCTS.get(n["id"], {}).get("zone") in zone_set]
        if nids:
            phases.append({"id": pid, "name": pname, "nodeIds": nids})

    ops_ids = [n["id"] for n in nodes if PRODUCTS.get(n["id"], {}).get("zone") in
               {"orchestration", "gcp-obs", "ext-log", "ext-alert", "governance"}]
    ops_group = {"name": "Operations & Observability", "nodeIds": ops_ids} if ops_ids else None

    diagram = {
        "title": title,
        "subtitle": f"{len(nodes)} products · {len(edges)} connections · Editable canvas",
        "nodes": nodes,
        "edges": edges,
        "phases": phases,
        "zones": zones_out,
        "colors": COLORS,
    }
    if ops_group:
        diagram["opsGroup"] = ops_group

    return diagram
