import { useState, useEffect } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { api } from '../../lib/api';
import { printResume, printCoverLetter } from '../../utils/resumePrint';
import { estimateResumePages } from '../../utils/resumeText';
import FitScoreReport from './FitScoreReport';
import ResumePreview from './ResumePreview';
import CoverLetterPreview from './CoverLetterPreview';
import UpgradeModal from '../UpgradeModal';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { Textarea } from '../ui/Input';

const STEPS = ['Fit Score', 'Questions', 'Updated Score', 'Resume', 'Cover Letter', 'Apply'];

export default function OptimizationFlow({ userJobId, job, fitScore, fitScoreReport, onApplied, onClose }) {
  const [step, setStep]            = useState(0);
  const [loadingScore, setScoring] = useState(!fitScoreReport);
  const [report, setReport]        = useState(fitScoreReport || null);
  const [questions, setQuestions]  = useState(null);
  const [loadingQ, setLoadingQ]    = useState(false);
  const [answers, setAnswers]      = useState({});
  const [rescoring, setRescoring]  = useState(false);
  const [updatedScore, setUpdated] = useState(null);
  const [rescoreResult, setRResult] = useState(null);
  const [loadingResume, setLoadingR] = useState(false);
  const [loadingLetter, setLoadingL] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [letterText, setLetterText] = useState('');
  const [error, setError]          = useState('');
  const [upgradeOpen, setUpgrade]  = useState(false);
  const [feedback, setFeedback]    = useState('');
  const [revising, setRevising]    = useState(false);
  const [revisionsUsed, setRevUsed] = useState(0);
  const [revisionsLimit, setRevLimit] = useState(2);
  const [feedbackOpen, setFbOpen]  = useState(false);
  const [reviseNote, setReviseNote] = useState('');
  const [docStyle, setDocStyle]    = useState('classic');

  // Restore any work already done on this job, then land the user on the
  // furthest step they reached. Without this, leaving and coming back
  // silently discarded a finished resume and cover letter.
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    if (!userJobId) return;
    let cancelled = false;

    api.jobs.progress(userJobId)
      .then(p => {
        if (cancelled) return;

        if (p.fitScoreReport) { setReport(p.fitScoreReport); setScoring(false); }
        if (p.tailoredResumeText) setResumeText(p.tailoredResumeText);
        if (p.coverLetterText) setLetterText(p.coverLetterText);
        if (p.resumeRevisionsUsed != null) setRevUsed(p.resumeRevisionsUsed);
        if (p.tailoredResumeStyle) setDocStyle(p.tailoredResumeStyle);

        if (Array.isArray(p.answers) && p.answers.length) {
          // Saved answers are {question, answer}; rebuild the keyed form state
          // so the questions step shows what was already written.
          setQuestions(p.answers.map((a, i) => ({ id: `saved_${i}`, question: a.question, why: '' })));
          setAnswers(Object.fromEntries(p.answers.map((a, i) => [`saved_${i}`, a.answer || ''])));
        }

        // Resume at the furthest completed point.
        if (p.status === 'applied')          setStep(5);
        else if (p.coverLetterText)          setStep(4);
        else if (p.tailoredResumeText)       setStep(3);
        else if (p.answers?.length)          setStep(2);
        else                                 setStep(0);
      })
      .catch(() => { /* fall through to a fresh run */ })
      .finally(() => { if (!cancelled) setRestoring(false); });

    return () => { cancelled = true; };
  }, [userJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only score from scratch when there was nothing saved to restore.
  useEffect(() => {
    if (restoring) return;
    if (!report && userJobId) {
      setScoring(true);
      api.ai.fitScore(userJobId)
        .then(r => { setReport(r); setScoring(false); })
        .catch(e => { setError(e.message); setScoring(false); });
    }
  }, [restoring]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 1: auto-load questions
  useEffect(() => {
    if (step === 1 && !questions) {
      setLoadingQ(true);
      api.ai.scoreQuestions(userJobId)
        .then(data => {
          setQuestions(data.questions || []);
          setAnswers(Object.fromEntries((data.questions || []).map(q => [q.id, ''])));
          setLoadingQ(false);
        })
        .catch(e => { setError(e.message); setLoadingQ(false); });
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitAnswers() {
    setRescoring(true);
    setError('');
    const answersArr = (questions || []).map(q => ({ question: q.question, answer: answers[q.id] || '' }));
    try {
      const result = await api.ai.rescore(userJobId, { answers: answersArr });
      setUpdated(result.overall_score);
      setRResult(result);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setRescoring(false);
    }
  }

  async function generateResume() {
    setLoadingR(true);
    setError('');
    const answersArr = (questions || []).map(q => ({ question: q.question, answer: answers[q.id] || '' }));
    try {
      const data = await api.ai.tailorResume(userJobId, { answers: answersArr });
      setResumeText(data.tailored_resume_text);
      setRevUsed(0);          // a fresh build restores both revisions
      setFbOpen(false);
      setFeedback('');
      setReviseNote('');
    } catch (e) {
      if (e.data?.upgrade_required) {
        setUpgrade(true);
        setStep(2); // back to the score step so the flow isn't stranded
      } else {
        setError(e.message);
      }
    } finally {
      setLoadingR(false);
    }
  }

  async function generateLetter() {
    setLoadingL(true);
    setError('');
    const answersArr = (questions || []).map(q => ({ question: q.question, answer: answers[q.id] || '' }));
    try {
      const data = await api.ai.coverLetter(userJobId, { answers: answersArr });
      setLetterText(data.cover_letter_text);
    } catch (e) {
      if (e.data?.upgrade_required) {
        setUpgrade(true);
        setStep(3);
      } else {
        setError(e.message);
      }
    } finally {
      setLoadingL(false);
    }
  }

  async function submitFeedback() {
    if (!feedback.trim()) return;
    setRevising(true);
    setError('');
    try {
      const data = await api.ai.reviseResume(userJobId, { feedback: feedback.trim() });
      setResumeText(data.tailored_resume_text);
      setRevUsed(data.revisions_used);
      setRevLimit(data.revisions_limit);
      setFeedback('');
      setFbOpen(false);
      setReviseNote('Updated with your feedback.');
    } catch (e) {
      setError(e.message);
      if (e.data?.revisions_used != null) setRevUsed(e.data.revisions_used);
    } finally {
      setRevising(false);
    }
  }

  async function markApplied() {
    await api.jobs.setStatus(userJobId, 'applied');
    onApplied?.();
  }

  if (restoring) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Spinner size="lg" />
        <p className="font-lora text-sm text-ink/60">Loading your progress...</p>
      </div>
    );
  }

  // Steps the user can jump back to: anything already completed.
  const furthestStep = letterText ? 5 : resumeText ? 4 : report ? 2 : 0;
  const canVisit = i => i <= Math.max(step, furthestStep);

  return (
    <div className="flex flex-col gap-6">
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgrade(false)} />
      {/* Step indicator — completed steps are clickable so nothing is stranded */}
      <div className="flex gap-0 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-shrink-0">
            <button
              type="button"
              onClick={() => canVisit(i) && setStep(i)}
              disabled={!canVisit(i)}
              title={canVisit(i) ? `Go to ${s}` : 'Not yet available'}
              className={`flex flex-col items-center gap-1 ${canVisit(i) ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`w-6 h-6 rounded-full text-xs font-montserrat font-bold flex items-center justify-center border transition-colors ${
                step === i     ? 'border-teal bg-teal text-white' :
                canVisit(i)    ? 'border-teal/40 bg-teal/10 text-teal hover:bg-teal/20' :
                'border-[#e5e5e0] text-ink/30'
              }`}>
                {step > i ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-montserrat hidden sm:block whitespace-nowrap ${step === i ? 'text-teal font-semibold' : canVisit(i) ? 'text-ink/50' : 'text-ink/30'}`}>{s}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`h-px w-3 mx-1 mt-[-12px] flex-shrink-0 ${step > i ? 'bg-teal/40' : 'bg-[#e5e5e0]'}`} />}
          </div>
        ))}
      </div>

      {(resumeText || letterText) && step < 3 && (
        <div className="bg-teal/5 border border-teal/20 rounded-sm px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="font-lora text-sm text-ink/70">
            You already have {[resumeText && 'a tailored resume', letterText && 'a cover letter'].filter(Boolean).join(' and ')} saved for this job.
          </p>
          <Button size="sm" variant="outline" onClick={() => setStep(letterText ? 4 : 3)}>
            Go to my documents
          </Button>
        </div>
      )}

      {error && <p className="font-lora text-sm text-red-600 bg-red-50 px-4 py-3 rounded-sm">{error}</p>}

      {/* STEP 0: Fit Score */}
      {step === 0 && (
        <div className="flex flex-col gap-4">
          {loadingScore ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size="lg" />
              <p className="font-lora text-sm text-ink/60">Scoring your fit against this role...</p>
            </div>
          ) : report ? (
            <>
              <FitScoreReport report={report} jobTitle={job?.title} company={job?.company} />
              <Button onClick={() => setStep(1)}>
                Answer a few questions to strengthen this
              </Button>
            </>
          ) : null}
        </div>
      )}

      {/* STEP 1: Clarifying Questions */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="font-montserrat font-bold text-base text-teal-deeper mb-1">A few quick questions</h3>
            <p className="font-lora text-sm text-ink/60 leading-relaxed">
              These help surface context your resume may not fully capture. Your answers go directly into your tailored materials and update your fit score.
            </p>
          </div>

          {loadingQ ? (
            <div className="flex items-center gap-3 py-4">
              <Spinner size="sm" />
              <span className="font-lora text-sm text-ink/60">Generating questions based on your background...</span>
            </div>
          ) : questions ? (
            <div className="flex flex-col gap-5">
              {questions.map(q => (
                <div key={q.id}>
                  <p className="font-lora text-sm font-medium text-ink mb-1">{q.question}</p>
                  {q.why && <p className="font-lora text-xs text-ink/50 mb-2 italic">{q.why}</p>}
                  <Textarea
                    placeholder="Your answer..."
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  />
                </div>
              ))}
              <Button onClick={submitAnswers} loading={rescoring}>
                Update my score
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* STEP 2: Updated Score */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <h3 className="font-montserrat font-bold text-base text-teal-deeper mb-1">Updated fit score</h3>

          <FitScoreReport
            report={report}
            jobTitle={job?.title}
            company={job?.company}
            updatedScore={updatedScore}
          />

          {rescoreResult && (
            <div className="bg-teal/5 border border-teal/20 rounded-sm px-4 py-3">
              <p className="font-lora text-sm text-ink/80 leading-relaxed">{rescoreResult.updated_why}</p>
              {rescoreResult.additional_strengths?.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {rescoreResult.additional_strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 font-lora text-sm text-teal">
                      <span className="flex-shrink-0">+</span>{s}
                    </li>
                  ))}
                </ul>
              )}
              {rescoreResult.still_missing?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-teal/15">
                  <p className="font-montserrat text-[10px] uppercase tracking-widest text-copper mb-1.5">Still unresolved</p>
                  <ul className="flex flex-col gap-1">
                    {rescoreResult.still_missing.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 font-lora text-sm text-ink/70">
                        <span className="text-copper flex-shrink-0">–</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={() => { setStep(3); generateResume(); }}>
              Tailor my resume for this role
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-ink/50">
              Save and come back later
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Tailored Resume */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h3 className="font-montserrat font-bold text-base text-teal-deeper">Tailored resume</h3>

          {loadingResume && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size="lg" />
              <p className="font-lora text-sm text-ink/60">Writing your tailored resume...</p>
            </div>
          )}

          {!loadingResume && !resumeText && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="font-lora text-sm text-ink/60">No tailored resume for this job yet.</p>
              <Button size="sm" onClick={generateResume}>Build my tailored resume</Button>
            </div>
          )}

          {resumeText && (
            <>
              <div className="max-h-[480px] overflow-y-auto rounded-sm">
                <ResumePreview text={resumeText} />
              </div>
              <p className="font-lora text-xs text-ink/40">
                {estimateResumePages(resumeText) > 2
                  ? 'This is running long and may print past two pages. Ask for a trim below, or continue as is.'
                  : 'Not quite right? Tell the AI what to change before you print it.'}
              </p>

              {/* Feedback loop — recourse when the output is not what they expected */}
              <div className="bg-white border border-[#e5e5e0] rounded-sm p-4">
                {reviseNote && !feedbackOpen && (
                  <p className="font-lora text-xs text-teal mb-2">{reviseNote}</p>
                )}

                {!feedbackOpen ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="font-lora text-sm text-ink/70">
                      {revisionsUsed >= revisionsLimit
                        ? 'You have used both revisions for this job. Regenerate the resume above to start over with a fresh pair.'
                        : 'Missing something, or want different emphasis? Tell the AI and it will rewrite it.'}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revisionsUsed >= revisionsLimit}
                      onClick={() => { setFbOpen(true); setReviseNote(''); }}
                    >
                      Request changes
                      {revisionsUsed < revisionsLimit && ` (${revisionsLimit - revisionsUsed} left)`}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="font-montserrat font-semibold text-sm text-ink/80 mb-1">What should change?</p>
                      <p className="font-lora text-xs text-ink/50 mb-2">
                        Be specific. For example: "You left off my education and my two earliest roles, please put them back,"
                        or "Lead with my management experience instead of the technical work."
                      </p>
                    </div>
                    <Textarea
                      placeholder="Tell the AI what to fix..."
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      maxLength={2000}
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <Button size="sm" onClick={submitFeedback} loading={revising} disabled={!feedback.trim()}>
                        Rewrite it
                      </Button>
                      <button
                        onClick={() => { setFbOpen(false); setFeedback(''); }}
                        className="font-lora text-xs text-ink/40 hover:text-ink/60"
                      >
                        Cancel
                      </button>
                      <span className="font-lora text-xs text-ink/40">
                        {revisionsLimit - revisionsUsed} of {revisionsLimit} revisions left for this job
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printResume(resumeText, job?.title, job?.company, docStyle)}
                >
                  <PrinterIcon className="w-4 h-4" /> Print / Save as PDF
                </Button>
                <Button size="sm" onClick={() => { setStep(4); generateLetter(); }}>
                  Generate cover letter
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 4: Cover Letter */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <h3 className="font-montserrat font-bold text-base text-teal-deeper">Cover letter</h3>

          {loadingLetter && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size="lg" />
              <p className="font-lora text-sm text-ink/60">Writing your cover letter...</p>
            </div>
          )}

          {!loadingLetter && !letterText && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="font-lora text-sm text-ink/60">No cover letter for this job yet.</p>
              <Button size="sm" onClick={generateLetter}>Write my cover letter</Button>
            </div>
          )}

          {letterText && (
            <>
              <div className="max-h-[480px] overflow-y-auto rounded-sm">
                <CoverLetterPreview text={letterText} company={job?.company} resumeText={resumeText} />
              </div>
              <p className="font-lora text-xs text-ink/40">
                This is formatted and ready to send — download it as a PDF and attach it directly.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printCoverLetter(letterText, job?.title, job?.company, resumeText, docStyle)}
                >
                  <PrinterIcon className="w-4 h-4" /> Print / Save as PDF
                </Button>
                <Button size="sm" onClick={() => setStep(5)}>
                  Ready to apply
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 5: Apply */}
      {step === 5 && (
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="font-montserrat font-bold text-base text-teal-deeper mb-1">Ready to submit</h3>
            <p className="font-lora text-sm text-ink/60">Print your final documents, head to the application, and mark it when you have submitted.</p>
          </div>
          <div className="flex flex-col gap-2">
            {resumeText && (
              <Button variant="outline" onClick={() => printResume(resumeText, job?.title, job?.company, docStyle)}>
                <PrinterIcon className="w-4 h-4" /> Print resume as PDF
              </Button>
            )}
            {letterText && (
              <Button variant="outline" onClick={() => printCoverLetter(letterText, job?.title, job?.company, resumeText, docStyle)}>
                <PrinterIcon className="w-4 h-4" /> Print cover letter as PDF
              </Button>
            )}
            {job?.url && (
              <a href={job.url} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full">Open job posting</Button>
              </a>
            )}
          </div>
          <Button onClick={markApplied}>Mark as applied</Button>
        </div>
      )}
    </div>
  );
}
