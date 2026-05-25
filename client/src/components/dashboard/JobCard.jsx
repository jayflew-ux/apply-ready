import { useState } from 'react';
import { MapPinIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { api } from '../../lib/api';

function ScorePill({ score }) {
  if (score == null) return <span className="font-montserrat text-xs text-ink/30">—</span>;
  const color = score >= 70 ? 'text-teal' : score >= 45 ? 'text-copper' : 'text-red-600';
  return <span className={`font-montserrat font-bold text-sm ${color}`}>{score}/100</span>;
}

function remoteLabel(type) {
  if (type === 'remote') return { text: 'Remote', variant: 'teal' };
  if (type === 'hybrid') return { text: 'Hybrid', variant: 'copper' };
  return { text: 'On-site', variant: 'gray' };
}

function formatComp(min, max, currency = 'USD') {
  if (!min && !max) return null;
  const fmt = n => `$${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `up to ${fmt(max)}`;
}

export default function JobCard({
  job,
  status,
  fitScore,
  fitScoreReport,
  isNew,
  userJobId,
  onStatusChange,
  onOpenDetails,
  showActions = true,
}) {
  const [actioning, setActioning] = useState('');
  const remote = remoteLabel(job.remote_type);
  const comp   = formatComp(job.compensation_min, job.compensation_max, job.compensation_currency);

  async function act(newStatus) {
    setActioning(newStatus);
    await api.jobs.setStatus(userJobId, newStatus);
    onStatusChange?.(userJobId, newStatus);
    setActioning('');
  }

  const daysAgo = job.posted_at
    ? Math.floor((Date.now() - new Date(job.posted_at)) / 86400000)
    : null;

  return (
    <div className="bg-linen border border-[#e5e5e0] rounded-sm p-5 flex flex-col gap-4 hover:border-teal/20 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start flex-wrap gap-2 mb-1">
            <h3 className="font-montserrat font-bold text-base text-teal-deeper leading-snug">{job.title}</h3>
            {isNew && <Badge variant="new">NEW</Badge>}
          </div>
          <p className="font-lora text-sm text-ink/70">{job.company}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <ScorePill score={fitScore} />
          {fitScore != null && <span className="font-montserrat text-xs text-ink/30 uppercase tracking-wider">fit score</span>}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={remote.variant}>{remote.text}</Badge>
        {job.location && (
          <span className="flex items-center gap-1 font-lora text-xs text-ink/50">
            <MapPinIcon className="w-3 h-3" />
            {job.location}
          </span>
        )}
        {comp && (
          <span className="flex items-center gap-1 font-lora text-xs text-ink/50">
            <CurrencyDollarIcon className="w-3 h-3" />
            {comp}
          </span>
        )}
        {daysAgo != null && (
          <span className="font-lora text-xs text-ink/40 ml-auto">
            {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}
          </span>
        )}
      </div>

      {/* Description preview */}
      <p className="font-lora text-sm text-ink/70 leading-relaxed line-clamp-3">
        {job.description?.slice(0, 240)}{job.description?.length > 240 ? '...' : ''}
      </p>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2 pt-1 border-t border-[#e5e5e0]">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenDetails?.({ job, userJobId, fitScore, fitScoreReport })}
          >
            View details
          </Button>

          {status === 'discovered' && (
            <>
              <Button
                size="sm"
                loading={actioning === 'interested'}
                onClick={() => {
                  act('interested');
                  onOpenDetails?.({ job, userJobId, fitScore, fitScoreReport });
                }}
              >
                See my fit score
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={actioning === 'ignored'}
                onClick={() => act('ignored')}
                className="text-ink/40 hover:text-ink/60"
              >
                Ignore
              </Button>
            </>
          )}

          {status === 'interested' && (
            <Button size="sm" onClick={() => onOpenDetails?.({ job, userJobId, fitScore, fitScoreReport })}>
              Optimize + Apply
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
