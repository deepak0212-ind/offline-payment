import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import { useNetwork } from '../context/NetworkContext';
import { getAllCertificates, saveCertificate, addToSyncQueue } from '../db/indexedDB';
import { signPayload } from '../crypto/webCrypto';
import { apiService } from '../api/client';
import { ErrorMessage } from '../components/UIComponents';
import {
  ArrowUpRight,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  Zap,
  CheckCircle2,
  Cpu,
} from 'lucide-react';

export function Pay() {
  const { user } = useAuth();
  const { device, isRegistered, registerDevice, getNextCounter } = useDevice();
  const { isOnline } = useNetwork();

  const [certificates, setCertificates] = useState([]);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [payeeId, setPayeeId] = useState('merchant');
  const [amountInput, setAmountInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [generatedToken, setGeneratedToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickSettingUp, setQuickSettingUp] = useState(false);
  const [certsLoading, setCertsLoading] = useState(true);

  const loadSeqRef = useRef(0);

  useEffect(() => {
    loadCerts();
  }, [isOnline, device?.device_id]);

  async function loadCerts(preferredDeviceId) {
    const seq = ++loadSeqRef.current;
    try {
      let certs = await getAllCertificates();
      if (seq !== loadSeqRef.current) return;

      if (isOnline) {
        try {
          const serverRes = await apiService.getCertificates();
          if (seq !== loadSeqRef.current) return;
          const serverCerts = serverRes.data || [];
          for (const sc of serverCerts) {
            const payload = JSON.parse(sc.raw_payload_json);
            await saveCertificate({
              certificate_id: sc.certificate_id,
              payload,
              signature: sc.signature,
              remaining_amount: sc.reserve_amount,
            });
          }
          if (serverCerts.length > 0) {
            certs = await getAllCertificates();
          }
        } catch (e) {
          console.warn('Could not sync certificates from server:', e);
        }
      }

      if (seq !== loadSeqRef.current) return;
      setCertificates(certs || []);

      const devId = preferredDeviceId || device?.device_id;
      if (certs && certs.length > 0) {
        const match = certs.slice().reverse().find((c) => devId && c.payload?.device_id === devId);
        setSelectedCertId(match ? match.certificate_id : certs[certs.length - 1].certificate_id);
      }
    } catch (e) {
      console.error('Error loading certificates from IndexedDB:', e);
    } finally {
      if (seq === loadSeqRef.current) {
        setCertsLoading(false);
      }
    }
  }

  const handleQuickSetup = async () => {
    if (quickSettingUp) return;
    setQuickSettingUp(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let activeDev = device;
      if (!isRegistered || !activeDev) {
        activeDev = await registerDevice('Browser Device');
      }

      const reserveRes = await apiService.createReserve(50000, activeDev.device_id);
      const createdReserve = reserveRes.data;
      const cert = createdReserve.certificate;

      if (cert) {
        const certPayload = JSON.parse(cert.raw_payload_json);
        await saveCertificate({
          certificate_id: cert.certificate_id,
          payload: certPayload,
          signature: cert.signature,
          remaining_amount: cert.reserve_amount,
        });
      }

      setSuccessMsg('Setup complete! Created browser key and issued signed ₹500 allowance certificate.');
      await loadCerts(activeDev.device_id);
      if (cert) {
        setSelectedCertId(cert.certificate_id);
      }
    } catch (err) {
      console.error('Quick setup error:', err);
      setErrorMsg(err.response?.data?.detail || err.message || 'Quick setup failed.');
    } finally {
      setQuickSettingUp(false);
    }
  };

  const activeCert = certificates.find((c) => c.certificate_id === selectedCertId);
  const maxPerPayment = activeCert ? activeCert.payload?.max_per_payment || 0 : 0;
  const reserveAmount = activeCert ? activeCert.payload?.reserve_amount || 0 : 0;
  const isDeviceMatch = Boolean(activeCert && device && activeCert.payload?.device_id === device.device_id);
  const boundCerts = certificates.filter(
    (c) => Boolean(device?.device_id && c.payload?.device_id === device.device_id)
  );
  const hasBoundCert = boundCerts.length > 0;
  const showQuickSetup = !certsLoading && (!hasBoundCert || !isDeviceMatch);

  const handlePresetAmount = (inr) => {
    setAmountInput(String(inr));
  };

  const handleGeneratePayment = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setGeneratedToken(null);
    setCopied(false);

    if (!isRegistered || !device || !device.keyPair?.privateKey) {
      setErrorMsg('No active device private key found in this browser. Please register your device key first.');
      return;
    }

    if (!activeCert) {
      setErrorMsg('Please select a valid offline allowance certificate or use 1-Click Setup.');
      return;
    }

    if (activeCert.payload?.device_id && activeCert.payload.device_id !== device.device_id) {
      setErrorMsg(
        `Device Mismatch: Selected certificate belongs to device "${activeCert.payload.device_id}". Use 1-Click Setup to create a certificate bound to this active browser.`
      );
      return;
    }

    const inr = parseFloat(amountInput);
    if (isNaN(inr) || inr <= 0) {
      setErrorMsg('Please enter a valid positive payment amount.');
      return;
    }

    const amountPaise = Math.round(inr * 100);

    if (amountPaise > maxPerPayment) {
      setErrorMsg(
        `Amount ₹${inr.toFixed(2)} exceeds maximum per-payment limit of ₹${(maxPerPayment / 100).toFixed(2)} in this certificate.`
      );
      return;
    }

    try {
      const expiresAt = new Date(activeCert.payload.expires_at);
      if (new Date() > expiresAt) {
        setErrorMsg('Selected allowance certificate has expired. Please create a new reserve online.');
        return;
      }
    } catch (e) {
      // ignore
    }

    setLoading(true);
    try {
      const counter = await getNextCounter(device.device_id);
      const now = new Date();
      const expires = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const token_payload = {
        transaction_id: crypto.randomUUID(),
        certificate_id: activeCert.certificate_id,
        payer_device_id: device.device_id,
        payer_user_id: user.id,
        payee_id: payeeId.trim(),
        amount: amountPaise,
        nonce: crypto.randomUUID(),
        counter: counter,
        issued_at: now.toISOString(),
        expires_at: expires.toISOString(),
      };

      const token_signature = await signPayload(device.keyPair.privateKey, token_payload);

      const tokenBundle = {
        token_payload,
        token_signature,
        payer_public_key: device.public_key_spki,
        certificate: {
          payload: activeCert.payload,
          signature: activeCert.signature,
        },
      };

      await addToSyncQueue({
        transaction_id: token_payload.transaction_id,
        token_payload,
        token_signature,
        payer_public_key: device.public_key_spki,
        certificate: tokenBundle.certificate,
        local_status: 'ACCEPTED_OFFLINE',
        created_at: now.toISOString(),
      });

      setGeneratedToken(tokenBundle);
      setSuccessMsg('Offline payment token signed with ECDSA P-256 and queued locally!');
    } catch (err) {
      console.error('Payment generation error:', err);
      setErrorMsg(err.message || 'Failed to sign payment token.');
    } finally {
      setLoading(false);
    }
  };

  const tokenString = generatedToken ? JSON.stringify(generatedToken) : '';

  const handleCopy = () => {
    if (tokenString) {
      navigator.clipboard.writeText(tokenString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="page-container">
      {/* Title Header */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">OFFLINE PAYMENT DISPATCH</p>
            <h1>
              <ArrowUpRight size={28} style={{ color: 'var(--accent)' }} />
              <span>Create Offline Payment</span>
            </h1>
            <p>Generate cryptographically signed payment tokens that transfer securely without internet access.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <span className="badge badge-provisional">
              <Cpu size={12} />
              <span>P-256 Hardware Enclave</span>
            </span>
            <span className={`badge ${isOnline ? 'badge-settled' : 'badge-pending'}`}>
              {isOnline ? 'Gateway Linked' : 'Air-Gapped Mode'}
            </span>
          </div>
        </div>
      </div>

      <ErrorMessage error={errorMsg} />

      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <ShieldCheck size={20} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Guide & Setup Banner */}
      {showQuickSetup && (
        <div
          className="card setup-card"
          style={{
            marginBottom: '2rem',
            border: '1px solid var(--primary-border)',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(2, 132, 199, 0.03) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '280px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--primary-light)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--primary)',
                  flexShrink: 0,
                }}
              >
                <Zap size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  {certificates.length === 0
                    ? 'Allowance Certificate Required'
                    : 'Device Key Binding Required'}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '600px', marginBottom: '0.5rem', lineHeight: 1.45 }}>
                  {certificates.length === 0
                    ? 'To pay while disconnected from the internet, your browser needs a bank-signed Allowance Certificate that pre-reserves spending power against your account.'
                    : 'Your account has active certificates, but none are bound to this browser\'s local private key. Fast Setup will register this browser and issue a dedicated ₹500 certificate.'}
                </p>
                <div style={{ fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontWeight: 600 }}>
                  <span>✓ Creates Local Web Crypto Key</span>
                  <span>✓ Issues ₹500 Allowance Certificate</span>
                  <span>✓ Zero-Network Ready</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {isOnline ? (
                <button
                  type="button"
                  onClick={handleQuickSetup}
                  className="btn btn-primary"
                  disabled={quickSettingUp}
                >
                  <Zap size={16} />
                  <span>{quickSettingUp ? 'Arming Device...' : '1-Click Fast Setup (₹500 Reserve)'}</span>
                </button>
              ) : (
                <div className="badge badge-warning">Reconnect to bank gateway to create reserve</div>
              )}
              <Link to="/wallet" className="btn btn-outline">
                <Lock size={15} />
                <span>Custom Reserve</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Payment Builder & QR/Token Output */}
      <div className="grid-2">
        {/* Payment Builder Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Lock size={18} style={{ color: 'var(--accent)' }} />
              <span>Payment Details</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>STEP 1 OF 2</span>
          </div>

          <form onSubmit={handleGeneratePayment}>
            {/* Allowance Certificate Selector */}
            <div className="form-group">
              <label className="form-label">Allowance Certificate</label>
              {certificates.length === 0 ? (
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: '0.86rem',
                    border: '1px dashed var(--border-medium)',
                  }}
                >
                  No active certificate in local IndexedDB. Use 1-Click Fast Setup above to create one.
                </div>
              ) : (
                <select
                  className="form-control"
                  value={selectedCertId}
                  onChange={(e) => setSelectedCertId(e.target.value)}
                  required
                >
                  {certificates.map((c) => {
                    const isDev = Boolean(device && c.payload?.device_id === device.device_id);
                    return (
                      <option key={c.certificate_id} value={c.certificate_id}>
                        {isDev ? '✓ [Bound to This Browser] ' : '⚠ [Other Device] '}
                        Cert {c.certificate_id.slice(0, 8)}... (Max ₹{((c.payload?.max_per_payment || 0) / 100).toFixed(2)}/tx)
                      </option>
                    );
                  })}
                </select>
              )}

              {activeCert && (
                <div
                  className="form-helper"
                  style={{
                    color: isDeviceMatch ? 'var(--text-secondary)' : '#fb7185',
                    marginTop: '0.5rem',
                  }}
                >
                  {isDeviceMatch ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                      <span>
                        Valid certificate • Max per payment: <strong>₹{(maxPerPayment / 100).toFixed(2)}</strong> • Total Reserve: <strong>₹{(reserveAmount / 100).toFixed(2)}</strong>
                      </span>
                    </span>
                  ) : (
                    <span>
                      ⚠ Warning: Issued to device {activeCert.payload?.device_id}. Use 1-Click Setup to bind to this browser.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Payee / Merchant Input */}
            <div className="form-group">
              <label className="form-label">Merchant / Recipient ID</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. merchant or username"
                value={payeeId}
                onChange={(e) => setPayeeId(e.target.value)}
                required
              />
              <div className="form-helper">
                The cryptographic signature locks the transaction exclusively to this payee to prevent interception.
              </div>
            </div>

            {/* Amount Input with Quick Presets */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Amount in INR (₹)
                </label>
                {maxPerPayment > 0 && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--accent)' }}>
                    Max: ₹{(maxPerPayment / 100).toFixed(2)}
                  </span>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                  }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  max={maxPerPayment ? maxPerPayment / 100 : undefined}
                  className="form-control"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  style={{ paddingLeft: '2.4rem', fontSize: '1.2rem', fontWeight: 700 }}
                  required
                />
              </div>

              {/* Quick Preset Amount Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                {[50, 100, 200, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetAmount(preset)}
                    className="btn btn-sm btn-outline"
                    style={{
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.78rem',
                      background: amountInput === String(preset) ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                      borderColor: amountInput === String(preset) ? 'var(--primary)' : 'var(--border-subtle)',
                    }}
                  >
                    +₹{preset}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.75rem' }}
              disabled={loading || certificates.length === 0 || !isRegistered}
            >
              {loading ? (
                <span>Signing with ECDSA P-256...</span>
              ) : (
                <>
                  <Lock size={18} />
                  <span>Sign & Generate Offline Token</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* QR Code & Token Output Display Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <QrCode size={18} style={{ color: 'var(--accent)' }} />
              <span>Offline Token & QR Code</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>STEP 2 OF 2</span>
          </div>

          {generatedToken ? (
            <div>
              {/* QR Code Presentation Box */}
              <div
                style={{
                  textAlign: 'center',
                  padding: '1.5rem',
                  background: '#ffffff',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                  marginBottom: '1.5rem',
                  position: 'relative',
                  border: '2px solid rgba(6, 182, 212, 0.4)',
                }}
              >
                <QRCodeSVG
                  value={tokenString}
                  size={200}
                  level="M"
                  includeMargin={true}
                />
                <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 700, marginTop: '0.5rem' }}>
                  Scan with Merchant Terminal or Copy Token Below
                </div>
              </div>

              {/* Token Details & Telemetry */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1.25rem',
                  fontSize: '0.84rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Transaction Reference:</span>
                  <span className="font-mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {generatedToken.token_payload.transaction_id.slice(0, 12)}...
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Strict Monotonic Counter:</span>
                  <strong style={{ color: '#ffffff' }}>#{generatedToken.token_payload.counter}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Authorized Amount:</span>
                  <strong style={{ color: '#34d399', fontSize: '1rem' }}>
                    ₹{(generatedToken.token_payload.amount / 100).toFixed(2)}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ECDSA P-256 Digest:</span>
                  <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    {generatedToken.token_signature.slice(0, 16)}...
                  </span>
                </div>
              </div>

              {/* Copy Token Button & Raw JSON View */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Signed Token Bundle (JSON)
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn btn-sm btn-outline"
                  style={{ gap: '0.45rem' }}
                >
                  {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied Bundle!' : 'Copy Bundle'}</span>
                </button>
              </div>

              <textarea
                className="form-control font-mono"
                rows={4}
                value={tokenString}
                readOnly
                style={{ fontSize: '0.74rem', resize: 'none' }}
              />
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 1.5rem',
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
                <QrCode size={32} />
              </div>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Awaiting Payment Parameters</strong>
              <p style={{ maxWidth: '320px', fontSize: '0.84rem' }}>
                Select your allowance certificate, specify amount, and click "Sign & Generate Offline Token".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Pay;
