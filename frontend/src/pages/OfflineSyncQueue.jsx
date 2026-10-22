import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { getSyncQueue, updateSyncQueueItem, removeFromSyncQueue } from '../db/indexedDB';
import { apiService } from '../api/client';
import { StatusBadge, DataTable, LoadingSpinner, ErrorMessage } from '../components/UIComponents';
import {
  RefreshCw,
  CheckCircle,
  UploadCloud,
  Trash2,
} from 'lucide-react';

export function OfflineSyncQueue() {
  const { isOnline } = useNetwork();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      const items = await getSyncQueue();
      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setQueue(items);
    } catch (err) {
      console.error('Error reading sync queue:', err);
      setErrorMsg('Failed to read IndexedDB sync queue.');
    } finally {
      setLoading(false);
    }
  }

  const handleSyncAll = async () => {
    if (!isOnline) {
      setErrorMsg('Cannot synchronize while offline. Please reconnect or disable simulation.');
      return;
    }

    const pendingItems = queue.filter((item) => item.local_status !== 'SETTLED');
    if (pendingItems.length === 0) {
      setErrorMsg('No pending transactions to synchronize.');
      return;
    }

    setSyncing(true);
    setErrorMsg('');
    setSyncResults(null);

    const payloadItems = pendingItems.map((item) => ({
      token_payload: item.token_payload,
      token_signature: item.token_signature,
      payer_public_key: item.payer_public_key,
      certificate: item.certificate,
      receipt: item.receipt || null,
    }));

    try {
      const response = await apiService.syncTransactions(payloadItems);
      const data = response.data;
      setSyncResults(data);

      for (const res of data.results) {
        const localItem = queue.find((q) => q.transaction_id === res.transaction_id);
        if (localItem) {
          localItem.local_status = res.status;
          localItem.server_message = res.message;
          localItem.flag_reason = res.flag_reason;
          localItem.settled_amount = res.settled_amount;
          localItem.synced_at = new Date().toISOString();
          await updateSyncQueueItem(localItem);
        }
      }

      await loadQueue();
    } catch (err) {
      console.error('Synchronization error:', err);
      setErrorMsg(err.response?.data?.detail || 'Network error during synchronization. Queued items are safely preserved.');
    } finally {
      setSyncing(false);
    }
  };

  const handleRemove = async (txId) => {
    await removeFromSyncQueue(txId);
    await loadQueue();
  };

  if (loading) return <LoadingSpinner message="Scanning local IndexedDB offline sync queue..." />;

  const queueColumns = [
    {
      header: 'Transaction ID & Proof',
      accessor: 'transaction_id',
      render: (item) => (
        <div>
          <span className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent)' }}>
            {item.transaction_id.slice(0, 10)}...
          </span>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Nonce: <span className="font-mono">{item.token_payload?.nonce?.slice(0, 8)}...</span> • Counter: <strong>#{item.token_payload?.counter}</strong>
          </div>
        </div>
      ),
    },
    {
      header: 'Amount Claimed',
      accessor: 'amount',
      render: (item) => (
        <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>
          ₹{((item.token_payload?.amount || 0) / 100).toFixed(2)}
        </strong>
      ),
    },
    {
      header: 'Local Timestamp',
      accessor: 'created_at',
      render: (item) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {new Date(item.created_at).toLocaleTimeString()}
        </span>
      ),
    },
    {
      header: 'Receipt Evidence',
      accessor: 'receipt',
      render: (item) => (
        <span
          className="badge"
          style={{
            background: item.receipt ? 'var(--success-bg)' : 'rgba(255, 255, 255, 0.04)',
            color: item.receipt ? '#34d399' : 'var(--text-muted)',
            border: `1px solid ${item.receipt ? 'var(--success-border)' : 'var(--border-subtle)'}`,
          }}
        >
          {item.receipt ? 'Merchant Signed' : 'Customer Token'}
        </span>
      ),
    },
    {
      header: 'Settlement Status',
      accessor: 'local_status',
      render: (item) => (
        <div>
          <StatusBadge status={item.local_status} />
          {item.server_message && (
            <div
              style={{
                fontSize: '0.74rem',
                color: item.local_status === 'FLAGGED' ? '#fb7185' : 'var(--text-muted)',
                marginTop: '4px',
                maxWidth: '220px',
              }}
            >
              {item.server_message}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (item) =>
        item.local_status === 'SETTLED' ? (
          <button
            type="button"
            onClick={() => handleRemove(item.transaction_id)}
            className="btn btn-sm btn-outline"
            style={{ color: 'var(--text-muted)', padding: '0.35rem 0.6rem' }}
            title="Purge settled transaction from local storage"
          >
            <Trash2 size={14} />
          </button>
        ) : null,
    },
  ];

  const pendingCount = queue.filter((q) => q.local_status !== 'SETTLED').length;

  return (
    <div className="page-container">
      {/* Title Header */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">RECONCILIATION & BATCH SETTLEMENT</p>
            <h1>
              <RefreshCw size={28} style={{ color: 'var(--accent)' }} />
              <span>Offline Synchronization Queue</span>
            </h1>
            <p>Locally preserved IndexedDB payments awaiting cryptographic submission and settlement with the bank.</p>
          </div>

          <button
            type="button"
            onClick={handleSyncAll}
            className="btn btn-primary btn-lg"
            disabled={syncing || pendingCount === 0 || !isOnline}
          >
            {syncing ? (
              <>
                <RefreshCw size={18} className="spin-slow" />
                <span>Synchronizing with Bank...</span>
              </>
            ) : (
              <>
                <UploadCloud size={18} />
                <span>Upload & Settle ({pendingCount} Pending)</span>
              </>
            )}
          </button>
        </div>
      </div>

      <ErrorMessage error={errorMsg} />

      {/* Sync Summary Result Banner */}
      {syncResults && (
        <div
          className="alert alert-info"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            marginBottom: '1.75rem',
            background: 'var(--info-bg)',
            border: '1px solid var(--info-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: 800, color: 'var(--info-text)' }}>
            <CheckCircle size={20} />
            <span>
              Batch Settlement Complete: {syncResults.settled} settled, {syncResults.flagged} flagged out of {syncResults.processed} processed.
            </span>
          </div>
          <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            {syncResults.results.map((r, i) => (
              <div key={i} style={{ marginTop: '0.35rem' }}>
                • <strong className="font-mono" style={{ color: 'var(--text-main)' }}>{r.transaction_id.slice(0, 10)}</strong>: {r.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend & Guide Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1.25rem',
          flexWrap: 'wrap',
          marginBottom: '1.6rem',
          padding: '1rem 1.4rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          fontSize: '0.84rem',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatusBadge status="ACCEPTED_OFFLINE" />
          <span style={{ color: 'var(--text-secondary)' }}>Verified locally, ready for upload</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatusBadge status="SETTLED" />
          <span style={{ color: 'var(--text-secondary)' }}>Final server ledger settlement applied</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatusBadge status="FLAGGED" />
          <span style={{ color: 'var(--text-secondary)' }}>Flagged (Double-spend attempt, nonce replay)</span>
        </div>
      </div>

      {/* Queue Table Card */}
      <div className="card">
        <DataTable
          columns={queueColumns}
          data={queue}
          emptyMessage="Your offline sync queue is currently empty. Generated payments and receipts will appear here."
        />
      </div>
    </div>
  );
}

export default OfflineSyncQueue;
