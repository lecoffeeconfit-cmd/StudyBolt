# StudyBolt class icon library review

## Before the upgrade

Library was the entry point for creating a class. The form offered 16 illustrated subjects in a horizontal strip, an automatic icon matched to the class name, and 18 color shades. Class details showed creation and study progress information. There was no class appearance editor.

Class records stored a stable ID, name, emoji, color, and creation date. `SubjectIcon` drew the illustrations with the existing vector components. It recognized older emoji aliases and fell back to a subject match when it did not recognize a value. Library used the saved color on class cards. Planner and Stats used subject artwork, and Home’s learning-plan selector displayed class names. Study Packs kept their own saved course and artwork fields.

## Design and scope

- Library keeps the create action in the same place. Open any class’s details and choose **Edit class appearance** to change its icon or color. Empty classes have the same edit entry point.
- The picker has 128 icons in ten academic and personal categories. It uses the MaterialCommunityIcons font already shipped by StudyBolt, alongside all 16 original illustrations. Course names suggest icons locally. Search covers names and keywords across categories. Six recently saved choices appear under **Recently used**. A live preview and a separate save action make changes reversible until confirmed.
- **Settings → Appearance → Class cards** offers **Icon + name** by default and **Name only** with a color accent. It applies to Library class cards and details, the Home learning-plan class selector, Planner’s class chooser, and Stats class summaries. Pack controls, Community artwork, and the rest of the interface keep their own icons. Home’s recent packs and Planner’s pack chooser show the selected class icon when one exists.
- Saved classes use an optional `iconId` in the existing library item. A missing or unsupported ID uses the original subject renderer and saved emoji. Editing writes the icon and color only, preserves class order and assignments, and keeps the existing class ID. The same library sync path carries the new field for accounts. The presentation preference and recent choices are local to the current workspace on each device. No database migration is needed.

## Product review

The visual hierarchy keeps the class name and study information prominent in both styles. Recognition comes from a compact color tile or accent. Editing happens in the Library, so study flows and onboarding preserve their current focus. Recommendations make it possible to choose an icon without browsing the full collection. Grids adapt to available width and text scale, and the selection indicator uses both a checkmark and an accessible checked state. The implementation adds no image assets or font downloads.

Native screen reader flow and real device scroll performance remain the main quality checks before assigning a 9.5/10 design score. A short, consented usability study could measure picker completion and time to find a class. If an experiment is worthwhile, compare aggregate customization and return-to-study rates with existing aggregate study activity, without collecting class names or icon search queries. Retention impact has not been measured.

## Verification

- All 255 Node tests passed, including eight new checks for the catalog, search and recommendations, old icon fallbacks, library sync payloads, recent choices, responsive grid sizes, and glyph contrast across Light, Comfort Dark, Warm Night, and all 12 Neon palettes.
- Chrome at 320 × 568 and 430 × 932 CSS pixels verified creation, editing, keeping the current icon, category selection, search, recently used choices, a long class name, saving, and reloading. Browser checks also covered the selected radio state in the accessibility tree and picker scrolling and footer visibility with increased browser text. The browser run used synthetic local data.
- The minified web JavaScript grew by about 23.5 KB (8.2 KB gzip, approximately 0.6%). Both web exports contained the same 20 assets. The iOS Expo bundle also exported successfully.
