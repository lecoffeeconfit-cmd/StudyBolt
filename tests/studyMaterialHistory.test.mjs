import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStudyMaterialHistory } from '../src/services/studyMaterialHistory.ts';

const at = (year, month) => new Date(year, month - 1, 15, 12).toISOString();
const course = (id, name) => ({ id, name, color: '#1769E0' });
const pack = (id, courseId, createdAt, overrides = {}) => ({
  id, courseId, createdAt, title: id, fileName: id + '.pptx', fileType: 'pptx', ...overrides,
});

test('history groups packs by their added date, even when a class spans semesters', () => {
  const classes = [course('bio', 'Biology'), course('chem', 'Chemistry')];
  const decks = [
    pack('spring-slides', 'bio', at(2026, 5)),
    pack('fall-slides', 'bio', at(2026, 8), { sourceFileNames: ['Week 1.PPT', 'Week 2.pptx'] }),
    pack('summer-slides', 'bio', at(2026, 7)),
    pack('lab', 'chem', at(2025, 12), { fileName: 'Lab.pdf', fileType: 'pdf' }),
  ];
  const before = structuredClone({ decks, classes });
  const result = buildStudyMaterialHistory(decks, classes);

  assert.deepEqual(result.semesters.map(term => term.label), ['Fall 2026', 'Summer 2026', 'Spring 2026', 'Fall 2025']);
  assert.deepEqual(result.semesters[0].classes[0].packs[0].filenames, ['Week 1.PPT', 'Week 2.pptx']);
  assert.equal(result.semesters[0].classes[0].name, 'Biology');
  assert.equal(result.semesters[2].classes[0].name, 'Biology');
  assert.equal(result.classCount, 2);
  assert.equal(result.materialCount, 5);
  assert.deepEqual({ decks, classes }, before);
});

test('legacy and undated packs remain findable alongside distinct classes with matching names', () => {
  const classes = [course('a', 'Biology'), course('b', 'Biology'), course('demo', 'Sample')];
  const duplicates = ['Lecture.pptx', 'Lecture.pptx'];
  const newest = pack('new', 'a', at(2026, 9), { sourceFileNames: duplicates });
  const decks = [
    pack('sample', 'demo', at(2026, 9), { fileType: 'demo' }),
    pack('old', 'legacy', '', { courseName: 'Old class', fileName: 'Legacy.ppt' }),
    pack('other', 'b', at(2026, 8)),
    newest, newest,
  ];
  const result = buildStudyMaterialHistory(decks, classes);

  assert.equal(result.classCount, 3);
  assert.equal(result.materialCount, 4);
  assert.equal(result.semesters[0].packCount, 2);
  assert.deepEqual(result.semesters[0].classes.map(group => [group.id, group.name]), [['class:a', 'Biology'], ['class:b', 'Biology']]);
  assert.deepEqual(result.semesters[0].classes[0].packs[0].filenames, duplicates);
  assert.equal(result.semesters[1].label, 'Unknown date');
  assert.equal(result.semesters[1].classes[0].name, 'Old class');
  assert.deepEqual(result.semesters[1].classes[0].packs[0].filenames, ['Legacy.ppt']);
});

test('sample-only libraries do not contribute to the daily check-in', () => {
  const result = buildStudyMaterialHistory(
    [pack('sample', 'demo', at(2026, 9), { fileType: 'demo' })],
    [course('demo', 'Sample')],
  );
  assert.deepEqual(result, { semesters: [], classCount: 0, materialCount: 0 });
});
