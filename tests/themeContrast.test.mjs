import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveColors } from '../src/theme.ts';

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
