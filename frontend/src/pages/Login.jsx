import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, LogIn, Flame, Eye, EyeOff, Key, Vote, Camera } from 'lucide-react';
import { Toast } from '../components/Toast';
import { QRScannerModal } from '../components/QRScannerModal';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [directCode, setDirectCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setToast({ message: 'Please enter both email and password', type: 'error' });
      return;
    }

    setLoading(true);
    setToast(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.message && err.message.toLowerCase().includes('invalid')
        ? 'Invalid email or password. If you don’t have an account, please Sign Up first.'
        : (err.message || 'Login failed. Please check your credentials.');
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDirectVoteSubmit = (e) => {
    e.preventDefault();
    if (!directCode.trim()) {
      setToast({ message: 'Please enter a 6-digit poll code', type: 'error' });
      return;
    }
    const cleanCode = directCode.trim().toUpperCase();
    navigate(`/poll/${cleanCode}`);
  };

  const handleScanSuccess = (scannedText) => {
    setShowScanner(false);
    // Parse URL if scanned text is full URL, else use raw code
    let code = scannedText.trim();
    if (code.includes('/poll/')) {
      const parts = code.split('/poll/');
      code = parts[parts.length - 1].split('?')[0].split('#')[0];
    }
    if (code) {
      navigate(`/poll/${code.toUpperCase()}`);
    } else {
      setToast({ message: 'Scanned text could not be recognized as a valid poll code', type: 'error' });
    }
  };

  return (
    <div className="container main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 160px)' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
      />

      <div className="glass-panel" style={{ position: 'relative', width: '100%', maxWidth: '460px', padding: '36px 36px 40px 36px' }}>
        
        {/* Compact Top-Right Corner Code Entry & Scanner Bar */}
        <div style={{
          position: 'absolute',
          top: '18px',
          right: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10
        }}>
          <form onSubmit={handleDirectVoteSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ position: 'relative' }}>
              <Key size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary)' }} />
              <input
                type="text"
                placeholder="Code"
                value={directCode}
                onChange={(e) => setDirectCode(e.target.value.toUpperCase())}
                maxLength={6}
                title="Enter 6-digit poll code to vote"
                style={{
                  padding: '5px 8px 5px 26px',
                  width: '92px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-glass-bright)',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '5px 10px', fontSize: '0.75rem', height: '28px', borderRadius: 'var(--radius-sm)' }}
              title="Vote Direct"
            >
              <Vote size={13} />
              Vote
            </button>
          </form>

          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="btn btn-secondary btn-icon"
            style={{ width: '28px', height: '28px', padding: 0, borderRadius: 'var(--radius-sm)' }}
            title="Scan QR Code with Camera"
          >
            <Camera size={14} color="var(--secondary)" />
          </button>
        </div>

        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '12px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'var(--gradient-brand)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 25px var(--shadow-glow)'
          }}>
            <Flame size={30} color="#fff" fill="#fff" style={{ opacity: 0.95 }} />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '6px', fontWeight: 800 }}>Welcome to Pollify</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Sign in to manage polls, or use top-right <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>Code Box / Camera</span> to vote.
          </p>
        </div>

        {/* Sign In Form */}
        <form onSubmit={handleLoginSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="email"
                className="form-input"
                style={{ paddingLeft: '44px' }}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                Forgot Password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: '44px', paddingRight: '44px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '12px', padding: '14px' }}
          >
            {loading ? 'Signing in...' : (
              <>
                <LogIn size={18} />
                Sign In & Go to Dashboard
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};
