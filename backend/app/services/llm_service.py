import asyncio
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()

client = AsyncOpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=settings.HUGGINGFACE_API_KEY,
)

async def ask_llm(context: str, question: str) -> str:
    truncated_context = context[:6000]
    
    system_prompt = "You are a helpful AI assistant. Answer the user's question using the provided context."
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context:\n{truncated_context}\n\nQuestion:\n{question}"}
    ]
    
    for attempt in range(2):
        try:
            response = await client.chat.completions.create(
                model="deepseek-ai/DeepSeek-V4-Pro:novita",
                messages=messages,
            )
            return response.choices[0].message.content
        except Exception as e:
            if attempt == 1:
                raise e
            await asyncio.sleep(1)
