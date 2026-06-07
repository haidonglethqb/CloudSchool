# Plan: Fix Promotion Active Year And Class Roster

## Mục tiêu

Sửa luồng sau khi xét lên lớp để dữ liệu hiển thị đúng theo năm học người dùng chọn:

- Xét lên lớp 2025-2026 sang 2026-2027 thì hệ thống phải active ngay năm học 2026-2027 và học kỳ đầu tiên của năm đó.
- Dropdown danh sách lớp chọn năm nào thì sĩ số, danh sách học sinh, chi tiết lớp phải là snapshot mới nhất trong năm đó.
- Lớp khối 10 của năm 2026-2027 không được tự lấy học sinh cũ hoặc dữ liệu sai năm sau khi promotion, vì phần này ảnh hưởng trực tiếp đến tiếp nhận học sinh và chuyển lớp.
- Chuyển lớp phải dựa trên state active year/semester hiện tại, không dựa mù vào `Student.classId`.

## Root Cause Đang Nghi

### 1. Active year bị giữ ở năm cũ

Trong `backend/src/routes/promotion.routes.js`, bước active năm học kế tiếp đang bị guard bởi điều kiện còn unresolved hay không. Với dữ liệu seed, dù người dùng đã xử lý/loại hết các học sinh không đạt trên UI, backend vẫn có thể còn bản ghi unresolved hoặc trạng thái chưa được tính lại đúng, làm transaction execute xong nhưng không active 2026-2027.

Rule mới:

```text
Nếu execute promotion thành công từ năm A sang năm B,
thì active year phải chuyển sang B và active semester phải là HK1 của B.
Không phụ thuộc frontend đang đứng ở trang nào.
```

### 2. Class roster/count bị lẫn giữa state hiện tại và lịch sử

`Student.classId` chỉ nên là state hiện tại của học sinh. Nó không thể trả lời câu hỏi:

```text
Năm 2025-2026 lớp 10A1 có ai?
Năm 2026-2027 lớp 11A1 có ai?
```

Nguồn đúng cho câu hỏi này là `ClassEnrollment`.

Rule mới:

```text
Danh sách lớp theo dropdown năm học = latest ClassEnrollment của từng học sinh trong năm học đó.
Không dùng Student.classId để count/roster lịch sử.
```

### 3. Seed tạo dữ liệu future year làm dễ hiểu nhầm

Seed hiện có thể tạo học sinh/enrollment cho nhiều năm học. Khi test promotion với seed, nếu 2026-2027 đã có enrollment khối 10 sẵn, dropdown 2026-2027 sẽ vẫn thấy học sinh khối 10 dù chưa tiếp nhận thêm. Điều này sai với kỳ vọng nghiệp vụ hiện tại:

```text
Sau khi xét từ 2025-2026 lên 2026-2027,
khối 10 của 2026-2027 chỉ có học sinh nếu đã tiếp nhận/import vào năm active mới.
Không được có sẵn 8 học sinh/lớp từ seed future year.
```

Cần xử lý theo 2 lớp:

- Code runtime không được tự copy/lấy sai học sinh từ năm cũ.
- Seed/dev data phải không tạo enrollment future year gây sai luồng nghiệp vụ.

## Invariant Cần Giữ

- `AcademicYear.isActive = true` chỉ có một năm trong một tenant.
- `Semester.isActive = true` chỉ có một học kỳ trong năm active của tenant.
- `ClassEnrollment` là nguồn chính cho roster theo năm/học kỳ.
- `Student.classId` là lớp hiện tại để search nhanh và hiển thị state hiện tại.
- Promotion tạo enrollment ở năm kế tiếp, học kỳ đầu tiên.
- Transfer cập nhật enrollment của active semester hiện tại.
- Admission/import tạo enrollment vào active semester hiện tại.
- Historical dropdown không được bị thay đổi bởi `Student.classId` hiện tại.

## Phạm Vi Sửa

### Backend

#### 1. Promotion execute

File:

- `backend/src/routes/promotion.routes.js`

Việc cần làm:

- Sau khi `POST /promotion/year-end/execute` chạy thành công, luôn active `nextAcademicYear`.
- Luôn active semester đầu tiên của `nextAcademicYear`.
- Không để điều kiện unresolved chặn việc chuyển kỳ nếu execute đã pass validate.
- Sau khi tạo/move enrollment sang năm kế tiếp, cập nhật `Student.classId` theo lớp mới của năm active mới.
- Ghi log rõ `activatedAcademicYearId`, `activatedSemesterId`.

Pseudo:

```js
await tx.academicYear.updateMany({
  where: { tenantId, isActive: true },
  data: { isActive: false }
});

await tx.semester.updateMany({
  where: { tenantId, isActive: true },
  data: { isActive: false }
});

await tx.academicYear.update({
  where: { id: nextAcademicYear.id },
  data: { isActive: true }
});

await tx.semester.update({
  where: { id: nextSemester.id },
  data: { isActive: true }
});
```

#### 2. Enrollment helper chuẩn hóa roster/count

File:

- `backend/src/utils/enrollment-state.js`

Việc cần làm:

- `getLatestEnrollmentRowsForAcademicYear(tenantId, academicYearId)` phải lấy enrollment mới nhất của từng học sinh trong đúng năm học.
- Sort phải ổn định theo:
  - `semester.semesterNum DESC`
  - `createdAt DESC`
  - `id DESC`
- Count theo class phải group từ latest enrollment, không count raw enrollment để tránh một học sinh có cả HK1/HK2 bị tính 2 lần.
- Helper capacity active semester chỉ count enrollment active semester, không count lịch sử cả năm.

#### 3. Class APIs theo dropdown

Files:

- `backend/src/routes/class.routes.js`

Endpoints cần kiểm:

- `GET /classes?academicYearId=...`
- `GET /classes/grades?academicYearId=...`
- `GET /classes/:id?academicYearId=...`

Rule:

- Có `academicYearId` thì trả `_count.students` và `students` theo `ClassEnrollment` của năm đó.
- Không có `academicYearId` thì default năm active hiện tại.
- Class detail phải trả đúng roster lịch sử theo năm dropdown.
- Không fallback về `Student.classId` khi đang xem theo năm học.

#### 4. Transfer theo active semester

Files:

- `backend/src/routes/student.routes.js`

Việc cần làm:

- `POST /students/:id/transfer` lấy source class theo enrollment active semester trước.
- Nếu không có enrollment active semester thì fallback `Student.classId`.
- Khi chuyển lớp:
  - upsert enrollment active semester vào target class.
  - update `Student.classId = targetClassId`.
  - capacity check trên target class trong active semester.
- Roster lớp target năm active phải hiện học sinh ngay sau transfer.

#### 5. Admission/import không bị block bởi dữ liệu năm cũ

Files:

- `backend/src/routes/student.routes.js`
- import batch routes nếu tách riêng.
- `backend/prisma/seed.js`

Việc cần làm:

- Tiếp nhận học sinh thủ công tạo enrollment cho active semester.
- Import Excel commit tạo enrollment cho active semester.
- Auto assign import chỉ nhìn capacity active semester.
- Không lấy sĩ số từ năm trước.
- Seed dev nên chỉ tạo học sinh/enrollment cho năm học active ban đầu, hoặc nếu cần seed nhiều năm thì không seed future-year enrollments active như dữ liệu thật.

Quyết định cần chốt khi implement:

```text
Preferred: chỉnh seed để 2026-2027 khối 10 trống ban đầu.
Không xóa dữ liệu runtime của user thật.
Nếu DB dev hiện đã seed sai, cần reset/reseed hoặc viết script cleanup dev-only.
```

### Frontend

#### 1. Classes page bám active year sau promotion

File:

- `frontend/src/app/(dashboard)/classes/page.tsx`

Việc cần làm:

- Khi page load lần đầu, selected academic year phải là active year từ API.
- Nếu promotion vừa active 2026-2027, dropdown mặc định phải nhảy sang 2026-2027.
- Nếu user tự chọn 2025-2026, giữ lựa chọn đó và hiển thị lịch sử 2025-2026.
- Mọi request list/count phải truyền `academicYearId` đang chọn.

State đề xuất:

```ts
const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
const [userSelectedYear, setUserSelectedYear] = useState(false);
```

Rule:

```text
userSelectedYear=false -> sync theo active year backend.
userSelectedYear=true -> giữ năm user chọn.
```

#### 2. Class detail dùng cùng năm đang chọn

File:

- `frontend/src/app/(dashboard)/classes/[id]/page.tsx`

Việc cần làm:

- Link từ list class phải kèm `academicYearId`.
- Detail gọi `GET /classes/:id?academicYearId=...`.
- Không tự đổi về active year nếu đang xem lịch sử.

#### 3. Promotion page invalidate dữ liệu sau execute

File:

- `frontend/src/app/(dashboard)/promotion/page.tsx`

Việc cần làm:

- Sau execute thành công, gọi lại API academic years hoặc điều hướng về danh sách lớp với year active mới.
- Không để cache/stale state khiến dropdown vẫn ghi `2025-2026 - Đang active`.

## Acceptance Criteria

### Case 1: Promotion chuyển active kỳ

Data:

- Active year: 2025-2026.
- Next year: 2026-2027 có HK1/HK2.

Steps:

1. Xử lý hết học sinh không đạt hoặc loại khỏi unresolved theo rule hiện tại.
2. Bấm execute promotion.
3. Mở trang danh sách lớp.

Expected:

- Dropdown mặc định chọn `2026-2027 - Đang active`.
- Backend chỉ có một `AcademicYear.isActive=true`: 2026-2027.
- Backend chỉ có một `Semester.isActive=true`: HK1 của 2026-2027.

### Case 2: Dropdown năm nào hiện roster năm đó

Data:

```text
2025-2026:
10A1 có A, B
11A1 có C, D

Sau promotion:
2026-2027:
A, B lên 11A1
C, D lên 12A2
```

Expected:

- Chọn dropdown 2025-2026:
  - 10A1 vẫn hiện A, B.
  - 11A1 vẫn hiện C, D.
- Chọn dropdown 2026-2027:
  - 11A1 hiện A, B.
  - 12A2 hiện C, D.
  - 10A* không tự có học sinh nếu chưa tiếp nhận/import vào 2026-2027.

### Case 3: Transfer sau promotion

Data:

- Active year: 2026-2027.
- Active semester: HK1.
- Học sinh đang ở 12A3 theo enrollment active semester.

Steps:

1. Chuyển 12A3 -> 12A2.
2. Mở danh sách lớp 2026-2027.

Expected:

- 12A2 hiện học sinh vừa chuyển.
- 12A3 không còn học sinh đó trong active semester.
- Lịch sử 2025-2026 không bị đổi.

### Case 4: Tiếp nhận/import năm mới

Data:

- Active year sau promotion là 2026-2027.
- Khối 10 năm 2026-2027 đang trống.

Steps:

1. Tiếp nhận học sinh mới.
2. Auto assign hoặc chọn lớp 10A1.

Expected:

- Capacity check theo HK1 2026-2027.
- Học sinh mới xuất hiện ở 10A1 khi chọn dropdown 2026-2027.
- Không ảnh hưởng dropdown 2025-2026.

## Implementation Order

1. Sửa backend promotion activation trước.
2. Viết/siết helper enrollment count/roster.
3. Sửa class list/detail APIs để dùng helper.
4. Sửa transfer/admission/import capacity theo active semester.
5. Sửa frontend classes page sync selected year với active year.
6. Sửa class detail link/query.
7. Sửa seed để không tạo future-year class enrollments gây sai kỳ vọng nghiệp vụ.
8. Update docs API/data-flow.
9. Validate bằng API và frontend build.

## Test Plan

### Backend checks

```powershell
cd backend
node --check src\routes\promotion.routes.js
node --check src\routes\class.routes.js
node --check src\routes\student.routes.js
node --check src\utils\enrollment-state.js
```

Nếu database chạy:

```powershell
cd backend
npx prisma studio
```

Manual DB verify:

- Query active academic years per tenant.
- Query active semesters per tenant.
- Query latest class enrollments for 2025-2026 và 2026-2027.
- Query grade 10 enrollments in 2026-2027 before/after admission.

### Frontend checks

```powershell
cd frontend
npx tsc --noEmit
npm run build
npm run check:vi-text
```

### Manual UI checks

- Execute promotion.
- Mở `/classes`, kiểm dropdown mặc định.
- Chọn từng năm trong dropdown, kiểm số lượng từng khối/lớp.
- Mở chi tiết lớp từ từng năm, kiểm danh sách học sinh.
- Chuyển lớp sau promotion, kiểm roster hiện ngay trong năm active.
- Tiếp nhận/import học sinh mới vào khối 10 năm mới, kiểm capacity.

## Rủi Ro Và Cách Tránh

- Không xóa dữ liệu thật của user khi sửa seed. Seed cleanup chỉ áp dụng môi trường dev/reset.
- Không dùng `Student.classId` cho lịch sử lớp, vì sẽ làm mất snapshot năm cũ.
- Không count raw `ClassEnrollment` cả năm, vì một học sinh có thể có nhiều enrollment trong HK1/HK2 hoặc do chuyển lớp.
- Không để frontend tự cache năm active cũ sau promotion.
- Không để transfer ghi enrollment vào kỳ cũ sau khi promotion đã active kỳ mới.

## Done Definition

Hoàn tất khi:

- Promotion execute tự active 2026-2027/HK1.
- Dropdown classes mặc định hiện năm active mới.
- Chọn 2025-2026 vẫn thấy lịch sử cũ.
- Chọn 2026-2027 thấy state sau promotion.
- Khối 10 năm mới trống cho tiếp nhận/import nếu seed không tạo enrollment tương lai.
- Transfer sau promotion hiện đúng roster năm active.
- Typecheck/build backend/frontend pass hoặc lỗi được ghi rõ.
