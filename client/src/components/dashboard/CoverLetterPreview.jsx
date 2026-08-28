/**
 * Renders the AI's cover letter body (intentionally date/address/signature-
 * free) as a complete, formatted letter on screen — matching what prints.
 */
import { parseResumeHeader } from '../../utils/resumeText';

export default function CoverLetterPreview({ text, company = '', resumeText = '' }) {
  if (!text) return null;

  const { name, contact } = parseResumeHeader(resumeText);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const salutation = company ? `Dear ${company} Hiring Team,` : 'Dear Hiring Team,';
  const paragraphs = text.split(/\n\n+/).filter(Boolean);

  return (
    <div className="bg-white rounded-sm border border-[#e3ddd2] shadow-sm p-8 text-left">
      {(name || contact) && (
        <div className="pb-3 mb-5">
          {name && <p className="font-montserrat font-extrabold text-lg text-ink">{name}</p>}
          {contact && <p className="font-montserrat text-[10px] font-medium text-ink/50 tracking-wide mt-0.5">{contact}</p>}
          <div className="h-[2.5px] mt-2.5 rounded-full" style={{ background: '#333333' }} />
        </div>
      )}

      <p className="font-lora text-xs text-ink/50 mb-5">{today}</p>
      <p className="font-lora text-sm text-ink font-medium mb-4">{salutation}</p>

      <div className="flex flex-col gap-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="font-lora text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{p}</p>
        ))}
      </div>

      <p className="font-lora text-sm text-ink/80 mt-6 mb-1">Sincerely,</p>
      {name && <p className="font-montserrat font-bold text-sm text-ink">{name}</p>}
    </div>
  );
}
