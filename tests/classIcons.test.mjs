import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { CLASS_ICONS, CLASS_ICON_CATEGORIES, classIconColors, classIconColumns, getClassIcon, recommendClassIcons, recordClassIconUse, searchClassIcons } from '../src/data/classIcons.ts';
import { getSubjectIcon, SUBJECT_ICONS } from '../src/data/subjectIcons.ts';
import { localLibraryItems, mergeLibraryItems, updateClassAppearance } from '../src/services/libraryData.ts';
import { resolveColors } from '../src/theme.ts';

test('the library offers 100–150 distinct choices using available artwork in every category', () => {
  const glyphs = JSON.parse(readFileSync(new URL('../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json', import.meta.url)));
  assert.ok(CLASS_ICONS.length >= 100 && CLASS_ICONS.length <= 150);
  assert.equal(new Set(CLASS_ICONS.map(icon => icon.id)).size, CLASS_ICONS.length);
  assert.equal(CLASS_ICON_CATEGORIES.length, 10);
  for (const category of CLASS_ICON_CATEGORIES) {
    assert.ok(CLASS_ICONS.filter(icon => icon.category === category.id).length >= 10, category.label);
  }
  for (const icon of CLASS_ICONS) {
    if ('glyph' in icon) assert.ok(glyphs[icon.glyph], icon.glyph);
    else assert.ok(SUBJECT_ICONS.some(illustration => illustration.id === icon.illustration), icon.id);
  }
});

test('search handles keywords, prefixes, multiple words and accented input', () => {
  assert.equal(searchClassIcons('  fínance  ')[0].id, 'chart-line');
  assert.ok(searchClassIcons('computer softw').some(icon => icon.id === 'code-tags'));
  assert.equal(searchClassIcons('Japanese characters')[0].id, 'ideogram-cjk-variant');
  assert.deepEqual(searchClassIcons('xyzzy nonexistent'), []);
});

test('local recommendations cover course names and compact course codes', () => {
  const ids = name => recommendClassIcons(name).map(icon => icon.id);
  assert.ok(ids('BIO101').includes('dna'));
  assert.ok(ids('Biology 201').includes('microscope'));
  assert.ok(ids('PSYCH-101').includes('brain'));
  assert.ok(ids('Introduction to Computer Science').includes('code-tags'));
  assert.ok(ids('Mathematics').includes('calculator-variant-outline'));
  assert.ok(ids('Finance for Managers').includes('chart-line'));
  assert.ok(ids('English Literature').includes('book-open-page-variant-outline'));
  assert.ok(ids('Medicine').includes('stethoscope'));
  assert.equal(ids('Untitled')[0], 'school-outline');
});

test('legacy emoji chooses its existing illustration and unknown values retain the existing fallback', () => {
  assert.equal(getSubjectIcon('History', '🧬').id, 'biology');
  assert.equal(getSubjectIcon('History', '🧪').id, 'chemistry');
  assert.equal(getSubjectIcon('History', '🧩').id, 'history');
  assert.equal(getSubjectIcon('Untitled', '🧩').id, 'general');
  assert.equal(getClassIcon('unknown-future-id'), undefined);
  assert.equal(getSubjectIcon('Biology', '🌱', 'history').id, 'history');
});

test('appearance edits preserve identifiers, class order, legacy icon and unchanged classes through library sync', () => {
  const original = { id: 'a', name: 'Biology', emoji: '🧬', color: '#176B5A', createdAt: '2026-01-01T00:00:00Z' };
  const other = { ...original, id: 'b', name: 'Chemistry' };
  const initial = { classes: [other, original], decks: [] };
  const appearance = { iconId: 'microscope', color: '#2863C7' };
  const classes = updateClassAppearance(initial.classes, original, appearance);
  assert.equal(classes[0], other);
  assert.deepEqual(classes[1], { ...original, ...appearance, libraryModifiedAt: classes[1].libraryModifiedAt });
  assert.ok(Date.parse(classes[1].libraryModifiedAt) > Date.parse(original.createdAt));
  assert.equal(updateClassAppearance(classes, original, appearance), classes);
  const items = JSON.parse(JSON.stringify(localLibraryItems({ ...initial, classes }, new Set())));
  const synced = mergeLibraryItems(initial, items);
  assert.equal(synced.classes[1].iconId, 'microscope');
  assert.equal(synced.classes[1].emoji, '🧬');
  assert.equal(synced.classes[1].color, '#2863C7');
  assert.equal(items[0].content.iconId, undefined);
});

test('recent selections are unique, bounded and ordered most recent first', () => {
  const previous = ['dna', 'dna', 'unknown', 'microscope', 'laptop', 'brain', 'bone', 'orbit'];
  assert.deepEqual(recordClassIconUse(previous, 'laptop'), ['laptop', 'dna', 'microscope', 'brain', 'bone', 'orbit']);
});

test('icon grid reduces the column count for small viewports and large text', () => {
  assert.equal(classIconColumns(284, 1), 3);
  assert.equal(classIconColumns(284, 2), 1);
  assert.equal(classIconColumns(394, 1), 4);
  assert.equal(classIconColumns(394, 2), 2);
});

function luminance(hex) {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test('glyphs maintain 3:1 contrast across app themes, months, and pale and dark saved colors', () => {
  const modes = ['light', 'dark', 'warmNight'].map(mode => [mode, 0]);
  for (let month = 0; month < 12; month++) modes.push(['neon', month]);
  for (const [mode, month] of modes) {
    const colors = resolveColors(mode, null, month);
    for (const icon of CLASS_ICONS.filter(option => 'glyph' in option)) {
      for (const accent of [undefined, '#FFFFFF', '#000000', '#F3A633', '#176B5A', '#7D5CFF']) {
        const palette = classIconColors(icon, colors.mode, accent, colors.cardStrong);
        for (const surface of palette.surface) {
          const [low, high] = [luminance(palette.ink), luminance(surface)].sort((a, b) => a - b);
          assert.ok((high + 0.05) / (low + 0.05) >= 3, `${mode} ${icon.id} ${accent}`);
        }
      }
    }
  }
});
