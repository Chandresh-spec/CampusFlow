"""
Background worker that polls AWS SQS for tasks (e.g., PDF text extraction and RAG indexing).
Can be run via: python -m app.worker
"""

import asyncio
import json
import logging
from app.services import sqs_service, s3_service, rag_service
from app.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("worker")
settings = get_settings()

async def process_message(message: dict):
    body_str = message.get("Body", "{}")
    receipt_handle = message.get("ReceiptHandle")
    try:
        data = json.loads(body_str)
        action = data.get("action")
        logger.info(f"Processing task action: {action}")

        if action == "index_pdf":
            s3_key = data.get("s3_key")
            subject_id = str(data.get("subject_id"))
            if s3_key and subject_id:
                logger.info(f"Downloading PDF from S3: {s3_key} for subject {subject_id}")
                pdf_bytes = await s3_service.download_file_bytes(s3_key)
                logger.info(f"Indexing PDF ({len(pdf_bytes)} bytes) into vector store...")
                await rag_service.index_document(subject_id, pdf_bytes)
                logger.info(f"Successfully indexed {s3_key}")
            else:
                logger.warning(f"Missing s3_key or subject_id in message payload: {data}")

        # Delete message from SQS upon successful processing
        if receipt_handle:
            await sqs_service.delete_message(receipt_handle)
            logger.info("Message deleted from SQS queue.")

    except Exception as e:
        logger.error(f"Error processing SQS message: {e}", exc_info=True)

async def poll_sqs_loop():
    logger.info("Starting SQS worker polling loop...")
    while True:
        try:
            if not settings.SQS_QUEUE_URL:
                # If no queue URL configured, sleep and retry
                await asyncio.sleep(10)
                continue

            messages = await sqs_service.receive_messages(max_messages=5, wait_time=10)
            if messages:
                logger.info(f"Received {len(messages)} message(s) from SQS.")
                for msg in messages:
                    await process_message(msg)
            else:
                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Polling loop exception: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(poll_sqs_loop())
