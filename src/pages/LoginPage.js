import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const totpInputRef = useRef(null);

  useEffect(() => {
    if (needs2FA && totpInputRef.current) {
      totpInputRef.current.focus();
    }
  }, [needs2FA]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password, needs2FA ? totpCode : undefined);
      
      if (result?.requires2FA) {
        setNeeds2FA(true);
        setTotpCode('');
        setLoading(false);
        return;
      }
      
      navigate('/inventory');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
      if (needs2FA) setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTotpCode(val);
  };

  const handleBack = () => {
    setNeeds2FA(false);
    setTotpCode('');
    setPassword('');
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 40,
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img 
            src="/logo.png" 
            alt="Carolina Rolling Co." 
            style={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%',
              margin: '0 auto 16px',
              display: 'block'
            }} 
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 4 }}>
            CR Admin
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            {needs2FA ? 'Two-Factor Authentication' : 'Carolina Rolling Inventory System'}
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        {!needs2FA ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 8 }}
              disabled={loading}
            >
              <LogIn size={18} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Shield size={48} style={{ color: '#1976d2', marginBottom: 12 }} />
              <p style={{ color: '#333', fontSize: '0.95rem', marginBottom: 4 }}>
                Enter the 6-digit code from your authenticator app
              </p>
              <p style={{ color: '#999', fontSize: '0.8rem' }}>
                Google Authenticator, Authy, or similar
              </p>
            </div>
            <div className="form-group">
              <input
                ref={totpInputRef}
                type="text"
                className="form-input"
                value={totpCode}
                onChange={handleTotpChange}
                placeholder="000000"
                maxLength={6}
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                style={{ 
                  textAlign: 'center', 
                  fontSize: '2rem', 
                  letterSpacing: '0.5em',
                  fontFamily: 'monospace',
                  padding: '12px 16px'
                }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 8 }}
              disabled={loading || totpCode.length !== 6}
            >
              <Shield size={18} />
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={handleBack}
              style={{ 
                width: '100%', marginTop: 12, padding: '10px',
                background: 'none', border: 'none', color: '#666', 
                cursor: 'pointer', fontSize: '0.9rem' 
              }}
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
