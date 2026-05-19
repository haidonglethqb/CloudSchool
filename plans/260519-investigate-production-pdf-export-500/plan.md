# Production PDF Export 500

**Date**: 2026-05-19
**Type**: Bug Fix
**Priority**: Critical
**Status**: Ready for execution

## Executive Summary
Production `/api/export/students?format=pdf` still returns `500` with `application/json` and `content-length: 76`. The current workspace code in `backend/src/routes/export.routes.js` already buffers PDF generation, writes buffered footers, and wraps PDF failures as `PDF_EXPORT_FAILED`. Local synthetic reproduction succeeds and the local backend Docker image contains the required fonts. Because `76` bytes matches the generic `INTERNAL_ERROR` payload from `backend/src/middleware/errorHandler.js`, the next agent must first prove stale deployment vs live runtime bug before making more application changes.

## Current Findings
- `sendPDF` now renders into a buffer and sends headers only on success.
- Footer rendering was moved off the `pageAdded` flow and onto `bufferPages`.
- Local reproduction returns a real PDF buffer starting with `%PDF-` at roughly `32 KB`.
- Local backend image contains `/app/src/assets/fonts/NotoSans-Regular.ttf` and `NotoSans-Bold.ttf`.
- Production `content-length: 76` matches generic `INTERNAL_ERROR`, not `PDF_EXPORT_FAILED`.
- Deploy flow uses GHCR images tagged with `${github.sha}` and writes `IMAGE_TAG=${github.sha}` on the VPS.

## Falsifiable Hypotheses
1. **Stale deployment**
   Prediction: the running backend container does not contain the latest `PDF_EXPORT_FAILED` and buffered-PDF code.
2. **Runtime bug before current `sendPDF` catch**
   Prediction: the running container is current, but the exact request fails before the current PDF wrapper path emits `PDF_EXPORT_FAILED`.
3. **Production-only data or env edge case**
   Prediction: the latest code is deployed, but a prod-only input or environment condition triggers a failure stage not covered by local synthetic reproduction.

## Execution Order
1. [phase-01-distinguish-stale-deploy-from-runtime-bug.md](./phase-01-distinguish-stale-deploy-from-runtime-bug.md)
2. [phase-02-add-targeted-export-diagnostics.md](./phase-02-add-targeted-export-diagnostics.md)
3. [phase-03-validate-fix-and-clean-up.md](./phase-03-validate-fix-and-clean-up.md)

## Likely Files To Touch
- `backend/src/routes/export.routes.js`
- `backend/src/middleware/errorHandler.js`
- `tests/api/export.spec.ts` or a focused existing API test file
- `.github/workflows/deploy.yml` only if image-tag drift is confirmed

## Success Criteria
- Production export returns `200` with `Content-Type: application/pdf`.
- Response body starts with `%PDF-` and is materially larger than the current `76` bytes.
- The failing stage is identified with log evidence before the final fix is merged.
- Focused regression coverage exists for at least one `/api/export/*?format=pdf` success path.

## Docs Impact
- None if the final fix is internal and diagnostics are temporary.
- Update backend system docs only if persistent export behavior or error semantics change.
- Update deployment docs only if the root cause is image-tag or rollout drift.

## TODO Checklist
- [ ] Prove stale deployment vs live runtime bug.
- [ ] Reproduce the exact failing request with timestamp correlation.
- [ ] Add temporary env-gated diagnostics only if the deployed code is current.
- [ ] Implement the narrow fix for the confirmed failing stage.
- [ ] Add focused PDF export regression coverage.
- [ ] Validate locally, in Docker, and remotely.
- [ ] Remove or disable temporary diagnostics after verification.