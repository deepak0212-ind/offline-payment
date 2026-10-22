import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { getSyncQueue } from '../db/indexedDB';
import { StatusBadge, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import {
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Key,
  FileQuestion,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';

export function TransactionDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      setErrorMsg('');
      try {
        if (isOnline) {
          try {
            const res = await apiService.getTransactionDetails(id);
            setTx(res.data);
            return;
          } catch (e) {
            console.warn('Server fetch failed, checking local storage:', e);
          }
        }

        const queue = await getSyncQueue();
        const local = queue.find((q) => q.transaction_id === id);
        const payload = local?.token_payload || {};
        const canViewLocal =
          local &&
          user &&
          (user.role === 'merchant'
            ? String(payload.payee_id) === String(user.id) ||
              String(payload.payee_id) === user.username
            : String(payload.payer_user_id) === String(user.id) ||
              String(payload.payee_id) === String(user.id) ||
              String(payload.payee_id) === user.username);

        if (canViewLocal) {
          setTx({
            transaction_id: local.transaction_id,
            certificate_id: local.token_payload?.certificate_id,
            payer: { id: local.token_payload?.payer_user_id, username: 'Local Payer' },
            payee: { id: local.token_payload?.payee_id, username: String(local.token_payload?.payee_id) },
            payer_device_id: local.token_payload?.payer_device_id,
            amount: local.token_payload?.amount,
            nonce: local.token_payload?.nonce,
            counter: local.token_payload?.counter,
            status: local.local_status,
            flag_reason: local.flag_reason || null,
            issued_at: local.token_payload?.issued_at,
            expires_at: local.token_payload?.expires_at,
            created_at: local.created_at,
            settled_at: local.synced_at || null,
            evidence: {
              token_signature: local.token_signature,
              raw_token_json: JSON.stringify(local.token_payload, null, 2),
              payer_public_key: local.payer_public_key,
            },
            receipt: local.receipt || null,
          });
        } else {
          setErrorMsg('Transaction details not found on server or local IndexedDB storage.');
        }
      } catch (err) {
        setErrorMsg('Failed to load transaction details.');
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [id, isOnline]);

  const handleCopyRawJson = () => {
    if (tx?.evidence?.raw_token_json) {
      navigator.clipboard.writeText(tx.evidence.raw_token_json);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    }
  };

  if (loading) return <LoadingSpinner message="Reconstructing cryptographic audit evidence..." />;
  if (errorMsg) {
    return (
      <div className="page-container">
        <ErrorMessage error={errorMsg} />
        <Link to="/history" className="btn btn-outline" style={{ marginTop: '1rem' }}>
          <ArrowLeft size={16} /> Back to History
        </Link>
      </div>
    );
  }
  if (!tx) return null;

  return (
    <div className="page-container">
      {/* Top Nav Buttons */}
      <div style={{ marginBottom: '1.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/history" className="btn btn-sm btn-outline">
          <ArrowLeft size={16} />
          <span>Back to Ledger</span>
        </Link>

        {user?.role !== 'analyst' && tx.status !== 'REJECTED' && (
          <Link to={`/dispute/${tx.transaction_id}`} className="btn btn-sm btn-outline">
            <FileQuestion size={16} />
            <span>Raise Dispute / Claim</span>
          </Link>
        )}
      </div>

      {/* Main Forensic Header Card */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <span className="eyebrow">CRYPTOGRAPHIC PROOF CERTIFICATE</span>
            <div
              style={{
                fontSize: '2.4rem',
                fontWeight: 800,
                color: '#ffffff',
                marginTop: '0.2rem',
                letterSpacing: '-0.04em',
              }}
            >
              ₹{(tx.amount / 100).toFixed(2)}{' '}
              <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                ({tx.amount.toLocaleString()} paise)
              </span>
            </div>
            <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <StatusBadge status={tx.status} />
              <span className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>
                REF: {tx.transaction_id}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Created At:
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
              {new Date(tx.created_at).toLocaleString()}
            </div>
            {tx.settled_at && (
              <div style={{ fontSize: '0.8rem', color: '#34d399', marginTop: '0.35rem', fontWeight: 600 }}>
                Settled on Bank Ledger: {new Date(tx.settled_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Security Flag Alert Banner */}
        {tx.flag_reason && (
          <div
            className="alert alert-danger"
            style={{ marginTop: '1.5rem', marginBottom: 0, border: '1px solid rgba(244, 63, 94, 0.4)' }}
          >
            <AlertTriangle size={22} style={{ flexShrink: 0 }} />
            <div>
              <strong>Security Protocol Anomaly Detected:</strong>
              <div style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>{tx.flag_reason}</div>
            </div>
          </div>
        )}
      </div>

      {/* Protocol State & Merchant Receipt Grid */}
      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        {/* Parties & Sequence */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
              <span>Identity & Protocol State</span>
            </span>
            <span className="badge badge-provisional">STATE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payer Identity:</span>
              <strong style={{ color: '#ffffff' }}>{tx.payer?.username || `User #${tx.payer_user_id || 'N/A'}`}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payee (Merchant):</span>
              <strong style={{ color: '#ffffff' }}>{tx.payee?.username || `User #${tx.payee_user_id || 'N/A'}`}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payer Device ID:</span>
              <span className="font-mono" style={{ color: 'var(--accent)' }}>{tx.payer_device_id}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Allowance Certificate:</span>
              <span className="font-mono">{tx.certificate_id}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Strict Monotonic Counter:</span>
              <strong style={{ color: '#ffffff' }}>#{tx.counter}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Freshness Nonce:</span>
              <span className="font-mono" style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{tx.nonce}</span>
            </div>
          </div>
        </div>

        {/* Merchant Signed Receipt */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Receipt size={18} style={{ color: 'var(--success)' }} />
              <span>Merchant Receipt Evidence</span>
            </span>
            <span className="badge badge-settled">SIGNED</span>
          </div>

          {tx.receipt ? (
            <div style={{ fontSize: '0.86rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 700, marginBottom: '0.85rem' }}>
                <ShieldCheck size={18} />
                <span>Signed with Merchant Registered Private Key</span>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Token SHA-256 Digest</label>
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                  }}
                  className="font-mono"
                >
                  {tx.receipt.token_hash}
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Merchant Receipt Signature (ECDSA P-256)</label>
                <textarea
                  className="form-control font-mono"
                  rows={2}
                  value={tx.receipt.receipt_signature || ''}
                  readOnly
                  style={{ fontSize: '0.74rem', resize: 'none' }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Terminal:{' '}
                <span className="font-mono" style={{ color: 'var(--accent)' }}>
                  {tx.receipt.merchant_device_id}
                </span>{' '}
                • Accepted: {new Date(tx.receipt.accepted_at).toLocaleString()}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              <Receipt size={36} style={{ color: 'var(--text-dim)', marginBottom: '0.75rem' }} />
              <p>No merchant receipt attached (Token uploaded directly by customer or synced before receipt was generated).</p>
            </div>
          )}
        </div>
      </div>

      {/* Raw Cryptographic Evidence & JSON Payload */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Key size={18} style={{ color: 'var(--primary)' }} />
            <span>Cryptographic Digital Signatures & Raw Payload</span>
          </span>
          <button
            type="button"
            onClick={handleCopyRawJson}
            className="btn btn-sm btn-outline"
            style={{ gap: '0.45rem' }}
          >
            {copiedJson ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
            <span>{copiedJson ? 'Copied Payload!' : 'Copy Canonical JSON'}</span>
          </button>
        </div>

        {tx.evidence ? (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Payer Digital Signature (ECDSA P-256 SHA-256 Base64)</label>
              <textarea
                className="form-control font-mono"
                rows={2}
                value={tx.evidence.token_signature || ''}
                readOnly
                style={{ fontSize: '0.76rem', resize: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Payer Public Key (SubjectPublicKeyInfo DER Base64)</label>
              <textarea
                className="form-control font-mono"
                rows={2}
                value={tx.evidence.payer_public_key || ''}
                readOnly
                style={{ fontSize: '0.76rem', resize: 'none' }}
              />
            </div>

            <div>
              <label className="form-label">Canonical Token Payload (JSON)</label>
              <pre
                style={{
                  padding: '1rem 1.25rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.82rem',
                  overflowX: 'auto',
                  color: 'var(--text-main)',
                }}
              >
                {tx.evidence.raw_token_json}
              </pre>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            No raw token evidence payload available.
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionDetails;
