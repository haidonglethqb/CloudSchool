# Phase 03: Validate Fix And Clean Up

## Context Links
- `backend/src/routes/export.routes.js`
- `backend/Dockerfile`
- `tests/helpers/api-client.ts`
- `.github/workflows/deploy.yml`

## Overview
Validate the confirmed fix locally, in Docker, and remotely. Add focused regression coverage for PDF export.

## Key Insights
- Local synthetic PDF generation already succeeds, so validation must include the exact route path and a production-like container.
- There is no obvious focused API coverage for `/api/export/*?format=pdf` today.

## Requirements
- Verify success at the route level, not just at helper level.
- Keep test scope focused on the touched slice.
- Remove or disable temporary diagnostics after confirmation.

## Related Files
- `backend/src/routes/export.routes.js`
- `backend/src/middleware/errorHandler.js`
- `tests/api/export.spec.ts` or another focused API test file

## Implementation Steps
1. Add focused API coverage for one PDF export success case.
2. If the final design keeps a specific export error code, add a failure-path assertion for that contract.
3. Validate locally:
   - route returns `200`
   - `Content-Type: application/pdf`
   - body starts with `%PDF-`
4. Validate in Docker:
   - build backend image
   - confirm fonts exist in-container
   - hit the same route against the containerized backend
5. Validate remotely with the exact failing request after redeploy.
6. Remove diagnostics or leave them gated and disabled.

## TODO List
- [ ] Add focused PDF export regression coverage.
- [ ] Validate route locally.
- [ ] Validate route in Docker.
- [ ] Validate the exact request remotely.
- [ ] Remove or disable diagnostics.
- [ ] Update docs only if persistent behavior changed.

## Success Criteria
- Production returns a real PDF for the exact failing request.
- Focused regression coverage exists for PDF export.
- Temporary diagnostics are cleaned up.

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Local test data does not mirror production | Medium | Use Docker and remote validation, not local only |
| Fix regresses non-PDF exports | Medium | Keep route tests focused on format branches |
| Diagnostics accidentally remain enabled | Low | Gate behind env flag and default it off |

## Security Considerations
- Keep production validation requests scoped to non-sensitive exports already accessible to the same admin role.

## Next Steps
- Hand off for code review after all three validation layers pass.