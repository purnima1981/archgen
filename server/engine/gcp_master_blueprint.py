"""
═══════════════════════════════════════════════════════════════
  GCP DATA PLATFORM — MASTER BLUEPRINT
  The single source of truth for ALL products, wiring, and layout.
  
  The slicer reads this file + knowledge base + user prompt
  → selects product IDs → AST-slices → renders focused PNG.

  Every product from gcp-data-platform-knowledge.ts is mapped here
  to its mingrammer class, layer, cluster, and position.
═══════════════════════════════════════════════════════════════
"""

# ─────────────────────────────────────────────────
# IMPORTS — every provider we might need
# ─────────────────────────────────────────────────
from diagrams import Diagram, Cluster, Edge

# GCP
from diagrams.gcp.analytics import (
    BigQuery, Composer, DataCatalog, DataFusion,
    Dataflow, Dataproc, Looker, PubSub
)
from diagrams.gcp.security import (
    Iam, KMS, SecretManager, SCC, SecurityScanner
)
from diagrams.gcp.operations import Monitoring, Logging
from diagrams.gcp.compute import Functions, CloudRun, GKE
from diagrams.gcp.database import SQL, Spanner
from diagrams.gcp.network import (
    VPC, VPN, DedicatedInterconnect, Armor, DNS
)
from diagrams.gcp.storage import GCS
from diagrams.gcp.ml import VertexAI, AutoML
from diagrams.gcp.api import Apigee
from diagrams.gcp.devtools import Scheduler
from diagrams.gcp.iot import IotCore

# AWS
from diagrams.aws.storage import S3

# On-Prem / Vendor
from diagrams.onprem.database import (
    Oracle, PostgreSQL, MySQL, MongoDB, MSSQL
)
from diagrams.onprem.queue import Kafka
from diagrams.onprem.analytics import PowerBI, Databricks, Dbt
from diagrams.onprem.security import Vault
from diagrams.onprem.monitoring import Splunk, Dynatrace
from diagrams.onprem.client import Users, Client
from diagrams.onprem.network import Internet

# SaaS
from diagrams.saas.alerting import Pagerduty
from diagrams.saas.identity import Okta

# ─────────────────────────────────────────────────
# EDGE STYLES
# ─────────────────────────────────────────────────
E_BLUE       = {"color": "#4285f4", "penwidth": "2"}
E_BLUE_DASH  = {"color": "#4285f4", "style": "dashed", "penwidth": "1.5"}
E_ORANGE     = {"color": "#ea8600", "style": "dashed", "penwidth": "2"}
E_PURPLE     = {"color": "#9334e6", "style": "dashed", "penwidth": "1.5"}
E_GREEN      = {"color": "#34a853", "penwidth": "2"}
E_GREEN_DASH = {"color": "#34a853", "style": "dashed", "penwidth": "1.5"}
E_RED_DASH   = {"color": "#ea4335", "style": "dashed", "penwidth": "1.5"}
E_TEAL       = {"color": "#00897b", "penwidth": "2"}

# Cross-cutting pillar edge styles (ALL dashed)
E_QUALITY_DASH = {"color": "#a21caf", "style": "dashed", "penwidth": "1.5"}
E_ORC_DASH     = {"color": "#0284c7", "style": "dashed", "penwidth": "1.5"}
E_OBS_DASH     = {"color": "#dc2626", "style": "dashed", "penwidth": "1.5"}
E_GOV_DASH     = {"color": "#16a34a", "style": "dashed", "penwidth": "1.5"}
E_SEC_DASH     = {"color": "#d97706", "style": "dashed", "penwidth": "1.5"}

# ─────────────────────────────────────────────────
# CLUSTER STYLES
# ─────────────────────────────────────────────────
# SOLID borders = sequential pipeline layers
CS_SOURCES   = {"style": "dashed", "color": "#fb923c", "bgcolor": "#fff7ed", "fontsize": "12", "fontcolor": "#c2410c", "penwidth": "2"}
CS_VENDORS   = {"style": "dashed", "color": "#a78bfa", "bgcolor": "#f5f3ff", "fontsize": "12", "fontcolor": "#7c3aed", "penwidth": "2"}
CS_GCP       = {"style": "rounded", "color": "#6c8aff", "penwidth": "2.5", "bgcolor": "#f0f4ff", "fontsize": "14", "fontcolor": "#4266e8"}
CS_L2        = {"style": "rounded", "color": "#f87171", "bgcolor": "#fef2f2", "fontsize": "11", "fontcolor": "#dc2626", "penwidth": "2"}
CS_L3        = {"style": "rounded", "color": "#22d3ee", "bgcolor": "#ecfeff", "fontsize": "11", "fontcolor": "#0891b2", "penwidth": "2"}
CS_L4        = {"style": "rounded", "color": "#a78bfa", "bgcolor": "#f5f3ff", "fontsize": "11", "fontcolor": "#7c3aed", "penwidth": "2"}
CS_L5        = {"style": "rounded", "color": "#f472b6", "bgcolor": "#fdf2f8", "fontsize": "11", "fontcolor": "#db2777", "penwidth": "2"}
CS_L6        = {"style": "rounded", "color": "#fbbf24", "bgcolor": "#fffbeb", "fontsize": "11", "fontcolor": "#d97706", "penwidth": "2"}
CS_L7        = {"style": "rounded", "color": "#4ade80", "bgcolor": "#f0fdf4", "fontsize": "11", "fontcolor": "#16a34a", "penwidth": "2"}
CS_CONSUMERS = {"style": "dashed", "color": "#6c8aff", "bgcolor": "#f0f4ff", "fontsize": "12", "fontcolor": "#4266e8", "penwidth": "2"}

# DASHED borders = cross-cutting pillars
CS_QUALITY   = {"style": "dashed", "color": "#e879f9", "bgcolor": "#fdf4ff", "fontsize": "11", "fontcolor": "#a21caf", "penwidth": "2"}
CS_OBS       = {"style": "dashed", "color": "#f87171", "bgcolor": "#fef2f2", "fontsize": "11", "fontcolor": "#dc2626", "penwidth": "2"}
CS_ORC       = {"style": "dashed", "color": "#38bdf8", "bgcolor": "#f0f9ff", "fontsize": "11", "fontcolor": "#0284c7", "penwidth": "2"}
CS_SEC       = {"style": "dashed", "color": "#fbbf24", "bgcolor": "#fffbeb", "fontsize": "11", "fontcolor": "#d97706", "penwidth": "2"}
CS_GOV       = {"style": "dashed", "color": "#4ade80", "bgcolor": "#f0fdf4", "fontsize": "11", "fontcolor": "#16a34a", "penwidth": "2"}


# ═══════════════════════════════════════════════════════════
# THE MASTER DIAGRAM
# ═══════════════════════════════════════════════════════════

with Diagram(
    "GCP Data Platform — Master Blueprint",
    filename="FILENAME_PLACEHOLDER",
    show=False,
    direction="LR",
    outformat="png",
    graph_attr={
        "fontsize": "18",
        "bgcolor": "white",
        "pad": "0.8",
        "nodesep": "0.6",
        "ranksep": "1.2",
        "dpi": "150",
    },
    node_attr={"fontsize": "10"},
    edge_attr={"fontsize": "9"},
):

    # ═══════════════════════════════════════════════════
    # L1 — SOURCES (external, dashed orange)
    # ═══════════════════════════════════════════════════

    with Cluster("L1  SOURCES", graph_attr=CS_SOURCES):

        with Cluster("GCP-Native Sources", graph_attr=CS_SOURCES):
            cloud_sql       = SQL("Cloud SQL\nMySQL / PG / MSSQL")
            cloud_spanner   = Spanner("Cloud Spanner\nGlobal Relational")

        with Cluster("On-Prem Databases", graph_attr=CS_SOURCES):
            oracle_db       = Oracle("Oracle DB\nRDBMS")
            sqlserver_db    = MSSQL("SQL Server\nRDBMS")
            postgresql_db   = PostgreSQL("PostgreSQL\nOpen Source")
            mongodb_db      = MongoDB("MongoDB\nDocument DB")

        with Cluster("SaaS Applications", graph_attr=CS_SOURCES):
            salesforce      = Internet("Salesforce\nCRM")
            workday         = Internet("Workday\nHCM / Finance")
            servicenow_src  = Internet("ServiceNow\nITSM")
            sap_src         = Internet("SAP\nERP")

        with Cluster("Event Streams", graph_attr=CS_SOURCES):
            kafka_stream    = Kafka("Apache Kafka\nEvent Stream")

        with Cluster("Files / Object Stores", graph_attr=CS_SOURCES):
            aws_s3          = S3("AWS S3\nCross-Cloud Files")
            sftp_server     = Internet("SFTP Server\nLegacy Files")

    # ═══════════════════════════════════════════════════
    # VENDORS — Identity & PAM
    # ═══════════════════════════════════════════════════

    with Cluster("VENDORS  Identity & PAM", graph_attr=CS_VENDORS):
        entra_id    = Okta("Entra ID\nEnterprise SSO")
        cyberark    = Vault("CyberArk\nPAM Vault")
        keeper      = Vault("Keeper\nPassword Mgmt")

    # ═══════════════════════════════════════════════════
    # GOOGLE CLOUD PLATFORM
    # ═══════════════════════════════════════════════════

    with Cluster("Google Cloud Platform", graph_attr=CS_GCP):

        # ── L2 — CONNECTIVITY & ACCESS (solid red) ──
        with Cluster("L2  Connectivity & Access", graph_attr=CS_L2):
            cloud_vpn       = VPN("Cloud VPN\nIPSec Tunnel")
            cloud_interco   = DedicatedInterconnect("Dedicated\nInterconnect")
            vpc             = VPC("VPC\nNetwork")
            vpc_sc          = SCC("VPC Service Controls\nPerimeter")
            cloud_armor     = Armor("Cloud Armor\nDDoS + WAF")
            cloud_iam       = Iam("Cloud IAM\nWIF + Roles")
            secret_manager  = SecretManager("Secret Manager\nCredentials")
            apigee          = Apigee("Apigee\nAPI Gateway")
            cloud_dns       = DNS("Cloud DNS\nName Resolution")

        # ── L3 — INGESTION (solid cyan) ──
        with Cluster("L3  Ingestion", graph_attr=CS_L3):
            datastream      = Dataflow("Datastream\nCDC Replication")
            pubsub          = PubSub("Cloud Pub/Sub\nMessaging")
            dataflow_ing    = Dataflow("Dataflow\nStream / Batch ETL")
            cloud_functions = Functions("Cloud Functions\nAPI Polling")
            bq_dts          = BigQuery("BQ Data Transfer\nScheduled Loads")
            storage_transfer= GCS("Storage Transfer\nCross-Cloud Copy")
            data_fusion     = DataFusion("Data Fusion\nVisual ETL")
            matillion       = Databricks("Matillion\nELT Platform")
            fivetran        = Databricks("Fivetran\nNo-Code ELT")

        # ── L4 — DATA LAKE / LANDING (solid purple) ──
        with Cluster("L4  Data Lake / Landing", graph_attr=CS_L4):
            gcs_raw         = GCS("Cloud Storage\nGCS Raw Zone")
            bq_staging      = BigQuery("BigQuery\nStaging Datasets")

        # ── L5 — PROCESSING (solid pink — NO quality) ──
        with Cluster("L5  Processing", graph_attr=CS_L5):
            dataform        = BigQuery("Dataform\nSQL ELT")
            dataflow_proc   = Dataflow("Dataflow\nStream Processing")
            dataproc        = Dataproc("Dataproc\nSpark / Hadoop")

        # ── L6 — MEDALLION (solid amber) ──
        with Cluster("L6  Medallion Architecture", graph_attr=CS_L6):
            bronze          = BigQuery("Bronze\n1:1 Raw + Metadata")
            silver          = BigQuery("Silver\nClean + Dedup + SCD")
            gold            = BigQuery("Gold\nBusiness-Ready")

        # ── L7 — SERVING & DELIVERY (solid green) ──
        with Cluster("L7  Serving & Delivery", graph_attr=CS_L7):
            looker          = Looker("Looker\nGoverned BI")
            looker_studio   = BigQuery("Looker Studio\nFree Dashboards")
            analytics_hub   = BigQuery("Analytics Hub\nData Exchange")
            cloud_run       = CloudRun("Cloud Run\nServing API")
            vertex_ai       = VertexAI("Vertex AI\nML Platform")

        # ══════════════════════════════════════════════
        # CROSS-CUTTING PILLARS (all dashed borders)
        # ══════════════════════════════════════════════

        # ── Quality Gate (dashed fuchsia) ──
        with Cluster("Quality Gate", graph_attr=CS_QUALITY):
            dataplex_dq     = DataCatalog("Dataplex DQ\nQuality Gates")
            cloud_dlp       = SecurityScanner("Cloud DLP\nPII Detection")

        # ── Orchestration (dashed sky blue) ──
        with Cluster("Orchestration", graph_attr=CS_ORC):
            cloud_composer  = Composer("Cloud Composer\nAirflow DAGs")
            cloud_scheduler = Scheduler("Cloud Scheduler\nManaged Cron")

        # ── Security (dashed amber) ──
        with Cluster("Security", graph_attr=CS_SEC):
            cloud_kms       = KMS("Cloud KMS\nEncryption Keys")
            scc_pillar      = SCC("Security Cmd Ctr\nPosture Mgmt")
            audit_logs      = Logging("Audit Logs\nImmutable Trail")

        # ── Governance (dashed green) ──
        with Cluster("Governance", graph_attr=CS_GOV):
            dataplex        = DataCatalog("Dataplex\nUnified Governance")
            data_catalog    = DataCatalog("Data Catalog\nMetadata Search")

    # ═══════════════════════════════════════════════════
    # Observability & Ops (dashed red — OUTSIDE GCP)
    # ═══════════════════════════════════════════════════

    with Cluster("Observability & Ops", graph_attr=CS_OBS):
        cloud_monitoring = Monitoring("Cloud Monitoring\nMetrics + Alerts")
        cloud_logging    = Logging("Cloud Logging\nCentralized Logs")
        splunk_siem      = Splunk("Splunk\nSIEM / Log Analytics")
        dynatrace_apm    = Dynatrace("Dynatrace\nAPM")
        pagerduty_inc    = Pagerduty("PagerDuty\nIncident Mgmt")

    # ═══════════════════════════════════════════════════
    # VENDORS — Security & GRC
    # ═══════════════════════════════════════════════════

    with Cluster("VENDORS  Security & GRC", graph_attr=CS_VENDORS):
        wiz_cspm         = Internet("Wiz\nCSPM")
        archer_grc       = Internet("RSA Archer\nGRC")

    # ═══════════════════════════════════════════════════
    # L7 — External BI
    # ═══════════════════════════════════════════════════

    with Cluster("L7  External BI", graph_attr=CS_VENDORS):
        power_bi        = PowerBI("Power BI\nSelf-Service BI")
        slicer_dicer    = Internet("Slicer & Dicer\nEmbedded Analytics")

    # ═══════════════════════════════════════════════════
    # L8 — CONSUMERS
    # ═══════════════════════════════════════════════════

    with Cluster("L8  CONSUMERS", graph_attr=CS_CONSUMERS):
        analysts        = Users("Analysts\nDashboards")
        data_scientists = Client("Data Scientists\nNotebooks")
        downstream_sys  = Client("Downstream Sys\nAPIs / Feeds")
        executives      = Users("Executives\nReports")

    # ═══════════════════════════════════════════════════════
    #  INVISIBLE SPINE — forces L→R layer sequencing
    # ═══════════════════════════════════════════════════════
    E_INVIS = {"style": "invis"}
    oracle_db    >> Edge(**E_INVIS) >> cloud_vpn
    cloud_vpn    >> Edge(**E_INVIS) >> datastream
    datastream   >> Edge(**E_INVIS) >> gcs_raw
    gcs_raw      >> Edge(**E_INVIS) >> dataform
    dataform     >> Edge(**E_INVIS) >> bronze
    bronze       >> Edge(**E_INVIS) >> silver
    silver       >> Edge(**E_INVIS) >> gold
    gold         >> Edge(**E_INVIS) >> looker
    looker       >> Edge(**E_INVIS) >> analysts

    # ═══════════════════════════════════════════════════════
    #  WIRING — Group-to-group connections (one edge per pair)
    # ═══════════════════════════════════════════════════════

    # ── Vendors Identity → L2 (one edge per vendor) ──
    entra_id >> Edge(**E_PURPLE, label="SSO")      >> cloud_iam
    cyberark >> Edge(**E_PURPLE, label="PAM sync")  >> secret_manager
    keeper   >> Edge(**E_PURPLE, label="secrets")   >> secret_manager

    # ── L1 → L2/L3 (one edge per source node) ──
    # On-Prem sources → L2 VPN
    oracle_db     >> Edge(**E_ORANGE, label="JDBC/CDC")     >> cloud_vpn
    sqlserver_db  >> Edge(**E_ORANGE, label="JDBC/CDC")     >> cloud_vpn
    postgresql_db >> Edge(**E_ORANGE, label="WAL CDC")      >> cloud_vpn
    mongodb_db    >> Edge(**E_ORANGE, label="Change Strm")  >> cloud_vpn
    # GCP-Native → L3 direct
    cloud_sql     >> Edge(**E_BLUE, label="CDC")            >> datastream
    cloud_spanner >> Edge(**E_BLUE, label="Change Strm")    >> dataflow_ing
    # SaaS → L3 direct
    salesforce     >> Edge(**E_ORANGE, label="API")         >> cloud_functions
    salesforce     >> Edge(**E_ORANGE, label="bulk")        >> fivetran
    workday        >> Edge(**E_ORANGE, label="API")         >> matillion
    servicenow_src >> Edge(**E_ORANGE, label="API")         >> cloud_functions
    sap_src        >> Edge(**E_ORANGE, label="OData")       >> data_fusion
    # Events → L3 direct
    kafka_stream >> Edge(**E_ORANGE, label="subscribe")     >> pubsub
    # Files → L3 direct
    aws_s3      >> Edge(**E_ORANGE, label="BQ DTS S3")      >> bq_dts
    aws_s3      >> Edge(**E_ORANGE, label="transfer")       >> storage_transfer
    sftp_server >> Edge(**E_ORANGE, label="pull files")     >> cloud_functions

    # ── L2 internal (one chain) ──
    cloud_vpn    >> Edge(**E_BLUE_DASH) >> vpc
    cloud_interco >> Edge(**E_BLUE_DASH) >> vpc
    vpc          >> Edge(**E_BLUE_DASH) >> vpc_sc
    cloud_iam    >> Edge(**E_BLUE_DASH, label="WIF") >> secret_manager

    # ── L2 → L3 (one auth edge) ──
    cloud_iam >> Edge(**E_BLUE, label="auth") >> datastream

    # ── L3 → L4 (one edge per ingestion tool → landing) ──
    datastream       >> Edge(**E_BLUE, label="CDC")       >> gcs_raw
    pubsub           >> Edge(**E_BLUE, label="events")    >> dataflow_ing
    dataflow_ing     >> Edge(**E_BLUE, label="stream")    >> bq_staging
    bq_dts           >> Edge(**E_BLUE, label="scheduled") >> bq_staging
    storage_transfer >> Edge(**E_BLUE, label="files")     >> gcs_raw
    cloud_functions  >> Edge(**E_BLUE, label="write")     >> gcs_raw
    data_fusion      >> Edge(**E_BLUE, label="pipeline")  >> gcs_raw
    matillion        >> Edge(**E_BLUE, label="ELT")       >> bq_staging
    fivetran         >> Edge(**E_BLUE, label="sync")      >> bq_staging

    # ── L4 → L5 (one edge per landing zone → processing) ──
    gcs_raw    >> Edge(**E_BLUE, label="read")    >> dataform
    gcs_raw    >> Edge(**E_BLUE, label="read")    >> dataproc
    bq_staging >> Edge(**E_BLUE, label="SQL ELT") >> dataform
    bq_staging >> Edge(**E_BLUE, label="stream")  >> dataflow_proc

    # ── L5 → L6 (one edge per processor → medallion) ──
    dataform      >> Edge(**E_TEAL, label="transform") >> bronze
    dataflow_proc >> Edge(**E_TEAL, label="stream")    >> bronze
    dataproc      >> Edge(**E_TEAL, label="spark")     >> bronze

    # ── L6 internal (medallion chain) ──
    bronze >> Edge(**E_BLUE, label="quality gate") >> silver
    silver >> Edge(**E_BLUE, label="quality gate") >> gold

    # ── L6 → L7 (one edge per serving target) ──
    gold >> Edge(**E_GREEN, label="governed BI")   >> looker
    gold >> Edge(**E_GREEN, label="free dash")     >> looker_studio
    gold >> Edge(**E_GREEN, label="data exchange") >> analytics_hub
    gold >> Edge(**E_GREEN, label="serving API")   >> cloud_run
    gold >> Edge(**E_GREEN, label="ML features")   >> vertex_ai
    # L6 → External BI
    gold >> Edge(**E_ORANGE, label="DirectQuery") >> power_bi
    gold >> Edge(**E_ORANGE, label="embed")       >> slicer_dicer

    # ── L7 → L8 (one edge per serving → consumer) ──
    looker       >> Edge(**E_BLUE)   >> analysts
    looker       >> Edge(**E_BLUE)   >> executives
    vertex_ai    >> Edge(**E_BLUE)   >> data_scientists
    cloud_run    >> Edge(**E_BLUE)   >> downstream_sys
    power_bi     >> Edge(**E_ORANGE) >> analysts

    # ══════════════════════════════════════════════════════
    # CROSS-CUTTING WIRING (one dashed edge per connection)
    # ══════════════════════════════════════════════════════

    # ── Quality Gate (dashed fuchsia) ──
    dataform    >> Edge(**E_QUALITY_DASH, label="DQ check") >> dataplex_dq
    dataplex_dq >> Edge(**E_QUALITY_DASH, label="gate")     >> bronze
    dataform    >> Edge(**E_QUALITY_DASH, label="PII scan") >> cloud_dlp
    cloud_dlp   >> Edge(**E_QUALITY_DASH, label="mask")     >> silver

    # ── Orchestration (dashed sky blue) ──
    cloud_composer  >> Edge(**E_ORC_DASH, label="trigger") >> dataform
    cloud_composer  >> Edge(**E_ORC_DASH, label="trigger") >> dataflow_ing
    cloud_scheduler >> Edge(**E_ORC_DASH, label="cron")    >> bq_dts

    # ── Observability (dashed red) — pipeline → obs ──
    dataflow_ing   >> Edge(**E_OBS_DASH, label="metrics")  >> cloud_monitoring
    dataform       >> Edge(**E_OBS_DASH, label="logs")     >> cloud_logging
    cloud_composer >> Edge(**E_OBS_DASH, label="DAG logs")  >> cloud_logging
    # Obs internal
    cloud_monitoring >> Edge(**E_OBS_DASH, label="alerts") >> pagerduty_inc
    cloud_logging    >> Edge(**E_OBS_DASH, label="SIEM")   >> splunk_siem
    cloud_monitoring >> Edge(**E_OBS_DASH, label="APM")    >> dynatrace_apm
    audit_logs       >> Edge(**E_OBS_DASH, label="export") >> cloud_logging

    # ── Security (dashed amber) ──
    cloud_kms  >> Edge(**E_SEC_DASH, label="CMEK")   >> gold
    audit_logs >> Edge(**E_SEC_DASH, label="export")  >> splunk_siem
    scc_pillar >> Edge(**E_SEC_DASH, label="posture") >> wiz_cspm

    # ── Governance (dashed green) ──
    dataplex     >> Edge(**E_GOV_DASH, label="lineage")  >> data_catalog
    dataplex     >> Edge(**E_GOV_DASH, label="quality")  >> dataplex_dq
    data_catalog >> Edge(**E_GOV_DASH, label="classify") >> cloud_dlp

    # ── GRC vendor (dashed purple) ──
    archer_grc >> Edge(**E_PURPLE, label="compliance") >> audit_logs

print("✅ Master Blueprint rendered successfully")
