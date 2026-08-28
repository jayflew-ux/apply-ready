import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import UpgradeModal from '../components/UpgradeModal';

const SITUATIONS = [
  { value: 'entry-level',         label: 'Entry-level / first job' },
  { value: 'lateral',             label: 'Lateral move' },
  { value: 'stretch',             label: 'Stretch / step up in seniority' },
  { value: 'career-switch',       label: 'Career switch' },
  { value: 'returning',           label: 'Returning after a break' },
  { value: 'relocating',          label: 'Relocating' },
  { value: 'employed-exploring',  label: 'Currently employed and exploring' },
  { value: 'laid-off',            label: 'Recently laid off' },
  { value: 'contract-perm',       label: 'Contract-to-perm seeking' },
  { value: 'semi-retired',        label: 'Semi-retired / encore career' },
  { value: 'other',               label: 'Other' },
];

const REMOTE_PREFS = [
  { value: 'remote',   label: 'Remote only' },
  { value: 'hybrid',   label: 'Hybrid' },
  { value: 'onsite',   label: 'On-site only' },
  { value: 'flexible', label: 'Flexible / open' },
];

const STYLES = [
  { value: 'classic',   label: 'Classic Professional' },
  { value: 'modern',    label: 'Modern Minimal' },
  { value: 'ats-safe',  label: 'ATS-Safe Plain' },
  { value: 'editorial', label: 'Editorial Branded' },
  { value: 'executive', label: 'Executive' },
];

export default function Profile() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [form, setForm]       = useState({});

  // Resume state
  const [resume, setResume]           = useState(null);
  const [resumeMode, setResumeMode]   = useState(null); // null | 'file' | 'text'
  const [resumeText, setResumeText]   = useState('');
  const [uploading, setUploading]     = useState(false);
  const [uploadDone, setUploadDone]   = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.billing.status()
      .then(s => setBillingEnabled(Boolean(s?.billing_enabled)))
      .catch(() => setBillingEnabled(false));
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const { url } = await api.billing.portal();
      window.location.href = url;
    } catch {
      setPortalLoading(false);
    }
  }

  useEffect(() => {
    api.resume.get().then(r => setResume(r)).catch(() => {});
  }, []);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('resume', file);
      await api.resume.upload(fd);
      const updated = await api.resume.get();
      setResume(updated);
      setResumeMode(null);
      setUploadDone(true);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleTextUpload() {
    if (!resumeText.trim()) return;
    setUploading(true);
    setUploadError('');
    try {
      await api.resume.text(resumeText.trim());
      const updated = await api.resume.get();
      setResume(updated);
      setResumeMode(null);
      setResumeText('');
      setUploadDone(true);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    api.profile.get().then(p => {
      setProfile(p);
      setForm({
        full_name:         p.full_name || '',
        situation:         p.situation || '',
        situation_other:   p.situation_other || '',
        resume_style:      p.resume_style || 'classic',
        target_roles:      (p.target_roles || []).join(', '),
        target_regions:    (p.target_regions || []).join(', '),
        seniority_target:  p.seniority_target || '',
        remote_preference: p.remote_preference || 'flexible',
        compensation_floor: p.compensation_floor || '',
        larger_build_note: p.larger_build_note || '',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      target_roles:   form.target_roles.split(',').map(s => s.trim()).filter(Boolean),
      target_regions: form.target_regions.split(',').map(s => s.trim()).filter(Boolean),
      compensation_floor: form.compensation_floor ? Number(form.compensation_floor) : null,
    };
    await api.profile.update(payload);
    setSaving(false);
    setSaved(true);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/dashboard" className="font-montserrat font-bold text-teal text-sm tracking-widest uppercase">Dream Job Ready</Link>
        <button onClick={signOut} className="font-lora text-sm text-ink/50 hover:text-ink transition-colors">Sign out</button>
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-20">
        <div className="py-8 border-b border-[#e3ddd2] mb-8">
          <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-2">Settings</p>
          <h1 className="font-montserrat font-bold text-2xl text-teal-deeper">Your Profile</h1>
          <p className="font-lora text-sm text-ink/60 mt-1">{user?.email}</p>
        </div>

        <div className="flex flex-col gap-8">
          <Input label="Full name" value={form.full_name || ''} onChange={e => set('full_name', e.target.value)} />

          <div>
            <label className="block text-sm font-montserrat font-semibold text-ink/80 mb-3 tracking-wide">Situation</label>
            <div className="grid grid-cols-2 gap-2">
              {SITUATIONS.map(s => (
                <label key={s.value} className={`flex items-center gap-2 px-3 py-2 border rounded-sm cursor-pointer text-sm font-lora transition-colors ${form.situation === s.value ? 'border-teal bg-teal/5 text-teal' : 'border-[#e3ddd2] text-ink/70 hover:border-teal/30'}`}>
                  <input type="radio" name="situation" value={s.value} checked={form.situation === s.value} onChange={() => set('situation', s.value)} className="sr-only" />
                  {s.label}
                </label>
              ))}
            </div>
            {form.situation === 'other' && (
              <Input className="mt-3" placeholder="Describe your situation..." value={form.situation_other || ''} onChange={e => set('situation_other', e.target.value)} />
            )}
          </div>

          <div>
            <label className="block text-sm font-montserrat font-semibold text-ink/80 mb-3 tracking-wide">Default resume style</label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map(s => (
                <label key={s.value} className={`px-4 py-2 border rounded-sm cursor-pointer text-sm font-lora transition-colors ${form.resume_style === s.value ? 'border-teal bg-teal/5 text-teal' : 'border-[#e3ddd2] text-ink/70 hover:border-teal/30'}`}>
                  <input type="radio" name="resume_style" value={s.value} checked={form.resume_style === s.value} onChange={() => set('resume_style', s.value)} className="sr-only" />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <Input
            label="Target roles"
            hint="Comma-separated, e.g.: Product Manager, Senior PM, Director of Product"
            value={form.target_roles || ''}
            onChange={e => set('target_roles', e.target.value)}
          />

          <Input
            label="Search regions"
            hint="Comma-separated, e.g.: United States, Remote, United Kingdom"
            value={form.target_regions || ''}
            onChange={e => set('target_regions', e.target.value)}
          />

          <Input
            label="Seniority target"
            placeholder="e.g. Senior, Lead, Manager"
            value={form.seniority_target || ''}
            onChange={e => set('seniority_target', e.target.value)}
          />

          <div>
            <label className="block text-sm font-montserrat font-semibold text-ink/80 mb-3 tracking-wide">Work arrangement</label>
            <div className="flex flex-wrap gap-2">
              {REMOTE_PREFS.map(r => (
                <label key={r.value} className={`px-4 py-2 border rounded-sm cursor-pointer text-sm font-lora transition-colors ${form.remote_preference === r.value ? 'border-teal bg-teal/5 text-teal' : 'border-[#e3ddd2] text-ink/70 hover:border-teal/30'}`}>
                  <input type="radio" name="remote_preference" value={r.value} checked={form.remote_preference === r.value} onChange={() => set('remote_preference', r.value)} className="sr-only" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          <Input
            label="Compensation floor (annual)"
            type="number"
            placeholder="e.g. 120000"
            value={form.compensation_floor || ''}
            onChange={e => set('compensation_floor', e.target.value)}
          />

          <div>
            <label className="block text-sm font-montserrat font-semibold text-ink/80 mb-1.5 tracking-wide">Larger build note</label>
            <p className="text-xs font-lora text-ink/50 mb-2">Work a role must serve, not strangle. Optional.</p>
            <textarea
              className="w-full px-3 py-2.5 surface border border-[#e3ddd2] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal resize-y min-h-[80px]"
              placeholder="e.g. Building toward a COO or GM role within 5 years. Needs to develop P&L ownership."
              value={form.larger_build_note || ''}
              onChange={e => set('larger_build_note', e.target.value)}
            />
          </div>

          {/* Plan section */}
          <div className="border-t border-[#e3ddd2] pt-8">
            <p className="font-montserrat font-semibold text-sm text-ink/80 tracking-wide mb-2">Your plan</p>
            {!billingEnabled ? (
              <p className="font-lora text-sm text-ink/70">
                <span className="font-montserrat font-bold text-teal">Free while in preview</span> — everything is unlocked, including unlimited tailored resumes, cover letters, and interview prep. No card needed.
              </p>
            ) : profile?.subscription_status === 'active' ? (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="font-lora text-sm text-ink/70">
                  <span className="font-montserrat font-bold text-teal">Dream Job Ready Pro</span> — unlimited application builds.
                </p>
                <Button size="sm" variant="outline" onClick={openPortal} loading={portalLoading}>
                  Manage subscription
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="font-lora text-sm text-ink/70">
                  Free plan — includes role discovery, scored listings, fit scores, and one complete application build.
                </p>
                <Button size="sm" onClick={() => setUpgradeOpen(true)}>
                  Upgrade
                </Button>
              </div>
            )}
          </div>

          {/* Resume section */}
          <div className="border-t border-[#e3ddd2] pt-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-montserrat font-semibold text-sm text-ink/80 tracking-wide mb-1">Resume on file</p>
                {resume ? (
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="w-4 h-4 text-teal flex-shrink-0" />
                    <span className="font-lora text-sm text-ink/70">
                      {resume.filename || 'Pasted text'}
                      <span className="text-ink/40 ml-2 text-xs">
                        {resume.created_at ? new Date(resume.created_at).toLocaleDateString() : ''}
                      </span>
                    </span>
                  </div>
                ) : (
                  <p className="font-lora text-sm text-ink/40 italic">No resume uploaded yet.</p>
                )}
                {uploadDone && <p className="font-lora text-sm text-teal mt-1">Resume updated.</p>}
              </div>
              {!resumeMode && (
                <Button size="sm" variant="outline" onClick={() => { setResumeMode('file'); setUploadDone(false); }}>
                  {resume ? 'Replace resume' : 'Upload resume'}
                </Button>
              )}
            </div>

            {resumeMode && (
              <div className="flex flex-col gap-4 surface border border-[#e3ddd2] rounded-sm p-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setResumeMode('file')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-montserrat font-semibold transition-colors ${resumeMode === 'file' ? 'bg-teal text-white' : 'bg-[#e5e5e0] text-ink/60 hover:bg-teal/10'}`}
                  >
                    Upload file
                  </button>
                  <button
                    onClick={() => setResumeMode('text')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-montserrat font-semibold transition-colors ${resumeMode === 'text' ? 'bg-teal text-white' : 'bg-[#e5e5e0] text-ink/60 hover:bg-teal/10'}`}
                  >
                    Paste text
                  </button>
                </div>

                {resumeMode === 'file' && (
                  <div className="flex flex-col gap-3">
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center justify-center gap-2 w-full py-8 border-2 border-dashed border-[#e3ddd2] rounded-sm text-ink/40 hover:border-teal/40 hover:text-teal transition-colors disabled:opacity-50"
                    >
                      {uploading ? <Spinner size="sm" /> : <ArrowUpTrayIcon className="w-5 h-5" />}
                      <span className="font-lora text-sm">{uploading ? 'Uploading...' : 'Click to choose a PDF or Word doc'}</span>
                    </button>
                  </div>
                )}

                {resumeMode === 'text' && (
                  <div className="flex flex-col gap-3">
                    <textarea
                      className="w-full px-3 py-2.5 surface border border-[#e3ddd2] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal resize-y min-h-[200px]"
                      placeholder="Paste your resume text here..."
                      value={resumeText}
                      onChange={e => setResumeText(e.target.value)}
                    />
                    <Button onClick={handleTextUpload} loading={uploading} disabled={!resumeText.trim()}>
                      Save resume
                    </Button>
                  </div>
                )}

                {uploadError && <p className="font-lora text-sm text-red-600">{uploadError}</p>}

                <button
                  onClick={() => { setResumeMode(null); setUploadError(''); setResumeText(''); }}
                  className="font-lora text-xs text-ink/40 hover:text-ink/60 self-start"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={save} loading={saving}>Save changes</Button>
            {saved && <span className="font-lora text-sm text-teal">Saved.</span>}
          </div>

          <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
        </div>
      </main>
    </div>
  );
}
