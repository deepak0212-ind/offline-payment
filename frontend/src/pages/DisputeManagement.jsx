import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import {
  FileQuestion,
  CheckCircle,
  XCircle,
  Eye,
  Scale,
  X,
} from 'lucide-react';

export function DisputeManagement() {
  const { isOnline } = useNetwork();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [activeDispute, setActiveDispute] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');
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
        const res = await apiService.getAnalystDisputes();
        setDisputes(res.data || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load disputes list.');
    } finally {
      setLoading(false);
    }
  }

  const handleDecide = async (decision) => {
    if (!activeDispute) return;
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiService.decideDispute(activeDispute.dispute_id, decision, decisionNotes);
      setSuccessMsg(`Dispute decided as ${decision}. Financial reversal and audit log applied.`);
      setActiveDispute(null);
      setDecisionNotes('');
      await loadDisputes();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = disputes.filter((d) => {
    if (filter === 'OPEN' && d.status !== 'OPEN') return false;
    if (filter === 'RESOLVED_REFUNDED' && d.status !== 'RESOLVED_REFUNDED') return false;
    if (filter === 'RESOLVED_REJECTED' && d.status !== 'RESOLVED_REJECTED') return false;
    return true;
  });

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
      header: 'User Reason Claim',
      accessor: 'reason',
      render: (d) => <span style={{ fontSize: '0.86rem' }}>{d.reason}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (d) => {
        let badgeType = 'pending';
        if (d.status === 'RESOLVED_REFUNDED') badgeType = 'settled';
        if (d.status === 'RESOLVED_REJECTED') badgeType = 'rejected';
        return <span className={`badge badge-${badgeType}`}>{d.status}</span>;
      },
    },
    {
      header: 'Filing Date',
      accessor: 'created_at',
      render: (d) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {new Date(d.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Adjudicate',
      accessor: 'action',
      render: (d) => (
        <button
          type="button"
          onClick={() => {
            setActiveDispute(d);
            setDecisionNotes(d.decision_notes || '');
          }}
          className="btn btn-sm btn-outline"
          style={{ gap: '0.45rem', padding: '0.35rem 0.7rem' }}
        >
          <Eye size={14} />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Loading analyst disputes and evidence dossiers..." />;

  let parsedEvidence = null;
  if (activeDispute && activeDispute.evidence_bundle_json) {
    try {
      parsedEvidence = JSON.parse(activeDispute.evidence_bundle_json);
    } catch (e) {
      parsedEvidence = activeDispute.evidence_bundle_json;
    }
  }

  return (
    <div className="page-container">
      {/* Title Header */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">ARBITRATION & LEGAL DOSSIERS</p>
            <h1>
              <Scale size={28} style={{ color: 'var(--primary)' }} />
              <span>Dispute Adjudication Workspace</span>
            </h1>
            <p>Inspect attached cryptographic evidence bundles and execute authoritative refund reversals.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <span className="badge badge-provisional font-mono">
              {filtered.length} dossiers
            </span>
          </div>
        </div>
      </div>

      <ErrorMessage error={errorMsg} onRetry={loadDisputes} />

      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <CheckCircle size={19} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="card" style={{ padding: '0.9rem 1.25rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['ALL', 'OPEN', 'RESOLVED_REFUNDED', 'RESOLVED_REJECTED'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No disputes matching selected filter."
        />
      </div>

      {/* Adjudication Modal Dialog */}
      {activeDispute && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 15, 0.82)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '720px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl), 0 0 50px rgba(0, 0, 0, 0.8)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <div className="card-header" style={{ marginBottom: '1.25rem' }}>
              <span className="card-title">
                <FileQuestion size={19} style={{ color: 'var(--accent)' }} />
                <span>Dispute Dossier #{activeDispute.dispute_id.slice(0, 8)}</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveDispute(null)}
                className="btn btn-sm btn-outline"
                style={{ padding: '0.3rem 0.6rem' }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <span className="form-label">User Dispute Claim:</span>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.96rem',
                  color: '#ffffff',
                  marginTop: '0.25rem',
                  padding: '0.85rem 1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {activeDispute.reason}
              </div>
            </div>

            {/* Evidence Bundle */}
            <div style={{ marginBottom: '1.5rem' }}>
              <span className="form-label">Attached Cryptographic Evidence Bundle</span>
              <pre
                style={{
                  padding: '1rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  color: 'var(--text-main)',
                }}
              >
                {JSON.stringify(parsedEvidence, null, 2)}
              </pre>
            </div>

            {/* Adjudication Decision Workspace */}
            {activeDispute.status === 'OPEN' || activeDispute.status === 'UNDER_REVIEW' ? (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.4rem' }}>
                <div className="form-group">
                  <label className="form-label">Analyst Ruling Findings & Audit Justification</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Provide justification for refund approval or rejection..."
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={() => handleDecide('RESOLVED_REJECTED')}
                    className="btn btn-danger"
                    disabled={submitting}
                  >
                    <XCircle size={16} />
                    <span>Reject Claim</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecide('RESOLVED_REFUNDED')}
                    className="btn btn-success"
                    disabled={submitting}
                  >
                    <CheckCircle size={16} />
                    <span>Approve & Refund Payer</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.88rem',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>Adjudicated Ruling:</strong>
                  <span className="badge badge-settled">{activeDispute.status}</span>
                </div>
                <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  Audit Notes: {activeDispute.decision_notes || 'None recorded'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DisputeManagement;
