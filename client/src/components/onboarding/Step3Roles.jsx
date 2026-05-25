import { useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { api } from '../../lib/api';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const DEFAULT_REGIONS = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'Remote — anywhere',
  'Remote — within US',
  'Remote — within UK',
];

const REMOTE_PREFS = [
  { value: 'remote',   label: 'Remote only' },
  { value: 'hybrid',   label: 'Hybrid' },
  { value: 'onsite',   label: 'On-site only' },
  { value: 'flexible', label: 'Flexible / open' },
];

export default function Step3Roles({ onComplete }) {
  const [loading, setLoading]         = useState(true);
  const [suggestedRoles, setSuggested] = useState([]);
  const [selectedRoles, setRoles]     = useState([]);
  const [customRole, setCustomRole]   = useState('');
  const [selectedRegions, setRegions] = useState([]);
  const [customRegion, setCustomRegion] = useState('');
  const [seniority, setSeniority]     = useState('');
  const [remotePref, setRemote]       = useState('flexible');
  const [compFloor, setComp]          = useState('');
  const [largerBuild, setLarger]      = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    api.ai.suggestRoles()
      .then(data => {
        setSuggested(data.roles || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggleRole(title) {
    setRoles(r => r.includes(title) ? r.filter(x => x !== title) : [...r, title]);
  }

  function addCustomRole() {
    const t = customRole.trim();
    if (t && !selectedRoles.includes(t)) {
      setRoles(r => [...r, t]);
      setCustomRole('');
    }
  }

  function toggleRegion(region) {
    setRegions(r => r.includes(region) ? r.filter(x => x !== region) : [...r, region]);
  }

  function addCustomRegion() {
    const t = customRegion.trim();
    if (t && !selectedRegions.includes(t)) {
      setRegions(r => [...r, t]);
      setCustomRegion('');
    }
  }

  async function handleFinish() {
    if (!selectedRoles.length) { setError('Select at least one target role.'); return; }
    if (!selectedRegions.length) { setError('Select at least one region.'); return; }
    setError('');
    setSaving(true);

    await api.profile.update({
      target_roles: selectedRoles,
      target_regions: selectedRegions,
      seniority_target: seniority,
      remote_preference: remotePref,
      compensation_floor: compFloor ? Number(compFloor) : null,
      larger_build_note: largerBuild,
    });

    await api.profile.setOnboardingStep(3, true);
    await api.jobs.refresh();
    setSaving(false);
    onComplete();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Role suggestions */}
      <div>
        <p className="font-montserrat font-semibold text-sm text-ink/80 mb-1 tracking-wide">Target roles</p>
        <p className="font-lora text-xs text-ink/50 mb-4">Based on your resume — select all that apply, or add your own.</p>

        {loading ? (
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <span className="font-lora text-sm text-ink/60">Reading your resume...</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {suggestedRoles.map(r => (
              <button
                key={r.title}
                onClick={() => toggleRole(r.title)}
                title={r.reason}
                className={`px-3 py-1.5 text-sm font-lora border rounded-sm transition-colors ${
                  selectedRoles.includes(r.title)
                    ? 'border-teal bg-teal/5 text-teal'
                    : 'border-[#e5e5e0] text-ink/70 hover:border-teal/30'
                }`}
              >
                {r.title}
              </button>
            ))}
          </div>
        )}

        {selectedRoles.filter(r => !suggestedRoles.find(s => s.title === r)).map(r => (
          <div key={r} className="inline-flex items-center gap-1 mt-2 mr-2 px-3 py-1.5 text-sm font-lora border border-teal bg-teal/5 text-teal rounded-sm">
            {r}
            <button onClick={() => toggleRole(r)} className="ml-1 opacity-60 hover:opacity-100">&times;</button>
          </div>
        ))}

        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={customRole}
            onChange={e => setCustomRole(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomRole()}
            placeholder="Add another role..."
            className="flex-1 px-3 py-2 bg-white border border-[#e5e5e0] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <button onClick={addCustomRole} className="p-2 border border-[#e5e5e0] rounded-sm hover:border-teal text-ink/50 hover:text-teal transition-colors">
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Regions */}
      <div>
        <p className="font-montserrat font-semibold text-sm text-ink/80 mb-1 tracking-wide">Search regions</p>
        <p className="font-lora text-xs text-ink/50 mb-4">Select all you're open to. Results from each are merged and labeled.</p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_REGIONS.map(region => (
            <button
              key={region}
              onClick={() => toggleRegion(region)}
              className={`px-3 py-1.5 text-sm font-lora border rounded-sm transition-colors ${
                selectedRegions.includes(region)
                  ? 'border-teal bg-teal/5 text-teal'
                  : 'border-[#e5e5e0] text-ink/70 hover:border-teal/30'
              }`}
            >
              {region}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={customRegion}
            onChange={e => setCustomRegion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomRegion()}
            placeholder="Add another region..."
            className="flex-1 px-3 py-2 bg-white border border-[#e5e5e0] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <button onClick={addCustomRegion} className="p-2 border border-[#e5e5e0] rounded-sm hover:border-teal text-ink/50 hover:text-teal transition-colors">
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Work arrangement */}
      <div>
        <p className="font-montserrat font-semibold text-sm text-ink/80 mb-3 tracking-wide">Work arrangement</p>
        <div className="flex flex-wrap gap-2">
          {REMOTE_PREFS.map(r => (
            <button
              key={r.value}
              onClick={() => setRemote(r.value)}
              className={`px-4 py-2 text-sm font-lora border rounded-sm transition-colors ${remotePref === r.value ? 'border-teal bg-teal/5 text-teal' : 'border-[#e5e5e0] text-ink/70 hover:border-teal/30'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-montserrat font-semibold text-sm text-ink/80 mb-1.5 tracking-wide">Seniority target</label>
          <input
            type="text"
            placeholder="e.g. Senior, Lead, Manager"
            value={seniority}
            onChange={e => setSeniority(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-[#e5e5e0] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
        <div>
          <label className="block font-montserrat font-semibold text-sm text-ink/80 mb-1.5 tracking-wide">Minimum salary (annual)</label>
          <input
            type="number"
            placeholder="e.g. 120000"
            value={compFloor}
            onChange={e => setComp(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-[#e5e5e0] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
      </div>

      <div>
        <label className="block font-montserrat font-semibold text-sm text-ink/80 mb-1 tracking-wide">Larger build note</label>
        <p className="font-lora text-xs text-ink/50 mb-2">Work a role must serve, not strangle. Optional.</p>
        <textarea
          className="w-full px-3 py-2.5 bg-white border border-[#e5e5e0] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal resize-y min-h-[72px]"
          placeholder="e.g. Building toward a COO role. Needs to develop P&L ownership without sacrificing comp or title arc."
          value={largerBuild}
          onChange={e => setLarger(e.target.value)}
        />
      </div>

      {error && <p className="font-lora text-sm text-red-600">{error}</p>}

      <Button onClick={handleFinish} loading={saving}>
        Finish setup
      </Button>
    </div>
  );
}
