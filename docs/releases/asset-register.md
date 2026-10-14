# Asset register
- Interface styling: original TeamTrack implementation; no third-party component code copied.
- Pip companion (`src/components/companion-model.tsx`): original procedural Three.js model built from primitive geometry at runtime. No downloaded model, texture or external request. Static CSS fallback when WebGL is unavailable; motion stops under prefers-reduced-motion.
- three.js 0.186 (and RoundedBoxGeometry from its examples): MIT license, retained in the npm package.
- Manrope variable font: Google Fonts / Manrope, SIL Open Font License 1.1. Local font and license in public/fonts/. Source: https://github.com/google/fonts/tree/main/ofl/manrope .
- Icons: lucide-react package, ISC license, package license retained by dependency distribution.
- Uiverse and 21st: visual discovery/reference only (2026-10-13: 21st.dev dashboard components for the bento stat tile, segmented tabs and activity feed; Uiverse buttons for the pressed 3D button). Styles were written from scratch; no copied components or downloaded models require additional attribution.
