"""
API package aggregating all route handlers under a unified router.
"""
from fastapi import APIRouter
from app.routers.auth import router as auth_router
from app.routers.devices import router as devices_router
from app.routers.wallet import router as wallet_router
from app.routers.certificates import router as certificates_router
from app.routers.transactions import router as transactions_router
from app.routers.risk import router as risk_router
from app.routers.disputes import router as disputes_router
from app.routers.analyst import router as analyst_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(devices_router)
api_router.include_router(wallet_router)
api_router.include_router(certificates_router)
api_router.include_router(transactions_router)
api_router.include_router(risk_router)
api_router.include_router(disputes_router)
api_router.include_router(analyst_router)

__all__ = ["api_router"]
