import numpy as np
import pytest

from app.services import rag_service, llm_service


def test_chunk_text():
    sample_text = "A" * 1500
    chunks = rag_service.chunk_text(sample_text, chunk_size=500, overlap=100)

    assert len(chunks) >= 3
    for chunk in chunks:
        assert len(chunk) <= 500


def test_cosine_similarity():
    # Identical vectors
    v1 = np.array([1.0, 2.0, 3.0])
    assert pytest.approx(rag_service.cosine_similarity(v1, v1), rel=1e-5) == 1.0

    # Orthogonal vectors
    v2 = np.array([1.0, 0.0])
    v3 = np.array([0.0, 1.0])
    assert rag_service.cosine_similarity(v2, v3) == 0.0

    # Zero vector
    zero = np.array([0.0, 0.0])
    assert rag_service.cosine_similarity(zero, v2) == 0.0


def test_keyword_search_chunks():
    chunks = [
        "Python is a versatile programming language used in artificial intelligence and web development.",
        "Operating systems manage hardware and computer memory resources effectively.",
        "Database management systems store tabular relational data securely."
    ]

    results = rag_service.keyword_search_chunks("Python programming", chunks, top_k=2)
    assert len(results) >= 1
    assert "Python is a versatile" in results[0]

    # Query with only stopwords
    empty_results = rag_service.keyword_search_chunks("what is the", chunks, top_k=2)
    assert isinstance(empty_results, list)


def test_has_document_and_status():
    subject_id = "test_sub_999"
    assert rag_service.has_document(subject_id) is False

    status = rag_service.get_subject_index_status(subject_id)
    assert status["has_documents"] is False
    assert status["chunk_count"] == 0

    # Manually populate VECTOR_STORE for this test subject
    rag_service.VECTOR_STORE[subject_id] = {
        "chunks": ["Sample lecture notes chunk 1", "Sample lecture notes chunk 2"],
        "embeddings": None,
        "doc_names": ["Notes1.pdf"]
    }

    assert rag_service.has_document(subject_id) is True
    status = rag_service.get_subject_index_status(subject_id)
    assert status["has_documents"] is True
    assert status["chunk_count"] == 2
    assert "Notes1.pdf" in status["doc_names"]

    # Cleanup
    del rag_service.VECTOR_STORE[subject_id]


def test_clean_reasoning():
    raw_response = "<think>The user is asking about sorting.</think>Bubble sort has time complexity O(n^2)."
    cleaned = llm_service._clean_reasoning(raw_response)
    assert "<think>" not in cleaned
    assert "</think>" not in cleaned
    assert cleaned == "Bubble sort has time complexity O(n^2)."


def test_normalize_rag_response():
    negative_text = "This information is not mentioned in the provided document."
    normalized = llm_service._normalize_rag_response(negative_text)
    assert normalized == llm_service.RAG_NOT_FOUND_MESSAGE

    positive_text = "The semester examination starts on May 15th."
    assert llm_service._normalize_rag_response(positive_text) == positive_text


@pytest.mark.asyncio
async def test_ask_rag_empty_context():
    # When context is empty, ask_rag should immediately return not found message
    res = await llm_service.ask_rag("", "What is the passing mark?")
    assert res == llm_service.RAG_NOT_FOUND_MESSAGE
