#!/usr/bin/env python3
"""
ArchGen Mingrammer Engine — CLI entry point
Called by Express server via child_process.spawn

Usage: python3 generate.py "<prompt>" <output_dir>
Output: JSON to stdout with decisions, anti-patterns, PNG path, AND diagram JSON
"""

import sys
import os
import json
from pathlib import Path

# Engine lives in this directory
ENGINE_DIR = Path(__file__).parent
sys.path.insert(0, str(ENGINE_DIR))

from archgen_slicer import decide_products, slice_blueprint, render_sliced
from diagram_builder import build_diagram


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: generate.py <prompt> <output_dir>"}))
        sys.exit(1)

    prompt = sys.argv[1]
    output_dir = sys.argv[2]

    os.makedirs(output_dir, exist_ok=True)

    try:
        # Step 1: Knowledge base decision engine
        result = decide_products(prompt)

        # Step 2: Load master blueprint
        master_path = ENGINE_DIR / "gcp_master_blueprint.py"
        master_source = master_path.read_text()

        # Step 3: Generate unique filename
        import hashlib
        prompt_hash = hashlib.md5(prompt.encode()).hexdigest()[:8]
        output_name = os.path.join(output_dir, f"arch_{prompt_hash}")

        # Step 4: AST-slice the master blueprint
        sliced_source, removed = slice_blueprint(
            master_source,
            result["keep_set"],
            result["title"],
            output_name,
        )

        # Step 5: Render mingrammer PNG
        png_path = render_sliced(sliced_source, output_name)

        # Step 6: Build interactive diagram JSON for editable canvas
        diagram = build_diagram(
            result["keep_set"],
            result["title"],
            result["decisions"],
            result["anti_patterns"],
        )

        # Step 7: Output JSON
        output = {
            "success": True,
            "title": result["title"],
            "decisions": result["decisions"],
            "anti_patterns": result["anti_patterns"],
            "kept": sorted(list(result["keep_set"])),
            "removed": sorted(list(removed)),
            "kept_count": len(result["keep_set"]),
            "removed_count": len(removed),
            "png_path": png_path,
            "png_filename": os.path.basename(png_path),
            "python_source": sliced_source,
            "diagram": diagram,
        }

        print(json.dumps(output))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "title": result.get("title", "Error") if 'result' in dir() else "Error",
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
