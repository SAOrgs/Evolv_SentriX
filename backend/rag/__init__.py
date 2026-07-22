"""backend.rag - Regulatory RAG module for grounded citation retrieval."""

from .regulatory_rag import generate_citation, retrieve

__all__ = ["generate_citation", "retrieve"]
