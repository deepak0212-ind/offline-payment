import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useDevice } from '../context/DeviceContext';
import { apiService } from '../api/client';
import { getSyncQueue } from '../db/indexedDB';
import { LoadingSpinner, StatusBadge } from '../components/UIComponents';
import { Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw, Smartphone, ShieldCheck, CircleHelp } from 'lucide-react';

const money = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CustomerDashboard() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { isRegistered } = useDevice();
  const [wallet, setWallet] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const merchant = user?.role === 'merchant';

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const queue = await getSyncQueue();
        if (active) setPendingCount((queue || []).filter(x => x.local_status !== 'SETTLED').length);
        if (isOnline) {
          const [walletResult, txResult] = await Promise.allSettled([apiService.getWallet(), apiService.getTransactions()]);
          if (!active) return;
          if (walletResult.status === 'fulfilled') setWallet(walletResult.value.data);
          if (txResult.status === 'fulfilled') setRecent((txResult.value.data || []).slice(0, 4));
        }
      } catch (error) {
        console.warn('Could not load dashboard data:', error);
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [isOnline]);

  if (loading) return <LoadingSpinner message="Loading your wallet..." />;

  return <div className="page-container simple-dashboard">
    <section className="welcome-row">
      <div><p className="eyebrow">YOUR WALLET</p><h1>Hello, {user?.username || 'there'}</h1><p className="welcome-copy">{merchant ? 'Receive a payment, even when your internet is unavailable.' : 'Send money securely, even when your internet is unavailable.'}</p></div>
      <span className={`large-status ${isOnline ? 'is-online' : 'is-offline'}`}>{isOnline ? <><span className="status-dot"/> Connected</> : <><span className="status-dot"/> Offline mode</>}</span>
    </section>

    {!isRegistered && <section className="simple-notice"><span className="notice-icon"><Smartphone size={20}/></span><div className="notice-copy"><strong>One quick setup before you start</strong><p>Set up this browser once so it can safely sign offline payments.</p></div><Link className="btn btn-primary" to="/device">Set up device</Link></section>}
    {pendingCount > 0 && <section className="simple-notice pending-notice"><span className="notice-icon"><RefreshCw size={20}/></span><div className="notice-copy"><strong>{pendingCount} payment{pendingCount === 1 ? '' : 's'} waiting to sync</strong><p>Reconnect to send them to the bank for settlement.</p></div><Link className="btn btn-primary" to="/sync-queue">Sync payments</Link></section>}

    <section className="balance-panel">
      <div><p className="balance-label">TOTAL WALLET BALANCE</p><h2>{wallet ? money(wallet.total_balance) : 'Connect to view balance'}</h2><p className="balance-note">Your balance and reserve are managed securely by the bank.</p></div>
      <div className="balance-icon"><Wallet size={25}/></div>
      <div className="balance-breakdown"><div><span>Available to use</span><strong>{wallet ? money(wallet.available_balance) : '—'}</strong></div><div><span>Kept in offline reserve</span><strong>{wallet ? money(wallet.reserved_balance) : '—'}</strong></div></div>
    </section>

    <h2 className="section-heading">What would you like to do?</h2>
    <section className="simple-actions">
      {!merchant ? <Link to="/pay" className="action-card primary-action"><span className="action-icon"><ArrowUpRight size={22}/></span><span><strong>Pay someone</strong><small>Create a payment that works offline</small></span><span className="action-arrow">→</span></Link> : <Link to="/receive" className="action-card primary-action"><span className="action-icon"><ArrowDownLeft size={22}/></span><span><strong>Receive a payment</strong><small>Check a customer's offline payment</small></span><span className="action-arrow">→</span></Link>}
      <Link to="/wallet" className="action-card"><span className="action-icon"><Wallet size={22}/></span><span><strong>Manage reserve</strong><small>Prepare money for offline use</small></span><span className="action-arrow">→</span></Link>
      <Link to="/history" className="action-card"><span className="action-icon"><RefreshCw size={22}/></span><span><strong>Payment activity</strong><small>See payments and their status</small></span><span className="action-arrow">→</span></Link>
    </section>

    <section className="recent-panel"><div className="recent-heading"><div><h2>Recent payments</h2><p>Your latest payment activity</p></div><Link to="/history">View all</Link></div>
      {recent.length === 0 ? <div className="empty-state"><ReceiptIcon/><strong>No payments yet</strong><p>Your recent payments will appear here.</p></div> : <div className="recent-list">{recent.map((tx) => <div className="recent-row" key={tx.transaction_id}><div className="recent-symbol"><Wallet size={17}/></div><div className="recent-description"><strong>Payment</strong><small>Ref: {String(tx.transaction_id || '').slice(0, 12)}</small></div><strong className="recent-amount">{money(tx.amount)}</strong><StatusBadge status={tx.status}/></div>)}</div>}
    </section>
    <p className="plain-language-note"><ShieldCheck size={16}/> <span>Offline payments are provisional until they sync with the bank. <Link to="/wallet">Learn about your reserve</Link>.</span></p>
  </div>;
}

function ReceiptIcon() { return <CircleHelp size={25} aria-hidden="true"/>; }
