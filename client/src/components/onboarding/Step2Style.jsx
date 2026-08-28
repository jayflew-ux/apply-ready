import { useState } from 'react';
import { api } from '../../lib/api';
import Button from '../ui/Button';

const STYLES = [
  {
    value: 'classic',
    label: 'Classic Professional',
    description: 'Traditional chronological layout. Clean section headers, reliable structure. Works everywhere.',
    accent: 'bg-ink text-white',
    preview: 'Times / Calibri',
  },
  {
    value: 'modern',
    label: 'Modern Minimal',
    description: 'Clean sans-serif type with subtle color accents. Contemporary and readable.',
    accent: 'bg-teal text-white',
    preview: 'Montserrat / Lora',
  },
  {
    value: 'ats-safe',
    label: 'ATS-Safe Plain',
    description: 'Zero formatting, maximum text extraction. Built for applicant tracking systems that choke on design.',
    accent: 'bg-gray-400 text-white',
    preview: 'Calibri only',
  },
  {
    value: 'editorial',
    label: 'Editorial Branded',
    description: 'More personality. Stronger typographic hierarchy. For roles in design, media, and creative fields.',
    accent: 'bg-copper text-white',
    preview: 'Lora + Montserrat',
  },
  {
    value: 'executive',
    label: 'Executive',
    description: 'Polished, authoritative, concise. Tight summary up front. For director and above.',
    accent: 'bg-teal-deeper text-white',
    preview: 'Montserrat Bold',
  },
];

export default function Step2Style({ onComplete }) {
  const [selected, setSelected] = useState('classic');
  const [saving, setSaving]     = useState(false);

  async function handleContinue() {
    setSaving(true);
    await api.profile.update({ resume_style: selected });
    setSaving(false);
    onComplete();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3">
        {STYLES.map(s => (
          <label
            key={s.value}
            className={`flex items-start gap-4 px-4 py-4 border rounded-sm cursor-pointer transition-all ${
              selected === s.value ? 'border-teal bg-teal/5' : 'border-[#e3ddd2] hover:border-teal/30'
            }`}
          >
            <input
              type="radio"
              name="style"
              value={s.value}
              checked={selected === s.value}
              onChange={() => setSelected(s.value)}
              className="sr-only"
            />
            <div className={`w-8 h-8 rounded-sm flex-shrink-0 flex items-center justify-center text-xs font-montserrat font-bold ${s.accent}`}>
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3">
                <span className="font-montserrat font-semibold text-sm text-ink">{s.label}</span>
                <span className="font-lora text-xs text-ink/40">{s.preview}</span>
              </div>
              <p className="font-lora text-sm text-ink/60 mt-0.5 leading-snug">{s.description}</p>
            </div>
            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1 ${selected === s.value ? 'border-teal bg-teal' : 'border-ink/30'}`} />
          </label>
        ))}
      </div>

      <p className="font-lora text-xs text-ink/50">This sets your default. You can change the style per job during the optimization flow.</p>

      <Button onClick={handleContinue} loading={saving}>
        Continue
      </Button>
    </div>
  );
}
