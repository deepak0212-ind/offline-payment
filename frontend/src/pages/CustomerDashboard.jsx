import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useDevice } from '../context/DeviceContext';
import { apiService } from '../api/client';
import { getSyncQueue } from '../db/indexedDB';
import { LoadingSpinner, StatusBadge } from '../components/UIComponents';
import {
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  CircleHelp,
  Zap,
  Lock,
  ChevronRight,
  CreditCard,
} from 'lucide-react';

const formatInr = (paise) =>
  `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function CustomerDashboard() {
  const { user } = useAuth();
  const { isOnline, isSimulatedOffline, toggleSimulatedOffline } = useNetwork();
  const { isRegistered, device } = useDevice();
  const [wallet, setWallet] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMerchant = user?.role === 'merchant';

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const queue = await getSyncQueue();
        if (active) {
          setPendingCount((queue || []).filter((x) => x.local_status !== 'SETTLED').length);
        }
        if (isOnline) {
          const [walletResult, txResult] = await Promise.allSettled([
            apiService.getWallet(),
            apiService.getTransactions(),
          ]);
          if (!active) return;
          if (walletResult.status === 'fulfilled') setWallet(walletResult.value.data);
          if (txResult.status === 'fulfilled') {
            setRecent((txResult.value.data || []).slice(0, 5));
          }
        }
      } catch (error) {
        console.warn('Could not load dashboard data:', error);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [isOnline]);

  if (loading) return <LoadingSpinner message="Decrypting wallet & syncing local ledger..." />;

  return (
    <div className="page-container simple-dashboard">
      {/* Top Welcome Bar */}
      <section className="welcome-row">
        <div>
          <p className="eyebrow">
            {isMerchant ? 'POINT-OF-SALE VAULT' : 'CRYPTOGRAPHIC FINTECH VAULT'}
          </p>
          <h1>Welcome back, {user?.full_name || user?.username}</h1>
          <p className="welcome-copy">
            {isMerchant
              ? 'Receive verified offline payments with client-side ECDSA P-256 verification.'
              : 'Create cryptographically signed payments that work anywhere without internet.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.65rem' }}>
          <span className={`large-status ${isOnline ? 'is-online' : 'is-offline'}`}>
            <span className="status-dot" />
            {isOnline ? 'Gateway Connected' : 'Local Mesh Mode'}
          </span>
          <button
            type="button"
            onClick={toggleSimulatedOffline}
            className="btn btn-sm btn-outline"
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            <Zap size={13} />
            <span>{isSimulatedOffline ? 'Go Back Online' : 'Test Offline Mode'}</span>
          </button>
        </div>
      </section>

      {/* Action Prompts & Banners */}
      {!isRegistered && (
        <section className="simple-notice">
          <span className="notice-icon">
            <Smartphone size={22} />
          </span>
          <div className="notice-copy">
            <strong>Browser Cryptographic Enclave Not Initialized</strong>
            <p>Generate your browser's private ECDSA P-256 key pair to enable zero-network signed payments.</p>
          </div>
          <Link className="btn btn-primary btn-sm" to="/device">
            Initialize Device Key
          </Link>
        </section>
      )}

      {pendingCount > 0 && (
        <section className="simple-notice pending-notice">
          <span className="notice-icon">
            <RefreshCw size={22} className="spin-slow" />
          </span>
          <div className="notice-copy">
            <strong>
              {pendingCount} Offline Payment{pendingCount === 1 ? '' : 's'} Awaiting Bank Settlement
            </strong>
            <p>Your signed offline transactions are stored safely in IndexedDB and ready to upload.</p>
          </div>
          <Link className="btn btn-primary btn-sm" to="/sync-queue">
            Sync Now
          </Link>
        </section>
      )}

      {/* Main Hologram Virtual Smart Card */}
      <section className="hologram-card" style={{ marginBottom: '2.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: '#93c5fd',
                  textTransform: 'uppercase',
                }}
              >
                {isMerchant ? 'MERCHANT ACCOUNT' : 'OFFLINEPAY SECURE VAULT'}
              </span>
              <span
                style={{
                  fontSize: '0.66rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(99, 102, 241, 0.3)',
                  border: '1px solid rgba(99, 102, 241, 0.5)',
                  color: '#e0e7ff',
                  fontWeight: 700,
                }}
              >
                TIER-1 RESERVE
              </span>
            </div>
            <div
              style={{
                fontSize: '2.8rem',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
              }}
            >
              {wallet ? formatInr(wallet.total_balance) : 'Offline Cached'}
            </div>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
              Total liquidity managed by double-entry banking ledger
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                display: 'inline-flex',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
              }}
            >
              <CreditCard size={28} />
            </div>
            <div
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                color: '#94a3b8',
                marginTop: '0.5rem',
              }}
            >
              DEVICE ID: {device?.device_id ? device.device_id.slice(0, 10) + '...' : 'UNLINKED'}
            </div>
          </div>
        </div>

        {/* Card Metrics Breakdown */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.25rem',
            paddingTop: '1.6rem',
            marginTop: '1.6rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div>
            <span
              style={{
                display: 'block',
                fontSize: '0.74rem',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.25rem',
                fontWeight: 700,
              }}
            >
              Available Funds
            </span>
            <strong style={{ fontSize: '1.35rem', color: '#ffffff', fontWeight: 800 }}>
              {wallet ? formatInr(wallet.available_balance) : '—'}
            </strong>
          </div>

          <div>
            <span
              style={{
                display: 'block',
                fontSize: '0.74rem',
                color: '#93c5fd',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.25rem',
                fontWeight: 700,
              }}
            >
              Locked in Offline Reserve
            </span>
            <strong style={{ fontSize: '1.35rem', color: '#38bdf8', fontWeight: 800 }}>
              {wallet ? formatInr(wallet.reserved_balance) : '—'}
            </strong>
          </div>

          <div>
            <span
              style={{
                display: 'block',
                fontSize: '0.74rem',
                color: '#a7f3d0',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.25rem',
                fontWeight: 700,
              }}
            >
              Enclave Key Status
            </span>
            <strong
              style={{
                fontSize: '1.1rem',
                color: isRegistered ? '#34d399' : '#fbbf24',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={18} />
              <span>{isRegistered ? 'P-256 Armed' : 'Unregistered'}</span>
            </strong>
          </div>
        </div>
      </section>

      {/* Action Hub */}
      <h2 className="section-heading">Quick Actions & Workflows</h2>
      <section className="simple-actions">
        {!isMerchant ? (
          <Link to="/pay" className="action-card primary-action">
            <span className="action-icon">
              <ArrowUpRight size={24} />
            </span>
            <span>
              <strong>Create Offline Payment</strong>
              <small>Generate signed ECDSA token bundle & QR code</small>
            </span>
            <span className="action-arrow">→</span>
          </Link>
        ) : (
          <Link to="/receive" className="action-card primary-action">
            <span className="action-icon">
              <ArrowDownLeft size={24} />
            </span>
            <span>
              <strong>Receive & Verify Payment</strong>
              <small>Validate P-256 signatures and sign POS receipt</small>
            </span>
            <span className="action-arrow">→</span>
          </Link>
        )}

        <Link to="/wallet" className="action-card">
          <span className="action-icon">
            <Lock size={22} />
          </span>
          <span>
            <strong>Allowance Reserve Vault</strong>
            <small>Lock funds for zero-internet transactions</small>
          </span>
          <span className="action-arrow">→</span>
        </Link>

        <Link to="/history" className="action-card">
          <span className="action-icon">
            <RefreshCw size={22} />
          </span>
          <span>
            <strong>Cryptographic Ledger</strong>
            <small>Audit signatures, nonces & settlement states</small>
          </span>
          <span className="action-arrow">→</span>
        </Link>
      </section>

      {/* Recent Activity Log */}
      <section className="recent-panel">
        <div className="recent-heading">
          <div>
            <h2>Recent Activity & Cryptographic Proofs</h2>
            <p>Real-time records from local storage and bank gateway</p>
          </div>
          <Link to="/history">View Full Ledger →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="empty-state">
            <CircleHelp size={32} style={{ color: 'var(--text-dim)', marginBottom: '0.4rem' }} />
            <strong>No transaction records found</strong>
            <p>Your signed offline payments and receipts will automatically synchronize here.</p>
          </div>
        ) : (
          <div className="recent-list">
            {recent.map((tx) => (
              <div className="recent-row" key={tx.transaction_id}>
                <div className="recent-symbol">
                  <Wallet size={19} />
                </div>
                <div className="recent-description">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>
                      {isMerchant ? 'Payment Received' : 'Payment Dispatched'}
                    </strong>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {String(tx.transaction_id || '').slice(0, 10)}...
                    </span>
                  </div>
                  <small>
                    Counter #{tx.counter || 0} • {new Date(tx.created_at || Date.now()).toLocaleTimeString()}
                  </small>
                </div>
                <strong className="recent-amount">{formatInr(tx.amount)}</strong>
                <StatusBadge status={tx.status} />
                <Link
                  to={`/transaction/${tx.transaction_id}`}
                  className="btn btn-sm btn-ghost"
                  style={{ padding: '0.35rem 0.6rem' }}
                  title="Inspect Cryptographic Proof"
                >
                  <ChevronRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Security Footnote */}
      <p className="plain-language-note">
        <ShieldCheck size={17} />
        <span>
          Offline payments use strictly monotonic counters to prevent double-spending without needing a real-time internet connection.{' '}
          <Link to="/wallet">Learn how reserve allowance locking works</Link>.
        </span>
      </p>
    </div>
  );
}

export default CustomerDashboard;
