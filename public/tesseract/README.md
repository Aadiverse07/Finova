# Self-hosted Tesseract assets

Finova loads OCR assets from this directory instead of a runtime CDN.

The checked-in language data (`eng.traineddata.gz`, `hin.traineddata.gz`) is official Tesseract language data available in the build environment. The JavaScript worker/WASM core are never fabricated when their package files are unavailable.

After `npm install`, run `node scripts/fetch-tesseract-assets.mjs` to copy the matching worker/core files from installed packages into this directory. The scanner uses the local browser assets first and a server-side Tesseract fallback when browser OCR cannot start.
