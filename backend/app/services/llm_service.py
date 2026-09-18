import asyncio
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()

FALLBACK_MODELS = [
    "meta-llama/Llama-3.2-3B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "deepseek-ai/DeepSeek-V4-Pro:novita",
]

def _get_client():
    key = settings.HUGGINGFACE_API_KEY or "none"
    return AsyncOpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=key,
    )

async def ask_llm(context: str, question: str) -> str:
    api_key = (settings.HUGGINGFACE_API_KEY or "").strip()
    if not api_key or api_key.startswith("your-"):
        if context and context.strip():
            return (
                f"### Document Context (from RAG):\n\n{context[:1500]}\n\n"
                f"---\n*To enable generative AI responses, please add your free HUGGINGFACE_API_KEY to backend/.env.*"
            )
        return (
            f"Hello! I am your Smart College Assistant.\n\n"
            f"You asked: **{question}**\n\n"
            f"To enable live generative responses with Llama / DeepSeek models, please configure a valid `HUGGINGFACE_API_KEY` in `backend/.env`."
        )

    truncated_context = context[:5000] if context else ""
    client = _get_client()

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

    for model_name in FALLBACK_MODELS:
        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                max_tokens=800,
                temperature=0.7,
                timeout=20.0
            )
            content = response.choices[0].message.content
            if content and content.strip():
                return content.strip()
        except Exception as e:
            print(f"[LLM] Model {model_name} failed: {e}")
            await asyncio.sleep(0.5)

    if context and context.strip():
        return f"### Relevant Document Notes Found:\n\n{context[:1200]}"
    return "The AI service is currently unavailable. Please verify your HUGGINGFACE_API_KEY or try again shortly."
