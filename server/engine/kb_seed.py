#!/usr/bin/env python3
"""
ArchGen KB Seeder — Baby Step Version
Pushes PRODUCT_TAGS + ARCHITECTURE_PATTERNS + INDUSTRY_TAGS into pgvector.

Usage:
    python kb_seed.py                        # seed data only
    python kb_seed.py --embed                # seed + generate embeddings
    python kb_seed.py --embed --voyage-key YOUR_KEY

Requires: pip install psycopg2-binary
"""

import os, sys, json, argparse, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import psycopg2
from gcp_blueprint import (
    NODES, EDGES, PRODUCT_TAGS, ARCHITECTURE_PATTERNS, INDUSTRY_TAGS,
    ALWAYS_ON, SOURCE_CATEGORIES, get_search_text
)

DB_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres123@localhost:5432/archgen")

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kb_products (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    layer           TEXT NOT NULL,
    zone            TEXT NOT NULL,
    group_name      TEXT,
    subtitle        TEXT,
    keywords        TEXT[],
    use_cases       TEXT[],
    industries      TEXT[],
    description     TEXT,
    search_text     TEXT,
    embedding       vector(1024),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_patterns (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    keywords        TEXT[],
    description     TEXT NOT NULL,
    sources         TEXT[],
    source_match    TEXT DEFAULT 'any',
    extra_products  TEXT[],
    search_text     TEXT,
    embedding       vector(1024),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_industries (
    id              TEXT PRIMARY KEY,
    keywords        TEXT[],
    compliance      TEXT[],
    required_products TEXT[],
    description     TEXT NOT NULL,
    search_text     TEXT,
    embedding       vector(1024),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_diagram_cache (
    id              SERIAL PRIMARY KEY,
    prompt          TEXT NOT NULL,
    sources         TEXT[],
    keep_set        TEXT[],
    diagram_json    JSONB,
    industry        TEXT,
    title           TEXT,
    embedding       vector(1024),
    hit_count       INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_products_emb ON kb_products USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_kb_patterns_emb ON kb_patterns USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_kb_industries_emb ON kb_industries USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_kb_diagram_cache_emb ON kb_diagram_cache USING hnsw (embedding vector_cosine_ops);
"""


def get_conn(db_url=None):
    return psycopg2.connect(db_url or DB_URL)


def create_schema(conn):
    cur = conn.cursor()
    cur.execute(SCHEMA_SQL)
    conn.commit()
    print("✅ Schema created (4 tables + indexes)")


def seed_products(conn):
    cur = conn.cursor()
    count = 0
    for pid, node in NODES.items():
        tags = PRODUCT_TAGS.get(pid, {})
        search_text = get_search_text(pid)
        cur.execute("""
            INSERT INTO kb_products (id, name, layer, zone, group_name, subtitle,
                                     keywords, use_cases, industries, description, search_text)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET
                name=EXCLUDED.name, layer=EXCLUDED.layer, zone=EXCLUDED.zone,
                group_name=EXCLUDED.group_name, subtitle=EXCLUDED.subtitle,
                keywords=EXCLUDED.keywords, use_cases=EXCLUDED.use_cases,
                industries=EXCLUDED.industries, description=EXCLUDED.description,
                search_text=EXCLUDED.search_text
        """, (
            pid, node["name"], node.get("layer",""), node.get("zone",""),
            node.get("group",""), node.get("subtitle",""),
            tags.get("keywords",[]), tags.get("use_cases",[]),
            tags.get("industries",[]), tags.get("description",""),
            search_text
        ))
        count += 1
    conn.commit()
    print(f"✅ kb_products: {count} rows")


def seed_patterns(conn):
    cur = conn.cursor()
    count = 0
    for pat in ARCHITECTURE_PATTERNS:
        search_text = f"{pat['name']} {pat['description']} {' '.join(pat['keywords'])}"
        cur.execute("""
            INSERT INTO kb_patterns (id, name, keywords, description, sources, source_match, extra_products, search_text)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET
                name=EXCLUDED.name, keywords=EXCLUDED.keywords, description=EXCLUDED.description,
                sources=EXCLUDED.sources, source_match=EXCLUDED.source_match,
                extra_products=EXCLUDED.extra_products, search_text=EXCLUDED.search_text
        """, (
            pat["id"], pat["name"], pat["keywords"], pat["description"],
            pat.get("sources",[]), pat.get("source_match","any"),
            pat.get("extra_products",[]), search_text
        ))
        count += 1
    conn.commit()
    print(f"✅ kb_patterns: {count} rows")


def seed_industries(conn):
    cur = conn.cursor()
    count = 0
    for ind_id, ind in INDUSTRY_TAGS.items():
        search_text = f"{ind_id} {ind['description']} {' '.join(ind['keywords'])} {' '.join(ind.get('compliance',[]))}"
        cur.execute("""
            INSERT INTO kb_industries (id, keywords, compliance, required_products, description, search_text)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET
                keywords=EXCLUDED.keywords, compliance=EXCLUDED.compliance,
                required_products=EXCLUDED.required_products, description=EXCLUDED.description,
                search_text=EXCLUDED.search_text
        """, (
            ind_id, ind["keywords"], ind.get("compliance",[]),
            ind.get("required_products",[]), ind["description"], search_text
        ))
        count += 1
    conn.commit()
    print(f"✅ kb_industries: {count} rows")


def embed_with_voyage(texts: list, api_key: str, model="voyage-3.5-lite") -> list:
    """Batch embed texts with Voyage AI. Returns list of 1024-dim vectors."""
    import urllib.request
    all_embeddings = []
    batch_size = 64
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        data = json.dumps({
            "model": model,
            "input": batch,
            "input_type": "document",
        }).encode()
        req = urllib.request.Request(
            "https://api.voyageai.com/v1/embeddings",
            data=data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read())
        for item in result["data"]:
            all_embeddings.append(item["embedding"])
        if i + batch_size < len(texts):
            time.sleep(0.2)
    return all_embeddings


def generate_embeddings(conn, api_key: str):
    cur = conn.cursor()
    for table, text_col in [("kb_products","search_text"), ("kb_patterns","search_text"), ("kb_industries","search_text")]:
        cur.execute(f"SELECT id, {text_col} FROM {table} WHERE embedding IS NULL AND {text_col} IS NOT NULL")
        rows = cur.fetchall()
        if rows:
            print(f"  Embedding {len(rows)} {table}...")
            ids = [r[0] for r in rows]
            texts = [r[1][:2000] for r in rows]
            embeddings = embed_with_voyage(texts, api_key)
            for pid, emb in zip(ids, embeddings):
                cur.execute(f"UPDATE {table} SET embedding = %s WHERE id = %s", (str(emb), pid))
            conn.commit()
            print(f"  ✅ {len(rows)} embeddings")


def print_summary(conn):
    cur = conn.cursor()
    print("\n═══ Summary ═══")
    for t in ["kb_products", "kb_patterns", "kb_industries", "kb_diagram_cache"]:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            total = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {t} WHERE embedding IS NOT NULL")
            embedded = cur.fetchone()[0]
            print(f"  {t:25s} {total:4d} rows  ({embedded} embedded)")
        except:
            conn.rollback()
            print(f"  {t:25s} -- not created --")


def main():
    parser = argparse.ArgumentParser(description="ArchGen KB Seeder")
    parser.add_argument("--db", type=str, help="Database URL")
    parser.add_argument("--embed", action="store_true", help="Generate Voyage AI embeddings")
    parser.add_argument("--voyage-key", type=str, help="Voyage AI API key")
    args = parser.parse_args()

    db_url = args.db or DB_URL
    print("═══ ArchGen Knowledge Base Seeder ═══\n")
    conn = get_conn(db_url)
    create_schema(conn)
    print()
    seed_products(conn)
    seed_patterns(conn)
    seed_industries(conn)
    if args.embed:
        voyage_key = args.voyage_key or os.environ.get("VOYAGE_API_KEY")
        if not voyage_key:
            print("\n⚠️  No Voyage API key. Set VOYAGE_API_KEY or use --voyage-key")
            print("   Get one free at: https://dash.voyageai.com/")
        else:
            print()
            generate_embeddings(conn, voyage_key)
    print_summary(conn)
    conn.close()
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
