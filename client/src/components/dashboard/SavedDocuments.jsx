import { useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { api } from '../../lib/api';
import { printResume, printCoverLetter } from '../../utils/resumePrint';

/**
 * Download links for documents already generated for a job, shown wherever a
 * job appears. Documents load on demand so job lists stay light, and users can
 * retrieve a finished resume or cover letter without reopening the full flow.
 */
export default function SavedDocuments({ userJobId, job, hasResume, hasCoverLetter, compact = false }) {
  const [busy, setBusy]   = useState('');
  const [error, setError] = useState('');

  if (!hasResume && !hasCoverLetter) return null;

  async function open(kind) {
    setBusy(kind);
    setError('');
    try {
      const p = await api.jobs.progress(userJobId);
      const style = p.tailoredResumeStyle || 'classic';
      if (kind === 'resume') {
        if (!p.tailoredResumeText) throw new Error('No saved resume found for this job.');
        printResume(p.tailoredResumeText, job?.title, job?.company, style);
      } else {
        if (!p.coverLetterText) throw new Error('No saved cover letter found for this job.');
        printCoverLetter(p.coverLetterText, job?.title, job?.company, p.tailoredResumeText || '', style);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  const linkClass =
    'flex items-center gap-1 font-montserrat text-xs font-semibold text-teal hover:text-teal-deeper transition-colors disabled:opacity-50';

  return (
    <div className={compact ? 'flex items-center gap-3 flex-wrap' : 'flex items-center gap-4 flex-wrap pt-1'}>
      {!compact && (
        <span className="font-montserrat text-[10px] uppercase tracking-widest text-ink/40">Saved documents</span>
      )}
      {hasResume && (
        <button onClick={() => open('resume')} disabled={busy === 'resume'} className={linkClass}>
          <PrinterIcon className="w-3.5 h-3.5" />
          {busy === 'resume' ? 'Opening...' : 'Resume'}
        </button>
      )}
      {hasCoverLetter && (
        <button onClick={() => open('cover')} disabled={busy === 'cover'} className={linkClass}>
          <PrinterIcon className="w-3.5 h-3.5" />
          {busy === 'cover' ? 'Opening...' : 'Cover letter'}
        </button>
      )}
      {error && <span className="font-lora text-xs text-red-600">{error}</span>}
    </div>
  );
}
