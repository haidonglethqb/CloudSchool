# Handover Plan: Academic Scope, Score Components, Promotion

## Purpose

File này là handover cho agent implement tiếp. Mục tiêu: sửa logic học vụ để:

- Môn học có version/scope theo năm học, khối, lớp.
- Thành phần điểm chỉ theo môn gốc + học kỳ.
- Cùng môn trong cùng học kỳ luôn dùng cùng bộ thành phần điểm cho mọi lớp học môn đó.
- Xét lên lớp chỉ xét toàn bộ năm học, không có filter lớp.
- Bảo toàn điểm lịch sử sau migration.

## Final Product Decisions

### 1. Subject scope/version

`Subject` là danh mục môn gốc.

`SubjectVersion` là bản áp dụng của môn trong một năm học.

Scope của `SubjectVersion` có thể là:

- Theo khối: áp dụng cho nhiều `Grade`.
- Theo lớp: áp dụng cho vài `Class` cụ thể.

Không dùng `Subject` global để quyết định lớp nào học môn nào sau khi đã có subject version cho năm học đó.

### 2. Score components

Thành phần điểm không đi theo lớp.

Thành phần điểm không đi theo khối.

Thành phần điểm không đi theo `SubjectVersion`.

Thành phần điểm chỉ đi theo:

```text
subjectId + semesterId
```

Rule bắt buộc:

- Một môn chỉ có một active component set trong một học kỳ.
- Mọi lớp học môn đó trong học kỳ đó dùng chung component set.
- Cùng môn khác học kỳ có thể có component set khác.
- Tổng weight trong một set không vượt quá 100%.
- Component đã có điểm không được hard delete.

Ví dụ đúng:

```text
Hóa học + HK1 2025-2026 => Miệng, 15 phút, 1 tiết, Cuối kỳ
Hóa học + HK2 2025-2026 => Miệng, 15 phút lần 1, 15 phút lần 2, Cuối kỳ
Hóa học + HK1 2026-2027 => cấu hình khác được
```

Ví dụ sai:

```text
Hóa học HK1 lớp 10A1 có component riêng
Hóa học HK1 khối 10 có component riêng
Hóa học HK1 subjectVersion A có component riêng
```

### 3. Promotion

Promotion là all-only theo năm học.

Không có option xét theo lớp.

Không còn `classId` trong promotion API/UI.

Workflow mới chỉ tạo `PASS` hoặc `FAIL`. Giữ enum `RETAKE` để không phá dữ liệu/seed/report cũ.

## Current Code Context

Các file chính cần đọc trước khi sửa:

- `backend/prisma/schema.prisma`
- `backend/src/routes/subject.routes.js`
- `backend/src/routes/score-component.routes.js`
- `backend/src/routes/score.routes.js`
- `backend/src/routes/promotion.routes.js`
- `backend/src/routes/settings.routes.js`
- `frontend/src/app/(dashboard)/subjects/page.tsx`
- `frontend/src/app/(dashboard)/scores/page.tsx`
- `frontend/src/app/(dashboard)/promotion/page.tsx`
- `frontend/src/app/(dashboard)/classes/page.tsx`
- `frontend/src/app/(dashboard)/class-transfer/page.tsx`
- `frontend/src/app/(dashboard)/students/[id]/scores/page.tsx`
- `frontend/src/app/(dashboard)/my-scores/page.tsx`
- `frontend/src/app/(dashboard)/my-children/[studentId]/scores/page.tsx`

Docs cần update sau khi implement:

- `docs/system/database/academic-structure.md`
- `docs/system/database/scoring-models.md`
- `docs/system/scoring-system/score-components.md`
- `docs/system/scoring-system/promotion-calculation.md`
- `docs/system/backend/api-endpoints.md`
- `docs/system/business-rules/regulations.md`
- `docs/system/business-rules/validations.md`
- `docs/system/data-flows/score-entry-flow.md`

## Target Database Design

### Subject

Giữ là master record.

```prisma
model Subject {
  id          String
  tenantId    String
  name        String
  code        String
  description String?
  isActive    Boolean

  versions              SubjectVersion[]
  scoreComponentSets    ScoreComponentSet[]
  scores                Score[]
  teacherAssignments    TeacherAssignment[]

  @@unique([tenantId, code])
}
```

### SubjectVersion

Thêm model mới.

```prisma
model SubjectVersion {
  id             String
  tenantId       String
  subjectId      String
  academicYearId String
  versionName    String?
  isActive       Boolean
  createdAt      DateTime
  updatedAt      DateTime

  subject        Subject
  academicYear   AcademicYear
  gradeScopes    SubjectVersionGrade[]
  classScopes    SubjectVersionClass[]
  scores         Score[]

  @@unique([tenantId, subjectId, academicYearId])
  @@index([tenantId, academicYearId])
  @@index([tenantId, subjectId])
}
```

### SubjectVersionGrade

```prisma
model SubjectVersionGrade {
  id               String
  tenantId         String
  subjectVersionId String
  gradeId          String

  subjectVersion   SubjectVersion
  grade            Grade

  @@unique([subjectVersionId, gradeId])
  @@index([tenantId, gradeId])
}
```

### SubjectVersionClass

```prisma
model SubjectVersionClass {
  id               String
  tenantId         String
  subjectVersionId String
  classId          String

  subjectVersion   SubjectVersion
  class            Class

  @@unique([subjectVersionId, classId])
  @@index([tenantId, classId])
}
```

### ScoreComponentSet

Thêm model mới. Đây là source of truth của đầu điểm.

```prisma
model ScoreComponentSet {
  id         String
  tenantId   String
  subjectId  String
  semesterId String
  isActive   Boolean
  createdAt  DateTime
  updatedAt  DateTime

  subject    Subject
  semester   Semester
  components ScoreComponent[]

  @@unique([tenantId, subjectId, semesterId])
  @@index([tenantId, semesterId])
  @@index([tenantId, subjectId])
}
```

### ScoreComponent

Chuyển từ gắn trực tiếp `Subject` sang gắn `ScoreComponentSet`.

```prisma
model ScoreComponent {
  id                  String
  tenantId            String
  scoreComponentSetId String
  name                String
  weight              Int
  displayOrder        Int
  isActive            Boolean
  createdAt           DateTime
  updatedAt           DateTime

  scoreComponentSet   ScoreComponentSet
  scores              Score[]

  @@unique([scoreComponentSetId, displayOrder])
  @@index([tenantId, scoreComponentSetId])
}
```

Không giữ unique theo `tenantId + subjectId + name`.

Lý do: có thể có `15 phút lần 1`, `15 phút lần 2`; name nên là label hiển thị, không phải identity chính.

### Score

Thêm `subjectVersionId` nullable để truy vết môn áp dụng tại thời điểm nhập điểm.

```prisma
model Score {
  id               String
  tenantId         String
  studentId        String
  subjectId        String
  subjectVersionId String?
  semesterId       String
  scoreComponentId String
  value            Float
  isLocked         Boolean

  subjectVersion   SubjectVersion?

  @@unique([studentId, subjectId, semesterId, scoreComponentId])
  @@index([tenantId, subjectVersionId])
}
```

`subjectId` vẫn giữ để report cũ không vỡ.

`scoreComponentId` vẫn là component cụ thể.

`subjectVersionId` chỉ để audit/trace scope môn, không dùng để resolve component set.

## Resolve Rules

### Resolve subject for class/year

Input:

```text
tenantId, academicYearId, classId
```

Steps:

1. Load class by `classId + tenantId`.
2. Verify class belongs to `academicYearId`.
3. Load active `SubjectVersion` in `academicYearId`.
4. A version applies if:
   - has class scope matching `classId`, or
   - has no matching class scope but has grade scope matching class.gradeId.
5. Return applied subject versions with subject info.

Important:

- Class scope is more specific than grade scope.
- If a subject version has only class scopes, grade scope should not auto-apply.
- If a subject has version for year but no matching scope, subject does not apply.

### Resolve component set

Input:

```text
tenantId, subjectId, semesterId
```

Steps:

1. Find active `ScoreComponentSet`.
2. Include active `ScoreComponent`, ordered by `displayOrder asc`.
3. Validate sum weight <= 100.
4. If set missing, return empty set with warning, not fallback global silently.

Important:

- Do not include classId.
- Do not include gradeId.
- Do not include subjectVersionId.

### Validate score save

Input:

```text
studentId, classId, subjectId, semesterId, scoreComponentId
```

Steps:

1. Student must belong to tenant.
2. Student must have `ClassEnrollment` for `semesterId`.
3. Enrollment class must match selected class or teacher permission scope.
4. Semester academic year decides `academicYearId`.
5. Subject must apply to class via `SubjectVersion` scope.
6. Component must belong to `ScoreComponentSet(subjectId, semesterId)`.
7. Score value must be between tenant `minScore` and `maxScore`.
8. Existing locked score cannot be changed.
9. Upsert score with `subjectVersionId` from resolved subject version.

## API Plan

### Subjects

`GET /api/subjects`

Current behavior can stay for simple subject list.

Add optional query:

```text
academicYearId
classId
includeVersions
```

When `academicYearId + classId` present, return effective subjects for that class/year.

Response shape:

```json
{
  "data": [
    {
      "id": "subject-id",
      "code": "HOA",
      "name": "Hóa học",
      "subjectVersionId": "version-id",
      "scopeType": "GRADE",
      "academicYearId": "year-id"
    }
  ]
}
```

`POST /api/subjects/:subjectId/versions`

Create version for academic year.

Body:

```json
{
  "academicYearId": "year-id",
  "versionName": "Hóa học 2025-2026"
}
```

`PUT /api/subject-versions/:id/scope`

Replace scope in transaction.

Body:

```json
{
  "gradeIds": ["grade-id"],
  "classIds": ["class-id"]
}
```

Validation:

- All grades/classes same tenant.
- All classes belong to version academic year.
- Cannot leave both arrays empty unless version is being disabled.

### Score component sets

Prefer new route:

```text
/api/score-component-sets
```

`GET /api/score-component-sets?subjectId=&semesterId=`

Return one set and components.

`PUT /api/score-component-sets`

Create/update full set for subject + semester.

Body:

```json
{
  "subjectId": "subject-id",
  "semesterId": "semester-id",
  "components": [
    { "id": "optional-existing-id", "name": "Miệng", "weight": 10, "displayOrder": 1, "isActive": true },
    { "name": "15 phút lần 1", "weight": 15, "displayOrder": 2, "isActive": true }
  ]
}
```

Rules:

- Total active weight <= 100.
- Component with score cannot be deleted.
- If component with score removed from payload, mark inactive instead of delete.
- If active total != 100, allow save but return warning.
- If active total > 100, reject.

`POST /api/score-component-sets/clone`

Clone from one semester to another.

Body:

```json
{
  "subjectId": "subject-id",
  "sourceSemesterId": "semester-id",
  "targetSemesterId": "semester-id",
  "overwrite": false
}
```

Rules:

- If target already has active components and `overwrite=false`, reject.
- If overwriting target with existing scores, reject.

### Scores

`GET /api/scores/class/:classId?subjectId=&semesterId=`

Must:

- Derive academic year from semester.
- Validate subject applies to class.
- Resolve components by `subjectId + semesterId`.
- Return `subjectVersionId` in response.

Response should include:

```json
{
  "subjectVersionId": "version-id",
  "componentSet": {
    "id": "set-id",
    "subjectId": "subject-id",
    "semesterId": "semester-id",
    "components": []
  },
  "students": []
}
```

Score save endpoint must reject:

- Subject not applied to class.
- Component from another subject/semester.
- Student without enrollment in semester.
- Locked score update.

### Promotion

Remove `classId` from promotion flow.

Endpoints should be:

```text
POST /api/promotion/year-end/evaluate
GET  /api/promotion/year-end/results?academicYearId=
POST /api/promotion/year-end/execute
```

Evaluate body:

```json
{
  "academicYearId": "year-id"
}
```

Execute body:

```json
{
  "academicYearId": "year-id",
  "failAssignments": {},
  "confirmCreateMissingClasses": false
}
```

No `classId` accepted. If old frontend sends `classId`, ignore only during compatibility window or reject with `INVALID_FIELD`. Prefer reject after UI updated.

Promotion evaluate must:

1. Load all active students with enrollment in academic year.
2. Group by class/enrollment.
3. For each class, resolve applied subjects by subject versions.
4. For each semester in year, resolve required components by `subjectId + semesterId`.
5. Mark missing score if required component has no score.
6. Calculate average only when enough data exists.
7. Produce PASS/FAIL draft.

Promotion execute must:

- Require prior evaluate data or recompute safely.
- Block if next academic year missing.
- Block if next academic year has no semester.
- Detect missing target classes.
- Create missing target classes only when `confirmCreateMissingClasses=true`.
- Never auto-create semesters.
- Write placement history.

## Frontend Plan

### Subjects page

Split UI into two areas:

1. Subject catalog
2. Scope/version + component set configuration

Subject version controls:

- Select academic year.
- Select subject.
- Create/find version.
- Choose scope mode:
  - grades
  - classes
- If choosing classes, only show classes in selected academic year.

Component controls:

- Select subject.
- Select semester.
- Edit component list.
- Button clone from another semester.
- Show context label:

```text
Đang cấu hình: Hóa học - Học kỳ 1 (2025-2026)
```

Do not add class/grade controls in component editor.

### Scores page

Selection order:

1. Academic year, default active year.
2. Class in selected year.
3. Subject effective for selected class/year.
4. Semester in selected year.

When class changes:

- Reload effective subjects.
- Reset subject if no longer valid.

When semester changes:

- Reload component set by subject + semester.
- Do not reload subject scope unless year changed.

Empty states:

- No subject applies to class/year.
- No component set configured for subject/semester.
- Student has no enrollment in selected semester.

### Promotion page

Remove all class selector/filter UI.

User can only select academic year.

Actions:

- Evaluate all students in selected year.
- Execute promotion for all students.
- Confirm missing class creation if backend asks.

Text should be clear:

```text
Xét lên lớp toàn bộ học sinh năm học 2025-2026
```

### Semester labels

Every semester dropdown must display year:

```text
Học kỳ 1 (2025-2026)
Học kỳ 2 (2025-2026)
```

Backend can add:

```json
{
  "academicYearLabel": "2025-2026",
  "displayName": "Học kỳ 1 (2025-2026)",
  "isCurrent": true
}
```

Frontend should still have helper fallback.

## Settings Guards

Update `PUT /api/settings` guards:

- Cannot set `maxSubjects` below active subject count.
- Cannot set `maxSemesters` below max existing semesters in any academic year.
- Cannot shrink `minScore/maxScore` so existing scores fall outside range.
- Keep existing guards for `maxClassSize`, `minGradeLevel`, `maxGradeLevel`, `passScore`.
- `maxRetentions` only validate as integer >= 0. Do not use in promotion auto logic yet.

Error codes should be stable:

```text
MAX_SUBJECTS_BELOW_CURRENT_USAGE
MAX_SEMESTERS_BELOW_CURRENT_USAGE
SCORE_RANGE_HAS_EXISTING_DATA
MAX_CLASS_SIZE_BELOW_CURRENT_USAGE
GRADE_RANGE_HAS_EXISTING_DATA
PASS_SCORE_OUT_OF_RANGE
```

Frontend must show backend reason in Vietnamese.

## Classes And Transfer

### Classes

Class list must be year-aware.

- UI has year selector.
- `GET /classes` receives `academicYearId`.
- Create class sends selected `academicYearId`.
- Same class name in different years must not mix.

Delete class:

- If class has students, block with `CLASS_HAS_STUDENTS`.
- If class has no students, delete teacher assignments then delete class in transaction.
- Do not block delete only because teacher assignments exist.

### Transfer

Student picker should be async search:

- Debounce 300ms.
- `GET /students?search=&page=1&limit=20`.
- Do not render hundreds of students in a select.

Transfer validation:

- Target class must belong to academic year of active semester.
- Write in transaction:
  - `Student.classId`
  - `TransferHistory`
  - `ClassEnrollment`

## Migration Plan

### Phase 1: Prisma schema

Add:

- `SubjectVersion`
- `SubjectVersionGrade`
- `SubjectVersionClass`
- `ScoreComponentSet`

Update:

- `Tenant` relations.
- `Subject` relations.
- `AcademicYear` relation to subject versions.
- `Grade` relation to subject version grade scopes.
- `Class` relation to subject version class scopes.
- `ScoreComponent` relation to `ScoreComponentSet`.
- `Score.subjectVersionId`.

### Phase 2: SQL migration/backfill

Backfill rules:

1. For every tenant + academic year + active subject, create default subject version.
2. Default version applies to all grades that exist for tenant.
3. For every tenant + subject + semester, create score component set.
4. Move old score components into matching sets.
5. If old component was global by subject, duplicate it per semester so old score rows can keep pointing to valid component ids.
6. Map `scores.subjectVersionId` by:
   - score subject
   - score semester academic year
   - matching default subject version

Important:

- Do not rewrite score values.
- Do not delete old scores.
- Avoid destructive migrations until backfill verified.
- If component duplication is needed, preserve old component ids where possible for existing scores.

### Phase 3: Code dual-read

For a short compatibility window:

- New code reads component set first.
- If missing set, return empty warning.
- Do not silently use old global components after migration is expected complete.

### Phase 4: Remove old assumptions

Remove code relying on:

- `ScoreComponent.subjectId` as source of truth.
- `@@unique([tenantId, subjectId, name])`.
- Promotion `classId`.
- Subject list as global list for score entry.

## Suggested Implementation Order

1. Settings guards and Vietnamese errors.
2. Semester display fields and frontend helper.
3. Class list by academic year.
4. Delete class transaction cleanup.
5. Transfer async student search + year guard.
6. Prisma migration for subject versions and component sets.
7. Backfill script/migration verification.
8. Subject version API.
9. Score component set API.
10. Subjects page UI split.
11. Score entry resolve/validate by subject scope + component set.
12. Student profile and parent/student score pages use enrollment by semester.
13. Promotion all-only API and UI.
14. System docs update.
15. Full test/build.

## Test Checklist

### Subject scope

- Subject applied to grade 10 appears in class 10A1.
- Subject applied to grade 10 does not appear in class 11A1.
- Subject applied only to class 10A1 does not appear in 10A2.
- Same subject can have version in 2025-2026 and 2026-2027.
- Class list by academic year does not mix same class names.

### Component set

- Hóa HK1 2025-2026 has one component set.
- All classes learning Hóa in HK1 2025-2026 see the same components.
- Hóa HK2 2025-2026 can have different components.
- Hóa HK1 2026-2027 can have different components.
- UI has no class/grade selector in component editor.
- Total active weight > 100 is rejected.
- Total active weight < 100 is saved with warning.
- Component with scores is not hard deleted.

### Scores

- Score entry shows only subjects applied to selected class/year.
- Score entry shows components from `subjectId + semesterId`.
- Saving score with component from another semester is rejected.
- Saving score for student without enrollment in semester is rejected.
- Locked score cannot be edited.
- Historical scores still render after migration.
- Student profile for old semester shows old class from enrollment.

### Promotion

- UI has no class filter.
- Evaluate request sends only `academicYearId`.
- Backend ignores/rejects `classId`; no class-scoped promotion path remains.
- Evaluate covers all students with enrollment in year.
- Missing scores are calculated from subject scope and component sets.
- Missing next academic year blocks.
- Missing next semester blocks; no auto semester creation.
- Missing target classes are listed.
- Target classes created only after confirm.
- Results are only PASS/FAIL for new workflow.

### Settings

- Lowering `maxSubjects` below active subjects is rejected.
- Lowering `maxSemesters` below existing semester count is rejected.
- Shrinking score range below existing score values is rejected.
- Existing guards still pass/fail correctly.

### Transfer/classes

- Student search is paginated and debounced.
- Transfer to class outside active semester year is rejected.
- Transfer writes `Student.classId`, `TransferHistory`, `ClassEnrollment`.
- Delete empty class with teacher assignment succeeds.
- Delete class with students fails.

## Acceptance Criteria

Implementation is done only when:

- Prisma migration applies on fresh DB.
- Backfill works on seeded DB.
- `npm run build` or equivalent compile passes for frontend.
- Backend starts without Prisma/runtime errors.
- Score entry works for subject scope + component set.
- Promotion is all-only end to end.
- System docs updated.
- No hardcoded fake data to pass tests.

## Risk Notes

- Component migration is highest risk because existing scores point to old `scoreComponentId`.
- Promotion missing score logic must not use old global subject list.
- Teacher assignment permission may still be subject-based; make sure effective subject list does not bypass teacher scope.
- Avoid silently falling back to old global components, or bugs will be hidden.
- Keep tenantId on every new model and query.

## Unresolved Questions

Không có.
