"""
GCP DATA PLATFORM — MASTER BLUEPRINT (Python)

Proper Python conversion of templates.ts → GCP_TECHNICAL_BLUEPRINT.
Same IDs, same groupings — but with:
  ✅ `layer` + `group` on every node (no prefix guessing)
  ✅ Complete EDGES list (no hardcoded spaghetti)
  ✅ `details` (cost, compliance, notes) from templates.ts
  ✅ Clean slicer: pick sources → auto_wire → get_edges_for → done

Usage:
  from gcp_blueprint import NODES, EDGES, auto_wire, get_edges_for
  
  sources = {"src_oracle", "src_kafka"}
  keep, decisions = auto_wire(sources)
  edges = get_edges_for(keep)
"""

from typing import Dict, List, Any, Set, Tuple, Optional


# ═══════════════════════════════════════════════════════════
# SOURCE CATEGORIES — L1 sub-grouping for canvas layout
# ═══════════════════════════════════════════════════════════

SOURCE_CATEGORIES = [
    {"id": "crm_sales",   "label": "CRM & Sales",       "ids": ["src_salesforce", "src_hubspot", "src_dynamics365"]},
    {"id": "hr_finance",  "label": "HR & Finance",       "ids": ["src_workday", "src_sap", "src_netsuite", "src_adp", "src_bamboohr"]},
    {"id": "itsm_ops",    "label": "ITSM & Ops",         "ids": ["src_servicenow", "src_jira", "src_zendesk"]},
    {"id": "marketing",   "label": "Marketing & Ads",    "ids": ["src_google_ads", "src_facebook_ads", "src_google_analytics", "src_adobe_analytics", "src_marketo"]},
    {"id": "social",      "label": "Social & Apps",      "ids": ["src_facebook", "src_twitter", "src_linkedin", "src_instagram", "src_youtube", "src_tiktok"]},
    {"id": "app_stores",  "label": "App Stores",         "ids": ["src_apple_store", "src_google_play"]},
    {"id": "commerce",    "label": "Commerce",           "ids": ["src_shopify", "src_stripe"]},
    {"id": "rdbms",       "label": "RDBMS",              "ids": ["src_oracle", "src_sqlserver", "src_postgresql", "src_mysql", "src_cloud_sql", "src_alloydb"]},
    {"id": "nosql",       "label": "NoSQL & Search",     "ids": ["src_mongodb", "src_cassandra", "src_elasticsearch", "src_redis", "src_dynamodb", "src_firestore", "src_neo4j"]},
    {"id": "streaming",   "label": "Streaming",          "ids": ["src_kafka", "src_confluent", "src_kinesis", "src_event_hubs", "src_rabbitmq", "src_mqtt"]},
    {"id": "files",       "label": "Files & Storage",    "ids": ["src_sftp", "src_s3", "src_azure_blob", "src_sharepoint", "src_gcs"]},
    {"id": "cloud_dw",    "label": "Cloud DW",           "ids": ["src_aws_rds", "src_snowflake", "src_databricks"]},
    {"id": "apis",        "label": "APIs",               "ids": ["src_rest_api"]},
    {"id": "legacy",      "label": "Legacy",             "ids": ["src_mainframe", "src_as400", "src_mq_series", "src_ftp", "src_flat_file"]},
]

CONN_GROUPS = [
    {"id": "gcp_identity", "label": "Identity & Auth",    "ids": ["conn_cloud_identity", "conn_identity_platform", "conn_iam"]},
    {"id": "vendor_id",    "label": "Vendor Identity",    "ids": ["conn_entra_id", "conn_cyberark", "conn_keeper"]},
    {"id": "secrets_net",  "label": "Secrets & Network",  "ids": ["conn_secret_manager", "conn_vpn", "conn_interconnect", "conn_vpc", "conn_armor", "conn_dns"]},
    {"id": "api_mgmt",    "label": "API Management",      "ids": ["conn_apigee", "conn_api_gateway"]},
]

SOURCE_TYPES = {
    "onprem": ["src_oracle", "src_sqlserver", "src_postgresql", "src_mongodb", "src_mysql", "src_mainframe"],
    "cross_cloud": ["src_s3", "src_snowflake", "src_aws_rds", "src_azure_blob", "src_kinesis", "src_event_hubs", "src_dynamodb"],
    "saas": ["src_salesforce", "src_workday", "src_servicenow", "src_sap", "src_hubspot", "src_jira", "src_zendesk", "src_netsuite", "src_shopify", "src_stripe", "src_dynamics365", "src_google_ads", "src_google_analytics", "src_marketo", "src_facebook_ads"],
    "streaming": ["src_kafka", "src_confluent"],
    "gcp_native": ["src_cloud_sql", "src_firestore", "src_alloydb", "src_gcs"],
}

SOURCE_WIRING = {
    "onprem":      {"conn": ["conn_vpn", "conn_vpc"],             "l3": ["ing_datastream"],              "l4": ["lake_gcs"]},
    "cross_cloud": {"conn": ["conn_entra_id", "conn_cyberark"],   "l3": ["ing_datastream"],              "l4": ["lake_gcs"]},
    "saas":        {"conn": ["conn_armor", "conn_apigee"],        "l3": ["ing_functions"],               "l4": ["lake_gcs"]},
    "streaming":   {"conn": [],                                    "l3": ["ing_pubsub", "ing_dataflow"],  "l4": ["lake_bq_staging"]},
    "gcp_native":  {"conn": ["conn_vpc"],                          "l3": ["ing_datastream"],              "l4": ["lake_gcs"]},
}

SOURCE_KEYWORDS: Dict[str, List[str]] = {
    "src_oracle": ["oracle"], "src_sqlserver": ["sql server", "mssql", "sqlserver"],
    "src_postgresql": ["postgres"], "src_mongodb": ["mongodb", "mongo"], "src_mysql": ["mysql"],
    "src_salesforce": ["salesforce", "crm"], "src_workday": ["workday", "hcm", "hr data"],
    "src_servicenow": ["servicenow", "itsm"], "src_sap": ["sap", "erp"],
    "src_kafka": ["kafka", "event stream", "streaming"], "src_confluent": ["confluent"],
    "src_cloud_sql": ["cloud sql"], "src_alloydb": ["alloydb"],
    "src_sftp": ["sftp", "ftp"], "src_s3": ["s3", "aws", "csv", "parquet", "files"],
    "src_mainframe": ["mainframe", "as400", "cobol"], "src_rest_api": ["rest api", "webhook", "api source"],
    "src_snowflake": ["snowflake"], "src_hubspot": ["hubspot"], "src_jira": ["jira"],
    "src_zendesk": ["zendesk"], "src_google_ads": ["google ads"],
    "src_google_analytics": ["google analytics", "ga4"], "src_dynamics365": ["dynamics", "dynamics 365"],
    "src_netsuite": ["netsuite"], "src_shopify": ["shopify"], "src_stripe": ["stripe"],
}


# ═══════════════════════════════════════════════════════════
# NODES — every product · layer + group on each
# ═══════════════════════════════════════════════════════════

NODES: Dict[str, Dict[str, Any]] = {
    # ── L1: SOURCES (59 nodes) ──
    # CRM & Sales
    "src_salesforce":       {"name": "Salesforce",       "icon": "salesforce",       "subtitle": "CRM",          "zone": "sources", "layer": "L1", "group": "crm_sales",  "details": {"notes": "Cloud CRM: REST/Bulk APIs and CDC.", "encryption": "TLS 1.3 | OAuth 2.0", "cost": "Included in SF license", "compliance": "SOC2, GDPR"}},
    "src_hubspot":          {"name": "HubSpot",          "icon": "hubspot",          "subtitle": "CRM",          "zone": "sources", "layer": "L1", "group": "crm_sales",  "details": {"notes": "CRM/Marketing via REST API v3, webhooks.", "compliance": "SOC2, GDPR"}},
    "src_dynamics365":      {"name": "Dynamics 365",     "icon": "dynamics365",      "subtitle": "CRM/ERP",      "zone": "sources", "layer": "L1", "group": "crm_sales",  "details": {"notes": "Microsoft CRM/ERP via Dataverse Web API.", "compliance": "SOC2, GDPR, HIPAA"}},
    # HR & Finance
    "src_workday":          {"name": "Workday",          "icon": "workday",          "subtitle": "HCM",          "zone": "sources", "layer": "L1", "group": "hr_finance", "details": {"notes": "HCM/Finance: employees, payroll via RaaS.", "compliance": "SOC2, GDPR, HIPAA"}},
    "src_sap":              {"name": "SAP",              "icon": "sap",              "subtitle": "ERP",          "zone": "sources", "layer": "L1", "group": "hr_finance", "details": {"notes": "ERP: finance, supply chain via OData/BAPI.", "compliance": "SOC2, SOX"}},
    "src_netsuite":         {"name": "NetSuite",         "icon": "netsuite",         "subtitle": "ERP",          "zone": "sources", "layer": "L1", "group": "hr_finance", "details": {"notes": "Oracle NetSuite via SuiteTalk.", "compliance": "SOC2, SOX"}},
    "src_adp":              {"name": "ADP",              "icon": "adp",              "subtitle": "Payroll",      "zone": "sources", "layer": "L1", "group": "hr_finance", "details": {"notes": "Payroll/workforce via ADP Marketplace APIs.", "compliance": "SOC2, GDPR"}},
    "src_bamboohr":         {"name": "BambooHR",         "icon": "bamboohr",         "subtitle": "HR",           "zone": "sources", "layer": "L1", "group": "hr_finance", "details": {"notes": "Cloud HRIS via REST API.", "compliance": "SOC2"}},
    # ITSM & Ops
    "src_servicenow":       {"name": "ServiceNow",       "icon": "servicenow",       "subtitle": "ITSM",         "zone": "sources", "layer": "L1", "group": "itsm_ops",  "details": {"notes": "ITSM: incidents, changes, CMDB via Table API.", "compliance": "SOC2"}},
    "src_jira":             {"name": "Jira",             "icon": "jira",             "subtitle": "Projects",     "zone": "sources", "layer": "L1", "group": "itsm_ops",  "details": {"notes": "Issues, sprints, boards via REST API v3.", "compliance": "SOC2"}},
    "src_zendesk":          {"name": "Zendesk",          "icon": "zendesk",          "subtitle": "Support",      "zone": "sources", "layer": "L1", "group": "itsm_ops",  "details": {"notes": "Support: tickets, agents via REST API.", "compliance": "SOC2, HIPAA"}},
    # Marketing & Ads
    "src_google_ads":       {"name": "Google Ads",       "icon": "google_ads",       "subtitle": "Ads",          "zone": "sources", "layer": "L1", "group": "marketing"},
    "src_facebook_ads":     {"name": "Facebook Ads",     "icon": "facebook_ads",     "subtitle": "Ads",          "zone": "sources", "layer": "L1", "group": "marketing"},
    "src_google_analytics": {"name": "Google Analytics",  "icon": "google_analytics", "subtitle": "Web",          "zone": "sources", "layer": "L1", "group": "marketing", "details": {"notes": "GA4 via Data API, BQ Export.", "compliance": "SOC2"}},
    "src_adobe_analytics":  {"name": "Adobe Analytics",  "icon": "adobe_analytics",  "subtitle": "Web",          "zone": "sources", "layer": "L1", "group": "marketing"},
    "src_marketo":          {"name": "Marketo",          "icon": "marketo",          "subtitle": "Marketing",    "zone": "sources", "layer": "L1", "group": "marketing"},
    # Social & Apps
    "src_facebook":         {"name": "Facebook",         "icon": "facebook",         "subtitle": "Social",       "zone": "sources", "layer": "L1", "group": "social"},
    "src_twitter":          {"name": "Twitter / X",      "icon": "twitter",          "subtitle": "Social",       "zone": "sources", "layer": "L1", "group": "social"},
    "src_linkedin":         {"name": "LinkedIn",         "icon": "linkedin",         "subtitle": "Social",       "zone": "sources", "layer": "L1", "group": "social"},
    "src_instagram":        {"name": "Instagram",        "icon": "instagram",        "subtitle": "Social",       "zone": "sources", "layer": "L1", "group": "social"},
    "src_youtube":          {"name": "YouTube",          "icon": "youtube",          "subtitle": "Video",        "zone": "sources", "layer": "L1", "group": "social"},
    "src_tiktok":           {"name": "TikTok",           "icon": "tiktok",           "subtitle": "Social",       "zone": "sources", "layer": "L1", "group": "social"},
    # App Stores
    "src_apple_store":      {"name": "App Store",        "icon": "apple_store",      "subtitle": "iOS",          "zone": "sources", "layer": "L1", "group": "app_stores"},
    "src_google_play":      {"name": "Google Play",      "icon": "google_play",      "subtitle": "Android",      "zone": "sources", "layer": "L1", "group": "app_stores"},
    # Commerce
    "src_shopify":          {"name": "Shopify",          "icon": "shopify",          "subtitle": "eComm",        "zone": "sources", "layer": "L1", "group": "commerce"},
    "src_stripe":           {"name": "Stripe",           "icon": "stripe",           "subtitle": "Payments",     "zone": "sources", "layer": "L1", "group": "commerce"},
    # RDBMS
    "src_oracle":           {"name": "Oracle DB",        "icon": "oracle",           "subtitle": "RDBMS",        "zone": "sources", "layer": "L1", "group": "rdbms",     "details": {"notes": "Enterprise RDBMS via JDBC, LogMiner CDC, GoldenGate.", "compliance": "SOC2, HIPAA, PCI-DSS"}},
    "src_sqlserver":        {"name": "SQL Server",       "icon": "sqlserver",        "subtitle": "RDBMS",        "zone": "sources", "layer": "L1", "group": "rdbms",     "details": {"notes": "Microsoft RDBMS via JDBC/ODBC, Change Tracking, CDC.", "compliance": "SOC2, HIPAA"}},
    "src_postgresql":       {"name": "PostgreSQL",       "icon": "postgresql",       "subtitle": "RDBMS",        "zone": "sources", "layer": "L1", "group": "rdbms",     "details": {"notes": "Open-source RDBMS via JDBC and WAL logical replication.", "compliance": "SOC2"}},
    "src_mysql":            {"name": "MySQL",            "icon": "mysql",            "subtitle": "RDBMS",        "zone": "sources", "layer": "L1", "group": "rdbms"},
    "src_cloud_sql":        {"name": "Cloud SQL",        "icon": "cloud_sql",        "subtitle": "GCP DB",       "zone": "sources", "layer": "L1", "group": "rdbms",     "details": {"notes": "Managed MySQL/PG/SQL Server. Datastream CDC or BQ federation.", "compliance": "SOC2"}},
    "src_alloydb":          {"name": "AlloyDB",          "icon": "alloydb",          "subtitle": "GCP DB",       "zone": "sources", "layer": "L1", "group": "rdbms",     "details": {"notes": "Google PostgreSQL-compatible DB. BQ direct federation.", "compliance": "SOC2"}},
    # NoSQL
    "src_mongodb":          {"name": "MongoDB",          "icon": "mongodb",          "subtitle": "NoSQL",        "zone": "sources", "layer": "L1", "group": "nosql",     "details": {"notes": "Document DB via Change Streams for CDC.", "compliance": "SOC2"}},
    "src_cassandra":        {"name": "Cassandra",        "icon": "cassandra",        "subtitle": "NoSQL",        "zone": "sources", "layer": "L1", "group": "nosql"},
    "src_elasticsearch":    {"name": "Elasticsearch",    "icon": "elasticsearch",    "subtitle": "Search",       "zone": "sources", "layer": "L1", "group": "nosql"},
    "src_redis":            {"name": "Redis",            "icon": "redis",            "subtitle": "Cache",        "zone": "sources", "layer": "L1", "group": "nosql"},
    "src_dynamodb":         {"name": "DynamoDB",         "icon": "dynamodb",         "subtitle": "AWS NoSQL",    "zone": "sources", "layer": "L1", "group": "nosql"},
    "src_firestore":        {"name": "Firestore",        "icon": "firestore",        "subtitle": "GCP NoSQL",    "zone": "sources", "layer": "L1", "group": "nosql"},
    "src_neo4j":            {"name": "Neo4j",            "icon": "neo4j",            "subtitle": "Graph",        "zone": "sources", "layer": "L1", "group": "nosql"},
    # Streaming
    "src_kafka":            {"name": "Kafka",            "icon": "kafka",            "subtitle": "Streaming",    "zone": "sources", "layer": "L1", "group": "streaming", "details": {"notes": "Distributed event streaming for high-throughput pub-sub.", "compliance": "SOC2"}},
    "src_confluent":        {"name": "Confluent",        "icon": "confluent",        "subtitle": "Kafka SaaS",   "zone": "sources", "layer": "L1", "group": "streaming"},
    "src_kinesis":          {"name": "AWS Kinesis",      "icon": "aws_kinesis",      "subtitle": "AWS Stream",   "zone": "sources", "layer": "L1", "group": "streaming"},
    "src_event_hubs":       {"name": "Event Hubs",       "icon": "event_hubs",       "subtitle": "Azure Stream", "zone": "sources", "layer": "L1", "group": "streaming"},
    "src_rabbitmq":         {"name": "RabbitMQ",         "icon": "rabbitmq",         "subtitle": "Message Q",    "zone": "sources", "layer": "L1", "group": "streaming"},
    "src_mqtt":             {"name": "IoT / MQTT",       "icon": "mqtt",             "subtitle": "IoT",          "zone": "sources", "layer": "L1", "group": "streaming"},
    # Files
    "src_sftp":             {"name": "SFTP / S3",        "icon": "sftp_server",      "subtitle": "Files",        "zone": "sources", "layer": "L1", "group": "files"},
    "src_s3":               {"name": "AWS S3",           "icon": "aws_s3",           "subtitle": "Object",       "zone": "sources", "layer": "L1", "group": "files"},
    "src_azure_blob":       {"name": "Azure Blob",       "icon": "azure_blob",       "subtitle": "Object",       "zone": "sources", "layer": "L1", "group": "files"},
    "src_sharepoint":       {"name": "SharePoint",       "icon": "sharepoint",       "subtitle": "Docs",         "zone": "sources", "layer": "L1", "group": "files"},
    "src_gcs":              {"name": "GCS External",     "icon": "gcs_external",     "subtitle": "Object",       "zone": "sources", "layer": "L1", "group": "files"},
    # Cloud DW
    "src_aws_rds":          {"name": "AWS RDS",          "icon": "aws_rds",          "subtitle": "AWS DB",       "zone": "sources", "layer": "L1", "group": "cloud_dw"},
    "src_snowflake":        {"name": "Snowflake",        "icon": "snowflake",        "subtitle": "Cloud DW",     "zone": "sources", "layer": "L1", "group": "cloud_dw"},
    "src_databricks":       {"name": "Databricks",       "icon": "databricks",       "subtitle": "Lakehouse",    "zone": "sources", "layer": "L1", "group": "cloud_dw"},
    # APIs
    "src_rest_api":         {"name": "REST APIs",        "icon": "rest_api",         "subtitle": "Webhooks",     "zone": "sources", "layer": "L1", "group": "apis"},
    # Legacy
    "src_mainframe":        {"name": "Mainframe",        "icon": "mainframe",        "subtitle": "Legacy",       "zone": "sources", "layer": "L1", "group": "legacy"},
    "src_as400":            {"name": "AS/400",           "icon": "as400",            "subtitle": "Legacy",       "zone": "sources", "layer": "L1", "group": "legacy"},
    "src_mq_series":        {"name": "MQ Series",        "icon": "mq_series",        "subtitle": "MOM",          "zone": "sources", "layer": "L1", "group": "legacy"},
    "src_ftp":              {"name": "FTP / FTPS",       "icon": "ftp",              "subtitle": "Legacy Files", "zone": "sources", "layer": "L1", "group": "legacy"},
    "src_flat_file":        {"name": "Flat Files",       "icon": "flat_file",        "subtitle": "CSV/TSV",      "zone": "sources", "layer": "L1", "group": "legacy"},

    # ── L2: CONNECTIVITY (14 nodes) ──
    "conn_cloud_identity":  {"name": "Cloud Identity",    "icon": "identity_and_access_management", "subtitle": "GCP Identity Broker",          "zone": "connectivity", "layer": "L2", "group": "gcp_identity", "details": {"notes": "Google-managed identity: SAML federation.", "compliance": "SOC2, ISO 27001"}},
    "conn_identity_platform":{"name": "Identity Platform","icon": "identity_platform",              "subtitle": "Customer Auth · OIDC",          "zone": "connectivity", "layer": "L2", "group": "gcp_identity", "details": {"cost": "Free: 50K MAU, then $0.0055/MAU", "compliance": "SOC2"}},
    "conn_iam":             {"name": "Cloud IAM",         "icon": "identity_and_access_management", "subtitle": "Roles · Policies · WIF",        "zone": "connectivity", "layer": "L2", "group": "gcp_identity", "details": {"notes": "IAM: roles, policies, Workload Identity Federation.", "compliance": "SOC2, ISO 27001"}},
    "conn_entra_id":        {"name": "Entra ID",          "icon": "entra_id",          "subtitle": "Enterprise IdP · SSO · MFA",    "zone": "connectivity", "layer": "L2", "group": "vendor_id",   "details": {"notes": "Microsoft SSO, MFA, conditional access → SAML 2.0 → GCP.", "cost": "P1: $6/user/mo", "compliance": "SOC2, ISO 27001, HIPAA"}},
    "conn_cyberark":        {"name": "CyberArk",          "icon": "cyberark",          "subtitle": "Enterprise PAM · Vault",        "zone": "connectivity", "layer": "L2", "group": "vendor_id",   "details": {"notes": "PAM: credential vault, auto rotation → Secret Manager.", "compliance": "SOC2, PCI-DSS, HIPAA"}},
    "conn_keeper":          {"name": "Keeper",             "icon": "keeper",            "subtitle": "Team Passwords",                "zone": "connectivity", "layer": "L2", "group": "vendor_id",   "details": {"cost": "$3.75/user/mo", "compliance": "SOC2, ISO 27001"}},
    "conn_secret_manager":  {"name": "Secret Manager",     "icon": "secret_manager",    "subtitle": "Runtime Secrets · CMEK",        "zone": "connectivity", "layer": "L2", "group": "secrets_net", "details": {"notes": "GCP secret storage: versioning, IAM, CMEK.", "cost": "$0.06/10K ops", "compliance": "SOC2, HIPAA"}},
    "conn_vpn":             {"name": "Cloud VPN",          "icon": "cloud_vpn",         "subtitle": "IPsec Tunnels · HA VPN",        "zone": "connectivity", "layer": "L2", "group": "secrets_net", "details": {"notes": "Managed IPsec VPN. HA VPN: 99.99% SLA.", "cost": "~$0.075/hr per tunnel", "compliance": "SOC2"}},
    "conn_interconnect":    {"name": "Interconnect",       "icon": "cloud_interconnect","subtitle": "Dedicated · 10-100 Gbps",       "zone": "connectivity", "layer": "L2", "group": "secrets_net", "details": {"cost": "$0.05-0.08/hr per VLAN", "compliance": "SOC2, ISO 27001"}},
    "conn_vpc":             {"name": "VPC / VPC-SC",       "icon": "virtual_private_cloud","subtitle": "Network · Service Controls",   "zone": "connectivity", "layer": "L2", "group": "secrets_net", "details": {"notes": "VPC + VPC-SC for data exfiltration prevention.", "compliance": "SOC2, HIPAA, PCI-DSS, FedRAMP"}},
    "conn_armor":           {"name": "Cloud Armor",        "icon": "cloud_armor",       "subtitle": "WAF · DDoS",                    "zone": "connectivity", "layer": "L2", "group": "secrets_net", "details": {"cost": "$0.75/policy/mo", "compliance": "SOC2"}},
    "conn_dns":             {"name": "Cloud DNS",          "icon": "cloud_dns",         "subtitle": "Managed DNS · DNSSEC",           "zone": "connectivity", "layer": "L2", "group": "secrets_net", "details": {"cost": "$0.20/zone/mo", "compliance": "SOC2"}},
    "conn_apigee":          {"name": "Apigee",             "icon": "apigee_api_platform","subtitle": "Full API Lifecycle",            "zone": "connectivity", "layer": "L2", "group": "api_mgmt",   "details": {"cost": "Standard: $500/mo", "compliance": "SOC2, PCI-DSS"}},
    "conn_api_gateway":     {"name": "API Gateway",        "icon": "cloud_api_gateway", "subtitle": "Serverless Proxy",               "zone": "connectivity", "layer": "L2", "group": "api_mgmt",   "details": {"cost": "$3.50/million calls", "compliance": "SOC2"}},

    # ── L3: INGESTION (6 nodes) ──
    "ing_datastream":       {"name": "Datastream",        "icon": "datastream",        "subtitle": "CDC · MySQL/PG/Oracle → BQ",    "zone": "cloud", "layer": "L3", "group": "cdc",        "details": {"cost": "$0.10/GB", "compliance": "SOC2, ISO 27001"}},
    "ing_pubsub":           {"name": "Pub/Sub",           "icon": "pubsub",            "subtitle": "Events · At-least-once",        "zone": "cloud", "layer": "L3", "group": "streaming",  "details": {"cost": "$40/TiB", "compliance": "SOC2, ISO 27001"}},
    "ing_dataflow":         {"name": "Dataflow",          "icon": "dataflow",          "subtitle": "Stream & Batch Ingestion",      "zone": "cloud", "layer": "L3", "group": "streaming",  "details": {"cost": "$0.056/vCPU·hr", "compliance": "SOC2, ISO 27001"}},
    "ing_functions":        {"name": "Cloud Functions",   "icon": "cloud_functions",   "subtitle": "Serverless Triggers",           "zone": "cloud", "layer": "L3", "group": "api_pull",   "details": {"cost": "$0.40/million invocations", "compliance": "SOC2"}},
    "ing_fivetran":         {"name": "Fivetran",          "icon": "fivetran",          "subtitle": "SaaS Connectors · Managed",     "zone": "cloud", "layer": "L3", "group": "vendor_ing", "details": {"cost": "Per MAR pricing", "compliance": "SOC2, ISO 27001"}},
    "ing_matillion":        {"name": "Matillion",         "icon": None,                "subtitle": "ELT · Low-Code",                "zone": "cloud", "layer": "L3", "group": "vendor_ing", "details": {"compliance": "SOC2"}},

    # ── L4: DATA LAKE (2 nodes) ──
    "lake_gcs":             {"name": "Cloud Storage",     "icon": "cloud_storage",     "subtitle": "Raw Landing · Parquet/JSON",    "zone": "cloud", "layer": "L4", "group": "lake", "details": {"cost": "$0.020/GB/mo", "compliance": "SOC2, HIPAA"}},
    "lake_bq_staging":      {"name": "BigQuery Staging",  "icon": "bigquery",          "subtitle": "Relational Landing",            "zone": "cloud", "layer": "L4", "group": "lake", "details": {"cost": "$6.25/TB queried", "compliance": "SOC2, HIPAA"}},

    # ── L5: PROCESSING (5 nodes) ──
    "proc_dataflow":        {"name": "Dataflow",          "icon": "dataflow",          "subtitle": "Beam · Batch & Stream ELT",     "zone": "cloud", "layer": "L5", "group": "processing", "details": {"cost": "$0.056/vCPU·hr", "compliance": "SOC2"}},
    "proc_dataproc":        {"name": "Dataproc",          "icon": "dataproc",          "subtitle": "Spark · Heavy Transforms",      "zone": "cloud", "layer": "L5", "group": "processing", "details": {"cost": "$0.01/vCPU·hr on Compute", "compliance": "SOC2"}},
    "proc_bq_sql":          {"name": "BigQuery SQL",      "icon": "bigquery",          "subtitle": "SQL Transforms · Scheduled",    "zone": "cloud", "layer": "L5", "group": "processing", "details": {"cost": "$6.25/TB queried", "compliance": "SOC2"}},
    "proc_dlp":             {"name": "Cloud DLP",         "icon": "security_command_center", "subtitle": "PII Detection · Masking",  "zone": "cloud", "layer": "L5", "group": "quality",   "details": {"cost": "$1-3/GB inspected", "compliance": "GDPR, HIPAA, PCI-DSS"}},
    "proc_matillion":       {"name": "Matillion",         "icon": None,                "subtitle": "ETL · Low-Code",                "zone": "cloud", "layer": "L5", "group": "vendor_proc","details": {"compliance": "SOC2"}},

    # ── L6: MEDALLION (3 nodes) ──
    "bronze":               {"name": "Bronze",            "icon": "bigquery",          "subtitle": "Schema-applied · Deduplicated", "zone": "cloud", "layer": "L6", "group": "medallion"},
    "silver":               {"name": "Silver",            "icon": "bigquery",          "subtitle": "Cleaned · Conformed",           "zone": "cloud", "layer": "L6", "group": "medallion"},
    "gold":                 {"name": "Gold",              "icon": "bigquery",          "subtitle": "Curated · Aggregated",          "zone": "cloud", "layer": "L6", "group": "medallion"},

    # ── L7: SERVING (4 nodes) ──
    "serve_looker":         {"name": "Looker",            "icon": "looker",            "subtitle": "Semantic Layer · LookML",        "zone": "cloud", "layer": "L7", "group": "bi",      "details": {"cost": "$5,000/mo Standard", "compliance": "SOC2, ISO 27001"}},
    "serve_run":            {"name": "Cloud Run",         "icon": "cloud_run",         "subtitle": "Data APIs · Serverless",         "zone": "cloud", "layer": "L7", "group": "api",     "details": {"cost": "$0.00002400/vCPU·sec", "compliance": "SOC2"}},
    "serve_hub":            {"name": "Analytics Hub",     "icon": "analytics_hub",     "subtitle": "Data Marketplace · Sharing",     "zone": "cloud", "layer": "L7", "group": "sharing", "details": {"cost": "Free (BQ costs)", "compliance": "SOC2"}},
    "serve_bi_engine":      {"name": "BQ BI Engine",      "icon": "bigquery",          "subtitle": "In-Memory Acceleration",         "zone": "cloud", "layer": "L7", "group": "bi",      "details": {"cost": "$0.0416/GB/hr", "compliance": "SOC2"}},

    # ── L8: CONSUMERS (8 nodes) ──
    "con_looker":           {"name": "Looker Dashboards", "icon": "looker",            "subtitle": "Executive & Operational BI",     "zone": "consumers", "layer": "L8", "group": "bi_users"},
    "con_sheets":           {"name": "Connected Sheets",  "icon": "data_studio",       "subtitle": "BQ in Google Sheets",            "zone": "consumers", "layer": "L8", "group": "bi_users"},
    "con_vertex":           {"name": "Vertex AI Notebooks","icon": "vertexai",         "subtitle": "Data Science · ML",              "zone": "consumers", "layer": "L8", "group": "ml_users"},
    "con_run":              {"name": "Cloud Run APIs",    "icon": "cloud_run",         "subtitle": "Embedded · Downstream Apps",     "zone": "consumers", "layer": "L8", "group": "app_users"},
    "con_hub":              {"name": "Analytics Hub",     "icon": "analytics_hub",     "subtitle": "Data Marketplace · External",    "zone": "consumers", "layer": "L8", "group": "external"},
    "con_powerbi":          {"name": "Power BI",          "icon": None,                "subtitle": "Microsoft BI · DirectQuery",     "zone": "consumers", "layer": "L8", "group": "bi_users"},
    "con_tableau":          {"name": "Tableau",           "icon": None,                "subtitle": "Visual Analytics · Extracts",    "zone": "consumers", "layer": "L8", "group": "bi_users"},
    "con_slicer":           {"name": "Slicer & Dicer",    "icon": None,                "subtitle": "Ad-Hoc Analysis · Self-Service", "zone": "consumers", "layer": "L8", "group": "bi_users"},

    # ── PILLARS (4 nodes) ──
    "pillar_sec":           {"name": "Security & Identity",  "icon": "security_command_center", "subtitle": "IAM · Encryption · Secrets · Network",  "zone": "cloud", "layer": "P", "group": "pillar",
                             "details": {"notes": "NON-NEGOTIABLE: IAM, KMS/CMEK, VPC-SC, SCC, Armor, Wiz, Splunk", "compliance": "SOC2, ISO 27001, HIPAA, PCI-DSS, FedRAMP"}},
    "pillar_gov":           {"name": "Governance & Quality", "icon": "dataplex",                "subtitle": "Catalog · Lineage · DLP · Quality",    "zone": "cloud", "layer": "P", "group": "pillar",
                             "details": {"notes": "NON-NEGOTIABLE: Dataplex, Data Catalog, Lineage, DLP", "cost": "Dataplex: $0.05/GB | DLP: $1-3/GB", "compliance": "GDPR, CCPA, HIPAA"}},
    "pillar_obs":           {"name": "Observability & Ops",  "icon": "cloud_monitoring",        "subtitle": "Monitor · Logging · Alerting · SLA",    "zone": "cloud", "layer": "P", "group": "pillar",
                             "details": {"notes": "NON-NEGOTIABLE: Monitoring, Logging, Error Reporting, PagerDuty, Dynatrace", "compliance": "SLO/SLA, MTTR, DORA"}},
    "pillar_orch":          {"name": "Orchestration & Cost", "icon": "cloud_composer",          "subtitle": "DAGs · Scheduling · Budget",            "zone": "cloud", "layer": "P", "group": "pillar",
                             "details": {"notes": "NON-NEGOTIABLE: Composer, Scheduler, Budget Alerts, FinOps", "cost": "Composer: $0.35/vCPU·hr", "compliance": "FINOPS"}},
}


# ═══════════════════════════════════════════════════════════
# EDGES — complete wiring (was empty in templates.ts!)
# ═══════════════════════════════════════════════════════════

EDGES: List[Dict[str, Any]] = [
    # L1 on-prem → L2 VPN
    {"from": "src_oracle",     "to": "conn_vpn",    "label": "JDBC/CDC",    "type": "data"},
    {"from": "src_sqlserver",  "to": "conn_vpn",    "label": "JDBC/CDC",    "type": "data"},
    {"from": "src_postgresql", "to": "conn_vpn",    "label": "WAL CDC",     "type": "data"},
    {"from": "src_mongodb",    "to": "conn_vpn",    "label": "Change Strm", "type": "data"},
    {"from": "src_mysql",      "to": "conn_vpn",    "label": "CDC",         "type": "data"},
    {"from": "src_mainframe",  "to": "conn_vpn",    "label": "batch",       "type": "data"},
    # L1 SaaS → L2 Armor
    {"from": "src_salesforce", "to": "conn_armor",  "label": "REST API",    "type": "data"},
    {"from": "src_workday",    "to": "conn_armor",  "label": "RaaS/API",    "type": "data"},
    {"from": "src_servicenow", "to": "conn_armor",  "label": "Table API",   "type": "data"},
    {"from": "src_sap",        "to": "conn_armor",  "label": "OData",       "type": "data"},
    {"from": "src_hubspot",    "to": "conn_armor",  "label": "REST API",    "type": "data"},
    {"from": "src_jira",       "to": "conn_armor",  "label": "REST API",    "type": "data"},
    {"from": "src_zendesk",    "to": "conn_armor",  "label": "REST API",    "type": "data"},
    {"from": "src_google_ads", "to": "conn_armor",  "label": "API",         "type": "data"},
    {"from": "src_shopify",    "to": "conn_armor",  "label": "GraphQL",     "type": "data"},
    {"from": "src_stripe",     "to": "conn_armor",  "label": "webhook",     "type": "data"},
    {"from": "src_netsuite",   "to": "conn_armor",  "label": "SuiteTalk",   "type": "data"},
    {"from": "src_dynamics365","to": "conn_armor",   "label": "Dataverse",   "type": "data"},
    # L1 cross-cloud → L2 Entra
    {"from": "src_s3",         "to": "conn_entra_id","label": "cross-cloud", "type": "data"},
    {"from": "src_snowflake",  "to": "conn_entra_id","label": "export",      "type": "data"},
    {"from": "src_aws_rds",    "to": "conn_entra_id","label": "cross-cloud", "type": "data"},
    {"from": "src_azure_blob", "to": "conn_entra_id","label": "cross-cloud", "type": "data"},
    # L1 streaming → L3 direct
    {"from": "src_kafka",      "to": "ing_pubsub",  "label": "subscribe",   "type": "data"},
    {"from": "src_confluent",  "to": "ing_pubsub",  "label": "subscribe",   "type": "data"},
    # L1 GCP-native → L2 VPC
    {"from": "src_cloud_sql",  "to": "conn_vpc",    "label": "CDC",         "type": "data"},
    {"from": "src_alloydb",    "to": "conn_vpc",    "label": "CDC",         "type": "data"},
    {"from": "src_firestore",  "to": "conn_vpc",    "label": "export",      "type": "data"},
    # L1 files → L3 direct
    {"from": "src_sftp",       "to": "ing_functions","label": "SFTP pull",   "type": "data"},
    {"from": "src_rest_api",   "to": "ing_functions","label": "HTTP",        "type": "data"},
    # L2 vendor → GCP identity
    {"from": "conn_entra_id",  "to": "conn_cloud_identity","label": "SAML SSO","type": "identity"},
    {"from": "conn_cyberark",  "to": "conn_secret_manager","label": "PAM sync","type": "identity"},
    {"from": "conn_keeper",    "to": "conn_secret_manager","label": "secrets", "type": "identity"},
    {"from": "conn_iam",       "to": "conn_secret_manager","label": "WIF",     "type": "identity"},
    # L2 → L3
    {"from": "conn_vpn",      "to": "ing_datastream", "label": "tunnel",    "type": "data"},
    {"from": "conn_vpc",      "to": "ing_datastream", "label": "private",   "type": "data"},
    {"from": "conn_armor",    "to": "ing_functions",   "label": "filtered",  "type": "data"},
    {"from": "conn_apigee",   "to": "ing_functions",   "label": "managed",   "type": "data"},
    {"from": "conn_iam",      "to": "ing_datastream",  "label": "auth",      "type": "identity"},
    # L3 → L4
    {"from": "ing_datastream","to": "lake_gcs",        "label": "CDC",       "type": "data"},
    {"from": "ing_pubsub",   "to": "ing_dataflow",     "label": "events",    "type": "data"},
    {"from": "ing_dataflow", "to": "lake_bq_staging",  "label": "stream",    "type": "data"},
    {"from": "ing_functions","to": "lake_gcs",          "label": "write",     "type": "data"},
    {"from": "ing_fivetran", "to": "lake_bq_staging",  "label": "sync",      "type": "data"},
    {"from": "ing_matillion","to": "lake_bq_staging",   "label": "ELT",       "type": "data"},
    # L4 → L5
    {"from": "lake_gcs",       "to": "proc_bq_sql",   "label": "read",      "type": "data"},
    {"from": "lake_gcs",       "to": "proc_dataproc",  "label": "read",      "type": "data"},
    {"from": "lake_bq_staging","to": "proc_bq_sql",    "label": "SQL ELT",   "type": "data"},
    {"from": "lake_bq_staging","to": "proc_dataflow",  "label": "stream",    "type": "data"},
    # L5 → L6
    {"from": "proc_bq_sql",   "to": "bronze",         "label": "transform",  "type": "data"},
    {"from": "proc_dataflow", "to": "bronze",          "label": "stream",     "type": "data"},
    {"from": "proc_dataproc", "to": "bronze",          "label": "spark",      "type": "data"},
    {"from": "proc_matillion","to": "bronze",           "label": "ELT",        "type": "data"},
    # L5 quality
    {"from": "proc_bq_sql",   "to": "proc_dlp",       "label": "PII scan",   "type": "quality"},
    {"from": "proc_dlp",      "to": "silver",          "label": "mask",       "type": "quality"},
    # L6 chain
    {"from": "bronze", "to": "silver", "label": "quality gate", "type": "data"},
    {"from": "silver", "to": "gold",   "label": "quality gate", "type": "data"},
    # L6 → L7
    {"from": "gold", "to": "serve_looker",    "label": "governed BI",  "type": "data"},
    {"from": "gold", "to": "serve_run",       "label": "serving API",  "type": "data"},
    {"from": "gold", "to": "serve_hub",       "label": "data exchange","type": "data"},
    {"from": "gold", "to": "serve_bi_engine", "label": "BI Engine",    "type": "data"},
    # L7 → L8
    {"from": "serve_looker",  "to": "con_looker",  "label": "dashboards", "type": "data"},
    {"from": "serve_looker",  "to": "con_sheets",  "label": "sheets",     "type": "data"},
    {"from": "serve_run",     "to": "con_run",     "label": "API",        "type": "data"},
    {"from": "serve_hub",     "to": "con_hub",     "label": "subscribe",  "type": "data"},
    {"from": "gold",          "to": "con_vertex",  "label": "ML data",    "type": "data"},
    {"from": "gold",          "to": "con_powerbi", "label": "DirectQuery", "type": "data"},
    {"from": "gold",          "to": "con_tableau", "label": "extract",    "type": "data"},
    {"from": "gold",          "to": "con_slicer",  "label": "ad-hoc",     "type": "data"},
    # Pillars
    {"from": "pillar_orch", "to": "proc_bq_sql",    "label": "trigger",  "type": "control"},
    {"from": "pillar_orch", "to": "ing_dataflow",   "label": "trigger",  "type": "control"},
    {"from": "pillar_orch", "to": "ing_datastream",  "label": "schedule", "type": "control"},
    {"from": "ing_dataflow","to": "pillar_obs",      "label": "metrics",  "type": "observe"},
    {"from": "proc_bq_sql","to": "pillar_obs",       "label": "logs",     "type": "observe"},
    {"from": "pillar_orch","to": "pillar_obs",        "label": "DAG logs", "type": "observe"},
    {"from": "pillar_gov", "to": "bronze",            "label": "quality",  "type": "control"},
    {"from": "pillar_gov", "to": "silver",            "label": "lineage",  "type": "control"},
    {"from": "pillar_gov", "to": "gold",              "label": "catalog",  "type": "control"},
    {"from": "pillar_sec", "to": "conn_iam",          "label": "policy",   "type": "control"},
    {"from": "pillar_sec", "to": "gold",              "label": "CMEK",     "type": "control"},
]


# ═══════════════════════════════════════════════════════════
# DERIVED — backward compat edge label dicts
# ═══════════════════════════════════════════════════════════

SOURCE_EDGE_LABELS: Dict[str, str] = {e["from"]: e["label"] for e in EDGES if NODES.get(e["from"], {}).get("layer") == "L1" and e["label"]}
INGESTION_EDGE_LABELS: Dict[str, str] = {e["from"]: e["label"] for e in EDGES if NODES.get(e["from"], {}).get("layer") == "L3" and NODES.get(e["to"], {}).get("layer") == "L4" and e["label"]}
SERVING_EDGE_LABELS: Dict[str, str] = {e["to"]: e["label"] for e in EDGES if e["from"] == "gold" and NODES.get(e["to"], {}).get("layer") == "L7" and e["label"]}

PHASES = [
    {"id": "connectivity", "name": "Layer 2: Connectivity & Access", "nodeIds": [n for n, d in NODES.items() if d["layer"] == "L2"]},
    {"id": "ingestion",    "name": "Layer 3: Ingestion",             "nodeIds": [n for n, d in NODES.items() if d["layer"] == "L3"]},
    {"id": "datalake",     "name": "Layer 4: Data Lake",             "nodeIds": [n for n, d in NODES.items() if d["layer"] == "L4"]},
    {"id": "processing",   "name": "Layer 5: Processing",            "nodeIds": [n for n, d in NODES.items() if d["layer"] == "L5"]},
    {"id": "medallion",    "name": "Layer 6: Medallion Architecture","nodeIds": [n for n, d in NODES.items() if d["layer"] == "L6"]},
    {"id": "serving",      "name": "Layer 7: Serving & Delivery",   "nodeIds": [n for n, d in NODES.items() if d["layer"] == "L7"]},
]
OPS_GROUP = {"name": "Crosscutting Pillars", "nodeIds": [n for n, d in NODES.items() if d["layer"] == "P"]}

ALWAYS_ON = {"conn_iam", "conn_secret_manager", "lake_gcs", "proc_bq_sql", "proc_dlp", "bronze", "silver", "gold", "serve_looker", "con_looker", "pillar_sec", "pillar_gov", "pillar_obs", "pillar_orch"}


# ═══════════════════════════════════════════════════════════
# RENDERING LAYOUT — single source for dashboard.tsx
# Frontend reads these from the diagram JSON.
# ═══════════════════════════════════════════════════════════

RENDER_SRC_GROUPS = [{"label": c["label"], "ids": c["ids"]} for c in SOURCE_CATEGORIES]

RENDER_CONN_GROUPS = [
    {"label": "Identity & Auth",   "ids": ["conn_cloud_identity", "conn_identity_platform", "conn_iam"]},
    {"label": "Vendor Identity",   "ids": ["conn_entra_id", "conn_cyberark", "conn_keeper"], "vendor": True},
    {"label": "Secrets & Network", "ids": ["conn_secret_manager", "conn_vpn", "conn_interconnect", "conn_vpc", "conn_armor", "conn_dns"]},
    {"label": "API Management",    "ids": ["conn_apigee", "conn_api_gateway"]},
]

RENDER_GCP_LAYERS = [
    {"num": "L7-L8", "title": "Serving & Consumption", "color": "#0E7490", "groups": [
        {"label": "BI",           "ids": ["serve_looker", "serve_bi_engine", "con_sheets", "con_powerbi", "con_tableau", "con_slicer"]},
        {"label": "AI / ML",      "ids": ["con_vertex"]},
        {"label": "APIs",         "ids": ["conn_apigee", "conn_api_gateway", "serve_run"]},
        {"label": "Data Sharing", "ids": ["serve_hub"]},
    ]},
    {"num": "L6", "title": "Medallion", "color": "#D97706", "groups": [
        {"label": "Bronze", "ids": ["bronze"]},
        {"label": "Silver", "ids": ["silver"]},
        {"label": "Gold",   "ids": ["gold"]},
    ]},
    {"num": "L5", "title": "Processing", "color": "#6D28D9", "groups": [
        {"label": "Batch / Spark",  "ids": ["proc_dataproc", "proc_bq_sql"]},
        {"label": "Stream",         "ids": ["proc_dataflow"]},
        {"label": "Data Quality",   "ids": ["proc_dlp"]},
        {"label": "Vendor ETL",     "ids": ["proc_matillion"]},
    ]},
    {"num": "L4", "title": "Data Lake", "color": "#047857", "groups": [
        {"label": "Object Store",  "ids": ["lake_gcs"]},
        {"label": "BQ Staging",    "ids": ["lake_bq_staging"]},
    ]},
    {"num": "L3", "title": "Ingestion", "color": "#0369A1", "groups": [
        {"label": "CDC",           "ids": ["ing_datastream"]},
        {"label": "Streaming",     "ids": ["ing_pubsub"]},
        {"label": "Batch / Event", "ids": ["ing_dataflow", "ing_functions"]},
        {"label": "Vendor CDC",    "ids": ["ing_fivetran", "ing_matillion"]},
    ]},
]

RENDER_PILLARS = [
    {"id": "pillar_sec",  "color": "#DC2626", "bg": "#FEF2F2"},
    {"id": "pillar_gov",  "color": "#2563EB", "bg": "#EFF6FF"},
    {"id": "pillar_obs",  "color": "#D97706", "bg": "#FFFBEB"},
    {"id": "pillar_orch", "color": "#7C3AED", "bg": "#F5F3FF"},
]

LAYER_PREFIXES = [("src_","L1"),("conn_","L2"),("ing_","L3"),("lake_","L4"),("proc_","L5"),("bronze","L6"),("silver","L6"),("gold","L6"),("serve_","L7"),("con_","L8"),("pillar_","P")]


# ═══════════════════════════════════════════════════════════
# FUNCTIONS
# ═══════════════════════════════════════════════════════════

def get_layer(node_id: str) -> str:
    n = NODES.get(node_id)
    if n and "layer" in n: return n["layer"]
    for prefix, layer in LAYER_PREFIXES:
        if node_id.startswith(prefix) or node_id == prefix: return layer
    return "?"

def get_source_type(src_id: str) -> str:
    for stype, ids in SOURCE_TYPES.items():
        if src_id in ids: return stype
    return "saas"

def get_source_category(src_id: str) -> dict:
    for cat in SOURCE_CATEGORIES:
        if src_id in cat["ids"]: return cat
    return {"id": "other", "label": "Other", "ids": []}

def get_active_source_categories(keep_set: Set[str]) -> List[dict]:
    result = []
    for cat in SOURCE_CATEGORIES:
        active = [sid for sid in cat["ids"] if sid in keep_set]
        if active: result.append({**cat, "active_ids": active})
    return result

def get_edges_for(keep_set: Set[str]) -> List[Dict]:
    """Return only edges where BOTH from and to are in keep_set."""
    return [e for e in EDGES if e["from"] in keep_set and e["to"] in keep_set]

def auto_wire(source_ids: Set[str]) -> Tuple[Set[str], List[str]]:
    extra = set(ALWAYS_ON)
    decisions = []
    has_onprem = any(s in SOURCE_TYPES["onprem"] for s in source_ids)
    has_cross  = any(s in SOURCE_TYPES["cross_cloud"] for s in source_ids)
    has_saas   = any(s in SOURCE_TYPES["saas"] for s in source_ids)
    has_stream = any(s in SOURCE_TYPES["streaming"] for s in source_ids)
    has_gcp    = any(s in SOURCE_TYPES["gcp_native"] for s in source_ids)

    for stype, present, msgs in [
        ("onprem",      has_onprem, ["L2: On-prem → VPN + VPC", "L3: Datastream CDC"]),
        ("cross_cloud", has_cross,  ["L2: Cross-cloud → WIF + Entra ID + CyberArk"]),
        ("saas",        has_saas,   ["L2: SaaS → Cloud Armor + Apigee", "L3: Cloud Functions API polling"]),
        ("streaming",   has_stream, ["L3: Pub/Sub + Dataflow for streaming"]),
        ("gcp_native",  has_gcp,    ["L2: GCP-native → VPC internal"]),
    ]:
        if present:
            w = SOURCE_WIRING[stype]
            extra.update(w["conn"]); extra.update(w["l3"]); extra.update(w["l4"])
            decisions.extend(msgs)

    if has_stream:
        extra.add("proc_dataflow"); decisions.append("L5: Dataflow for stream processing")
    else:
        decisions.append("L5: BigQuery SQL / Dataform ELT (FREE with BQ)")

    decisions.append("L6: Medallion → Bronze / Silver / Gold (always)")
    decisions.append("L7: Looker for governed BI (always)")
    decisions.append("Pillars: Security + Governance + Observability + Orchestration (always)")
    return extra, decisions

def parse_prompt(prompt: str) -> Set[str]:
    """Parse user prompt → set of source IDs using SOURCE_KEYWORDS."""
    p = prompt.lower()
    sources = set()
    for src_id, keywords in SOURCE_KEYWORDS.items():
        for kw in keywords:
            if kw in p:
                sources.add(src_id)
                break
    return sources


def build_title(source_ids: Set[str]) -> str:
    name_map = {"src_s3": "S3", "src_oracle": "Oracle", "src_sqlserver": "SQL Server", "src_postgresql": "PostgreSQL", "src_kafka": "Kafka", "src_salesforce": "Salesforce", "src_workday": "Workday", "src_servicenow": "ServiceNow", "src_sap": "SAP", "src_cloud_sql": "Cloud SQL", "src_mongodb": "MongoDB", "src_mysql": "MySQL", "src_mainframe": "Mainframe", "src_hubspot": "HubSpot", "src_snowflake": "Snowflake"}
    names = [name_map.get(s, NODES[s]["name"]) for s in source_ids if s in NODES]
    return f"{' + '.join(names[:4])} → BigQuery Data Platform" if names else "GCP → BigQuery Data Platform"


# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCT TAGS — rich metadata for semantic search & subsetting
# ═══════════════════════════════════════════════════════════════════════════════
#
# Every product gets: keywords, use_cases, industries, description
# These get embedded into pgvector for semantic matching.
# The blueprint (NODES + EDGES + WIRING) is the single source of truth.
# Tags are the SEARCH INDEX into that blueprint.
#
# Format:
#   "product_id": {
#       "keywords": [...],      # what users type
#       "use_cases": [...],     # business problems
#       "industries": [...],    # verticals ("all" = universal)
#       "description": "...",   # rich text for embedding
#   }

PRODUCT_TAGS: Dict[str, dict] = {

    # ── L1: SOURCES — CRM & Sales ────────────────────────────────────────────
    "src_salesforce": {
        "keywords": ["salesforce", "sfdc", "crm", "sales cloud", "service cloud", "leads", "opportunities", "accounts", "contacts", "cases"],
        "use_cases": ["customer 360", "sales analytics", "revenue forecasting", "pipeline analysis", "lead scoring", "churn prediction", "crm migration"],
        "industries": ["all"],
        "description": "Salesforce CRM — enterprise customer relationship management. Contains accounts, contacts, opportunities, leads, cases, campaigns. Primary source for customer 360, sales analytics, revenue forecasting, and marketing attribution.",
    },
    "src_hubspot": {
        "keywords": ["hubspot", "inbound", "marketing automation", "crm", "contacts", "deals", "marketing hub"],
        "use_cases": ["marketing analytics", "lead generation", "inbound analytics", "customer 360", "email campaign analytics", "deal pipeline"],
        "industries": ["saas", "startup", "smb", "marketing"],
        "description": "HubSpot — inbound marketing and CRM platform. Contains contacts, deals, marketing emails, forms, landing pages. Source for marketing analytics, lead attribution, and SMB customer 360 views.",
    },
    "src_dynamics365": {
        "keywords": ["dynamics", "dynamics 365", "d365", "microsoft crm", "microsoft dynamics", "nav", "ax", "business central"],
        "use_cases": ["erp analytics", "crm analytics", "customer 360", "financial reporting", "supply chain"],
        "industries": ["enterprise", "manufacturing", "retail"],
        "description": "Microsoft Dynamics 365 — ERP and CRM platform. Contains financials, sales, customer service, supply chain, and HR data. Common in Microsoft-centric enterprises.",
    },

    # ── L1: SOURCES — HR & Finance ───────────────────────────────────────────
    "src_workday": {
        "keywords": ["workday", "hcm", "hr", "human resources", "payroll", "benefits", "workforce", "talent", "compensation", "employee"],
        "use_cases": ["hr analytics", "workforce planning", "headcount", "attrition analysis", "compensation benchmarking", "diversity analytics", "talent analytics"],
        "industries": ["all"],
        "description": "Workday — cloud HR and financial management. Contains employee records, payroll, benefits, org hierarchy, talent data, financial journals. Source for people analytics, workforce planning, and financial consolidation.",
    },
    "src_sap": {
        "keywords": ["sap", "erp", "s4hana", "s/4hana", "hana", "bw", "ecc", "fi", "co", "mm", "sd", "pp", "supply chain", "mrp"],
        "use_cases": ["erp analytics", "financial reporting", "supply chain analytics", "procurement", "manufacturing analytics", "inventory management", "order to cash"],
        "industries": ["manufacturing", "retail", "enterprise", "automotive", "pharma", "cpg"],
        "description": "SAP ERP — enterprise resource planning. Contains financials (FI/CO), sales (SD), materials (MM), production (PP), supply chain. The backbone of large enterprise operations. Complex extraction via RFC, ODP, or SLT.",
    },
    "src_netsuite": {
        "keywords": ["netsuite", "oracle netsuite", "erp", "financials", "accounting", "inventory"],
        "use_cases": ["financial reporting", "inventory analytics", "order management", "revenue recognition"],
        "industries": ["smb", "ecommerce", "saas", "retail"],
        "description": "NetSuite — cloud ERP for mid-market. Contains financials, inventory, orders, CRM. Popular with growing companies and e-commerce businesses.",
    },
    "src_adp": {
        "keywords": ["adp", "payroll", "workforce", "hr", "timekeeping", "benefits administration"],
        "use_cases": ["payroll analytics", "workforce analytics", "labor cost analysis", "compliance reporting"],
        "industries": ["all"],
        "description": "ADP — payroll and workforce management. Contains payroll records, time tracking, benefits, tax data. Source for labor cost analysis and compliance.",
    },
    "src_bamboohr": {
        "keywords": ["bamboohr", "bamboo", "hr", "pto", "onboarding", "employee management"],
        "use_cases": ["hr analytics", "attrition", "onboarding analytics", "pto tracking"],
        "industries": ["smb", "startup", "tech"],
        "description": "BambooHR — SMB HR platform. Contains employee records, PTO, onboarding, performance reviews. Source for small-to-mid HR analytics.",
    },

    # ── L1: SOURCES — ITSM & Ops ────────────────────────────────────────────
    "src_servicenow": {
        "keywords": ["servicenow", "snow", "itsm", "itil", "incident", "change management", "cmdb", "service desk", "tickets"],
        "use_cases": ["it analytics", "incident analysis", "sla reporting", "change management analytics", "asset management", "service desk metrics"],
        "industries": ["enterprise", "it", "all"],
        "description": "ServiceNow — IT service management and operations. Contains incidents, changes, problems, assets, CMDB, knowledge base. Source for IT operations analytics, SLA tracking, and digital workflows.",
    },
    "src_jira": {
        "keywords": ["jira", "atlassian", "sprint", "agile", "scrum", "issues", "bugs", "stories", "epics", "kanban", "project management"],
        "use_cases": ["engineering analytics", "sprint velocity", "bug tracking", "delivery metrics", "dora metrics", "project tracking"],
        "industries": ["tech", "software", "all"],
        "description": "Jira — agile project management. Contains issues, sprints, epics, stories, bugs, workflows. Source for engineering velocity, delivery metrics, and DORA performance tracking.",
    },
    "src_zendesk": {
        "keywords": ["zendesk", "support", "tickets", "helpdesk", "customer support", "satisfaction", "csat", "nps"],
        "use_cases": ["support analytics", "customer satisfaction", "ticket resolution", "agent performance", "csat analysis", "nps tracking"],
        "industries": ["saas", "ecommerce", "all"],
        "description": "Zendesk — customer support platform. Contains tickets, agents, satisfaction scores, SLAs. Source for support analytics, CSAT/NPS tracking, and customer experience analysis.",
    },

    # ── L1: SOURCES — Marketing & Ads ────────────────────────────────────────
    "src_google_ads": {
        "keywords": ["google ads", "adwords", "sem", "ppc", "paid search", "display ads", "campaigns", "ad spend"],
        "use_cases": ["marketing analytics", "ad performance", "roas", "attribution", "campaign optimization", "cpa analysis"],
        "industries": ["ecommerce", "saas", "retail", "all"],
        "description": "Google Ads — paid search and display advertising. Contains campaigns, ad groups, keywords, conversions, spend. Source for ROAS analysis and marketing attribution.",
    },
    "src_facebook_ads": {
        "keywords": ["facebook ads", "meta ads", "instagram ads", "social ads", "fb ads", "meta business"],
        "use_cases": ["social media analytics", "ad performance", "audience analytics", "attribution", "campaign roi"],
        "industries": ["ecommerce", "retail", "dtc", "all"],
        "description": "Meta/Facebook Ads — social media advertising across Facebook and Instagram. Contains campaigns, ad sets, audiences, conversions. Source for social ad performance and cross-channel attribution.",
    },
    "src_google_analytics": {
        "keywords": ["google analytics", "ga4", "ga", "web analytics", "pageviews", "sessions", "conversions", "events", "user behavior"],
        "use_cases": ["web analytics", "conversion funnel", "user behavior", "marketing attribution", "product analytics", "acquisition analysis"],
        "industries": ["all"],
        "description": "Google Analytics (GA4) — web and app analytics. Contains sessions, events, conversions, user journeys, acquisition channels. Native BigQuery export available. Source for digital analytics and marketing attribution.",
    },
    "src_adobe_analytics": {
        "keywords": ["adobe analytics", "omniture", "adobe experience", "web analytics", "dtm", "launch"],
        "use_cases": ["web analytics", "customer journey", "personalization", "content analytics", "attribution"],
        "industries": ["enterprise", "media", "retail"],
        "description": "Adobe Analytics — enterprise web analytics. Contains visits, events, custom dimensions, segments. Popular with large enterprises already in the Adobe ecosystem.",
    },
    "src_marketo": {
        "keywords": ["marketo", "marketing automation", "email marketing", "lead nurture", "campaigns", "adobe marketo"],
        "use_cases": ["marketing automation analytics", "lead scoring", "email performance", "campaign roi", "marketing funnel"],
        "industries": ["b2b", "saas", "enterprise"],
        "description": "Marketo — B2B marketing automation. Contains leads, campaigns, emails, scoring, nurture programs. Source for marketing funnel analytics and lead quality scoring.",
    },

    # ── L1: SOURCES — Social ────────────────────────────────────────────────
    "src_facebook": {
        "keywords": ["facebook", "meta", "social media", "facebook pages", "social listening"],
        "use_cases": ["social analytics", "brand monitoring", "audience insights", "content performance"],
        "industries": ["media", "retail", "all"],
        "description": "Facebook/Meta — social media data. Contains posts, engagement, audience demographics, page insights.",
    },
    "src_twitter": {
        "keywords": ["twitter", "x", "tweets", "social media", "social listening", "hashtags"],
        "use_cases": ["social analytics", "brand monitoring", "sentiment analysis", "trending topics"],
        "industries": ["media", "tech", "all"],
        "description": "Twitter/X — social media data. Contains tweets, engagement, followers, trending topics.",
    },
    "src_linkedin": {
        "keywords": ["linkedin", "professional network", "b2b", "company pages", "talent insights"],
        "use_cases": ["b2b marketing", "talent analytics", "employer branding", "social selling"],
        "industries": ["b2b", "hr", "recruiting"],
        "description": "LinkedIn — professional network data. Contains company pages, job postings, engagement, talent insights.",
    },
    "src_instagram": {
        "keywords": ["instagram", "ig", "stories", "reels", "social media", "visual content"],
        "use_cases": ["social analytics", "influencer analytics", "visual content performance", "brand monitoring"],
        "industries": ["retail", "fashion", "dtc", "media"],
        "description": "Instagram — visual social media data. Contains posts, stories, reels, engagement, follower demographics.",
    },
    "src_youtube": {
        "keywords": ["youtube", "video analytics", "channels", "views", "subscribers", "watch time"],
        "use_cases": ["video analytics", "content performance", "audience analytics", "creator analytics"],
        "industries": ["media", "entertainment", "education"],
        "description": "YouTube — video platform data. Contains views, watch time, subscribers, engagement, demographics.",
    },
    "src_tiktok": {
        "keywords": ["tiktok", "short video", "viral", "social media", "gen z"],
        "use_cases": ["social analytics", "viral content tracking", "influencer analytics", "trend analysis"],
        "industries": ["retail", "media", "dtc", "entertainment"],
        "description": "TikTok — short-form video data. Contains views, engagement, trending sounds, creator analytics.",
    },

    # ── L1: SOURCES — App Stores ────────────────────────────────────────────
    "src_apple_store": {
        "keywords": ["app store", "apple", "ios", "mobile app", "downloads", "ratings", "app analytics"],
        "use_cases": ["app analytics", "download tracking", "review analysis", "aso", "mobile metrics"],
        "industries": ["mobile", "gaming", "fintech"],
        "description": "Apple App Store — iOS app data. Contains downloads, ratings, reviews, in-app purchases.",
    },
    "src_google_play": {
        "keywords": ["google play", "android", "play store", "mobile app", "apk", "app installs"],
        "use_cases": ["app analytics", "download tracking", "review analysis", "android metrics"],
        "industries": ["mobile", "gaming", "fintech"],
        "description": "Google Play Store — Android app data. Contains installs, ratings, reviews, crashes.",
    },

    # ── L1: SOURCES — Commerce ──────────────────────────────────────────────
    "src_shopify": {
        "keywords": ["shopify", "ecommerce", "e-commerce", "online store", "orders", "products", "inventory", "cart", "checkout"],
        "use_cases": ["ecommerce analytics", "order analytics", "inventory management", "customer ltv", "cart abandonment", "product performance"],
        "industries": ["ecommerce", "retail", "dtc"],
        "description": "Shopify — e-commerce platform. Contains orders, products, customers, inventory, fulfillment, cart data. Source for e-commerce analytics, customer LTV, and inventory optimization.",
    },
    "src_stripe": {
        "keywords": ["stripe", "payments", "subscriptions", "billing", "charges", "invoices", "revenue", "mrr"],
        "use_cases": ["payment analytics", "subscription analytics", "mrr tracking", "churn analysis", "revenue recognition", "fraud detection"],
        "industries": ["saas", "fintech", "ecommerce"],
        "description": "Stripe — payment processing. Contains charges, subscriptions, invoices, disputes, payouts. Source for revenue analytics, MRR/ARR tracking, and payment fraud analysis.",
    },

    # ── L1: SOURCES — RDBMS ─────────────────────────────────────────────────
    "src_oracle": {
        "keywords": ["oracle", "oracle db", "rdbms", "database", "logminer", "goldengate", "cdc", "exadata", "rac", "pl/sql"],
        "use_cases": ["data warehouse migration", "cdc pipeline", "database replication", "erp analytics", "legacy modernization"],
        "industries": ["enterprise", "fintech", "healthcare", "government", "manufacturing"],
        "description": "Oracle Database — enterprise RDBMS. Primary transactional database for large enterprises. CDC via LogMiner or GoldenGate. Common migration source to BigQuery for analytics modernization.",
    },
    "src_sqlserver": {
        "keywords": ["sql server", "mssql", "microsoft sql", "ssms", "ssis", "ssrs", "tsql", "cdc", "windows database"],
        "use_cases": ["data warehouse migration", "cdc pipeline", "database replication", "reporting migration", "legacy modernization"],
        "industries": ["enterprise", "healthcare", "fintech", "government"],
        "description": "Microsoft SQL Server — enterprise RDBMS. Dominant in Windows/.NET environments. Native CDC support. Common migration source for enterprises moving to GCP.",
    },
    "src_postgresql": {
        "keywords": ["postgresql", "postgres", "pg", "rdbms", "open source database", "logical replication"],
        "use_cases": ["application database", "cdc pipeline", "database replication", "web app backend", "microservices"],
        "industries": ["tech", "startup", "saas", "all"],
        "description": "PostgreSQL — open source RDBMS. Popular with modern web apps and microservices. Supports logical replication for CDC. AlloyDB is the GCP-managed PostgreSQL compatible option.",
    },
    "src_mysql": {
        "keywords": ["mysql", "mariadb", "rdbms", "open source database", "binlog", "lamp stack"],
        "use_cases": ["application database", "cdc pipeline", "web app backend", "cms backend", "wordpress"],
        "industries": ["tech", "ecommerce", "media", "all"],
        "description": "MySQL — most popular open source RDBMS. Dominant in web applications, WordPress, PHP stacks. Binlog-based CDC for real-time replication to BigQuery.",
    },
    "src_cloud_sql": {
        "keywords": ["cloud sql", "managed database", "gcp database", "managed mysql", "managed postgres"],
        "use_cases": ["managed database", "application backend", "lift and shift", "gcp native"],
        "industries": ["all"],
        "description": "Cloud SQL — GCP managed relational database. Supports MySQL, PostgreSQL, SQL Server. Managed operations with automated backups and patching.",
    },
    "src_alloydb": {
        "keywords": ["alloydb", "alloy db", "postgresql compatible", "high performance database", "columnar engine"],
        "use_cases": ["high performance analytics", "postgresql migration", "transactional + analytical", "htap"],
        "industries": ["enterprise", "fintech", "all"],
        "description": "AlloyDB — GCP high-performance PostgreSQL-compatible database with columnar engine for analytics. Combines transactional and analytical workloads.",
    },

    # ── L1: SOURCES — NoSQL ─────────────────────────────────────────────────
    "src_mongodb": {
        "keywords": ["mongodb", "mongo", "document database", "nosql", "json database", "atlas"],
        "use_cases": ["document analytics", "application backend", "content management", "iot data", "catalog data"],
        "industries": ["tech", "ecommerce", "media", "all"],
        "description": "MongoDB — document-oriented NoSQL database. Stores JSON-like documents with flexible schemas. Change Streams for real-time CDC.",
    },
    "src_cassandra": {
        "keywords": ["cassandra", "wide column", "nosql", "distributed database", "time series"],
        "use_cases": ["time series analytics", "iot backend", "high write throughput", "distributed data"],
        "industries": ["tech", "iot", "telecom"],
        "description": "Apache Cassandra — distributed wide-column NoSQL database. High write throughput for time series, IoT, and messaging data.",
    },
    "src_elasticsearch": {
        "keywords": ["elasticsearch", "elastic", "elk", "search", "logging", "kibana", "opensearch"],
        "use_cases": ["search analytics", "log analytics", "observability data", "full text search"],
        "industries": ["tech", "all"],
        "description": "Elasticsearch — distributed search and analytics engine. Contains log data, search indexes, metrics. Source for operational analytics.",
    },
    "src_redis": {
        "keywords": ["redis", "cache", "in-memory", "session store", "key value"],
        "use_cases": ["cache analytics", "session analysis", "real-time counters", "feature flags"],
        "industries": ["tech", "all"],
        "description": "Redis — in-memory data store. Contains cache data, sessions, counters, pub/sub messages.",
    },
    "src_dynamodb": {
        "keywords": ["dynamodb", "dynamo", "aws nosql", "serverless database", "key value"],
        "use_cases": ["aws migration", "serverless backend", "cross-cloud analytics"],
        "industries": ["tech", "all"],
        "description": "Amazon DynamoDB — AWS serverless NoSQL. Key-value and document data. Source for cross-cloud analytics when migrating from AWS.",
    },
    "src_firestore": {
        "keywords": ["firestore", "firebase", "realtime database", "mobile backend", "gcp nosql"],
        "use_cases": ["mobile app analytics", "real-time data", "firebase analytics", "user activity"],
        "industries": ["mobile", "gaming", "all"],
        "description": "Cloud Firestore — GCP serverless document database. Firebase integration for mobile apps. Real-time sync and offline support.",
    },
    "src_neo4j": {
        "keywords": ["neo4j", "graph database", "knowledge graph", "relationships", "cypher"],
        "use_cases": ["graph analytics", "fraud detection", "recommendation engine", "knowledge graph", "network analysis"],
        "industries": ["fintech", "social", "enterprise"],
        "description": "Neo4j — graph database. Stores relationships and connections. Source for fraud detection networks, recommendation engines, and knowledge graphs.",
    },

    # ── L1: SOURCES — Streaming ─────────────────────────────────────────────
    "src_kafka": {
        "keywords": ["kafka", "event streaming", "message queue", "events", "topics", "brokers", "real-time", "streaming"],
        "use_cases": ["real-time analytics", "event processing", "clickstream", "iot ingestion", "fraud detection", "microservices events", "log streaming"],
        "industries": ["all"],
        "description": "Apache Kafka — distributed event streaming. Real-time events from microservices, IoT, clickstream, transactions. The backbone of event-driven architectures.",
    },
    "src_confluent": {
        "keywords": ["confluent", "managed kafka", "schema registry", "ksqldb", "kafka cloud", "confluent cloud"],
        "use_cases": ["managed streaming", "event processing", "schema governance", "real-time analytics"],
        "industries": ["enterprise", "all"],
        "description": "Confluent — managed Kafka platform. Schema Registry, ksqlDB, connectors. Enterprise Kafka with governance and multi-cloud support.",
    },
    "src_kinesis": {
        "keywords": ["kinesis", "aws kinesis", "data streams", "firehose", "aws streaming"],
        "use_cases": ["aws migration", "real-time streaming", "cross-cloud", "log ingestion"],
        "industries": ["all"],
        "description": "AWS Kinesis — AWS streaming service. Source for cross-cloud streaming when migrating from AWS to GCP.",
    },
    "src_event_hubs": {
        "keywords": ["event hubs", "azure event hubs", "azure streaming", "microsoft streaming"],
        "use_cases": ["azure migration", "cross-cloud streaming", "iot events", "telemetry"],
        "industries": ["enterprise", "all"],
        "description": "Azure Event Hubs — Azure streaming service. Source for cross-cloud data when integrating Azure workloads with GCP.",
    },
    "src_rabbitmq": {
        "keywords": ["rabbitmq", "rabbit", "amqp", "message broker", "message queue"],
        "use_cases": ["message processing", "task queues", "microservices", "workflow events"],
        "industries": ["tech", "all"],
        "description": "RabbitMQ — open source message broker using AMQP. Task queues and inter-service messaging for microservices architectures.",
    },
    "src_mqtt": {
        "keywords": ["mqtt", "iot", "sensors", "telemetry", "edge devices", "industrial iot", "iiot", "connected devices"],
        "use_cases": ["iot analytics", "sensor data", "predictive maintenance", "fleet tracking", "smart building", "connected manufacturing"],
        "industries": ["manufacturing", "iot", "energy", "logistics", "automotive"],
        "description": "IoT/MQTT — lightweight messaging for IoT devices and sensors. High-frequency telemetry from edge devices, industrial equipment, vehicles, and smart buildings.",
    },

    # ── L1: SOURCES — Files & Storage ───────────────────────────────────────
    "src_sftp": {
        "keywords": ["sftp", "ftp", "file transfer", "secure file", "partner files", "data drops"],
        "use_cases": ["partner data ingestion", "batch file processing", "legacy integration", "vendor feeds"],
        "industries": ["all"],
        "description": "SFTP/S3 — secure file transfer. Partner data drops, vendor feeds, batch files. Common for legacy integrations and B2B data exchange.",
    },
    "src_s3": {
        "keywords": ["s3", "aws s3", "amazon s3", "aws storage", "data lake", "parquet", "avro"],
        "use_cases": ["aws migration", "data lake migration", "cross-cloud", "s3 to gcs", "file ingestion"],
        "industries": ["all"],
        "description": "AWS S3 — Amazon object storage. Source for AWS-to-GCP migration. Contains CSV, Parquet, JSON, Avro files. Use Storage Transfer Service for replication.",
    },
    "src_azure_blob": {
        "keywords": ["azure blob", "azure storage", "adls", "data lake storage", "azure files"],
        "use_cases": ["azure migration", "cross-cloud", "multi-cloud", "file ingestion"],
        "industries": ["enterprise", "all"],
        "description": "Azure Blob Storage — Microsoft cloud object storage. Source for Azure-to-GCP migration or multi-cloud data lake strategy.",
    },
    "src_sharepoint": {
        "keywords": ["sharepoint", "microsoft sharepoint", "document library", "intranet", "office 365"],
        "use_cases": ["document analytics", "intranet data", "knowledge management", "enterprise search"],
        "industries": ["enterprise", "all"],
        "description": "SharePoint — Microsoft collaboration platform. Contains documents, lists, metadata. Source for document analytics and enterprise content analysis.",
    },
    "src_gcs": {
        "keywords": ["gcs external", "cloud storage", "external gcs", "partner bucket", "shared bucket"],
        "use_cases": ["partner data", "external data ingestion", "shared data", "cross-project"],
        "industries": ["all"],
        "description": "GCS External — Cloud Storage bucket from external GCP project or partner. Contains shared data files for cross-organization analytics.",
    },

    # ── L1: SOURCES — Cloud Data Warehouses ─────────────────────────────────
    "src_aws_rds": {
        "keywords": ["aws rds", "rds", "amazon rds", "aurora", "aws database"],
        "use_cases": ["aws migration", "database migration", "cross-cloud replication"],
        "industries": ["all"],
        "description": "AWS RDS — Amazon managed relational database. Source for AWS-to-GCP database migration. Includes Aurora PostgreSQL and MySQL variants.",
    },
    "src_snowflake": {
        "keywords": ["snowflake", "snowflake data", "data sharing", "snowflake migration", "data warehouse"],
        "use_cases": ["warehouse migration", "cross-cloud analytics", "data consolidation", "snowflake to bigquery"],
        "industries": ["enterprise", "all"],
        "description": "Snowflake — cloud data warehouse. Source for Snowflake-to-BigQuery migration or cross-cloud federation via BigQuery Omni.",
    },
    "src_databricks": {
        "keywords": ["databricks", "lakehouse", "delta lake", "spark", "databricks migration"],
        "use_cases": ["lakehouse migration", "spark workload migration", "cross-cloud analytics", "delta lake migration"],
        "industries": ["enterprise", "tech"],
        "description": "Databricks — lakehouse platform. Source for Databricks-to-GCP migration. Delta Lake tables and Spark workloads.",
    },

    # ── L1: SOURCES — APIs & Legacy ─────────────────────────────────────────
    "src_rest_api": {
        "keywords": ["rest api", "api", "http", "webhook", "json api", "graphql", "microservice"],
        "use_cases": ["custom integration", "microservice data", "third party api", "webhook ingestion"],
        "industries": ["all"],
        "description": "Generic REST API — any HTTP-based data source. Internal microservices, third-party SaaS APIs, government data feeds, or partner integrations.",
    },
    "src_mainframe": {
        "keywords": ["mainframe", "ibm", "z/os", "cobol", "vsam", "ims", "cics", "db2", "legacy", "ebcdic"],
        "use_cases": ["legacy modernization", "mainframe offloading", "cobol migration", "batch processing"],
        "industries": ["fintech", "insurance", "government", "healthcare"],
        "description": "Mainframe (IBM z/OS) — legacy transactional systems. COBOL-based with VSAM, DB2, or IMS databases. Common in banking, insurance, and government.",
    },
    "src_as400": {
        "keywords": ["as400", "iseries", "ibm i", "rpg", "db2 for i"],
        "use_cases": ["legacy modernization", "midrange migration", "erp modernization"],
        "industries": ["manufacturing", "distribution", "retail"],
        "description": "IBM AS/400 (iSeries) — midrange system. RPG-based applications. Common in manufacturing and distribution for inventory and order management.",
    },
    "src_mq_series": {
        "keywords": ["mq series", "ibm mq", "websphere mq", "message queue", "jms"],
        "use_cases": ["legacy integration", "message processing", "mainframe to cloud", "transaction routing"],
        "industries": ["fintech", "enterprise"],
        "description": "IBM MQ Series — enterprise message queuing. Reliable message delivery between mainframes, middleware, and applications.",
    },
    "src_ftp": {
        "keywords": ["ftp", "ftps", "file transfer", "batch files", "legacy files"],
        "use_cases": ["legacy file transfer", "batch ingestion", "vendor data", "partner feeds"],
        "industries": ["all"],
        "description": "FTP/FTPS — legacy file transfer protocol. Batch file ingestion from legacy systems, vendors, and partners.",
    },
    "src_flat_file": {
        "keywords": ["flat file", "csv", "tsv", "excel", "spreadsheet", "manual upload", "text file"],
        "use_cases": ["manual data upload", "one-time migration", "reference data", "lookup tables"],
        "industries": ["all"],
        "description": "Flat Files — CSV, TSV, Excel, and text files. Manual uploads, reference data, and one-time migration sources.",
    },

    # ── L2: CONNECTIVITY ─────────────────────────────────────────────────────
    "conn_vpn": {
        "keywords": ["vpn", "ipsec", "site-to-site", "ha vpn", "tunnel", "private connectivity"],
        "use_cases": ["on-premises connectivity", "secure tunnel", "hybrid cloud"],
        "industries": ["all"],
        "description": "Cloud VPN — encrypted IPsec tunnels between on-premises and GCP. HA VPN with 99.99% SLA for production workloads.",
    },
    "conn_interconnect": {
        "keywords": ["interconnect", "dedicated interconnect", "partner interconnect", "high bandwidth", "low latency", "colocation"],
        "use_cases": ["high bandwidth transfer", "low latency connectivity", "dedicated link", "data center migration"],
        "industries": ["enterprise", "all"],
        "description": "Cloud Interconnect — dedicated high-bandwidth connection between on-premises and GCP. 10-200 Gbps links via colocation.",
    },
    "conn_vpc": {
        "keywords": ["vpc", "vpc-sc", "service controls", "network isolation", "private google access", "firewall"],
        "use_cases": ["network security", "data exfiltration prevention", "compliance", "private access"],
        "industries": ["all"],
        "description": "VPC with Service Controls — network isolation and security perimeters. Prevents data exfiltration. Mandatory for regulated data.",
    },
    "conn_iam": {
        "keywords": ["iam", "identity", "access management", "rbac", "roles", "workload identity", "least privilege"],
        "use_cases": ["access control", "identity management", "workload identity", "cross-cloud auth"],
        "industries": ["all"],
        "description": "Cloud IAM — identity and access management. Controls who can access what. Workload Identity Federation for keyless external auth.",
    },
    "conn_cloud_identity": {
        "keywords": ["cloud identity", "google identity", "directory", "users", "groups", "sso"],
        "use_cases": ["identity management", "sso", "user provisioning", "directory sync"],
        "industries": ["all"],
        "description": "Cloud Identity — Google's identity provider. User and group management, SSO, device management.",
    },
    "conn_identity_platform": {
        "keywords": ["identity platform", "cicp", "auth", "login", "oauth", "saml", "mfa", "firebase auth"],
        "use_cases": ["application auth", "customer identity", "login", "mfa", "social login"],
        "industries": ["all"],
        "description": "Identity Platform — customer-facing authentication. OAuth, SAML, MFA, social login. For applications that need end-user auth.",
    },
    "conn_entra_id": {
        "keywords": ["entra id", "azure ad", "azure active directory", "microsoft identity", "saml federation"],
        "use_cases": ["microsoft federation", "sso", "cross-cloud identity", "hybrid identity"],
        "industries": ["enterprise", "all"],
        "description": "Microsoft Entra ID (Azure AD) — identity federation from Microsoft environments. SAML SSO and SCIM provisioning for Microsoft 365 organizations.",
    },
    "conn_cyberark": {
        "keywords": ["cyberark", "pam", "privileged access", "vault", "credential management"],
        "use_cases": ["privileged access management", "credential vaulting", "session recording", "compliance"],
        "industries": ["fintech", "enterprise", "healthcare"],
        "description": "CyberArk — privileged access management. Secure credential vaulting and session management for high-security environments.",
    },
    "conn_keeper": {
        "keywords": ["keeper", "password manager", "secrets vault", "credential management"],
        "use_cases": ["password management", "credential storage", "team security"],
        "industries": ["all"],
        "description": "Keeper — password and secrets management platform.",
    },
    "conn_secret_manager": {
        "keywords": ["secret manager", "secrets", "api keys", "credentials", "passwords", "certificates"],
        "use_cases": ["secret storage", "credential management", "key rotation", "api key management"],
        "industries": ["all"],
        "description": "Secret Manager — stores API keys, passwords, certificates. Versioning, rotation, IAM-based access. Used by every pipeline for credentials.",
    },
    "conn_armor": {
        "keywords": ["cloud armor", "waf", "ddos", "firewall", "bot detection", "rate limiting"],
        "use_cases": ["api protection", "ddos protection", "waf rules", "bot mitigation"],
        "industries": ["all"],
        "description": "Cloud Armor — WAF and DDoS protection. Protects external-facing APIs and load balancers. OWASP rules and adaptive protection.",
    },
    "conn_dns": {
        "keywords": ["cloud dns", "dns", "domain", "name resolution"],
        "use_cases": ["dns management", "private dns", "domain routing"],
        "industries": ["all"],
        "description": "Cloud DNS — managed DNS service. Public and private zones for name resolution.",
    },
    "conn_apigee": {
        "keywords": ["apigee", "api management", "api gateway", "api proxy", "developer portal", "api analytics"],
        "use_cases": ["api management", "api monetization", "developer portal", "api security", "data product apis"],
        "industries": ["enterprise", "all"],
        "description": "Apigee — full-lifecycle API management. API proxies, rate limiting, OAuth, analytics, developer portal. For exposing data products as managed APIs.",
    },
    "conn_api_gateway": {
        "keywords": ["api gateway", "gateway", "serverless api", "rest gateway"],
        "use_cases": ["serverless api", "lightweight gateway", "cloud functions frontend"],
        "industries": ["all"],
        "description": "API Gateway — lightweight serverless API gateway. Simpler than Apigee for internal APIs and Cloud Functions endpoints.",
    },

    # ── L3: INGESTION ────────────────────────────────────────────────────────
    "ing_datastream": {
        "keywords": ["datastream", "cdc", "change data capture", "replication", "real-time replication"],
        "use_cases": ["database cdc", "real-time replication", "oracle cdc", "mysql cdc", "postgres cdc"],
        "industries": ["all"],
        "description": "Datastream — serverless CDC service. Reads database change logs and streams to BigQuery or GCS. Supports Oracle, MySQL, PostgreSQL, SQL Server.",
    },
    "ing_pubsub": {
        "keywords": ["pub/sub", "pubsub", "messaging", "event ingestion", "streaming ingestion", "topic"],
        "use_cases": ["event streaming", "real-time ingestion", "kafka landing", "webhook ingestion", "iot events"],
        "industries": ["all"],
        "description": "Pub/Sub — serverless messaging. GCP landing zone for all streaming data. Millions of events per second with exactly-once via Dataflow.",
    },
    "ing_dataflow": {
        "keywords": ["dataflow", "beam", "apache beam", "stream processing", "etl", "batch processing"],
        "use_cases": ["stream processing", "etl pipeline", "data transformation", "windowed aggregations"],
        "industries": ["all"],
        "description": "Dataflow — serverless stream and batch processing (Apache Beam). ETL, enrichment, windowed aggregations. Auto-scaling.",
    },
    "ing_functions": {
        "keywords": ["cloud functions", "serverless", "lambda", "event driven", "api polling", "webhook handler"],
        "use_cases": ["saas api ingestion", "webhook handler", "lightweight etl", "event processing"],
        "industries": ["all"],
        "description": "Cloud Functions — serverless compute. Event-driven code for SaaS API polling, webhook handling, and lightweight data transformations.",
    },
    "ing_fivetran": {
        "keywords": ["fivetran", "managed etl", "connector", "data integration", "saas connector"],
        "use_cases": ["managed saas ingestion", "zero code ingestion", "connector hub"],
        "industries": ["all"],
        "description": "Fivetran — managed data integration with 300+ pre-built connectors. Zero-maintenance SaaS source ingestion.",
    },
    "ing_matillion": {
        "keywords": ["matillion", "etl", "elt", "data transformation", "low code"],
        "use_cases": ["low code etl", "data transformation", "visual pipeline builder"],
        "industries": ["enterprise", "all"],
        "description": "Matillion — low-code ELT platform. Visual pipeline builder for data transformation and loading into BigQuery.",
    },

    # ── L4: DATA LAKE ────────────────────────────────────────────────────────
    "lake_gcs": {
        "keywords": ["cloud storage", "gcs", "data lake", "object storage", "parquet", "raw zone", "landing zone"],
        "use_cases": ["raw data storage", "data lake", "landing zone", "archive", "unstructured data"],
        "industries": ["all"],
        "description": "Cloud Storage (GCS) — object storage for the data lake. Landing zone for all raw data before processing. Parquet, Avro, JSON, CSV storage.",
    },
    "lake_bq_staging": {
        "keywords": ["bigquery staging", "bq staging", "landing dataset", "raw bigquery", "bronze bq"],
        "use_cases": ["streaming landing", "direct to bigquery", "real-time staging"],
        "industries": ["all"],
        "description": "BigQuery Staging — dedicated dataset for raw/landing data. Used when Datastream or Pub/Sub write directly to BigQuery.",
    },

    # ── L5: PROCESSING ───────────────────────────────────────────────────────
    "proc_bq_sql": {
        "keywords": ["bigquery", "bq", "sql", "dataform", "dbt", "elt", "transformations", "analytics engine"],
        "use_cases": ["data transformation", "elt", "medallion processing", "analytics queries", "data modeling"],
        "industries": ["all"],
        "description": "BigQuery SQL — primary processing engine for batch transformations. Standard SQL with extensions. Petabyte-scale without infrastructure.",
    },
    "proc_dataproc": {
        "keywords": ["dataproc", "spark", "pyspark", "hadoop", "hive", "spark sql", "emr migration"],
        "use_cases": ["spark workloads", "ml feature engineering", "complex transforms", "emr migration"],
        "industries": ["enterprise", "tech"],
        "description": "Dataproc — managed Spark and Hadoop. PySpark, Spark SQL, Spark ML. Serverless Spark option. For workloads that need Spark specifically.",
    },
    "proc_dataflow": {
        "keywords": ["dataflow processing", "stream transform", "beam processing", "windowing", "sessionization"],
        "use_cases": ["stream processing", "real-time transforms", "sessionization", "enrichment"],
        "industries": ["all"],
        "description": "Dataflow for processing — stream transformations, sessionization, real-time ML inference on streaming data.",
    },
    "proc_dlp": {
        "keywords": ["dlp", "data loss prevention", "pii", "phi", "pci", "masking", "tokenization", "de-identification", "sensitive data"],
        "use_cases": ["pii scanning", "data masking", "compliance", "phi detection", "tokenization"],
        "industries": ["healthcare", "fintech", "all"],
        "description": "Cloud DLP — scans for PII, PHI, PCI data. De-identification, tokenization, masking. Essential for HIPAA, PCI-DSS, GDPR compliance.",
    },
    "proc_matillion": {
        "keywords": ["matillion processing", "matillion transform", "low code transform"],
        "use_cases": ["visual transformations", "low code processing"],
        "industries": ["enterprise"],
        "description": "Matillion for processing — visual transformation layer integrated with BigQuery.",
    },

    # ── L6: MEDALLION ────────────────────────────────────────────────────────
    "bronze": {
        "keywords": ["bronze", "raw", "landing", "append only", "immutable", "system of record"],
        "use_cases": ["raw data storage", "audit trail", "data lineage", "replay"],
        "industries": ["all"],
        "description": "Bronze layer — raw, unprocessed data exactly as ingested. Append-only, immutable. System of record.",
    },
    "silver": {
        "keywords": ["silver", "cleaned", "validated", "deduplicated", "conformed", "enriched"],
        "use_cases": ["data quality", "deduplication", "schema validation", "business rules"],
        "industries": ["all"],
        "description": "Silver layer — cleaned, validated, deduplicated data. Schema enforced, nulls handled, business keys validated.",
    },
    "gold": {
        "keywords": ["gold", "business ready", "aggregated", "star schema", "facts", "dimensions", "kpis", "metrics"],
        "use_cases": ["bi serving", "kpi dashboards", "reporting", "data products", "api serving"],
        "industries": ["all"],
        "description": "Gold layer — business-ready aggregated data. Fact and dimension tables, KPIs, pre-computed metrics for BI and API serving.",
    },

    # ── L7: SERVING ──────────────────────────────────────────────────────────
    "serve_looker": {
        "keywords": ["looker", "lookml", "bi", "dashboards", "analytics", "governed metrics", "semantic layer"],
        "use_cases": ["business intelligence", "dashboards", "governed metrics", "embedded analytics", "self-service analytics"],
        "industries": ["all"],
        "description": "Looker — BI platform with semantic modeling (LookML). Governed metrics, dashboards, data exploration on BigQuery gold layer.",
    },
    "serve_run": {
        "keywords": ["cloud run", "containerized api", "data api", "microservice", "serverless"],
        "use_cases": ["data product api", "custom api", "ml inference", "microservices"],
        "industries": ["all"],
        "description": "Cloud Run — containerized APIs. Serves data products as REST/gRPC endpoints. Auto-scales to zero.",
    },
    "serve_hub": {
        "keywords": ["analytics hub", "data sharing", "data exchange", "data marketplace", "cross-org sharing"],
        "use_cases": ["data sharing", "data marketplace", "cross-org analytics", "data products"],
        "industries": ["enterprise", "all"],
        "description": "Analytics Hub — data sharing and exchange. Publish and subscribe to shared BigQuery datasets across organizations.",
    },
    "serve_bi_engine": {
        "keywords": ["bi engine", "in-memory", "fast queries", "acceleration", "sub-second"],
        "use_cases": ["dashboard acceleration", "interactive analytics", "sub-second queries"],
        "industries": ["all"],
        "description": "BQ BI Engine — in-memory analysis service. Sub-second query response for interactive dashboards in Looker and Data Studio.",
    },

    # ── L8: CONSUMERS ────────────────────────────────────────────────────────
    "con_looker": {
        "keywords": ["looker dashboards", "executive dashboards", "business dashboards", "looker reports"],
        "use_cases": ["executive reporting", "operational dashboards", "embedded analytics"],
        "industries": ["all"],
        "description": "Looker Dashboards — consumer-facing dashboards and reports built on Looker's semantic layer.",
    },
    "con_sheets": {
        "keywords": ["connected sheets", "google sheets", "spreadsheet", "excel alternative"],
        "use_cases": ["ad hoc analysis", "business user analytics", "spreadsheet integration"],
        "industries": ["all"],
        "description": "Connected Sheets — BigQuery data directly in Google Sheets. For business users who prefer spreadsheet analysis.",
    },
    "con_vertex": {
        "keywords": ["vertex ai", "notebooks", "jupyter", "ml", "machine learning", "ai", "data science", "model training"],
        "use_cases": ["data science", "ml model training", "feature engineering", "ai analytics", "prediction"],
        "industries": ["all"],
        "description": "Vertex AI Notebooks — managed Jupyter for data science. ML model training, feature engineering, and AI experimentation on BigQuery data.",
    },
    "con_run": {
        "keywords": ["cloud run api", "custom app", "data app", "internal tool"],
        "use_cases": ["custom applications", "internal tools", "data apps", "api consumers"],
        "industries": ["all"],
        "description": "Cloud Run APIs — custom applications consuming data products via REST APIs.",
    },
    "con_hub": {
        "keywords": ["analytics hub consumer", "data subscriber", "shared data"],
        "use_cases": ["data consumption", "cross-org analytics", "partner data"],
        "industries": ["enterprise", "all"],
        "description": "Analytics Hub consumer — subscribes to shared datasets published via Analytics Hub.",
    },
    "con_powerbi": {
        "keywords": ["power bi", "powerbi", "microsoft bi", "dax", "microsoft reports"],
        "use_cases": ["microsoft bi", "enterprise reporting", "power bi dashboards"],
        "industries": ["enterprise", "all"],
        "description": "Power BI — Microsoft BI tool consuming BigQuery data. For organizations standardized on Microsoft tools.",
    },
    "con_tableau": {
        "keywords": ["tableau", "viz", "visualization", "tableau server", "tableau online"],
        "use_cases": ["data visualization", "interactive dashboards", "tableau reports"],
        "industries": ["enterprise", "all"],
        "description": "Tableau — data visualization platform consuming BigQuery data.",
    },
    "con_slicer": {
        "keywords": ["slicer", "dicer", "pivot", "ad hoc", "exploration", "self-service"],
        "use_cases": ["self-service analytics", "ad hoc exploration", "pivot analysis"],
        "industries": ["all"],
        "description": "Slicer & Dicer — self-service exploration tool for ad hoc data analysis.",
    },

    # ── PILLARS ──────────────────────────────────────────────────────────────
    "pillar_sec": {
        "keywords": ["security", "iam", "encryption", "kms", "cmek", "vpc-sc", "scc", "wiz", "zero trust"],
        "use_cases": ["security posture", "encryption", "compliance", "threat detection", "zero trust"],
        "industries": ["all"],
        "description": "Security pillar — IAM, KMS/CMEK encryption, VPC Service Controls, Security Command Center, Cloud Armor. Non-negotiable for all architectures.",
    },
    "pillar_gov": {
        "keywords": ["governance", "data quality", "lineage", "catalog", "dataplex", "data catalog", "classification", "policy"],
        "use_cases": ["data governance", "data quality", "lineage tracking", "data catalog", "policy enforcement"],
        "industries": ["all"],
        "description": "Governance pillar — Dataplex, Data Catalog, Data Lineage, Cloud DLP. Data quality, discovery, and compliance.",
    },
    "pillar_obs": {
        "keywords": ["observability", "monitoring", "logging", "alerting", "datadog", "splunk", "grafana", "pagerduty", "cloud monitoring"],
        "use_cases": ["pipeline monitoring", "alerting", "sla tracking", "performance monitoring"],
        "industries": ["all"],
        "description": "Observability pillar — Cloud Monitoring, Logging, Error Reporting. Integrations with Datadog, Splunk, Grafana, PagerDuty.",
    },
    "pillar_orch": {
        "keywords": ["orchestration", "airflow", "composer", "scheduler", "workflow", "dag", "pipeline scheduling", "cost management"],
        "use_cases": ["workflow orchestration", "pipeline scheduling", "dependency management", "cost optimization"],
        "industries": ["all"],
        "description": "Orchestration pillar — Cloud Composer (Airflow), Cloud Scheduler, Workflows. Pipeline scheduling, dependencies, and cost management.",
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# ARCHITECTURE PATTERNS — pre-defined subsets of the blueprint
# ═══════════════════════════════════════════════════════════════════════════════
# Each pattern is a named subset: prompt keywords → set of product IDs.
# Semantic search finds the right pattern, auto_wire fills the rest.

ARCHITECTURE_PATTERNS: List[dict] = [
    {
        "id": "batch_rdbms",
        "name": "Batch RDBMS to BigQuery",
        "keywords": ["oracle to bigquery", "sql server migration", "database migration", "data warehouse migration", "cdc pipeline", "legacy database", "rdbms to cloud"],
        "description": "Classic batch pipeline from on-premises RDBMS to BigQuery via CDC. Datastream for replication, GCS landing, medallion transformations.",
        "sources": ["src_oracle", "src_sqlserver", "src_postgresql", "src_mysql"],
        "source_match": "any",
    },
    {
        "id": "streaming_realtime",
        "name": "Real-Time Streaming Analytics",
        "keywords": ["real-time analytics", "streaming pipeline", "kafka to bigquery", "event processing", "clickstream", "iot analytics", "fraud detection real-time"],
        "description": "Real-time event streaming from Kafka/IoT to BigQuery. Pub/Sub ingestion, Dataflow processing, sub-minute latency dashboards.",
        "sources": ["src_kafka", "src_confluent", "src_kinesis", "src_event_hubs", "src_mqtt", "src_rabbitmq"],
        "source_match": "any",
    },
    {
        "id": "saas_integration",
        "name": "SaaS Data Integration Hub",
        "keywords": ["salesforce analytics", "crm analytics", "customer 360", "saas consolidation", "hubspot analytics", "marketing analytics"],
        "description": "Consolidate multiple SaaS sources into unified analytics. Cloud Functions or Fivetran for API ingestion. Customer 360, marketing attribution.",
        "sources": ["src_salesforce", "src_hubspot", "src_dynamics365", "src_workday", "src_shopify", "src_stripe", "src_zendesk"],
        "source_match": "any",
    },
    {
        "id": "hybrid_multicloud",
        "name": "Hybrid Multi-Cloud Platform",
        "keywords": ["multi-cloud", "aws to gcp", "azure to gcp", "hybrid cloud", "cross-cloud", "s3 migration", "cloud migration"],
        "description": "Data platform spanning on-prem, AWS, Azure, and GCP. Combines RDBMS CDC, S3/Blob migration, and SaaS ingestion into unified BigQuery.",
        "sources": ["src_s3", "src_azure_blob", "src_aws_rds", "src_kinesis", "src_dynamodb", "src_snowflake", "src_databricks"],
        "source_match": "any",
    },
    {
        "id": "legacy_modernization",
        "name": "Legacy Modernization",
        "keywords": ["mainframe migration", "legacy modernization", "cobol to cloud", "as400 migration", "mq series", "legacy to gcp"],
        "description": "Modernize legacy mainframe and midrange systems to GCP. File-based extraction, MQ integration, batch processing into BigQuery medallion.",
        "sources": ["src_mainframe", "src_as400", "src_mq_series", "src_ftp", "src_flat_file"],
        "source_match": "any",
    },
    {
        "id": "data_mesh",
        "name": "Data Mesh / Data Products",
        "keywords": ["data mesh", "data products", "domain driven", "self-serve analytics", "data marketplace", "analytics hub"],
        "description": "Decentralized data platform. Domain teams own their medallion pipelines. Analytics Hub for cross-domain sharing. Apigee for data product APIs.",
        "sources": [],
        "source_match": "none",
        "extra_products": ["conn_apigee", "serve_hub", "con_hub"],
    },
    {
        "id": "ecommerce_platform",
        "name": "E-Commerce Analytics",
        "keywords": ["ecommerce", "e-commerce", "shopify analytics", "online store", "cart abandonment", "product analytics", "inventory analytics", "retail analytics"],
        "description": "E-commerce data platform combining POS, online store, payment, and marketing data. Customer LTV, inventory optimization, marketing attribution.",
        "sources": ["src_shopify", "src_stripe", "src_google_analytics", "src_google_ads", "src_facebook_ads"],
        "source_match": "any",
    },
    {
        "id": "marketing_analytics",
        "name": "Marketing Analytics Hub",
        "keywords": ["marketing analytics", "ad performance", "attribution", "campaign analytics", "social media analytics", "roas", "marketing roi"],
        "description": "Unified marketing analytics from ads, web, social, and email. Cross-channel attribution, ROAS analysis, campaign optimization.",
        "sources": ["src_google_ads", "src_facebook_ads", "src_google_analytics", "src_adobe_analytics", "src_marketo", "src_facebook", "src_twitter", "src_linkedin", "src_instagram", "src_youtube", "src_tiktok"],
        "source_match": "any",
    },
    {
        "id": "hr_people_analytics",
        "name": "People Analytics Platform",
        "keywords": ["hr analytics", "people analytics", "workforce planning", "attrition", "headcount", "talent analytics", "diversity", "compensation"],
        "description": "People analytics from HR, payroll, and workforce systems. Headcount planning, attrition prediction, diversity metrics, compensation benchmarking.",
        "sources": ["src_workday", "src_adp", "src_bamboohr", "src_sap"],
        "source_match": "any",
    },
    {
        "id": "iot_manufacturing",
        "name": "IoT & Manufacturing Analytics",
        "keywords": ["iot", "sensors", "manufacturing", "predictive maintenance", "factory", "scada", "industrial", "smart factory", "connected devices"],
        "description": "IoT sensor data from manufacturing equipment. High-frequency telemetry, predictive maintenance, quality analytics. SAP integration for ERP context.",
        "sources": ["src_mqtt", "src_kafka", "src_sap"],
        "source_match": "any",
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# INDUSTRY OVERLAYS — additional requirements per vertical
# ═══════════════════════════════════════════════════════════════════════════════

INDUSTRY_TAGS: Dict[str, dict] = {
    "healthcare": {
        "keywords": ["healthcare", "hipaa", "ehr", "clinical", "patient", "hospital", "medical", "pharma", "health system", "phi"],
        "compliance": ["HIPAA", "HITECH", "SOC2"],
        "required_products": ["proc_dlp", "conn_vpc", "pillar_sec", "pillar_gov"],
        "description": "HIPAA-compliant data platform. Mandatory DLP scanning for PHI, CMEK encryption, VPC Service Controls, audit logging.",
    },
    "fintech": {
        "keywords": ["fintech", "banking", "pci", "fraud", "transaction", "financial", "payment", "sox", "insurance", "lending", "credit"],
        "compliance": ["PCI-DSS", "SOX", "SOC2", "GDPR"],
        "required_products": ["proc_dlp", "conn_vpc", "conn_armor", "pillar_sec", "pillar_gov"],
        "description": "PCI-DSS and SOX-compliant platform. Tokenization for card data, real-time fraud detection, immutable audit trail.",
    },
    "retail": {
        "keywords": ["retail", "store", "pos", "omnichannel", "inventory", "supply chain retail", "cpg", "consumer goods"],
        "compliance": ["PCI-DSS", "GDPR", "CCPA"],
        "required_products": ["proc_dlp"],
        "description": "Retail data platform combining POS, e-commerce, inventory, and customer data. Omnichannel analytics.",
    },
    "manufacturing": {
        "keywords": ["manufacturing", "factory", "production", "quality control", "oee", "scada", "plc", "assembly line"],
        "compliance": ["ISO 27001", "SOC2"],
        "required_products": [],
        "description": "Manufacturing analytics with IoT sensor data, ERP integration, predictive maintenance, and quality tracking.",
    },
    "media": {
        "keywords": ["media", "entertainment", "content", "audience", "streaming media", "ad tech", "publishing", "news"],
        "compliance": ["GDPR", "CCPA", "COPPA"],
        "required_products": ["proc_dlp"],
        "description": "Media analytics with high-volume content consumption, audience measurement, and ad tech data.",
    },
    "government": {
        "keywords": ["government", "gov", "fedramp", "public sector", "state", "federal", "military", "dod"],
        "compliance": ["FedRAMP", "FISMA", "ITAR", "SOC2"],
        "required_products": ["conn_vpc", "pillar_sec", "pillar_gov", "proc_dlp"],
        "description": "FedRAMP-compliant platform for government workloads. Strict access controls, encryption, and audit requirements.",
    },
}


def get_search_text(product_id: str) -> str:
    """Build a rich text string for embedding from product tags + node info."""
    node = NODES.get(product_id, {})
    tags = PRODUCT_TAGS.get(product_id, {})
    parts = [
        node.get("name", ""),
        node.get("subtitle", ""),
        tags.get("description", ""),
        " ".join(tags.get("keywords", [])),
        " ".join(tags.get("use_cases", [])),
        " ".join(tags.get("industries", [])),
    ]
    return " ".join(p for p in parts if p)


def match_industry(prompt: str) -> Optional[str]:
    """Detect industry from prompt using INDUSTRY_TAGS keywords."""
    p = prompt.lower()
    for industry_id, ind in INDUSTRY_TAGS.items():
        for kw in ind["keywords"]:
            if kw in p:
                return industry_id
    return None
