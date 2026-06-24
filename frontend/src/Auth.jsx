import { useState, useRef } from 'react';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import './Auth.css';

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyChecking, setVerifyChecking] = useState(false);
  const [verifyResent, setVerifyResent] = useState(false);
  const verifyTimerRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        if (!auth.currentUser.emailVerified) {
          setVerifyEmail(email);
          setShowVerify(true);
          return;
        }
        onAuthSuccess();
      } else {
        if (!name) throw new Error("Display Name is required!");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await sendEmailVerification(userCredential.user);
        setVerifyEmail(email);
        setShowVerify(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setVerifyChecking(true);
    setError('');
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        onAuthSuccess();
      } else {
        setError("Email not verified yet. Please check your inbox.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyChecking(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await sendEmailVerification(auth.currentUser);
      setVerifyResent(true);
      if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = setTimeout(() => setVerifyResent(false), 5000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) { setError('Enter your email'); return; }
    setForgotLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      setForgotSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  if (showVerify) {
    return (
      <div className="auth-wrapper">
        <div className="auth-brand">
          <div className="auth-brand-icon">♟</div>
          <h1>Tactic Flow</h1>
          <p>Verify your email to continue</p>
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📧</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Verify your email</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>
              We sent a verification email to <strong>{verifyEmail}</strong>. Click the link in the email, then come back here.
            </p>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-primary auth-submit-btn" onClick={handleCheckVerification} disabled={verifyChecking} style={{ marginTop: '0.5rem' }}>
              {verifyChecking ? 'Checking...' : 'I\'ve verified — Check'}
            </button>
            <button className="btn auth-submit-btn" onClick={handleResendVerification} style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', width: '100%' }}>
              {verifyResent ? 'Sent!' : 'Resend email'}
            </button>
            <button className="btn auth-submit-btn" onClick={() => { signOut(auth); setShowVerify(false); setEmail(''); setPassword(''); setError(''); }} style={{ marginTop: '0.35rem', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.04)', width: '100%' }}>
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showForgot) {
    return (
      <div className="auth-wrapper">
        <div className="auth-brand">
          <div className="auth-brand-icon">♟</div>
          <h1>Tactic Flow</h1>
          <p>Reset your password</p>
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card">
            {error && <div className="auth-error">{error}</div>}
            {forgotSent ? (
              <>
                <div className="auth-success">Password reset email sent! Check your inbox.</div>
                <button className="btn btn-primary auth-submit-btn" style={{ marginTop: '1rem', width: '100%' }} onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}>Back to Login</button>
              </>
            ) : (
              <form className="auth-form" onSubmit={(e) => { e.preventDefault(); handleForgotPassword(); }}>
                <div className="input-group">
                  <label>Email</label>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="Enter your email" required />
                </div>
                <button type="submit" className="btn btn-primary auth-submit-btn" disabled={forgotLoading}>
                  {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button type="button" className="btn auth-submit-btn" style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', width: '100%' }} onClick={() => { setShowForgot(false); setError(''); }}>Cancel</button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-brand">
        <div className="auth-brand-icon">♟</div>
        <h1>Tactic Flow</h1>
        <p>Master your game with AI-powered chess training and online matches.</p>
      </div>
      <div className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-mode-toggle">
            <button className={`auth-mode-btn ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Log In</button>
            <button className={`auth-mode-btn ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Register</button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="input-group">
                <label>Display Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Grandmaster..." required />
              </div>
            )}

            <div className="input-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="player@chessx.com" required />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>

            {isLogin && (
              <div style={{ textAlign: 'right', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
                <span className="auth-forgot-link" onClick={() => { setShowForgot(true); setForgotEmail(email); setError(''); }}>Forgot Password?</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
              {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
            </button>
          </form>

          <p className="auth-toggle-text">
            {isLogin ? "Don't have an account? " : "Already have one? "}
            <span onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "Register" : "Log In"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}