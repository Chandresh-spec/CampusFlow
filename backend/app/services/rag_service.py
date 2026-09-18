import io
import numpy as np
import httpx
from pypdf import PdfReader
from app.config import get_settings

settings = get_settings()

VECTOR_STORE = {}

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = ""
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            text += extracted + "\n"
    return text

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

async def get_embeddings(texts: list[str]) -> np.ndarray:
    url = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"
    headers = {"Authorization": f"Bearer {settings.HUGGINGFACE_API_KEY}"}
    embeddings = []
    batch_size = 64
    
    async with httpx.AsyncClient() as client:
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = await client.post(url, headers=headers, json={"inputs": batch})
            response.raise_for_status()
            batch_embeddings = response.json()
            embeddings.extend(batch_embeddings)
            
    return np.array(embeddings)

async def index_document(subject_id: str, pdf_bytes: bytes):
    text = extract_text_from_pdf(pdf_bytes)
    chunks = chunk_text(text)
    if not chunks:
        return
    embeddings = await get_embeddings(chunks)
    
    if subject_id not in VECTOR_STORE:
        VECTOR_STORE[subject_id] = {"chunks": [], "embeddings": np.empty((0, embeddings.shape[1]))}
        
    VECTOR_STORE[subject_id]["chunks"].extend(chunks)
    if VECTOR_STORE[subject_id]["embeddings"].size == 0:
        VECTOR_STORE[subject_id]["embeddings"] = embeddings
    else:
        VECTOR_STORE[subject_id]["embeddings"] = np.vstack((VECTOR_STORE[subject_id]["embeddings"], embeddings))

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

async def search_chunks(query: str, subject_id: str, top_k: int = 4) -> list[str]:
    if subject_id not in VECTOR_STORE or not VECTOR_STORE[subject_id]["chunks"]:
        return []
        
    query_embedding = await get_embeddings([query])
    query_emb = query_embedding[0]
    
    store_embeddings = VECTOR_STORE[subject_id]["embeddings"]
    chunks = VECTOR_STORE[subject_id]["chunks"]
    
    similarities = [cosine_similarity(query_emb, doc_emb) for doc_emb in store_embeddings]
    top_indices = np.argsort(similarities)[-top_k:][::-1]
    
    return [chunks[i] for i in top_indices]
