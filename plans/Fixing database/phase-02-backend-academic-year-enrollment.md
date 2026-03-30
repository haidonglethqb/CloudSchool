# Phase 2: Backend API - AcademicYear + Enrollment

## Priority: P1
## Status: pending
## Depends on: Phase 1

## Overview

Tạo CRUD API cho AcademicYear (Năm học) và ClassEnrollment (xếp lớp theo HK). Theo đúng pattern Express route hiện tại.

## Related Code Files

### Files to create
- `backend/src/routes/academic-year.routes.js`

### Files to modify
- `backend/src/app.js` — mount route mới
- `backend/src/routes/student.routes.js` — tạo enrollment khi tiếp nhận/chuyển lớp
- `backend/src/routes/class.routes.js` — lấy DS HS theo HK

## Implementation Steps

### Step 1: Tạo `academic-year.routes.js`

Endpoints:
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/academic-years` | List năm học | All authenticated |
| POST | `/academic-years` | Tạo năm học | SUPER_ADMIN, STAFF |
| PUT | `/academic-years/:id` | Sửa năm học | SUPER_ADMIN, STAFF |
| DELETE | `/academic-years/:id` | Xóa năm học | SUPER_ADMIN |

Validation (QĐ1):
- `startYear` phải nhỏ hơn `endYear`
- Không trùng `[tenantId, startYear, endYear]`

### Step 2: Cập nhật `app.js`

```js
const academicYearRoutes = require('./routes/academic-year.routes')
app.use('/api/academic-years', academicYearRoutes)
```

### Step 3: Cập nhật Student routes — tạo enrollment khi tiếp nhận

Khi POST `/students` (tạo HS mới) và có classId:
- Tìm active semester + academic year
- Tạo ClassEnrollment record

Khi POST `/students/:id/transfer`:
- Tạo ClassEnrollment cho lớp mới + semester hiện tại

### Step 4: Cập nhật Class routes — lấy HS theo enrollment

GET `/classes/:id/students` thêm filter theo `semesterId`:
- Nếu có `semesterId` param → query qua ClassEnrollment
- Nếu không → fallback hành vi cũ (Student.classId)

### Step 5: API Front-end integration

Thêm vào `api.ts`:
```ts
export const academicYearApi = {
  list: () => api.get('/academic-years'),
  create: (data: { startYear: number; endYear: number }) =>
    api.post('/academic-years', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/academic-years/${id}`, data),
  delete: (id: string) => api.delete(`/academic-years/${id}`),
}
```

## Todo List

- [ ] Tạo academic-year.routes.js với CRUD + validation QĐ1
- [ ] Mount route trong app.js
- [ ] Cập nhật student.routes.js → tạo enrollment khi tiếp nhận
- [ ] Cập nhật student transfer → tạo enrollment mới
- [ ] Cập nhật class.routes.js → support enrollment query
- [ ] Thêm academicYearApi vào frontend api.ts
- [ ] Test tạo/sửa/xóa năm học

## Success Criteria

- CRUD AcademicYear hoạt động
- QĐ1: startYear < endYear validated server-side
- Enrollment tự tạo khi tiếp nhận HS vào lớp
- Enrollment tự tạo khi chuyển lớp
