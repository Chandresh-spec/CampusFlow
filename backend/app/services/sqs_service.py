import asyncio
import boto3
import json
from app.config import get_settings

settings = get_settings()

def _get_sqs_client():
    return boto3.client(
        'sqs',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )

async def send_message(message_body: dict):
    if not settings.SQS_QUEUE_URL:
        print("[SQS] Warning: SQS_QUEUE_URL not configured. Skipping queue message.")
        return
    loop = asyncio.get_event_loop()
    def _send():
        sqs = _get_sqs_client()
        sqs.send_message(
            QueueUrl=settings.SQS_QUEUE_URL,
            MessageBody=json.dumps(message_body)
        )
    await loop.run_in_executor(None, _send)

async def receive_messages(max_messages: int = 10, wait_time: int = 5) -> list[dict]:
    if not settings.SQS_QUEUE_URL:
        return []
    loop = asyncio.get_event_loop()
    def _receive():
        sqs = _get_sqs_client()
        response = sqs.receive_message(
            QueueUrl=settings.SQS_QUEUE_URL,
            MaxNumberOfMessages=max_messages,
            WaitTimeSeconds=wait_time
        )
        return response.get('Messages', [])
    return await loop.run_in_executor(None, _receive)

async def delete_message(receipt_handle: str):
    if not settings.SQS_QUEUE_URL:
        return
    loop = asyncio.get_event_loop()
    def _delete():
        sqs = _get_sqs_client()
        sqs.delete_message(
            QueueUrl=settings.SQS_QUEUE_URL,
            ReceiptHandle=receipt_handle
        )
    await loop.run_in_executor(None, _delete)
