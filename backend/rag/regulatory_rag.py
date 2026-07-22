"""
Regulatory RAG module.

Embeds a small, hand-picked corpus of real OISD/DGMS/Factory Act clauses plus
synthetic near-miss reports into Chroma, then retrieves + synthesizes citations
for orchestrator alerts using Claude.

The retrieval result is grounded: only citations that were actually retrieved
are ever included in the final output. Claude is instructed to paraphrase and
reference, not invent.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger("sentrix.rag")

# Deferred imports - Chroma/sentence-transformers are heavyweight, only load if used.
_CHROMA_CLIENT = None
_COLLECTION = None


def _ensure_collection():
    """Lazy-load Chroma and build/load the collection on first use."""
    global _CHROMA_CLIENT, _COLLECTION
    if _COLLECTION is not None:
        return _COLLECTION

    import chromadb
    from chromadb.config import Settings

    # Chroma persistence dir (excluded from git; see .gitignore).
    persist_dir = Path(__file__).parent / "chroma_db"
    persist_dir.mkdir(parents=True, exist_ok=True)

    _CHROMA_CLIENT = chromadb.PersistentClient(
        path=str(persist_dir),
        settings=Settings(anonymized_telemetry=False),
    )

    collection_name = "sentrix_regulatory"
    try:
        _COLLECTION = _CHROMA_CLIENT.get_collection(collection_name)
        logger.info("Loaded existing Chroma collection '%s' (%d docs).",
                    collection_name, _COLLECTION.count())
    except Exception:
        # Collection doesn't exist; create and populate it.
        logger.info("Creating new Chroma collection '%s'...", collection_name)
        from .corpus import get_corpus
        corpus = get_corpus()
        _COLLECTION = _CHROMA_CLIENT.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        _COLLECTION.add(
            ids=[doc["id"] for doc in corpus],
            documents=[doc["text"] for doc in corpus],
            metadatas=[
                {"type": doc["type"], "citation": doc["citation"]}
                for doc in corpus
            ],
        )
        logger.info("Embedded %d documents into '%s'.", len(corpus), collection_name)

    return _COLLECTION


def _simple_keyword_retrieve(query: str, top_k: int = 5) -> list[dict]:
    """Fallback keyword search over corpus when ChromaDB is unavailable."""
    from .corpus import get_corpus
    corpus = get_corpus()
    query_words = [w.strip(",.()[]").lower() for w in query.split() if len(w) > 2]
    scored = []
    for doc in corpus:
        text_lower = (doc["citation"] + " " + doc["text"]).lower()
        score = sum(1 for w in query_words if w in text_lower)
        scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {
            "id": doc["id"],
            "type": doc["type"],
            "citation": doc["citation"],
            "text": doc["text"],
            "distance": 0.5,
        }
        for score, doc in scored[:top_k]
    ]


# --- Retrieval ------------------------------------------------------------
def retrieve(query: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve the top_k most relevant documents (regulations + near-miss reports)
    for a given query text.
    Returns: [{"id": str, "type": str, "citation": str, "text": str, "distance": float}, ...]
    """
    try:
        coll = _ensure_collection()
        results = coll.query(query_texts=[query], n_results=top_k)
        docs = []
        for i, doc_id in enumerate(results["ids"][0]):
            docs.append({
                "id": doc_id,
                "type": results["metadatas"][0][i]["type"],
                "citation": results["metadatas"][0][i]["citation"],
                "text": results["documents"][0][i],
                "distance": results["distances"][0][i],
            })
        return docs
    except Exception as exc:
        logger.info("Chroma retrieval fallback to keyword retrieval: %s", exc)
        return _simple_keyword_retrieve(query, top_k=top_k)


# --- Claude synthesis -----------------------------------------------------
_CITATION_SYSTEM = (
    "You are a safety compliance assistant. You receive an alert description from an "
    "industrial safety monitoring system, plus a list of retrieved regulatory clauses "
    "and near-miss incident reports. Write a single, grounded 1-2 sentence statement "
    "explaining which regulation(s) and/or near-miss pattern(s) this alert relates to. "
    "ONLY reference the citations that were actually retrieved—do not invent clause "
    "numbers or documents. Paraphrase the regulation briefly; do not quote verbatim. "
    "Be concrete and compliance-focused. All data is synthetic for demonstration purposes."
)


def _call_claude_for_citation(alert_explanation: str, retrieved_docs: list[dict]) -> Optional[str]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        import json
        client = anthropic.Anthropic(api_key=api_key)

        # Format the retrieved docs for the prompt.
        docs_text = "\n\n".join(
            f"[{d['type'].upper()}] {d['citation']}\n{d['text']}"
            for d in retrieved_docs
        )
        user_payload = (
            f"ALERT EXPLANATION:\n{alert_explanation}\n\n"
            f"RETRIEVED CITATIONS:\n{docs_text}\n\n"
            "Write the grounded regulatory/near-miss statement now (1-2 sentences)."
        )

        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=200,
            system=_CITATION_SYSTEM,
            messages=[{"role": "user", "content": user_payload}],
        )
        text = "".join(
            block.text for block in msg.content
            if getattr(block, "type", None) == "text"
        ).strip()
        return text or None
    except Exception as exc:
        logger.warning("Claude citation synthesis failed (%s); using fallback.", exc)
        return None


def _fallback_citation(retrieved_docs: list[dict]) -> str:
    """Deterministic citation when Claude is unavailable."""
    if not retrieved_docs:
        return "No specific regulatory clause retrieved for this alert."
    regs = [d for d in retrieved_docs if d["type"] == "regulation"]
    nms = [d for d in retrieved_docs if d["type"] == "near_miss"]
    parts = []
    if regs:
        parts.append(f"Related regulation: {regs[0]['citation']}")
    if nms:
        parts.append(f"Similar pattern in {nms[0]['citation']}")
    return ". ".join(parts) + "."


def generate_citation(alert_explanation: str, top_k: int = 5) -> dict:
    """
    Retrieve + synthesize a grounded regulatory citation for an alert.
    Returns: {
        "clause": str (the 1-2 sentence grounded statement),
        "source": str (primary citation label),
        "retrieved_docs": [{"id", "type", "citation", "text", "distance"}, ...],
        "status": "llm" | "fallback" | "no_retrieval"
    }
    """
    docs = retrieve(alert_explanation, top_k=top_k)
    if not docs:
        return {
            "clause": "No relevant regulatory clause or near-miss report found.",
            "source": "N/A",
            "retrieved_docs": [],
            "status": "no_retrieval",
        }

    llm_clause = _call_claude_for_citation(alert_explanation, docs)
    if llm_clause:
        return {
            "clause": llm_clause,
            "source": docs[0]["citation"],  # primary/top-ranked doc
            "retrieved_docs": docs,
            "status": "llm",
        }
    else:
        return {
            "clause": _fallback_citation(docs),
            "source": docs[0]["citation"],
            "retrieved_docs": docs,
            "status": "fallback",
        }
