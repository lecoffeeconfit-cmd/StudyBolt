export const SUBJECT_ICONS = [
  { id: 'biology', label: 'Biology', emoji: '🌱', aliases: ['🦠', '🌿', '🧬'], match: /\b(biol(?:ogy)?|bio|ecology|botany|genetics|microbiology|environmental(?: science)?)\b/i, color: '#35B890', light: '#E4F8EE', dark: '#193B34' },
  { id: 'chemistry', label: 'Chemistry', emoji: '🧪', aliases: ['⚗️', '⚗'], match: /\b(chem(?:istry)?|biochem(?:istry)?|organic chemistry)\b/i, color: '#5895EE', light: '#EAF2FF', dark: '#22364D' },
  { id: 'psychology', label: 'Psychology', emoji: '🧠', aliases: [], match: /\b(psych(?:ology)?|neuroscience|sociology|behavior(?:al)?|behaviour(?:al)?)\b/i, color: '#EB7F9F', light: '#FFF0F5', dark: '#422D3D' },
  { id: 'medicine', label: 'Anatomy', emoji: '🫀', aliases: ['🩺', '🦴', '💊'], match: /\b(anatomy|physiology|nursing|medicine|medical|health|pharmacology|pathology|a\s*&\s*p)\b/i, color: '#F0787B', light: '#FFF0ED', dark: '#432E33' },
  { id: 'physics', label: 'Physics', emoji: '⚛️', aliases: ['⚛', '🔭'], match: /\b(phys(?:ics)?|astronomy|astrophysics|quantum)\b/i, color: '#9880EA', light: '#F1EDFF', dark: '#342E4D' },
  { id: 'math', label: 'Math', emoji: '🧮', aliases: ['📐', '➗', '🔢'], match: /\b(math(?:ematics)?|calculus|calc|algebra|geometry|trigonometry|statistics|stats|probability)\b/i, color: '#F0AC45', light: '#FFF5DE', dark: '#403823' },
  { id: 'computing', label: 'Computing', emoji: '💻', aliases: ['🖥️', '⌨️'], match: /\b(comput(?:er|ing)|cs|coding|programming|software|informatics|data science|cybersecurity)\b/i, color: '#538FE9', light: '#EAF3FF', dark: '#21374A' },
  { id: 'literature', label: 'Literature', emoji: '📖', aliases: ['✍️', '📝'], match: /\b(english|literature|writing|poetry|reading|composition|humanities|philosophy)\b/i, color: '#B18AE1', light: '#F5EEFF', dark: '#382E48' },
  { id: 'history', label: 'History', emoji: '🏛️', aliases: ['📜', '🏛'], match: /\b(hist(?:ory)?|classics|archaeology|civics|government|political science|law)\b/i, color: '#D59B5D', light: '#FFF3E3', dark: '#40352A' },
  { id: 'geography', label: 'Geography', emoji: '🌎', aliases: ['🌍', '🌏', '🗺️'], match: /\b(geog(?:raphy)?|geology|earth|geoscience|oceanography|world studies)\b/i, color: '#38AFB6', light: '#E3F7F7', dark: '#1D393E' },
  { id: 'languages', label: 'Languages', emoji: '💬', aliases: ['🗣️', '🌐'], match: /\b(languages?|spanish|french|german|italian|mandarin|chinese|japanese|korean|arabic|latin|linguistics|esl)\b/i, color: '#EA9670', light: '#FFF0E5', dark: '#41322D' },
  { id: 'art', label: 'Art', emoji: '🎨', aliases: ['🖌️', '✏️'], match: /\b(arts?|design|drawing|painting|photography|creative)\b/i, color: '#E78CB7', light: '#FFF0F8', dark: '#402D40' },
  { id: 'music', label: 'Music', emoji: '🎵', aliases: ['🎶', '🎼', '🎹'], match: /\b(music|band|choir|orchestra|piano|guitar|performing arts|theat(?:er|re))\b/i, color: '#8D80E5', light: '#F0EEFF', dark: '#302F49' },
  { id: 'business', label: 'Business', emoji: '📈', aliases: ['💼', '💰'], match: /\b(business|economics|econ|finance|accounting|marketing|management|entrepreneurship)\b/i, color: '#54B893', light: '#E9F8EC', dark: '#233B31' },
  { id: 'engineering', label: 'Engineering', emoji: '⚙️', aliases: ['⚙', '🛠️', '🔧'], match: /\b(engineering|robotics|mechanics|electronics|architecture)\b/i, color: '#6DA6BE', light: '#EBF6FA', dark: '#293A44' },
  { id: 'general', label: 'General', emoji: '🎓', aliases: ['📚', '📄', '⚡'], match: /$^/, color: '#6E95E9', light: '#EDF2FF', dark: '#29354C' },
] as const;

export type SubjectIconId = typeof SUBJECT_ICONS[number]['id'];

/** Keep saved emoji choices compatible while upgrading their artwork. */
export function getSubjectIcon(subject = '', emoji?: string) {
  const selected = emoji && SUBJECT_ICONS.find((item) => item.emoji === emoji
    || (item.id !== 'general' && (item.aliases as readonly string[]).includes(emoji)));
  if (selected) return selected;
  // Course codes such as BIO101 and MATH-201 should match like full names.
  const name = subject.replace(/([a-z])\d/gi, '$1 ').replace(/[_-]/g, ' ');
  return SUBJECT_ICONS.find((item) => item.match.test(name)) ?? SUBJECT_ICONS[SUBJECT_ICONS.length - 1]!;
}
