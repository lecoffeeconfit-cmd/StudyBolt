const fs = require('node:fs');
const path = require('node:path');
const { withAppDelegate, withDangerousMod } = require('@expo/config-plugins');
const artwork = require('../src/config/launchArtwork.json');

// Static UIKit launch storyboards cannot use runtime corner-radius attributes.
// Tiny vector corner covers match the React crop without editing the source image.
function cornerCoverSvg(background) {
  const { width: w, height: h, radius: r } = artwork;
  const rounded = `M${r} 0H${w-r}A${r} ${r} 0 0 1 ${w} ${r}V${h-r}A${r} ${r} 0 0 1 ${w-r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h-r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${artwork.displayWidth}" height="${artwork.displayWidth*h/w}" viewBox="0 0 ${w} ${h}"><path fill="${background}" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z ${rounded}"/></svg>\n`;
}

const CUSTOMIZATION = `  // StudyBolt static native-to-React launch handoff (no splash timer).
  override func customize(_ rootView: UIView) {
    super.customize(rootView)
    rootView.backgroundColor = UIColor(named: "StudyBoltLaunchBackground")
    guard let launchView = UIStoryboard(name: "SplashScreen", bundle: nil).instantiateInitialViewController()?.view else { return }
    launchView.frame = rootView.bounds
    launchView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    if let surface = rootView as? RCTSurfaceHostingProxyRootView {
      surface.loadingView = launchView
    } else if let legacy = rootView as? RCTRootView {
      legacy.loadingViewFadeDelay = 0
      legacy.loadingViewFadeDuration = 0
      legacy.loadingView = launchView
    }
  }
`;

function customizeDelegate(contents) {
  if (contents.includes('// StudyBolt static native-to-React launch handoff')) return contents;
  const anchor = '  // Extension point for config-plugins';
  if (!contents.includes(anchor) || /override func customize\(/.test(contents)) {
    throw new Error('StudyBolt launch configuration requires review of the existing ReactNativeDelegate customization.');
  }
  return contents.replace(anchor, `${anchor}\n\n${CUSTOMIZATION}`);
}

async function writeLaunchAssets(projectRoot, nativeRoot, projectName) {
  const appRoot = path.join(nativeRoot, projectName);
  const catalog = path.join(appRoot, 'Images.xcassets');
  const imageSet = path.join(catalog, 'StudyBoltLaunchLogo.imageset');
  const colorSet = path.join(catalog, 'StudyBoltLaunchBackground.colorset');
  const corners = path.join(catalog, 'StudyBoltLaunchCorners.imageset');
  fs.mkdirSync(imageSet, { recursive: true });
  fs.mkdirSync(colorSet, { recursive: true });
  fs.mkdirSync(corners, { recursive: true });
  // A byte-for-byte native resource copy, never an alteration of the approved icon.
  fs.copyFileSync(path.join(projectRoot, 'assets/icon.png'), path.join(imageSet, 'StudyBoltLogo.png'));
  fs.writeFileSync(path.join(imageSet, 'Contents.json'), JSON.stringify({ images: [{ filename: 'StudyBoltLogo.png', idiom: 'universal' }], info: { version: 1, author: 'xcode' } }, null, 2) + '\n');
  fs.writeFileSync(path.join(colorSet, 'Contents.json'), JSON.stringify({ colors: [
    { idiom: 'universal', color: { 'color-space': 'srgb', components: { red: '0.968627451', green: '0.976470588', blue: '0.992156863', alpha: '1.000' } } },
    { idiom: 'universal', appearances: [{ appearance: 'luminosity', value: 'dark' }], color: { 'color-space': 'srgb', components: { red: '0.054901961', green: '0.070588235', blue: '0.090196078', alpha: '1.000' } } },
  ], info: { version: 1, author: 'xcode' } }, null, 2) + '\n');
  fs.writeFileSync(path.join(corners, 'corners-light.svg'), cornerCoverSvg('#F7F9FD'));
  fs.writeFileSync(path.join(corners, 'corners-dark.svg'), cornerCoverSvg('#0E1217'));
  fs.writeFileSync(path.join(corners, 'Contents.json'), JSON.stringify({ images: [
    { filename: 'corners-light.svg', idiom: 'universal' },
    { filename: 'corners-dark.svg', idiom: 'universal', appearances: [{ appearance: 'luminosity', value: 'dark' }] },
  ], info: { version: 1, author: 'xcode' } }, null, 2) + '\n');
  const scale = artwork.displayWidth / artwork.width;
  let storyboard = fs.readFileSync(path.join(__dirname, 'launch/SplashScreen.storyboard'), 'utf8');
  const tokens = { WIDTH: artwork.displayWidth, HEIGHT: artwork.height * scale, IMAGE_SIZE: artwork.sourceWidth * scale, OFFSET_X: -artwork.x * scale, OFFSET_Y: -artwork.y * scale, FRAME_Y: (852 - artwork.height * scale) / 2 };
  for (const [name, value] of Object.entries(tokens)) storyboard = storyboard.replaceAll(`__${name}__`, String(value));
  fs.writeFileSync(path.join(appRoot, 'SplashScreen.storyboard'), storyboard);
}

module.exports = function withStudyBoltLaunchScreen(config) {
  config = withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') throw new Error('StudyBolt launch customization expects the existing Swift AppDelegate.');
    mod.modResults.contents = customizeDelegate(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, ['ios', async (mod) => {
    await writeLaunchAssets(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot, mod.modRequest.projectName);
    return mod;
  }]);
};
module.exports.customizeDelegate = customizeDelegate;
module.exports.writeLaunchAssets = writeLaunchAssets;
module.exports.cornerCoverSvg = cornerCoverSvg;
