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
            title={listing.link_status === 'verified' ? 'Link checked and reachable' : 'Link could not be auto-checked (the board blocks automated requests)'}
          >
            View posting <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            {listing.link_status === 'verified' && <span className="text-teal" aria-label="verified">✓</span>}
          </a>
        ) : <span />}
        <Button size="sm" onClick={onPrep} loading={prepping}>
          Prep this application
        </Button>
      </div>
    </div>
  );
}

export default function DiscoverTab({ hasResume, onJobAdded, onAddOwnJob }) {
  const [data, setData]           = useState(null); // { categories, roles }
  const [loading, setLoading]     = useState(false);
  const [listings, setListings]   = useState(null); // { listings, search_note, cached, fetched_at }
  const [loadingLst, setLoadingLst] = useState(false);
  const [preppingIdx, setPrepping]  = useState(null);
  const [error, setError]         = useState('');
  const [listError, setListError] = useState('');
  const { setContext }            = useChatContext();

  useEffect(() => {
    // Only load once we know a resume exists — avoids error flashes for new users.
    // Both run in parallel: the listing search is the slow one and is the lead
    // content, so it must not wait on role suggestions to finish.
    if (hasResume && !data) {
      load();
      loadListings(false);
    }
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
        <p className="font-montserrat font-bold text-base text-teal-deeper">Upload your resume and we will find jobs for you</p>
        <p className="font-lora text-sm text-ink/50 max-w-md leading-relaxed">
          Once your resume is on file, this tab searches live job boards and scores each posting against your background. You never have to hunt for listings yourself, though you can always add your own.
        </p>
        <a href="/profile" className="mt-2 inline-block px-5 py-2 bg-teal text-white font-montserrat font-semibold text-sm rounded-sm hover:bg-teal-deeper transition-colors">
          Upload resume
        </a>
      </div>
    );
  }

  // Only block the whole tab on the very first pass, when nothing has arrived yet.
  if (loading && !listings && !loadingLst) return (
    <div className="flex flex-col items-center gap-3 py-20">
      <Spinner size="lg" />
      <p className="font-lora text-sm text-ink/60">Analyzing your resume to find jobs for you...</p>
    </div>
  );

  // A resume-level error blocks everything; other role-fetch errors are shown
  // inline below so the listing search still renders.
  if (error && error.toLowerCase().includes('resume')) return (
    <div className="py-16 text-center flex flex-col items-center gap-4">
      <p className="font-lora text-sm text-red-600">{error}</p>
      <p className="font-lora text-sm text-ink/50">
        Go to <a href="/profile" className="text-teal underline">Profile</a> to upload your resume first.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Live listings — the lead. We search for you; adding your own is optional. */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h2 className="font-montserrat font-bold text-lg text-teal-deeper">Jobs we found for you</h2>
            <p className="font-lora text-sm text-ink/60 mt-1 leading-relaxed max-w-2xl">
              You do not have to go hunting. We search live job boards and score every posting against your resume.
              Pick one and we will prep the whole application.
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

        <p className="font-lora text-xs text-ink/45 mb-5">
          Already have a posting in mind?{' '}
          <button onClick={onAddOwnJob} className="text-teal underline underline-offset-2 hover:text-teal-deeper">
            Add your own job
          </button>{' '}
          instead — paste the text or upload a screenshot.
        </p>

        {loadingLst && !listings && (
          <div className="flex flex-col items-center gap-3 py-12 bg-white border border-[#e5e5e0] rounded-sm">
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
              {listings.verification
                ? `Every link checked${listings.verification.dropped > 0 ? `; ${listings.verification.dropped} unverifiable posting${listings.verification.dropped === 1 ? '' : 's'} removed` : ''}. `
                : ''}
              {listings.search_note}{listings.cached ? ' · Results cached — use "Search again" for a fresh sweep.' : ''}
            </p>
          </>
        )}

        {listings && !loadingLst && !(listings.listings?.length > 0) && !listError && (
          <p className="font-lora text-sm text-ink/40 text-center py-6 bg-white border border-[#e5e5e0] rounded-sm">
            No solid current listings surfaced this pass. Try again later, broaden your target roles and regions in Profile,
            or add a posting you already have.
          </p>
        )}
      </div>

      {/* Role suggestions — secondary context */}
      {(data || loading || error) && (
      <div className="border-t border-[#e5e5e0] pt-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-montserrat font-bold text-base text-teal-deeper">Roles that fit your background</h2>
            <p className="font-lora text-sm text-ink/50 mt-0.5">
              The kinds of titles your resume supports, with links to search them yourself.
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

        {loading && !data && (
          <div className="flex items-center gap-3 py-6">
            <Spinner size="sm" />
            <span className="font-lora text-sm text-ink/50">Reading your resume...</span>
          </div>
        )}

        {error && !data && (
          <div className="flex items-center gap-3 py-4">
            <p className="font-lora text-sm text-red-600">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>Try again</Button>
          </div>
        )}

        {/* Categories */}
        {data?.categories?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {data.categories.map((cat, i) => (
              <span key={i} className="px-3 py-1 bg-teal/8 border border-teal/20 rounded-sm font-montserrat text-xs font-semibold text-teal tracking-wide">
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Role cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.roles || []).map((role, i) => (
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
      </div>
      )}
    </div>
  );
}
