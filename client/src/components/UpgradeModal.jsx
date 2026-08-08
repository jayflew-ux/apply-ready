import { useState } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { api } from '../lib/api';
import Modal from './ui/Modal';
import Button from './ui/Button';

const INCLUDED = [
  'Unlimited tailored resumes and cover letters',
  'Live job listings scored against your resume, refreshed on demand',
  'Interview prep with interviewer research for every application',
  'Post-interview debriefs and journey tracking',
];

export default function UpgradeModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function startCheckout() {
    setLoading(true);
    setError('');
    try {
      const { url } = await api.billing.checkout();
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Keep building">
      <div className="flex flex-col gap-5">
        <p className="font-lora text-sm text-ink/70 leading-relaxed">
          Your free application build is done — and that job deserves company. Upgrade to build a tailored resume and cover letter for every role you pursue.
        </p>

        <div className="bg-teal/5 border border-teal/20 rounded-sm p-5">
          <div className="flex items-baseline gap-1.5 mb-4">
            <span className="font-montserrat font-extrabold text-3xl text-teal-deeper">$19.99</span>
            <span className="font-lora text-sm text-ink/50">/ month · cancel anytime</span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {INCLUDED.map((f, i) => (
              <li key={i} className="flex items-start gap-2 font-lora text-sm text-ink/80">
                <CheckCircleIcon className="w-5 h-5 text-teal flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="font-lora text-sm text-red-600">{error}</p>}

        <Button onClick={startCheckout} loading={loading}>
          Upgrade now
        </Button>
        <button onClick={onClose} className="font-lora text-xs text-ink/40 hover:text-ink/60 self-center">
          Maybe later
        </button>
      </div>
    </Modal>
  );
}
