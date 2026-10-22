import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  Eye,
  EyeOff,
  User,
  Store,
  Shield,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiService } from '../api/client';

export function Login() {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeQuickRole, setActiveQuickRole] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        await apiService.register({
          full_name: fullName,
          username,
          email,
          password,
          confirm_password: confirmPassword,
        });
        setIsRegistering(false);
        setPassword('');
        setConfirmPassword('');
        setSuccess('Account created! You can now sign in.');
        setLoading(false);
        return;
      }

      const user = await login(username, password);
      if (user.role === 'analyst') {
        navigate('/analyst');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (uname, pwd, roleKey) => {
    setError('');
    setActiveQuickRole(roleKey);
    setLoading(true);
    try {
      setUsername(uname);
      setPassword(pwd);
      const user = await login(uname, pwd);
      if (user.role === 'analyst') {
        navigate('/analyst');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || `Could not sign in as ${uname}`);
      setActiveQuickRole(null);
      setLoading(false);
    }
  };

  const demoPresets = [
    { id: 'customer1', label: 'Customer 1', role: 'Payer', icon: User, username: 'customer1' },
    { id: 'customer2', label: 'Customer 2', role: 'Second Payer', icon: User, username: 'customer2' },
    { id: 'merchant', label: 'Merchant', role: 'Payee POS', icon: Store, username: 'merchant' },
    { id: 'analyst', label: 'Analyst', role: 'Security Desk', icon: Shield, username: 'analyst' },
  ];

  return (
    <div className="human-login-wrapper">
      <div className="human-login-card">
        {/* Brand Header */}
        <div className="human-login-header">
          <div className="human-brand-icon">
            <Wallet size={24} />
          </div>
          <h1 className="human-brand-title">OfflinePay</h1>
          <p className="human-brand-subtitle">
            {isRegistering
              ? 'Create an account to start testing offline payments'
              : 'Sign in to access your offline wallet & receipts'}
          </p>
        </div>

        {/* Demo Fast Switcher */}
        {!isRegistering && (
          <div className="human-demo-box">
            <span className="human-demo-label">Demo Quick Login</span>
            <div className="human-demo-pills">
              {demoPresets.map((item) => {
                const Icon = item.icon;
                const isSelected = activeQuickRole === item.id && loading;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickLogin(item.username, 'DemoPass123!', item.id)}
                    className={`human-demo-pill ${isSelected ? 'is-loading' : ''}`}
                    title={`Log in as ${item.username}`}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Alerts */}
        {error && (
          <div className="human-alert human-alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="human-alert human-alert-success">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="human-form">
          {isRegistering && (
            <div className="human-field">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                placeholder="e.g. John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="human-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="e.g. customer1, merchant"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          {isRegistering && (
            <div className="human-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="e.g. name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          )}

          <div className="human-field">
            <div className="human-field-header">
              <label htmlFor="password">Password</label>
              {!isRegistering && (
                <span className="human-hint">Password: DemoPass123!</span>
              )}
            </div>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isRegistering && (
            <div className="human-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="human-submit-btn"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : isRegistering ? (
              <span>Create Account</span>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer switch */}
        <div className="human-login-footer">
          {isRegistering ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="human-link"
                onClick={() => {
                  setIsRegistering(false);
                  setError('');
                  setSuccess('');
                }}
              >
                Sign in
              </button>
            </p>
          ) : (
            <p>
              New here?{' '}
              <button
                type="button"
                className="human-link"
                onClick={() => {
                  setIsRegistering(true);
                  setError('');
                  setSuccess('');
                }}
              >
                Create an account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
