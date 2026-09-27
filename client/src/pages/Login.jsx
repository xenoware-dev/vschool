import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Building2,
  CalendarDays,
  TrendingUp,
  Code,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import { Alert, Spinner, cx } from '../components/ui';

const features = [
  { icon: Building2, title: 'Multi-branch administration', text: 'Manage every centre, team and caseload from one account.' },
  { icon: CalendarDays, title: 'Cross-department scheduling', text: 'Coordinate therapy, classroom and assessment sessions.' },
  { icon: TrendingUp, title: 'Progress tracking for parents', text: 'Share milestones and session notes with families securely.' },
];

// Quick-fill for dev testing
const devLogins = [
  { role: 'Owner', email: 'owner@vschool.com' },
  { role: 'Admin · GDV', email: 'admin.guduvancherry@vschool.com' },
  { role: 'Admin · VDL', email: 'admin.vandalur@vschool.com' },
  { role: 'Therapist', email: 'speech.gdv@vschool.com' },
  { role: 'Teacher', email: 'teacher.gdv@vschool.com' },
  { role: 'Parent', email: 'parent.gdv@example.com' },
];

const Login = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      {/* ─── LEFT PANEL (Branding) ────────────────────────────────────────── */}
      <aside className="auth-panel-left">
        <div className="auth-brand">
          <BrandMark size={40} />
          <div className="auth-brand-name">
            <h1>Absolute</h1>
            <p>Special School &amp; Therapy Care</p>
          </div>
        </div>

        <div className="auth-hero">
          <span className="auth-eyebrow">Therapy &amp; education management</span>
          <h2>Streamlined care,<br />better outcomes.</h2>
          <p>
            One platform for pediatric therapy centres — coordinate departments,
            track each child&apos;s progress, and keep parents informed.
          </p>

          <ul className="auth-features">
            {features.map((f) => (
              <li key={f.title} className="auth-feature">
                <span className="auth-feature-icon"><f.icon size={18} /></span>
                <div>
                  <div className="auth-feature-title">{f.title}</div>
                  <div className="auth-feature-text">{f.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="auth-left-footer">
          © {new Date().getFullYear()} Absolute Special School &amp; Therapy Care
        </div>
      </aside>

      {/* ─── RIGHT PANEL (Form) ───────────────────────────────────────────── */}
      <main className="auth-panel-right">
        <div className="auth-form-container">
          <div className="auth-mobile-brand">
            <BrandMark size={36} />
            <span>Absolute</span>
          </div>

          <div className="auth-form-header">
            <h2>Sign in</h2>
            <p>Welcome back. Enter your credentials to access your dashboard.</p>
          </div>

          {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="field">
              <label className="field-label" htmlFor="email">Email address</label>
              <div className="input-wrap">
                <span className="input-icon"><Mail size={16} /></span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="input input-lg"
                  placeholder="name@example.com"
                  autoComplete="email"
                  autoFocus
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <div className="input-wrap">
                <span className="input-icon"><Lock size={16} /></span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input input-lg pr-11"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <span className="input-trailing">
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block mt-1" disabled={loading}>
              {loading ? <><Spinner /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="auth-help">
            Trouble signing in? Contact your branch administrator to reset your access.
          </p>

          {/* Dev Quick Login */}
          {import.meta.env.DEV && (
            <details className="dev-panel">
              <summary>
                <span className="dev-panel-tag"><Code size={12} /> Dev</span>
                Quick sign-in accounts
                <ChevronDown size={14} className="dev-panel-chevron" />
              </summary>
              <div className="dev-logins">
                {devLogins.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    className={cx('dev-login-item', form.email === d.email && 'is-active')}
                    onClick={() => setForm({ email: d.email, password: 'password123' })}
                    title={d.email}
                  >
                    <span className="dev-login-role">{d.role}</span>
                    <span className="dev-login-email">{d.email}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="auth-secure-note">
          <ShieldCheck size={14} />
          Secure, role-based access for staff and families
        </div>
      </main>
    </div>
  );
};

export default Login;
