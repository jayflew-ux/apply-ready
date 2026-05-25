/**
 * Parses Claude's plain-text resume output and opens a styled print window.
 * Handles: name, contact line, ALL-CAPS section headers,
 * "Title | Company | Location | Date" job rows, bullets, and body text.
 */

const SECTION_RE = /^(PROFESSIONAL SUMMARY|SUMMARY|EXPERIENCE|WORK HISTORY|PROFESSIONAL EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|PROJECTS|AWARDS|PUBLICATIONS|VOLUNTEERING|LANGUAGES|OBJECTIVE)$/i;

function isBullet(line) {
  return /^[\s]*[•\-\*]/.test(line);
}

function isJobRow(line) {
  return (line.match(/\|/g) || []).length >= 2;
}

function parseLine(line) {
  const t = line.trim();
  if (!t) return { type: 'blank' };
  if (SECTION_RE.test(t)) return { type: 'heading', text: t };
  if (isJobRow(t)) return { type: 'jobrow', text: t };
  if (isBullet(t)) return { type: 'bullet', text: t.replace(/^[\s•\-\*]+/, '') };
  return { type: 'body', text: t };
}

function buildHTML(text) {
  const rawLines = text.split('\n');
  const parsed = rawLines.map(parseLine);

  // First non-blank line = name, second = contact (if it has @ or | or digits)
  let nameIdx = -1;
  let contactIdx = -1;
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].type === 'body') {
      if (nameIdx === -1) { nameIdx = i; continue; }
      if (contactIdx === -1) {
        const t = parsed[i].text;
        if (t.includes('@') || t.includes('|') || /\d{3}/.test(t)) {
          contactIdx = i;
        }
        break;
      }
    }
    if (parsed[i].type !== 'blank') break;
  }

  let html = '';

  // Header block
  if (nameIdx >= 0) {
    html += `<div class="resume-header">`;
    html += `<div class="resume-name">${parsed[nameIdx].text}</div>`;
    if (contactIdx >= 0) {
      html += `<div class="resume-contact">${parsed[contactIdx].text}</div>`;
    }
    html += `</div>`;
  }

  // Body — collect bullets into lists
  let inList = false;

  for (let i = 0; i < parsed.length; i++) {
    if (i === nameIdx || i === contactIdx) continue;

    const p = parsed[i];

    if (p.type !== 'bullet' && inList) {
      html += '</ul>';
      inList = false;
    }

    switch (p.type) {
      case 'blank':
        break;
      case 'heading':
        html += `<div class="section-heading">${p.text}</div>`;
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

  return html;
}

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1a1a;
    font-size: 10.5pt;
    line-height: 1.55;
    background: #fff;
  }
  .page {
    max-width: 760px;
    margin: 0 auto;
    padding: 52px 60px;
  }
  .resume-header {
    margin-bottom: 22px;
    padding-bottom: 14px;
    border-bottom: 2px solid #1e8b8b;
  }
  .resume-name {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 22pt;
    font-weight: 700;
    color: #0d3535;
    letter-spacing: -0.3px;
    line-height: 1.15;
    margin-bottom: 5px;
  }
  .resume-contact {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #555;
    letter-spacing: 0.2px;
  }
  .section-heading {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    font-weight: 700;
    color: #1e8b8b;
    text-transform: uppercase;
    letter-spacing: 2px;
    border-bottom: 1px solid #1e8b8b;
    padding-bottom: 4px;
    margin-top: 22px;
    margin-bottom: 10px;
  }
  .job-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
    margin-bottom: 4px;
  }
  .job-title {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    font-weight: 700;
    color: #1a1a1a;
  }
  .job-meta {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #666;
    text-align: right;
  }
  .bullet-list {
    margin-left: 18px;
    margin-top: 3px;
    margin-bottom: 6px;
  }
  .bullet-list li {
    margin-bottom: 3px;
    padding-left: 2px;
  }
  p {
    margin-bottom: 5px;
  }
  @media print {
    html, body { background: white; }
    .page { padding: 0; max-width: 100%; }
    @page { margin: 0.75in 0.85in; size: letter; }
  }
`;

export function printResume(text, jobTitle = '', company = '') {
  const body   = buildHTML(text);
  const docTitle = [jobTitle, company].filter(Boolean).join(' — ') || 'Resume';

  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="page">${body}</div>
  <script>
    window.onload = function() { window.print(); };
  <\/script>
</body>
</html>`);
  win.document.close();
}

export function printCoverLetter(text, jobTitle = '', company = '') {
  const docTitle = [jobTitle, company].filter(Boolean).join(' — ') || 'Cover Letter';
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const bodyHTML = paragraphs.map(p =>
    `<p>${p.replace(/\n/g, '<br/>')}</p>`
  ).join('');

  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: Georgia, 'Times New Roman', serif;
      color: #1a1a1a;
      font-size: 11pt;
      line-height: 1.7;
      background: #fff;
    }
    .page {
      max-width: 680px;
      margin: 0 auto;
      padding: 60px 60px;
    }
    p { margin-bottom: 18px; }
    @media print {
      .page { padding: 0; max-width: 100%; }
      @page { margin: 1in 1in; size: letter; }
    }
  </style>
</head>
<body>
  <div class="page">${bodyHTML}</div>
  <script>
    window.onload = function() { window.print(); };
  <\/script>
</body>
</html>`);
  win.document.close();
}
