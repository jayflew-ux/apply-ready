import { useState } from 'react';
import { api } from '../../lib/api';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Spinner from '../ui/Spinner';

const JOURNEY_STEPS = [
  { value: 'applied',               label: 'Applied',           variant: 'gray' },
  { value: 'phone-screen',          label: 'Phone screen',      variant: 'teal' },
  { value: 'first-interview',       label: 'First interview',   variant: 'teal' },
  { value: 'subsequent-interview',  label: 'More interviews',   variant: 'teal' },
  { value: 'final-round',           label: 'Final round',       variant: 'copper' },
  { value: 'offer',                 label: 'Offer',             variant: 'gold' },
  { value: 'accepted',              label: 'Accepted',          variant: 'green' },
  { value: 'declined',              label: 'Declined offer',    variant: 'gray' },
  { value: 'rejected',              label: 'Rejected',          variant: 'red' },
  { value: 'ghosted',               label: 'Ghosted',           variant: 'gray' },
  { value: 'withdrawn',             label: 'Withdrawn',         variant: 'gray' },
];

const ACTIVE_FLOW = [
  'applied', 'phone-screen', 'first-interview',
  'subsequent-interview', 'final-round', 'offer',
];

export default function JourneyTracker({
  userJobId,
  journeyStatus,
  journeyNotes,
  job,
  interviewPrep,
  postInterviewDebrief,
  onUpdate,
}) {
  const [open, setOpen]             = useState(false);
  const [status, setStatus]         = useState(journeyStatus || 'applied');
  const [notes, setNotes]           = useState(journeyNotes || '');
  const [saving, setSaving]         = useState(false);

  const [prepOpen, setPrepOpen]     = useState(false);
  const [debriefOpen, setDebrief]   = useState(false);
  const [prepData, setPrepData]     = useState(interviewPrep || null);
  const [interviewerName, setIName] = useState(interviewPrep?.interviewer_name || '');
  const [interviewerRole, setIRole] = useState(interviewPrep?.interviewer_role || '');
  const [debriefData, setDebriefD]  = useState(postInterviewDebrief || null);
  const [interviewNotes, setIN]     = useState('');
  const [loadingPrep, setLP]        = useState(false);
  const [debriefSubmitting, setDS]  = useState(false);

  const currentStep = JOURNEY_STEPS.find(s => s.value === (journeyStatus || 'applied'));

  async function save() {
    setSaving(true);
    await api.jobs.setJourney(userJobId, { journey_status: status, journey_notes: notes });
    setSaving(false);
    onUpdate?.({ journey_status: status, journey_notes: notes });
    setOpen(false);
  }

  async function generatePrep() {
    setLP(true);
    const data = await api.ai.interviewPrep(userJobId, {
      interviewer_name: interviewerName.trim(),
      interviewer_role: interviewerRole.trim(),
    });
    setPrepData(data);
    setLP(false);
  }

  async function submitDebrief() {
    if (!interviewNotes.trim()) return;
    setDS(true);
    const data = await api.ai.debrief(userJobId, { interview_notes: interviewNotes });
    setDebriefD(data);
    setDS(false);
  }

  const isActive = ACTIVE_FLOW.includes(journeyStatus || 'applied');

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant={currentStep?.variant || 'gray'}>{currentStep?.label || 'Applied'}</Badge>
        <button
          onClick={() => setOpen(true)}
          className="font-lora text-xs text-teal hover:text-teal-dark underline-offset-2 hover:underline transition-colors"
        >
          Update status
        </button>
        {isActive && (
          <button
            onClick={() => setPrepOpen(true)}
            className="font-lora text-xs text-copper hover:text-copper/80 underline-offset-2 hover:underline transition-colors"
          >
            Interview prep
          </button>
        )}
        {(journeyStatus === 'first-interview' || journeyStatus === 'subsequent-interview' || journeyStatus === 'final-round') && (
          <button
            onClick={() => setDebrief(true)}
            className="font-lora text-xs text-ink/50 hover:text-ink transition-colors underline-offset-2 hover:underline"
          >
            Post-interview debrief
          </button>
        )}
      </div>

      {/* Update status modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Update journey status">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2">
            {JOURNEY_STEPS.map(s => (
              <label
                key={s.value}
                className={`flex items-center gap-2 px-3 py-2 border rounded-sm cursor-pointer text-sm font-lora transition-colors ${status === s.value ? 'border-teal bg-teal/5 text-teal' : 'border-[#e3ddd2] text-ink/70 hover:border-teal/30'}`}
              >
                <input type="radio" name="journey_status" value={s.value} checked={status === s.value} onChange={() => setStatus(s.value)} className="sr-only" />
                <span className={`w-3 h-3 rounded-full border flex-shrink-0 ${status === s.value ? 'border-teal bg-teal' : 'border-ink/30'}`} />
                {s.label}
              </label>
            ))}
          </div>
          <textarea
            className="w-full h-24 px-3 py-2.5 surface border border-[#e3ddd2] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal resize-y"
            placeholder="Notes (optional)..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <Button onClick={save} loading={saving}>Save</Button>
        </div>
      </Modal>

      {/* Interview prep modal */}
      <Modal open={prepOpen} onClose={() => setPrepOpen(false)} title="Interview prep" wide>
        {!prepData && !loadingPrep && (
          <div className="flex flex-col gap-5">
            <p className="font-lora text-sm text-ink/60 leading-relaxed">
              Know who's interviewing you? Tell us their name and role and the AI will look up their public professional background to sharpen your prep. Leave it blank and it will research the company and role instead.
            </p>
            <Input
              label="Interviewer name (optional)"
              placeholder="e.g. Jordan Reyes"
              value={interviewerName}
              onChange={e => setIName(e.target.value)}
            />
            <Input
              label="Interviewer role or title (optional)"
              placeholder="e.g. Engineering Manager"
              value={interviewerRole}
              onChange={e => setIRole(e.target.value)}
            />
            <Button onClick={generatePrep} loading={loadingPrep}>
              Generate my interview prep
            </Button>
          </div>
        )}

        {loadingPrep && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Spinner size="lg" />
            <p className="font-lora text-sm text-ink/60">Researching and building your prep...</p>
          </div>
        )}

        {prepData && !loadingPrep && (
          <div className="flex flex-col gap-6">
            {(prepData.interviewer_name || prepData.interviewer_role) && (
              <p className="font-lora text-xs text-ink/50 italic">
                Prepped for your conversation with {[prepData.interviewer_name, prepData.interviewer_role].filter(Boolean).join(', ')}.
              </p>
            )}

            {prepData.company_notes && (
              <div>
                <p className="font-montserrat text-xs uppercase tracking-widest text-teal mb-2">About the company right now</p>
                <p className="font-lora text-sm text-ink/80 leading-relaxed">{prepData.company_notes}</p>
              </div>
            )}

            {prepData.interviewer_notes && (
              <div>
                <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-2">About your interviewer</p>
                <p className="font-lora text-sm text-ink/80 leading-relaxed">{prepData.interviewer_notes}</p>
              </div>
            )}

            {prepData.role_context && (
              <div>
                <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-2">What this role needs</p>
                <p className="font-lora text-sm text-ink/80 leading-relaxed">{prepData.role_context}</p>
              </div>
            )}

            {prepData.behavioral_questions?.length > 0 && (
              <div>
                <p className="font-montserrat text-xs uppercase tracking-widest text-teal mb-3">Behavioral questions</p>
                <div className="flex flex-col gap-4">
                  {prepData.behavioral_questions.map((q, i) => (
                    <div key={i} className="border-l-2 border-teal/30 pl-4">
                      <p className="font-lora text-sm font-medium text-ink mb-1">{q.question}</p>
                      <p className="font-lora text-xs text-ink/50 italic mb-1">{q.what_they_want}</p>
                      <p className="font-lora text-xs text-teal">{q.coaching}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {prepData.technical_questions?.length > 0 && (
              <div>
                <p className="font-montserrat text-xs uppercase tracking-widest text-teal mb-3">Technical / role-specific questions</p>
                <div className="flex flex-col gap-4">
                  {prepData.technical_questions.map((q, i) => (
                    <div key={i} className="border-l-2 border-copper/30 pl-4">
                      <p className="font-lora text-sm font-medium text-ink mb-1">{q.question}</p>
                      <p className="font-lora text-xs text-ink/50 italic mb-1">{q.what_they_want}</p>
                      <p className="font-lora text-xs text-copper">{q.coaching}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {prepData.questions_to_ask?.length > 0 && (
              <div>
                <p className="font-montserrat text-xs uppercase tracking-widest text-ink/40 mb-2">Questions to ask them</p>
                <ul className="flex flex-col gap-1.5">
                  {prepData.questions_to_ask.map((q, i) => (
                    <li key={i} className="font-lora text-sm text-ink/70 flex gap-2">
                      <span className="text-teal">→</span>{q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {prepData.watch_outs?.length > 0 && (
              <div>
                <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-2">Watch-outs</p>
                <ul className="flex flex-col gap-1.5">
                  {prepData.watch_outs.map((w, i) => (
                    <li key={i} className="font-lora text-sm text-ink/70 flex gap-2">
                      <span className="text-copper">!</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setPrepData(null)}
              className="font-lora text-xs text-ink/40 hover:text-ink/60 underline-offset-2 hover:underline self-start"
            >
              Prep again with different interviewer info
            </button>
          </div>
        )}
      </Modal>

      {/* Debrief modal */}
      <Modal open={debriefOpen} onClose={() => setDebrief(false)} title="Post-interview debrief" wide>
        <div className="flex flex-col gap-5">
          {!debriefData ? (
            <>
              <p className="font-lora text-sm text-ink/60 leading-relaxed">Drop in your notes from the interview — what you were asked, how you answered, anything that surprised you. The more specific, the more useful the read.</p>
              <textarea
                className="w-full h-40 px-3 py-2.5 surface border border-[#e3ddd2] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal resize-y"
                placeholder="They asked about my experience with X. I answered by talking about Y. The panel seemed interested in Z. One question caught me off guard: ..."
                value={interviewNotes}
                onChange={e => setIN(e.target.value)}
              />
              <Button onClick={submitDebrief} loading={debriefSubmitting} disabled={!interviewNotes.trim()}>
                Get my debrief
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              {debriefData.overall_read && (
                <div>
                  <p className="font-montserrat text-xs uppercase tracking-widest text-ink/40 mb-1.5">Overall read</p>
                  <p className="font-lora text-sm text-ink/80 leading-relaxed">{debriefData.overall_read}</p>
                </div>
              )}
              {debriefData.likelihood && (
                <div className="flex items-center gap-2">
                  <span className="font-montserrat text-xs uppercase tracking-widest text-ink/40">Likelihood:</span>
                  <span className={`font-montserrat font-bold text-sm ${debriefData.likelihood.startsWith('Strong') ? 'text-teal' : debriefData.likelihood.startsWith('Unlikely') ? 'text-red-600' : 'text-copper'}`}>{debriefData.likelihood}</span>
                </div>
              )}
              {debriefData.went_well?.length > 0 && (
                <div>
                  <p className="font-montserrat text-xs uppercase tracking-widest text-teal mb-2">Went well</p>
                  <ul className="flex flex-col gap-1">{debriefData.went_well.map((w, i) => <li key={i} className="font-lora text-sm text-ink/70 flex gap-2"><span className="text-teal">+</span>{w}</li>)}</ul>
                </div>
              )}
              {debriefData.could_be_stronger?.length > 0 && (
                <div>
                  <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-2">Could be stronger</p>
                  <ul className="flex flex-col gap-1">{debriefData.could_be_stronger.map((w, i) => <li key={i} className="font-lora text-sm text-ink/70 flex gap-2"><span className="text-copper">–</span>{w}</li>)}</ul>
                </div>
              )}
              {debriefData.follow_up_action && (
                <div className="bg-teal/5 border border-teal/20 rounded-sm px-4 py-3">
                  <p className="font-montserrat text-xs uppercase tracking-widest text-teal mb-1">Next 24 hours</p>
                  <p className="font-lora text-sm text-ink/80">{debriefData.follow_up_action}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
