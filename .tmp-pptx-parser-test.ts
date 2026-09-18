import { readFile } from 'node:fs/promises';
import { extractPptxLocally } from './supabase/functions/studybolt-process-document/pptxVisuals.ts';

const filePath = process.argv[2];
if (!filePath) throw new Error('Missing PPTX path');
const extraction = await extractPptxLocally(new Uint8Array(await readFile(filePath)));
console.log(JSON.stringify({
  ...extraction.summary,
  visualRecords: extraction.visuals.length,
  sourceChars: extraction.sourceText.length,
  firstVisual: extraction.visuals[0] ? {
    slide: extraction.visuals[0].slideNumber,
    type: extraction.visuals[0].visualType,
    source: extraction.visuals[0].analysisSource,
    hasAlt: Boolean(extraction.visuals[0].altText),
  } : null,
}));
