import assert from 'node:assert/strict';
import test from 'node:test';
import { isThemePreference, nextThemePreference, resolveColors, seasonalThemeCheckDelay, themeTogglePresentation } from '../src/theme.ts';

function luminance(hex) {
  const linear = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}

for (const mode of ['light', 'dark', 'warmNight']) {
  test(`${mode} shared text and control colors meet normal-text AA contrast on their intended surfaces`, () => {
    const colors = resolveColors(mode, null);
    assert.equal(colors.neon, undefined);
    const pairs = [
      ['text', 'background'], ['textSecondary', 'card'], ['textMuted', 'cardStrong'],
      ['primary', 'primarySoft'], ['primaryText', 'primary'], ['mint', 'mintSoft'],
      ['purple', 'purpleSoft'], ['goldText', 'goldSoft'], ['danger', 'card'], ['warning', 'card'],
      ['primaryText', 'purple'], ['primaryText', 'mint'], ['primaryText', 'danger'], ['onGold', 'goldBright'],
      ['textSecondary', 'tabBar'], ['primary', 'tabBar'], ['textMuted', 'primarySoft'],
    ];
    for (const [foreground, background] of pairs) {
      const ratio = contrast(colors[foreground], colors[background]);
      assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)}:1`);
    }
    for (const surface of colors.night?.hero ?? []) {
      assert.ok(contrast(colors.text, surface) >= 4.5);
      assert.ok(contrast(colors.textSecondary, surface) >= 4.5);
    }
  });
}

const seasons = [
  'Winter Frost', "Valentine's", 'Emerald', 'Spring Bloom', 'Spring Glow', 'Summer Solstice',
  'Fireworks', 'Electric Summer', 'Autumn', 'Halloween', 'Harvest', 'Holiday Lights',
];

test('the shortcut advances from the visible System appearance and one step per press without a timing window', () => {
  for (const system of ['light', 'dark', null]) {
    let current = 'light';
    for (let cycle = 0; cycle < 40; cycle += 1) {
      for (const next of ['dark', 'warmNight', 'neon', 'light']) {
        current = nextThemePreference(current, system);
        assert.equal(current, next);
      }
    }
    assert.equal(nextThemePreference('system', system), system === 'dark' ? 'warmNight' : 'dark');
    assert.equal(resolveColors('system', system), resolveColors(system ?? 'light', system));
  }
});

test('appearance metadata names the active and upcoming mode with four distinct icons', () => {
  assert.deepEqual(themeTogglePresentation('light', 'dark'), { icon: 'weather-sunny', label: 'Appearance: Light. Next: Comfort Dark.' });
  assert.deepEqual(themeTogglePresentation('dark', 'light'), { icon: 'moon-waning-crescent', label: 'Appearance: Comfort Dark. Next: Warm Night.' });
  assert.deepEqual(themeTogglePresentation('warmNight', 'light'), { icon: 'weather-night', label: 'Appearance: Warm Night. Next: Neon Mode.' });
  assert.deepEqual(themeTogglePresentation('neon', 'light'), { icon: 'creation', label: 'Appearance: Neon Mode. Next: Light.' });
  assert.equal(themeTogglePresentation('system', 'dark').label, 'Appearance: Comfort Dark (System). Next: Warm Night.');
  assert.equal(themeTogglePresentation('system', 'light').label, 'Appearance: Light (System). Next: Comfort Dark.');
});

test('saved appearance validation retains all existing values and accepts Warm Night', () => {
  for (const stored of ['system', 'light', 'dark', 'warmNight', 'neon']) assert.equal(isThemePreference(stored), true);
  for (const invalid of [null, undefined, 1, 'Dark', '', {}]) assert.equal(isThemePreference(invalid), false);
  assert.equal(resolveColors('neon', 'light', -1).neon.name, 'Winter Frost');
});

test('Increase Contrast strengthens boundaries and secondary type while preserving the displayed appearance', () => {
  const presets = ['light', 'dark', 'warmNight'].map(mode => [mode, undefined])
    .concat(seasons.map((_, month) => ['neon', month]));
  for (const [mode, month] of presets) {
    const normal = resolveColors(mode, null, month);
    const stronger = resolveColors(mode, null, month, true);
    assert.equal(stronger.background, normal.background);
    assert.equal(stronger.primary, normal.primary);
    assert.equal(stronger.neon?.name, normal.neon?.name);
    assert.ok(contrast(stronger.textMuted, stronger.card) > contrast(normal.textMuted, normal.card), mode);
    for (const surface of [stronger.background, stronger.card, stronger.cardStrong, stronger.tabBar]) {
      assert.ok(contrast(stronger.border, surface) >= 3, `${mode} outline on ${surface}`);
    }
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
    primaryAccents.add(colors.neon.season.primary);
    assert.deepEqual(colors.neon.indicator, january.neon.indicator);
    assert.notDeepEqual(colors.neon.hero, colors.neon.action);
    for (const role of ['background', 'backgroundRaised', 'card', 'cardStrong', 'tabBar', 'primary', 'mint', 'warning', 'danger']) {
      assert.equal(colors[role], january[role]);
    }
  });
  assert.equal(primaryAccents.size, 12);
  assert.equal(resolveColors('neon', null).neon.name, seasons[new Date().getMonth()]);
});

test('every navigation tab has a distinct accent that shifts with the existing calendar', () => {
  const palettes = seasons.map((_, month) => resolveColors('neon', null, month).neon.navigation);
  const tabs = ['home', 'library', 'planner', 'stats', 'profile', 'discover'];
  for (const tab of tabs) {
    assert.equal(new Set(palettes.map(({ tabs }) => tabs[tab].active)).size, seasons.length, tab);
    assert.equal(new Set(palettes.map(({ tabs }) => tabs[tab].inactive)).size, seasons.length, tab);
  }
  for (const palette of palettes) {
    for (const state of ['active', 'inactive']) {
      assert.equal(new Set(tabs.map(tab => palette.tabs[tab][state])).size, tabs.length);
    }
  }
  assert.equal(new Set(palettes.map(({ rim }) => rim.join())).size, seasons.length);
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
    surfaces.push(colors.neon.secondarySoft, ...colors.neon.hero);
    const textPairs = surfaces.flatMap(background => [colors.text, colors.textSecondary, colors.textMuted, colors.primary].map(foreground => [foreground, background]));
    textPairs.push(
      [colors.primaryText, colors.primary], [colors.primaryText, colors.purple],
      [colors.primaryText, colors.mint], [colors.primaryText, colors.danger],
      [colors.mint, colors.mintSoft], [colors.purple, colors.purpleSoft],
      [colors.onGold, colors.goldBright], [colors.goldText, colors.goldSoft],
      [colors.goldBright, colors.primarySoft], [colors.danger, colors.card],
      [colors.warning, colors.card], [colors.neon.progressFill, colors.card],
      [colors.neon.focus, colors.cardStrong], [colors.neon.indicator.icon, colors.neon.indicator.surface],
      ...colors.neon.action.map(background => [colors.primaryText, background]),
      ...colors.neon.hero.map(background => [colors.neon.season.primary, background]),
    );
    for (const [foreground, background] of textPairs) {
      const ratio = contrast(foreground, background);
      assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
    }
    for (const fill of [colors.neon.progressFill, colors.neon.progressEnd, colors.neon.chart, colors.neon.season.highlight, colors.mint, colors.danger, colors.purple, colors.warning, colors.gold]) {
      assert.ok(contrast(fill, colors.neon.progressTrack) >= 3, `${fill} on the progress track`);
    }
    assert.ok(contrast(colors.neon.glow, colors.primarySoft) >= 3, 'Seasonal icon on the soft accent surface');
  });
  test(`${name} Neon labels stay readable and selection stands out across the navigation surfaces`, () => {
    const colors = resolveColors('neon', null, month);
    const { navigation } = colors.neon;
    for (const [tab, palette] of Object.entries(navigation.tabs)) {
      for (const surface of [...navigation.surface, colors.cardStrong]) {
        assert.ok(contrast(palette.inactive, surface) >= 4.5, `${tab} label on ${surface}`);
      }
      for (const surface of [...navigation.surface, ...palette.selection]) {
        assert.ok(contrast(palette.active, surface) >= 4.5, `${tab} active label or focus outline on ${surface}`);
      }
      assert.ok(luminance(palette.active) > luminance(palette.inactive), `${tab} active icon is brighter`);
    }
  });
}
