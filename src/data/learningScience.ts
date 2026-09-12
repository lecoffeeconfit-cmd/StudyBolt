export interface LearningEvidence {
  principle: string;
  application: string;
  source: string;
  url: string;
}

export const learningEvidence: LearningEvidence[] = [
  {
    principle: 'Retrieval practice',
    application: 'Cards and quizzes ask you to answer before showing feedback.',
    source: 'Roediger & Karpicke, 2006',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16507066/',
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
