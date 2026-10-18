import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Sun,
  Moon,
  ArrowRight,
  ShieldCheck,
  Zap,
  UserPlus,
  LogIn,
  User,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { mockStore, type AdminAccount } from '@/lib/mockData';

type AuthMode = 'signin' | 'signup';

const ADMIN_ROLES = [
  'Network Operations Admin',
  'Operations Director',
  'Station Fleet Manager',
  'Field Hardware Technician',
  'Billing & Compliance Auditor',
];

export const LoginPage: React.FC = () => {
  const { signIn, signUp, signInAsDemo, isLoading, authError, isConfigured } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<AuthMode>('signin');

  // Sign In fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sign Up fields
  const [fullName, setFullName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState(ADMIN_ROLES[0]);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // List existing admin accounts in local storage for quick selection
  const registeredAdmins: AdminAccount[] = mockStore.getAdmins();

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setLocalError('Please enter your administrator email address.');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (!result.success && result.error) {
      setLocalError(result.error);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }

    if (!signUpEmail.trim()) {
      setLocalError('Please enter a valid administrator email address.');
      return;
    }

    if (signUpPassword.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    if (signUpPassword !== confirmPassword) {
      setLocalError('Passwords do not match. Please re-enter carefully.');
      return;
    }

    setSubmitting(true);
    const result = await signUp({
      name: fullName,
      email: signUpEmail,
      password: signUpPassword,
      role: selectedRole,
    });
    setSubmitting(false);

    if (!result.success && result.error) {
      setLocalError(result.error);
    } else if (result.success && result.error) {
      // Info message returned (e.g. check email)
      setSuccessMsg(result.error);
    }
  };

  const handleQuickSelectAdmin = (admin: AdminAccount) => {
    setEmail(admin.email);
    setPassword(admin.password || 'admin');
    setLocalError(null);
    setSuccessMsg(null);
  };

  const displayedError = localError || authError;

  return (
    <div className="login-container">
      {/* Top right theme toggle */}
      <div className="login-top-bar">
        <button
          type="button"
          className="icon-button"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="login-card" style={{ maxWidth: '440px', width: '100%' }}>
        {/* Brand Header */}
        <div className="login-brand-header">
          <img
            src="/voltgrid-logo.jpg"
            alt="VoltGrid Logo"
            className="login-brand-logo"
          />
          <div>
            <h1 className="login-brand-title">
              Volt<span style={{ color: 'var(--accent-primary)' }}>Grid</span>
            </h1>
            <p className="login-brand-subtitle">EV Charging Network Operations</p>
          </div>
        </div>

        {/* Portal Kicker & Heading */}
        <div className="login-heading-section" style={{ marginBottom: '14px' }}>
          <div className="header-kicker" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ShieldCheck size={13} />
            <span>Administrator Access Control</span>
          </div>
          <h2 className="login-title">
            {mode === 'signin' ? 'Admin Portal Sign In' : 'Create Admin Account'}
          </h2>
          <p className="login-description" style={{ margin: '4px 0 0' }}>
            {mode === 'signin'
              ? 'Sign in to monitor live stations, manage fleet reservations, and inspect network telemetry.'
              : 'Register a new administrator profile with operational roles and telemetry access.'}
          </p>
        </div>

        {/* Auth Mode Tabs (Sign In vs Create Account) */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-secondary)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
            marginBottom: '16px',
            gap: '4px',
          }}
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => {
              setMode('signin');
              setLocalError(null);
              setSuccessMsg(null);
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: mode === 'signin' ? 600 : 500,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              background: mode === 'signin' ? 'var(--bg-surface)' : 'transparent',
              color: mode === 'signin' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: mode === 'signin' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
            }}
          >
            <LogIn size={13} />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => {
              setMode('signup');
              setLocalError(null);
              setSuccessMsg(null);
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: mode === 'signup' ? 600 : 500,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              background: mode === 'signup' ? 'var(--bg-surface)' : 'transparent',
              color: mode === 'signup' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
            }}
          >
            <UserPlus size={13} />
            <span>Create Account</span>
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--status-success-bg, rgba(16, 185, 129, 0.1))',
              border: '1px solid var(--status-success-border, rgba(16, 185, 129, 0.3))',
              color: 'var(--status-success, #10b981)',
              fontSize: '12px',
              lineHeight: '1.4',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}
            role="status"
          >
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {displayedError && (
          <div className="login-error-alert" role="alert" style={{ marginBottom: '14px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Authentication Error</strong>
              <p style={{ margin: '2px 0 0', fontSize: '12px', lineHeight: '1.4' }}>{displayedError}</p>
            </div>
          </div>
        )}

        {/* MODE 1: SIGN IN */}
        {mode === 'signin' && (
          <>
            {/* Quick Demo Mode Banner */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                  <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>One-Click Instant Access</strong>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {isConfigured ? 'Demo Telemetry' : 'Offline Mode'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signInAsDemo('admin@voltgrid.com')}
                className="primary-button"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  fontSize: '12px',
                  background: 'var(--accent-primary)',
                  color: '#000',
                  fontWeight: 600,
                }}
              >
                <Zap size={13} />
                <span>Launch as Primary Demo Admin</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Registered Admin Profiles (if custom admins exist) */}
            {registeredAdmins.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 600,
                  }}
                >
                  Registered Profiles (Click to fill)
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {registeredAdmins.map((adm) => (
                    <button
                      key={adm.id}
                      type="button"
                      onClick={() => handleQuickSelectAdmin(adm)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 9px',
                        borderRadius: 'var(--radius-sm)',
                        background: email === adm.email ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                        border: `1px solid ${email === adm.email ? 'var(--accent-border)' : 'var(--border-medium)'}`,
                        color: email === adm.email ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      title={`Role: ${adm.role}`}
                    >
                      <User size={11} />
                      <span style={{ fontWeight: 500 }}>{adm.name}</span>
                      <span style={{ opacity: 0.6, fontSize: '10px' }}>({adm.role.split(' ')[0]})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sign In Form */}
            <form onSubmit={handleSignInSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-email">
                  Administrator Email
                </label>
                <div className="login-input-wrap">
                  <Mail size={14} className="login-input-icon" />
                  <input
                    id="admin-email"
                    type="email"
                    className="form-input"
                    style={{ paddingLeft: '32px' }}
                    placeholder="admin@voltgrid.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={submitting || isLoading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="admin-password">
                  Password
                </label>
                <div className="login-input-wrap">
                  <Lock size={14} className="login-input-icon" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '32px', paddingRight: '36px' }}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={submitting || isLoading}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="secondary-button"
                disabled={submitting || isLoading}
                style={{ width: '100%', justifyContent: 'center', padding: '9px 16px', fontSize: '12px' }}
              >
                {submitting ? (
                  <>
                    <div className="pulse-dot warning" style={{ width: '8px', height: '8px' }} />
                    <span>Verifying Authorization...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* MODE 2: CREATE ADMIN ACCOUNT */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUpSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">
                Full Name
              </label>
              <div className="login-input-wrap">
                <User size={14} className="login-input-icon" />
                <input
                  id="signup-name"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '32px' }}
                  placeholder="e.g. Priyam Prajapati"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  disabled={submitting || isLoading}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">
                Administrator Email Address
              </label>
              <div className="login-input-wrap">
                <Mail size={14} className="login-input-icon" />
                <input
                  id="signup-email"
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '32px' }}
                  placeholder="name@voltgrid.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  autoComplete="email"
                  disabled={submitting || isLoading}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-role">
                Operational Role & Designation
              </label>
              <div className="login-input-wrap">
                <Briefcase size={14} className="login-input-icon" />
                <select
                  id="signup-role"
                  className="form-input"
                  style={{ paddingLeft: '32px' }}
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  disabled={submitting || isLoading}
                >
                  {ADMIN_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">
                Password (minimum 6 characters)
              </label>
              <div className="login-input-wrap">
                <Lock size={14} className="login-input-icon" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: '32px', paddingRight: '36px' }}
                  placeholder="••••••••••••"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={submitting || isLoading}
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm-password">
                Confirm Password
              </label>
              <div className="login-input-wrap">
                <Lock size={14} className="login-input-icon" />
                <input
                  id="signup-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: '32px' }}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={submitting || isLoading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={submitting || isLoading}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '10px 16px',
                fontSize: '12px',
                background: 'var(--accent-primary)',
                color: '#000',
                fontWeight: 600,
                marginTop: '6px',
              }}
            >
              {submitting ? (
                <>
                  <div className="pulse-dot warning" style={{ width: '8px', height: '8px' }} />
                  <span>Registering Administrator...</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>Register Administrator & Open Portal</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security & Setup Note */}
        <div className="login-footer-note" style={{ marginTop: '16px' }}>
          <small>
            Protected by PostgreSQL Row Level Security (RLS). All accounts created receive verified administrator credentials.
          </small>
        </div>
      </div>
    </div>
  );
};
