import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Auth() {
  const [params]   = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);

  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'signup') {
      const { error } = await signUp(email, password, name);
      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    }

    setLoading(false);
  }

  async function handleGoogle() {
    setError('');
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <span className="font-montserrat text-xs uppercase tracking-widest text-copper block mb-6">Dream Job Ready</span>
          <h1 className="font-montserrat font-bold text-2xl text-teal-deeper mb-3">Check your email</h1>
          <p className="font-lora text-sm text-ink/70 leading-relaxed">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Link to="/" className="mt-8 inline-block teal-link text-sm font-lora">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <Link to="/" className="block text-center font-montserrat text-xs uppercase tracking-widest text-copper mb-8">Dream Job Ready</Link>

        <h1 className="font-montserrat font-bold text-2xl text-teal-deeper mb-1 text-center">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="font-lora text-sm text-ink/60 text-center mb-8">
          {mode === 'signup' ? 'Free to start. No credit card.' : 'Sign in to continue.'}
        </p>

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 border border-[#e5e5e0] rounded-sm py-2.5 font-montserrat font-semibold text-sm text-ink hover:border-teal/40 hover:bg-teal/5 transition-all mb-5"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-[#e5e5e0]" />
          <span className="font-lora text-xs text-ink/40">or</span>
          <div className="flex-1 h-px bg-[#e5e5e0]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <Input
              label="Full name"
              type="text"
              placeholder="Jordan Reeves"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={mode === 'signup' ? 8 : undefined}
          />

          {error && <p className="font-lora text-sm text-red-600">{error}</p>}

          <Button type="submit" loading={loading} className="mt-1">
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="font-lora text-sm text-center text-ink/60 mt-6">
          {mode === 'signup' ? (
            <>Already have an account? <button onClick={() => { setMode('signin'); setError(''); }} className="teal-link">Sign in</button></>
          ) : (
            <>New here? <button onClick={() => { setMode('signup'); setError(''); }} className="teal-link">Create an account</button></>
          )}
        </p>
      </div>
    </div>
  );
}
