import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useNetwork } from '../context/NetworkContext';
import {
  Smartphone,
  ShieldCheck,
  Key,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Cpu,
  Copy,
  Check,
  Shield,
} from 'lucide-react';
import { ErrorMessage } from '../components/UIComponents';

export function DeviceRegistration() {
  const { device, isRegistered, registerDevice, loading } = useDevice();
  const { isOnline } = useNetwork();
  const [deviceName, setDeviceName] = useState('Browser Secure Enclave');
  const [registering, setRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegistering(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const dev = await registerDevice(deviceName);
      setSuccessMsg(`Device registered successfully! Armed ID: ${dev.device_id}`);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Device registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  const handleCopyKey = () => {
    if (device?.public_key_spki) {
      navigator.clipboard.writeText(device.public_key_spki);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  return (
    <div className="page-container">
      {/* Title Header */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">HARDWARE & WEB CRYPTO SUBSYSTEM</p>
            <h1>
              <Smartphone size={28} style={{ color: 'var(--accent)' }} />
              <span>Browser Enclave & Keypairs</span>
            </h1>
            <p>Generate non-extractable ECDSA P-256 asymmetric cryptographic keypairs directly within browser memory.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <span className={`badge ${isRegistered ? 'badge-settled' : 'badge-pending'}`}>
              <ShieldCheck size={12} />
              <span>{isRegistered ? 'Enclave Armed (P-256)' : 'Unregistered'}</span>
            </span>
          </div>
        </div>
      </div>

      <ErrorMessage error={errorMsg} />

      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <CheckCircle size={19} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid-2">
        {/* Enclave Status & Keys */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Cpu size={18} style={{ color: 'var(--accent)' }} />
              <span>Browser Cryptographic Enclave</span>
            </span>
            <span className="badge badge-provisional">LOCAL STORAGE</span>
          </div>

          {isRegistered && device ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span className="badge badge-settled">
                  <CheckCircle size={12} /> Active & Registered
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Curve: <strong>NIST P-256 (SHA-256)</strong>
                </span>
              </div>

              {/* Device ID Box */}
              <div className="form-group">
                <label className="form-label">Registered Device Identity</label>
                <div
                  style={{
                    padding: '0.65rem 0.95rem',
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.88rem',
                    color: 'var(--primary)',
                  }}
                  className="font-mono"
                >
                  {device.device_id}
                </div>
              </div>

              {/* Strict Monotonic Counter Display */}
              <div className="form-group">
                <label className="form-label">Strict Monotonic Counter Sequence</label>
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Current State:</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                    #{device.counter || 0}
                  </span>
                </div>
                <div className="form-helper">
                  Strictly increments by +1 for every signed payment to prevent duplicate attacks.
                </div>
              </div>

              {/* Public Key SPKI Card */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Device Public Key (SPKI Base64)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="btn btn-sm btn-outline"
                    style={{ gap: '0.4rem' }}
                  >
                    {copiedKey ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                    <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
                  </button>
                </div>
                <textarea
                  className="form-control font-mono"
                  rows={4}
                  value={device.public_key_spki || ''}
                  readOnly
                  style={{ fontSize: '0.74rem', resize: 'none' }}
                />
                <div className="form-helper">
                  Shared with offline merchant terminals and the bank gateway to verify signatures.
                </div>
              </div>

              {/* Private Key Isolation Guarantee */}
              <div
                style={{
                  padding: '0.9rem 1.1rem',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: '#a7f3d0',
                  fontSize: '0.84rem',
                }}
              >
                <ShieldCheck size={22} style={{ flexShrink: 0, color: 'var(--success)' }} />
                <span>
                  <strong>Non-Extractable Private Key:</strong> Stored securely in IndexedDB crypto storage. Never transmitted over the network.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
              <AlertTriangle size={42} style={{ color: 'var(--warning)', marginBottom: '1rem' }} />
              <h3 style={{ marginBottom: '0.4rem' }}>No Cryptographic Keypair Found</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0 auto' }}>
                This browser has not yet initialized its hardware/software keypair. Generate one below to begin.
              </p>
            </div>
          )}
        </div>

        {/* Generate / Re-generate Keypair Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Key size={18} style={{ color: 'var(--primary)' }} />
              <span>{isRegistered ? 'Rotate Device Keypair' : 'Arm New Device Key'}</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ENCLAVE SETUP</span>
          </div>

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Device Label / Friendly Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Work Laptop Chrome"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
              />
              <div className="form-helper">
                Identifier to label this device's public key on the bank server.
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={16} style={{ color: 'var(--primary)' }} />
                <span>Device Security Protocol:</span>
              </div>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <li>Generates an asymmetric NIST P-256 elliptic curve keypair via native Web Crypto.</li>
                <li>Private key is locked in non-exportable browser IndexedDB memory.</li>
                <li>Public key is synchronized with bank to verify offline allowance signatures.</li>
              </ul>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={registering}
            >
              {registering ? (
                <>
                  <RefreshCw size={17} className="spin-slow" />
                  <span>Generating P-256 Keypair...</span>
                </>
              ) : isRegistered ? (
                'Re-generate & Rotate Keypair'
              ) : (
                'Generate & Arm Keypair'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default DeviceRegistration;
