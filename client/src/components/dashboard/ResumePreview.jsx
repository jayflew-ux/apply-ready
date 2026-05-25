/**
 * Renders a plain-text Claude resume as styled HTML inline in the app.
 * Mirrors the logic in resumePrint.js but outputs React elements.
 */

const SECTION_RE = /^(PROFESSIONAL SUMMARY|SUMMARY|EXPERIENCE|WORK HISTORY|PROFESSIONAL EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|PROJECTS|AWARDS|PUBLICATIONS|VOLUNTEERING|LANGUAGES|OBJECTIVE)$/i;

function isBullet(line) { return /^[\s]*[•\-\*]/.test(line); }
function isJobRow(line) { return (line.match(/\|/g) || []).length >= 2; }

function classifyLine(line) {
  const t = line.trim();
  if (!t) return { type: 'blank', text: '' };
  if (SECTION_RE.test(t)) return { type: 'heading', text: t };
  if (isJobRow(t)) return { type: 'jobrow', text: t };
  if (isBullet(t)) return { type: 'bullet', text: t.replace(/^[\s•\-\*]+/, '') };
  return { type: 'body', text: t };
}

export default function ResumePreview({ text }) {
  if (!text) return null;

  const lines  = text.split('\n');
  const parsed = lines.map(classifyLine);

  // Find name + contact
  let nameIdx = -1, contactIdx = -1;
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].type === 'body') {
      if (nameIdx === -1) { nameIdx = i; continue; }
      const t = parsed[i].text;
      if (t.includes('@') || t.includes('|') || /\d{3}/.test(t)) contactIdx = i;
      break;
    }
    if (parsed[i].type !== 'blank') break;
  }

  const elements = [];

  // Header
  if (nameIdx >= 0) {
    elements.push(
      <div key="header" className="pb-4 mb-5 border-b-2 border-teal">
        <p className="font-montserrat font-bold text-2xl text-teal-deeper leading-tight">
          {parsed[nameIdx].text}
        </p>
        {contactIdx >= 0 && (
          <p className="font-lora text-xs text-ink/50 mt-1">{parsed[contactIdx].text}</p>
        )}
      </div>
    );
  }

  // Body
  let bullets = [];
  let key = 0;

  function flushBullets() {
    if (!bullets.length) return;
    elements.push(
      <ul key={`ul-${key++}`} className="ml-4 mb-3 flex flex-col gap-1">
        {bullets.map((b, i) => (
          <li key={i} className="font-lora text-xs text-ink/80 leading-relaxed list-disc">{b}</li>
        ))}
      </ul>
    );
    bullets = [];
  }

  for (let i = 0; i < parsed.length; i++) {
    if (i === nameIdx || i === contactIdx) continue;
    const p = parsed[i];

    if (p.type !== 'bullet') flushBullets();

    switch (p.type) {
      case 'blank':
        break;

      case 'heading':
        elements.push(
          <div key={`h-${key++}`} className="mt-5 mb-2.5 pb-1 border-b border-teal/40">
            <span className="font-montserrat font-bold text-[10px] uppercase tracking-[2px] text-teal">
              {p.text}
            </span>
          </div>
        );
        break;

      case 'jobrow': {
        const parts = p.text.split('|').map(s => s.trim());
        const title = parts[0] || '';
        const meta  = parts.slice(1).join(' · ');
        elements.push(
          <div key={`jr-${key++}`} className="flex items-baseline justify-between flex-wrap gap-x-3 mt-3 mb-1">
            <span className="font-montserrat font-bold text-xs text-ink">{title}</span>
            <span className="font-lora text-[10px] text-ink/50">{meta}</span>
          </div>
        );
        break;
      }

      case 'bullet':
        bullets.push(p.text);
        break;

      case 'body':
        elements.push(
          <p key={`p-${key++}`} className="font-lora text-xs text-ink/80 leading-relaxed mb-1.5">
            {p.text}
          </p>
        );
        break;
    }
  }
  flushBullets();

  return (
    <div className="bg-white rounded-sm border border-[#e5e5e0] p-6 text-left">
      {elements}
    </div>
  );
}
