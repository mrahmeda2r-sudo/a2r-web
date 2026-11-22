# Stage B verification, 22 November 2026

## Automated checks passed

268 assertions in total: 123 browser checks and 145 processing/parser checks.

- 41 main browser checks: independent batch/receipts routes, contextual JPG-only batch action, manual whole-frame/free-corner crop controls, five filter choices, native-style tag, real OCR of one supplied bank closing slip (7 transactions, 2568.91), caption semantics, JPG filename/type, ordered receipt queue, reorder/delete/undo, one two-page PDF, image-share handoff, offline queue restore/PDF and no external image upload.
- 52 edge browser checks: manual corrections protected during and after OCR/reload; actual offline OCR after a new document and removal of the model database; late OCR rejected after replacement with a same-named image; cached crop background; tag controls; batch-output invalidation; all working screens at 320/390/1280 widths; direct unchanged-JPEG byte preservation; one-page receipt PDF through the receipt UI; share fallback; crop-preserving bulk filters; per-item metadata/reload; actual Stage A worker/draft migration; isolated, path-scoped Stage B storage; later Stage A edits do not overwrite Stage B; Stage A offline cache remains intact.
- 30 extras browser checks: real receipt OCR/search, normalized amount query including Arabic digits, cache reuse without another OCR call, no-match caution, cancellation/late-result protection, explicit sent-confirmation timing, per-item keep, added-unsent receipt protection, strict greater-than-12-hour boundaries, retained batch/receipt archive, removal of obsolete root image reference, archive download/two-tap deletion, and independent manual identity persistence after clearing drafts.
- 67 number/parser checks: Arabic/Persian digits, currency separators, safe integer piasters, invalid values, complete/partial/multiple physical closing slips, no double-summing repeated totals, and warnings.
- 78 image-core checks, including byte-for-byte agreement with the existing Dart automatic-selector/filter fixtures. The image core is unchanged.

Actual screenshots were inspected, including mobile-width batch send/crop/search/archive screens. Generated one-page and two-page PDF pages were rendered and inspected. Original receipt extent is preserved and the receipt identity strip is above, not covering, the image. Test names are placeholders. The supplied photo and generated test receipts are not in the site package.

## Important limits

- OS share handlers were simulated. No real WhatsApp send or delivery was performed by these tests.
- Chromium mobile-size testing is not iPhone/Safari or Android hardware testing.
- One batch sample OCR success is not a broad accuracy guarantee. Receipt search is best suited to printed digits and English text; absent OCR matches do not prove absence from the image.
- No measured phone speed, camera autofocus, battery or high-resolution memory guarantee. The first OCR setup is separate from opening the basic app.
- Cleanup happens on opening, only for explicitly confirmed-sent files older than 12 hours. Unsent files remain. Keep sends them to the local archive. Exported files, camera gallery and other app copies are not deleted.
- ID-card composition was removed at the user's request. The native Google scanner/camera UI is not included.
- This package has not been deployed. The final HTTPS origin and every hosted file still need a post-upload check.

## Owner acceptance sequence

1. Open the final uploaded URL on the owner's Android, wait for base offline readiness, and verify saved employee/unit/building.
2. Capture a new batch. Move/resize the whole crop frame and free corners, reset the rectangle, rotate and compare filters. Check small digits from the original.
3. Move the identity tag; review/correct all four batch fields. Send JPG plus caption through actual WhatsApp, confirm it arrives as a photo, select HD if offered, and inspect the received copy before pressing sent confirmation.
4. Add several receipt photos, edit/reorder/hide a tag, build PDF and verify every received page and page label. Test receipt photo sharing/fallback separately.
5. Search a printed receipt amount. Verify it against the image, then try a nonmatching query and clear the filter. PDF should still include the whole queue.
6. Prepare optional offline OCR. Disable network, reopen and restore work, read a batch and create receipt PDF. Reconnect for WhatsApp.
7. Mark a test file keep; confirm sent only after receiving it. Check the on-open 12-hour behavior with disposable test work, never with unsaved production receipts.
8. Close/reopen and check fields and queue again. Only after this passes should employees test their iPhones.
