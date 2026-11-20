import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Login.css';

const TOKEN_KEY = 'band_buddy_access_token';

export default function Login() {
  const navigate = useNavigate();
  const submittingRef = useRef(false);
  const googleButtonRef = useRef(null);

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    const button = googleButtonRef.current;
    const script = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (!clientId || !button || !script) {
      setMessage('Google sign-in setup is incomplete.');
      return;
    }

    let active = true;

    async function handleGoogleCredential({ credential }) {
      if (!active || !credential || submittingRef.current) return;

      submittingRef.current = true;
      setIsSubmitting(true);
      setMessage('');

      try {
        const { data } = await api.post('/auth/google', { credential });
        if (!active) return;

        const token = data.access_token;

        if (typeof token !== 'string' || !token) {
          setMessage('Unable to complete Google sign-in. Please try again.');
          return;
        }

        sessionStorage.setItem(TOKEN_KEY, token);
        navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard', {
          replace: true,
        });
      } catch (error) {
        if (!active) return;

        const detail = error.response?.data?.detail;
        setMessage(
          typeof detail === 'string'
            ? detail
            : 'Unable to complete Google sign-in. Please try again.'
        );
      } finally {
        submittingRef.current = false;
        if (active) setIsSubmitting(false);
      }
    }

    function renderGoogleButton() {
      const googleSignIn = window.google?.accounts?.id;
      if (!active || !googleSignIn) return;

      googleSignIn.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
      });

      button.replaceChildren();
      googleSignIn.renderButton(button, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
      });
    }

    function showLoadError() {
      if (active) {
        setMessage('Could not load Google sign-in. Refresh and try again.');
      }
    }

    script.addEventListener('load', renderGoogleButton);
    script.addEventListener('error', showLoadError);
    renderGoogleButton();

    return () => {
      active = false;
      script.removeEventListener('load', renderGoogleButton);
      script.removeEventListener('error', showLoadError);
      button.replaceChildren();
    };
  }, [navigate]);

  async function handleLogin(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    submittingRef.current = true;
    setIsSubmitting(true);
    setMessage('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      const token = data.access_token;

      if (typeof token !== 'string' || !token) {
        setMessage('Unable to complete login. Please try again.');
        return;
      }

      sessionStorage.setItem(TOKEN_KEY, token);
      form.reset();
      setShowPassword(false);

      navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard', {
        replace: true,
      });
    } catch (error) {
      if (error.response?.status === 401) {
        setMessage('Incorrect email or password.');
      } else if (error.response?.status === 422) {
        setMessage('Please check your email and password.');
      } else {
        setMessage('Unable to complete login. Please try again.');
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bl-page bl-login-page">
      <header className="bl-header">
        <Link to="/" aria-label="Band Buddy home">
          <img className="bl-logo" src="/images/logo.png" alt="Band Buddy" />
        </Link>

        <Link className="bl-back" to="/">
          ← Back to home
        </Link>
      </header>

      <main className="bl-main">
        <div className="bl-layout">
          <section className="bl-form-section" aria-labelledby="login-heading">
            <h1 id="login-heading">Welcome back.</h1>
            <p className="bl-intro">A little practice. A little progress.</p>

            <form onSubmit={handleLogin} aria-busy={isSubmitting}>
              <div className="bl-field">
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="Enter your email address"
                  maxLength={254}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="bl-field">
                <label htmlFor="login-password">Password</label>
                <div className="bl-password">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    maxLength={128}
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={isSubmitting}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="bl-forgot">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setMessage('Password reset is not available yet.')}
                >
                  Forgot password?
                </button>
              </div>

              <button className="bl-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Logging in…' : 'Log in →'}
              </button>
            </form>

            <div className="bl-divider">
              <span>or</span>
            </div>

            <div ref={googleButtonRef} />

            {message && (
              <p className="bl-message" role="status">
                {message}
              </p>
            )}

            <p className="bl-register">
              New to Band Buddy? <Link to="/register">Create an account</Link>
            </p>
          </section>

          <figure className="bl-art-section">
            <img
              className="bl-illustration"
              src="/images/login-student-navy.png"
              alt="Student in a navy cardigan holding a laptop"
            />
            <figcaption>Your next step starts here.</figcaption>
          </figure>
        </div>
      </main>

      <footer className="bl-login-footer">
        Band Buddy · Small steps. Meaningful progress.
      </footer>
    </div>
  );
}