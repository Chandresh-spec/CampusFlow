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
