/**
 * Shared plain-text resume parsing helpers, used by the in-app preview,
 * the print/PDF renderer, and the cover letter letterhead (name extraction).
 */

export const SECTION_RE = /^(PROFESSIONAL SUMMARY|SUMMARY|EXPERIENCE|WORK HISTORY|PROFESSIONAL EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|PROJECTS|AWARDS|PUBLICATIONS|VOLUNTEERING|LANGUAGES|OBJECTIVE)$/i;

export function isBullet(line) {
  return /^[\s]*[•\-\*]/.test(line);
}

export function isJobRow(line) {
  return (line.match(/\|/g) || []).length >= 2;
}

export function classifyLine(line) {
  const t = line.trim();
  if (!t) return { type: 'blank', text: '' };
  if (SECTION_RE.test(t)) return { type: 'heading', text: t };
  if (isJobRow(t)) return { type: 'jobrow', text: t };
  if (isBullet(t)) return { type: 'bullet', text: t.replace(/^[\s•\-\*]+/, '') };
  return { type: 'body', text: t };
}

// Extracts { name, contact } from the top of a resume's plain text.
export function parseResumeHeader(text) {
  if (!text) return { name: '', contact: '' };
  const lines = text.split('\n').map(classifyLine);
  let name = '', contact = '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type === 'body') {
      if (!name) { name = lines[i].text; continue; }
      const t = lines[i].text;
      if (t.includes('@') || t.includes('|') || /\d{3}/.test(t)) contact = t;
      break;
    }
    if (lines[i].type !== 'blank') break;
  }
  return { name, contact };
}

// Rough page-count estimate for a soft "will this fit two pages" nudge.
// Tuned for ~10.25pt body text on US Letter with tight print margins.
export function estimateResumePages(text) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 620));
}
