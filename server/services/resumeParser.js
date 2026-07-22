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
  let data;
  try {
    // Guard against a parse that hangs or throws deep in pdf.js
    data = await Promise.race([
      pdf(buffer),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PDF_TIMEOUT')), 20000),
      ),
    ]);
  } catch (err) {
    if (err.message === 'PDF_TIMEOUT') {
      return { text: '', warning: 'That PDF took too long to read. Please try the "Paste text" option instead.' };
    }
    return { text: '', warning: 'We could not read that PDF. It may be secured or unusual. Please try the "Paste text" option instead.' };
  }

  const text = (data.text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text || text.length < 50) {
    return { text: '', warning: 'This PDF appears to contain no extractable text. If it is a scanned image, please copy and paste your resume text instead.' };
  }
  return { text, pages: data.numpages };
}

async function parseDOCX(buffer) {
  let result;
  try {
    result = await mammoth.extractRawText({ buffer });
  } catch {
    return { text: '', warning: 'We could not read that Word document. Please try the "Paste text" option instead.' };
  }
  const text = (result.value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text || text.length < 50) {
    return { text: '', warning: 'This document appears to be empty or unreadable. Please copy and paste your resume text instead.' };
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
