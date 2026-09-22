import aiosmtplib
from email.message import EmailMessage
from app.config import get_settings

settings = get_settings()

async def send_email(to: str, subject: str, body: str):
    print(f"[GMAIL VERIFY] Sending to: {to} | Subject: {subject} | Content: {body}")
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        print(f"[GMAIL VERIFY NOTICE] EMAIL_HOST_USER / EMAIL_HOST_PASSWORD not configured. Check OTP above.")
        return True

    message = EmailMessage()
    message["From"] = settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    try:
        await aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.EMAIL_HOST_USER,
            password=settings.EMAIL_HOST_PASSWORD,
            timeout=10
        )
        print(f"[GMAIL VERIFY SUCCESS] Email successfully delivered to {to}")
        return True
    except Exception as e:
        print(f"[GMAIL VERIFY WARNING] Gmail SMTP error ({e}). OTP for {to} is in server log above.")
        return False

