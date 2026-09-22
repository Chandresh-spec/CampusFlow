import os
import re
import random
import asyncio
import httpx
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()

RAG_NOT_FOUND_MESSAGE = (
    "The answer to this question is not present in the uploaded document. "
    "Would you like to switch to General AI mode to search online?"
)

def _clean_reasoning(text: str) -> str:
    """Remove internal reasoning or thinking tags (<think>...</think>) from responses."""
    if not text:
        return ""
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    return cleaned or text.strip()

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

async def _ask_groq(messages: list[dict], temperature: float = 0.5, max_tokens: int = 800) -> str:
    """Ultra-fast LPU inference via Groq Cloud (<0.4s response time)."""
    groq_key = (settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY") or "").strip()
    if not groq_key or groq_key.startswith("your-"):
        return ""
    try:
        client = AsyncOpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=groq_key,
        )
        groq_models = [
            "qwen/qwen3.8-27b",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "allam-2-7b",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
        ]
        for model in groq_models:
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=5.0
                )
                msg = resp.choices[0].message
                content = (msg.content or "").strip()
                if not content and hasattr(msg, "reasoning") and msg.reasoning:
                    content = msg.reasoning.strip()
                if content:
                    return _clean_reasoning(content)
            except Exception as e:
                print(f"[LLM] Groq model {model} error: {e}")
                if "401" in str(e) or "AuthenticationError" in type(e).__name__:
                    break
    except Exception as e:
        print(f"[LLM] Groq client error: {e}")
    return ""

async def _ask_gemini(messages: list[dict], temperature: float = 0.5, max_tokens: int = 800) -> str:
    """Fast Google Gemini API (~0.8s response time)."""
    gemini_key = (settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or "").strip()
    if not gemini_key or gemini_key.startswith("your-"):
        return ""
    try:
        client = AsyncOpenAI(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=gemini_key,
        )
        for model in ["gemini-1.5-flash", "gemini-2.0-flash"]:
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=6.0
                )
                content = resp.choices[0].message.content
                if content and content.strip():
                    return _clean_reasoning(content.strip())
            except Exception as e:
                print(f"[LLM] Gemini model {model} error: {e}")
                if "401" in str(e) or "AuthenticationError" in type(e).__name__:
                    break
    except Exception as e:
        print(f"[LLM] Gemini client error: {e}")
    return ""

async def _ask_openrouter(messages: list[dict], temperature: float = 0.5, max_tokens: int = 800) -> str:
    """Fast OpenRouter inference."""
    router_key = (settings.OPENROUTER_API_KEY or os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if not router_key or router_key.startswith("your-"):
        return ""
    try:
        client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=router_key,
        )
        for model in ["meta-llama/llama-3.2-3b-instruct:free", "google/gemini-2.0-flash-exp:free"]:
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=6.0
                )
                content = resp.choices[0].message.content
                if content and content.strip():
                    return _clean_reasoning(content.strip())
            except Exception as e:
                print(f"[LLM] OpenRouter model {model} error: {e}")
                if "401" in str(e) or "AuthenticationError" in type(e).__name__:
                    break
    except Exception as e:
        print(f"[LLM] OpenRouter client error: {e}")
    return ""

async def _ask_huggingface(messages: list[dict], temperature: float = 0.5, max_tokens: int = 800) -> str:
    """Hugging Face serverless inference."""
    api_key = (settings.HUGGINGFACE_API_KEY or os.environ.get("HF_TOKEN") or "").strip()
    if not api_key or api_key.startswith("your-"):
        return ""
    try:
        client = AsyncOpenAI(
            base_url="https://router.huggingface.co/v1",
            api_key=api_key,
        )
        for model in ["meta-llama/Llama-3.2-3B-Instruct", "Qwen/Qwen2.5-7B-Instruct"]:
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=4.0
                )
                content = resp.choices[0].message.content
                if content and content.strip():
                    return _clean_reasoning(content.strip())
            except Exception as e:
                print(f"[LLM] Hugging Face model {model} error: {e}")
                if "401" in str(e) or "AuthenticationError" in type(e).__name__:
                    break
    except Exception as e:
        print(f"[LLM] Hugging Face client error: {e}")
    return ""

async def _ask_pollinations_fast(messages: list[dict], timeout: float = 7.0) -> str:
    """Free, zero-config generative AI fallback with short timeout and clean reasoning output."""
    try:
        seed = random.randint(100, 999999)
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(
                "https://text.pollinations.ai/",
                json={"messages": messages, "model": "openai-fast", "seed": seed},
                headers={"User-Agent": "SmartCollegeSystem/2.0"}
            )
            if res.status_code == 200 and res.text.strip():
                return _clean_reasoning(res.text.strip())
    except Exception as e:
        print(f"[LLM] Pollinations error: {e}")
    return ""

async def _execute_query_pipeline(messages: list[dict], context: str = "", question: str = "", is_rag: bool = False, temperature: float = 0.5) -> str:
    """
    High-performance multi-tier pipeline:
    1. Groq Cloud LPU (<0.4s)
    2. Google Gemini (<1s)
    3. OpenRouter (~1.5s)
    4. Hugging Face (~1.5s)
    5. Pollinations Fast (~4-7s)
    6. Smart contextual & guidance fallback (<0.01s)
    """
    # 1. Groq LPU (Sub-second response)
    ans = await _ask_groq(messages, temperature=temperature)
    if ans:
        return ans

    # 2. Google Gemini
    ans = await _ask_gemini(messages, temperature=temperature)
    if ans:
        return ans

    # 3. OpenRouter
    ans = await _ask_openrouter(messages, temperature=temperature)
    if ans:
        return ans

    # 4. Hugging Face
    ans = await _ask_huggingface(messages, temperature=temperature)
    if ans:
        return ans

    # 5. Zero-config Free Engine (Pollinations Fast)
    ans = await _ask_pollinations_fast(messages, timeout=7.0)
    if ans:
        return ans

    # 6. Fallback based on mode
    if is_rag and context and context.strip():
        # Directly extract and return the relevant section from course notes
        return (
            f"### 📖 Course Notes Information:\n\n"
            f"{context[:1200]}\n\n"
            f"*(Extracted directly from uploaded subject materials)*"
        )

    if context and context.strip():
        return f"### Document Context:\n\n{context[:1000]}"

    return (
        f"I am your Smart College Assistant. I received your question: \"**{question}**\".\n\n"
        f"The free public AI inference queue is currently experiencing high load.\n\n"
        f"⚡ **Speed up AI replies to 0.3s**: Add a free **Groq API key** to `backend/.env`:\n"
        f"```bash\n"
        f"GROQ_API_KEY=gsk_your_free_key_here\n"
        f"```\n"
        f"*(Free instant key available at [console.groq.com/keys](https://console.groq.com/keys) - no credit card required)*"
    )

async def ask_rag(context: str, question: str) -> str:
    """
    Strict RAG mode: answers exclusively from the uploaded PDF document.
    Never uses general online knowledge. If not found, directs user to search online.
    """
    if not context or not context.strip():
        return RAG_NOT_FOUND_MESSAGE

    truncated_context = context[:4000]

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

    response = await _execute_query_pipeline(messages, context=truncated_context, question=question, is_rag=True, temperature=0.1)
    return _normalize_rag_response(response)

async def ask_llm(context: str, question: str) -> str:
    """
    General AI mode: Fast conceptual and academic assistance.
    """
    truncated_context = context[:3000] if context else ""

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
            "You are NexusAI, an intelligent and friendly academic assistant for college students and faculty. "
            "Explain concepts clearly, concisely, and help with coursework, programming, mathematics, and science."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ]

    return await _execute_query_pipeline(messages, context=truncated_context, question=question, is_rag=False, temperature=0.6)
