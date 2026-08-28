/**
 * Renders Claude's plain-text resume and cover letter output as a styled,
 * print-ready document.
 *
 * These are the candidate's documents, so they default to classic
 * professional black-and-grey rather than any app branding. The resume style
 * chosen in Profile selects the palette; classic is the default and the
 * safest choice for applicant tracking systems.
 */

import { classifyLine, parseResumeHeader } from './resumeText';

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400&display=swap';

/**
 * Document palettes.
 *
 * These are the CANDIDATE's documents, not ours, so the default is classic
 * professional black and grey — the safest, most widely accepted look for a
 * resume and the friendliest to applicant tracking systems. App branding
 * belongs in the app, never on someone's job application.
 *
 * A user can opt into an accent via the resume style setting in Profile.
 */
const PALETTES = {
  classic:   { name: '#111111', heading: '#111111', rule: '#333333', meta: '#555555', body: '#1a1a1a', accentRule: false },
  'ats-safe':{ name: '#000000', heading: '#000000', rule: '#000000', meta: '#444444', body: '#000000', accentRule: false },
  executive: { name: '#111111', heading: '#1f2d3d', rule: '#1f2d3d', meta: '#4a5568', body: '#1a1a1a', accentRule: false },
  modern:    { name: '#0f2942', heading: '#1a4971', rule: '#1a4971', meta: '#4a5568', body: '#1a1a1a', accentRule: true },
  editorial: { name: '#1a1a1a', heading: '#6b4423', rule: '#6b4423', meta: '#5a5a55', body: '#1a1a1a', accentRule: true },
};

function paletteFor(style) {
  return PALETTES[style] || PALETTES.classic;
}

function buildResumeHTML(text) {
  const rawLines = text.split('\n');
  const parsed = rawLines.map(classifyLine);

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

  let html = '';

  if (nameIdx >= 0) {
    html += `<div class="resume-header">`;
    html += `<div class="resume-name">${parsed[nameIdx].text}</div>`;
    html += `<div class="header-rule"></div>`;
    if (contactIdx >= 0) {
      html += `<div class="resume-contact">${parsed[contactIdx].text}</div>`;
    }
    html += `</div>`;
  }

  let inList = false;
  let sectionOpen = false;

  for (let i = 0; i < parsed.length; i++) {
    if (i === nameIdx || i === contactIdx) continue;
    const p = parsed[i];

    if (p.type !== 'bullet' && inList) { html += '</ul>'; inList = false; }

    switch (p.type) {
      case 'blank':
        break;
      case 'heading':
        if (sectionOpen) html += '</div>';
        html += `<div class="section"><div class="section-heading"><span>${p.text}</span></div>`;
        sectionOpen = true;
        break;
      case 'jobrow': {
        const parts = p.text.split('|').map(s => s.trim());
        const title = parts[0] || '';
        const rest  = parts.slice(1).join('  ·  ');
        html += `<div class="job-row"><span class="job-title">${title}</span><span class="job-meta">${rest}</span></div>`;
        break;
      }
      case 'bullet':
        if (!inList) { html += '<ul class="bullet-list">'; inList = true; }
        html += `<li>${p.text}</li>`;
        break;
      case 'body':
        html += `<p>${p.text}</p>`;
        break;
    }
  }
  if (inList) html += '</ul>';
  if (sectionOpen) html += '</div>';

  return html;
}

const RESUME_CSS = (P) => `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'Lora', Georgia, serif;
    color: ${P.body};
    font-size: 10.25pt;
    line-height: 1.42;
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .page { max-width: 740px; margin: 0 auto; padding: 46px 54px; }
  .resume-header { margin-bottom: 18px; }
  .resume-name {
    font-family: 'Montserrat', sans-serif;
    font-size: 25pt;
    font-weight: 800;
    color: ${P.name};
    letter-spacing: -0.4px;
    line-height: 1.1;
  }
  .header-rule {
    height: 2px;
    margin: 9px 0 8px;
    background: ${P.accentRule ? `linear-gradient(to right, ${P.rule}, ${P.rule} 55%, transparent 95%)` : P.rule};
  }
  .resume-contact {
    font-family: 'Montserrat', sans-serif;
    font-size: 8.5pt;
    font-weight: 500;
    color: ${P.meta};
    letter-spacing: 0.3px;
  }
  .section { break-inside: avoid-page; margin-bottom: 2px; }
  .section-heading {
    margin-top: 15px;
    margin-bottom: 8px;
  }
  .section-heading span {
    font-family: 'Montserrat', sans-serif;
    font-size: 8pt;
    font-weight: 700;
    color: ${P.heading};
    text-transform: uppercase;
    letter-spacing: 2.2px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid ${P.rule};
    display: inline-block;
  }
  .job-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 9px;
    margin-bottom: 3px;
    break-inside: avoid;
    break-after: avoid;
  }
  .job-title {
    font-family: 'Montserrat', sans-serif;
    font-size: 10pt;
    font-weight: 700;
    color: ${P.body};
  }
  .job-meta {
    font-family: 'Montserrat', sans-serif;
    font-size: 8.25pt;
    font-weight: 500;
    color: ${P.meta};
    text-align: right;
  }
  .bullet-list { margin-left: 16px; margin-top: 2px; margin-bottom: 5px; }
  .bullet-list li {
    margin-bottom: 2.5px;
    padding-left: 3px;
    break-inside: avoid;
  }
  .bullet-list li::marker { color: ${P.rule}; }
  p { margin-bottom: 4px; }
  @media print {
    html, body { background: white; }
    .page { padding: 0; max-width: 100%; }
    @page { margin: 0.6in 0.7in; size: letter; }
  }
`;

function openPrintWindow(title, bodyHTML, css) {
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONT_LINK}" rel="stylesheet" />
  <style>${css}</style>
</head>
<body>
  <div class="page">${bodyHTML}</div>
  <script>
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function() { window.print(); });
    } else {
      window.onload = function() { window.print(); };
    }
  <\/script>
</body>
</html>`);
  win.document.close();
}

export function printResume(text, jobTitle = '', company = '', style = 'classic') {
  const body = buildResumeHTML(text);
  const docTitle = [jobTitle, company].filter(Boolean).join(' — ') || 'Resume';
  openPrintWindow(docTitle, body, RESUME_CSS(paletteFor(style)));
}

/**
 * Wraps the AI's cover letter body (which intentionally excludes date,
 * address, and signature) with a letterhead, date, salutation, and
 * signoff — so what prints is a complete, ready-to-send letter rather
 * than a bare paragraph of text.
 */
export function printCoverLetter(text, jobTitle = '', company = '', resumeText = '', style = 'classic') {
  const P = paletteFor(style);
  const { name, contact } = parseResumeHeader(resumeText);
  const docTitle = [jobTitle, company].filter(Boolean).join(' — ') || 'Cover Letter';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const salutation = company ? `Dear ${company} Hiring Team,` : 'Dear Hiring Team,';

  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const bodyHTML = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: 'Lora', Georgia, serif;
      color: ${P.body};
      font-size: 11pt;
      line-height: 1.65;
      background: #fff;
      -webkit-font-smoothing: antialiased;
    }
    .page { max-width: 680px; margin: 0 auto; padding: 56px 60px; }
    .letter-header { margin-bottom: 30px; }
    .letter-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 16pt;
      font-weight: 800;
      color: ${P.name};
      letter-spacing: -0.2px;
    }
    .letter-contact {
      font-family: 'Montserrat', sans-serif;
      font-size: 8.5pt;
      font-weight: 500;
      color: ${P.meta};
      letter-spacing: 0.3px;
      margin-top: 3px;
    }
    .header-rule {
      height: 2px;
      margin: 12px 0 0;
      background: ${P.accentRule ? `linear-gradient(to right, ${P.rule}, ${P.rule} 55%, transparent 95%)` : P.rule};
    }
    .letter-date { font-size: 10pt; color: #6a6a65; margin-bottom: 22px; }
    .salutation { margin-bottom: 16px; font-weight: 500; }
    p { margin-bottom: 16px; }
    .signoff { margin-top: 8px; }
    .signoff .name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      color: ${P.name};
      margin-top: 26px;
    }
    @media print {
      .page { padding: 0; max-width: 100%; }
      @page { margin: 0.85in 1in; size: letter; }
    }
  `;

  const html = `
    <div class="letter-header">
      ${name ? `<div class="letter-name">${name}</div>` : ''}
      ${contact ? `<div class="letter-contact">${contact}</div>` : ''}
      <div class="header-rule"></div>
    </div>
    <div class="letter-date">${today}</div>
    <div class="salutation">${salutation}</div>
    ${bodyHTML}
    <div class="signoff">
      <p style="margin-bottom:2px;">Sincerely,</p>
      ${name ? `<p class="name">${name}</p>` : ''}
    </div>
  `;

  openPrintWindow(docTitle, html, css);
}
