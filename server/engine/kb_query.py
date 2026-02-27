#!/usr/bin/env python3
"""
ArchGen Semantic Search — Query Engine

Replaces keyword-based parse_prompt() with pgvector similarity search.
Falls back to keyword matching when embeddings aren't available.

Usage:
    from kb_query import SmartRouter
    router = SmartRouter()
    result = router.route("HIPAA compliant Oracle to BigQuery pipeline")
"""

import os, sys, json
from typing import Dict, List, Set, Optional, Any
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import psycopg2
from gcp_blueprint import (
    NODES, PRODUCT_TAGS, ARCHITECTURE_PATTERNS, INDUSTRY_TAGS,
    parse_prompt, auto_wire, build_title, match_industry, get_search_text,
    ALWAYS_ON
)

DB_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres123@localhost:5432/archgen")


class SmartRouter:
    """
    The query engine. Routes user prompts to blueprint subsets.
    
    Tier 1: Check diagram cache (prompt-hash match)
    Tier 2: Claude Haiku classification (patterns + sources + industry)
    Tier 3: Keyword fallback (parse_prompt)
    
    Supports both Anthropic (Haiku classifier) and Voyage AI (embeddings).
    Anthropic mode is smarter for small catalogs. Voyage mode scales better.
    """

    def __init__(self, db_url: str = None, anthropic_key: str = None, voyage_key: str = None):
        self.db_url = db_url or DB_URL
        self.anthropic_key = anthropic_key or os.environ.get("ANTHROPIC_API_KEY")
        self.voyage_key = voyage_key or os.environ.get("VOYAGE_API_KEY")
        self._conn = None
        self._cache = {}  # in-memory prompt cache for speed

    @property
    def conn(self):
        if self._conn is None or self._conn.closed:
            try:
                self._conn = psycopg2.connect(self.db_url)
            except Exception:
                self._conn = None
        return self._conn

    def close(self):
        if self._conn and not self._conn.closed:
            self._conn.close()

    # ─── Claude Haiku Classifier ─────────────────────
    def _classify_with_haiku(self, prompt: str) -> Optional[Dict]:
        """
        Use Claude Haiku to classify a prompt into:
          - best matching pattern
          - source products to include
          - industry (if any)
        
        Cost: ~$0.002 per call. Smarter than cosine similarity.
        """
        if not self.anthropic_key:
            return None

        # Build the classification prompt with our catalog
        pattern_list = "\n".join(
            f"  {p['id']}: {p['name']} — {p['description'][:120]}"
            for p in ARCHITECTURE_PATTERNS
        )
        
        source_list = "\n".join(
            f"  {pid}: {NODES[pid]['name']} — {PRODUCT_TAGS[pid].get('description','')[:80]}"
            for pid in sorted(NODES.keys()) if pid.startswith("src_")
        )
        
        industry_list = "\n".join(
            f"  {iid}: {ind['description'][:100]}"
            for iid, ind in INDUSTRY_TAGS.items()
        )

        classification_prompt = f"""You are a GCP architecture classifier. Given a user's architecture request, identify:

1. PATTERN: Which architecture pattern best matches (pick 0-2)
2. SOURCES: Which data source products to include (pick 1-10) 
3. INDUSTRY: Which industry vertical, if any (pick 0-1)

AVAILABLE PATTERNS:
{pattern_list}

AVAILABLE SOURCES:
{source_list}

AVAILABLE INDUSTRIES:
{industry_list}

USER REQUEST: "{prompt}"

Respond ONLY with valid JSON, no other text:
{{
  "patterns": ["pattern_id"],
  "sources": ["src_id1", "src_id2"],
  "industry": "industry_id_or_null",
  "reasoning": "one sentence why"
}}"""

        try:
            import urllib.request
            data = json.dumps({
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 300,
                "messages": [{"role": "user", "content": classification_prompt}]
            }).encode()
            
            req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=data,
                headers={
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
            )
            resp = urllib.request.urlopen(req, timeout=15)
            result = json.loads(resp.read())
            
            # Extract text from response
            text = ""
            for block in result.get("content", []):
                if block.get("type") == "text":
                    text += block["text"]
            
            # Parse JSON from response
            # Handle potential markdown wrapping
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]
            
            classified = json.loads(text)
            
            # Validate IDs exist
            valid_patterns = [p for p in classified.get("patterns", []) 
                            if any(ap["id"] == p for ap in ARCHITECTURE_PATTERNS)]
            valid_sources = [s for s in classified.get("sources", []) if s in NODES]
            valid_industry = classified.get("industry")
            if valid_industry and valid_industry not in INDUSTRY_TAGS:
                valid_industry = None
            
            return {
                "patterns": valid_patterns,
                "sources": valid_sources,
                "industry": valid_industry,
                "reasoning": classified.get("reasoning", ""),
            }
            
        except Exception as e:
            print(f"⚠️ Haiku classification failed: {e}", file=sys.stderr)
            return None

    # ─── Voyage AI Embedding (optional upgrade) ──────
    def _embed_query(self, text: str) -> Optional[List[float]]:
        if not self.voyage_key:
            return None
        try:
            import urllib.request
            data = json.dumps({
                "model": "voyage-3.5-lite",
                "input": [text[:2000]],
                "input_type": "query",
            }).encode()
            req = urllib.request.Request(
                "https://api.voyageai.com/v1/embeddings",
                data=data,
                headers={
                    "Authorization": f"Bearer {self.voyage_key}",
                    "Content-Type": "application/json",
                },
            )
            resp = urllib.request.urlopen(req, timeout=10)
            result = json.loads(resp.read())
            return result["data"][0]["embedding"]
        except Exception as e:
            print(f"⚠️ Embedding failed: {e}", file=sys.stderr)
            return None

    # ─── Tier 1: Prompt Cache ────────────────────────
    def check_cache(self, prompt: str) -> Optional[Dict]:
        """Check in-memory cache + DB cache for similar prompts."""
        # In-memory exact match
        p_lower = prompt.lower().strip()
        if p_lower in self._cache:
            return {**self._cache[p_lower], "tier": 1, "cache_hit": True}
        
        # DB cache — exact prompt match
        if self.conn:
            try:
                cur = self.conn.cursor()
                cur.execute("""
                    SELECT sources, keep_set, diagram_json, industry, title
                    FROM kb_diagram_cache
                    WHERE LOWER(TRIM(prompt)) = %s
                    LIMIT 1
                """, (p_lower,))
                row = cur.fetchone()
                if row:
                    cur.execute("""
                        UPDATE kb_diagram_cache SET hit_count = hit_count + 1
                        WHERE LOWER(TRIM(prompt)) = %s
                    """, (p_lower,))
                    self.conn.commit()
                    return {
                        "sources": set(row[0] or []),
                        "keep_set": set(row[1] or []),
                        "diagram_json": row[2],
                        "industry": {"id": row[3]} if row[3] else None,
                        "title": row[4],
                        "tier": 1,
                        "cache_hit": True,
                    }
            except Exception:
                pass
        
        return None

    def cache_result(self, prompt: str, result: Dict):
        """Store result in memory + DB cache."""
        p_lower = prompt.lower().strip()
        self._cache[p_lower] = result
        
        if self.conn:
            try:
                cur = self.conn.cursor()
                cur.execute("""
                    INSERT INTO kb_diagram_cache (prompt, sources, keep_set, industry, title)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (
                    prompt, list(result.get("sources", [])), list(result.get("keep_set", [])),
                    result.get("industry", {}).get("id") if result.get("industry") else None,
                    result.get("title", ""),
                ))
                self.conn.commit()
            except Exception:
                try:
                    self.conn.rollback()
                except:
                    pass

    # ─── MAIN ROUTER ─────────────────────────────────
    def route(self, prompt: str) -> Dict[str, Any]:
        """
        Route a user prompt to a blueprint subset.
        
        Tier 1: Cache (free, instant)
        Tier 2: Haiku classifier (~$0.002, ~1s) OR Voyage embeddings
        Tier 3: Keyword matching (free, instant)
        """
        decisions = []

        # ── Tier 1: Cache ──
        cached = self.check_cache(prompt)
        if cached:
            decisions.append("✅ Cache hit — returning previous result")
            cached["decisions"] = decisions
            return cached

        sources = set()
        extra_products = set()
        tier = 3  # default

        # ── Tier 2: Haiku Classification ──
        if self.anthropic_key:
            classified = self._classify_with_haiku(prompt)
            if classified:
                tier = 2
                
                # Sources from Haiku
                for src in classified.get("sources", []):
                    if src in NODES and src.startswith("src_"):
                        sources.add(src)
                
                # Pattern extras
                for pat_id in classified.get("patterns", []):
                    pat = next((p for p in ARCHITECTURE_PATTERNS if p["id"] == pat_id), None)
                    if pat:
                        decisions.append(f"Pattern: {pat['name']}")
                        for pid in pat.get("extra_products", []):
                            if pid in NODES:
                                extra_products.add(pid)
                
                # Industry
                ind_id = classified.get("industry")
                if ind_id and ind_id in INDUSTRY_TAGS:
                    ind = INDUSTRY_TAGS[ind_id]
                    decisions.append(f"Industry: {ind_id} ({', '.join(ind.get('compliance', []))})")
                    for pid in ind.get("required_products", []):
                        if pid in NODES:
                            extra_products.add(pid)
                
                if classified.get("reasoning"):
                    decisions.append(f"Reasoning: {classified['reasoning']}")

        # ── Tier 3: Keyword fallback ──
        keyword_sources = parse_prompt(prompt)
        if keyword_sources:
            sources |= keyword_sources
            if tier == 3:
                decisions.append(f"Keyword match: {', '.join(sorted(keyword_sources))}")

        # Industry from keywords if Haiku didn't find one
        if not any("Industry:" in d for d in decisions):
            ind_id = match_industry(prompt)
            if ind_id:
                ind = INDUSTRY_TAGS[ind_id]
                decisions.append(f"Industry: {ind_id} ({', '.join(ind.get('compliance', []))})")
                for pid in ind.get("required_products", []):
                    if pid in NODES:
                        extra_products.add(pid)

        # Default source
        if not sources:
            sources = {"src_oracle"}
            decisions.append("No specific source detected — defaulting to Oracle")

        # ── Auto-wire → full keep_set ──
        keep, wire_decisions = auto_wire(sources)
        keep |= sources | extra_products
        decisions.extend(wire_decisions)

        # ── Build title ──
        title = build_title(sources)
        ind_match = match_industry(prompt)
        if ind_match:
            title += f" ({ind_match.title()})"

        result = {
            "sources": sources,
            "keep_set": keep,
            "decisions": decisions,
            "industry": {"id": ind_match} if ind_match else None,
            "title": title,
            "tier": tier,
        }

        # ── Cache ──
        self.cache_result(prompt, result)

        return result


# ─── CLI Test ────────────────────────────────────────
if __name__ == "__main__":
    prompts = [
        "Oracle to BigQuery",
        "real-time streaming analytics from Kafka",
        "Salesforce and HubSpot customer 360",
        "HIPAA compliant pipeline from Oracle for hospital",
        "manufacturing IoT predictive maintenance with SAP",
        "migrate from AWS S3 to GCP",
        "Shopify and Stripe ecommerce analytics",
        "banking fraud detection pipeline",
    ]

    router = SmartRouter()
    for prompt in prompts:
        print(f"\n{'═' * 60}")
        print(f"PROMPT: \"{prompt}\"")
        print(f"{'═' * 60}")
        result = router.route(prompt)
        print(f"  Tier:      {result['tier']}")
        print(f"  Sources:   {sorted(result['sources'])}")
        print(f"  Keep set:  {len(result['keep_set'])} products")
        print(f"  Industry:  {result['industry']['id'] if result.get('industry') else 'None'}")
        print(f"  Title:     {result['title']}")
        for d in result["decisions"]:
            print(f"  → {d}")
    router.close()
