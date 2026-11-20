import assert from 'node:assert/strict';
import test from 'node:test';
import { nextThemePreference, resolveColors, seasonalThemeCheckDelay } from '../src/theme.ts';

function luminance(hex) {
  const linear = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}

for (const mode of ['light', 'dark']) {
  test(`${mode} shared text and control colors meet normal-text AA contrast on their intended surfaces`, () => {
    const colors = resolveColors(mode, mode);
    const pairs = [
      ['text', 'background'], ['textSecondary', 'card'], ['textMuted', 'cardStrong'],
      ['primary', 'primarySoft'], ['primaryText', 'primary'], ['mint', 'mintSoft'],
      ['purple', 'purpleSoft'], ['goldText', 'goldSoft'], ['danger', 'card'], ['warning', 'card'],
    ];
    for (const [foreground, background] of pairs) {
      const ratio = contrast(colors[foreground], colors[background]);
      assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)}:1`);
    }
  });
}

const seasons = [
  'Winter Frost', "Valentine's", 'Emerald', 'Spring Bloom', 'Spring Glow', 'Summer Solstice',
  'Fireworks', 'Electric Summer', 'Autumn', 'Halloween', 'Harvest', 'Holiday Lights',
];

test('the shortcut cycles Light, Dark, Neon, and Light, starting from the visible system scheme', () => {
  for (const system of ['light', 'dark', null]) {
    assert.equal(nextThemePreference('light', system), 'dark');
    assert.equal(nextThemePreference('dark', system), 'neon');
    assert.equal(nextThemePreference('neon', system), 'light');
    assert.equal(nextThemePreference('system', system), system === 'dark' ? 'neon' : 'dark');
    assert.equal(resolveColors('system', system), resolveColors(system ?? 'light', system));
  }
});

test('all months get distinct seasonal accents on one dark foundation, regardless of system preference', () => {
  const january = resolveColors('neon', 'light', 0);
  const primaryAccents = new Set();
  seasons.forEach((name, month) => {
    const colors = resolveColors('neon', 'light', month);
    assert.equal(colors, resolveColors('neon', 'dark', month));
    assert.equal(colors.mode, 'dark');
    assert.equal(colors.neon.name, name);
    primaryAccents.add(colors.primary);
    for (const role of ['background', 'backgroundRaised', 'card', 'cardStrong', 'tabBar', 'mint', 'warning', 'danger']) {
      assert.equal(colors[role], january[role]);
    }
  });
  assert.equal(primaryAccents.size, 12);
  assert.equal(resolveColors('neon', null).neon.name, seasons[new Date().getMonth()]);
});

test('the month check hits local midnight across New Year and bounds foreground clock checks', () => {
  const before = new Date(2026, 11, 31, 23, 59, 59, 850);
  assert.equal(resolveColors('neon', null, before.getMonth()).neon.name, 'Holiday Lights');
  assert.equal(seasonalThemeCheckDelay(before), 150);
  const after = new Date(before.getTime() + seasonalThemeCheckDelay(before));
  assert.equal(after.getFullYear(), 2027);
  assert.equal(after.getHours(), 0);
  assert.equal(resolveColors('neon', null, after.getMonth()).neon.name, 'Winter Frost');
  assert.equal(seasonalThemeCheckDelay(after), 60_000);
});

for (const [month, name] of seasons.entries()) {
  test(`${name} Neon text, feedback, and progress colors meet contrast requirements`, () => {
    const colors = resolveColors('neon', null, month);
    const surfaces = ['background', 'backgroundRaised', 'card', 'cardStrong', 'primarySoft', 'tabBar'].map(role => colors[role]);
    surfaces.push(colors.neon.secondarySoft);
    const textPairs = surfaces.flatMap(background => [colors.text, colors.textSecondary, colors.textMuted, colors.primary].map(foreground => [foreground, background]));
    textPairs.push(
      [colors.primaryText, colors.primary], [colors.primaryText, colors.purple],
      [colors.primaryText, colors.mint], [colors.primaryText, colors.danger],
      [colors.mint, colors.mintSoft], [colors.purple, colors.purpleSoft],
      [colors.onGold, colors.goldBright], [colors.goldText, colors.goldSoft],
      [colors.goldBright, colors.primarySoft], [colors.danger, colors.card],
      [colors.warning, colors.card], [colors.neon.progressFill, colors.card],
    );
    for (const [foreground, background] of textPairs) {
      const ratio = contrast(foreground, background);
      assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
    }
    for (const fill of [colors.neon.progressFill, colors.mint, colors.danger, colors.purple, colors.warning, colors.gold]) {
      assert.ok(contrast(fill, colors.neon.progressTrack) >= 3, `${fill} on the progress track`);
    }
    assert.ok(contrast(colors.neon.glow, colors.primarySoft) >= 3, 'Seasonal icon on the soft accent surface');
  });
}
