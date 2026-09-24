import asyncio
import os
import boto3
from app.config import get_settings

settings = get_settings()

def _is_s3_configured() -> bool:
    return bool(settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and settings.S3_BUCKET_NAME)

def _get_s3_client():
    return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )

async def generate_presigned_upload_url(s3_key: str, content_type: str, expires_in: int = 3600) -> str:
    if not _is_s3_configured():
        return ""
    loop = asyncio.get_event_loop()
    def _generate():
        try:
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
        except Exception as e:
            print(f"[S3] Failed to generate presigned upload url: {e}")
            return ""
    return await loop.run_in_executor(None, _generate)

async def generate_presigned_download_url(s3_key: str, expires_in: int = 86400) -> str:
    if not _is_s3_configured():
        return ""
    loop = asyncio.get_event_loop()
    def _generate():
        try:
            s3 = _get_s3_client()
            return s3.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.S3_BUCKET_NAME,
                    'Key': s3_key
                },
                ExpiresIn=expires_in
            )
        except Exception as e:
            print(f"[S3] Failed to generate presigned download url: {e}")
            return ""
    return await loop.run_in_executor(None, _generate)

async def delete_object(s3_key: str):
    # Also remove local copy if exists
    for base_dir in ["/app/data", "./backend/data", "./data", "."]:
        local_path = os.path.join(base_dir, s3_key)
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass

    if not _is_s3_configured():
        return
    loop = asyncio.get_event_loop()
    def _delete():
        try:
            s3 = _get_s3_client()
            s3.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        except Exception as e:
            print(f"[S3] Delete object notice: {e}")
    await loop.run_in_executor(None, _delete)

async def upload_file_bytes(s3_key: str, file_bytes: bytes, content_type: str = "application/octet-stream") -> str:
    # 1. Save local copy first for guaranteed persistence
    for base_dir in ["/app/data", "./backend/data", "./data"]:
        try:
            local_target = os.path.join(base_dir, s3_key)
            os.makedirs(os.path.dirname(local_target), exist_ok=True)
            with open(local_target, "wb") as f:
                f.write(file_bytes)
            break
        except Exception:
            pass

    # 2. Upload to S3 if configured
    if not _is_s3_configured():
        return s3_key

    loop = asyncio.get_event_loop()
    def _upload():
        try:
            s3 = _get_s3_client()
            s3.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type
            )
        except Exception as e:
            print(f"[S3] Direct upload notice: {e}")
    await loop.run_in_executor(None, _upload)
    return s3_key

async def download_file_bytes(s3_key: str) -> bytes:
    # 1. First check local persistent storage
    for base_dir in ["/app/data", "./backend/data", "./data", "."]:
        local_path = os.path.join(base_dir, s3_key)
        if os.path.exists(local_path) and os.path.isfile(local_path):
            with open(local_path, "rb") as f:
                return f.read()

    # 2. If not local, fetch from S3
    if not _is_s3_configured():
        raise FileNotFoundError(f"File {s3_key} not found locally and S3 is not configured.")

    loop = asyncio.get_event_loop()
    def _download():
        s3 = _get_s3_client()
        response = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        return response['Body'].read()
    return await loop.run_in_executor(None, _download)
