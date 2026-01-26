FROM python:3.11-slim

ARG GIT_SHA=dev
ARG BUILD_TS=dev

ENV GIT_SHA=${GIT_SHA}
ENV BUILD_TS=${BUILD_TS}

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_DEFAULT_TIMEOUT=120

WORKDIR /app

COPY services/tax-engine/requirements.txt ./requirements.txt

RUN python -m pip install --upgrade pip \
 && python -m pip install --no-cache-dir --retries 5 -r requirements.txt

COPY services/tax-engine /app

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
