# Phase 01: Distinguish Stale Deploy From Runtime Bug

## Context Links
- `backend/src/routes/export.routes.js`
- `backend/src/middleware/errorHandler.js`
- `.github/workflows/deploy.yml`
- `docs/system/deployment/docker-setup.md`

## Overview
Do not change application logic yet. First prove whether production is running stale backend code or whether the current code is deployed and still failing.

## Key Insights
- `content-length: 76` matches the generic production `INTERNAL_ERROR` JSON.
- The current workspace code should emit `PDF_EXPORT_FAILED` for PDF-generation failures.
- Local synthetic reproduction and local Docker checks already passed.

## Requirements
- Identify the expected backend SHA from the last deploy.
- Inspect the running backend container image tag and digest.
- Inspect the code inside the running container.
- Replay the exact failing request and capture headers, body, and timestamp.

## Related Files
- `backend/src/routes/export.routes.js`
- `backend/src/middleware/errorHandler.js`
- `.github/workflows/deploy.yml`

## Implementation Steps
1. Identify the expected deployed SHA from the last successful deploy workflow run.
2. On the VPS, inspect `.env` and confirm `IMAGE_TAG` matches that SHA.
3. Inspect the running backend container:
   - `docker inspect --format '{{.Config.Image}} {{.Image}}' cloudschool-backend`
   - `docker exec cloudschool-backend sh -lc "grep -n 'PDF_EXPORT_FAILED' /app/src/routes/export.routes.js /app/src/middleware/errorHandler.js || true"`
   - `docker exec cloudschool-backend sh -lc "grep -n 'bufferPages\|writePageFooters' /app/src/routes/export.routes.js || true"`
4. Replay the exact failing request with the real auth context and save headers/body separately.
5. If the container code is stale, redeploy latest backend image and repeat the same request before editing code.
6. If the container code is current and the response is still the generic `INTERNAL_ERROR`, continue to Phase 02.

## TODO List
- [ ] Confirm deploy SHA.
- [ ] Confirm VPS `IMAGE_TAG`.
- [ ] Confirm running container image and digest.
- [ ] Confirm `PDF_EXPORT_FAILED` code is or is not present in-container.
- [ ] Capture remote repro output with timestamp.
- [ ] Choose stale-deploy or runtime-bug branch.

## Success Criteria
- One branch is proven with evidence, not guesswork.
- The next agent can state whether redeploy alone should change the outcome.

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Inspecting the wrong container | High | Use the named running backend container and image digest checks |
| Curl reproduction misses auth context | Medium | Reuse the exact browser token/cookie pair already captured |
| Logs are too noisy for correlation | Medium | Record a precise UTC timestamp before replay |

## Security Considerations
- Do not paste secrets into repo files.
- Keep tokens/cookies only in terminal history or local secure notes.

## Next Steps
- If stale deploy: redeploy first, then rerun the same request.
- If current deploy: move to env-gated diagnostics in Phase 02.