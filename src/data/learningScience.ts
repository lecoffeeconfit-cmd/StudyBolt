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
    principle: 'High-utility techniques',
    application: 'StudyBolt emphasizes practice testing and spaced review.',
    source: 'Dunlosky et al., 2013',
    url: 'https://doi.org/10.1177/1529100612453266',
  },
];
