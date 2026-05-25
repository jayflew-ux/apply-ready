const pdf = require('pdf-parse');
const mammoth = require('mammoth');

async function parseBuffer(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    return parsePDF(buffer);
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return parseDOCX(buffer);
  }
  if (mimetype.startsWith('image/')) {
    // Return a placeholder — image OCR would require a vision model call
    return { text: '', warning: 'Image resumes are not supported for text extraction. Please paste your resume text instead.' };
  }
  throw new Error(`Unsupported file type: ${mimetype}`);
}

async function parsePDF(buffer) {
  const data = await pdf(buffer);
  const text = data.text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text || text.length < 50) {
    throw new Error('PDF appears to contain no extractable text. If it is a scanned image, please copy and paste your resume text instead.');
  }
  return { text, pages: data.numpages };
}

async function parseDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text || text.length < 50) {
    throw new Error('Document appears to be empty or unreadable. Please copy and paste your resume text instead.');
  }
  return { text };
}

function parseText(rawText) {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text || text.length < 50) {
    throw new Error('Resume text is too short to evaluate. Please paste your full resume.');
  }
  return { text };
}

module.exports = { parseBuffer, parseText };
