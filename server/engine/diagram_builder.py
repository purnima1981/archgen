"""
Diagram Builder — converts mingrammer product set → interactive Diagram JSON

Maps kept product IDs to canvas nodes with:
  - Display name, icon ID, subtitle
  - Zone (sources / cloud / consumers / connectivity)
  - Layer-based x/y layout
  - Auto-generated edges based on data flow rules
  - Edge security metadata
  - Threat model stubs

Output matches the TypeScript Diagram interface exactly.
"""

from typing import Set, Dict, List, Any

# ═══════════════════════════════════════════════════════════
# PRODUCT CATALOG — every product the engine can select
# ═══════════════════════════════════════════════════════════

PRODUCTS: Dict[str, Dict[str, Any]] = {
    # ── L1: Sources ──
    "oracle_db":       {"name": "Oracle DB",        "icon": "oracle",      "zone": "sources",  "layer": 1, "subtitle": "On-prem RDBMS"},
    "sqlserver_db":    {"name": "SQL Server",        "icon": "sqlserver",   "zone": "sources",  "layer": 1, "subtitle": "On-prem RDBMS"},
    "postgresql_db":   {"name": "PostgreSQL",        "icon": "postgresql",  "zone": "sources",  "layer": 1, "subtitle": "WAL-based CDC"},
    "mongodb_db":      {"name": "MongoDB",           "icon": "mongodb",     "zone": "sources",  "layer": 1, "subtitle": "Change streams"},
    "aws_s3":          {"name": "AWS S3",            "icon": "aws_s3",      "zone": "sources",  "layer": 1, "subtitle": "Cross-cloud"},
    "salesforce":      {"name": "Salesforce",        "icon": "salesforce",  "zone": "sources",  "layer": 1, "subtitle": "CRM SaaS"},
    "workday":         {"name": "Workday",           "icon": "workday",     "zone": "sources",  "layer": 1, "subtitle": "HCM SaaS"},
    "servicenow_src":  {"name": "ServiceNow",        "icon": "servicenow",  "zone": "sources",  "layer": 1, "subtitle": "ITSM SaaS"},
    "sap_src":         {"name": "SAP ERP",           "icon": "sap",         "zone": "sources",  "layer": 1, "subtitle": "OData/BAPI"},
    "kafka_stream":    {"name": "Kafka",             "icon": "kafka",       "zone": "sources",  "layer": 1, "subtitle": "Event streaming"},
    "cloud_sql":       {"name": "Cloud SQL",         "icon": "cloud_sql",   "zone": "sources",  "layer": 1, "subtitle": "GCP-native DB"},
    "sftp_server":     {"name": "SFTP Server",       "icon": "sftp_server", "zone": "sources",  "layer": 1, "subtitle": "Legacy file transfer"},

    # ── L2: Connectivity / Identity ──
    "cloud_iam":       {"name": "Cloud IAM",         "icon": "identity_and_access_management", "zone": "cloud", "layer": 2, "subtitle": "Identity & Access"},
    "secret_manager":  {"name": "Secret Manager",    "icon": "secret_manager",  "zone": "cloud", "layer": 2, "subtitle": "Credential vault"},
    "cloud_vpn":       {"name": "Cloud VPN",         "icon": "cloud_vpn",       "zone": "cloud", "layer": 2, "subtitle": "IPSec tunnel"},
    "vpc":             {"name": "VPC Network",       "icon": "virtual_private_cloud", "zone": "cloud", "layer": 2, "subtitle": "Private network"},
    "vpc_sc":          {"name": "VPC-SC",            "icon": "cloud_armor",     "zone": "cloud", "layer": 2, "subtitle": "Service perimeter"},
    "cloud_armor":     {"name": "Cloud Armor",       "icon": "cloud_armor",     "zone": "cloud", "layer": 2, "subtitle": "WAF / DDoS"},
    "apigee":          {"name": "Apigee",            "icon": "apigee_api_platform", "zone": "cloud", "layer": 2, "subtitle": "API gateway"},
    "entra_id":        {"name": "Entra ID (AAD)",    "icon": "entra_id",        "zone": "cloud", "layer": 2, "subtitle": "SSO / Federation"},
    "cyberark":        {"name": "CyberArk",          "icon": "cyberark",        "zone": "cloud", "layer": 2, "subtitle": "PAM vault"},

    # ── L3: Ingestion ──
    "datastream":      {"name": "Datastream",        "icon": "datastream",      "zone": "cloud", "layer": 3, "subtitle": "Serverless CDC"},
    "pubsub":          {"name": "Pub/Sub",           "icon": "pubsub",          "zone": "cloud", "layer": 3, "subtitle": "Message bus"},
    "dataflow_ing":    {"name": "Dataflow",          "icon": "dataflow",        "zone": "cloud", "layer": 3, "subtitle": "Stream ingestion"},
    "bq_dts":          {"name": "BQ Data Transfer",  "icon": "bigquery",        "zone": "cloud", "layer": 3, "subtitle": "Scheduled loads (FREE)"},
    "cloud_functions": {"name": "Cloud Functions",   "icon": "cloud_functions", "zone": "cloud", "layer": 3, "subtitle": "Serverless API pull"},
    "fivetran":        {"name": "Fivetran",          "icon": "fivetran",        "zone": "cloud", "layer": 3, "subtitle": "Managed ELT"},
    "matillion":       {"name": "Matillion",         "icon": None,              "zone": "cloud", "layer": 3, "subtitle": "Visual ETL"},
    "data_fusion":     {"name": "Data Fusion",       "icon": None,              "zone": "cloud", "layer": 3, "subtitle": "Visual ETL (SAP)"},
    "storage_transfer":{"name": "Storage Transfer",  "icon": "cloud_storage",   "zone": "cloud", "layer": 3, "subtitle": "Bulk file moves"},

    # ── L4: Landing ──
    "gcs_raw":         {"name": "GCS Raw Zone",      "icon": "cloud_storage",   "zone": "cloud", "layer": 4, "subtitle": "Landing bucket"},
    "bq_staging":      {"name": "BQ Staging",        "icon": "bigquery",        "zone": "cloud", "layer": 4, "subtitle": "Staging datasets"},

    # ── L5: Processing ──
    "dataform":        {"name": "Dataform",          "icon": None,              "zone": "cloud", "layer": 5, "subtitle": "SQL ELT (FREE)"},
    "dataflow_proc":   {"name": "Dataflow",          "icon": "dataflow",        "zone": "cloud", "layer": 5, "subtitle": "Stream processing"},
    "dataproc":        {"name": "Dataproc",          "icon": "dataproc",        "zone": "cloud", "layer": 5, "subtitle": "Spark / Hadoop"},
    "dataplex_dq":     {"name": "Dataplex DQ",       "icon": "dataplex",        "zone": "cloud", "layer": 5, "subtitle": "Data quality"},
    "cloud_dlp":       {"name": "Cloud DLP",         "icon": None,              "zone": "cloud", "layer": 5, "subtitle": "PII detection"},

    # ── L6: Medallion ──
    "bronze":          {"name": "Bronze",            "icon": None,  "zone": "cloud", "layer": 6, "subtitle": "Raw / deduplicated"},
    "silver":          {"name": "Silver",            "icon": None,  "zone": "cloud", "layer": 6, "subtitle": "Cleaned / conformed"},
    "gold":            {"name": "Gold",              "icon": None,  "zone": "cloud", "layer": 6, "subtitle": "Curated / aggregated"},

    # ── L7: Serving ──
    "looker":          {"name": "Looker",            "icon": "looker",        "zone": "cloud", "layer": 7, "subtitle": "Governed BI"},
    "looker_studio":   {"name": "Looker Studio",     "icon": "looker",        "zone": "cloud", "layer": 7, "subtitle": "Free dashboards"},
    "power_bi":        {"name": "Power BI",          "icon": None,            "zone": "cloud", "layer": 7, "subtitle": "Self-service BI"},
    "cloud_run":       {"name": "Cloud Run",         "icon": "cloud_run",     "zone": "cloud", "layer": 7, "subtitle": "API serving"},
    "vertex_ai":       {"name": "Vertex AI",         "icon": "vertexai",      "zone": "cloud", "layer": 7, "subtitle": "ML platform"},
    "analytics_hub":   {"name": "Analytics Hub",     "icon": "analytics_hub", "zone": "cloud", "layer": 7, "subtitle": "Data exchange"},

    # ── L8: Consumers ──
    "analysts":        {"name": "Analysts",          "icon": "analyst",         "zone": "consumers", "layer": 8, "subtitle": "BI users"},
    "data_scientists": {"name": "Data Scientists",   "icon": "developer",       "zone": "consumers", "layer": 8, "subtitle": "ML / notebooks"},
    "downstream_sys":  {"name": "Downstream Systems","icon": "rest_api",        "zone": "consumers", "layer": 8, "subtitle": "API consumers"},
    "executives":      {"name": "Executives",        "icon": "admin_user",      "zone": "consumers", "layer": 8, "subtitle": "C-suite reports"},

    # ── Orchestration ──
    "cloud_composer":  {"name": "Cloud Composer",    "icon": "cloud_composer",  "zone": "cloud", "layer": 9, "subtitle": "Airflow DAGs"},
    "cloud_scheduler": {"name": "Cloud Scheduler",   "icon": "cloud_scheduler", "zone": "cloud", "layer": 9, "subtitle": "Cron triggers"},

    # ── Observability ──
    "cloud_monitoring":{"name": "Cloud Monitoring",  "icon": "cloud_monitoring","zone": "cloud", "layer": 10, "subtitle": "Metrics & alerts"},
    "cloud_logging":   {"name": "Cloud Logging",     "icon": "cloud_logging",   "zone": "cloud", "layer": 10, "subtitle": "Centralized logs"},
    "pagerduty_inc":   {"name": "PagerDuty",         "icon": "pagerduty",       "zone": "consumers", "layer": 10, "subtitle": "Incident management"},
    "splunk_siem":     {"name": "Splunk SIEM",       "icon": "splunk",          "zone": "consumers", "layer": 10, "subtitle": "Security events"},
    "dynatrace_apm":   {"name": "Dynatrace",         "icon": "dynatrace",       "zone": "consumers", "layer": 10, "subtitle": "APM"},

    # ── Security / Governance ──
    "cloud_kms":       {"name": "Cloud KMS",         "icon": "key_management_service", "zone": "cloud", "layer": 2, "subtitle": "CMEK encryption"},
    "scc_pillar":      {"name": "Security Command Center", "icon": "security_command_center", "zone": "cloud", "layer": 10, "subtitle": "Security posture"},
    "audit_logs":      {"name": "Audit Logs",        "icon": None,              "zone": "cloud", "layer": 10, "subtitle": "Compliance trail"},
    "dataplex":        {"name": "Dataplex",          "icon": "dataplex",        "zone": "cloud", "layer": 5, "subtitle": "Data governance"},
    "data_catalog":    {"name": "Data Catalog",      "icon": "data_catalog",    "zone": "cloud", "layer": 5, "subtitle": "Metadata / lineage"},
    "wiz_cspm":        {"name": "Wiz",               "icon": "wiz",             "zone": "cloud", "layer": 10, "subtitle": "Cloud security"},
    "archer_grc":      {"name": "RSA Archer",        "icon": None,              "zone": "consumers", "layer": 10, "subtitle": "GRC platform"},
}

# ═══════════════════════════════════════════════════════════
# LAYOUT — x position per layer, spacing
# ═══════════════════════════════════════════════════════════

LAYER_X = {
    1: 100,     # Sources
    2: 300,     # Connectivity
    3: 480,     # Ingestion
    4: 640,     # Landing
    5: 800,     # Processing
    6: 920,     # Medallion
    7: 1060,    # Serving
    8: 1250,    # Consumers
    9: 640,     # Orchestration (bottom center)
    10: 900,    # Observability (bottom right)
}

Y_START = 80
Y_SPACING = 110
CROSSCUT_Y_START = 650  # orchestration/observability below main flow


# ═══════════════════════════════════════════════════════════
# EDGE RULES — auto-generated data flow
# ═══════════════════════════════════════════════════════════

EDGE_RULES = [
    # Source → Ingestion
    {"from_any": ["oracle_db", "sqlserver_db", "postgresql_db"], "to": "datastream",   "label": "CDC", "security": {"transport": "TLS 1.3 + IPSec", "auth": "Service Account", "classification": "PII / Confidential", "private": True}},
    {"from_any": ["mongodb_db"],                                 "to": "datastream",   "label": "Change stream", "security": {"transport": "TLS 1.3", "auth": "x509 cert", "classification": "PII", "private": True}},
    {"from_any": ["kafka_stream"],                               "to": "pubsub",       "label": "Events", "security": {"transport": "TLS 1.3", "auth": "SASL/OAuth", "classification": "Transactional", "private": True}},
    {"from_any": ["aws_s3"],                                     "to": "bq_dts",       "label": "S3 → BQ", "security": {"transport": "TLS 1.3", "auth": "WIF (OIDC)", "classification": "Business data", "private": True}},
    {"from_any": ["aws_s3"],                                     "to": "storage_transfer", "label": "Bulk copy", "security": {"transport": "TLS 1.3", "auth": "WIF", "classification": "Business data", "private": True}},
    {"from_any": ["salesforce", "workday", "servicenow_src"],    "to": "cloud_functions", "label": "API pull", "security": {"transport": "HTTPS", "auth": "OAuth 2.0", "classification": "PII / HR", "private": False}},
    {"from_any": ["salesforce", "workday", "servicenow_src"],    "to": "fivetran",     "label": "Managed ELT", "security": {"transport": "HTTPS", "auth": "OAuth 2.0", "classification": "PII", "private": False}},
    {"from_any": ["sap_src"],                                    "to": "data_fusion",  "label": "OData", "security": {"transport": "HTTPS + VPN", "auth": "Service Account", "classification": "ERP / Financial", "private": True}},
    {"from_any": ["sftp_server"],                                "to": "cloud_functions", "label": "File pull", "security": {"transport": "SSH/SFTP", "auth": "SSH key", "classification": "Business data", "private": True}},
    {"from_any": ["cloud_sql"],                                  "to": "datastream",   "label": "CDC", "security": {"transport": "Private IP", "auth": "IAM DB Auth", "classification": "App data", "private": True}},

    # Ingestion → Landing
    {"from_any": ["datastream", "cloud_functions", "data_fusion", "storage_transfer"], "to": "gcs_raw", "label": "Raw files", "step": 1},
    {"from_any": ["bq_dts", "fivetran", "matillion", "dataflow_ing"], "to": "bq_staging", "label": "Direct load", "step": 1},
    {"from_any": ["pubsub"],          "to": "dataflow_ing", "label": "Stream", "step": 1},

    # Landing → Processing
    {"from_any": ["gcs_raw"],         "to": "dataform",     "label": "ELT", "step": 2},
    {"from_any": ["gcs_raw"],         "to": "dataflow_proc","label": "Process", "step": 2},
    {"from_any": ["gcs_raw"],         "to": "dataproc",     "label": "Spark", "step": 2},
    {"from_any": ["bq_staging"],      "to": "dataform",     "label": "SQL transform", "step": 2},
    {"from_any": ["bq_staging"],      "to": "dataflow_proc","label": "Process", "step": 2},
    {"from_any": ["bq_staging"],      "to": "dataproc",     "label": "Spark job", "step": 2},

    # Processing → Medallion
    {"from_any": ["dataform", "dataflow_proc", "dataproc"], "to": "bronze", "label": "Ingest", "step": 3},
    {"from_any": ["bronze"],          "to": "silver",       "label": "Clean", "step": 4},
    {"from_any": ["silver"],          "to": "gold",         "label": "Curate", "step": 5},

    # Medallion → Serving
    {"from_any": ["gold"],            "to": "looker",       "label": "BI", "step": 6},
    {"from_any": ["gold"],            "to": "looker_studio","label": "Dashboards", "step": 6},
    {"from_any": ["gold"],            "to": "power_bi",     "label": "Self-service", "step": 6},
    {"from_any": ["gold"],            "to": "cloud_run",    "label": "API", "step": 6},
    {"from_any": ["gold"],            "to": "vertex_ai",    "label": "ML features", "step": 6},
    {"from_any": ["gold"],            "to": "analytics_hub","label": "Share", "step": 6},

    # Serving → Consumers
    {"from_any": ["looker", "looker_studio", "power_bi"], "to": "analysts",       "label": "Reports", "step": 7},
    {"from_any": ["vertex_ai"],       "to": "data_scientists", "label": "Notebooks", "step": 7},
    {"from_any": ["cloud_run", "analytics_hub"], "to": "downstream_sys", "label": "API / Feed", "step": 7},
    {"from_any": ["looker"],          "to": "executives",   "label": "Dashboards", "step": 7},

    # Orchestration (control edges)
    {"from_any": ["cloud_composer"],  "to": "dataform",     "label": "Trigger DAG", "edgeType": "control"},
    {"from_any": ["cloud_composer"],  "to": "dataflow_proc","label": "Trigger DAG", "edgeType": "control"},
    {"from_any": ["cloud_composer"],  "to": "dataproc",     "label": "Trigger DAG", "edgeType": "control"},
    {"from_any": ["cloud_scheduler"], "to": "cloud_functions", "label": "Cron", "edgeType": "control"},

    # Observability (observe edges)
    {"from_any": ["cloud_monitoring"],"to": "pagerduty_inc","label": "Alerts", "edgeType": "alert"},
    {"from_any": ["cloud_logging"],   "to": "splunk_siem",  "label": "Log export", "edgeType": "observe"},
]


# ═══════════════════════════════════════════════════════════
# BUILD DIAGRAM
# ═══════════════════════════════════════════════════════════

def build_diagram(keep_set: Set[str], title: str, decisions: List[str], anti_patterns: List[str]) -> dict:
    """
    Convert a keep_set of product IDs into a full Diagram JSON
    matching the TypeScript Diagram interface.
    """
    nodes = []
    edges = []

    # ── Build nodes with layout ──
    # Group by layer, then assign y positions within each layer
    layer_counts: Dict[int, int] = {}
    
    for pid in sorted(keep_set):
        prod = PRODUCTS.get(pid)
        if not prod:
            continue
        
        layer = prod["layer"]
        idx = layer_counts.get(layer, 0)
        layer_counts[layer] = idx + 1

        # Crosscutting layers (9, 10) go below main flow
        if layer >= 9:
            x = LAYER_X.get(layer, 800) + idx * 170
            y = CROSSCUT_Y_START + (layer - 9) * Y_SPACING
        else:
            x = LAYER_X.get(layer, 500)
            y = Y_START + idx * Y_SPACING

        node = {
            "id": pid,
            "name": prod["name"],
            "icon": prod["icon"],
            "subtitle": prod["subtitle"],
            "zone": prod["zone"],
            "x": x,
            "y": y,
            "details": {
                "notes": f"Selected by knowledge engine"
            }
        }
        nodes.append(node)

    # ── Build edges (deduplicate by from+to pair) ──
    node_ids = {n["id"] for n in nodes}
    edge_id = 0
    seen_pairs = set()

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
                "step": rule.get("step", 0),
                "edgeType": rule.get("edgeType", "data"),
            }

            # Source → cloud edges cross boundary
            from_node = PRODUCTS.get(fid, {})
            to_node = PRODUCTS.get(to_id, {})
            if from_node.get("zone") == "sources" and to_node.get("zone") == "cloud":
                edge["crossesBoundary"] = True
                edge["step"] = 0  # parallel ingestion
            if from_node.get("zone") == "cloud" and to_node.get("zone") == "consumers":
                edge["crossesBoundary"] = True

            # Add security metadata from rule
            if "security" in rule:
                edge["security"] = rule["security"]
            elif edge.get("crossesBoundary"):
                edge["security"] = {
                    "transport": "TLS 1.3",
                    "auth": "Service Account + IAM",
                    "classification": "Internal",
                    "private": True
                }
            
            edges.append(edge)

    # ── Build phases ──
    phase_map = [
        ("ingestion", "Ingestion", [1, 2, 3]),
        ("landing",   "Landing & Storage", [4]),
        ("transform", "Transform", [5, 6]),
        ("serve",     "Serve & Consume", [7, 8]),
    ]
    phases = []
    for pid, pname, layers in phase_map:
        nids = [n["id"] for n in nodes if PRODUCTS.get(n["id"], {}).get("layer") in layers]
        if nids:
            phases.append({"id": pid, "name": pname, "nodeIds": nids})

    # ── Ops group ──
    ops_ids = [n["id"] for n in nodes if PRODUCTS.get(n["id"], {}).get("layer") in [9, 10]]
    ops_group = {"name": "Operations & Observability", "nodeIds": ops_ids} if ops_ids else None

    diagram = {
        "title": title,
        "subtitle": f"{len(nodes)} products · {len(edges)} connections · Editable canvas",
        "nodes": nodes,
        "edges": edges,
        "phases": phases,
    }
    if ops_group:
        diagram["opsGroup"] = ops_group

    return diagram
