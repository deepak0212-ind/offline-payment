import React from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  ShieldCheck,
  RotateCw,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';

export function StatusBadge({ status }) {
  const norm = (status || '').toUpperCase();

  if (norm === 'SETTLED' || norm === 'RESOLVED_REFUNDED') {
    return (
      <span className="badge badge-settled">
        <CheckCircle size={13} strokeWidth={2.5} />
        <span>{norm === 'RESOLVED_REFUNDED' ? 'Refunded' : 'Settled'}</span>
      </span>
    );
  }

  if (norm === 'ACCEPTED_OFFLINE' || norm === 'ACCEPTED' || norm === 'OFFLINE_CACHED') {
    return (
      <span className="badge badge-provisional">
        <Clock size={13} strokeWidth={2.5} />
        <span>Accepted (Offline)</span>
      </span>
    );
  }

  if (norm === 'FLAGGED' || norm.includes('DOUBLE') || norm.includes('REPLAY')) {
    return (
      <span className="badge badge-flagged">
        <ShieldAlert size={13} strokeWidth={2.5} />
        <span>Security Flagged</span>
      </span>
    );
  }

  if (norm === 'REJECTED' || norm === 'RESOLVED_REJECTED') {
    return (
      <span className="badge badge-rejected">
        <XCircle size={13} strokeWidth={2.5} />
        <span>Rejected</span>
      </span>
    );
  }

  if (norm === 'SYNCING') {
    return (
      <span className="badge badge-syncing">
        <RotateCw size={13} className="spin-slow" strokeWidth={2.5} />
        <span>Syncing</span>
      </span>
    );
  }

  return (
    <span className="badge badge-pending">
      <Clock size={13} strokeWidth={2.5} />
      <span>{norm || 'Pending'}</span>
    </span>
  );
}

export function BalanceCard({ title, amountPaise, subtitle, icon: Icon, color = 'primary' }) {
  const inrValue = (amountPaise || 0) / 100;
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
        <div>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {title}
          </span>
          <div
            style={{
              fontSize: '1.9rem',
              fontWeight: 800,
              color: '#ffffff',
              marginTop: '0.35rem',
              letterSpacing: '-0.03em',
            }}
          >
            ₹{inrValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        {Icon && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.2))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#a5b4fc',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)',
            }}
          >
            <Icon size={22} />
          </div>
        )}
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        {subtitle || `${(amountPaise || 0).toLocaleString()} paise (Stored locally)`}
      </div>
    </div>
  );
}

export function LoadingSpinner({ message = 'Synchronizing cryptographic state...' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        minHeight: '260px',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '54px',
          height: '54px',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid rgba(99, 102, 241, 0.15)',
            borderTopColor: 'var(--primary)',
            animation: 'spin-fast 0.9s cubic-bezier(0.55, 0.25, 0.25, 0.7) infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '8px',
            borderRadius: '50%',
            border: '2px solid rgba(6, 182, 212, 0.15)',
            borderTopColor: 'var(--accent)',
            animation: 'spin-reverse 1.4s linear infinite',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '0.92rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          letterSpacing: '0.01em',
        }}
      >
        {message}
      </span>
      <style>{`
        @keyframes spin-fast {
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          to { transform: rotate(-360deg); }
        }
        .spin-slow {
          animation: spin-fast 2s linear infinite;
        }
      `}</style>
    </div>
  );
}

export function ErrorMessage({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
        <span>{error}</span>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-sm btn-outline">
          Retry Action
        </button>
      )}
    </div>
  );
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  isDanger = false,
}) {
  if (!isOpen) return null;
  return (
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
        padding: '1.25rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '460px',
          width: '100%',
          boxShadow: 'var(--shadow-xl), 0 0 40px rgba(0, 0, 0, 0.8)',
          border: '1px solid var(--border-medium)',
        }}
      >
        <h3 style={{ marginBottom: '0.85rem', color: '#ffffff' }}>{title}</h3>
        <p style={{ marginBottom: '1.6rem', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem' }}>
          <button type="button" onClick={onCancel} className="btn btn-outline">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OfflineIndicator() {
  return null;
}

export function DataTable({ columns, data, emptyMessage = 'No records found' }) {
  if (!data || data.length === 0) {
    return (
      <div
        className="empty-state"
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <HelpCircle size={32} style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }} />
        <strong>{emptyMessage}</strong>
        <p>Items will appear automatically once transactions or records are processed.</p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} style={{ width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {columns.map((col, colIdx) => (
                <td key={colIdx}>
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
