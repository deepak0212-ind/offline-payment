import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { apiService } from '../api/client';
import { BalanceCard, StatusBadge, LoadingSpinner } from '../components/UIComponents';
import {
  ShieldAlert,
  AlertOctagon,
  FileQuestion,
  Layers,
  ArrowRight,
  CheckCircle,
  Activity,
} from 'lucide-react';

export function AnalystDashboard() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const [stats, setStats] = useState({
    totalTransactions: 0,
    flaggedCount: 0,
    openDisputes: 0,
    riskTiers: [],
  });
  const [recentFlags, setRecentFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalystStats() {
      setLoading(true);
      try {
        if (isOnline) {
          const [txRes, flagsRes, disputesRes, tiersRes] = await Promise.all([
            apiService.getAnalystTransactions(),
            apiService.getAnalystFlags(),
            apiService.getAnalystDisputes(),
            apiService.getRiskTiers(),
          ]);

          const txs = txRes.data || [];
          const flags = flagsRes.data || [];
          const disputes = disputesRes.data || [];
          const tiers = tiersRes.data || [];

          setStats({
            totalTransactions: txs.length,
            flaggedCount: flags.length,
            openDisputes: disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length,
            riskTiers: tiers,
          });

          setRecentFlags(flags.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to load analyst stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalystStats();
  }, [isOnline]);

  if (loading) return <LoadingSpinner message="Scanning fraud telemetry & cryptographic replay anomaly logs..." />;

  return (
    <div className="page-container">
      {/* Title Header */}
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">RISK & SURVEILLANCE OPERATIONS</p>
            <h1>
              <ShieldAlert size={28} style={{ color: 'var(--danger)' }} />
              <span>Security Operations & Telemetry</span>
            </h1>
            <p>Monitor double-spend collisions, counter rollbacks, nonce replay attacks, and adjudicate customer claims.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <span className="badge badge-flagged">
              <Activity size={12} />
              <span>Live Threat Guard</span>
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid-3" style={{ marginBottom: '2rem' }}>
        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--danger)',
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1) 0%, rgba(17, 24, 39, 0.8) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="eyebrow" style={{ color: '#fb7185' }}>
                FLAGGED & SUSPICIOUS CLAIMS
              </span>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#fb7185', marginTop: '0.2rem' }}>
                {stats.flaggedCount}
              </div>
            </div>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(244, 63, 94, 0.2)',
                display: 'grid',
                placeItems: 'center',
                color: '#fb7185',
              }}
            >
              <AlertOctagon size={26} />
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
            Double-spends, counter decrements, replay nonces
          </div>
        </div>

        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--warning)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(17, 24, 39, 0.8) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="eyebrow" style={{ color: '#fbbf24' }}>
                DISPUTES AWAITING REVIEW
              </span>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.2rem' }}>
                {stats.openDisputes}
              </div>
            </div>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'grid',
                placeItems: 'center',
                color: '#fbbf24',
              }}
            >
              <FileQuestion size={26} />
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
            Pending forensic investigation and reversal decisions
          </div>
        </div>

        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--primary)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(17, 24, 39, 0.8) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="eyebrow" style={{ color: '#a5b4fc' }}>
                NETWORK TRANSACTION LOGS
              </span>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                {stats.totalTransactions}
              </div>
            </div>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99, 102, 241, 0.2)',
                display: 'grid',
                placeItems: 'center',
                color: '#a5b4fc',
              }}
            >
              <Layers size={26} />
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
            Settled, offline provisional, and flagged records
          </div>
        </div>
      </div>

      {/* Grid: Recent Flags & Configured Risk Tiers */}
      <div className="grid-2">
        {/* Flagged Claims Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <AlertOctagon size={18} style={{ color: 'var(--danger)' }} />
              <span>Recent Flagged Claims</span>
            </span>
            <Link to="/analyst/flags" className="btn btn-sm btn-outline">
              <span>Inspect Queue</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {recentFlags.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <CheckCircle size={36} style={{ color: 'var(--success)', marginBottom: '0.6rem' }} />
              <div style={{ color: '#ffffff', fontWeight: 600 }}>Clean Security Posture</div>
              <p style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
                No double-spend collisions or signature replay attacks detected.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {recentFlags.map((f) => (
                <div
                  key={f.transaction_id}
                  style={{
                    padding: '0.95rem 1.15rem',
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <strong className="font-mono" style={{ fontSize: '0.86rem', color: '#ffffff' }}>
                      {f.transaction_id.slice(0, 12)}...
                    </strong>
                    <span style={{ fontWeight: 800, color: '#fb7185' }}>
                      ₹{(f.amount / 100).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#fecdd3', lineHeight: 1.4 }}>
                    {f.flag_reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Configured Risk Tiers */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Layers size={18} style={{ color: 'var(--primary)' }} />
              <span>Configured System Risk Tiers</span>
            </span>
            <span className="badge badge-settled">SYSTEM POLICIES</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {stats.riskTiers.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '1rem 1.25rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.96rem' }}>{t.name}</strong>
                  <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                    Max Reserve: ₹{(t.max_reserve_amount / 100).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Per-Payment Ceiling: ₹{(t.max_per_payment_limit / 100).toFixed(2)} • {t.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalystDashboard;
