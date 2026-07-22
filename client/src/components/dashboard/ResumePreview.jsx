/**
 * Renders a plain-text Claude resume as a polished, on-screen preview that
 * matches the printed output — one premium visual template regardless of
 * the style selected in Profile (style shapes wording/emphasis, not looks).
 */
import { classifyLine } from '../../utils/resumeText';

export default function ResumePreview({ text }) {
  if (!text) return null;

  const lines  = text.split('\n');
  const parsed = lines.map(classifyLine);

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

  if (nameIdx >= 0) {
    elements.push(
      <div key="header" className="pb-3 mb-4">
        <p className="font-montserrat font-extrabold text-3xl text-teal-deeper leading-tight tracking-tight">
          {parsed[nameIdx].text}
        </p>
        <div className="h-[2.5px] mt-2 mb-2 rounded-full" style={{ background: 'linear-gradient(to right, #c87b33, #edcf30, transparent 85%)' }} />
        {contactIdx >= 0 && (
          <p className="font-montserrat text-[10px] font-medium text-ink/50 tracking-wide">{parsed[contactIdx].text}</p>
        )}
      </div>
    );
  }

  let bullets = [];
  let key = 0;

  function flushBullets() {
    if (!bullets.length) return;
    elements.push(
      <ul key={`ul-${key++}`} className="ml-4 mb-2 flex flex-col gap-1">
        {bullets.map((b, i) => (
          <li key={i} className="font-lora text-xs text-ink/80 leading-relaxed marker:text-copper" style={{ listStyleType: 'disc' }}>{b}</li>
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
          <div key={`h-${key++}`} className="mt-4 mb-2">
            <span className="font-montserrat font-bold text-[9px] uppercase tracking-[2.5px] text-teal pb-1 border-b-[1.5px] border-teal inline-block">
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
          <div key={`jr-${key++}`} className="flex items-baseline justify-between flex-wrap gap-x-3 mt-2.5 mb-1">
            <span className="font-montserrat font-bold text-xs text-ink">{title}</span>
            <span className="font-montserrat text-[9px] font-medium text-copper">{meta}</span>
          </div>
        );
        break;
      }

      case 'bullet':
        bullets.push(p.text);
        break;

      case 'body':
        elements.push(
          <p key={`p-${key++}`} className="font-lora text-xs text-ink/80 leading-relaxed mb-1">
            {p.text}
          </p>
        );
        break;
    }
  }
  flushBullets();

  return (
    <div className="bg-white rounded-sm border border-[#e5e5e0] shadow-sm p-8 text-left">
      {elements}
    </div>
  );
}
