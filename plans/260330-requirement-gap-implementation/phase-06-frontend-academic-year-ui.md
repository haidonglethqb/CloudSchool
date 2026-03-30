# Phase 6: Frontend - Quản lý Năm học + UI cập nhật

## Priority: P1
## Status: pending
## Depends on: Phase 2, Phase 3

## Overview

Tạo UI quản lý năm học, cập nhật các trang hiện tại để sử dụng AcademicYear selector. Thêm field email/ngày tiếp nhận vào form tiếp nhận HS.

## Related Code Files

### Files to create
- `frontend/src/app/(dashboard)/settings/academic-years/page.tsx` — CRUD năm học

### Files to modify
- `frontend/src/lib/api.ts` — thêm academicYearApi
- `frontend/src/app/(dashboard)/layout.tsx` — thêm menu item "Năm học" trong settings
- `frontend/src/app/(dashboard)/students/new/page.tsx` — thêm field email, admissionDate
- `frontend/src/app/(dashboard)/students/[id]/edit/page.tsx` — thêm field email
- `frontend/src/app/(dashboard)/classes/page.tsx` — thêm AcademicYear filter
- `frontend/src/app/(dashboard)/subjects/page.tsx` — hiển thị cảnh báo khi gần maxSubjects

## Implementation Steps

### Step 1: Tạo trang quản lý Năm học

Path: `/settings/academic-years`

UI Layout:
```
┌─────────────────────────────────────────────────┐
│  📅 Quản lý Năm học                   [+ Thêm] │
├─────────────────────────────────────────────────┤
│ STT │ Mã     │ Năm bắt đầu │ Năm kết thúc │ ⚙ │
│  1  │ AY-001 │    2024      │    2025      │ ✏🗑│
│  2  │ AY-002 │    2025      │    2026      │ ✏🗑│
└─────────────────────────────────────────────────┘
```

Component structure:
- Table hiển thị danh sách
- Modal form thêm/sửa (startYear, endYear fields)
- Client-side + server-side validation: startYear < endYear
- Delete confirmation dialog

Style: Dùng Tailwind classes theo pattern hiện tại (card, table, modal). KHÔNG dùng UI library ngoài.

### Step 2: Cập nhật form Tiếp nhận HS

Thêm fields vào form:
- `email`: input type="email", optional
- `admissionDate`: input type="date", default today

### Step 3: Thêm AcademicYear selector vào Classes page

Dropdown chọn năm học, filter danh sách lớp theo `academicYear`.

### Step 4: Cập nhật sidebar menu

Thêm menu item "Năm học" dưới group "Quy định" cho SUPER_ADMIN.

### Step 5: Hiển thị cảnh báo maxSubjects

Trên trang Subjects, khi số môn >= maxSubjects - 1:
- Hiển thị badge cảnh báo "Sắp đạt giới hạn (N/maxN)"
- Khi đạt max → disable nút Thêm + thông báo

## Todo List

- [ ] Tạo trang /settings/academic-years (CRUD)
- [ ] Validation form: startYear < endYear
- [ ] Thêm academicYearApi vào api.ts
- [ ] Cập nhật form tiếp nhận HS: email + admissionDate
- [ ] Classes page: AcademicYear filter dropdown
- [ ] Sidebar menu: thêm "Năm học"
- [ ] Subjects page: cảnh báo maxSubjects
- [ ] Responsive mobile layout

## Success Criteria

- CRUD năm học hoạt động đầy đủ
- Validation QĐ1 hiển thị lỗi rõ ràng
- Form tiếp nhận HS có email + ngày tiếp nhận
- UX nhất quán với trang settings hiện tại
