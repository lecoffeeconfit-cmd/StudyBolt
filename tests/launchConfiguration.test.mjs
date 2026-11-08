import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { customizeDelegate, writeLaunchAssets } = require('../plugins/withStudyBoltLaunchScreen.js');

test('launch customization survives repeated prebuilds and preserves linking code', () => {
  const source = 'class ReactNativeDelegate {\n  // Extension point for config-plugins\n}\n// existing linking and startup code';
  const once = customizeDelegate(source);
  assert.equal(customizeDelegate(once), once);
  assert.equal(once.match(/override func customize\(/g)?.length, 1);
  assert.ok(once.endsWith('// existing linking and startup code'));
  assert.match(once, /super\.customize\(rootView\)/);
  assert.match(once, /RCTSurfaceHostingProxyRootView/);
  assert.match(once, /RCTRootView/);
});

test('an unrelated existing native customization is never overwritten', () => {
  assert.throws(() => customizeDelegate('  // Extension point for config-plugins\n override func customize(_ rootView: UIView) {}'), /requires review/);
  assert.throws(() => customizeDelegate('unrecognized native template'), /requires review/);
});

test('a clean native launch setup includes the exact artwork referenced by the storyboard', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studybolt-launch-'));
  try {
    await mkdir(path.join(root, 'assets'));
    const original = Buffer.from('unchanged approved artwork fixture');
    await writeFile(path.join(root, 'assets/icon.png'), original);
    await writeLaunchAssets(root, path.join(root, 'ios'), 'StudyBolt');
    const app = path.join(root, 'ios/StudyBolt');
    const storyboard = await readFile(path.join(app, 'SplashScreen.storyboard'), 'utf8');
    assert.doesNotMatch(storyboard, /__[A-Z_]+__/);
    assert.doesNotMatch(storyboard, /userDefinedRuntimeAttributes/);
    assert.match(storyboard, /clipsSubviews="YES"/);
    const name = storyboard.match(/image="([^"]+)"/)?.[1];
    assert.ok(name, 'native storyboard must name an image');
    const imageSet = path.join(app, 'Images.xcassets', name + '.imageset');
    const contents = JSON.parse(await readFile(path.join(imageSet, 'Contents.json'), 'utf8'));
    assert.deepEqual(await readFile(path.join(imageSet, contents.images[0].filename)), original);
    assert.deepEqual(await readFile(path.join(root, 'assets/icon.png')), original);
    const background = storyboard.match(/backgroundColor" name="([^"]+)"/)?.[1];
    const colors = JSON.parse(await readFile(path.join(app, 'Images.xcassets', background + '.colorset/Contents.json'), 'utf8'));
    assert.ok(colors.colors.some((color) => color.appearances?.some((appearance) => appearance.value === 'dark')));
    const corners = path.join(app, 'Images.xcassets/StudyBoltLaunchCorners.imageset');
    const coverSet = JSON.parse(await readFile(path.join(corners, 'Contents.json'), 'utf8'));
    for (const image of coverSet.images) {
      const svg = await readFile(path.join(corners, image.filename), 'utf8');
      assert.match(svg, /fill-rule="evenodd"/);
      assert.match(svg, /viewBox="0 0 1094 1070"/);
      assert.match(svg, image.appearances ? /#0E1217/ : /#F7F9FD/);
    }
    // Reapplying the launch-only resource writer must remain safe too.
    await writeLaunchAssets(root, path.join(root, 'ios'), 'StudyBolt');
    assert.deepEqual(await readFile(path.join(imageSet, contents.images[0].filename)), original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
