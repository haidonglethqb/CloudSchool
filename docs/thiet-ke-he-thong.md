# 3. THIẾT KẾ HỆ THỐNG

## 3.1 Kiến trúc hệ thống

Ứng dụng web CloudSchool được thiết kế theo **kiến trúc 3 lớp (3-Tier Architecture)** như sau:

- **Presentation Tier:** hiển thị kết quả và tiếp nhận dữ liệu mà người sử dụng nhập vào.
- **Business Tier:** xử lý dữ liệu để lưu trữ hoặc hiển thị cho người sử dụng.
- **Data Tier:** lập chỉ mục, tìm kiếm, liên kết dữ liệu và lưu trữ dữ liệu.

### Mô hình hệ thống

```
┌──────────────────────────────────────────────────────┐
│               PRESENTATION TIER                      │
│          Trình duyệt Web (Chrome, Firefox,...)       │
│     Next.js 14 · TypeScript · Tailwind CSS           │
│         Zustand · React Hook Form + Zod · Axios      │
└────────────────────┬─────────────────────────────────┘
                     │  HTTP/HTTPS – RESTful API (JSON)
                     ▼
┌──────────────────────────────────────────────────────┐
│                BUSINESS TIER                         │
│          Web Server: Node.js + Express.js 5          │
│       18 API Routes (Auth, Student, Class, ...)      │
│    JWT · bcryptjs · express-validator · helmet       │
│              Prisma ORM (Data Access)                │
└────────────────────┬─────────────────────────────────┘
                     │  Prisma Client – TCP 5432
                     ▼
┌──────────────────────────────────────────────────────┐
│                  DATA TIER                           │
│               PostgreSQL 16                          │
│    20 bảng dữ liệu · Multi-Tenant (tenantId)        │
│          Docker Container + Volume                   │
└──────────────────────────────────────────────────────┘
```

---

**1) Lớp Presentation:**

- Hiển thị nội dung trang web như text, image, table, form, biểu đồ thống kê,...
- Thông dịch và thực thi các đoạn JavaScript phía client (React components).
- Thu thập dữ liệu nhập từ người dùng (form đăng nhập, form nhập điểm, form tiếp nhận học sinh,...) và gửi về cho lớp Business thông qua giao thức HTTP.
- Quản lý trạng thái phiên đăng nhập, vai trò người dùng và tenant hiện tại.

=> Lớp Presentation này được xây dựng bằng **Next.js 14** (App Router, TypeScript) – một framework React hỗ trợ Server-Side Rendering. Giao diện được thiết kế bằng **Tailwind CSS**, quản lý trạng thái bằng **Zustand**, kiểm tra dữ liệu nhập bằng **React Hook Form + Zod**, và gọi API bằng **Axios**. Người dùng truy cập ứng dụng thông qua trình duyệt web (Chrome, Firefox, Edge,...).

---

**2) Lớp Business:**

- Tiếp nhận thông tin cần xử lý từ lớp Presentation (các HTTP request dạng JSON).
- Kiểm tra, xác thực dữ liệu nhận được từ lớp Presentation (validation đầu vào, kiểm tra quyền truy cập theo vai trò).
- Xử lý nghiệp vụ: tính điểm trung bình, xét lên lớp, kiểm tra quy định tuổi/sĩ số, tạo báo cáo thống kê, quản lý multi-tenant,...
- Truy vấn hoặc truyền dữ liệu để lưu trữ tới lớp Data.

=> Lớp Business này sử dụng **Node.js** làm runtime và **Express.js 5** làm Web Server để giao tiếp với lớp Presentation theo giao thức HTTP (RESTful API). Để cài đặt các business rule, hệ thống sử dụng 18 module route (Auth, Student, Class, Score, Report,...). Xác thực người dùng bằng **JWT** (lưu trong cookie httpOnly), mã hóa mật khẩu bằng **bcryptjs**, kiểm tra dữ liệu đầu vào bằng **express-validator**, bảo mật bằng **helmet** và **express-rate-limit**. Truy cập dữ liệu thông qua **Prisma ORM**.

---

**3) Lớp Data:**

- Tiếp nhận thông tin cần xử lý từ lớp Business (các truy vấn SQL thông qua Prisma).
- Tìm kiếm, liên kết, tính toán và lưu trữ dữ liệu.
- Lập chỉ mục để hỗ trợ quá trình xử lý thông tin (index trên các cột tenantId, email, khóa ngoại,...).

=> Lớp Data này sử dụng **PostgreSQL 16** để làm nền tảng lưu trữ, xử lý dữ liệu theo mô hình quan hệ và giao tiếp với lớp Business thông qua **Prisma Client**. Công việc cần thực hiện ở lớp này là tạo 20 bảng dữ liệu (Tenant, User, Student, Class, Subject, Score, Promotion,...), các ràng buộc theo mô hình quan hệ (khóa chính, khóa ngoại, unique constraint) và cách ly dữ liệu multi-tenant bằng cột `tenantId` trên mỗi bảng. Cơ sở dữ liệu được chạy trong Docker container với volume để đảm bảo lưu trữ bền vững.

---

## 3.2 Mô tả các thành phần trong hệ thống

| STT | Thành phần | Diễn giải |
|:---:|-----------|-----------|
| 1 | **Next.js 14 (App Router)** | Framework React phía client, sử dụng TypeScript, chịu trách nhiệm hiển thị giao diện người dùng (UI), điều hướng trang (routing), và gọi API đến tầng xử lý thông qua Axios. Hỗ trợ Server-Side Rendering giúp trang tải nhanh hơn. |
| 2 | **Tailwind CSS** | Framework CSS utility-first, dùng để xây dựng giao diện responsive, tùy chỉnh theme theo thiết kế riêng của hệ thống. |
| 3 | **Zustand** | Thư viện quản lý trạng thái (state management) phía client, lưu trữ thông tin phiên đăng nhập, vai trò người dùng, tenant hiện tại. |
| 4 | **React Hook Form + Zod** | Quản lý form và kiểm tra dữ liệu đầu vào (validation) phía client trước khi gửi lên server, giúp giảm các request không hợp lệ. |
| 5 | **Node.js + Express.js 5** | Runtime và web framework phía server, tiếp nhận HTTP request, xử lý nghiệp vụ (business logic), và trả về response dạng JSON. Bao gồm 18 module route: Auth, Admin, Tenant, User, Student, Class, Subject, Score, ScoreComponent, Promotion, YearEndPromotion, Report, Settings, Parent, Export, Monitoring, Fee, AcademicYear. |
| 6 | **Prisma ORM** | Lớp truy cập dữ liệu (Data Access Layer), ánh xạ 20 bảng trong PostgreSQL thành các model TypeScript. Hỗ trợ migration tự động và seed dữ liệu mẫu. |
| 7 | **JWT + Cookie httpOnly** | Cơ chế xác thực: server tạo JSON Web Token sau khi đăng nhập, lưu vào cookie httpOnly để bảo vệ khỏi tấn công XSS. Mỗi request kèm token để xác minh danh tính và phân quyền (6 vai trò: PLATFORM_ADMIN, SUPER_ADMIN, STAFF, TEACHER, STUDENT, PARENT). |
| 8 | **bcryptjs** | Thư viện mã hóa mật khẩu một chiều (hash), đảm bảo mật khẩu không bao giờ được lưu dạng plaintext trong cơ sở dữ liệu. |
| 9 | **express-validator** | Thư viện kiểm tra và làm sạch dữ liệu đầu vào tại lớp Business, ngăn chặn các dữ liệu không hợp lệ trước khi xử lý nghiệp vụ. |
| 10 | **PostgreSQL 16** | Hệ quản trị cơ sở dữ liệu quan hệ, lưu trữ toàn bộ dữ liệu hệ thống với 20 bảng. Hỗ trợ multi-tenant bằng cột `tenantId` trên mỗi bảng, đảm bảo cách ly dữ liệu hoàn toàn giữa các trường. Chạy trong Docker container với volume để lưu trữ bền vững. |
| 11 | **Docker + Docker Compose** | Công cụ container hóa, đóng gói 3 thành phần (Frontend, Backend, Database) thành các container độc lập, giao tiếp qua mạng nội bộ (bridge network). Đảm bảo môi trường triển khai đồng nhất. |
| 12 | **GitHub Actions (CI/CD)** | Pipeline tự động: build Docker image, push lên GitHub Container Registry (GHCR), deploy lên VPS, và chạy bộ test tự động (Playwright) sau mỗi lần deploy thành công. |
