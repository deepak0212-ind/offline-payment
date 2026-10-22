"""
Models package compatibility layer.
Re-exports all database models from app.db_models for backward compatibility and clean modular imports.
"""
from app.db_models import (
    Base,
    utc_now,
    RiskTier,
    User,
    Wallet,
    Device,
    Reserve,
    AllowanceCertificate,
    Transaction,
    TokenEvidence,
    Receipt,
    LedgerEntry,
    Settlement,
    Dispute,
    AuditLog,
)

__all__ = [
    "Base",
    "utc_now",
    "RiskTier",
    "User",
    "Wallet",
    "Device",
    "Reserve",
    "AllowanceCertificate",
    "Transaction",
    "TokenEvidence",
    "Receipt",
    "LedgerEntry",
    "Settlement",
    "Dispute",
    "AuditLog",
]
