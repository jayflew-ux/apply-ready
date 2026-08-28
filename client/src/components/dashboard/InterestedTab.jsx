import { useState } from 'react';
import JobCard from './JobCard';
import SavedDocuments from './SavedDocuments';
import OptimizationFlow from './OptimizationFlow';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { api } from '../../lib/api';

export default function InterestedTab({ jobs, loading, onStatusChange }) {
  const [flowItem, setFlow] = useState(null);
  const [removing, setRemoving] = useState('');

  const interested = jobs.filter(j => j.status === 'interested');

  async function handleRemove(userJobId) {
    setRemoving(userJobId);
    await api.jobs.remove(userJobId);
    onStatusChange?.(userJobId, 'removed');
    setRemoving('');
  }

  if (loading) return (
    <div className="flex flex-col items-center gap-3 py-16">
      <Spinner size="lg" />
      <p className="font-lora text-sm text-ink/60">Loading...</p>
    </div>
  );

  if (!interested.length) return (
    <div className="py-16 text-center">
      <p className="font-montserrat font-bold text-base text-ink/30">Nothing flagged yet.</p>
      <p className="font-lora text-sm text-ink/40 mt-1">Mark jobs as Interested from the Discover tab, or add a job you found.</p>
    </div>
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {interested.map(item => (
          <div key={item.userJobId} className="relative">
            <JobCard
              userJobId={item.userJobId}
              job={item}
              status={item.status}
              fitScore={item.fitScore}
              fitScoreReport={item.fitScoreReport}
              isNew={item.isNew}
              onStatusChange={onStatusChange}
              onOpenDetails={setFlow}
            />
            <button
              onClick={() => handleRemove(item.userJobId)}
              disabled={removing === item.userJobId}
              className="absolute top-3 right-3 text-xs font-lora text-ink/30 hover:text-red-500 transition-colors disabled:opacity-40"
              title="Remove from Interested"
            >
              {removing === item.userJobId ? '...' : '✕'}
            </button>
            {(item.hasResume || item.hasCoverLetter) && (
              <div className="px-4 pb-3 -mt-2">
                <SavedDocuments
                  userJobId={item.userJobId}
                  job={item}
                  hasResume={item.hasResume}
                  hasCoverLetter={item.hasCoverLetter}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Optimization flow modal */}
      <Modal
        open={!!flowItem}
        onClose={() => setFlow(null)}
        title={flowItem ? `${flowItem.job?.title} — ${flowItem.job?.company}` : ''}
        wide
      >
        {flowItem && (
          <OptimizationFlow
            userJobId={flowItem.userJobId}
            job={flowItem.job}
            fitScore={flowItem.fitScore}
            fitScoreReport={flowItem.fitScoreReport}
            onApplied={() => {
              onStatusChange?.(flowItem.userJobId, 'applied');
              setFlow(null);
            }}
            onClose={() => setFlow(null)}
          />
        )}
      </Modal>
    </>
  );
}
