from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.seed import seed_database
from app.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist and seed demo accounts if empty
    Base.metadata.create_all(bind=engine)
    seed_database(reset=False)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="FastAPI Backend for Offline Payment System with Double-Spend Protection, ECDSA P-256 Signatures, and Idempotent Settlement.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all API endpoints under /api
app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs",
        "redoc_url": "/redoc"
    }
