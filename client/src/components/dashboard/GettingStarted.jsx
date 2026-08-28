import { Link } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

function Step({ done, number, title, description, action }) {
  return (
    <div className={`flex items-start gap-3 ${done ? 'opacity-60' : ''}`}>
      <div className="flex-shrink-0 mt-0.5">
        {done ? (
          <CheckCircleIcon className="w-6 h-6 text-teal" />
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-[#d5d5d0] flex items-center justify-center">
            <span className="font-montserrat font-bold text-[10px] text-ink/40">{number}</span>
          </div>
        )}
      </div>
      <div className="flex-1">
        <p className={`font-montserrat font-semibold text-sm ${done ? 'text-ink/50 line-through' : 'text-ink'}`}>{title}</p>
        <p className="font-lora text-xs text-ink/50 mt-0.5 leading-relaxed">{description}</p>
        {!done && action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export default function GettingStarted({ hasResume, hasJob, hasScore, onAddJob, onSeeMatches }) {
  const steps = [
    {
      done: hasResume,
      title: 'Upload your resume',
      description: 'Everything starts here. Your resume powers role discovery, fit scores, and tailored materials.',
      action: (
        <Link to="/profile" className="inline-block px-4 py-1.5 bg-teal text-white font-montserrat font-semibold text-xs rounded-sm hover:bg-teal-deeper transition-colors">
          Go to Profile
        </Link>
      ),
    },
    {
      done: hasJob,
      title: 'Pick a job to pursue',
      description: 'You do not need to go find one. The Discover tab searches live listings and scores each against your resume, so you can start from a match. Have your own posting? Paste it or upload a screenshot instead.',
      action: hasResume ? (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onSeeMatches} className="inline-block px-4 py-1.5 bg-teal text-white font-montserrat font-semibold text-xs rounded-sm hover:bg-teal-deeper transition-colors">
            See my matches
          </button>
          <button onClick={onAddJob} className="font-lora text-xs text-ink/50 hover:text-teal underline-offset-2 hover:underline transition-colors">
            or add your own posting
          </button>
        </div>
      ) : null,
    },
    {
      done: hasScore,
      title: 'Run your first optimization',
      description: 'Open the job from your Interested tab to get your fit score, tailored resume, and cover letter.',
      action: null,
    },
  ];

  const remaining = steps.filter(s => !s.done).length;
  if (remaining === 0) return null;

  return (
    <div className="bg-white border border-teal/20 rounded-sm p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-1">Getting started</p>
          <h2 className="font-montserrat font-bold text-base text-teal-deeper">
            {remaining === steps.length ? 'Welcome. Three steps to your first application.' : `${steps.length - remaining} of ${steps.length} done. Keep going.`}
          </h2>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <Step key={i} number={i + 1} {...s} />
        ))}
      </div>
    </div>
  );
}
