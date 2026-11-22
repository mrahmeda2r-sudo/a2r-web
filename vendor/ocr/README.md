# Local OCR runtime

Tesseract.js 6.0.1, Tesseract.js-core 6.1.2, and English traineddata (4.0.0_best_int).

All seven runtime files must retain the exact filenames in this folder. They are optional to the basic application's offline installation and are cached separately only when the user requests OCR setup. No receipt image is sent to an OCR server.

The four .wasm.js files include their WebAssembly code. Do not replace them with plain .wasm files or remove variants based only on the browser used for testing. The worker chooses the supported variant.

Preserve the five license/notice files next to the runtime files. Original Tesseract.js project: https://github.com/naptha/tesseract.js
