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
    import os
    api_key = (settings.HUGGINGFACE_API_KEY or os.environ.get("HF_TOKEN") or "").strip()
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

async def index_document(subject_id: str, pdf_bytes: bytes, doc_name: str = ""):
    text = extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        raise ValueError("No text could be extracted from this PDF. It may be scanned or empty.")

    chunks = chunk_text(text)
    if not chunks:
        return

    embeddings = await get_embeddings(chunks)

    s_key = str(subject_id)
    if s_key not in VECTOR_STORE:
        VECTOR_STORE[s_key] = {"chunks": [], "embeddings": None, "doc_names": []}

    VECTOR_STORE[s_key]["chunks"].extend(chunks)
    if doc_name and doc_name not in VECTOR_STORE[s_key].get("doc_names", []):
        VECTOR_STORE[s_key].setdefault("doc_names", []).append(doc_name)

    if embeddings.size > 0:
        if VECTOR_STORE[s_key]["embeddings"] is None or VECTOR_STORE[s_key]["embeddings"].size == 0:
            VECTOR_STORE[s_key]["embeddings"] = embeddings
        else:
            try:
                VECTOR_STORE[s_key]["embeddings"] = np.vstack((VECTOR_STORE[s_key]["embeddings"], embeddings))
            except Exception:
                VECTOR_STORE[s_key]["embeddings"] = embeddings

    print(f"[RAG] Successfully indexed {len(chunks)} chunks for subject '{subject_id}' ({doc_name})")

def has_document(subject_id: str) -> bool:
    """Check if any document chunks are loaded for the specific subject, or across all if subject_id == 'all'."""
    s_key = str(subject_id)
    if s_key == "all":
        for s_data in VECTOR_STORE.values():
            if s_data and s_data.get("chunks"):
                return True
        return False

    target_data = VECTOR_STORE.get(s_key)
    return bool(target_data and target_data.get("chunks"))

def get_subject_index_status(subject_id: str) -> dict:
    s_key = str(subject_id)
    data = VECTOR_STORE.get(s_key)
    if data and data.get("chunks"):
        return {
            "has_documents": True,
            "chunk_count": len(data["chunks"]),
            "doc_names": data.get("doc_names", [])
        }
    return {
        "has_documents": False,
        "chunk_count": 0,
        "doc_names": []
    }

async def ensure_subject_indexed(subject_id: str, db) -> int:
    """
    Automatically finds and chunks faculty-uploaded notes for this subject.
    Checks local persistent storage and S3 / S3 URLs.
    Returns number of chunks available for the subject.
    """
    s_key = str(subject_id)
    if has_document(s_key):
        return len(VECTOR_STORE[s_key]["chunks"])

    if s_key == "all":
        return 0

    from app.models.resource import Resource, FileType
    from app.services import s3_service
    from sqlalchemy import select
    import os

    try:
        sub_id_int = int(s_key)
    except (ValueError, TypeError):
        return 0

    res_query = select(Resource).where(Resource.subject_id == sub_id_int)
    res_exec = await db.execute(res_query)
    resources = res_exec.scalars().all()

    if not resources:
        return 0

    possible_data_dirs = ["/app/data", "./backend/data", "./data", "."]

    for r in resources:
        pdf_bytes = None
        # 1. Try local storage cache
        if r.s3_key:
            for base_dir in possible_data_dirs:
                cand = os.path.join(base_dir, r.s3_key)
                if os.path.exists(cand):
                    try:
                        with open(cand, "rb") as f:
                            pdf_bytes = f.read()
                        break
                    except Exception as e:
                        print(f"[RAG] Error reading local file {cand}: {e}")

        # 2. Try S3 download
        if not pdf_bytes and r.s3_key and settings.AWS_ACCESS_KEY_ID:
            try:
                pdf_bytes = await s3_service.download_file_bytes(r.s3_key)
            except Exception as e:
                print(f"[RAG] S3 download error for {r.s3_key}: {e}")

        # 3. Try S3 URL / HTTP download
        if not pdf_bytes and r.s3_url and r.s3_url.startswith("http"):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(r.s3_url)
                    if resp.status_code == 200:
                        pdf_bytes = resp.content
            except Exception as e:
                print(f"[RAG] URL download error for {r.s3_url}: {e}")

        # If PDF bytes obtained, extract and index
        if pdf_bytes:
            try:
                await index_document(s_key, pdf_bytes, doc_name=r.title)
            except Exception as e:
                print(f"[RAG] Error indexing PDF for {r.title}: {e}")

        # Also index description and title as text chunks if available
        if r.description and len(r.description.strip()) > 10:
            text_context = f"Subject Note: {r.title}\nDescription:\n{r.description}"
            desc_chunks = chunk_text(text_context)
            if desc_chunks:
                if s_key not in VECTOR_STORE:
                    VECTOR_STORE[s_key] = {"chunks": [], "embeddings": None, "doc_names": []}
                VECTOR_STORE[s_key]["chunks"].extend(desc_chunks)
                if r.title not in VECTOR_STORE[s_key].get("doc_names", []):
                    VECTOR_STORE[s_key].setdefault("doc_names", []).append(r.title)

    return len(VECTOR_STORE.get(s_key, {}).get("chunks", []))

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def keyword_search_chunks(query: str, chunks: list[str], top_k: int = 4) -> list[str]:
    stopwords = {
        "what", "when", "where", "which", "who", "whom", "whose", "why", "how", 
        "the", "and", "is", "are", "was", "were", "explain", "tell", "about", 
        "give", "define", "does", "did", "can", "could", "would", "should", "this", "that"
    }
    words = [w.lower() for w in re.findall(r'\b\w{3,}\b', query) if w.lower() not in stopwords]
    if not words:
        words = [w.lower() for w in re.findall(r'\b\w{3,}\b', query)]
    if not words:
        return []

    scores = []
    for c in chunks:
        c_lower = c.lower()
        score = sum(c_lower.count(w) for w in words)
        scores.append(score)

    top_indices = np.argsort(scores)[-top_k:][::-1]
    matched = [chunks[i] for i in top_indices if scores[i] > 0]
    return matched

async def search_chunks(query: str, subject_id: str, top_k: int = 4) -> list[str]:
    s_key = str(subject_id)
    if s_key == "all":
        all_chunks = []
        for s_data in VECTOR_STORE.values():
            if s_data and s_data.get("chunks"):
                all_chunks.extend(s_data["chunks"])
        chunks = all_chunks
        store_embeddings = None
    else:
        target_data = VECTOR_STORE.get(s_key)
        if not target_data or not target_data.get("chunks"):
            return []
        chunks = target_data["chunks"]
        store_embeddings = target_data.get("embeddings")

    if not chunks:
        return []

    # If neural embeddings are available, try vector search with similarity threshold
    if store_embeddings is not None and store_embeddings.size > 0:
        try:
            query_embedding = await get_embeddings([query])
            if query_embedding.size > 0 and query_embedding.shape[1] == store_embeddings.shape[1]:
                query_emb = query_embedding[0]
                similarities = [cosine_similarity(query_emb, doc_emb) for doc_emb in store_embeddings]
                scored = [(similarities[i], chunks[i]) for i in range(len(chunks)) if similarities[i] >= 0.25]
                if scored:
                    scored.sort(key=lambda x: x[0], reverse=True)
                    return [c for _, c in scored[:top_k]]
        except Exception as e:
            print(f"[RAG] Neural search error: {e}, falling back to keyword search")

    return keyword_search_chunks(query, chunks, top_k=top_k)

