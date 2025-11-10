FROM python:3.12-slim

WORKDIR /app

COPY services/ml-service/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/ml-service/app ./app
COPY artifacts/models /artifacts/models

ENV PYTHONPATH=/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
