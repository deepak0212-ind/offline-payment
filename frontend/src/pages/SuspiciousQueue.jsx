import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import {
  AlertOctagon,
  Search,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Shield,
  Clock,
  Layers,
} from 'lucide-react';

export function SuspiciousQueue() {
  const { isOnline } = useNetwork();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadFlags();
  }, [isOnline]);

  async function loadFlags() {
    setLoading(true);
    setErrorMsg('');
    try {
      if (isOnline) {
        const res = await apiService.getAnalystFlags();
        setFlags(res.data || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load suspicious transaction queue.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = flags.filter((f) => {
    if (filterType === 'DOUBLE_SPEND' && !f.flag_reason?.includes('DOUBLE-SPEND')) return false;
    if (filterType === 'REPLAY' && !f.flag_reason?.includes('REPLAY')) return false;
    if (filterType === 'COUNTER' && !f.flag_reason?.includes('COUNTER')) return false;

    if (search) {
      const term = search.toLowerCase();
      const matchId = (f.transaction_id || '').toLowerCase().includes(term);
      const matchReason = (f.flag_reason || '').toLowerCase().includes(term);
      return matchId || matchReason;
    }
    return true;
  });

  const columns = [
    {
      header: 'Transaction ID & Device',
      accessor: 'transaction_id',
      render: (f) => (
        <div>
          <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
            {f.transaction_id.slice(0, 10)}...
          </span>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Device: <span className="font-mono">{f.payer_device_id?.slice(0, 8)}...</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Amount Claimed',
      accessor: 'amount',
      render: (f) => (
        <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>
          ₹{(f.amount / 100).toFixed(2)}
        </strong>
      ),
    },
    {
      header: 'Security Flag & Protocol Breach Reason',
      accessor: 'flag_reason',
      render: (f) => (
        <div style={{ color: '#fb7185', fontSize: '0.84rem', fontWeight: 600, maxWidth: '420px', lineHeight: 1.4 }}>
          {f.flag_reason}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (f) => <StatusBadge status={f.status} />,
    },
    {
      header: 'Detected Timestamp',
      accessor: 'created_at',
      render: (f) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {new Date(f.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Forensics',
      accessor: 'action',
      render: (f) => (
        <Link
          to={`/transaction/${f.transaction_id}`}
          className="btn btn-sm btn-outline"
          style={{ padding: '0.35rem 0.65rem' }}
          title="Inspect Evidence Dossier"
        >
          <span>Evidence</span>
          <ChevronRight size={14} />
        </Link>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Scanning flagged transactions and anomaly signatures..." />;

  return (
    <div className="page-container">
      {/* Title Header */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">FORENSIC SURVEILLANCE QUEUE</p>
            <h1>
              <AlertOctagon size={28} style={{ color: 'var(--danger)' }} />
              <span>Suspicious Claims & Flags</span>
            </h1>
            <p>Investigate offline double-spend attempts, replay nonces, and counter sequencing anomalies.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <span className="badge badge-flagged font-mono">
              {filtered.length} flagged cases
            </span>
          </div>
        </div>
      </div>

      <ErrorMessage error={errorMsg} onRetry={loadFlags} />

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem 1.4rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Flagged' },
              { id: 'DOUBLE_SPEND', label: 'Double-Spends' },
              { id: 'REPLAY', label: 'Replay Nonces' },
              { id: 'COUNTER', label: 'Counter Rollbacks' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterType(t.id)}
                className={`btn btn-sm ${filterType === t.id ? 'btn-danger' : 'btn-outline'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: '280px' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by ID or breach reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      {/* Flagged Claims Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No flagged or suspicious transactions found matching filters."
        />
      </div>
    </div>
  );
}

export default SuspiciousQueue;
