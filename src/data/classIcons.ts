import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { SUBJECT_ICONS, type SubjectIconId } from './subjectIcons.ts';

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;
type Entry = readonly [glyph: Glyph, label: string, keywords: string];

// These glyphs use the MaterialCommunityIcons font already loaded by StudyBolt.
// The original illustrated subjects remain available in the same catalog.
const groups = {
  science: ['Sciences', '#146750', '#8DE5C8', [
    ['dna', 'DNA', 'biology genetics genes molecular biotech'],
    ['microscope', 'Microscope', 'biology microbiology lab cells histology'],
    ['bacteria-outline', 'Microbes', 'biology microbiology bacteriology virus immunology'],
    ['molecule', 'Molecule', 'chemistry biochemistry molecular organic bonds'],
    ['flask-outline', 'Lab flask', 'chemistry experiments science lab'],
    ['atom', 'Atom', 'physics chemistry quantum nuclear'],
    ['telescope', 'Telescope', 'astronomy astrophysics space stars'],
    ['orbit', 'Orbit', 'astronomy planets space physics'],
    ['leaf', 'Ecology', 'biology botany environmental conservation plant'],
    ['earth', 'Earth science', 'geography geology climate environment environmental'],
    ['waves', 'Oceanography', 'marine biology ocean water climate'],
    ['magnet', 'Magnet', 'physics electromagnetism electricity'],
  ]],
  math: ['Mathematics', '#864A08', '#FFD286', [
    ['calculator-variant-outline', 'Calculator', 'math mathematics arithmetic accounting algebra'],
    ['math-integral', 'Calculus', 'math mathematics integration derivatives calculus'],
    ['function-variant', 'Functions', 'math mathematics algebra applied equations formulas'],
    ['shape-outline', 'Geometry', 'math mathematics shapes angles'],
    ['angle-acute', 'Trigonometry', 'math mathematics triangle angle sine cosine geometry'],
    ['chart-bell-curve', 'Statistics', 'math mathematics stats probability data distribution'],
    ['dice-multiple-outline', 'Probability', 'math mathematics chance statistics games'],
    ['grid', 'Matrices', 'math mathematics linear algebra grid'],
    ['sigma', 'Summation', 'math mathematics formula series statistics accounting'],
    ['chart-scatter-plot', 'Scatterplot', 'math mathematics applied statistics data analytics'],
  ]],
  society: ['Social sciences', '#703CA2', '#DFB5FB', [
    ['brain', 'Brain', 'psychology psych neuroscience cognition mind anatomy'],
    ['head-cog-outline', 'Cognition', 'psychology psych mind behavioral behaviour cognitive development'],
    ['sitemap-outline', 'Neural connections', 'psychology neuroscience neurons network mind'],
    ['account-group-outline', 'Society', 'sociology community social people'],
    ['human-male-female-child', 'Human development', 'developmental psychology social family lifespan'],
    ['scale-balance', 'Ethics', 'philosophy political science law government justice'],
    ['vote-outline', 'Politics', 'political science government civics elections'],
    ['map-marker-path', 'Fieldwork', 'anthropology ethnography sociology research culture'],
    ['head-question-outline', 'Philosophy', 'ethics cognition logic reasoning mind humanities'],
    ['account-voice', 'Communication', 'social psychology interview media speech communications'],
  ]],
  business: ['Business', '#1B6764', '#96E4D5', [
    ['briefcase-outline', 'Management', 'business operations leadership administration'],
    ['chart-line', 'Finance', 'financial markets investing stocks economics chart trade'],
    ['cash-multiple', 'Economics', 'econ business money finance banking market'],
    ['clipboard-list-outline', 'Accounting', 'bookkeeping accountant audit tax balance ledger'],
    ['bullhorn-outline', 'Marketing', 'business brand advertising sales communications'],
    ['rocket-launch-outline', 'Entrepreneurship', 'business startup innovation venture'],
    ['chart-box-outline', 'Business analytics', 'business data analysis intelligence information systems'],
    ['package-variant-closed', 'Operations', 'business supply chain logistics management'],
    ['cash-register', 'Retail', 'business sales point of sale merchandising'],
    ['handshake-outline', 'Negotiation', 'business law management sales partnership'],
  ]],
  technology: ['Technology', '#2857A5', '#ADCFFF', [
    ['code-tags', 'Code', 'cs computer science programming software engineering web'],
    ['laptop', 'Laptop', 'cs computer science computing software technology'],
    ['chip', 'Circuits', 'cs computer science electronics electrical engineering hardware semiconductor'],
    ['shield-lock-outline', 'Cybersecurity', 'security cryptography networks information technology'],
    ['database-outline', 'Database', 'sql data science software information systems'],
    ['creation', 'Artificial intelligence', 'ai machine learning data science neural computing'],
    ['robot-outline', 'Robotics', 'automation mechanical engineering ai technology'],
    ['lan', 'Networking', 'network internet topology computer systems'],
    ['console-line', 'Terminal', 'computer science linux shell programming code'],
    ['source-branch', 'Version control', 'git coding software engineering code branches'],
    ['bug-outline', 'Debugging', 'computer science software testing quality code'],
    ['cloud-outline', 'Cloud computing', 'devops network systems infrastructure servers'],
  ]],
  humanities: ['Humanities', '#794F27', '#F4CDA2', [
    ['pillar', 'Classics', 'history ancient greece rome archaeology latin civilization'],
    ['book-open-page-variant-outline', 'Open book', 'literature english reading writing humanities'],
    ['fountain-pen-tip', 'Writing', 'literature english composition pen creative poetry'],
    ['feather', 'Poetry', 'literature english writing verse'],
    ['script-text-outline', 'Manuscript', 'history primary source literature writing archive scroll'],
    ['candle', 'Religious studies', 'religion theology faith philosophy spirituality'],
    ['bank-outline', 'Museum', 'history archaeology heritage art cultural studies'],
    ['compass-outline', 'Exploration', 'history geography culture world studies navigation'],
    ['book-search-outline', 'Research', 'library archival reading evidence humanities'],
    ['newspaper-variant-outline', 'Journalism', 'media news writing newspapers communications'],
  ]],
  languages: ['Languages', '#933958', '#F8B6CF', [
    ['translate', 'Translation', 'languages bilingual foreign linguistics interpreting'],
    ['alphabetical-variant', 'Alphabet', 'english esl letters writing language linguistics'],
    ['alphabetical', 'Word study', 'english vocabulary grammar spanish french german language'],
    ['ideogram-cjk', 'Chinese characters', 'chinese mandarin cantonese hanzi japanese kanji asian language'],
    ['ideogram-cjk-variant', 'Japanese characters', 'japanese kanji chinese asian language writing'],
    ['chat-outline', 'Conversation', 'language speaker oral spanish french german english conversation'],
    ['microphone-message', 'Pronunciation', 'language linguistics phonetics speaking phonology accent'],
    ['book-alphabet', 'Dictionary', 'language vocabulary spelling grammar german french spanish english'],
    ['web', 'World languages', 'international world spanish french japanese korean arabic multilingual'],
    ['closed-caption-outline', 'Listening practice', 'language subtitles listening accessibility'],
  ]],
  health: ['Health and medicine', '#9A3C3D', '#FFC0B6', [
    ['stethoscope', 'Stethoscope', 'medicine med nursing doctor clinical health assessment'],
    ['heart-pulse', 'Heart monitor', 'medicine anatomy physiology health cardiology nursing'],
    ['bone', 'Skeleton', 'medicine anatomy physiology bones rehabilitation'],
    ['lungs', 'Lungs', 'medicine anatomy physiology respiratory health pulmonary'],
    ['pill', 'Medication', 'medicine pharmacy pharmacology drugs nursing'],
    ['needle', 'Vaccination', 'health public health immunization medicine syringe nursing'],
    ['food-apple-outline', 'Nutrition', 'diet food wellness health dietetics'],
    ['hospital-building', 'Hospital', 'medicine healthcare administration public health clinic nursing'],
    ['hand-heart-outline', 'Patient care', 'nursing medicine clinical care occupational therapy'],
    ['human-handsup', 'Rehabilitation', 'physical therapy kinesiology medicine exercise health'],
    ['clipboard-pulse-outline', 'Public health', 'health medicine epidemiology administration health records'],
    ['medical-bag', 'First aid', 'health medicine paramedic nursing emergency'],
  ]],
  arts: ['Arts and design', '#783989', '#EEB9F2', [
    ['palette-outline', 'Palette', 'art painting color visual arts graphic design'],
    ['brush-outline', 'Brush', 'art painting drawing illustration'],
    ['camera-outline', 'Photography', 'camera visual art photo media'],
    ['movie-open-outline', 'Filmmaking', 'film cinema video production directing'],
    ['vector-square', 'Graphic design', 'design layout illustration animation visual digital'],
    ['floor-plan', 'Architecture', 'architecture drafting design engineering plans'],
    ['drama-masks', 'Theater', 'theatre drama acting performing arts stage'],
    ['animation-play-outline', 'Animation', 'motion cartoon filmmaking design storyboard'],
    ['music-note-outline', 'Music', 'music theory singing choir band performing arts'],
    ['piano', 'Piano', 'music instrument keys performance'],
    ['guitar-acoustic', 'Guitar', 'music instrument strings performance'],
    ['headphones', 'Audio production', 'music sound recording production media podcast'],
  ]],
  general: ['General and personal', '#365C96', '#BBD2F7', [
    ['bookshelf', 'Bookshelf', 'books reading study library school binder'],
    ['notebook-outline', 'Notebook', 'notes journal school class academic'],
    ['star-outline', 'Star', 'favorites space achievement personal night'],
    ['orbit-variant', 'Planet', 'space astronomy science saturn solar system'],
    ['school-outline', 'Graduation cap', 'school education degree university college learning'],
    ['pencil-outline', 'Pencil', 'writing pen notes school supplies drawing'],
    ['lightbulb-on-outline', 'Lightbulb', 'ideas learning invention creativity concept'],
    ['calendar-month-outline', 'Calendar', 'planner dates exam schedule time'],
    ['sprout-outline', 'Sprout', 'plants nature growth garden biology'],
    ['paw-outline', 'Paw print', 'animals pets nature zoology vet'],
    ['image-filter-hdr', 'Mountains', 'nature outdoors geology geography peaks'],
    ['lightning-bolt-outline', 'Lightning', 'bolt energy focus speed favorite study'],
    ['puzzle-outline', 'Puzzle', 'personal logic learning reasoning thinking'],
    ['cards-outline', 'Flashcards', 'study revision recall academic cards'],
  ]],
} as const satisfies Record<string, readonly [string, string, string, readonly Entry[]]>;

export type ClassIconCategory = keyof typeof groups;
const illustratedCategories: Record<SubjectIconId, ClassIconCategory> = {
  biology: 'science', chemistry: 'science', psychology: 'society', medicine: 'health', physics: 'science',
  math: 'math', computing: 'technology', literature: 'humanities', history: 'humanities', geography: 'science',
  languages: 'languages', art: 'arts', music: 'arts', business: 'business', engineering: 'technology', general: 'general',
};

export type ClassIconOption = { id: string; label: string; keywords: string; category: ClassIconCategory } & (
  { glyph: Glyph; lightInk: string; darkInk: string } | { illustration: SubjectIconId }
);

export const CLASS_ICON_CATEGORIES = (Object.keys(groups) as ClassIconCategory[]).map(id => ({ id, label: groups[id][0] }));
export const CLASS_ICONS: ClassIconOption[] = [
  ...CLASS_ICON_CATEGORIES.flatMap(({ id: category }) => {
    const [, lightInk, darkInk, entries] = groups[category];
    return entries.map(([glyph, label, keywords]) => ({ id: glyph, glyph, label, category, keywords, lightInk, darkInk }));
  }),
  ...SUBJECT_ICONS.map(icon => ({
    id: `illustrated-${icon.id}`, illustration: icon.id, label: `${icon.label} illustration`,
    category: illustratedCategories[icon.id], keywords: icon.label,
  })),
];

const iconById = new Map(CLASS_ICONS.map(icon => [icon.id, icon]));
export const getClassIcon = (id?: string | null) => id ? iconById.get(id) : undefined;

function words(input: string): string[] {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

const indexedIcons = CLASS_ICONS.map(icon => ({ icon, label: words(icon.label), tags: words(icon.keywords) }));

function scoreWord(word: string, label: string[], tags: string[]): number {
  if (label.includes(word)) return 8;
  if (tags.includes(word)) return 5;
  if (label.some(part => part.startsWith(word))) return 3;
  return tags.some(part => part.startsWith(word)) ? 1 : 0;
}

export function searchClassIcons(query: string): ClassIconOption[] {
  const terms = words(query);
  if (!terms.length) return [];
  return indexedIcons.flatMap(({ icon, label, tags }) => {
    const scores = terms.map(term => scoreWord(term, label, tags));
    return scores.every(Boolean) ? [{ icon, score: scores.reduce((total, score) => total + score, 0) }] : [];
  }).sort((a, b) => b.score - a.score).map(({ icon }) => icon);
}

const courseAliases: Record<string, string> = {
  bio: 'biology', biol: 'biology', chem: 'chemistry', phys: 'physics', psych: 'psychology', psyc: 'psychology',
  math: 'mathematics', mth: 'mathematics', calc: 'calculus', stats: 'statistics', stat: 'statistics',
  comp: 'computer', cs: 'computer', csci: 'computer', econ: 'economics', acct: 'accounting',
  hist: 'history', geog: 'geography', engl: 'english', span: 'spanish', nurs: 'nursing', med: 'medicine',
};
const filler = new Set(['intro', 'introduction', 'to', 'and', 'the', 'of', 'for', 'general', 'advanced', 'science', 'studies', 'a', 'an', 'i', 'ii', 'iii']);
const recommended = ['school-outline', 'bookshelf', 'lightbulb-on-outline', 'star-outline', 'notebook-outline', 'pencil-outline'];

export function recommendClassIcons(name: string): ClassIconOption[] {
  const terms = [...new Set(words(name.replace(/([a-z])(?=\d)/gi, '$1 '))
    .map(word => courseAliases[word] ?? word).filter(word => word.length > 1 && !filler.has(word) && !/^\d/.test(word)))];
  const matches = indexedIcons.flatMap(({ icon, label, tags }) => {
    const score = terms.reduce((total, term) => total + (label.includes(term) ? 8 : tags.includes(term) ? 5 : 0), 0);
    return score > 0 ? [{ id: icon.id, score }] : [];
  }).sort((a, b) => b.score - a.score).map(({ id }) => id);
  return [...new Set([...matches, ...recommended])].slice(0, 6).flatMap(id => getClassIcon(id) ?? []);
}

export function recordClassIconUse(recent: string[] | undefined, id: string): string[] {
  return [...new Set([id, ...(recent ?? [])])].filter(item => getClassIcon(item)).slice(0, 6);
}

export function classIconColumns(width: number, fontScale: number): number {
  const target = fontScale >= 1.5 ? 142 : fontScale > 1.15 ? 116 : 88;
  return Math.max(1, Math.min(5, Math.floor((width + 8) / (target + 8))));
}

function blend(accent: string, base: string, opacity: number): string {
  const accentNumber = parseInt(accent.slice(1), 16);
  const baseNumber = parseInt(base.slice(1), 16);
  const channels = [16, 8, 0].map(shift => {
    const foreground = (accentNumber >> shift) & 255;
    const background = (baseNumber >> shift) & 255;
    return Math.round(foreground * opacity + background * (1 - opacity)).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

export function classIconColors(option: Extract<ClassIconOption, { glyph: Glyph }>, mode: 'light' | 'dark', classColor: string | undefined, themeSurface: string) {
  const ink = mode === 'dark' ? option.darkInk : option.lightInk;
  const accent = classColor && /^#[0-9a-f]{6}$/i.test(classColor) ? classColor : ink;
  const base = /^#[0-9a-f]{6}$/i.test(themeSurface) ? themeSurface : mode === 'dark' ? '#181C26' : '#FFFFFF';
  return {
    ink,
    surface: [blend(accent, base, 0.08), blend(accent, base, 0.21)] as const,
    rim: blend(accent, base, 0.32),
  };
}
