const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  UnderlineType,
  convertInchesToTwip,
} = require('docx');

const TEAL = '1e8b8b';
const COPPER = 'c87b33';
const INK = '2c2c2c';

function sectionHeading(text, style) {
  const isAts = style === 'ats-safe';
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 60 },
    border: isAts ? {} : {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL, space: 4 },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        color: isAts ? INK : TEAL,
        size: isAts ? 24 : 26,
        font: isAts ? 'Calibri' : 'Montserrat',
        allCaps: true,
      }),
    ],
  });
}

function bodyParagraph(text, style) {
  const isAts = style === 'ats-safe';
  const lines = text.split('\n').filter(Boolean);
  return lines.map(line => {
    const isBullet = line.trimStart().startsWith('•') || line.trimStart().startsWith('-');
    const cleanLine = isBullet ? line.replace(/^[\s•\-]+/, '') : line;
    return new Paragraph({
      text: cleanLine,
      bullet: isBullet ? { level: 0 } : undefined,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: cleanLine,
          size: isAts ? 22 : 22,
          font: isAts ? 'Calibri' : 'Lora',
          color: INK,
        }),
      ],
    });
  });
}

function buildDocument(text, style, type = 'resume') {
  const isAts = style === 'ats-safe';
  const sections = parseSections(text);

  const docChildren = [];

  if (type === 'cover-letter') {
    const paragraphs = text.split('\n\n').filter(Boolean);
    paragraphs.forEach(para => {
      docChildren.push(
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: para.replace(/\n/g, ' '),
              size: 22,
              font: isAts ? 'Calibri' : 'Lora',
              color: INK,
            }),
          ],
        }),
      );
    });
  } else {
    sections.forEach(({ heading, body }) => {
      if (heading) docChildren.push(sectionHeading(heading, style));
      bodyParagraph(body, style).forEach(p => docChildren.push(p));
    });
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: isAts ? 'Calibri' : 'Lora', size: 22, color: INK },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.1),
              right: convertInchesToTwip(1.1),
            },
          },
        },
        children: docChildren,
      },
    ],
  });
}

function parseSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = { heading: null, body: '' };

  const HEADING_RE = /^(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|AWARDS|PROJECTS|PUBLICATIONS|WORK HISTORY|PROFESSIONAL EXPERIENCE|OBJECTIVE)/i;

  lines.forEach(line => {
    if (HEADING_RE.test(line.trim()) && line.trim().length < 60) {
      if (current.body.trim() || current.heading) {
        sections.push({ ...current });
      }
      current = { heading: line.trim(), body: '' };
    } else {
      current.body += line + '\n';
    }
  });

  if (current.body.trim() || current.heading) {
    sections.push(current);
  }

  return sections;
}

async function generateResume(text, style = 'classic') {
  const doc = buildDocument(text, style, 'resume');
  return Packer.toBuffer(doc);
}

async function generateCoverLetter(text, style = 'classic') {
  const doc = buildDocument(text, style, 'cover-letter');
  return Packer.toBuffer(doc);
}

module.exports = { generateResume, generateCoverLetter };
