import aiosmtplib
from email.message import EmailMessage
from app.config import get_settings

settings = get_settings()

async def send_email(to: str, subject: str, body: str):
    message = EmailMessage()
    message["From"] = settings.DEFAULT_FROM_EMAIL
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    await aiosmtplib.send(
        message,
        hostname="smtp.gmail.com",
        port=587,
        start_tls=True,
        username=settings.EMAIL_HOST_USER,
        password=settings.EMAIL_HOST_PASSWORD,
    )
