# Phase 7: Frontend - Settings mở rộng + Báo cáo mới

## Priority: P2
## Status: pending
## Depends on: Phase 3, Phase 4, Phase 5

## Overview

Bổ sung UI cho:
1. Settings page: các field cấu hình mới (QĐ12)
2. Reports page: 2 loại báo cáo mới (chuyển lớp BM8, lưu ban BM9)
3. Tra cứu điểm yearly (BM7): HK1 + HK2 + TB cả năm

## Related Code Files

### Files to modify
- `frontend/src/app/(dashboard)/settings/page.tsx` — thêm fields cấu hình mới
- `frontend/src/app/(dashboard)/reports/page.tsx` — thêm 2 tab báo cáo mới
- `frontend/src/app/(dashboard)/students/[id]/page.tsx` — hiển thị bảng điểm yearly
- `frontend/src/lib/api.ts` — thêm API functions

## Implementation Steps

### Step 1: Mở rộng Settings page

Thêm fields vào tab "Cài đặt chung":

```
┌─────────────────────────────────────────────────────┐
│ ⚙ Quy định trường học                              │
├─────────────────────────────────────────────────────┤
│ Tuổi học sinh                                       │
│ ├─ Tối thiểu: [15]    Tối đa: [20]                │
│                                                     │
│ Khối lớp                                            │
│ ├─ Tối thiểu: [10]    Tối đa: [12]                │
│                                                     │
│ Sĩ số tối đa mỗi lớp:  [40]                       │
│                                                     │
│ Số môn học tối đa:  [9]                            │
│                                                     │
│ Thang điểm                                          │
│ ├─ Tối thiểu: [0]     Tối đa: [10]                │
│                                                     │
│ Điểm đạt:  [5.0]                                   │
│                                                     │
│ Số học kỳ tối đa:  [2]                             │
│                                                     │
│ Số lần lưu ban tối đa:  [3]                        │
│                                                     │
│                              [💾 Lưu cài đặt]      │
└─────────────────────────────────────────────────────┘
```

### Step 2: Báo cáo chuyển lớp (BM8)

Thêm tab "Chuyển lớp" trong Reports page.

UI:
```
┌─────────────────────────────────────────────────────┐
│ Báo cáo chuyển lớp                                  │
│ Học kỳ: [Dropdown]              [Xem báo cáo]      │
├─────────────────────────────────────────────────────┤
│ STT │ Mã HS    │ Họ tên     │ Lớp cũ │ Lớp mới │ Lý do │
│  1  │ HS24001  │ Nguyễn A   │ 10A1   │ 10A2    │ ...   │
│  2  │ HS24002  │ Trần B     │ 11B1   │ 11B2    │ ...   │
└─────────────────────────────────────────────────────┘
```

### Step 3: Báo cáo HS lưu ban (BM9)

Thêm tab "Lưu ban" trong Reports page.

UI:
```
┌─────────────────────────────────────────────────────┐
│ Báo cáo danh sách học sinh lưu ban                  │
│ Học kỳ: [Dropdown]              [Xem báo cáo]      │
├─────────────────────────────────────────────────────┤
│ STT │ Mã HS    │ Họ tên     │ Số lần lưu ban │ Cách xử lý     │
│  1  │ HS24003  │ Lê C       │       2        │ Lưu ban        │
│  2  │ HS24004  │ Phạm D     │       3        │ Ngừng tiếp nhận│
└─────────────────────────────────────────────────────┘
```

Badge colors:
- Lưu ban: `bg-yellow-100 text-yellow-800`
- Ngừng tiếp nhận: `bg-red-100 text-red-800`

### Step 4: Tra cứu điểm yearly (BM7)

Trên trang student detail (`/students/[id]`), thêm tab/view "Bảng điểm cả năm":

```
┌─────────────────────────────────────────────────────┐
│ Bảng điểm cả năm                                    │
│ Năm học: [2024-2025 ▼]                              │
├─────────────────────────────────────────────────────┤
│ STT │ Môn học    │ HK I  │ HK II │ TB cả năm │ Đạt │
│  1  │ Toán       │ 7.5   │ 8.0   │ 7.75      │ ✅  │
│  2  │ Văn        │ 6.0   │ 5.5   │ 5.75      │ ✅  │
│  3  │ Anh        │ 4.0   │ 4.5   │ 4.25      │ ❌  │
├─────────────────────────────────────────────────────┤
│ Tổng TB          │ 5.83  │ 6.0   │ 5.92      │     │
└─────────────────────────────────────────────────────┘
```

### Step 5: Cập nhật api.ts

```ts
// reportApi
transferReport: (params) => api.get('/reports/transfer-report', { params }),
retentionReport: (params) => api.get('/reports/retention-report', { params }),

// scoreApi
getYearly: (studentId, year) => api.get(`/scores/student/${studentId}/yearly`, { params: { year } }),

// settingsApi.update - thêm fields mới
```

## Todo List

- [ ] Settings page: thêm fields minGradeLevel, maxGradeLevel
- [ ] Settings page: thêm fields maxSubjects, minScore, maxScore
- [ ] Settings page: thêm fields maxSemesters, maxRetentions
- [ ] Settings page: validation min <= max cho grade, score
- [ ] Reports page: thêm tab "Chuyển lớp" với bảng BM8
- [ ] Reports page: thêm tab "Lưu ban" với bảng BM9
- [ ] Reports page: badge color cho cách xử lý
- [ ] Student detail: tab "Bảng điểm cả năm" (BM7)
- [ ] Student detail: AcademicYear selector
- [ ] Cập nhật api.ts với tất cả functions mới
- [ ] Responsive mobile layout cho tất cả trang mới

## Success Criteria

- Settings hiển thị và lưu đầy đủ 11 fields cấu hình
- Tab chuyển lớp hiển thị dữ liệu đúng BM8
- Tab lưu ban hiển thị dữ liệu đúng BM9 + QĐ9
- Bảng điểm yearly hiển thị HK1, HK2, TB cả năm đúng BM7
- Tất cả responsive, nhất quán UX với trang hiện tại

## Security Considerations

- Chỉ SUPER_ADMIN được thay đổi settings
- Reports accessible cho SUPER_ADMIN + STAFF
- Student detail accessible theo role permissions hiện tại
