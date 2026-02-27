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
# LAYOUT CONSTANTS (SVG coordinate space 0-1520 x 0-1280)
# These match the React mockup and PPTX exporter exactly
# ═══════════════════════════════════════════════════════════

# ── ZONE X POSITIONS ──
X_SOURCE       = 70     # L1 sources, far left
X_EXT_ID       = 70     # External identity, far left
X_GCP_SEC      = 460    # L2 security column, left inside GCP
X_PIPELINE     = 660    # L3-L5 pipeline column (left edge)
X_SERVING      = 660    # L7 serving
X_SERVING_2    = 1100   # L7 overflow (Vertex AI etc)
X_ORCH         = 1100   # Orchestration (right side)
X_GCP_OBS      = 1100   # GCP observability
X_GCP_OBS_2    = 1280   # Obs overflow (Audit Logs)
X_EXT_LOG      = 460    # External logging, below GCP
X_EXT_ALERT    = 880    # External alerting, below GCP
X_CONSUMER     = 660    # L8 consumers, top

# ── MEDALLION HORIZONTAL (Bronze → Silver → Gold) ──
X_MEDAL_START  = 660    # Bronze starts here
X_MEDAL_SPACE  = 170    # spacing between each medal tier

# ── ZONE Y POSITIONS ──
Y_CONSUMER     = 60     # L8 consumers at top

# GCP internals (BOTTOM-UP: ingestion at bottom, serving at top)
Y_SERVING      = 250    # L7 top of GCP

# ── DATA PIPELINE GROUP (L3→L6 unified) ──
Y_MEDALLION    = 430    # L6 medallion — HORIZONTAL row (top of pipeline group)
Y_PROCESSING   = 580    # L5 processing
Y_LANDING      = 730    # L4 landing
Y_INGESTION    = 880    # L3 ingestion (bottom of pipeline group)

Y_ORCH         = 430    # Orchestration (right side, same row as medallion)

# Security column spread across full GCP height
Y_SEC_START    = 250
Y_SEC_SPACING  = 140

# External identity (outside left)
Y_EXT_ID_START = 280
Y_EXT_ID_SPACE = 140

# Source (outside left)
Y_SOURCE_START = 480
Y_SOURCE_SPACE = 130

# External boxes below GCP
Y_EXTERNAL     = 1110

# Spacing within a zone when multiple nodes
NODE_SPACING   = 150     # horizontal spacing for same-y nodes
VERT_SPACING   = 140     # vertical spacing for stacked nodes


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
    "vertex_ai": 10, "cloud_run": 11, "analytics_hub": 12,
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
]


# ═══════════════════════════════════════════════════════════
# ZONE DEFINITIONS — with authoritative SVG geometry
# Coordinates are in SVG space (0–1520 x 0–1280)
# Sourced from pptx_exporter.py ZONES — the proven non-overlapping layout.
#
# zIndex:  0 = outside zones, 1 = GCP boundary, 2 = GCP sub-zones, 3 = innermost
# parent:  None = top-level, "gcp" = inside GCP, "data-pipeline" = inside pipeline
# ═══════════════════════════════════════════════════════════

ZONE_DEFS = [
    # ── Outside zones (rendered first, lowest z) ─────────────────
    {"id": "consumer",      "label": "CONSUMERS (L8)",
     "color": COLORS["consumer"],   "dashed": True,
     "x": 620,  "y": 10,   "w": 580,  "h": 170,
     "parent": None,            "zIndex": 0},

    {"id": "ext-identity",  "label": "EXTERNAL IDENTITY",
     "color": COLORS["extId"],      "dashed": True,
     "x": 30,   "y": 230,  "w": 210,  "h": 230,
     "parent": None,            "zIndex": 0},

    {"id": "source",        "label": "ON-PREM SOURCE (L1)",
     "color": COLORS["source"],     "dashed": True,
     "x": 30,   "y": 470,  "w": 350,  "h": 560,
     "parent": None,            "zIndex": 0},

    # ── GCP boundary (large wrapper) ─────────────────────────────
    {"id": "gcp",           "label": "GOOGLE CLOUD PLATFORM",
     "color": COLORS["gcp"],        "dashed": False,  "filled": True,
     "x": 410,  "y": 210,  "w": 1070, "h": 830,
     "parent": None,            "zIndex": 1},

    # ── Sub-zones inside GCP (rendered after GCP, higher z) ──────
    {"id": "gcp-security",  "label": "CONNECTIVITY & IDENTITY (L2)",
     "color": COLORS["security"],   "dashed": True,
     "x": 425,  "y": 225,  "w": 195,  "h": 620,
     "parent": "gcp",           "zIndex": 2},

    {"id": "serving",       "label": "SERVING & DELIVERY (L7)",
     "color": COLORS["serving"],    "dashed": True,
     "x": 635,  "y": 225,  "w": 430,  "h": 160,
     "parent": "gcp",           "zIndex": 2},

    {"id": "orchestration", "label": "ORCHESTRATION",
     "color": COLORS["orch"],       "dashed": True,
     "x": 1080, "y": 390,  "w": 195,  "h": 200,
     "parent": "gcp",           "zIndex": 2},

    {"id": "data-pipeline", "label": "DATA PIPELINE (L3→L6)",
     "color": COLORS["pipeline"],   "dashed": True,
     "x": 635,  "y": 395,  "w": 430,  "h": 560,
     "parent": "gcp",           "zIndex": 2},

    {"id": "gcp-obs",       "label": "OBSERVABILITY (GCP)",
     "color": COLORS["gcpObs"],     "dashed": True,
     "x": 1080, "y": 610,  "w": 380,  "h": 410,
     "parent": "gcp",           "zIndex": 2},

    {"id": "governance",    "label": "GOVERNANCE",
     "color": COLORS["governance"], "dashed": True,
     "x": 425,  "y": 860,  "w": 195,  "h": 160,
     "parent": "gcp",           "zIndex": 2},

    # ── Medallion (innermost — inside data-pipeline) ─────────────
    {"id": "medallion",     "label": "MEDALLION ARCHITECTURE",
     "color": COLORS["gold"],       "dashed": False,  "filled": True,
     "x": 645,  "y": 400,  "w": 410,  "h": 120,
     "parent": "data-pipeline",  "zIndex": 3},

    # ── External zones below GCP ─────────────────────────────────
    {"id": "ext-log",       "label": "EXTERNAL LOGGING",
     "color": COLORS["extLog"],     "dashed": True,
     "x": 410,  "y": 1100, "w": 330,  "h": 195,
     "parent": None,            "zIndex": 0},

    {"id": "ext-alert",     "label": "EXTERNAL ALERTING",
     "color": COLORS["extAlert"],   "dashed": True,
     "x": 830,  "y": 1100, "w": 430,  "h": 195,
     "parent": None,            "zIndex": 0},
]

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


def build_diagram(keep_set: Set[str], title: str,
                  decisions: List[str], anti_patterns: List[str]) -> dict:
    """
    Convert a keep_set of product IDs into a full Diagram JSON.
    Zone-based layout with bottom-up flow inside GCP.
    Accepts IDs from BOTH gcp_blueprint.py and diagram_builder.py.
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

    # ── CONSUMERS (top) ──
    for i, pid in enumerate(zone_buckets.get("consumer", [])):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_CONSUMER + i * NODE_SPACING, Y_CONSUMER))

    # ── EXTERNAL IDENTITY (outside left) ──
    for i, pid in enumerate(zone_buckets.get("ext-identity", [])):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_EXT_ID, Y_EXT_ID_START + i * Y_EXT_ID_SPACE))

    # ── SOURCE (outside left, below ext-id) ──
    for i, pid in enumerate(zone_buckets.get("source", [])):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_SOURCE, Y_SOURCE_START + i * Y_SOURCE_SPACE))

    # ── GCP SECURITY (left column inside GCP, dynamic spacing) ──
    sec_list = zone_buckets.get("gcp-security", [])
    max_sec_height = Y_INGESTION - Y_SEC_START  # must fit between top and bottom of GCP
    sec_spacing = min(Y_SEC_SPACING, max_sec_height // max(len(sec_list), 1))
    for i, pid in enumerate(sec_list):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_GCP_SEC, Y_SEC_START + i * sec_spacing))

    # ── INGESTION L3 (bottom of pipeline, max 2 per row) ──
    ing_list = zone_buckets.get("ingestion", [])
    for i, pid in enumerate(ing_list):
        col = i % 2
        row = i // 2
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_PIPELINE + col * NODE_SPACING,
                                Y_INGESTION + row * VERT_SPACING))

    # ── LANDING L4 ──
    land_list = zone_buckets.get("landing", [])
    for i, pid in enumerate(land_list):
        col = i % 2
        row = i // 2
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_PIPELINE + col * NODE_SPACING,
                                Y_LANDING + row * VERT_SPACING))

    # ── PROCESSING L5 ──
    proc_list = zone_buckets.get("processing", [])
    for i, pid in enumerate(proc_list):
        col = i % 2
        row = i // 2
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_PIPELINE + col * NODE_SPACING,
                                Y_PROCESSING + row * VERT_SPACING))

    # ── MEDALLION L6 (HORIZONTAL: Bronze → Silver → Gold) ──
    medal_list = zone_buckets.get("medallion", [])
    # Sort: bronze=0, silver=1, gold=2
    medal_order = {"bronze": 0, "silver": 1, "gold": 2}
    medal_list.sort(key=lambda p: medal_order.get(p, 5))
    for i, pid in enumerate(medal_list):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_MEDAL_START + i * X_MEDAL_SPACE, Y_MEDALLION))

    # ── SERVING L7 (top of GCP) ──
    serving_list = zone_buckets.get("serving", [])
    primary_serving = [p for p in serving_list if SORT_PRIORITY.get(p, 50) < 10]
    secondary_serving = [p for p in serving_list if SORT_PRIORITY.get(p, 50) >= 10]

    for i, pid in enumerate(primary_serving):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_SERVING + i * NODE_SPACING, Y_SERVING))
    for i, pid in enumerate(secondary_serving):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_SERVING_2 + i * NODE_SPACING, Y_PROCESSING))

    # ── ORCHESTRATION ──
    for i, pid in enumerate(zone_buckets.get("orchestration", [])):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_ORCH + i * NODE_SPACING, Y_ORCH))

    # ── GCP OBSERVABILITY ──
    obs_list = zone_buckets.get("gcp-obs", [])
    for i, pid in enumerate(obs_list):
        if i < 2:
            nodes.append(_make_node(pid, PRODUCTS[pid],
                                    X_GCP_OBS, Y_LANDING + i * VERT_SPACING))
        else:
            nodes.append(_make_node(pid, PRODUCTS[pid],
                                    X_GCP_OBS_2, Y_LANDING + (i - 2) * VERT_SPACING))

    # ── Find the bottom of GCP content ──
    gcp_bottom = Y_INGESTION  # minimum
    for n in nodes:
        z = PRODUCTS.get(n["id"], {}).get("zone", "")
        if z in GCP_ZONES:
            gcp_bottom = max(gcp_bottom, n["y"])
    gcp_bottom += 130  # room below last node

    # ── GOVERNANCE (below GCP content) ──
    gov_y = gcp_bottom + 30
    gov_list = zone_buckets.get("governance", [])
    for i, pid in enumerate(gov_list):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_EXT_LOG + i * NODE_SPACING, gov_y))

    # ── EXTERNAL LOGGING (below governance) ──
    ext_y = gov_y + (VERT_SPACING if gov_list else 0) + 60
    for i, pid in enumerate(zone_buckets.get("ext-log", [])):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_EXT_LOG + i * NODE_SPACING, ext_y))

    # ── EXTERNAL ALERTING (same row as ext-log) ──
    for i, pid in enumerate(zone_buckets.get("ext-alert", [])):
        nodes.append(_make_node(pid, PRODUCTS[pid],
                                X_EXT_ALERT + i * NODE_SPACING, ext_y))

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
    # ZONE BOXES (for frontend rendering)
    # ══════════════════════════════════════════════
    active_zones = set()
    for n in nodes:
        z = PRODUCTS.get(n["id"], {}).get("zone", "")
        active_zones.add(z)
        if z in GCP_ZONES:
            active_zones.add("gcp")
        if z in PIPELINE_ZONES:
            active_zones.add("pipeline")

    zones_out = []
    for zd in ZONE_DEFS:
        zid = zd["id"]
        # Only include zones that have nodes (or wrapper zones with active children)
        if zid == "gcp" and "gcp" in active_zones:
            zones_out.append(zd)
        elif zid == "data-pipeline" and "pipeline" in active_zones:
            zones_out.append(zd)
        elif zid == "medallion" and "medallion" in active_zones:
            zones_out.append(zd)
        elif zid in active_zones:
            zones_out.append(zd)

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
