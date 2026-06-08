# Teacher Permission And Semester Fixes

Date: 2026-06-08

## Muc tieu

Chot lai logic giao vien theo `nam hoc + hoc ky + lop + mon`, sua loi `ROLE_PERMISSION_DENIED` sai context, va don UI de giao vien chi thay nhung man thuc su duoc dung.

## Logic da chot

- Phan cong giao vien khong carry tu dong sang nam hoc sau.
- Quyen cua giao vien bam theo `classId + subjectId + semesterId`.
- Giao vien chi nhap/sua diem khi:
  - duoc phan cong dung `lop + mon + hoc ky`
  - hoc ky do dang active/mo nhap diem
- Neu hoc ky cu duoc active lai, giao vien van sua diem duoc trong hoc ky do neu assignment van ton tai.
- Giao vien khong duoc vao man cau hinh `Mon hoc` hay `Nam hoc`.
- Giao vien van duoc doc du lieu `nam hoc / hoc ky / mon hoc` o backend de phuc vu dropdown va context nhap diem.

## Van de da gap

### 1. Teacher bi `ROLE_PERMISSION_DENIED` khi vao `Lop cua toi` va `Nhap diem`

Nguyen nhan:

- Frontend teacher goi API `GET /academic-years` de load dropdown.
- Route nay truoc do bi gate boi permission `academic-calendar`.
- Teacher khong co module `academic-calendar`, nen bi chan truoc khi toi logic assignment.

Huong sua:

- Tach cac route doc `academic years / semesters` ra khoi gate `academic-calendar`.
- Giu nguyen gate cho cac thao tac tao/sua/xoa/kich hoat nam hoc va hoc ky.

File da sua:

- `backend/src/routes/academic-year.routes.js`

### 2. Check assignment theo hoc ky chua chat

Nguyen nhan:

- Khi request co `semesterId`, backend van fallback theo `class + subject` cua hoc ky khac.
- Nhu vay sai voi rule moi.

Huong sua:

- Neu request co `semesterId` thi bat buoc phai match dung `class + subject + semester`.
- Khong fallback sang assignment cua hoc ky khac nua.

File da sua:

- `backend/src/utils/assignment-scope.js`

### 3. Teacher mac dinh roi vao nam hoc active nhung khong co assignment

Nguyen nhan:

- `Lop cua toi` va `Nhap diem` mac dinh theo `nam hoc active` cua toan truong.
- Neu teacher chi co assignment o nam/hoc ky khac, giao dien trong nhu bi loi.

Huong sua:

- Voi role `TEACHER`, neu nam/hoc ky active khong co lop duoc giao thi frontend tu do sang hoc ky gan nhat thuc su co assignment.

File da sua:

- `frontend/src/app/(dashboard)/classes/page.tsx`
- `frontend/src/app/(dashboard)/scores/page.tsx`

### 4. Teacher thay UI `Mon hoc` du khong duoc phep cau hinh

Nguyen nhan:

- Teacher co module `subjects` de backend cho phep doc subject list phuc vu dropdown.
- Nhưng UI sidebar va man `Mon hoc` van mo ra nhu mot tinh nang rieng.

Huong sua:

- An `Mon hoc` khoi sidebar role `TEACHER`.
- An option `Mon hoc` khoi man admin `Phan quyen` cua role `TEACHER`.
- Neu teacher go truc tiep vao `/subjects` thi redirect sang `/scores`.

File da sua:

- `frontend/src/app/(dashboard)/layout.tsx`
- `frontend/src/app/(dashboard)/settings/permissions/page.tsx`
- `frontend/src/app/(dashboard)/subjects/page.tsx`

## Cac thay doi lien quan da lam trong ngay

### Backend / database

- Them `semesterId` vao `TeacherAssignment`.
- Doi unique key cua assignment thanh `teacherId + classId + subjectId + semesterId`.
- Cap nhat cac route lien quan de check scope theo hoc ky.
- Cap nhat route doc `academic years` de teacher/staff dung duoc cho dropdown.

File chinh:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260608110000_add_semester_to_teacher_assignments/migration.sql`
- `backend/prisma/seed.js`
- `backend/src/routes/academic-year.routes.js`
- `backend/src/routes/class.routes.js`
- `backend/src/routes/report.routes.js`
- `backend/src/routes/score.routes.js`
- `backend/src/routes/subject.routes.js`
- `backend/src/routes/user.routes.js`
- `backend/src/utils/assignment-scope.js`

### Frontend

- Modal phan cong giao vien hien ro `nam hoc -> hoc ky -> lop -> mon`.
- `Lop cua toi` loc theo `nam hoc + hoc ky`.
- `Nhap diem` loc theo `nam hoc + hoc ky`, chi nhap duoc khi ky active.
- Parent co dropdown xem hoc ky cua con.
- Sau promotion, cac trang chinh giu context nam/hoc ky dung hon.
- An `Mon hoc` khoi teacher UI.

File chinh:

- `frontend/src/app/(dashboard)/users/page.tsx`
- `frontend/src/app/(dashboard)/classes/page.tsx`
- `frontend/src/app/(dashboard)/classes/[id]/page.tsx`
- `frontend/src/app/(dashboard)/scores/page.tsx`
- `frontend/src/app/(dashboard)/students/[id]/scores/page.tsx`
- `frontend/src/app/(dashboard)/students/[id]/page.tsx`
- `frontend/src/app/(dashboard)/my-children/[studentId]/scores/page.tsx`
- `frontend/src/app/(dashboard)/promotion/page.tsx`
- `frontend/src/app/(dashboard)/reports/page.tsx`
- `frontend/src/app/(dashboard)/export/page.tsx`
- `frontend/src/app/(dashboard)/layout.tsx`
- `frontend/src/app/(dashboard)/settings/permissions/page.tsx`
- `frontend/src/app/(dashboard)/subjects/page.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/utils.ts`

### Documentation da cap nhat truoc do

- `docs/system/authentication/roles-permissions.md`
- `docs/system/backend/api-endpoints.md`
- `docs/system/data-flows/score-entry-flow.md`
- `docs/system/database/indexes-performance.md`
- `docs/system/database/schema-overview.md`
- `docs/system/database/user-models.md`

## Migration va seed da xac nhan

Migration:

- `20260608110000_add_semester_to_teacher_assignments` da duoc apply thanh cong.

Seed:

- `node prisma/seed.js` da chay xong.
- Log xac nhan:
  - `Academic years ready: 2024-2025, 2025-2026, 2026-2027`
  - `Semesters ready: 6`
  - `Subject teachers ready: 8`
  - `Classes ready: 27`
  - `Teacher assignments ready`
  - `Scores ready: 9216`

Y nghia:

- DB hien tai da co schema moi.
- Seed hien tai da tao assignment theo `lop + mon + hoc ky`.
- Cac teacher seed san nhu Toan, Van, Su, Dia, Sinh, Hoa, Ly, Anh phai work theo cung logic.

## Verify da chay

- `node --check backend/src/routes/academic-year.routes.js`
- `node --check backend/src/utils/assignment-scope.js`
- `node --check backend/src/routes/score.routes.js`
- `node --check backend/src/routes/user.routes.js`
- `node --check backend/src/routes/class.routes.js`
- `node --check backend/prisma/seed.js`
- `node --check backend/src/routes/promotion.routes.js`
- `node --check backend/src/routes/report.routes.js`
- `npm exec tsc -- --noEmit` trong `frontend`
- `npm run check:vi-text` trong `frontend`

Tat ca cac lenh verify tren da pass.

## Hanh vi mong doi sau cung

### Teacher

- Khong thay menu `Mon hoc`.
- Khong vao duoc man cau hinh `Mon hoc`; neu vao truc tiep thi bi redirect sang `Nhap diem`.
- `Lop cua toi` hien dung lop theo `nam hoc + hoc ky` duoc phan cong.
- `Nhap diem` chi hien/cho sua dung context teacher duoc giao.
- Neu hoc ky dang khong active thi xem duoc, nhung khong nhap/sua diem duoc.
- Neu hoc ky cu duoc active lai thi teacher sua duoc diem trong hoc ky do neu assignment van ton tai.

### Admin

- Van quan ly duoc `Mon hoc`, `Nam hoc`, `Hoc ky`, `Phan quyen`.
- Trong man `Phan quyen`, role `TEACHER` khong con hien module `Mon hoc` tren UI.

## Checklist test tay sau deploy

1. Dang nhap `teacher@demo.school.vn`, vao `Lop cua toi`, xac nhan co lop.
2. Vao `Nhap diem`, xac nhan dropdown nam/hoc ky tu roi ve context co assignment.
3. Doi sang hoc ky khac khong duoc phan cong, xac nhan khong sua duoc sai scope.
4. Kich hoat lai mot hoc ky cu, xac nhan teacher van sua diem duoc neu co assignment.
5. Dang nhap them 1-2 tai khoan nhu `teacher.history@demo.school.vn`, `teacher.literature@demo.school.vn`, `teacher.geography@demo.school.vn` de doi chieu.
6. Dang nhap admin, xac nhan sidebar teacher khong con `Mon hoc`.
7. Dang nhap admin, vao `Phan quyen`, xac nhan role teacher khong co checkbox `Mon hoc`.

## Unresolved questions

- Chua co log test tay end-to-end tren browser cho tung teacher sau deploy va reseed.
- `lock/unlock/delete score` hien van dang theo quyen admin/staff; chua mo cho teacher.
