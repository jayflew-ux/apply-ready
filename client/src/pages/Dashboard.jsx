import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useChatContext } from '../context/ChatContext';
import { api } from '../lib/api';
import DiscoverTab   from '../components/dashboard/DiscoverTab';
import InterestedTab from '../components/dashboard/InterestedTab';
import SubmittedTab  from '../components/dashboard/SubmittedTab';
import AddJobModal   from '../components/dashboard/AddJobModal';
import GettingStarted from '../components/dashboard/GettingStarted';
import Button from '../components/ui/Button';

const TABS = ['Discover', 'Interested', 'Submitted'];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { setContext } = useChatContext();

  const [tab, setTab]           = useState('Discover');
  const [jobs, setJobs]         = useState([]);
  const [submitted, setSubmitted] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [addOpen, setAddOpen]   = useState(false);
  const [hasResume, setHasResume] = useState(null); // null = still checking
  const [isAdmin, setIsAdmin]   = useState(false);
  const [justUpgraded] = useState(() => new URLSearchParams(window.location.search).get('upgraded') === '1');

  // Keep chat context in sync with active tab
  useEffect(() => {
    setContext(prev => ({ ...prev, currentTab: tab }));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.profile.get().then(p => {
      setIsAdmin(Boolean(p.is_admin));
      if (!p.onboarding_complete) {
        navigate('/onboarding', { replace: true });
        return;
      }
      loadData();
    }).catch(() => setLoading(false));

    // Resume check drives the getting-started checklist and Discover tab
    api.resume.get()
      .then(r => setHasResume(Boolean(r?.id || r?.raw_text)))
      .catch(() => setHasResume(false));
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const [feedData, submittedData] = await Promise.all([
        api.jobs.feed(),
        api.jobs.submitted(),
      ]);
      setJobs(feedData.jobs || []);
      setSubmitted(submittedData.jobs || []);
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(userJobId, newStatus) {
    if (newStatus === 'removed') {
      setJobs(prev => prev.filter(j => j.userJobId !== userJobId));
    } else {
      setJobs(prev => prev.map(j =>
        j.userJobId === userJobId ? { ...j, status: newStatus } : j,
      ));
    }
    if (newStatus === 'applied') loadData();
  }

  function handleJourneyUpdate(id, updates) {
    setSubmitted(prev => prev.map(j =>
      j.id === id ? { ...j, ...updates } : j,
    ));
  }

  const interestedCount = jobs.filter(j => j.status === 'interested').length;

  return (
    <div className="min-h-screen bg-linen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-linen/95 backdrop-blur-sm border-b border-[#e5e5e0]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="font-montserrat font-bold text-teal text-xs tracking-widest uppercase flex-shrink-0">
            Dream Job Ready
          </Link>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <PlusIcon className="w-4 h-4" /> Add a job
            </Button>

            <div className="w-px h-4 bg-[#e5e5e0] mx-1" />

            {isAdmin && (
              <Link to="/admin" className="font-lora text-sm text-copper hover:text-teal transition-colors">
                Admin
              </Link>
            )}
            <Link to="/profile" className="font-lora text-sm text-ink/50 hover:text-ink transition-colors">
              Profile
            </Link>
            <button onClick={signOut} className="font-lora text-sm text-ink/40 hover:text-ink transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-20">
        {justUpgraded && (
          <div className="mt-6 bg-teal/5 border border-teal/25 rounded-sm px-4 py-3">
            <p className="font-lora text-sm text-teal">
              Welcome to Dream Job Ready Pro. Your builds are now unlimited — go get that job.
            </p>
          </div>
        )}

        {/* Getting started checklist — shows until all steps complete */}
        {hasResume !== null && (
          <GettingStarted
            hasResume={hasResume}
            hasJob={jobs.length > 0 || submitted.length > 0}
            hasScore={jobs.some(j => j.fitScore != null) || submitted.length > 0}
            onAddJob={() => setAddOpen(true)}
            onSeeMatches={() => setTab('Discover')}
          />
        )}

        {/* Tab bar */}
        <div className="flex items-end gap-0 border-b border-[#e5e5e0] mt-6">
          {TABS.map(t => {
            const count =
              t === 'Interested' ? interestedCount :
              t === 'Submitted'  ? submitted.length : 0;

            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  'px-5 py-3 font-montserrat font-semibold text-sm tracking-wide border-b-2 transition-colors',
                  tab === t
                    ? 'border-teal text-teal'
                    : 'border-transparent text-ink/40 hover:text-ink/70',
                ].join(' ')}
              >
                {t}
                {count > 0 && (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t ? 'bg-teal/10 text-teal' : 'bg-ink/10 text-ink/50'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="py-6">
          {tab === 'Discover'   && (
            <DiscoverTab
              hasResume={hasResume}
              onJobAdded={() => { loadData(); setTab('Interested'); }}
              onAddOwnJob={() => setAddOpen(true)}
            />
          )}
          {tab === 'Interested' && <InterestedTab jobs={jobs} loading={loading} onStatusChange={handleStatusChange} />}
          {tab === 'Submitted'  && <SubmittedTab  jobs={submitted} loading={loading} onJourneyUpdate={handleJourneyUpdate} />}
        </div>
      </main>

      <AddJobModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={loadData}
      />
    </div>
  );
}
