import assert from 'node:assert/strict';
import test from 'node:test';

import { getImportDocumentLabel, getImportDocumentType, getImportFileName, getImportMimeType, studyPackFileType } from '../src/services/documentTypes.ts';
import { getImportFormat } from '../supabase/functions/_shared/importFormats.ts';
import { providerSource, readPlainDocument } from '../supabase/functions/studybolt-process-document/importContent.ts';

test('study guides use the existing Study Pack types regardless of common file format', () => {
  const guides = {
    'Final study guide.pdf': 'pdf',
    'Final study guide #2.DOCX': 'notes',
    'Final review.pages': 'notes',
    'Worksheet.odt': 'notes',
    'Vocabulary.xlsx': 'notes',
    'Review handout.html': 'notes',
    'Practice questions.md': 'notes',
    'Whiteboard.png': 'notes',
    'Review slides.pptx': 'pptx',
  };
  for (const [name, expected] of Object.entries(guides)) {
    const type = getImportDocumentType(name, 'application/octet-stream');
    assert.equal(studyPackFileType(type), expected, name);
  }
  assert.equal(getImportDocumentLabel('Handout.jpg'), 'image');
});

test('native extensionless copies preserve the detected source format', () => {
  const word = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  assert.equal(getImportFileName('Final review', word), 'Final review.docx');
  assert.equal(getImportMimeType('Final review.docx', 'application/zip'), word);
  assert.equal(getImportMimeType('Legacy slides.ppt', 'application/octet-stream'), 'application/vnd.ms-powerpoint');
  assert.equal(getImportFileName('Scan', 'image/jpeg'), 'Scan.jpg');
  assert.equal(getImportFormat('cache-uuid', 'application/rtf; charset=UTF-8').extension, 'rtf');
});

test('does not accept unknown files just because the declared MIME is supported', () => {
  for (const type of ['exe', 'zip', 'heic', 'gdoc', 'gslides', '__proto__']) {
    assert.equal(getImportFormat('Final review.' + type, 'application/pdf'), null, type);
  }
  assert.equal(getImportFormat('unknown', 'application/octet-stream'), null);
});

test('sends scans through the image reader and documents through the file reader', () => {
  assert.deepEqual(providerSource(getImportFormat('Scan.jpeg'), 'image-id'), { type: 'input_image', file_id: 'image-id', detail: 'high' });
  for (const extension of ['pdf', 'docx', 'pages', 'key', 'xlsx', 'csv', 'html']) {
    const format = getImportFormat('Guide.' + extension);
    assert.equal(format.input, 'file', extension);
    assert.deepEqual(providerSource(format, 'file-id'), { type: 'input_file', file_id: 'file-id' }, extension);
  }
});

test('decodes study guide text without mangling its questions or treating binary bytes as text', () => {
  const source = '# Chapter 1\n\n1. Define osmosis.\nAnswer: Water moves across a membrane.';
  assert.equal(readPlainDocument(new TextEncoder().encode(source)), source);
  assert.equal(readPlainDocument(Uint8Array.of(0xff, 0xfe, 0x2d, 0, 0xbb, 0x03)), '-λ');
  assert.equal(readPlainDocument(Uint8Array.of(0xfe, 0xff, 0, 0x2d, 0x03, 0xbb)), '-λ');
  assert.equal(readPlainDocument(new TextEncoder().encode(' \n\t')), '');
  assert.throws(() => readPlainDocument(Uint8Array.of(0x50, 0x4b, 0, 0)), /Invalid plain text/);
});
