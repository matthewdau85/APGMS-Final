from __future__ import annotations

import os

import uvicorn


def run() -> None:
    uvicorn.run(
        "app:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        reload=os.environ.get("RELOAD", "false").lower() == "true",
        factory=False,
    )


if __name__ == "__main__":
    run()
