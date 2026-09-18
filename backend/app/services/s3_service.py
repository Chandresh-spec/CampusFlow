import asyncio
import boto3
from app.config import get_settings

settings = get_settings()

def _get_s3_client():
    return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )

async def generate_presigned_upload_url(s3_key: str, content_type: str, expires_in: int = 3600) -> str:
    loop = asyncio.get_event_loop()
    def _generate():
        s3 = _get_s3_client()
        return s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': s3_key,
                'ContentType': content_type
            },
            ExpiresIn=expires_in
        )
    return await loop.run_in_executor(None, _generate)

async def generate_presigned_download_url(s3_key: str, expires_in: int = 3600) -> str:
    loop = asyncio.get_event_loop()
    def _generate():
        s3 = _get_s3_client()
        return s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': s3_key
            },
            ExpiresIn=expires_in
        )
    return await loop.run_in_executor(None, _generate)

async def delete_object(s3_key: str):
    loop = asyncio.get_event_loop()
    def _delete():
        s3 = _get_s3_client()
        s3.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    await loop.run_in_executor(None, _delete)

async def upload_file_bytes(s3_key: str, file_bytes: bytes, content_type: str = "application/octet-stream") -> str:
    loop = asyncio.get_event_loop()
    def _upload():
        s3 = _get_s3_client()
        s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type
        )
    await loop.run_in_executor(None, _upload)
    return s3_key

async def download_file_bytes(s3_key: str) -> bytes:
    loop = asyncio.get_event_loop()
    def _download():
        s3 = _get_s3_client()
        response = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        return response['Body'].read()
    return await loop.run_in_executor(None, _download)

