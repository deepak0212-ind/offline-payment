import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import { useNetwork } from '../context/NetworkContext';
import {
  getCachedBankPublicKey,
  checkAndRecordMerchantNonce,
  checkAndRecordMerchantCounter,
  addToSyncQueue,
  dbPut,
} from '../db/indexedDB';
import { verifySignature, signPayload, computeSha256Hex } from '../crypto/webCrypto';
import { ErrorMessage, StatusBadge } from '../components/UIComponents';
import {
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Receipt,
  Key,
  Cpu,
} from 'lucide-react';

export function ReceivePayment() {
  const { user } = useAuth();
  const { device, isRegistered } = useDevice();
  const { isOnline } = useNetwork();

  const [tokenInput, setTokenInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerifyAndAccept = async (e) => {
    e.preventDefault();
    setResult(null);
    setErrorMsg('');

    if (!tokenInput.trim()) {
      setErrorMsg('Please paste a payment token JSON bundle.');
      return;
    }

    if (!isRegistered || !device || !device.keyPair?.privateKey) {
      setErrorMsg('Merchant device key not registered in this browser. Please register in "Browser Device Key" first to sign receipts.');
      return;
    }

    let bundle;
    try {
      bundle = JSON.parse(tokenInput.trim());
    } catch (err) {
      setErrorMsg('Invalid token format: could not parse JSON. Please paste a valid token bundle.');
      return;
    }

    setVerifying(true);
    const checks = [];

    try {
      const { token_payload, token_signature, payer_public_key, certificate } = bundle;

      if (!token_payload || !token_signature || !payer_public_key || !certificate) {
        throw new Error('Malformed token bundle: missing required fields (payload, signature, public key, or certificate).');
      }

      // CHECK 1: Certificate Payload & Bank Signature
      const bankSpki = await getCachedBankPublicKey();
      let bankSigValid = false;
      if (bankSpki && certificate.signature && certificate.payload) {
        bankSigValid = await verifySignature(bankSpki, certificate.payload, certificate.signature);
      } else {
        console.warn('Bank public key not found in cache.');
      }

      checks.push({
        title: 'Bank Digital Signature on Certificate',
        passed: bankSigValid,
        detail: bankSigValid
          ? 'Cryptographically verified with Bank ECDSA P-256 key'
          : 'Failed: Bank signature invalid or bank public key unverified',
      });

      // CHECK 2: Certificate Expiration
      let certNotExpired = false;
      try {
        const certExpiry = new Date(certificate.payload.expires_at);
        certNotExpired = new Date() <= certExpiry;
      } catch (e) {
        certNotExpired = false;
      }
      checks.push({
        title: 'Allowance Certificate Expiration',
        passed: certNotExpired,
        detail: certNotExpired ? 'Certificate is within validity period' : 'Certificate has expired',
      });

      // CHECK 3: Token Expiration
      let tokenNotExpired = false;
      try {
        const tokenExpiry = new Date(token_payload.expires_at);
        tokenNotExpired = new Date() <= tokenExpiry;
      } catch (e) {
        tokenNotExpired = false;
      }
      checks.push({
        title: 'Payment Token Expiration Window',
        passed: tokenNotExpired,
        detail: tokenNotExpired ? 'Token is within validity period' : 'Payment token has expired',
      });

      // CHECK 4: Positive Amount
      const isPositive = token_payload.amount > 0;
      checks.push({
        title: 'Positive Authorized Amount',
        passed: isPositive,
        detail: isPositive ? `Amount is positive (${token_payload.amount} paise)` : 'Amount must be positive',
      });

      // CHECK 5: Per-Payment Limit
      const certLimit = certificate.payload?.max_per_payment || 0;
      const withinLimit = token_payload.amount <= certLimit;
      checks.push({
        title: 'Certificate Per-Payment Limit',
        passed: withinLimit,
        detail: withinLimit
          ? `₹${(token_payload.amount / 100).toFixed(2)} is within certificate limit of ₹${(certLimit / 100).toFixed(2)}`
          : `Amount exceeds certificate limit of ₹${(certLimit / 100).toFixed(2)}`,
      });

      // CHECK 6: Payee / Merchant ID Binding
      const myUsername = (user?.username || '').toLowerCase();
      const myId = String(user?.id || '');
      const tokenPayee = String(token_payload.payee_id || '').toLowerCase();
      const payeeMatches = tokenPayee === myUsername || tokenPayee === myId;
      checks.push({
        title: 'Payee Merchant Cryptographic Binding',
        passed: payeeMatches,
        detail: payeeMatches
          ? `Token payee '${token_payload.payee_id}' matches this merchant terminal`
          : `Mismatch: Token payee '${token_payload.payee_id}' does not match your merchant identifier`,
      });

      // CHECK 7: Certificate & Payer Device Association
      const deviceMatches = certificate.payload?.device_id === token_payload.payer_device_id;
      checks.push({
        title: 'Allowance & Device Key Association',
        passed: deviceMatches,
        detail: deviceMatches
          ? 'Certificate device matches payer device identity'
          : 'Certificate was issued to a different device',
      });

      // CHECK 8: Payer Signature on Payment Token
      const tokenSigValid = await verifySignature(payer_public_key, token_payload, token_signature);
      checks.push({
        title: 'Payer ECDSA Digital Signature on Token',
        passed: tokenSigValid,
        detail: tokenSigValid
          ? 'Cryptographically verified with payer device public key'
          : 'Failed: Token signature does not match canonical payload or key',
      });

      // CHECK 9: Local Nonce Replay Check
      const nonceCheck = await checkAndRecordMerchantNonce(token_payload.nonce, token_payload.transaction_id);
      checks.push({
        title: 'Local Nonce Replay Protection',
        passed: nonceCheck.valid,
        detail: nonceCheck.valid
          ? 'Nonce has not been previously accepted on this terminal'
          : nonceCheck.message,
      });

      // CHECK 10: Strictly Increasing Counter Check
      const counterCheck = await checkAndRecordMerchantCounter(token_payload.payer_device_id, token_payload.counter);
      checks.push({
        title: 'Strictly Increasing Counter Sequence',
        passed: counterCheck.valid,
        detail: counterCheck.valid
          ? `Counter #${token_payload.counter} is strictly higher than previous sequence (${counterCheck.previous_counter})`
          : counterCheck.message,
      });

      // Overall Acceptance
      const allPassed = checks.every((c) => c.passed);

      if (allPassed) {
        const tokenHash = await computeSha256Hex(token_payload);
        const acceptedAt = new Date().toISOString();

        const receiptPayload = {
          transaction_id: token_payload.transaction_id,
          token_hash: tokenHash,
          merchant_id: String(user.id),
          merchant_device_id: device.device_id,
          amount: token_payload.amount,
          accepted_at: acceptedAt,
        };

        const receiptSignature = await signPayload(device.keyPair.privateKey, receiptPayload);

        const signedReceipt = {
          ...receiptPayload,
          receipt_signature: receiptSignature,
        };

        await addToSyncQueue({
          transaction_id: token_payload.transaction_id,
          token_payload,
          token_signature,
          payer_public_key,
          certificate,
          receipt: signedReceipt,
          local_status: 'ACCEPTED_OFFLINE',
          created_at: acceptedAt,
        });

        await dbPut('merchant_receipts', {
          transaction_id: token_payload.transaction_id,
          receipt: signedReceipt,
          token_payload,
          accepted_at: acceptedAt,
        });

        setResult({
          status: 'ACCEPTED',
          amount: token_payload.amount,
          transaction_id: token_payload.transaction_id,
          receipt: signedReceipt,
          checks,
        });
      } else {
        setResult({
          status: 'REJECTED',
          amount: token_payload.amount,
          transaction_id: token_payload.transaction_id,
          checks,
        });
      }
    } catch (err) {
      console.error('Verification failed:', err);
      setErrorMsg(err.message || 'Verification process encountered an unhandled error.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="page-container">
      {/* Title Header */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">MERCHANT POINT-OF-SALE TERMINAL</p>
            <h1>
              <ArrowDownLeft size={28} style={{ color: 'var(--success)' }} />
              <span>Receive & Verify Payment</span>
            </h1>
            <p>Execute client-side 10-point cryptographic verification and generate digitally signed receipts offline.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <span className="badge badge-settled">
              <ShieldCheck size={13} />
              <span>10-Point Guard Active</span>
            </span>
            <span className={`badge ${isOnline ? 'badge-settled' : 'badge-pending'}`}>
              {isOnline ? 'Bank Gateway Online' : 'Air-Gapped Terminal'}
            </span>
          </div>
        </div>
      </div>

      <ErrorMessage error={errorMsg} />

      <div className="grid-2">
        {/* Token Ingestion Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Key size={18} style={{ color: 'var(--accent)' }} />
              <span>Token Ingestion</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>INPUT BUNDLE</span>
          </div>

          <form onSubmit={handleVerifyAndAccept}>
            <div className="form-group">
              <label className="form-label">Customer Payment Token Bundle (JSON)</label>
              <textarea
                className="form-control font-mono"
                rows={10}
                placeholder='Paste token JSON bundle from customer ({"token_payload": ...})'
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                required
                style={{ fontSize: '0.8rem' }}
              />
              <div className="form-helper">
                The terminal performs full mathematical verification of ECDSA P-256 signatures, nonce freshness, and strictly monotonic counters locally.
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={verifying || !tokenInput.trim() || !isRegistered}
            >
              {verifying ? (
                <span>Executing 10-Point Verification...</span>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Verify & Provisionally Accept</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Verification Engine Outcome */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Cpu size={18} style={{ color: 'var(--accent)' }} />
              <span>Verification Engine Telemetry</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OUTCOME</span>
          </div>

          {result ? (
            <div>
              {/* Acceptance Banner */}
              {result.status === 'ACCEPTED' ? (
                <div
                  style={{
                    background: 'var(--success-bg)',
                    border: '1px solid var(--success-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.4rem',
                    marginBottom: '1.4rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--success-text)', marginBottom: '0.4rem' }}>
                    <CheckCircle size={24} />
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      PAYMENT ACCEPTED (PROVISIONAL)
                    </span>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.35rem 0' }}>
                    ₹{(result.amount / 100).toFixed(2)}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--success-text)', lineHeight: 1.5 }}>
                    Token authenticity, device binding, and counter sequence verified locally. Final bank ledger settlement will occur upon network sync.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.4rem',
                    marginBottom: '1.4rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--danger-text)', marginBottom: '0.4rem' }}>
                    <XCircle size={24} />
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      PAYMENT REJECTED
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--danger-text)' }}>
                    One or more cryptographic validation checks failed. Transaction has been aborted locally to prevent financial loss.
                  </p>
                </div>
              )}

              {/* 10-Point Checklist */}
              <div style={{ marginBottom: '1.4rem' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  10-Point Cryptographic Guard Results
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.6rem' }}>
                  {result.checks.map((chk, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.65rem',
                        fontSize: '0.83rem',
                        padding: '0.55rem 0.8rem',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {chk.passed ? (
                        <CheckCircle size={16} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
                      ) : (
                        <XCircle size={16} style={{ color: 'var(--danger)', marginTop: '2px', flexShrink: 0 }} />
                      )}
                      <div>
                        <strong style={{ color: chk.passed ? 'var(--text-main)' : 'var(--danger-text)' }}>{chk.title}</strong>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{chk.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Digitally Signed Merchant Receipt */}
              {result.receipt && (
                <div
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    padding: '1.15rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
                    <Receipt size={17} style={{ color: 'var(--primary)' }} />
                    <span>Digitally Signed Merchant Receipt</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    <div>
                      Receipt Signature:{' '}
                      <span className="font-mono" style={{ color: 'var(--accent)' }}>
                        {result.receipt.receipt_signature.slice(0, 28)}...
                      </span>
                    </div>
                    <div>
                      SHA-256 Token Digest:{' '}
                      <span className="font-mono" style={{ color: '#ffffff' }}>
                        {result.receipt.token_hash.slice(0, 28)}...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '4.5rem 1.5rem',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.03)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-dim)',
                  border: '1px dashed var(--border-medium)',
                }}
              >
                <Receipt size={32} />
              </div>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Terminal Ready for Verification</strong>
              <p style={{ maxWidth: '340px', fontSize: '0.84rem' }}>
                Paste the customer's offline token bundle into the left pane to execute full cryptographic validation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReceivePayment;
