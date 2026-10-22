import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { getSyncQueue } from '../db/indexedDB';
import { StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import {
  Search,
  ReceiptText,
  ChevronRight,
} from 'lucide-react';

export function TransactionHistory() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadTransactions();
    const refreshAfterFunding = () => loadTransactions();
    window.addEventListener('wallet-funded', refreshAfterFunding);
    return () => window.removeEventListener('wallet-funded', refreshAfterFunding);
  }, [isOnline, user]);

  async function loadTransactions() {
    setLoading(true);
    setErrorMsg('');
    try {
      let combined = [];

      if (isOnline) {
        const res = await apiService.getTransactions();
        combined = res.data || [];
      }

      try {
        const localItems = await getSyncQueue();
        const visibleLocalItems = localItems.filter((local) => {
          const payload = local.token_payload || {};
          if (!user) return false;
          if (user.role === 'merchant') {
            return (
              String(payload.payee_id) === String(user.id) ||
              String(payload.payee_id) === user.username
            );
          }
          return (
            String(payload.payer_user_id) === String(user.id) ||
            String(payload.payee_id) === String(user.id) ||
            String(payload.payee_id) === user.username
          );
        });

        for (const local of visibleLocalItems) {
          if (!combined.some((t) => t.transaction_id === local.transaction_id)) {
            combined.unshift({
              transaction_id: local.transaction_id,
              certificate_id: local.token_payload?.certificate_id,
              amount: local.token_payload?.amount || 0,
              counter: local.token_payload?.counter,
              nonce: local.token_payload?.nonce,
              status: local.local_status || 'ACCEPTED_OFFLINE',
              flag_reason: local.flag_reason || null,
              created_at: local.created_at,
              is_local_only: true,
            });
          }
        }
      } catch (e) {
        console.error('Error loading local queue items:', e);
      }

      setTransactions(combined);
    } catch (err) {
      console.error('Failed to load transaction history:', err);
      setErrorMsg(
        err.response?.status === 401
          ? 'Your session has expired. Please sign in again.'
          : 'Failed to load transactions.'
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredData = transactions.filter((tx) => {
    if (filter === 'SETTLED' && tx.status !== 'SETTLED') return false;
    if (filter === 'FLAGGED' && tx.status !== 'FLAGGED') return false;
    if (filter === 'OFFLINE' && tx.status !== 'ACCEPTED_OFFLINE') return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = (tx.transaction_id || '').toLowerCase().includes(term);
      const matchCert = (tx.certificate_id || '').toLowerCase().includes(term);
      const matchNonce = (tx.nonce || '').toLowerCase().includes(term);
      return matchId || matchCert || matchNonce;
    }
    return true;
  });

  const columns = [
    {
      header: 'Transaction ID & Proof',
      accessor: 'transaction_id',
      render: (tx) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
              {tx.transaction_id.slice(0, 10)}...
            </span>
            {tx.is_local_only && (
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  fontWeight: 700,
                }}
              >
                LOCAL
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Sequence #{tx.counter || 0}
          </div>
        </div>
      ),
    },
    {
      header: 'Flow',
      accessor: 'transaction_type',
      render: (tx) => (
        <span
          className="badge"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {tx.transaction_type || (tx.is_local_only ? 'OFFLINE SIGNED' : 'TRANSFER')}
        </span>
      ),
    },
    {
      header: 'Counterparty',
      accessor: 'counterparty_username',
      render: (tx) => <span style={{ fontWeight: 600 }}>{tx.counterparty_username || 'Local Terminal'}</span>,
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (tx) => (
        <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>
          ₹{(tx.amount / 100).toFixed(2)}
        </strong>
      ),
    },
    {
      header: 'Status & Telemetry',
      accessor: 'status',
      render: (tx) => (
        <div>
          <StatusBadge status={tx.status} />
          {tx.flag_reason && (
            <div
              style={{
                fontSize: '0.74rem',
                color: '#fb7185',
                marginTop: '4px',
                maxWidth: '280px',
                lineHeight: 1.3,
              }}
            >
              {tx.flag_reason}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Timestamp',
      accessor: 'created_at',
      render: (tx) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {new Date(tx.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (tx) => (
        <Link
          to={`/transaction/${tx.transaction_id}`}
          className="btn btn-sm btn-outline"
          style={{ padding: '0.35rem 0.65rem' }}
          title="Inspect Cryptographic Evidence"
        >
          <span>Evidence</span>
          <ChevronRight size={14} />
        </Link>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Auditing transaction ledger records..." />;

  return (
    <div className="page-container">
      {/* Title Header */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">IMMUTABLE FINANCIAL AUDIT</p>
            <h1>
              <ReceiptText size={28} style={{ color: 'var(--accent)' }} />
              <span>Transaction Activity & Ledger</span>
            </h1>
            <p>Comprehensive cryptographic log of settled, provisional offline, and security-flagged payments.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <span className="badge badge-provisional font-mono">
              {filteredData.length} records
            </span>
          </div>
        </div>
      </div>

      <ErrorMessage error={errorMsg} onRetry={loadTransactions} />

      {/* Filter and Search Bar Card */}
      <div className="card" style={{ padding: '1rem 1.4rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: 'All Transactions' },
              { key: 'SETTLED', label: 'Settled' },
              { key: 'OFFLINE', label: 'Offline Provisional' },
              { key: 'FLAGGED', label: 'Flagged Anomalies' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-outline'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search Input Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: '280px' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by ID, Certificate, Nonce..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      {/* Transactions Table Card */}
      <div className="card">
        <DataTable
          columns={columns}
          data={filteredData}
          emptyMessage="No matching transaction records found."
        />
      </div>
    </div>
  );
}

export default TransactionHistory;
