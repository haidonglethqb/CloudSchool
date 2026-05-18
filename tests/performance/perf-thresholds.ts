const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const perfThresholds = {
  authPlansP95Ms: toNumber(process.env.PERF_AUTH_PLANS_P95_MS, 800),
  authLoginP95Ms: toNumber(process.env.PERF_AUTH_LOGIN_P95_MS, 800),
  commonEndpointP95Ms: toNumber(process.env.PERF_COMMON_ENDPOINT_P95_MS, 800),
  reportsDashboardP95Ms: toNumber(process.env.PERF_REPORTS_DASHBOARD_P95_MS, 1000),
  settingsP95Ms: toNumber(process.env.PERF_SETTINGS_P95_MS, 500),
  batchUpsertMs: toNumber(process.env.PERF_BATCH_UPSERT_MS, 2000),
  dashboardGenerationMs: toNumber(process.env.PERF_DASHBOARD_GENERATION_MS, 2000),
  studentsListLargePageMs: toNumber(process.env.PERF_STUDENTS_LARGE_PAGE_MS, 2000),
  semesterSummaryMs: toNumber(process.env.PERF_SEMESTER_SUMMARY_MS, 3000),
  concurrent10TotalMs: toNumber(process.env.PERF_CONCURRENT_10_TOTAL_MS, 5000),
  concurrent20TotalMs: toNumber(process.env.PERF_CONCURRENT_20_TOTAL_MS, 10000),
  concurrent50PublicTotalMs: toNumber(process.env.PERF_CONCURRENT_50_PUBLIC_TOTAL_MS, 15000),
}
