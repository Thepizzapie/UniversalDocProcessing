FROM python:3.13.7-slim

# Set working directory
WORKDIR /app

# Install system packages needed for OCR (Tesseract and Poppler for PDF processing)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.txt

# Expose port for the FastAPI service
EXPOSE 8080

# Environment defaults for OCR/LLM providers
ENV OCR_PROVIDER=tesseract \
    LLM_PROVIDER=openai \
    MODEL_NAME=gpt-5

# Launch the application
CMD ["uvicorn", "service.api:app", "--host", "0.0.0.0", "--port", "8080"]