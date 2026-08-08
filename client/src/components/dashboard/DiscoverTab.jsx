import { useState, useEffect } from 'react';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, MapPinIcon } from '@heroicons/react/24/outline';
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

function scoreColor(score) {
  if (score >= 70) return 'text-teal';
  if (score >= 45) return 'text-copper';
  return 'text-red-600';
}

function ListingCard({ listing, onPrep, prepping }) {
  return (
    <div className="bg-white border border-[#e5e5e0] rounded-sm p-4 flex flex-col gap-3 hover:border-teal/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-montserrat font-bold text-sm text-teal-deeper leading-snug">{listing.title}</h3>
          <p className="font-lora text-xs text-ink/60 mt-0.5">{listing.company}</p>
        </div>
        {listing.match_score != null && (
          <div className="flex flex-col items-center flex-shrink-0">
            <span className={`font-montserrat font-bold text-xl leading-none ${scoreColor(listing.match_score)}`}>
              {listing.match_score}
            </span>
            <span className="font-montserrat text-[8px] uppercase tracking-widest text-ink/30 mt-0.5">match</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {listing.location && (
          <span className="flex items-center gap-1 font-lora text-xs text-ink/50">
            <MapPinIcon className="w-3 h-3" />{listing.location}
          </span>
        )}
        {listing.salary && (
          <span className="font-montserrat text-xs font-semibold text-copper">{listing.salary}</span>
        )}
      </div>

      {listing.summary && (
        <p className="font-lora text-xs text-ink/60 leading-relaxed flex-1">{listing.summary}</p>
      )}

      {listing.match_reason && (
        <p className="font-lora text-xs text-teal italic leading-relaxed">{listing.match_reason}</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#e5e5e0]">
        {listing.url ? (
          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 font-montserrat text-xs font-semibold text-ink/50 hover:text-teal transition-colors"
          >
            View posting <ArrowTopRightOnSquareIcon className="w-3 h-3" />
          </a>
        ) : <span />}
        <Button size="sm" onClick={onPrep} loading={prepping}>
          Prep this application
        </Button>
      </div>
    </div>
  );
}

export default function DiscoverTab({ hasResume, onJobAdded }) {
  const [data, setData]           = useState(null); // { categories, roles }
  const [loading, setLoading]     = useState(false);
  const [listings, setListings]   = useState(null); // { listings, search_note, cached, fetched_at }
  const [loadingLst, setLoadingLst] = useState(false);
  const [preppingIdx, setPrepping]  = useState(null);
  const [error, setError]         = useState('');
  const [listError, setListError] = useState('');
  const { setContext }            = useChatContext();

  useEffect(() => {
    // Only load once we know a resume exists — avoids error flashes for new users
    if (hasResume && !data) load();
  }, [hasResume]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await api.ai.suggestRoles();
      setData(result);
      if (result?.categories?.length) {
        setContext(prev => ({ ...prev, suggestedCategories: result.categories.join(', ') }));
      }
      loadListings(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadListings(force) {
    setLoadingLst(true);
    setListError('');
    try {
      const result = await api.ai.findListings(force);
      setListings(result);
    } catch (e) {
      setListError(e.message);
    } finally {
      setLoadingLst(false);
    }
  }

  async function prepListing(listing, idx) {
    setPrepping(idx);
    try {
      const text = [
        listing.title,
        listing.company,
        listing.location,
        listing.salary ? `Salary: ${listing.salary}` : '',
        '',
        listing.summary || '',
        listing.match_reason ? `\nWhy it may fit: ${listing.match_reason}` : '',
      ].filter(Boolean).join('\n');

      await api.jobs.addText({
        text,
        title: listing.title,
        company: listing.company,
        location: listing.location || '',
        url: listing.url || '',
      });
      onJobAdded?.();
    } catch (e) {
      setListError(e.message);
    } finally {
      setPrepping(null);
    }
  }

  // No resume yet — friendly setup prompt instead of an error
  if (hasResume === false) {
    return (
      <div className="py-16 text-center flex flex-col items-center gap-3">
        <p className="font-montserrat font-bold text-base text-teal-deeper">Upload your resume to unlock role discovery</p>
        <p className="font-lora text-sm text-ink/50 max-w-md leading-relaxed">
          Once your resume is on file, this tab shows the roles you are best positioned for and live listings matched to your background, each with an honest match score.
        </p>
        <a href="/profile" className="mt-2 inline-block px-5 py-2 bg-teal text-white font-montserrat font-semibold text-sm rounded-sm hover:bg-teal-deeper transition-colors">
          Upload resume
        </a>
      </div>
    );
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
            Based on your resume, with live listings matched and scored below.
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

      {/* Live listings */}
      <div className="border-t border-[#e5e5e0] pt-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-montserrat font-bold text-base text-teal-deeper">Live listings matched to you</h2>
            <p className="font-lora text-sm text-ink/50 mt-0.5">
              Real, current postings found by web search and scored against your resume. Nothing here is auto-applied — you review and decide.
            </p>
          </div>
          {listings && (
            <button
              onClick={() => loadListings(true)}
              disabled={loadingLst}
              className="flex items-center gap-1.5 font-montserrat text-xs text-ink/40 hover:text-teal transition-colors flex-shrink-0 pt-1 disabled:opacity-40"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${loadingLst ? 'animate-spin' : ''}`} />
              Search again
            </button>
          )}
        </div>

        {loadingLst && !listings && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Spinner size="lg" />
            <p className="font-lora text-sm text-ink/60">Searching live job boards for postings that fit you...</p>
            <p className="font-lora text-xs text-ink/40">This can take up to a minute.</p>
          </div>
        )}

        {listError && (
          <div className="py-6 text-center flex flex-col items-center gap-3">
            <p className="font-lora text-sm text-red-600">{listError}</p>
            <Button size="sm" variant="outline" onClick={() => loadListings(true)}>Try again</Button>
          </div>
        )}

        {listings?.listings?.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {listings.listings.map((l, i) => (
                <ListingCard
                  key={i}
                  listing={l}
                  prepping={preppingIdx === i}
                  onPrep={() => prepListing(l, i)}
                />
              ))}
            </div>
            <p className="font-lora text-xs text-ink/30 mt-4 text-center">
              {listings.search_note}{listings.cached ? ' · Results cached — use "Search again" for a fresh sweep.' : ''}
            </p>
          </>
        )}

        {listings && !loadingLst && !(listings.listings?.length > 0) && !listError && (
          <p className="font-lora text-sm text-ink/40 text-center py-6">
            No solid current listings surfaced this pass. Try again later, or broaden your target roles and regions in Profile.
          </p>
        )}
      </div>
    </div>
  );
}
