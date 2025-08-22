from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .db import init_db
from .routers import fetch, finalize, hil, ingest, reconcile, reports

app = FastAPI(title="UniversalDocProcessing")
app.include_router(ingest.router)
app.include_router(hil.router)
app.include_router(fetch.router)
app.include_router(reconcile.router)
app.include_router(finalize.router)
app.include_router(reports.router)
app.mount("/hil_ui", StaticFiles(directory="web/hil_ui", html=True), name="hil_ui")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
