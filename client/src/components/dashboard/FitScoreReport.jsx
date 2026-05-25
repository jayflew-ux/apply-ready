import ProgressBar from '../ui/ProgressBar';
import Badge from '../ui/Badge';

const VERDICT_CONFIG = {
  "I'd submit you": { variant: 'green', label: "I'd submit you" },
  "I'd coach you first, then submit": { variant: 'copper', label: "Strong candidate" },
  "I wouldn't submit you for this role": { variant: 'copper', label: "Needs context" },
};

function ScoreRing({ score }) {
  const color = score >= 70 ? '#1e8b8b' : score >= 45 ? '#c87b33' : '#c87b33';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e5e0" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <span className="absolute font-montserrat font-bold text-lg" style={{ color }}>{score}</span>
    </div>
  );
}

export default function FitScoreReport({ report, jobTitle, company, updatedScore }) {
  if (!report) return null;

  const displayScore  = updatedScore ?? report.overall_score;
  const verdictCfg    = VERDICT_CONFIG[report.verdict] || { variant: 'teal', label: 'Good match' };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-5">
        <ScoreRing score={displayScore} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-montserrat font-bold text-lg text-ink">{displayScore}/100</span>
            <Badge variant={verdictCfg.variant}>{verdictCfg.label}</Badge>
            {updatedScore && updatedScore !== report.overall_score && (
              <Badge variant="teal">Updated</Badge>
            )}
          </div>
          {jobTitle && (
            <p className="font-lora text-sm text-ink/60 mt-0.5">{jobTitle}{company ? ` — ${company}` : ''}</p>
          )}
          <p className="font-lora text-sm text-ink/80 mt-2 leading-relaxed">{report.why_this_score}</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <ProgressBar label="Skills Match"     value={report.category_scores?.skills_match}    max={100} />
        <ProgressBar label="Experience"       value={report.category_scores?.experience_match} max={100} />
        <ProgressBar label="Culture / Values" value={report.category_scores?.culture_values}   max={100} />
        <ProgressBar label="Trajectory Fit"   value={report.category_scores?.trajectory_fit}   max={100} />
      </div>

      {/* Strengths + Gaps (visible to user only — never in resume or cover letter) */}
      <div className="grid sm:grid-cols-2 gap-4">
        {(report.strengths || []).length > 0 && (
          <div>
            <p className="font-montserrat text-xs uppercase tracking-widest text-teal mb-2">What you bring</p>
            <ul className="flex flex-col gap-1.5">
              {(report.strengths || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 font-lora text-sm text-ink/80">
                  <span className="text-teal mt-0.5 flex-shrink-0">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(report.gaps || []).length > 0 && (
          <div>
            <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-2">Where you're stretched</p>
            <ul className="flex flex-col gap-1.5">
              {(report.gaps || []).map((g, i) => (
                <li key={i} className="flex items-start gap-2 font-lora text-sm text-ink/80">
                  <span className="text-copper mt-0.5 flex-shrink-0">–</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Verdict reason */}
      {report.verdict_reason && (
        <div className="border-t border-[#e5e5e0] pt-4">
          <p className="font-montserrat text-xs uppercase tracking-widest text-ink/40 mb-1.5">Recruiter read</p>
          <p className="font-lora text-sm text-ink/80 italic leading-relaxed">{report.verdict_reason}</p>
        </div>
      )}
    </div>
  );
}
