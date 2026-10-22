import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { Wifi, WifiOff, LogOut, Zap } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const { isOnline, isSimulatedOffline, toggleSimulatedOffline } = useNetwork();

  const getRoleLabel = (role) => {
    if (role === 'analyst') return 'Risk & Security Analyst';
    if (role === 'merchant') return 'Merchant POS Terminal';
    return 'Customer Wallet';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="simple-navbar">
      <div className="navbar-status">
        <div
          className={`connection-pill ${isOnline ? 'is-online' : 'is-offline'}`}
          title={isOnline ? 'Direct Bank Gateway Active' : 'Operating via local Web Crypto & IndexedDB'}
        >
          <span className="status-dot" />
          {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>{isOnline ? 'Bank Gateway Connected' : 'Offline Mode (Local Storage)'}</span>
        </div>

        <button
          type="button"
          className={`btn btn-sm ${isSimulatedOffline ? 'btn-success' : 'btn-outline'}`}
          onClick={toggleSimulatedOffline}
          title="Toggle network simulation to test offline cryptographic payments"
          style={{ gap: '0.45rem' }}
        >
          <Zap size={14} />
          <span>{isSimulatedOffline ? 'Restore Online Link' : 'Simulate Offline'}</span>
        </button>
      </div>

      {user && (
        <div className="navbar-user">
          <div className="user-avatar-badge" title={`Logged in as ${user.username}`}>
            {getInitials(user.username)}
          </div>
          <div>
            <strong>{user.username}</strong>
            <span>{getRoleLabel(user.role)}</span>
          </div>
          <button
            type="button"
            className="logout-button"
            onClick={logout}
            aria-label="Log out"
            title="Log out of wallet"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </header>
  );
}

export default Navbar;
