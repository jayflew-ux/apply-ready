import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';

// Rough cost estimate for display. Fable 5 is used for resumes/letters,
// Opus for scoring, Haiku for chat — we don't track per-model split here,
// so this is a blended ballpark from total tokens, not an invoice.
function estimateCost(inputTokens, outputTokens) {
  const inCost  = (inputTokens / 1_000_000) * 6;   // blended input $/M
  const outCost = (outputTokens / 1_000_000) * 30; // blended output $/M
  return inCost + outCost;
}

function fmt(n) {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-[#e5e5e0] rounded-sm p-4">
      <p className="font-montserrat text-[10px] uppercase tracking-widest text-copper mb-1">{label}</p>
      <p className="font-montserrat font-bold text-2xl text-teal-deeper">{value}</p>
      {sub && <p className="font-lora text-xs text-ink/50 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Admin() {
  const { signOut } = useAuth();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);

  async function runSweep() {
    setSweeping(true);
    setSweepResult(null);
    try {
      const r = await api.admin.sweepListings();
      setSweepResult(r);
    } catch (e) {
      setSweepResult({ error: e.message });
    } finally {
      setSweeping(false);
    }
  }

  useEffect(() => {
    api.admin.users()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-linen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-linen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-montserrat font-bold text-lg text-teal-deeper">Access denied</p>
      <p className="font-lora text-sm text-ink/60">{error}</p>
      <Link to="/dashboard" className="font-lora text-sm text-teal underline">Back to dashboard</Link>
    </div>
  );

  const { users, totals } = data;

  return (
    <div className="min-h-screen bg-linen">
      <header className="sticky top-0 z-10 bg-linen/95 backdrop-blur-sm border-b border-[#e5e5e0]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="font-montserrat font-bold text-teal text-xs tracking-widest uppercase">Dream Job Ready</Link>
            <span className="font-montserrat text-xs text-ink/40 uppercase tracking-widest">/ Admin</span>
          </div>
          <button onClick={signOut} className="font-lora text-sm text-ink/40 hover:text-ink transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total users" value={totals.users} />
          <StatCard label="Resumes built" value={totals.resumes} />
          <StatCard label="Total tokens" value={fmt(totals.input_tokens + totals.output_tokens)} sub={`${fmt(totals.input_tokens)} in / ${fmt(totals.output_tokens)} out`} />
          <StatCard label="Est. AI cost" value={'$' + estimateCost(totals.input_tokens, totals.output_tokens).toFixed(2)} sub={`${totals.ai_calls} calls`} />
        </div>

        {/* Listing maintenance */}
        <div className="bg-white border border-[#e5e5e0] rounded-sm p-4 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-montserrat font-semibold text-sm text-ink/80">Clean up saved job listings</p>
              <p className="font-lora text-xs text-ink/50 mt-0.5 max-w-xl leading-relaxed">
                Checks every listing saved in every account and removes any that are closed, filled, or dead.
                Costs no AI spend. Listings are also rechecked automatically whenever a user opens Discover.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={runSweep} loading={sweeping}>
              Run sweep
            </Button>
          </div>

          {sweepResult && (
            <div className="mt-3 pt-3 border-t border-[#e5e5e0]">
              {sweepResult.error ? (
                <p className="font-lora text-sm text-red-600">{sweepResult.error}</p>
              ) : (
                <>
                  <p className="font-lora text-sm text-ink/80">
                    Scanned {sweepResult.accounts_scanned} account{sweepResult.accounts_scanned === 1 ? '' : 's'} and{' '}
                    {sweepResult.listings_checked} listing{sweepResult.listings_checked === 1 ? '' : 's'}.{' '}
                    {sweepResult.listings_removed > 0
                      ? `Removed ${sweepResult.listings_removed} stale listing${sweepResult.listings_removed === 1 ? '' : 's'} across ${sweepResult.accounts_updated} account${sweepResult.accounts_updated === 1 ? '' : 's'}.`
                      : 'Everything still checks out; nothing removed.'}
                  </p>
                  {sweepResult.details?.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {sweepResult.details.map((d, i) => (
                        <li key={i} className="font-lora text-xs text-ink/50">
                          {d.email}: {d.before} → {d.after} ({d.removed} removed)
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* User table */}
        <div className="bg-white border border-[#e5e5e0] rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#e5e5e0] bg-[#faf8f0]">
                  {['Name', 'Email', 'Plan', 'Resumes', 'Tokens (in/out)', 'AI calls', 'Est. cost', 'Joined'].map(h => (
                    <th key={h} className="px-4 py-3 font-montserrat text-[10px] uppercase tracking-widest text-ink/50 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-[#f0efe8] hover:bg-[#faf8f0]/50">
                    <td className="px-4 py-3 font-montserrat text-sm text-ink whitespace-nowrap">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 font-lora text-sm text-ink/70 whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`font-montserrat text-xs font-bold ${u.subscription_status === 'active' ? 'text-teal' : 'text-ink/40'}`}>
                        {u.subscription_status === 'active' ? 'PRO' : u.subscription_status === 'past_due' ? 'PAST DUE' : 'Free'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-montserrat text-sm text-teal font-semibold">{u.resume_builds_used || 0}</td>
                    <td className="px-4 py-3 font-lora text-xs text-ink/60 whitespace-nowrap">{fmt(u.input_tokens_used)} / {fmt(u.output_tokens_used)}</td>
                    <td className="px-4 py-3 font-lora text-sm text-ink/60">{u.ai_calls || 0}</td>
                    <td className="px-4 py-3 font-lora text-sm text-ink/60">${estimateCost(u.input_tokens_used || 0, u.output_tokens_used || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 font-lora text-xs text-ink/40 whitespace-nowrap">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center font-lora text-sm text-ink/40">No users yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="font-lora text-xs text-ink/30 mt-3">Cost estimates are a blended ballpark from total tokens, not a billed amount. Check console.anthropic.com for exact spend.</p>
      </main>
    </div>
  );
}
