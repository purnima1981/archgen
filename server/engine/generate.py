#!/usr/bin/env python3
"""
ArchGen Engine — CLI entry point
Called by Express server via child_process.spawn

Usage: python generate.py "<prompt>" <output_dir>
Output: JSON to stdout with decisions, diagram JSON, and optional PNG path

Pipeline:
  1. SmartRouter.route()  → sources + industry + decisions (if KB available)
     OR parse_prompt()    → source IDs (keyword fallback)
  2. auto_wire()          → keep_set + wiring decisions
  3. build_diagram()      → canvas JSON for frontend
  4. (optional) PNG via legacy archgen_slicer
"""

import sys
import os
import json
import hashlib
from pathlib import Path

ENGINE_DIR = Path(__file__).parent
sys.path.insert(0, str(ENGINE_DIR))

from gcp_blueprint import parse_prompt, auto_wire, build_title, match_industry, NODES, INDUSTRY_TAGS


def route_prompt(prompt: str) -> dict:
    """
    Try SmartRouter first, fall back to keyword matching.
    Always returns: {sources, keep_set, decisions, title, tier, industry}
    """

    # ── Try SmartRouter (KB + Haiku) ──
    try:
        from kb_query import SmartRouter
        router = SmartRouter()
        result = router.route(prompt)
        router.close()
        return {
            "sources":   result["sources"],
            "keep_set":  result["keep_set"],
            "decisions": result["decisions"],
            "title":     result["title"],
            "tier":      result.get("tier", 2),
            "industry":  result.get("industry"),
        }
    except ImportError:
        # psycopg2 not installed — expected on fresh setup
        pass
    except Exception as e:
        # DB not running, tables don't exist, API key missing, etc.
        print(f"SmartRouter unavailable ({e}), using keyword fallback", file=sys.stderr)

    # ── Keyword fallback (always works, no dependencies) ──
    sources = parse_prompt(prompt)
    if not sources:
        sources = {"src_oracle"}

    keep, decisions = auto_wire(sources)
    keep |= sources

    # Check industry keywords even without KB
    ind_id = match_industry(prompt)
    industry = None
    if ind_id:
        ind = INDUSTRY_TAGS[ind_id]
        industry = {"id": ind_id}
        decisions.append(f"Industry: {ind_id} ({', '.join(ind.get('compliance', []))})")
        for pid in ind.get("required_products", []):
            if pid in NODES:
                keep.add(pid)

    title = build_title(sources)
    if ind_id:
        title += f" ({ind_id.title()})"

    return {
        "sources":   sources,
        "keep_set":  keep,
        "decisions": decisions,
        "title":     title,
        "tier":      3,
        "industry":  industry,
    }


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: generate.py <prompt> <output_dir>"}))
        sys.exit(1)

    prompt = sys.argv[1]
    output_dir = sys.argv[2]
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Route the prompt (SmartRouter or keyword fallback)
        routed = route_prompt(prompt)
        sources   = routed["sources"]
        keep      = routed["keep_set"]
        decisions = routed["decisions"]
        title     = routed["title"]

        # Anti-patterns (simple rule-based)
        anti_patterns = []
        if any(s in sources for s in ("src_kafka", "src_confluent", "src_kinesis")):
            if not any(s in sources for s in ("src_oracle", "src_sqlserver", "src_postgresql", "src_mysql")):
                anti_patterns.append("Streaming-only — consider batch sources for backfill")
        if any(s in sources for s in ("src_salesforce", "src_workday", "src_hubspot")):
            if "proc_dlp" not in keep:
                anti_patterns.append("SaaS source without DLP — PII risk")

        # Build canvas JSON
        from diagram_builder import build_diagram
        diagram = build_diagram(keep, title, decisions, anti_patterns)

        # Optional PNG via legacy path
        png_path = ""
        png_filename = ""
        python_source = ""
        removed = set()

        try:
            from archgen_slicer import decide_products, slice_blueprint, render_sliced
            old_result = decide_products(prompt)
            master_path = ENGINE_DIR / "gcp_master_blueprint.py"
            if master_path.exists():
                master_source = master_path.read_text()
                prompt_hash = hashlib.md5(prompt.encode()).hexdigest()[:8]
                output_name = os.path.join(output_dir, f"arch_{prompt_hash}")
                sliced_source, removed = slice_blueprint(
                    master_source, old_result["keep_set"],
                    old_result["title"], output_name,
                )
                png_path = render_sliced(sliced_source, output_name)
                png_filename = os.path.basename(png_path)
                python_source = sliced_source
        except Exception:
            pass  # PNG is optional

        # JSON output
        output = {
            "success":       True,
            "title":         title,
            "decisions":     decisions,
            "anti_patterns": anti_patterns,
            "kept":          sorted(list(keep)),
            "removed":       sorted(list(removed)),
            "kept_count":    len(keep),
            "removed_count": len(removed),
            "png_path":      png_path,
            "png_filename":  png_filename,
            "python_source": python_source,
            "diagram":       diagram,
            "tier":          routed.get("tier", 3),
        }
        print(json.dumps(output))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error":   str(e),
            "title":   "Error",
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
