import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSyncQueue } from '../db/indexedDB';
import {
  Home,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ReceiptText,
  MoreHorizontal,
  Smartphone,
  RefreshCw,
  FileQuestion,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || 'customer';
  const isAnalyst = role === 'analyst';
  const isMerchant = role === 'merchant';
  const [moreOpen, setMoreOpen] = useState(
    ['/device', '/sync-queue', '/disputes'].some((p) => location.pathname.startsWith(p))
  );
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  useEffect(() => {
    async function checkQueue() {
      try {
        const queue = await getSyncQueue();
        const pending = (queue || []).filter((x) => x.local_status !== 'SETTLED');
        setPendingQueueCount(pending.length);
      } catch (e) {
        // quiet fallback
      }
    }
    checkQueue();
    const interval = setInterval(checkQueue, 5000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const navItem = (to, label, Icon, badge = null) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
    >
      <Icon size={19} strokeWidth={2} />
      <span>{label}</span>
      {badge !== null && badge > 0 && <span className="sidebar-badge">{badge}</span>}
    </NavLink>
  );

  return (
    <aside className="simple-sidebar">
      <div>
        <NavLink to="/dashboard" className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Wallet size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                OfflinePay
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary-border)',
                  letterSpacing: '0.04em',
                  fontWeight: 700,
                }}
              >
                SECURE
              </span>
            </div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              Offline Digital Payments
            </div>
          </div>
        </NavLink>

        <p className="sidebar-caption">MAIN NAVIGATION</p>
        {navItem('/dashboard', 'Dashboard', Home)}

        {isAnalyst ? (
          <>
            <p className="sidebar-caption" style={{ marginTop: '0.8rem' }}>
              RISK & SURVEILLANCE
            </p>
            {navItem('/analyst', 'Risk Overview', ShieldAlert)}
            {navItem('/analyst/flags', 'Flagged Payments', AlertTriangle)}
            {navItem('/analyst/disputes', 'Dispute Review', FileQuestion)}
          </>
        ) : (
          <>
            <p className="sidebar-caption" style={{ marginTop: '0.8rem' }}>
              PAYMENT OPERATIONS
            </p>
            {role === 'customer' && navItem('/pay', 'Send Payment (Offline)', ArrowUpRight)}
            {isMerchant && navItem('/receive', 'Receive & Verify', ArrowDownLeft)}
            {navItem('/wallet', 'Reserve Vault', Wallet)}
            {navItem('/history', 'Payment Ledger', ReceiptText)}

            <button
              type="button"
              className="sidebar-more"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={18} />
              <span>Advanced Tools</span>
              {pendingQueueCount > 0 && <span className="sidebar-badge">{pendingQueueCount}</span>}
              <ChevronDown size={15} className={moreOpen ? 'chevron-open' : ''} />
            </button>

            {moreOpen && (
              <div className="sidebar-submenu">
                {navItem('/device', 'Browser Device Key', Smartphone)}
                {navItem('/sync-queue', 'Offline Sync Queue', RefreshCw, pendingQueueCount)}
                {navItem('/disputes', 'Disputes & Claims', FileQuestion)}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <div className="sidebar-help">
          <ShieldAlert size={18} />
          <div>
            <strong>Web Crypto P-256 Active</strong>
            <p>Payments are signed locally via ECDSA and confirmed upon reconnection.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
