# CloudSchool — System Specification

## 1. Kiến trúc tổng quan

### Multi-Tenant SaaS Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │  Login   │  │ Register │  │   Dashboard (6 roles)  │ │
│  │  Portal  │  │  School  │  │   Protected Routes     │ │
│  └────┬─────┘  └────┬─────┘  └────────┬───────────────┘ │
│       │              │                 │                  │
│       └──────────────┼─────────────────┘                  │
│                      │ Axios (httpOnly cookie)            │
└──────────────────────┼──────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────┐
│                Backend (Express.js 5)                    │
│  ┌───────────┐  ┌────┴────┐  ┌──────────────────────┐  │
│  │   Auth    │  │ Routes  │  │    Middleware         │  │
│  │  (JWT)    │  │  (13)   │  │ auth · tenantGuard   │  │
│  └───────────┘  └─────────┘  └──────────────────────┘  │
│                      │                                   │
│              ┌───────┴───────┐                           │
│              │  Prisma ORM   │                           │
│              └───────┬───────┘                           │
└──────────────────────┼──────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────┐
│              PostgreSQL Database                         │
│     Shared DB — tenant_id isolation per row              │
└─────────────────────────────────────────────────────────┘
```

### Mô hình Multi-Tenant

- **Shared Database**: Tất cả trường dùng chung 1 DB PostgreSQL
- **Row-Level Isolation**: Mỗi record có `tenantId` (FK → Tenant)
- **TenantGuard Middleware**: Tự động inject `tenantId` vào mọi query
- **Platform Admin**: Không có `tenantId`, truy vấn cross-tenant

---

## 2. Authentication & Authorization

### 2.1 Luồng đăng nhập

```
┌──────────────────────────────────────────────────────┐
│                  LOGIN PAGE                           │
│                                                      │
│  ┌──────────────────┐   ┌─────────────────────────┐  │
│  │  School Login     │   │  Platform Admin Toggle  │  │
│  │  - Email          │   │  (khi bật: ẩn mã trường│  │
│  │  - Password       │   │   chỉ cần email + pw)  │  │
│  │  - Mã trường (*)  │   │                         │  │
│  └────────┬─────────┘   └────────┬────────────────┘  │
│           │                       │                    │
└───────────┼───────────────────────┼────────────────────┘
            │                       │
            ▼                       ▼
    POST /api/auth/login      POST /api/auth/login
    body: {                   body: {
      email,                    email,
      password,                 password
      tenantCode: "THPT-DEMO"  // không có tenantCode
    }                         }
            │                       │
            ▼                       ▼
    Backend:                  Backend:
    1. Tìm Tenant by code    1. Tìm User PLATFORM_ADMIN
    2. Tìm User in tenant    2. Verify password
    3. Verify password        3. Set JWT cookie
    4. Set JWT cookie
```

### 2.2 JWT Cookie-Based Auth

```
Login thành công:
→ Set httpOnly cookie: "token" = JWT { id, role, tenantId }
→ cookie: { httpOnly: true, secure: production, sameSite: 'lax', maxAge: 24h }

Mọi request sau:
→ Browser tự gửi cookie
→ auth.js middleware: verify JWT → req.user = { id, role, tenantId }
→ tenantGuard: kiểm tra user.tenantId != null (trừ PLATFORM_ADMIN)
```

### 2.3 Middleware Chain

```
Request → authenticate → authorize(roles) → tenantGuard → Route Handler
   │           │              │                  │
   │     Verify JWT     Check role           Check tenantId
   │     Set req.user   in allowed list      exists (non-admin)
```

### 2.4 Phân quyền chi tiết

| Endpoint Group | PLATFORM_ADMIN | SUPER_ADMIN | STAFF | TEACHER | STUDENT | PARENT |
|---------------|:-:|:-:|:-:|:-:|:-:|:-:|
| Admin Schools & Subscriptions | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Users CRUD | ❌ | ✅ | R | ❌ | ❌ | ❌ |
| Students CRUD | ❌ | ✅ | ✅ | R | ❌ | ❌ |
| Classes CRUD | ❌ | ✅ | ✅ | R | ❌ | ❌ |
| Subjects & Semesters | ❌ | ✅ | ✅ | R | ❌ | ❌ |
| Score Components | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Score Entry | ❌ | ✅ | ✅ | ✅* | ❌ | ❌ |
| Score View (own) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Promotion | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reports | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Settings & Grades | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Parents CRUD | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| My Children (PH view) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Tenant Info | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

> *TEACHER chỉ nhập điểm lớp được phân công (TeacherAssignment)

---

## 3. Database Schema

### 3.1 Entity Relationship

```
SubscriptionPlan 1──N Tenant
Tenant 1──N User
Tenant 1──N Grade 1──N Class
Tenant 1──N Subject 1──N ScoreComponent
Tenant 1──N Semester
Tenant 1──1 TenantSettings

Class N──1 Grade
Class 1──N TeacherAssignment N──1 User(TEACHER), Subject
Class 1──N Student

Student 1──N Score N──1 ScoreComponent, Semester
Student 1──N ParentStudent N──1 User(PARENT)
Student 1──N Promotion N──1 Semester

User 1──N ActivityLog
```

### 3.2 Models chi tiết

#### SubscriptionPlan
```
id             Int       @id
name           String    "Cơ bản", "Nâng cao", ...
price          Float     Giá gói
studentLimit   Int       Giới hạn HS
teacherLimit   Int       Giới hạn GV
classLimit     Int       @default(30)
features       String[]  Danh sách tính năng
isActive       Boolean   @default(true)
```

#### Tenant (Trường)
```
id          Int     @id
name        String  Tên trường
code        String  @unique  Mã trường (dùng để đăng nhập)
address     String?
phone       String?
email       String?
status      Enum    ACTIVE | SUSPENDED | INACTIVE
planId      Int?    FK → SubscriptionPlan
```

#### TenantSettings (Quy định riêng mỗi trường)
```
tenantId     Int    @unique FK → Tenant
minAge       Int    @default(15)  Tuổi tối thiểu (QD1)
maxAge       Int    @default(20)  Tuổi tối đa (QD1)
maxClassSize Int    @default(40)  Sĩ số tối đa (QD2)
passScore    Float  @default(5.0) Điểm đạt (QD5)
```

#### User
```
id         Int     @id
email      String
password   String  (bcrypt hash)
fullName   String
role       Enum    PLATFORM_ADMIN | SUPER_ADMIN | STAFF | TEACHER | STUDENT | PARENT
tenantId   Int?    null cho PLATFORM_ADMIN
isActive   Boolean @default(true)
```
> Unique constraint: (email, tenantId) — cùng email có thể tồn tại ở trường khác

#### Grade (Khối lớp)
```
id        Int     @id
name      String  "Khối 10", "Khối 11", "Khối 12"
level     Int     10, 11, 12
tenantId  Int     FK → Tenant
```

#### Class (Lớp)
```
id           Int     @id
name         String  "10A1", "11B2"
gradeId      Int     FK → Grade
tenantId     Int     FK → Tenant
academicYear String  "2024-2025"
capacity     Int     @default(40)
```
> Unique constraint: (name, tenantId, academicYear)

#### Subject (Môn học)
```
id          Int      @id
name        String   "Toán", "Văn", ...
description String?
tenantId    Int      FK → Tenant
isActive    Boolean  @default(true)  (soft delete)
```

#### ScoreComponent (Đầu điểm)
```
id        Int     @id
name      String  "Kiểm tra miệng", "15 phút", "1 tiết", "Cuối kỳ"
weight    Int     Trọng số (%)  — tổng các đầu điểm ≤ 100
subjectId Int     FK → Subject
tenantId  Int     FK → Tenant
```
> **Logic**: Khi tạo/sửa ScoreComponent, backend kiểm tra tổng weight các component cùng subject ≤ 100

#### Semester (Học kỳ)
```
id        Int      @id
name      String   "Học kỳ 1 - 2024-2025"
startDate DateTime
endDate   DateTime
tenantId  Int      FK → Tenant
isActive  Boolean  @default(true)
```

#### Student (Học sinh)
```
id          Int      @id
studentCode String   Auto-gen: "HS" + timestamp
fullName    String
dateOfBirth DateTime
gender      Enum     MALE | FEMALE
address     String?
classId     Int?     FK → Class
tenantId    Int      FK → Tenant
parentName  String?
parentPhone String?
```
> **Kiểm tra tuổi (QD1)**: Khi thêm HS, tính tuổi = năm hiện tại - năm sinh. Kiểm tra minAge ≤ tuổi ≤ maxAge
> **Kiểm tra sĩ số (QD2)**: Đếm HS trong lớp, so với maxClassSize hoặc class.capacity

#### Score (Điểm)
```
id               Int     @id
value            Float   Điểm 0-10
studentId        Int     FK → Student
scoreComponentId Int     FK → ScoreComponent
semesterId       Int     FK → Semester
tenantId         Int     FK → Tenant
isLocked         Boolean @default(false)
```
> Unique constraint: (studentId, scoreComponentId, semesterId) — mỗi HS chỉ có 1 điểm mỗi đầu điểm mỗi kỳ
> Backend dùng `upsert` để insert hoặc update

#### ParentStudent (Liên kết PH-HS)
```
parentId     Int     FK → User
studentId    Int     FK → Student
relationship String  "Bố", "Mẹ", "Người giám hộ"
isPrimary    Boolean @default(false)
```

#### Promotion (Xét lên lớp)
```
id             Int     @id
studentId      Int     FK → Student
semesterId     Int     FK → Semester
averageScore   Float   ĐTB có trọng số
result         Enum    PASS | FAIL | RETAKE
tenantId       Int     FK → Tenant
```

#### ActivityLog (Nhật ký)
```
id        Int      @id
userId    Int      FK → User
action    String   "CREATE_STUDENT", "UPDATE_SCORE", ...
details   String?  JSON string chi tiết
tenantId  Int      FK → Tenant
createdAt DateTime
```

---

## 4. Hệ thống điểm

### 4.1 Score Components (Đầu điểm)

Mỗi môn có N đầu điểm, mỗi đầu điểm có trọng số (weight %). Tổng trọng số ≤ 100%.

**Ví dụ môn Toán:**
| Đầu điểm | Weight |
|-----------|--------|
| Kiểm tra miệng | 10% |
| KT 15 phút | 20% |
| KT 1 tiết | 30% |
| Thi cuối kỳ | 40% |
| **Tổng** | **100%** |

### 4.2 Công thức tính ĐTB

```
ĐTB = Σ (điểm_i × weight_i) / Σ weight_i

Ví dụ:
  Miệng: 8 × 10 = 80
  15 phút: 7 × 20 = 140
  1 tiết: 6 × 30 = 180
  Cuối kỳ: 7 × 40 = 280
  ĐTB = (80+140+180+280) / (10+20+30+40) = 680/100 = 6.8
```

### 4.3 Xét lên lớp (Promotion)

```
POST /api/promotion/calculate
Body: { classId, semesterId }

Logic:
1. Lấy tất cả HS trong classId
2. Mỗi HS: lấy tất cả Score trong semesterId
3. Tính ĐTB theo công thức trên
4. So sánh với passScore (từ TenantSettings)
5. Kết quả:
   - ĐTB >= passScore → PASS
   - ĐTB < passScore → FAIL
6. Upsert vào bảng Promotion
```

### 4.4 Lock/Unlock điểm

- Điểm đã lock không thể sửa/xóa
- Chỉ SUPER_ADMIN và STAFF có quyền lock/unlock
- Frontend hiện icon khóa, disable input khi locked

---

## 5. Frontend Architecture

### 5.1 Routing

```
/login                          → Cổng đăng nhập chung
/register                       → Đăng ký trường mới
/(dashboard)/                   → Layout chung (sidebar + menu theo role)
  ├── dashboard                 → Dashboard tổng hợp (6 roles)
  ├── admin/schools             → Quản lý trường (PLATFORM_ADMIN only)
  ├── admin/subscriptions       → Gói dịch vụ (PLATFORM_ADMIN only)
  ├── users                     → Quản lý người dùng
  ├── students                  → DS học sinh
  │   ├── new                   → Thêm HS mới
  │   └── [id]                  → Chi tiết HS
  │       └── edit              → Sửa HS
  ├── classes                   → DS lớp
  │   └── [id]                  → Chi tiết lớp + phân công GV
  ├── subjects                  → Môn học + đầu điểm
  ├── scores                    → Nhập điểm (chọn lớp → môn → kỳ)
  ├── promotion                 → Xét lên lớp
  ├── reports                   → Báo cáo
  ├── parents                   → Quản lý phụ huynh
  ├── settings                  → Quy định + khối lớp
  ├── my-children               → PH xem con em
  │   └── [studentId]/scores    → Điểm con em
  └── my-scores                 → HS xem điểm cá nhân
```

### 5.2 Dashboard Sidebar Menu theo Role

| Menu Item | PLATFORM_ADMIN | SUPER_ADMIN | STAFF | TEACHER | STUDENT | PARENT |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quản lý Trường | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gói Dịch vụ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Người dùng | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Học sinh | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lớp học | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Môn học | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Nhập điểm | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Xét lên lớp | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Báo cáo | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Phụ huynh | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Quy định | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Con em tôi | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Điểm của tôi | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

### 5.3 State Management (Zustand)

```typescript
// store/auth.ts
interface AuthState {
  user: User | null        // { id, email, fullName, role, tenantId }
  isAuthenticated: boolean
  setAuth(user)            // set user + isAuthenticated
  logout()                 // clear state, remove cookie
}
// Sử dụng persist middleware → lưu vào localStorage
```

### 5.4 API Client (Axios)

```typescript
// lib/api.ts
const api = axios.create({
  baseURL: NEXT_PUBLIC_API_URL,
  withCredentials: true    // Tự gửi cookie
})

// Response interceptor: 401 → redirect /login
// 13 API modules: authApi, adminApi, userApi, studentApi, classApi,
//   subjectApi, scoreComponentApi, scoreApi, promotionApi, reportApi,
//   parentApi, settingsApi, tenantApi
```

---

## 6. Backend Logic chi tiết

### 6.1 Middleware

#### authenticate (auth.js)
1. Lấy cookie `token` từ request
2. Verify JWT với `JWT_SECRET`
3. Query User by id (include tenant)
4. Set `req.user` = { id, email, fullName, role, tenantId, tenant }
5. Nếu lỗi → 401 Unauthorized

#### authorize(...roles) (auth.js)
1. Kiểm tra `req.user.role` in allowed `roles` array
2. Nếu không → 403 Forbidden

#### tenantGuard (auth.js)
1. Nếu `req.user.role === 'PLATFORM_ADMIN'` → skip
2. Nếu `req.user.tenantId` null → 403 "No tenant access"
3. Pass → để route handler dùng `req.user.tenantId`

### 6.2 Error Handling

```
Global errorHandler middleware bắt:
- Prisma P2002 (Unique constraint) → 409 "Dữ liệu đã tồn tại"
- Prisma P2025 (Record not found) → 404 "Không tìm thấy"
- ValidationError (express-validator) → 400 + details
- JsonWebTokenError → 401 "Token không hợp lệ"
- TokenExpiredError → 401 "Token hết hạn"
- AppError (custom) → status + message
- Unknown → 500 "Internal Server Error"
```

### 6.3 Route Logic Highlights

#### Student Admission (POST /api/students)
```
1. Validate input (fullName, dateOfBirth, gender required)
2. Lấy TenantSettings (minAge, maxAge, maxClassSize)
3. Tính tuổi = năm hiện tại - năm sinh
4. if (tuổi < minAge || tuổi > maxAge) → 400 "Không đủ tuổi"
5. if (classId) {
     Đếm HS trong class
     if (count >= maxClassSize) → 400 "Lớp đã đầy"
   }
6. Tạo studentCode: "HS" + Date.now()
7. Insert Student
```

#### Score Entry (POST /api/scores/batch)
```
1. Validate array of { studentId, scoreComponentId, semesterId, value }
2. Mỗi item: kiểm tra 0 ≤ value ≤ 10
3. Kiểm tra điểm chưa bị lock (isLocked = false)
4. Dùng Prisma transaction + upsert (insert nếu chưa có, update nếu đã có)
5. Return danh sách scores đã save
```

#### Teacher Score Entry (kiểm tra quyền)
```
1. TEACHER gọi GET /api/scores/class/:classId
2. Backend kiểm tra TeacherAssignment: user được phân công cho class này không?
3. Nếu không → 403 "Bạn không được phân công cho lớp này"
4. Nếu có → trả về bảng điểm
```

#### Promotion Calculate (POST /api/promotion/calculate)
```
1. Input: { classId, semesterId }
2. Lấy tất cả Students trong class
3. Lấy tất cả ScoreComponents (đầu điểm) thuộc tenant
4. Mỗi student:
   a. Lấy tất cả Scores trong semester
   b. Tính weighted average:
      totalWeighted = Σ(score.value * component.weight)
      totalWeight = Σ(component.weight) — chỉ tính component có score
      avg = totalWeighted / totalWeight
   c. So sánh với passScore (TenantSettings)
   d. Upsert Promotion: PASS hoặc FAIL
5. Return danh sách kết quả
```

---

## 7. Business Rules (Quy định)

| Mã | Quy định | Mặc định | Cấu hình |
|----|----------|----------|----------|
| QD1 | Tuổi tiếp nhận HS | 15-20 | Settings → minAge, maxAge |
| QD2 | Sĩ số tối đa/lớp | 40 | Settings → maxClassSize |
| QD3 | Khối lớp | 10, 11, 12 | Settings → Grades CRUD |
| QD4 | Thang điểm | 0-10 | Cố định |
| QD5 | Điểm đạt | 5.0 | Settings → passScore |
| QD6 | Đầu điểm | Tùy cấu hình | ScoreComponent CRUD, tổng weight ≤ 100% |

---

## 8. Data Flow Examples

### 8.1 Đăng ký trường mới

```
1. User truy cập /register
2. Nhập: Tên trường, Mã trường, Email admin, Tên admin, Password
3. POST /api/auth/register-school
4. Backend:
   a. Kiểm tra mã trường chưa tồn tại
   b. Tạo Tenant (status: ACTIVE)
   c. Tạo TenantSettings (default)
   d. Tạo User (role: SUPER_ADMIN, tenantId)
   e. Tạo JWT token → set cookie
5. Redirect → /dashboard
```

### 8.2 Nhập điểm cho lớp

```
1. GV/Staff truy cập /scores
2. Chọn Lớp → Tải DS HS
3. Chọn Môn → Tải đầu điểm (ScoreComponents)
4. Chọn Học kỳ
5. GET /api/scores/class/:classId?subjectId=X&semesterId=Y
6. Hiện bảng điểm: Rows = HS, Columns = ScoreComponents
7. Nhập điểm vào ô
8. Click "Lưu tất cả"
9. POST /api/scores/batch (array of scores)
10. Backend upsert từng score
```

### 8.3 Phụ huynh xem điểm con

```
1. PH đăng nhập (email + mã trường)
2. Tự động vào /my-children
3. GET /api/parents/my-children → DS con em (qua ParentStudent)
4. Click "Xem điểm" → /my-children/[studentId]/scores
5. GET /api/parents/my-children/:studentId/scores?semesterId=X
6. Hiện bảng điểm + ĐTB
```

---

## 9. Security

### 9.1 Authentication
- Password hash: bcryptjs (10 rounds)
- JWT: httpOnly cookie, SameSite=Lax, Secure in production
- Token expiry: 24 hours
- Logout: clear cookie

### 9.2 Authorization
- 3-layer: authenticate → authorize(roles) → tenantGuard
- Role whitelist per endpoint
- Tenant isolation: query always includes tenantId

### 9.3 Input Validation
- express-validator cho mọi input
- Zod schema validation ở frontend
- Prisma type safety

### 9.4 Other
- Helmet.js: security headers
- CORS: whitelist CORS_ORIGIN
- Error handler: không leak stack trace ở production

---

## 10. Deployment

### Environment Variables

#### Backend (.env)
```
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/cloudschool
JWT_SECRET=<random-256-bit-string>
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://your-domain.com
NODE_ENV=production
```

#### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
```

### Docker Production

```bash
docker-compose up -d --build
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run db:seed  # lần đầu
```

### Ports
- Frontend: 3000
- Backend: 5000
- PostgreSQL: 5432
