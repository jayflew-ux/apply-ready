import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      setError(error.message.includes('session')
        ? 'This reset link has expired. Please request a new one.'
        : error.message);
    } else {
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 1800);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <span className="font-montserrat text-xs uppercase tracking-widest text-copper block mb-6">Dream Job Ready</span>
          <h1 className="font-montserrat font-bold text-2xl text-teal-deeper mb-3">Password updated</h1>
          <p className="font-lora text-sm text-ink/70">You are all set. Taking you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <Link to="/" className="block text-center font-montserrat text-xs uppercase tracking-widest text-copper mb-8">Dream Job Ready</Link>
        <h1 className="font-montserrat font-bold text-2xl text-teal-deeper mb-1 text-center">Set a new password</h1>
        <p className="font-lora text-sm text-ink/60 text-center mb-8">Choose a password you will remember.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="New password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <Input
            label="Confirm password"
            type="password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
          {error && <p className="font-lora text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={loading} className="mt-1">Update password</Button>
        </form>
      </div>
    </div>
  );
}
