"""
═══════════════════════════════════════════════════════════════
  ARCHGEN SLICER — AST-based Blueprint Slicer
  
  Takes: master_blueprint.py + keep_set (product IDs) + title
  Outputs: sliced .py file that renders a focused diagram
  
  How it works:
  1. Parse master blueprint into Python AST
  2. Walk AST — remove node assignments not in keep_set
  3. Remove edges referencing removed nodes
  4. Remove empty clusters
  5. Clean up unused imports
  6. Unparse back to valid Python
  7. Execute → PNG with real cloud icons
═══════════════════════════════════════════════════════════════
"""

import ast
import re
import os
import subprocess
import sys
from pathlib import Path
from typing import Set, Optional


class DiagramSlicer(ast.NodeTransformer):
    """
    AST transformer that removes unwanted products and their edges
    from a mingrammer diagram script.
    """

    def __init__(self, keep_set: Set[str]):
        self.keep_set = keep_set
        self.removed_vars = set()
        # Always keep these (infrastructure, not products)
        self.always_keep = {
            # Edge style dicts
            "E_BLUE", "E_BLUE_DASH", "E_ORANGE", "E_PURPLE",
            "E_GREEN", "E_GREEN_DASH", "E_RED_DASH", "E_TEAL",
            # Cluster style dicts
            "CS_SOURCES", "CS_VENDORS", "CS_GCP", "CS_GCP_SUB",
            "CS_CONSUMERS", "CS_OPS", "CS_SEC", "CS_GOV",
        }

    def visit_Assign(self, node):
        """Remove product node assignments not in keep_set."""
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            var_name = node.targets[0].id

            # Always keep style dicts
            if var_name in self.always_keep:
                return node

            # If it's a Call (node instantiation like BigQuery("..."))
            if isinstance(node.value, ast.Call):
                if var_name not in self.keep_set:
                    self.removed_vars.add(var_name)
                    return None  # DELETE

            # If it's a Dict (style definitions) — keep
            if isinstance(node.value, ast.Dict):
                return node

        return node

    def _references_removed(self, node) -> bool:
        """Check if any sub-expression references a removed variable."""
        for child in ast.walk(node):
            if isinstance(child, ast.Name) and child.id in self.removed_vars:
                return True
        return False

    def visit_Expr(self, node):
        """Remove edge expressions that reference removed nodes."""
        if self._references_removed(node):
            return None
        return node

    def visit_With(self, node):
        """Process Cluster/Diagram blocks — remove empty clusters."""
        # Recurse into body first
        new_body = []
        for child in node.body:
            result = self.visit(child)
            if result is not None:
                if isinstance(result, list):
                    new_body.extend(result)
                else:
                    new_body.append(result)
        node.body = new_body

        # Is this a Cluster?
        is_cluster = False
        for item in node.items:
            if isinstance(item.context_expr, ast.Call):
                func = item.context_expr.func
                if isinstance(func, ast.Name) and func.id == "Cluster":
                    is_cluster = True

        # Remove empty clusters
        if is_cluster and len(node.body) == 0:
            return None

        # Keep Diagram context even if empty (add pass)
        if len(node.body) == 0:
            node.body = [ast.Pass()]

        return node


def slice_blueprint(
    master_source: str,
    keep_products: Set[str],
    diagram_title: str,
    output_filename: str,
) -> str:
    """
    Parse a mingrammer master blueprint, keep only the specified
    product IDs, and return a valid sliced Python source string.
    """
    # Replace placeholder filename
    source = master_source.replace("FILENAME_PLACEHOLDER", output_filename)

    # Replace diagram title
    source = source.replace(
        "GCP Data Platform — Master Blueprint",
        diagram_title
    )

    # Parse to AST
    tree = ast.parse(source)

    # Slice
    slicer = DiagramSlicer(keep_products)
    new_tree = slicer.visit(tree)
    ast.fix_missing_locations(new_tree)

    # Unparse
    sliced = ast.unparse(new_tree)

    return sliced, slicer.removed_vars


def render_sliced(sliced_source: str, output_path: str) -> str:
    """Execute the sliced Python to generate the PNG."""
    # Write to temp file
    tmp = Path(output_path).with_suffix(".py")
    tmp.write_text(sliced_source)

    # Execute
    result = subprocess.run(
        [sys.executable, str(tmp)],
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Render failed:\n{result.stderr}")

    png_path = f"{output_path}.png"
    if not os.path.exists(png_path):
        raise FileNotFoundError(f"Expected PNG not found: {png_path}")

    return png_path


# ═══════════════════════════════════════════════════════════
# KNOWLEDGE-BASE DECISION ENGINE
# Maps user prompt keywords → product IDs to keep
# ═══════════════════════════════════════════════════════════

def decide_products(prompt: str) -> dict:
    """
    Simple keyword-based decision engine.
    In production, this calls the full knowledge base rules.
    Returns: {keep_set, decisions, anti_patterns, title}
    """
    prompt_lower = prompt.lower()
    keep = set()
    decisions = []
    anti_patterns = []

    # ── L1: Detect sources ──
    if any(w in prompt_lower for w in ["s3", "aws", "csv", "parquet", "files"]):
        keep |= {"aws_s3"}
        decisions.append("L1: AWS S3 detected → cross-cloud pattern")

    if any(w in prompt_lower for w in ["oracle"]):
        keep |= {"oracle_db"}
        decisions.append("L1: Oracle DB detected → on-prem CDC pattern")

    if any(w in prompt_lower for w in ["sql server", "mssql", "sqlserver"]):
        keep |= {"sqlserver_db"}
        decisions.append("L1: SQL Server detected → on-prem CDC pattern")

    if any(w in prompt_lower for w in ["postgres"]):
        keep |= {"postgresql_db"}
        decisions.append("L1: PostgreSQL detected → WAL CDC pattern")

    if any(w in prompt_lower for w in ["mongodb", "mongo"]):
        keep |= {"mongodb_db"}
        decisions.append("L1: MongoDB detected → Change Stream pattern")

    if any(w in prompt_lower for w in ["salesforce", "crm"]):
        keep |= {"salesforce"}
        decisions.append("L1: Salesforce detected → SaaS API pattern")

    if any(w in prompt_lower for w in ["workday", "hcm", "hr data"]):
        keep |= {"workday"}
        decisions.append("L1: Workday detected → SaaS API pattern")

    if any(w in prompt_lower for w in ["servicenow", "itsm"]):
        keep |= {"servicenow_src"}
        decisions.append("L1: ServiceNow detected → SaaS API pattern")

    if any(w in prompt_lower for w in ["sap", "erp"]):
        keep |= {"sap_src"}
        decisions.append("L1: SAP detected → OData/BAPI pattern")

    if any(w in prompt_lower for w in ["kafka", "event stream", "streaming"]):
        keep |= {"kafka_stream"}
        decisions.append("L1: Kafka detected → streaming pattern")

    if any(w in prompt_lower for w in ["cloud sql"]):
        keep |= {"cloud_sql"}
        decisions.append("L1: Cloud SQL detected → GCP-native CDC")

    if any(w in prompt_lower for w in ["sftp", "ftp"]):
        keep |= {"sftp_server"}
        decisions.append("L1: SFTP detected → legacy file transfer pattern")

    # ── L2: Connectivity & Identity (NON-NEGOTIABLE — always present) ──
    has_onprem = keep & {"oracle_db", "sqlserver_db", "postgresql_db", "mongodb_db"}
    has_cross_cloud = keep & {"aws_s3"}
    has_saas = keep & {"salesforce", "workday", "servicenow_src", "sap_src"}
    has_streaming = keep & {"kafka_stream"}

    # Always include — every enterprise needs identity + network perimeter
    keep |= {"cloud_iam", "secret_manager", "vpc", "vpc_sc"}
    decisions.append("L2: IAM + Secret Manager + VPC + VPC-SC (always — non-negotiable)")

    if has_onprem:
        keep |= {"cloud_vpn"}
        decisions.append("L2: On-prem sources → Cloud VPN (IPSec tunnel)")

    if has_cross_cloud:
        keep |= {"vpc_sc"}
        decisions.append("L2: Cross-cloud → WIF (via IAM) + VPC-SC")
        # Vendor identity for cross-cloud
        keep |= {"entra_id", "cyberark"}
        decisions.append("L2: Enterprise → Entra ID (SSO) + CyberArk (PAM)")

    if has_saas:
        keep |= {"cloud_armor", "apigee"}
        decisions.append("L2: SaaS sources → Cloud Armor + Apigee for API management")

    # ── L3: Ingestion (based on source type + user preference) ──
    if "bq dts" in prompt_lower or "data transfer" in prompt_lower:
        keep |= {"bq_dts"}
        decisions.append("L3: BQ DTS selected (FREE for S3, GCS, SaaS)")
        if "dataflow" not in prompt_lower:
            anti_patterns.append("Skipped Dataflow — BQ DTS handles S3 natively for free")

    elif has_onprem:
        keep |= {"datastream"}
        decisions.append("L3: On-prem relational → Datastream (serverless CDC)")
        if "oracle" in prompt_lower and "goldengate" not in prompt_lower:
            anti_patterns.append("Using Datastream not GoldenGate — cheaper, serverless")

    if has_streaming:
        keep |= {"pubsub", "dataflow_ing"}
        decisions.append("L3: Streaming → Pub/Sub + Dataflow")

    if has_saas:
        if any(w in prompt_lower for w in ["fivetran"]):
            keep |= {"fivetran"}
            decisions.append("L3: Fivetran selected for SaaS ingestion")
        elif any(w in prompt_lower for w in ["matillion"]):
            keep |= {"matillion"}
            decisions.append("L3: Matillion selected for SaaS ingestion")
        else:
            keep |= {"cloud_functions"}
            decisions.append("L3: Cloud Functions for SaaS API polling (no vendor cost)")
            anti_patterns.append("Skipped Matillion/Fivetran — Cloud Functions handles API polling for free")

    if "sap" in prompt_lower:
        keep |= {"data_fusion"}
        decisions.append("L3: SAP → Data Fusion (visual ETL with SAP connector)")

    if "sftp" in prompt_lower:
        keep |= {"cloud_functions"}
        decisions.append("L3: SFTP → Cloud Functions to pull files")

    if "storage transfer" in prompt_lower:
        keep |= {"storage_transfer"}
        decisions.append("L3: Storage Transfer Service for bulk file moves")

    # ── L4: Landing ──
    if any(k in keep for k in ["datastream", "storage_transfer", "cloud_functions", "data_fusion"]):
        keep |= {"gcs_raw"}
        decisions.append("L4: GCS Raw landing zone for file-based ingestion")

    if any(k in keep for k in ["bq_dts", "dataflow_ing", "matillion", "fivetran"]):
        keep |= {"bq_staging"}
        decisions.append("L4: BigQuery staging datasets for direct loads")

    # ── L5: Processing ──
    if "dataform" in prompt_lower or "sql" in prompt_lower or "elt" in prompt_lower:
        keep |= {"dataform"}
        decisions.append("L5: Dataform for SQL ELT (FREE with BigQuery)")
    elif has_streaming:
        keep |= {"dataflow_proc"}
        decisions.append("L5: Dataflow for stream processing")
    elif "spark" in prompt_lower or "dataproc" in prompt_lower:
        keep |= {"dataproc"}
        decisions.append("L5: Dataproc for Spark/Hadoop processing")
    else:
        keep |= {"dataform"}
        decisions.append("L5: Default → Dataform SQL ELT (FREE, SQL-first)")

    # Quality gates always
    keep |= {"dataplex_dq", "cloud_dlp"}
    decisions.append("L5: Quality gates → Dataplex DQ + Cloud DLP (always on)")

    # ── L6: Medallion (always) ──
    keep |= {"bronze", "silver", "gold"}
    decisions.append("L6: Medallion → Bronze / Silver / Gold (always)")

    # ── L7: Serving ──
    keep |= {"looker"}  # always include governed BI
    decisions.append("L7: Looker for governed BI (always)")

    if "power bi" in prompt_lower or "powerbi" in prompt_lower:
        keep |= {"power_bi"}
        decisions.append("L7: Power BI for self-service BI")

    if "looker studio" in prompt_lower:
        keep |= {"looker_studio"}
        decisions.append("L7: Looker Studio for free dashboards")

    if any(w in prompt_lower for w in ["api", "serving", "microservice"]):
        keep |= {"cloud_run"}
        decisions.append("L7: Cloud Run for API serving layer")

    if any(w in prompt_lower for w in ["ml", "machine learning", "vertex", "ai"]):
        keep |= {"vertex_ai"}
        decisions.append("L7: Vertex AI for ML platform")

    if any(w in prompt_lower for w in ["analytics hub", "data exchange", "data sharing"]):
        keep |= {"analytics_hub"}
        decisions.append("L7: Analytics Hub for data exchange")

    # ── L8: Consumers (always) ──
    keep |= {"analysts"}
    decisions.append("L8: Analysts consumer (always)")

    if any(w in prompt_lower for w in ["data scien", "notebook", "ml"]):
        keep |= {"data_scientists"}
        decisions.append("L8: Data Scientists consumer")

    if any(w in prompt_lower for w in ["api", "downstream", "feed"]):
        keep |= {"downstream_sys"}
        decisions.append("L8: Downstream systems consumer")

    if any(w in prompt_lower for w in ["executive", "report", "c-suite"]):
        keep |= {"executives"}
        decisions.append("L8: Executives consumer")

    # ── Orchestration ──
    if any(w in prompt_lower for w in ["composer", "airflow", "dag", "orchestrat"]):
        keep |= {"cloud_composer"}
        decisions.append("Orchestration: Cloud Composer (Airflow)")
    elif any(w in prompt_lower for w in ["scheduler", "cron"]):
        keep |= {"cloud_scheduler"}
        decisions.append("Orchestration: Cloud Scheduler (simple cron)")
    else:
        keep |= {"cloud_composer"}
        decisions.append("Orchestration: Default → Cloud Composer for DAG management")

    # ── Observability (NON-NEGOTIABLE — always present) ──
    keep |= {"cloud_monitoring", "cloud_logging", "audit_logs", "pagerduty_inc"}
    decisions.append("Observability: Monitoring + Logging + Audit Logs + PagerDuty (always — non-negotiable)")

    # Wiz CSPM always for cloud security posture
    keep |= {"wiz_cspm"}
    decisions.append("Observability: Wiz CSPM for cloud security posture (always)")

    if any(w in prompt_lower for w in ["splunk", "siem"]):
        keep |= {"splunk_siem"}
        decisions.append("Observability: Splunk SIEM for security event correlation")

    if any(w in prompt_lower for w in ["dynatrace", "apm"]):
        keep |= {"dynatrace_apm"}
        decisions.append("Observability: Dynatrace APM")

    # ── Security pillar (NON-NEGOTIABLE) ──
    keep |= {"cloud_kms"}
    decisions.append("Security: Cloud KMS for CMEK encryption (always — non-negotiable)")

    if any(w in prompt_lower for w in ["scc", "security command", "posture"]):
        keep |= {"scc_pillar"}
        decisions.append("Security: Security Command Center")

    # (Audit Logs already included in Observability always-on block)

    # ── Governance (NON-NEGOTIABLE — always present) ──
    keep |= {"dataplex", "data_catalog"}
    decisions.append("Governance: Dataplex + Data Catalog (always — non-negotiable)")
    if any(w in prompt_lower for w in ["lineage"]):
        decisions.append("Governance: Data Catalog lineage tracking enabled")

    # ── GRC vendors ──
    if any(w in prompt_lower for w in ["wiz", "cspm"]):
        keep |= {"wiz_cspm"}
        decisions.append("Vendor: Wiz CSPM")

    if any(w in prompt_lower for w in ["archer", "grc", "compliance"]):
        keep |= {"archer_grc"}
        decisions.append("Vendor: RSA Archer GRC")

    # Build title
    sources = []
    if "aws_s3" in keep: sources.append("S3")
    if "oracle_db" in keep: sources.append("Oracle")
    if "sqlserver_db" in keep: sources.append("SQL Server")
    if "postgresql_db" in keep: sources.append("PostgreSQL")
    if "kafka_stream" in keep: sources.append("Kafka")
    if "salesforce" in keep: sources.append("Salesforce")
    if "cloud_sql" in keep: sources.append("Cloud SQL")

    title = diagram_title = f"{' + '.join(sources) if sources else 'GCP'} → BigQuery Data Platform"

    return {
        "keep_set": keep,
        "decisions": decisions,
        "anti_patterns": anti_patterns,
        "title": title,
    }


# ═══════════════════════════════════════════════════════════
# MAIN — End-to-end: prompt → decisions → slice → PNG
# ═══════════════════════════════════════════════════════════

def generate_architecture(
    prompt: str,
    master_path: str = "gcp_master_blueprint.py",
    output_dir: str = ".",
) -> dict:
    """
    End-to-end pipeline:
    1. Parse user prompt → decide products
    2. Load master blueprint
    3. AST-slice
    4. Render PNG
    """
    # Step 1: Decision engine
    result = decide_products(prompt)

    # Step 2: Load master
    master_source = Path(master_path).read_text()

    # Step 3: Slice
    output_name = os.path.join(output_dir, "sliced_architecture")
    sliced_source, removed = slice_blueprint(
        master_source,
        result["keep_set"],
        result["title"],
        output_name,
    )

    # Step 4: Render
    png_path = render_sliced(sliced_source, output_name)

    return {
        **result,
        "removed": removed,
        "png_path": png_path,
        "python_source": sliced_source,
        "product_count": len(result["keep_set"]),
        "removed_count": len(removed),
    }


# ═══════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    import json

    prompts = [
        "S3 CSV and Parquet files to BigQuery using BQ DTS, with Power BI dashboards",
        "Oracle and SQL Server CDC to BigQuery with Dataform, Splunk SIEM, Vertex AI for ML",
        "Kafka streaming events to BigQuery real-time with Dataflow",
        "Salesforce CRM data to BigQuery using Fivetran, with Looker Studio dashboards",
    ]

    master = Path("/home/claude/gcp_master_blueprint.py").read_text()

    for i, prompt in enumerate(prompts):
        print(f"\n{'='*70}")
        print(f"PROMPT {i+1}: {prompt}")
        print(f"{'='*70}")

        result = decide_products(prompt)
        print(f"\n  Products selected: {len(result['keep_set'])}")
        print(f"  Title: {result['title']}")

        print(f"\n  DECISIONS:")
        for d in result["decisions"]:
            print(f"    ✅ {d}")

        if result["anti_patterns"]:
            print(f"\n  ANTI-PATTERNS PREVENTED:")
            for a in result["anti_patterns"]:
                print(f"    🚫 {a}")

        # Slice
        output_name = f"/home/claude/sliced_{i+1}"
        sliced_source, removed = slice_blueprint(
            master, result["keep_set"], result["title"], output_name
        )
        print(f"\n  Removed {len(removed)} products: {sorted(removed)}")
        print(f"  Sliced source: {len(sliced_source)} chars")

        # Render
        try:
            png_path = render_sliced(sliced_source, output_name)
            print(f"  ✅ PNG: {png_path} ({os.path.getsize(png_path) // 1024}KB)")
        except Exception as e:
            print(f"  ❌ Render error: {e}")
