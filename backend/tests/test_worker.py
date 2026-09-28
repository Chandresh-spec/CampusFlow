import json
import pytest
from app import worker
from app.services import rag_service, s3_service, sqs_service


@pytest.mark.asyncio
async def test_worker_process_index_pdf(monkeypatch):
    indexed_records = []
    deleted_handles = []

    async def fake_download(s3_key: str):
        return b"%PDF-1.4 Fake PDF Data for indexing"

    async def fake_index(subject_id: str, pdf_bytes: bytes):
        indexed_records.append({"subject_id": subject_id, "size": len(pdf_bytes)})

    async def fake_delete(receipt_handle: str):
        deleted_handles.append(receipt_handle)

    monkeypatch.setattr(s3_service, "download_file_bytes", fake_download)
    monkeypatch.setattr(rag_service, "index_document", fake_index)
    monkeypatch.setattr(sqs_service, "delete_message", fake_delete)

    message = {
        "Body": json.dumps({
            "action": "index_pdf",
            "s3_key": "resources/sample_unit1.pdf",
            "subject_id": "1",
            "resource_id": 10
        }),
        "ReceiptHandle": "receipt-token-12345"
    }

    await worker.process_message(message)

    assert len(indexed_records) == 1
    assert indexed_records[0]["subject_id"] == "1"
    assert len(deleted_handles) == 1
    assert deleted_handles[0] == "receipt-token-12345"


@pytest.mark.asyncio
async def test_worker_process_invalid_json():
    # Should handle gracefully without crashing
    message = {
        "Body": "INVALID_JSON",
        "ReceiptHandle": "token-xyz"
    }
    await worker.process_message(message)


@pytest.mark.asyncio
async def test_worker_process_unknown_action():
    message = {
        "Body": json.dumps({"action": "unknown_action_test"}),
        "ReceiptHandle": "token-abc"
    }
    await worker.process_message(message)
