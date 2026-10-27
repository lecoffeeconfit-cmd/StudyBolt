import JSZip from 'npm:jszip@3.10.1';

import type { Flashcard, StudyPack } from '../../../src/models.ts';
import { extractPptxLocally } from './pptxVisuals.ts';

interface FixtureImage {
  name: string;
  bytes: Uint8Array;
  alt: string;
  width?: number;
  height?: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function pptxFixture(slides: Array<{ title: string; text?: string; images?: FixtureImage[] }>): Promise<Uint8Array> {
  const zip = new JSZip();
  slides.forEach((slide, slideIndex) => {
    const number = slideIndex + 1;
    const images = slide.images ?? [];
    const pictures = images.map((image, imageIndex) => `
      <p:pic>
        <p:nvPicPr><p:cNvPr id="${imageIndex + 2}" name="Picture ${imageIndex + 1}" descr="${image.alt}" /></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId${imageIndex + 1}" /></p:blipFill>
        <p:spPr><a:xfrm><a:off x="${imageIndex * 100000}" y="0"/><a:ext cx="${image.width ?? 4_000_000}" cy="${image.height ?? 3_000_000}"/></a:xfrm></p:spPr>
      </p:pic>`).join('');
    zip.file(`ppt/slides/slide${number}.xml`, `
      <p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:cSld><p:spTree>
        <p:sp><p:txBody><a:p><a:r><a:t>${slide.title}</a:t></a:r></a:p><a:p><a:r><a:t>${slide.text ?? ''}</a:t></a:r></a:p></p:txBody></p:sp>
        ${pictures}
      </p:spTree></p:cSld></p:sld>`);
    if (images.length) {
      zip.file(`ppt/slides/_rels/slide${number}.xml.rels`, `<Relationships>${images.map((image, imageIndex) => `<Relationship Id="rId${imageIndex + 1}" Target="../media/${image.name}" />`).join('')}</Relationships>`);
      images.forEach((image) => {
        if (!zip.file(`ppt/media/${image.name}`)) zip.file(`ppt/media/${image.name}`, image.bytes);
      });
    }
  });
  return zip.generateAsync({ type: 'uint8array' });
}

function image(seed: number): Uint8Array {
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, seed, seed + 1, seed + 2]);
}

Deno.test('PowerPoint with no images keeps document extraction working', async () => {
  const result = await extractPptxLocally(await pptxFixture([{ title: 'Introduction', text: 'Course overview' }]));
  assert(result.visuals.length === 0, 'Expected no visuals');
  assert(result.summary.totalSlides === 1, 'Expected one slide');
  assert(result.summary.totalImages === 0, 'Expected no images');
});

Deno.test('useful diagram keeps preview and source slide', async () => {
  const result = await extractPptxLocally(await pptxFixture([{
    title: 'Cardiac Cycle',
    text: 'The diagram shows the stages of systole and diastole.',
    images: [{ name: 'diagram.png', bytes: image(1), alt: 'Labeled diagram of the cardiac cycle showing systole and diastole stages.' }],
  }]));
  const visual = result.visuals[0];
  assert(visual?.slideNumber === 1, 'Expected slide provenance');
  assert(visual?.visualType === 'flowchart' || visual?.visualType === 'labeled_diagram', 'Expected an educational visual type');
  assert(Boolean(visual?.imageDataUrl), 'Expected a retained image preview');
});

Deno.test('many distinct educational images are retained once each', async () => {
  const images = Array.from({ length: 12 }, (_, index) => ({
    name: `figure-${index}.png`,
    bytes: image(index + 10),
    alt: `Educational anatomy figure ${index + 1} showing a distinct labeled tissue structure.`,
  }));
  const result = await extractPptxLocally(await pptxFixture([{ title: 'Tissue Atlas', text: 'Compare each labeled anatomy figure.', images }]));
  assert(result.summary.totalImages === 12, 'Expected every candidate to be counted');
  assert(result.visuals.length === 12, 'Expected distinct images to remain distinct');
});

Deno.test('repeated slide logo is classified as junk and deduplicated', async () => {
  const logo = { name: 'logo.png', bytes: image(70), alt: 'University publisher logo' };
  const slides = Array.from({ length: 5 }, (_, index) => ({ title: `Slide ${index + 1}`, text: 'Lecture content', images: [logo] }));
  const result = await extractPptxLocally(await pptxFixture(slides));
  assert(result.visuals.length === 1, 'Expected repeated asset to be stored once');
  assert(result.visuals[0]?.visualType === 'logo', 'Expected logo classification');
  assert(result.summary.duplicateImagesIgnored === 4, 'Expected four duplicate copies to be ignored');
  assert(!result.visuals[0]?.imageDataUrl, 'Expected junk image bytes to be discarded');
});

Deno.test('useful and decorative images on the same slide are separated', async () => {
  const result = await extractPptxLocally(await pptxFixture([{
    title: 'Neural Signaling',
    text: 'The diagram illustrates membrane depolarization.',
    images: [
      { name: 'icon.png', bytes: image(80), alt: 'Small decorative icon', width: 200_000, height: 200_000 },
      { name: 'neuron.png', bytes: image(90), alt: 'Labeled diagram of a neuron membrane during depolarization.' },
    ],
  }]));
  assert(result.visuals.some((visual) => visual.visualType === 'icon' && !visual.imageDataUrl), 'Expected decorative icon to be ignored');
  assert(result.visuals.some((visual) => visual.visualType !== 'icon' && Boolean(visual.imageDataUrl)), 'Expected educational image to retain its preview');
});

Deno.test('low confidence candidates remain available for optional user review', async () => {
  const result = await extractPptxLocally(await pptxFixture([{
    title: 'Introduction',
    text: 'Welcome to the course.',
    images: [{ name: 'unlabeled.png', bytes: image(95), alt: '' }],
  }]));
  const visual = result.visuals[0];
  assert(visual?.needsUserReview === true, 'Expected a low confidence candidate to remain reviewable');
  assert(Boolean(visual?.imageDataUrl), 'Expected its preview to remain available for optional analysis');
});

Deno.test('invalid PowerPoint extraction fails in isolation', async () => {
  let failed = false;
  try {
    await extractPptxLocally(new Uint8Array([1, 2, 3, 4]));
  } catch {
    failed = true;
  }
  assert(failed, 'Expected invalid PPTX bytes to fail extraction');
});

Deno.test('an older study set and its text flashcard survive a storage round trip', () => {
  const card: Flashcard = {
    id: 'card-1',
    front: 'What is active recall?',
    back: 'Retrieving information from memory.',
    confidence: 'new',
    source: { sectionId: 'section-1', label: 'Slides 1–3' },
  };
  const oldDeck = { id: 'old-pack', title: 'Existing pack', flashcards: [card] } as Pick<StudyPack, 'id' | 'title' | 'flashcards'>;
  const reopened = JSON.parse(JSON.stringify(oldDeck)) as typeof oldDeck;
  assert(!('visuals' in reopened), 'Expected old records to remain valid without Visuals');
  assert(reopened.flashcards[0]?.front === card.front, 'Expected the existing text card to be unchanged');
  assert(reopened.flashcards[0]?.imagePath === undefined, 'Expected image fields to remain optional');
});

Deno.test('a visual flashcard keeps its private asset reference across a storage round trip', () => {
  const card: Flashcard = {
    id: 'visual-card-1',
    front: 'Which structure is highlighted?',
    back: 'The cell membrane.',
    explanation: 'Visual concept: membrane structure',
    confidence: 'new',
    source: { sectionId: 'section-2', label: 'Slide 8' },
    imagePath: 'user-id/document-id/visual-8-1-a1b2c3.png',
    imageUrl: 'https://example.invalid/short-lived-signed-url',
    sourceSlide: 8,
    visualId: 'visual-8-1',
  };
  const reopened = JSON.parse(JSON.stringify(card)) as Flashcard;
  assert(reopened.imagePath === card.imagePath, 'Expected the refreshable image path to persist');
  assert(reopened.sourceSlide === 8 && reopened.visualId === 'visual-8-1', 'Expected visual provenance to persist');
});
