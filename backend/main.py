"""FastAPI application exposing the document processing pipeline.

The application offers a single `/process` endpoint that accepts a file
upload and returns the output from :func:`document_processing.pipeline.run_pipeline`.
This lightweight service is sufficient for MVP usage and avoids the
complexity of the previous `der_pipeline` implementation.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException

from document_processing.pipeline import run_pipeline

app = FastAPI(title="Document Processing API")


@app.post("/process")
async def process_document(file: UploadFile = File(...)):
    """Process an uploaded document and return structured data.

    Parameters
    ----------
    file: UploadFile
        The document to process.  The content is read into memory and
        passed directly to :func:`run_pipeline`.
    """
    try:
        content = await file.read()
    except Exception as exc:  # pragma: no cover - I/O errors are rare in tests
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = run_pipeline(file=content)
    return result
