# Phase 4: Backend API - Báo cáo chuyển lớp & lưu ban

## Priority: P2
## Status: pending
## Depends on: Phase 1

## Overview

Tạo 2 API báo cáo mới:
1. **BM8**: Báo cáo chuyển lớp (theo năm/HK)
2. **BM9**: Báo cáo HS lưu ban (theo năm/HK, đếm số lần, QĐ9)

Cũng bổ sung logic tự động "Ngừng tiếp nhận" khi HS lưu ban quá số lần cho phép.

## Related Code Files

### Files to modify
- `backend/src/routes/report.routes.js` — thêm 2 endpoint báo cáo mới
- `backend/src/routes/promotion.routes.js` — thêm logic đếm lưu ban + auto deactivate

### Files to modify (minor)
- `backend/src/routes/student.routes.js` — kiểm tra HS bị "Ngừng tiếp nhận" khi tạo/cập nhật

## Implementation Steps

### Step 1: API Báo cáo chuyển lớp (BM8)

GET `/reports/transfer-report`

Query params: `semesterId` (optional), `year` (optional)

Response:
```json
{
  "data": {
    "semester": {...},
    "transfers": [
      {
        "student": { "id", "studentCode", "fullName" },
        "fromClass": { "id", "name" },
        "toClass": { "id", "name" },
        "reason": "...",
        "transferredAt": "..."
      }
    ],
    "totalTransfers": 5
  }
}
```

Logic:
- Query `TransferHistory` join Student, fromClass, toClass
- Filter by `createdAt` within semester date range hoặc theo `semesterId` nếu field đã bổ sung

### Step 2: API Báo cáo HS lưu ban (BM9)

GET `/reports/retention-report`

Query params: `semesterId`

Response:
```json
{
  "data": {
    "semester": {...},
    "retentions": [
      {
        "student": { "id", "studentCode", "fullName" },
        "retentionCount": 2,
        "handling": "Lưu ban"
      }
    ],
    "maxRetentions": 3
  }
}
```

Logic:
- Query `Promotion` where `result = FAIL`
- Group by `studentId`, count số lần FAIL
- Nếu count >= `settings.maxRetentions`: handling = "Ngừng tiếp nhận"
- Nếu count < maxRetentions: handling = "Lưu ban"

### Step 3: QĐ9 — Logic "Ngừng tiếp nhận"

Trong POST `/promotion/calculate`:
- Sau khi tính result = FAIL cho HS
- Đếm tổng promotion FAIL trước đó
- Nếu tổng >= `settings.maxRetentions`:
  - Set `student.isActive = false`
  - Set `promotion.note = "Ngừng tiếp nhận - vượt quá ${maxRetentions} lần lưu ban"`

### Step 4: Frontend API

```ts
export const reportApi = {
  // ... existing
  transferReport: (params?: { semesterId?: string }) =>
    api.get('/reports/transfer-report', { params }),
  retentionReport: (params?: { semesterId?: string }) =>
    api.get('/reports/retention-report', { params }),
}
```

## Todo List

- [ ] GET /reports/transfer-report endpoint
- [ ] GET /reports/retention-report endpoint
- [ ] Logic đếm số lần lưu ban từ Promotion FAIL records
- [ ] QĐ9: Auto deactivate student khi vượt maxRetentions
- [ ] Cập nhật promotion/calculate với logic lưu ban
- [ ] Thêm API functions trong frontend api.ts

## Success Criteria

- Báo cáo chuyển lớp trả danh sách theo HK/năm
- Báo cáo lưu ban trả DS kèm số lần + cách xử lý
- HS lưu ban > maxRetentions tự động bị "Ngừng tiếp nhận"
- QĐ9 configurable qua settings
