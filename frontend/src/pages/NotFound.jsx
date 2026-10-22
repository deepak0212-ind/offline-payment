import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: 'var(--radius-xl)',
          background: 'rgba(244, 63, 94, 0.15)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          display: 'grid',
          placeItems: 'center',
          color: '#fb7185',
          marginBottom: '1.5rem',
          boxShadow: '0 0 30px rgba(244, 63, 94, 0.25)',
        }}
      >
        <ShieldAlert size={42} />
      </div>
      <h1
        style={{
          fontSize: '2.4rem',
          fontWeight: 800,
          marginBottom: '0.65rem',
          letterSpacing: '-0.03em',
        }}
      >
        404 — Ledger Node Not Found
      </h1>
      <p style={{ maxWidth: '440px', marginBottom: '2rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
        The requested offline payment resource, cryptographic route, or security terminal path does not exist on this network node.
      </p>
      <Link to="/dashboard" className="btn btn-primary btn-lg" style={{ gap: '0.65rem' }}>
        <ArrowLeft size={18} />
        <span>Return to Security Dashboard</span>
      </Link>
    </div>
  );
}

export default NotFound;
