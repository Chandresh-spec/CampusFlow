import asyncio
import httpx
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()

FALLBACK_MODELS = [
    "meta-llama/Llama-3.2-3B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "deepseek-ai/DeepSeek-V4-Pro:novita",
    "Qwen/Qwen2.5-72B-Instruct",
]

async def _ask_pollinations(messages: list[dict]) -> str:
    """Free, robust, zero-config generative AI fallback."""
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            res = await client.post(
                "https://text.pollinations.ai/",
                json={"messages": messages, "model": "openai"},
            )
            if res.status_code == 200 and res.text.strip():
                return res.text.strip()
    except Exception as e:
        print(f"[LLM] Pollinations fallback error: {e}")
    return ""

RAG_NOT_FOUND_MESSAGE = (
    "The answer to this question is not present in the uploaded document. "
    "Would you like to switch to General AI mode to search online?"
)

def _normalize_rag_response(content: str) -> str:
    content_lower = content.lower()
    negative_phrases = [
        "not present in the uploaded document",
        "not mentioned in the provided",
        "not mentioned in the document",
        "not contained in the provided",
        "not found in the provided",
        "not found in the document",
        "does not mention",
        "does not contain",
        "does not provide",
        "no information about",
        "no mention of",
        "cannot be answered based on the provided context",
        "cannot answer this question based on the provided",
        "cannot find this information in the document",
        "i don't know",
        "i do not know",
    ]
    for phrase in negative_phrases:
        if phrase in content_lower:
            return RAG_NOT_FOUND_MESSAGE
    return content

async def ask_rag(context: str, question: str) -> str:
    """
    Strict RAG mode: answers exclusively from the uploaded PDF document.
    Never uses general online knowledge. If not found, directs user to search online.
    """
    if not context or not context.strip():
        return RAG_NOT_FOUND_MESSAGE

    truncated_context = context[:6000]

    system_prompt = (
        "You are an academic document QA assistant for Smart College System.\n"
        "Your task is to answer the user's question STRICTLY and ONLY using the provided Document Context.\n\n"
        "STRICT CONSTRAINTS:\n"
        "1. Do NOT use outside knowledge or the internet.\n"
        "2. Do NOT guess, extrapolate, or assume information not found in the Document Context.\n"
        "3. If the answer cannot be found in the Document Context, respond EXACTLY with:\n"
        f"\"{RAG_NOT_FOUND_MESSAGE}\""
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Document Context:\n{truncated_context}\n\nQuestion: {question}\nAnswer:"}
    ]

    # 1. Try Hugging Face Router if configured
    api_key = (settings.HUGGINGFACE_API_KEY or "").strip()
    if api_key and not api_key.startswith("your-"):
        client = AsyncOpenAI(
            base_url="https://router.huggingface.co/v1",
            api_key=api_key,
        )
        for model_name in FALLBACK_MODELS:
            try:
                response = await client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    max_tokens=800,
                    temperature=0.1,
                    timeout=10.0
                )
                content = response.choices[0].message.content
                if content and content.strip():
                    return _normalize_rag_response(content.strip())
            except Exception as e:
                if "401" in str(e) or "AuthenticationError" in type(e).__name__:
                    break

    # 2. Free AI Engine (Pollinations AI with low temperature for factual grounding)
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            res = await client.post(
                "https://text.pollinations.ai/",
                json={"messages": messages, "model": "openai", "temperature": 0.1},
            )
            if res.status_code == 200 and res.text.strip():
                return _normalize_rag_response(res.text.strip())
    except Exception as e:
        print(f"[RAG] Pollinations error: {e}")

    return RAG_NOT_FOUND_MESSAGE

async def ask_llm(context: str, question: str) -> str:
    truncated_context = context[:5000] if context else ""

    if truncated_context:
        system_prompt = (
            "You are an academic AI assistant for Smart College System. "
            "Use the provided document context to answer the student's question accurately and concisely."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Document Context:\n{truncated_context}\n\nQuestion: {question}\nAnswer:"}
        ]
    else:
        system_prompt = (
            "You are an intelligent, friendly AI assistant for college students and faculty. "
            "Help answer academic questions, explain concepts, and assist with coding, mathematics, and science."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ]

    # 1. Try Hugging Face Router if a non-placeholder API key is set
    api_key = (settings.HUGGINGFACE_API_KEY or "").strip()
    if api_key and not api_key.startswith("your-"):
        client = AsyncOpenAI(
            base_url="https://router.huggingface.co/v1",
            api_key=api_key,
        )
        for model_name in FALLBACK_MODELS:
            try:
                response = await client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    max_tokens=800,
                    temperature=0.7,
                    timeout=10.0
                )
                content = response.choices[0].message.content
                if content and content.strip():
                    return content.strip()
            except Exception as e:
                print(f"[LLM] HuggingFace model {model_name} note: {e}")
                # If authentication failed (401), don't waste time retrying all models
                if "401" in str(e) or "AuthenticationError" in type(e).__name__:
                    print("[LLM] HuggingFace token invalid, switching to free inference engine")
                    break

    # 2. Resilient Free AI Fallback (Pollinations AI)
    free_response = await _ask_pollinations(messages)
    if free_response:
        return free_response

    # 3. Context fallback if document notes are available
    if context and context.strip():
        return f"### Document Context:\n\n{context[:1200]}"

    return "Hello! I am your Smart College Assistant. I received your question, but the external AI model is currently taking longer than expected. Please try again in a few moments."
