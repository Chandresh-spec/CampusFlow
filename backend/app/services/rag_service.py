import io
import re
import numpy as np
import httpx
from pypdf import PdfReader
from app.config import get_settings

settings = get_settings()

VECTOR_STORE = {}

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text
    except Exception as e:
        print(f"[RAG] Error extracting PDF text: {e}")
        return ""

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    chunks = []
    start = 0
    clean_text = text.strip()
    while start < len(clean_text):
        end = min(start + chunk_size, len(clean_text))
        chunks.append(clean_text[start:end])
        if end == len(clean_text):
            break
        start += chunk_size - overlap
    return chunks

async def get_embeddings(texts: list[str]) -> np.ndarray:
    api_key = (settings.HUGGINGFACE_API_KEY or "").strip()
    if not api_key or api_key.startswith("your-"):
        return np.empty((0, 0))

    url = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"
    headers = {"Authorization": f"Bearer {api_key}"}
    embeddings = []
    batch_size = 32

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                response = await client.post(url, headers=headers, json={"inputs": batch})
                if response.status_code == 200:
                    batch_embeddings = response.json()
                    embeddings.extend(batch_embeddings)
                else:
                    print(f"[RAG] HuggingFace embeddings status {response.status_code}: {response.text}")
                    return np.empty((0, 0))
        return np.array(embeddings)
    except Exception as e:
        print(f"[RAG] get_embeddings network error: {e}")
        return np.empty((0, 0))

async def index_document(subject_id: str, pdf_bytes: bytes):
    text = extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        raise ValueError("No text could be extracted from this PDF. It may be scanned or empty.")

    chunks = chunk_text(text)
    if not chunks:
        return

    embeddings = await get_embeddings(chunks)

    if subject_id not in VECTOR_STORE:
        VECTOR_STORE[subject_id] = {"chunks": [], "embeddings": None}

    VECTOR_STORE[subject_id]["chunks"].extend(chunks)

    if embeddings.size > 0:
        if VECTOR_STORE[subject_id]["embeddings"] is None or VECTOR_STORE[subject_id]["embeddings"].size == 0:
            VECTOR_STORE[subject_id]["embeddings"] = embeddings
        else:
            try:
                VECTOR_STORE[subject_id]["embeddings"] = np.vstack((VECTOR_STORE[subject_id]["embeddings"], embeddings))
            except Exception:
                VECTOR_STORE[subject_id]["embeddings"] = embeddings

    print(f"[RAG] Successfully indexed {len(chunks)} chunks for subject '{subject_id}'")

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def keyword_search_chunks(query: str, chunks: list[str], top_k: int = 4) -> list[str]:
    words = [w.lower() for w in re.findall(r'\b\w{3,}\b', query)]
    if not words:
        return chunks[:top_k]

    scores = []
    for c in chunks:
        c_lower = c.lower()
        score = sum(c_lower.count(w) for w in words)
        scores.append(score)

    top_indices = np.argsort(scores)[-top_k:][::-1]
    matched = [chunks[i] for i in top_indices if scores[i] > 0]
    return matched if matched else chunks[:top_k]

async def search_chunks(query: str, subject_id: str, top_k: int = 4) -> list[str]:
    # Look for matching subject_id, or search across all loaded documents
    target_data = VECTOR_STORE.get(str(subject_id))
    if not target_data or not target_data["chunks"]:
        # Fallback to any available subject
        for s_id, s_data in VECTOR_STORE.items():
            if s_data and s_data.get("chunks"):
                target_data = s_data
                break

    if not target_data or not target_data["chunks"]:
        return []

    chunks = target_data["chunks"]
    store_embeddings = target_data.get("embeddings")

    # If neural embeddings are available, try vector search
    if store_embeddings is not None and store_embeddings.size > 0:
        try:
            query_embedding = await get_embeddings([query])
            if query_embedding.size > 0 and query_embedding.shape[1] == store_embeddings.shape[1]:
                query_emb = query_embedding[0]
                similarities = [cosine_similarity(query_emb, doc_emb) for doc_emb in store_embeddings]
                top_indices = np.argsort(similarities)[-top_k:][::-1]
                return [chunks[i] for i in top_indices]
        except Exception as e:
            print(f"[RAG] Neural search error: {e}, falling back to keyword search")

    # Resilient keyword/BM25 ranker
    return keyword_search_chunks(query, chunks, top_k=top_k)
