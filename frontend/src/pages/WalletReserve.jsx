import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useDevice } from '../context/DeviceContext';
import { apiService } from '../api/client';
import { saveCertificate, getAllCertificates } from '../db/indexedDB';
import { BalanceCard, StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import {
  Wallet,
  Lock,
  PlusCircle,
  ShieldCheck,
  CheckCircle2,
  Coins,
  Layers,
} from 'lucide-react';

export function WalletReserve() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { device, isRegistered } = useDevice();

  const [wallet, setWallet] = useState(null);
  const [riskLimit, setRiskLimit] = useState(null);
  const [reserves, setReserves] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [amountInput, setAmountInput] = useState('');
  const [demoFundingInput, setDemoFundingInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [funding, setFunding] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWalletData();
  }, [isOnline]);

  async function loadWalletData() {
    setLoading(true);
    setError(null);
    try {
      if (isOnline) {
        const [walletRes, riskRes, reservesRes, ledgerRes] = await Promise.all([
          apiService.getWallet(),
          apiService.getMyRiskLimit(),
          apiService.getReserves(),
          apiService.getLedger(),
        ]);
        setWallet(walletRes.data);
        setRiskLimit(riskRes.data);
        setReserves(reservesRes.data);
        setLedger(ledgerRes.data);
      } else {
        const localCerts = await getAllCertificates();
        setReserves(
          localCerts.map((c) => ({
            reserve_id: c.payload?.certificate_id,
            amount: c.payload?.reserve_amount,
            remaining_allowance: c.payload?.reserve_amount,
            status: 'OFFLINE_CACHED',
            certificate: {
              certificate_id: c.certificate_id,
              signature: c.signature,
              expires_at: c.payload?.expires_at,
            },
          }))
        );
      }
    } catch (err) {
      console.error('Wallet data load error:', err);
      setError('Failed to fetch wallet data from server.');
    } finally {
      setLoading(false);
    }
  }

  const handleAddDemoFunds = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isOnline) {
      setError('Simulated demo funding requires an online connection.');
      return;
    }

    const inr = parseFloat(demoFundingInput);
    if (!Number.isFinite(inr) || inr <= 0) {
      setError('Please enter a valid positive funding amount.');
      return;
    }

    const paise = Math.round(inr * 100);
    setFunding(true);
    try {
      await apiService.addDemoFunds(paise, crypto.randomUUID());
      setMessage(`Successfully credited demo funds of ₹${inr.toFixed(2)} to your wallet!`);
      setDemoFundingInput('');
      await loadWalletData();
      window.dispatchEvent(new Event('wallet-funded'));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add simulated demo funds.');
    } finally {
      setFunding(false);
    }
  };

  const handlePresetDemoFund = (inr) => {
    setDemoFundingInput(String(inr));
  };

  const handleCreateReserve = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isOnline) {
      setError('Creating an offline reserve requires an active connection to the bank server.');
      return;
    }

    if (!isRegistered || !device) {
      setError('You must register your browser device before creating an offline reserve.');
      return;
    }

    const inr = parseFloat(amountInput);
    if (isNaN(inr) || inr <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    const paise = Math.round(inr * 100);

    if (wallet && paise > wallet.available_balance) {
      setError(`Cannot reserve more than available balance (₹${(wallet.available_balance / 100).toFixed(2)}).`);
      return;
    }

    if (riskLimit && paise > riskLimit.risk_tier.max_reserve_amount) {
      setError(
        `Requested reserve ₹${inr.toFixed(2)} exceeds your ${riskLimit.risk_tier.name} limit of ₹${(riskLimit.risk_tier.max_reserve_amount / 100).toFixed(2)}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiService.createReserve(paise, device.device_id);
      const createdReserve = res.data;
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

      setMessage(`Successfully locked ₹${inr.toFixed(2)} into offline reserve! Bank issued signed certificate.`);
      setAmountInput('');
      await loadWalletData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create reserve.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Auditing wallet balances & cryptographic reserve certificates..." />;

  const reservesColumns = [
    {
      header: 'Certificate Ref',
      accessor: 'reserve_id',
      render: (r) => (
        <div>
          <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
            {(r.reserve_id || '').slice(0, 10)}...
          </span>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Cert: {r.certificate?.certificate_id ? `${r.certificate.certificate_id.slice(0, 8)}...` : 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Total Locked',
      accessor: 'amount',
      render: (r) => <strong style={{ color: '#ffffff' }}>₹{((r.amount || 0) / 100).toFixed(2)}</strong>,
    },
    {
      header: 'Remaining Allowance',
      accessor: 'remaining_allowance',
      render: (r) => (
        <span style={{ color: '#34d399', fontWeight: 600 }}>
          ₹{((r.remaining_allowance || 0) / 100).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Expiry Date',
      accessor: 'expires_at',
      render: (r) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {r.certificate?.expires_at ? new Date(r.certificate.expires_at).toLocaleDateString() : 'Active'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const ledgerColumns = [
    {
      header: 'Timestamp',
      accessor: 'created_at',
      render: (l) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {new Date(l.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Entry Type',
      accessor: 'entry_type',
      render: (l) => (
        <span
          className="badge"
          style={{
            background: l.amount >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: l.amount >= 0 ? '#34d399' : '#fb7185',
            border: `1px solid ${l.amount >= 0 ? 'var(--success-border)' : 'var(--danger-border)'}`,
          }}
        >
          {l.entry_type}
        </span>
      ),
    },
    {
      header: 'Amount Impact',
      accessor: 'amount',
      render: (l) => (
        <strong style={{ color: l.amount >= 0 ? '#34d399' : '#fb7185' }}>
          {l.amount >= 0 ? '+' : ''}₹{(l.amount / 100).toFixed(2)}
        </strong>
      ),
    },
    {
      header: 'Balance After',
      accessor: 'balance_after',
      render: (l) => <span style={{ fontWeight: 600 }}>₹{(l.balance_after / 100).toFixed(2)}</span>,
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (l) => <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{l.description}</span>,
    },
  ];

  return (
    <div className="page-container">
      {/* Page Title */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">FINANCIAL INFRASTRUCTURE</p>
            <h1>
              <Wallet size={28} style={{ color: 'var(--primary)' }} />
              <span>Wallet & Offline Reserve Vault</span>
            </h1>
            <p>Allocate liquidity to cryptographically signed offline certificates with double-entry ledger guarantee.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <span className="badge badge-settled">
              <ShieldCheck size={12} />
              <span>Double-Entry Immutable</span>
            </span>
          </div>
        </div>
      </div>

      <ErrorMessage error={error} onRetry={loadWalletData} />

      {message && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <CheckCircle2 size={19} style={{ flexShrink: 0 }} />
          <span>{message}</span>
        </div>
      )}

      {/* Balance Summary Cards */}
      <div className="grid-3" style={{ marginBottom: '2rem' }}>
        <BalanceCard
          title="Total Liquidity Balance"
          amountPaise={wallet?.total_balance || 0}
          subtitle="Authoritative bank ledger position"
          icon={Wallet}
        />
        <BalanceCard
          title="Available to Reserve"
          amountPaise={wallet?.available_balance || 0}
          subtitle="Unencumbered funds ready to lock"
          icon={Coins}
        />
        <BalanceCard
          title="Secured Offline Reserve"
          amountPaise={wallet?.reserved_balance || 0}
          subtitle="Backed by bank Allowance Certificates"
          icon={Lock}
        />
      </div>

      {/* Sandbox Demo Funding Card */}
      {user?.role === 'customer' && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <span className="card-title">
              <PlusCircle size={18} style={{ color: 'var(--accent)' }} />
              <span>Sandbox Simulated Demo Funding</span>
            </span>
            <span className="badge badge-provisional">DEVELOPMENT MODE</span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Inject test balance into your bank wallet to experiment with locking offline reserves and creating transactions.
          </p>

          <form onSubmit={handleAddDemoFunds}>
            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 240px' }}>
                <label className="form-label">Funding Amount in INR (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                    }}
                  >
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-control"
                    placeholder="500"
                    value={demoFundingInput}
                    onChange={(e) => setDemoFundingInput(e.target.value)}
                    disabled={funding || !isOnline}
                    style={{ paddingLeft: '2.2rem' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                {[500, 1000, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handlePresetDemoFund(amt)}
                    className="btn btn-sm btn-outline"
                    disabled={funding || !isOnline}
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={funding || !isOnline}
                style={{ height: '42px' }}
              >
                {funding ? 'Crediting Ledger...' : 'Add Demo Funds'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lock Reserve & Risk Policy Grids */}
      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        {/* Lock Reserve Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Lock size={18} style={{ color: 'var(--primary)' }} />
              <span>Lock Funds to Offline Reserve</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CERTIFICATE ISSUANCE</span>
          </div>

          <form onSubmit={handleCreateReserve}>
            <div className="form-group">
              <label className="form-label">Reserve Amount in INR (₹)</label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                  }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="form-control"
                  placeholder="e.g. 500"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  disabled={submitting || !isOnline}
                  style={{ paddingLeft: '2.2rem' }}
                  required
                />
              </div>
              <div className="form-helper">
                Funds are deducted from available balance and sealed into a bank-signed ECDSA certificate in IndexedDB.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target Cryptographic Device</label>
              <input
                type="text"
                className="form-control font-mono"
                value={
                  device
                    ? `${device.device_name || 'Browser Enclave'} [${device.device_id.slice(0, 14)}...]`
                    : 'No Device Key Armed'
                }
                disabled
                style={{ fontSize: '0.84rem' }}
              />
              <div className="form-helper">
                The allowance certificate will be cryptographically pinned to this device's public key.
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={submitting || !isOnline || !isRegistered}
            >
              {submitting ? 'Requesting Bank Signature...' : 'Lock Amount & Issue Certificate'}
            </button>
            {!isOnline && (
              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.65rem' }}>
                Offline Mode: Must connect to bank gateway to sign and issue new Allowance Certificates.
              </div>
            )}
          </form>
        </div>

        {/* Risk Limits Policy Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
              <span>Risk Policy & Tier Configuration</span>
            </span>
            <span className="badge badge-settled">ENFORCED</span>
          </div>

          {riskLimit ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                  {riskLimit.risk_tier.name}
                </span>
                <span className="badge badge-provisional">Tier Level</span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.4rem' }}>
                {riskLimit.explanation}
              </p>

              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '1.2rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Max Offline Reserve Limit:</span>
                  <strong style={{ color: 'var(--text-main)' }}>
                    ₹{(riskLimit.risk_tier.max_reserve_amount / 100).toFixed(2)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Max Single Transaction Limit:</span>
                  <strong style={{ color: 'var(--primary)' }}>
                    ₹{(riskLimit.risk_tier.max_per_payment_limit / 100).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
                These limits protect against fraud and are enforced by both client Web Crypto checks and server settlement logic.
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Connect to bank gateway to load risk tiers.</p>
          )}
        </div>
      </div>

      {/* Allowance Certificates Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <span className="card-title">
            <Layers size={18} style={{ color: 'var(--accent)' }} />
            <span>Active Allowance Certificates in IndexedDB</span>
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>LOCAL & CLOUD RECORDS</span>
        </div>
        <DataTable columns={reservesColumns} data={reserves} emptyMessage="No reserve certificates active." />
      </div>

      {/* Double-Entry Ledger Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Coins size={18} style={{ color: 'var(--success)' }} />
            <span>Immutable Double-Entry Ledger Trail</span>
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>AUDIT LOG</span>
        </div>
        <DataTable columns={ledgerColumns} data={ledger} emptyMessage="No ledger entries recorded." />
      </div>
    </div>
  );
}

export default WalletReserve;
