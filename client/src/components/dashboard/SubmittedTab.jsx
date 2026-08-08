import { useState } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import JourneyTracker from './JourneyTracker';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';

export default function SubmittedTab({ jobs, loading, onJourneyUpdate }) {
  if (loading) return (
    <div className="flex flex-col items-center gap-3 py-16">
      <Spinner size="lg" />
      <p className="font-lora text-sm text-ink/60">Loading...</p>
    </div>
  );

  if (!jobs.length) return (
    <div className="py-16 text-center">
      <p className="font-montserrat font-bold text-base text-ink/30">No applications yet.</p>
      <p className="font-lora text-sm text-ink/40 mt-1">Once you complete the optimization flow and click "Mark as applied," it appears here.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {jobs.map(item => {
        const j = item.jobs || {};
        const appliedDate = item.applied_at
          ? new Date(item.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : null;

        // Follow-up nudge: sitting at "Applied" with no movement for 5+ days
        const daysSinceApplied = item.applied_at
          ? Math.floor((Date.now() - new Date(item.applied_at).getTime()) / 86400000)
          : null;
        const needsFollowUp =
          (item.journey_status || 'applied') === 'applied' &&
          daysSinceApplied != null && daysSinceApplied >= 5 && daysSinceApplied <= 45;

        return (
          <div
            key={item.id}
            className="bg-linen border border-[#e5e5e0] rounded-sm p-5 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-montserrat font-bold text-base text-teal-deeper">{j.title}</h3>
                <p className="font-lora text-sm text-ink/70">{j.company}</p>
              </div>
              {appliedDate && (
                <span className="font-lora text-xs text-ink/40 flex-shrink-0">Applied {appliedDate}</span>
              )}
            </div>

            {j.location && (
              <span className="flex items-center gap-1 font-lora text-xs text-ink/50">
                <MapPinIcon className="w-3 h-3" />
                {j.location}
              </span>
            )}

            {item.fit_score != null && (
              <div className="flex items-center gap-2">
                <span className="font-montserrat text-xs uppercase tracking-widest text-ink/30">Fit score</span>
                <span className={`font-montserrat font-bold text-sm ${item.fit_score >= 70 ? 'text-teal' : item.fit_score >= 45 ? 'text-copper' : 'text-red-600'}`}>
                  {item.fit_score}/100
                </span>
              </div>
            )}

            {needsFollowUp && (
              <div className="bg-copper/5 border border-copper/25 rounded-sm px-3 py-2">
                <p className="font-lora text-xs text-copper leading-relaxed">
                  Applied {daysSinceApplied} days ago with no movement. A short, warm follow-up note to the recruiter or hiring manager can revive an application — mention the role, restate your one strongest qualification, and ask if they need anything else from you.
                </p>
              </div>
            )}

            <div className="border-t border-[#e5e5e0] pt-3">
              <JourneyTracker
                userJobId={item.id}
                journeyStatus={item.journey_status}
                journeyNotes={item.journey_notes}
                job={j}
                interviewPrep={item.interview_prep}
                postInterviewDebrief={item.post_interview_debrief}
                onUpdate={updates => onJourneyUpdate?.(item.id, updates)}
              />
            </div>

            {item.journey_notes && (
              <p className="font-lora text-xs text-ink/50 italic">{item.journey_notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
