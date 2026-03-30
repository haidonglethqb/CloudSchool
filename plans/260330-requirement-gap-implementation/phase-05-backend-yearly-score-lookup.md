# Phase 5: Backend API - Tra cứu điểm yearly

## Priority: P2
## Status: pending
## Depends on: Phase 1

## Overview

Bổ sung endpoint tra cứu điểm tổng hợp theo BM7: hiển thị Học kỳ I, Học kỳ II, TB cả năm trong 1 response.

## Related Code Files

### Files to modify
- `backend/src/routes/score.routes.js` — thêm endpoint mới

## Implementation Steps

### Step 1: Endpoint mới

GET `/scores/student/:studentId/yearly`

Query params: `year` (string, e.g. "2024-2025")

Response (BM7 format):
```json
{
  "data": {
    "student": { "id", "studentCode", "fullName", "class": {...} },
    "subjects": [
      {
        "subject": { "id", "name" },
        "semester1Average": 7.5,
        "semester2Average": 8.0,
        "yearlyAverage": 7.75,
        "isPassed": true
      }
    ],
    "overallSemester1": 7.2,
    "overallSemester2": 7.8,
    "overallYearly": 7.5
  }
}
```

Logic:
1. Tìm 2 semester của năm học (semesterNum 1 và 2, cùng year)
2. Cho mỗi subject, tính weighted average HK1 và HK2
3. TB cả năm = (HK1 + HK2) / 2
4. isPassed = TB cả năm >= passScore

### Step 2: Frontend API

```ts
export const scoreApi = {
  // ... existing
  getYearly: (studentId: string, year?: string) =>
    api.get(`/scores/student/${studentId}/yearly`, { params: { year } }),
}
```

## Todo List

- [ ] GET /scores/student/:studentId/yearly endpoint
- [ ] Tính HK1, HK2, TB cả năm
- [ ] Trả isPassed theo passScore
- [ ] Thêm API function trong frontend api.ts

## Success Criteria

- Response đúng format BM7
- TB cả năm tính chính xác
- Hoạt động khi 1 HK chưa có điểm (trả null)
