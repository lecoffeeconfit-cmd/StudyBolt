import JSZip from 'npm:jszip@3.10.1';

export type LocalVisualStatus = 'resolved_native' | 'resolved_accessibility' | 'resolved_ocr' | 'resolved_local' | 'needs_review';
export type LocalVisualType = 'decorative' | 'logo' | 'background' | 'icon' | 'photo_educational' | 'microscopy_image' | 'diagram' | 'labeled_diagram' | 'flowchart' | 'graph' | 'chart_image' | 'table_image' | 'screenshot' | 'equation' | 'text_image' | 'handwritten' | 'unknown';
export type LocalVisualReason = 'complex_diagram' | 'unreadable_labels' | 'low_confidence' | 'complex_graph' | 'scientific_image' | 'equation_unresolved' | 'handwriting' | 'microscopy_detail' | 'insufficient_context' | 'unknown_visual';

export interface LocalVisualKnowledge {
  id: string;
  slideNumber: number;
  slideTitle: string;
  imageHash: string;
  imageReference: string;
  imageDataUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageX?: number;
  imageY?: number;
  altText?: string;
  accessibilityText?: string;
  nearbyText?: string;
  visualType: LocalVisualType;
  educationalImportance: number;
  localConfidence: number;
  needsUserReview: boolean;
  reason?: LocalVisualReason;
  description?: string;
  extractedText?: string;
  labels?: string[];
  concepts?: string[];
  relationships?: string[];
  studyRelevance?: string;
  analysisSource: 'pptx_native' | 'accessibility' | 'ocr' | 'local';
  status: LocalVisualStatus;
  cacheHit?: boolean;
  analysisAvoided?: boolean;
}

export interface PptxVisualSummary {
  totalSlides: number;
  totalImages: number;
  totalNativeTables: number;
  totalNativeCharts: number;
  decorativeImagesIgnored: number;
  nativeVisualsResolved: number;
  accessibilityVisualsResolved: number;
  ocrVisualsResolved: number;
  locallyResolved: number;
  visualsNeedingReview: number;
  userAIVisualsAnalyzed: number;
  cachedAnalysesUsed: number;
}

export interface PptxLocalExtraction {
  sourceText: string;
  visuals: LocalVisualKnowledge[];
  summary: PptxVisualSummary;
}

interface RelationshipMap { [id: string]: string; }
interface SlideExtraction {
  number: number;
  title: string;
  text: string;
  paragraphs: string[];
  notes: string;
  tables: string[];
  charts: string[];
  images: Array<{
    reference: string;
    hash: string;
    data: Uint8Array;
    extension: string;
    altText: string;
    title: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }>;
}

const MAX_SOURCE_CONTEXT_CHARS = 220_000;
const MAX_INLINE_VISUAL_BYTES = 2_000_000;
const EMU_PER_INCH = 914_400;

export async function extractPptxLocally(bytes: Uint8Array): Promise<PptxLocalExtraction> {
  const zip = await JSZip.loadAsync(bytes);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  if (!slideNames.length) throw new Error('The PowerPoint did not contain any slides.');

  const imageHashes = new Map<string, number>();
  const knownVisuals = new Map<string, LocalVisualKnowledge>();
  const slides: SlideExtraction[] = [];
  for (const name of slideNames) {
    const number = slideNumber(name);
    const xml = await readText(zip, name);
    const rels = await readRelationships(zip, `ppt/slides/_rels/slide${number}.xml.rels`);
    const notesTarget = Object.entries(rels).find(([id]) => id && rels[id]?.toLowerCase().includes('notesslide'))?.[1];
    const notes = notesTarget ? extractParagraphs(await readText(zip, notesTarget)).join('\n') : '';
    const paragraphs = extractParagraphs(xml);
    const title = titleFor(paragraphs);
    const images = await extractImages(zip, xml, rels);
    for (const image of images) imageHashes.set(image.hash, (imageHashes.get(image.hash) ?? 0) + 1);
    slides.push({
      number,
      title,
      text: paragraphs.join('\n'),
      paragraphs,
      notes,
      tables: extractTables(xml),
      charts: await extractCharts(zip, xml, rels),
      images,
    });
  }

  const visuals: LocalVisualKnowledge[] = [];
  let decorativeImagesIgnored = 0;
  let nativeVisualsResolved = 0;
  let accessibilityVisualsResolved = 0;
  let locallyResolved = 0;
  for (const [index, slide] of slides.entries()) {
    const previous = slides[index - 1];
    const next = slides[index + 1];
    for (const [imageIndex, image] of slide.images.entries()) {
      const duplicate = knownVisuals.get(image.hash);
      if (duplicate) {
        visuals.push({
          ...duplicate,
          id: `visual-${slide.number}-${imageIndex + 1}`,
          slideNumber: slide.number,
          slideTitle: slide.title,
          imageReference: image.reference,
          imageX: image.x,
          imageY: image.y,
          imageWidth: image.width,
          imageHeight: image.height,
          cacheHit: true,
          needsUserReview: false,
          status: 'resolved_local',
          analysisAvoided: true,
        });
        locallyResolved += 1;
        continue;
      }

      const context = [slide.title, slide.text, slide.notes, previous?.text, next?.text].filter(Boolean).join(' ');
      const classification = classifyImage(image, slide.text, context, imageHashes.get(image.hash) ?? 1);
      if (classification.visualType === 'decorative' || classification.visualType === 'logo' || classification.visualType === 'background' || classification.visualType === 'icon') {
        decorativeImagesIgnored += 1;
      }
      if (classification.analysisSource === 'pptx_native') nativeVisualsResolved += 1;
      if (classification.analysisSource === 'accessibility') accessibilityVisualsResolved += 1;
      if (classification.analysisSource === 'local') locallyResolved += 1;

      const visual: LocalVisualKnowledge = {
        id: `visual-${slide.number}-${imageIndex + 1}`,
        slideNumber: slide.number,
        slideTitle: slide.title,
        imageHash: image.hash,
        imageReference: image.reference,
        ...(classification.needsUserReview && image.data.byteLength <= MAX_INLINE_VISUAL_BYTES ? { imageDataUrl: dataUrl(image.data, image.extension) } : {}),
        ...(image.width !== undefined ? { imageWidth: image.width } : {}),
        ...(image.height !== undefined ? { imageHeight: image.height } : {}),
        ...(image.x !== undefined ? { imageX: image.x } : {}),
        ...(image.y !== undefined ? { imageY: image.y } : {}),
        ...(image.altText ? { altText: image.altText, accessibilityText: image.altText } : {}),
        nearbyText: context.slice(0, 6_000),
        visualType: classification.visualType,
        educationalImportance: classification.educationalImportance,
        localConfidence: classification.localConfidence,
        needsUserReview: classification.needsUserReview,
        ...(classification.reason ? { reason: classification.reason } : {}),
        description: image.altText || `Visual on slide ${slide.number} in the context of ${slide.title || 'the lecture'}.`,
        extractedText: image.altText || '',
        concepts: conceptsFrom(slide.title, image.altText),
        studyRelevance: image.altText || slide.title || 'The visual appears in the source presentation.',
        analysisSource: classification.analysisSource,
        status: classification.needsUserReview ? 'needs_review' : statusFor(classification.analysisSource),
        analysisAvoided: !classification.needsUserReview,
      };
      knownVisuals.set(image.hash, visual);
      visuals.push(visual);
    }
    const nativeContext = [slide.title, slide.text, slide.notes, previous?.text, next?.text].filter(Boolean).join(' ').slice(0, 6_000);
    for (const [tableIndex, table] of slide.tables.entries()) {
      const hash = await sha256(new TextEncoder().encode(`table:${table}`));
      visuals.push(nativeVisual(slide, `table-${tableIndex + 1}`, hash, 'table_image', `Native PowerPoint table:\n${table}`, nativeContext));
      nativeVisualsResolved += 1;
    }
    for (const [chartIndex, chart] of slide.charts.entries()) {
      const hash = await sha256(new TextEncoder().encode(`chart:${chart}`));
      visuals.push(nativeVisual(slide, `chart-${chartIndex + 1}`, hash, 'graph', `Native PowerPoint chart:\n${chart}`, nativeContext));
      nativeVisualsResolved += 1;
    }
  }

  const sourceText = slides.map((slide) => {
    const previous = slides.find((candidate) => candidate.number === slide.number - 1);
    const next = slides.find((candidate) => candidate.number === slide.number + 1);
    return [
      `SLIDE ${slide.number}: ${slide.title || 'Untitled slide'}`,
      slide.text ? `TEXT:\n${slide.text}` : '',
      slide.notes ? `SPEAKER NOTES:\n${slide.notes}` : '',
      slide.tables.length ? `NATIVE TABLES:\n${slide.tables.join('\n')}` : '',
      slide.charts.length ? `NATIVE CHARTS:\n${slide.charts.join('\n')}` : '',
      slide.images.map((image) => image.altText ? `ACCESSIBILITY DESCRIPTION (${image.reference}): ${image.altText}` : '').filter(Boolean).join('\n'),
      previous ? `PREVIOUS SLIDE CONTEXT: ${previous.title}. ${previous.text}` : '',
      next ? `NEXT SLIDE CONTEXT: ${next.title}. ${next.text}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n').slice(0, MAX_SOURCE_CONTEXT_CHARS);

  return {
    sourceText,
    visuals,
    summary: {
      totalSlides: slides.length,
      totalImages: slides.reduce((total, slide) => total + slide.images.length, 0),
      totalNativeTables: slides.reduce((total, slide) => total + slide.tables.length, 0),
      totalNativeCharts: slides.reduce((total, slide) => total + slide.charts.length, 0),
      decorativeImagesIgnored,
      nativeVisualsResolved,
      accessibilityVisualsResolved,
      ocrVisualsResolved: 0,
      locallyResolved,
      visualsNeedingReview: visuals.filter((visual) => visual.needsUserReview).length,
      userAIVisualsAnalyzed: 0,
      cachedAnalysesUsed: visuals.filter((visual) => visual.cacheHit).length,
    },
  };
}

function nativeVisual(slide: SlideExtraction, suffix: string, hash: string, visualType: LocalVisualType, description: string, nearbyText: string): LocalVisualKnowledge {
  return {
    id: `visual-${slide.number}-${suffix}`,
    slideNumber: slide.number,
    slideTitle: slide.title,
    imageHash: hash,
    imageReference: `pptx://slide/${slide.number}/${suffix}`,
    nearbyText,
    visualType,
    educationalImportance: 0.92,
    localConfidence: 0.99,
    needsUserReview: false,
    description,
    extractedText: description,
    concepts: conceptsFrom(slide.title, description),
    studyRelevance: 'Structured PowerPoint data was extracted directly without visual AI.',
    analysisSource: 'pptx_native',
    status: 'resolved_native',
    analysisAvoided: true,
  };
}

async function extractImages(zip: JSZip, xml: string, rels: RelationshipMap): Promise<SlideExtraction['images']> {
  const result: SlideExtraction['images'] = [];
  for (const [index, block] of allTags(xml, 'p:pic').entries()) {
    const cNvPr = firstTag(block, 'p:cNvPr');
    const blip = firstTag(block, 'a:blip');
    const relationshipId = attr(blip, 'r:embed');
    const target = relationshipId ? rels[relationshipId] : undefined;
    if (!target) continue;
    const entry = zip.file(target);
    if (!entry) continue;
    const data = await entry.async('uint8array');
    const extension = target.split('.').pop()?.toLowerCase() || 'bin';
    const transform = firstTag(block, 'a:xfrm');
    const offset = firstTag(transform, 'a:off');
    const extent = firstTag(transform, 'a:ext');
    result.push({
      reference: target,
      hash: await sha256(data),
      data,
      extension,
      altText: decodeXml(attr(cNvPr, 'descr')),
      title: decodeXml(attr(cNvPr, 'title')),
      x: numberAttr(offset, 'x'),
      y: numberAttr(offset, 'y'),
      width: numberAttr(extent, 'cx'),
      height: numberAttr(extent, 'cy'),
    });
  }
  return result;
}

async function extractCharts(zip: JSZip, xml: string, rels: RelationshipMap): Promise<string[]> {
  const result: string[] = [];
  for (const graphic of allTags(xml, 'a:graphicData')) {
    if (!graphic.includes('drawingml/2006/chart')) continue;
    const chartReference = attr(firstTag(graphic, 'c:chart'), 'r:id');
    const target = chartReference ? rels[chartReference] : undefined;
    if (!target) continue;
    const chartXml = await readText(zip, target);
    const title = extractParagraphs(firstTag(chartXml, 'c:title')).join(' ');
    const series = allTags(chartXml, 'c:ser').map((item, index) => {
      const name = extractParagraphs(firstTag(item, 'c:tx')).join(' ') || `Series ${index + 1}`;
      const categories = allTags(firstTag(item, 'c:cat'), 'c:v').map((value) => decodeXml(value)).filter(Boolean);
      const values = allTags(firstTag(item, 'c:val'), 'c:v').map((value) => decodeXml(value)).filter(Boolean);
      return `${name}: ${categories.map((category, valueIndex) => `${category}=${values[valueIndex] ?? ''}`).join(', ')}`;
    });
    result.push([title, ...series].filter(Boolean).join('\n'));
  }
  return result;
}

function extractTables(xml: string): string[] {
  return allTags(xml, 'a:tbl').map((table) => allTags(table, 'a:tr').map((row) => allTags(row, 'a:tc').map((cell) => extractParagraphs(cell).join(' ')).join(' | ')).join('\n'));
}

function classifyImage(image: SlideExtraction['images'][number], slideText: string, context: string, repeatCount: number): { visualType: LocalVisualType; educationalImportance: number; localConfidence: number; needsUserReview: boolean; reason?: LocalVisualReason; analysisSource: LocalVisualKnowledge['analysisSource'] } {
  const alt = `${image.altText} ${image.title}`.toLowerCase();
  const slide = `${slideText} ${context}`.toLowerCase();
  const hasRichAccessibility = image.altText.trim().length >= 40;
  const isSmall = (image.width ?? 0) > 0 && (image.height ?? 0) > 0 && Math.min(image.width ?? 0, image.height ?? 0) < EMU_PER_INCH * 0.55;
  const isLogo = /logo|publisher|copyright|marieb|cover|front cover/.test(alt);
  const visualType = /micrograph|micrography|microscop|histolog|tissue image|stained/.test(alt) ? 'microscopy_image'
    : /flowchart|flow chart|stages|stage \d|process/.test(alt) ? 'flowchart'
      : /chart|graph|bar graph|line graph|axis|x-axis|y-axis/.test(alt) ? 'chart_image'
        : /table|rows|columns/.test(alt) ? 'table_image'
          : /diagram|figure|illustration|cross-section|anatom/.test(alt) ? (hasRichAccessibility ? 'labeled_diagram' : 'diagram')
            : /screenshot|screen shot/.test(alt) ? 'screenshot'
              : /equation|formula/.test(alt) ? 'equation'
                : isLogo ? 'logo'
                  : isSmall ? 'icon'
                    : hasRichAccessibility || /figure|tissue|cell|muscle|membrane|bone|blood|organ/.test(slide) ? 'photo_educational' : 'unknown';
  if (isLogo || isSmall || repeatCount >= 4) {
    return { visualType: isLogo ? 'logo' : isSmall ? 'icon' : 'decorative', educationalImportance: 0.05, localConfidence: 0.98, needsUserReview: false, analysisSource: 'local' };
  }
  if (hasRichAccessibility) {
    return { visualType, educationalImportance: 0.9, localConfidence: 0.94, needsUserReview: false, analysisSource: 'accessibility' };
  }
  const hasStrongContext = /figure|diagram|tissue|muscle|bone|blood|membrane|connective|epithel|nervous|repair|chart|graph/.test(slide);
  const localConfidence = hasStrongContext ? 0.58 : 0.34;
  const reason: LocalVisualReason = visualType === 'microscopy_image' ? 'microscopy_detail'
    : visualType === 'chart_image' ? 'complex_graph'
      : visualType === 'equation' ? 'equation_unresolved'
        : visualType === 'diagram' || visualType === 'labeled_diagram' || visualType === 'flowchart' ? 'complex_diagram'
          : 'low_confidence';
  return { visualType, educationalImportance: hasStrongContext ? 0.78 : 0.42, localConfidence, needsUserReview: hasStrongContext || localConfidence < 0.7, reason, analysisSource: 'local' };
}

function statusFor(source: LocalVisualKnowledge['analysisSource']): LocalVisualStatus {
  if (source === 'accessibility') return 'resolved_accessibility';
  if (source === 'pptx_native') return 'resolved_native';
  if (source === 'ocr') return 'resolved_ocr';
  return 'resolved_local';
}

function conceptsFrom(title: string, alt: string): string[] {
  const words = `${title} ${alt}`.replace(/[^A-Za-z0-9\s-]/g, ' ').split(/\s+/).filter((word) => word.length >= 5);
  return [...new Set(words)].slice(0, 12);
}

function slideNumber(name: string): number {
  return Number(name.match(/slide(\d+)\.xml$/i)?.[1] ?? 0);
}

async function readText(zip: JSZip, name: string): Promise<string> {
  const entry = zip.file(name);
  return entry ? entry.async('text') : '';
}

async function readRelationships(zip: JSZip, name: string): Promise<RelationshipMap> {
  const xml = await readText(zip, name);
  const base = name.replace(/\/_rels\/[^/]+\.rels$/i, '');
  const map: RelationshipMap = {};
  for (const relationship of allTags(xml, 'Relationship')) {
    const id = attr(relationship, 'Id');
    const target = attr(relationship, 'Target');
    if (!id || !target || attr(relationship, 'TargetMode') === 'External') continue;
    map[id] = normalizePath(`${base}/${target}`);
  }
  return map;
}

function normalizePath(value: string): string {
  const parts: string[] = [];
  for (const part of value.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function extractParagraphs(xml: string): string[] {
  return allTags(xml, 'a:p').map((paragraph) => {
    const level = Number(attr(firstTag(paragraph, 'a:pPr'), 'lvl') ?? 0);
    const text = allTags(paragraph, 'a:t').map((value) => decodeXml(value)).join('').replace(/\s+/g, ' ').trim();
    return text ? `${'  '.repeat(Math.min(level, 6))}${text}` : '';
  }).filter(Boolean);
}

function titleFor(paragraphs: string[]): string {
  return paragraphs.find((paragraph) => paragraph.trim().length > 0)?.trim().slice(0, 240) || '';
}

function allTags(xml: string, tagName: string): string[] {
  if (!xml) return [];
  const escaped = tagName.replace(':', '\\:');
  const pattern = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>|<${escaped}(?:\\s[^>]*)?\\s*/>`, 'gi');
  return [...xml.matchAll(pattern)].map((match) => match[0] ?? '').filter(Boolean);
}

function firstTag(xml: string, tagName: string): string {
  return allTags(xml || '', tagName)[0] ?? '';
}

function attr(xml: string, name: string): string {
  if (!xml) return '';
  const escaped = name.replace(':', '\\:');
  return xml.match(new RegExp(`${escaped}="([^"]*)"`, 'i'))?.[1] ?? '';
}

function numberAttr(xml: string, name: string): number | undefined {
  const value = Number(attr(xml, name));
  return Number.isFinite(value) ? value : undefined;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function dataUrl(bytes: Uint8Array, extension: string): string {
  const mime = extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
