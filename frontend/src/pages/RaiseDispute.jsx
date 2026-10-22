import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import {
  FileQuestion,
  CheckCircle,
  FileCheck,
  Send,
  ShieldAlert,
} from 'lucide-react';

export function RaiseDispute() {
  const { id: txIdParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const [transactionId, setTransactionId] = useState(txIdParam || '');
  const [reason, setReason] = useState('');
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadDisputes();
  }, [isOnline]);

  async function loadDisputes() {
    setLoading(true);
    setErrorMsg('');
    try {
      if (isOnline) {
        const res = await apiService.getDisputes();
        setDisputes(res.data || []);
      }
    } catch (err) {
      console.warn('Failed to load disputes:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isOnline) {
      setErrorMsg('Raising a dispute requires an active server connection.');
      return;
    }

    if (!transactionId.trim() || !reason.trim()) {
      setErrorMsg('Please enter both Transaction ID and Dispute Reason.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiService.createDispute({
        transaction_id: transactionId.trim(),
        reason: reason.trim(),
      });

      setSuccessMsg(`Dispute #${res.data.dispute_id.slice(0, 8)} successfully submitted for analyst review.`);
      setReason('');
      if (!txIdParam) setTransactionId('');
      await loadDisputes();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit dispute.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Dispute Reference',
      accessor: 'dispute_id',
      render: (d) => (
        <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
          {d.dispute_id.slice(0, 8)}...
        </span>
      ),
    },
    {
      header: 'Transaction ID',
      accessor: 'transaction_id',
      render: (d) => (
        <span className="font-mono" style={{ fontSize: '0.84rem' }}>
          {d.transaction_id.slice(0, 10)}...
        </span>
      ),
    },
    {
      header: 'Dispute Claim',
      accessor: 'reason',
      render: (d) => <span style={{ fontSize: '0.86rem' }}>{d.reason}</span>,
    },
    {
      header: 'Adjudication Status',
      accessor: 'status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      header: 'Analyst Findings',
      accessor: 'decision_notes',
      render: (d) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {d.decision_notes || 'Pending analyst investigation'}
        </span>
      ),
    },
    {
      header: 'Filed Date',
      accessor: 'created_at',
      render: (d) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {new Date(d.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Loading disputes & claim files..." />;

  return (
    <div className="page-container">
      {/* Title Header */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">CUSTOMER PROTECTION & ADJUDICATION</p>
            <h1>
              <FileQuestion size={28} style={{ color: 'var(--primary)' }} />
              <span>Disputes & Claims Center</span>
            </h1>
            <p>Contest transactions with cryptographic proof, double-spend evidence, or merchant delivery failures.</p>
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

      {/* Dispute Filing Form */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <span className="card-title">
            <ShieldAlert size={18} style={{ color: 'var(--accent)' }} />
            <span>File a Formal Transaction Claim</span>
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ANALYST REVIEW</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Transaction UUID</label>
            <input
              type="text"
              className="form-control font-mono"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              required
            />
            <div className="form-helper">
              The UUID of the settled or contested payment transaction from your payment activity ledger.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason & Evidence Circumstances</label>
            <textarea
              className="form-control"
              rows={4}
              placeholder="Detail the issue (e.g., Goods not delivered, duplicate offline debit, wrong amount settled)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <div className="form-helper">
              The platform automatically attaches digital signature telemetry and signed receipts to your dossier.
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={submitting || !isOnline}
          >
            {submitting ? (
              <span>Submitting Claim to Risk Operations...</span>
            ) : (
              <>
                <Send size={16} />
                <span>Submit Dispute for Analyst Review</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Filed Disputes Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <FileCheck size={18} style={{ color: 'var(--success)' }} />
            <span>My Filed Disputes & Resolutions</span>
          </span>
          <span className="badge badge-provisional font-mono">{disputes.length} claims</span>
        </div>
        <DataTable
          columns={columns}
          data={disputes}
          emptyMessage="You have not filed any transaction disputes."
        />
      </div>
    </div>
  );
}

export default RaiseDispute;
