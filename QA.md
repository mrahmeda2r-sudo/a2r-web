# Stage A verification, 22 November 2026

## Passed before handoff

- 78 image-processing assertions, including matching the Q7 Dart selector and all three filter outputs byte for byte on five deterministic raw-pixel fixtures.
- 32 browser checks in Chromium: service-worker cache readiness, photo import through the capture file chooser, full-image default, manual crop coordinates, full-image reset, rotation, each filter choice, JPG creation/download, single-page PDF creation, prepared-file invalidation after a metadata change, local draft restoration/deletion, and offline restoration plus PDF generation after reload.
- File-share API requests verified using a simulated operating-system share handler for JPG and PDF. Unsupported-file-sharing fallback exercised.
- No uncaught browser errors in those checks.
- Layout checked at 320, 390 and 1280 CSS-pixel widths, with no horizontal overflow.
- Actual rendered screenshot inspection of the Arabic interface and a generated PDF from a supplied receipt photo. The PDF contained the full source extent with the employee/unit strip above, outside the receipt. Test labels were placeholders.

## Still requires the owner's phone

- Actual hardware camera handoff and image format/orientation on Android and iPhone.
- Safari/Home Screen app behavior on an actual iPhone. Chromium's mobile-size testing is not an iPhone hardware test.
- The real native WhatsApp share target. A simulated share handler cannot prove transport or delivery.
- Whether WhatsApp accepts the JPG as a photo on that device; HD must be selected inside WhatsApp when available. PDF must arrive as a document. Never infer message delivery just because the share sheet opened.
- Runtime/memory on high-resolution phone images and long receipts. No phone speed claim is made.
- The final HTTPS host, its MIME/cache configuration, subdirectory URL if any, and a fresh offline-readiness check on that deployed origin.

## Owner acceptance sequence

1. Open the actual hosted HTTPS link on the owner's Android first. Wait for offline readiness.
2. Capture a new receipt with all edges visible. Review handwriting and small digits using the original-detail link.
3. Drag each crop corner, use Picture All to restore the full image, rotate, and compare all three filters.
4. Enter test employee/unit text, prepare JPG, save/share through WhatsApp as a photo, and confirm the actual received copy. Select HD where offered.
5. Prepare the one-page PDF, share as document, download it at the receiver, and verify the strip does not cover content and the whole receipt is present.
6. Disable internet, reload the cached application, restore the draft and generate the PDF. Reconnect before sending WhatsApp.
7. Export all test files before clearing the draft. Only after this passes should the two employees test on their iPhones.

No receipt test photo, generated receipt file, private employee roster, account credential or analytics is included in the distributable site folder. The stage is intentionally limited to one photo, not a finished multi-receipt replacement.
