import { useState, useEffect } from 'react';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { api } from '../../lib/api';
import { useChatContext } from '../../context/ChatContext';
import Spinner from '../ui/Spinner';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const SENIORITY_VARIANT = {
  entry:     'copper',
  mid:       'teal',
  senior:    'teal',
  lead:      'teal',
  director:  'green',
  executive: 'green',
};

function searchURL(engine, title) {
  const q = encodeURIComponent(title);
  if (engine === 'linkedin') return `https://www.linkedin.com/jobs/search/?keywords=${q}`;
  if (engine === 'indeed')   return `https://www.indeed.com/jobs?q=${q}`;
  return `https://www.google.com/search?q=${q}+jobs`;
}

export default function DiscoverTab({ hasResume }) {
  const [data, setData]       = useState(null); // { categories, roles }
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { setContext }        = useChatContext();

  useEffect(() => {
    // Only load once we know a resume exists — avoids error flashes for new users
    if (hasResume && !data) load();
  }, [hasResume]); // eslint-disable-line react-hooks/exhaustive-deps

  // No resume yet — friendly setup prompt instead of an error
  if (hasResume === false) {
    return (
      <div className="py-16 text-center flex flex-col items-center gap-3">
        <p className="font-montserrat font-bold text-base text-teal-deeper">Upload your resume to unlock role discovery</p>
        <p className="font-lora text-sm text-ink/50 max-w-md leading-relaxed">
          Once your resume is on file, this tab shows the roles you are best positioned for, with direct links to search for open listings.
        </p>
        <a href="/profile" className="mt-2 inline-block px-5 py-2 bg-teal text-white font-montserrat font-semibold text-sm rounded-sm hover:bg-teal-deeper transition-colors">
          Upload resume
        </a>
      </div>
    );
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await api.ai.suggestRoles();
      setData(result);
      if (result?.categories?.length) {
        setContext(prev => ({ ...prev, suggestedCategories: result.categories.join(', ') }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center gap-3 py-20">
      <Spinner size="lg" />
      <p className="font-lora text-sm text-ink/60">Analyzing your resume to find your best-fit roles...</p>
    </div>
  );

  if (error) return (
    <div className="py-16 text-center flex flex-col items-center gap-4">
      <p className="font-lora text-sm text-red-600">{error}</p>
      {error.toLowerCase().includes('resume') ? (
        <p className="font-lora text-sm text-ink/50">
          Go to <a href="/profile" className="text-teal underline">Profile</a> to upload your resume first.
        </p>
      ) : (
        <Button size="sm" variant="outline" onClick={load}>Try again</Button>
      )}
    </div>
  );

  if (!data) return null;

  return (
    <div className="flex flex-col gap-8">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-montserrat font-bold text-base text-teal-deeper">Roles that fit your background</h2>
          <p className="font-lora text-sm text-ink/50 mt-0.5">
            Based on your resume. Click any role to search for open listings.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 font-montserrat text-xs text-ink/40 hover:text-teal transition-colors flex-shrink-0 pt-1"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Categories */}
      {data.categories?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.categories.map((cat, i) => (
            <span key={i} className="px-3 py-1 bg-teal/8 border border-teal/20 rounded-sm font-montserrat text-xs font-semibold text-teal tracking-wide">
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Role cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data.roles || []).map((role, i) => (
          <div
            key={i}
            className="bg-white border border-[#e5e5e0] rounded-sm p-4 flex flex-col gap-3 hover:border-teal/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-montserrat font-bold text-sm text-teal-deeper leading-snug">{role.title}</h3>
              <Badge variant={SENIORITY_VARIANT[role.seniority] || 'teal'}>
                {role.seniority}
              </Badge>
            </div>

            <p className="font-lora text-xs text-ink/60 leading-relaxed flex-1">{role.reason}</p>

            <div className="flex items-center gap-2 pt-1 border-t border-[#e5e5e0]">
              <a
                href={searchURL('linkedin', role.title)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-montserrat text-xs font-semibold text-teal hover:text-teal-deeper transition-colors"
              >
                LinkedIn <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </a>
              <span className="text-ink/20">·</span>
              <a
                href={searchURL('indeed', role.title)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-montserrat text-xs font-semibold text-ink/50 hover:text-teal transition-colors"
              >
                Indeed <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

      <p className="font-lora text-xs text-ink/30 text-center">
        Found a role you want to apply for? Use the <span className="text-teal">+ Add a job</span> button to paste the listing and start your optimization flow.
      </p>
    </div>
  );
}
