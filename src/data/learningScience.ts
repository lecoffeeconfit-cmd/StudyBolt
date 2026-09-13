export interface LearningEvidence {
  principle: string;
  application: string;
  source: string;
  url: string;
}

export const learningEvidence: LearningEvidence[] = [
  {
    principle: 'Retrieval practice',
    application: 'Notes end with recall prompts, and cards and quizzes ask you to answer before showing feedback.',
    source: 'Roediger & Karpicke, 2006',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16507066/',
  },
  {
    principle: 'Organizational signaling',
    application: 'Layered headings, overviews, and source-linked chunks make the topic structure explicit instead of presenting a wall of text.',
    source: 'Lorch & Lorch, 1996',
    url: 'https://doi.org/10.1037/0022-0663.88.1.38',
  },
  {
    principle: 'Self-explanation',
    application: 'Connection and “Retrieve it” prompts ask learners to reconstruct and explain ideas in their own words.',
    source: 'Chi et al., 1994',
    url: 'https://doi.org/10.1207/s15516709cog1803_3',
  },
  {
    principle: 'Distributed practice',
    application: 'Study plans spread short sessions across the available days.',
    source: 'Cepeda et al., 2006',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16719566/',
  },
  {
    principle: 'Successive relearning',
    application: 'Retention is credited only after successful recall on different days—not after one exposure.',
    source: 'Vaughn, Dunlosky & Rawson, 2016',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27027887/',
  },
  {
    principle: 'Calibrated confidence',
    application: 'Self-ratings are blended with observed quiz performance and never treated as proof by themselves.',
    source: 'Fleming & Lau, 2014',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25076880/',
  },
];
