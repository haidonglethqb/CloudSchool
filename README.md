# CloudSchool - Hệ thống Quản lý Trường học SaaS (Multi-Tenant)

Hệ thống quản lý trường học đa tổ chức (multi-tenant), hỗ trợ nhiều trường cùng vận hành trên một nền tảng duy nhất, với phân quyền 6 vai trò và cách ly dữ liệu hoàn toàn.

## Tổng quan

CloudSchool là nền tảng SaaS cho phép:
- **Platform Admin** quản lý toàn bộ các trường, gói dịch vụ
- Mỗi **trường** tự đăng ký, quản lý học sinh, giáo viên, điểm, báo cáo
- **Phụ huynh** theo dõi điểm con em qua tài khoản riêng
- Dữ liệu được cách ly hoàn toàn giữa các trường (multi-tenant)

## Tính năng chính

| Module | Mô tả |
|--------|-------|
| Đăng nhập & Đăng ký trường | Cổng đăng nhập chung cho tất cả trường + cổng riêng cho Platform Admin |
| Quản lý trường (Platform Admin) | CRUD trường, tạm ngưng/kích hoạt, quản lý gói dịch vụ |
| Quản lý người dùng | CRUD người dùng với phân quyền: SUPER_ADMIN, STAFF, TEACHER |
| Tiếp nhận học sinh | Thêm HS với kiểm tra tuổi (QD1) và sĩ số lớp (QD2) |
| Quản lý lớp học | CRUD lớp, phân công giáo viên, chuyển lớp HS |
| Quản lý môn học & đầu điểm | CRUD môn, cấu hình đầu điểm (ScoreComponent) với trọng số linh hoạt |
| Nhập điểm | Nhập điểm theo đầu điểm, batch save, lock điểm |
| Xét lên lớp | Tính ĐTB, xét Đạt/Không đạt/Thi lại |
| Báo cáo | Báo cáo theo môn, theo học kỳ, dashboard tổng hợp |
| Quản lý phụ huynh | CRUD tài khoản PH, liên kết HS-PH |
| Xem điểm (Phụ huynh) | PH xem điểm con em theo học kỳ |
| Quy định trường | Cấu hình tuổi, sĩ số tối đa, điểm đạt, khối lớp |

## 6 Vai trò (Roles)

| Vai trò | Mô tả | Phạm vi |
|---------|-------|---------|
| `PLATFORM_ADMIN` | Quản trị nền tảng | Toàn hệ thống, không thuộc trường nào |
| `SUPER_ADMIN` | Quản trị trường | Toàn bộ dữ liệu 1 trường |
| `STAFF` | Nhân viên giáo vụ | Quản lý HS, lớp, điểm, PH |
| `TEACHER` | Giáo viên | Xem/nhập điểm lớp được phân công |
| `STUDENT` | Học sinh | Xem điểm cá nhân |
| `PARENT` | Phụ huynh | Xem điểm con em được liên kết |

## Tech Stack

### Backend
- **Node.js** + **Express.js 5**
- **Prisma ORM** + **PostgreSQL**
- **JWT** (httpOnly cookie, SameSite=Lax) authentication
- **bcryptjs** password hashing
- **express-validator** input validation
- **helmet** security headers (CSP, X-Content-Type-Options)
- **express-rate-limit** rate limiting
- **LRU cache** for user/settings performance optimization
- **ExcelJS** for Excel export, **json2csv** for CSV export (with formula injection prevention)

### Frontend
- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (custom theme)
- **Zustand** (state management, sessionStorage persistence)
- **React Hook Form** + **Zod** (form validation)
- **Axios** (API client with interceptors, blob error handling)
- **Lucide React** (icons)

### DevOps
- **Docker** + **Docker Compose**
- **PostgreSQL 16**

---

## Cài đặt & Chạy

### Yêu cầu

- **Docker** + **Docker Compose** (bắt buộc cho PostgreSQL)
- **Node.js** >= 18
- **npm**

---

### 🚀 Development — Chạy nhanh (copy & paste)

#### Bước 1: Clone repo

```bash
git clone <repo-url> cloudschool
cd cloudschool
```

#### Bước 2: Tạo file cấu hình môi trường

**Linux / macOS:**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

**Windows (PowerShell):**
```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

> File `.env.example` đã có sẵn giá trị mặc định khớp với `docker-compose.dev.yml`, **không cần chỉnh sửa gì** nếu chạy local.

#### Bước 3: Khởi động PostgreSQL bằng Docker

```bash
docker-compose -f docker-compose.dev.yml up -d
```

> PostgreSQL 16 sẽ chạy trên port `5432` với user `postgres`, password `postgres123`, database `cloudschool`.

#### Bước 4: Cài dependencies & khởi tạo database

```bash
# Cài packages cho backend
cd backend
npm install

# Tạo Prisma client + database tables + seed dữ liệu mẫu
npx prisma generate
npx prisma db push
npm run db:seed

# Cài packages cho frontend
cd ../frontend
npm install
```

#### Bước 5: Chạy ứng dụng

Mở **2 terminal riêng biệt**:

```bash
# Terminal 1 — Backend (port 5001)
cd backend
npm run dev
```

```bash
# Terminal 2 — Frontend (port 3000)
cd frontend
npm run dev
```

> Mở trình duyệt tại **http://localhost:3000** để sử dụng. Backend API chạy tại **http://localhost:5001/api**.

---

### 🐳 Production (Docker Compose — full stack)

Không cần cài Node.js, tất cả chạy trong container.

```bash
# Build & chạy tất cả (DB + Backend + Frontend)
docker-compose up -d --build

# Chạy migration & seed lần đầu
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run db:seed
```

---

### Truy cập

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5001/api |
| Health check | http://localhost:5001/health |
| Prisma Studio | `cd backend && npx prisma studio` |

---

## Tài khoản Demo

Sau khi chạy `npm run db:seed`:

### Platform Admin (đăng nhập ở cổng riêng)

| Email | Password |
|-------|----------|
| admin@cloudschool.vn | admin123 |

### Demo School — Mã trường: `THPT-DEMO`

| Vai trò | Email | Password |
|---------|-------|----------|
| School Admin | admin@demo.school.vn | admin123 |
| Staff | staff@demo.school.vn | staff123 |
| Teacher | teacher@demo.school.vn | teacher123 |
| Parent 1 | parent1@demo.school.vn | parent123 |
| Parent 2 | parent2@demo.school.vn | parent123 |

> **Lưu ý**: Đăng nhập cho trường cần nhập **Mã trường** (Tenant Code). Platform Admin toggle ở nút riêng trên form đăng nhập.

---

## API Endpoints

### Authentication
```
POST /api/auth/login              # Đăng nhập (chung cho tất cả)
GET  /api/auth/plans              # Lấy danh sách gói công khai cho form đăng ký trường
POST /api/auth/register-school    # Đăng ký trường mới
GET  /api/auth/me                 # Lấy thông tin user hiện tại
POST /api/auth/logout             # Đăng xuất
```

### Platform Admin
```
GET    /api/admin/dashboard               # Dashboard tổng quan (growth charts)
GET    /api/admin/schools                  # Danh sách trường
POST   /api/admin/schools                  # Tạo trường
GET    /api/admin/schools/:id              # Chi tiết trường
PUT    /api/admin/schools/:id              # Sửa trường
DELETE /api/admin/schools/:id              # Xóa trường
PATCH  /api/admin/schools/:id/suspend      # Tạm ngưng
PATCH  /api/admin/schools/:id/activate     # Kích hoạt
GET    /api/admin/schools/:id/users        # DS users của trường
GET    /api/admin/schools/:id/stats        # Thống kê trường
GET    /api/admin/schools/:id/activity     # Nhật ký hoạt động trường
GET    /api/admin/subscriptions            # Danh sách gói
POST   /api/admin/subscriptions            # Tạo gói
PUT    /api/admin/subscriptions/:id        # Sửa gói
DELETE /api/admin/subscriptions/:id        # Xóa gói
```

### Monitoring (Platform Admin)
```
GET /api/monitoring/system-stats           # Thống kê hệ thống + biểu đồ tăng trưởng
GET /api/monitoring/activity-logs          # Nhật ký hoạt động (phân trang, lọc)
GET /api/monitoring/school-stats/:schoolId # Thống kê chi tiết 1 trường
```

### Users
```
GET    /api/users                  # Danh sách users (SUPER_ADMIN, STAFF)
GET    /api/users/:id              # Chi tiết user
POST   /api/users                  # Tạo user (SUPER_ADMIN)
PUT    /api/users/:id              # Sửa user
PATCH  /api/users/:id/disable      # Vô hiệu hóa
DELETE /api/users/:id              # Xóa user
```

### Students
```
GET    /api/students               # Danh sách HS
GET    /api/students/:id           # Chi tiết HS
POST   /api/students               # Thêm HS
PUT    /api/students/:id           # Sửa HS
DELETE /api/students/:id           # Xóa HS
POST   /api/students/:id/transfer  # Chuyển lớp (ghi lịch sử)
GET    /api/students/:id/transfer-history # Lịch sử chuyển lớp
```

### Classes
```
GET    /api/classes/grades          # Danh sách khối
GET    /api/classes                 # Danh sách lớp
GET    /api/classes/:id             # Chi tiết lớp
POST   /api/classes                 # Tạo lớp
PUT    /api/classes/:id             # Sửa lớp
DELETE /api/classes/:id             # Xóa lớp
POST   /api/classes/:id/assign-teacher     # Phân công GV
DELETE /api/classes/:id/assign-teacher/:id  # Hủy phân công
GET    /api/classes/:id/students    # DS HS trong lớp
POST   /api/classes/:id/students    # Thêm HS vào lớp
DELETE /api/classes/:id/students/:id # Xóa HS khỏi lớp
```

### Subjects & Semesters
```
GET    /api/subjects                # DS môn học
GET    /api/subjects/:id            # Chi tiết môn
POST   /api/subjects                # Tạo môn
PUT    /api/subjects/:id            # Sửa môn
DELETE /api/subjects/:id            # Xóa môn (soft delete)
GET    /api/subjects/semesters      # DS học kỳ
POST   /api/subjects/semesters      # Tạo học kỳ
PATCH  /api/subjects/semesters/:id  # Sửa học kỳ
DELETE /api/subjects/semesters/:id  # Xóa học kỳ
```

### Score Components
```
GET    /api/score-components        # DS đầu điểm
POST   /api/score-components        # Tạo đầu điểm
PUT    /api/score-components/:id    # Sửa đầu điểm
DELETE /api/score-components/:id    # Xóa đầu điểm
```

### Scores
```
GET    /api/scores/class/:classId     # Bảng điểm lớp
GET    /api/scores/student/:studentId # Điểm 1 HS
POST   /api/scores                    # Nhập 1 điểm
POST   /api/scores/batch              # Nhập nhiều điểm
PATCH  /api/scores/:id/lock           # Khóa điểm
PATCH  /api/scores/:id/unlock         # Mở khóa điểm (Admin)
POST   /api/scores/class/:classId/lock    # Khóa điểm cả lớp
POST   /api/scores/class/:classId/unlock  # Mở khóa điểm cả lớp
DELETE /api/scores/:id                # Xóa điểm
```

### Export
```
GET /api/export/students     # Xuất DS học sinh (CSV/Excel)
GET /api/export/classes      # Xuất DS lớp (CSV/Excel)
GET /api/export/scores       # Xuất bảng điểm (CSV/Excel)
GET /api/export/schools      # Xuất DS trường (Platform Admin, CSV/Excel)
```

### Promotion
```
GET  /api/promotion                 # DS xét lên lớp
POST /api/promotion/calculate       # Tính & xét lên lớp
PUT  /api/promotion/:id             # Chỉnh kết quả thủ công
```

### Reports
```
GET /api/reports/subject-summary    # Báo cáo theo môn
GET /api/reports/semester-summary   # Báo cáo học kỳ
GET /api/reports/dashboard          # Dashboard thống kê
```

### Parents
```
GET    /api/parents                 # DS phụ huynh (Admin)
POST   /api/parents                 # Tạo PH
PUT    /api/parents/:id             # Sửa PH
DELETE /api/parents/:id             # Xóa PH
POST   /api/parents/:id/students    # Liên kết HS
DELETE /api/parents/:id/students/:id # Hủy liên kết
GET    /api/parents/semesters       # DS học kỳ (PH)
GET    /api/parents/my-children     # Con em của tôi
GET    /api/parents/my-children/:id/scores # Điểm con em
```

### Settings
```
GET  /api/settings                  # Lấy quy định
PUT  /api/settings                  # Sửa quy định
GET  /api/settings/grades           # DS khối
POST /api/settings/grades           # Tạo khối
PUT  /api/settings/grades/:id       # Sửa khối
DELETE /api/settings/grades/:id     # Xóa khối
```

### Tenant
```
GET /api/tenants/current            # Thông tin trường hiện tại
PUT /api/tenants/current            # Cập nhật thông tin trường
GET /api/tenants/stats              # Thống kê trường
```

---

## Cấu trúc dự án

```
cloudschool/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema (20+ models)
│   │   └── seed.js                # Seed dữ liệu demo
│   ├── src/
│   │   ├── app.js                 # Express app + routes
│   │   ├── lib/prisma.js          # Prisma client
│   │   ├── middleware/
│   │   │   ├── auth.js            # authenticate, authorize, tenantGuard
│   │   │   └── errorHandler.js    # Global error handler + AppError
│   │   └── routes/
│   │       ├── auth.routes.js     # Login, register, me, logout
│   │       ├── admin.routes.js    # Platform admin: schools & subscriptions
│   │       ├── user.routes.js     # User CRUD
│   │       ├── student.routes.js  # Student CRUD + transfer + history
│   │       ├── class.routes.js    # Class CRUD + teacher assignments
│   │       ├── subject.routes.js  # Subject CRUD + semester CRUD
│   │       ├── score-component.routes.js  # Score component CRUD
│   │       ├── score.routes.js    # Score entry + batch + lock/unlock
│   │       ├── promotion.routes.js # Promotion calculate + override
│   │       ├── report.routes.js   # Reports
│   │       ├── parent.routes.js   # Parent CRUD + self-service
│   │       ├── settings.routes.js # Settings + grade CRUD
│   │       ├── tenant.routes.js   # Tenant info & stats
│   │       ├── export.routes.js   # CSV/Excel export (students, classes, scores, schools)
│   │       └── monitoring.routes.js # System monitoring + activity logs
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/             # Cổng đăng nhập chung
│   │   │   ├── register/          # Đăng ký trường
│   │   │   └── (dashboard)/       # Protected routes
│   │   │       ├── layout.tsx     # Sidebar + menu theo role
│   │   │       ├── dashboard/     # Dashboard 6 roles
│   │   │       ├── admin/schools/ # Quản lý trường (Platform Admin)
│   │   │       ├── admin/subscriptions/ # Gói dịch vụ
│   │   │       ├── admin/monitoring/ # Giám sát hệ thống
│   │   │       ├── admin/activity-logs/ # Nhật ký hoạt động
│   │   │       ├── users/         # Quản lý người dùng
│   │   │       ├── students/      # CRUD học sinh
│   │   │       ├── classes/       # CRUD lớp + phân công
│   │   │       ├── subjects/      # Môn học + đầu điểm
│   │   │       ├── scores/        # Nhập điểm
│   │   │       ├── promotion/     # Xét lên lớp
│   │   │       ├── reports/       # Báo cáo
│   │   │       ├── parents/       # Quản lý PH
│   │   │       ├── settings/      # Quy định + khối
│   │   │       ├── my-children/   # PH xem con em
│   │   │       └── my-scores/     # HS xem điểm
│   │   ├── lib/
│   │   │   ├── api.ts             # Axios client + all API modules
│   │   │   └── utils.ts           # Helpers
│   │   └── store/auth.ts          # Zustand auth store
│   └── package.json
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```

## License

MIT License