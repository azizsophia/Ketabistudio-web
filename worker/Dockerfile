FROM python:3.11-slim
# Unbuffered stdout so all worker logs (incl. [prodigi] errors) show in Render.
ENV PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Headless Chromium for rendering the "I Am [Child]" HTML book to print PDF.
RUN python -m playwright install --with-deps chromium
COPY worker/ /app/
COPY public/images /public/images
# The "I Am [Child]" print templates are the SAME files the website renders for
# the live preview (single source of truth), served from public/iam.
COPY public/iam /public/iam
CMD ["python", "worker.py"]
