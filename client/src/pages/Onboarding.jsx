import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Step1Resume from '../components/onboarding/Step1Resume';
import Step2Style  from '../components/onboarding/Step2Style';
import Step3Roles  from '../components/onboarding/Step3Roles';
import Spinner     from '../components/ui/Spinner';

const STEPS = [
  { number: 1, label: 'Resume + Situation' },
  { number: 2, label: 'Resume Style' },
  { number: 3, label: 'Target Roles + Regions' },
];

export default function Onboarding() {
  const [step, setStep]     = useState(1);
  const [checking, setCheck] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.profile.get().then(profile => {
      if (profile.onboarding_complete) {
        navigate('/dashboard', { replace: true });
      } else {
        setStep(Math.max(1, (profile.onboarding_step || 0) + 1));
        setCheck(false);
      }
    }).catch(() => setCheck(false));
  }, [navigate]);

  async function advance() {
    await api.profile.setOnboardingStep(step);
    if (step < 3) {
      setStep(s => s + 1);
    } else {
      navigate('/dashboard', { replace: true });
    }
  }

  if (checking) return (
    <div className="min-h-screen bg-linen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );

  return (
    <div className="min-h-screen bg-linen flex flex-col">
      <header className="max-w-2xl mx-auto w-full px-6 py-6">
        <span className="font-montserrat font-bold text-teal text-xs tracking-widest uppercase">Dream Job Ready</span>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 pb-20">
        {/* Progress */}
        <div className="flex items-center gap-0 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center gap-0 flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-montserrat font-bold border transition-colors ${
                  step === s.number ? 'border-teal bg-teal text-white' :
                  step > s.number  ? 'border-teal bg-teal/10 text-teal' :
                  'border-[#e5e5e0] text-ink/40'
                }`}>
                  {step > s.number ? '✓' : s.number}
                </div>
                <span className={`text-xs font-montserrat hidden sm:block ${step === s.number ? 'text-teal font-semibold' : 'text-ink/40'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 mt-[-12px] ${step > s.number ? 'bg-teal/40' : 'bg-[#e5e5e0]'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step header */}
        <div className="mb-8">
          <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-2">
            Step {step} of {STEPS.length}
          </p>
          <h1 className="font-montserrat font-bold text-2xl text-teal-deeper">
            {step === 1 && 'Your resume and your situation'}
            {step === 2 && 'Choose your default resume style'}
            {step === 3 && 'Target roles and regions'}
          </h1>
          <p className="font-lora text-sm text-ink/60 mt-1.5">
            {step === 1 && 'Upload your current resume and tell us where you are in your search. Everything is editable later.'}
            {step === 2 && 'Pick the template style for your tailored resume downloads. You can change it per job.'}
            {step === 3 && "We'll read your resume and suggest roles. Select what fits, add your own, and pick your target regions."}
          </p>
        </div>

        {/* Step content */}
        {step === 1 && <Step1Resume onComplete={advance} />}
        {step === 2 && <Step2Style  onComplete={advance} />}
        {step === 3 && <Step3Roles  onComplete={() => navigate('/dashboard', { replace: true })} />}
      </main>
    </div>
  );
}
