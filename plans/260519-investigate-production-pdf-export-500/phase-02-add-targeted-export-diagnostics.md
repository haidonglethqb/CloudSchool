# Phase 02: Add Targeted Export Diagnostics

## Context Links
- `backend/src/routes/export.routes.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/app.js`

## Overview
Only do this if Phase 01 proves production is already running the latest relevant code and the exact request still fails.

## Key Insights
- The current signal is too coarse: generic `INTERNAL_ERROR` hides the failing stage.
- Diagnostics should be temporary, narrow, and gated by an env flag such as `EXPORT_DEBUG=1`.

## Requirements
- Preserve existing response contracts.
- Log enough detail to isolate the failure stage.
- Avoid leaking stack traces or request secrets in API responses.

## Related Files
- `backend/src/routes/export.routes.js`
- `backend/src/middleware/errorHandler.js`

## Implementation Steps
1. Add env-gated structured logs in `export.routes.js` around these boundaries:
   - request accepted
   - query parsed
   - students fetched
   - PDF document created
   - each section render start/end
   - footer write start/end
   - PDF buffer finalized
   - response send
   - catch block entered
2. Log these fields where available:
   - method, path, query `format`
   - selected sections count
   - selected columns count
   - stage name
   - `err.name`, `err.code`, `err.message`
   - `res.headersSent`
3. Add temporary server-side logging in `errorHandler.js` for:
   - `err.name`, `err.code`, `err.message`
   - whether the error is an `AppError`
   - `req.method`, `req.originalUrl`
   - `res.headersSent`
4. Redeploy the diagnostics build.
5. Replay the exact failing request once and isolate the first failing stage.

## TODO List
- [ ] Add env-gated route diagnostics.
- [ ] Add env-gated error-handler diagnostics.
- [ ] Redeploy diagnostics build.
- [ ] Reproduce the failing request once.
- [ ] Extract the first failing stage and stop widening scope.

## Success Criteria
- A single failing stage is identified from logs.
- The next code fix is local to one stage or boundary.

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-logging in production | Medium | Gate all new logs behind `EXPORT_DEBUG=1` |
| Sensitive data exposure | High | Log metadata only, not tokens/cookies/body content |
| Reopening multiple hypotheses at once | Medium | Stop after the first concrete failing stage |

## Security Considerations
- Never include auth headers or cookies in log output.
- Keep diagnostics disabled by default.

## Next Steps
- Implement a narrow fix in the stage revealed by diagnostics.
- Then continue to Phase 03.