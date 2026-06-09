# Cẩm Nang Triển Khai CloudSchool (Docker, CI/CD & GitHub Actions)

Tài liệu này cung cấp hướng dẫn đầy đủ, chi tiết từ đầu đến cuối (Exhaustive & Comprehensive Guide) về cấu hình hệ thống, cài đặt môi trường phát triển (Development), cấu hình Docker/Docker Compose và toàn bộ quy trình vận hành CI/CD tự động bằng GitHub Actions lên VPS cho dự án CloudSchool.

---

## MỤC LỤC
1. [TỔNG QUAN KIẾN TRÚC & CÁC DỊCH VỤ (SERVICES)](#1-tong-quan-kien-truc--cac-dich-vu-services)
2. [CẤU HÌNH CHI TIẾT BIẾN MÔI TRƯỜNG (ENVIRONMENT VARIABLES)](#2-cau-hinh-chi-tiet-bien-moi-truong-environment-variables)
3. [HƯỚNG DẪN CÀI ĐẶT & CHẠY LOCAL (DEVELOPMENT SETUP)](#3-huong-dan-cai-dat--chay-local-development-setup)
4. [PHÂN TÍCH FILE CẤU HÌNH DOCKER & DOCKERFILE](#4-phan-tich-file-cau-hinh-docker--dockerfile)
5. [QUY TRÌNH CI/CD CHI TIẾT QUA GITHUB ACTIONS (DEPLOY.YML)](#5-quy-trinh-cicd-chi-tiet-qua-github-actions-deployyml)
6. [CÁC BƯỚC THỰC THI TRÊN VPS KHI DEPLOY (STEP-BY-STEP VPS SCRIPT)](#6-cac-buoc-thuc-thi-tren-vps-khi-deploy-step-by-step-vps-script)
7. [CƠ CHẾ MIGRATION & DỮ LIỆU SEED (MIGRATION FLOW & SEEDING)](#7-co-che-migration--du-lieu-seed-migration-flow--seeding)
8. [GIÁM SÁT HỆ THỐNG VÀ XỬ LÝ SỰ CỐ (MONITORING & TROUBLESHOOTING)](#8-giam-sat-he-thong-va-xu-ly-su-co-monitoring--troubleshooting)

---

## 1. TỔNG QUAN KIẾN TRÚC & CÁC DỊCH VỤ (SERVICES)

Hệ thống CloudSchool hoạt động dưới dạng một ứng dụng SaaS đa tổ chức (Multi-Tenant) sử dụng cơ chế chia sẻ cơ sở dữ liệu và phân tách dữ liệu logic theo cột `tenantCode` trong cơ sở dữ liệu PostgreSQL.

Khi vận hành trên môi trường Production, hệ thống được quản lý thông qua [docker-compose.yml](../../../docker-compose.yml) với 3 container chính chạy độc lập trong một mạng ảo riêng biệt:

```
                  ┌──────────────────────────────┐
                  │      User Browser (UI)       │
                  └──────────────┬───────────────┘
                                 │ Port 3000
                                 ▼
                  ┌──────────────────────────────┐
                  │    Next.js Frontend Container│
                  └──────────────┬───────────────┘
                                 │ API Requests
                                 │ Port 5000/5001
                                 ▼
                  ┌──────────────────────────────┐
                  │    Express Backend Container │
                  └──────────────┬───────────────┘
                                 │ Prisma / TCP
                                 │ Port 5432
                                 ▼
                  ┌──────────────────────────────┐
                  │   PostgreSQL DB Container    │
                  └──────────────────────────────┘
```

*   **Mạng nội bộ (`cloudschool-network`):** Bridge network giúp các container giao tiếp với nhau bằng service name (ví dụ: Backend gọi DB thông qua địa chỉ `postgres:5432` thay vì IP của VPS).
*   **Cơ chế liên kết và thứ tự khởi động (Startup Order):**
    1.  Khởi động `postgres` -> Chờ cho đến khi vượt qua vòng kiểm tra sức khỏe (`pg_isready`).
    2.  Khởi động `backend` sau khi `postgres` đã sẵn sàng -> Kiểm tra sức khỏe thông qua endpoint `/health`.
    3.  Khởi động `frontend` sau khi `backend` đã phản hồi trạng thái `healthy`.

---

## 2. CẤU HÌNH CHI TIẾT BIẾN MÔI TRƯỜNG (ENVIRONMENT VARIABLES)

Các biến cấu hình hệ thống được định nghĩa tại [environment-variables.md](./environment-variables.md) và được chia làm hai khu vực chính:

### 2.1 Cấu hình Backend (`backend/.env`)

| Biến Môi Trường | Giá Trị Dev | Giá Trị Production | Vai Trò & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| `PORT` | `5001` | `5000` | Cổng HTTP mà Express API lắng nghe bên trong Container. |
| `NODE_ENV` | `development` | `production` | Bật/tắt các tối ưu hóa production, ẩn các stack trace chi tiết khi xảy ra lỗi API. |
| `DATABASE_URL` | `postgresql://...` | `postgresql://...` | Connection string chứa thông tin tài khoản, mật khẩu, host, port và tên database để kết nối PostgreSQL qua Prisma. |
| `JWT_SECRET` | `change-me...` | *Khóa 256-bit ngẫu nhiên* | Khóa dùng để ký mã hóa token JWT. **Ràng buộc an toàn:** Trên Production, backend sẽ crash ngay lập tức nếu giá trị trùng với `change-me`, `your-super-secret` hoặc `default`. |
| `JWT_EXPIRES_IN` | `24h` | `24h` | Thời gian hết hạn của token đăng nhập. |
| `CORS_ORIGIN` | `http://localhost:3000` | `https://your-app.com` | Tên miền Frontend được phép gửi request API lên Backend để chống tấn công CSRF. |
| `COOKIE_SECURE` | `false` | `true` | Đặt là `true` để cookie lưu JWT chỉ được gửi qua kết nối HTTPS bảo mật (yêu cầu SSL/TLS trên VPS). |
| `TZ_OFFSET_HOURS` | `7` | `7` | Điều chỉnh lệch múi giờ so với UTC (Mặc định bằng 7 cho Việt Nam). |
| `RATE_LIMIT_BYPASS_SECRET` | *Không có* | *Mã bí mật ngẫu nhiên* | Dùng để bỏ qua cơ chế giới hạn lượt request (rate limit) khi chạy các kịch bản kiểm thử tự động (E2E Test) bằng Playwright. |

### 2.2 Cấu hình Frontend (`frontend/.env.local`)

| Biến Môi Trường | Giá Trị Dev | Giá Trị Production | Vai Trò |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5001/api` | `https://api.your-app.com/api` | Địa chỉ URL gọi API. Biến này bắt buộc phải có tiền tố `NEXT_PUBLIC_` để Next.js biên dịch vào code client-side chạy trên browser. |

---

## 3. HƯỚNG DẪN CÀI ĐẶT & CHẠY LOCAL (DEVELOPMENT SETUP)

Để cài đặt và vận hành toàn bộ hệ thống dưới máy cục bộ (Local) phục vụ phát triển, bạn thực hiện tuần tự 5 bước sau:

### Bước 1: Nhân bản mã nguồn (Clone Repo)
```bash
git clone <URL_REPO_CỦA_BẠN> cloudschool
cd cloudschool
```

### Bước 2: Tạo tệp cấu hình môi trường cục bộ
Hệ thống sử dụng các tệp mẫu `.env.example` đã điền sẵn cấu hình mặc định tương thích với việc chạy Docker DB local. Bạn chỉ cần sao chép:
*   **Trên môi trường Windows (PowerShell):**
    ```powershell
    Copy-Item backend/.env.example backend/.env
    Copy-Item frontend/.env.example frontend/.env.local
    ```
*   **Trên môi trường Linux / macOS:**
    ```bash
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env.local
    ```

### Bước 3: Khởi động cơ sở dữ liệu PostgreSQL cục bộ
Dự án cung cấp file [docker-compose.dev.yml](../../../docker-compose.dev.yml) thiết lập sẵn một instance PostgreSQL 16 trên cổng `5432` với user/password là `postgres`/`postgres123` và tên db là `cloudschool`. Chạy lệnh sau để khởi động container ngầm:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Bước 4: Thiết lập Backend và Đồng bộ hóa Database
1.  Di chuyển vào thư mục backend và cài đặt thư viện:
    ```bash
    cd backend
    npm install
    ```
2.  Tạo mã nguồn Prisma Client từ file schema:
    ```bash
    npx prisma generate
    ```
3.  Áp dụng toàn bộ lịch sử migrate (nếu có) hoặc tạo các bảng dữ liệu mới:
    ```bash
    npx prisma migrate dev
    ```
4.  Nạp dữ liệu mẫu ban đầu (Seeding):
    ```bash
    npm run db:seed
    ```

### Bước 5: Thiết lập Frontend & Chạy đồng thời
1.  Di chuyển vào thư mục frontend và cài đặt thư viện:
    ```bash
    cd ../frontend
    npm install
    ```
2.  Mở 2 cửa sổ dòng lệnh riêng biệt để chạy ứng dụng:
    *   **Terminal 1 (Backend):**
        ```bash
        cd backend
        npm run dev
        ```
    *   **Terminal 2 (Frontend):**
        ```bash
        cd frontend
        npm run dev
        ```
Sau khi khởi động thành công, bạn mở trình duyệt truy cập:
*   **Frontend UI:** `http://localhost:3000`
*   **Tài khoản quản trị nền tảng (Platform Admin):** `admin@cloudschool.vn` / mật khẩu `admin123` (đăng nhập tại cổng riêng).
*   **Tài khoản quản trị trường học demo (`THPT-DEMO`):** `admin@demo.school.vn` / mật khẩu `admin123`.

---

## 4. PHÂN TÍCH FILE CẤU HÌNH DOCKER & DOCKERFILE

Để đảm bảo khả năng tối ưu tài nguyên và tốc độ khi đóng gói container chạy trên production, cấu hình Docker được chia làm 3 phần chính:

### 4.1 Backend Dockerfile ([Dockerfile](../../../backend/Dockerfile))
Sử dụng quy trình build 3 giai đoạn (Multi-stage build) để giảm dung lượng file ảnh xuống mức tối thiểu và loại bỏ các devDependencies:

1.  **Stage `deps` (Dependencies):** Cài đặt các thư viện production từ `package.json` bằng lệnh `npm ci --only=production`.
2.  **Stage `builder` (Build):** Sao chép toàn bộ source code, chạy cài đặt toàn bộ thư viện (bao gồm cả devDependencies) và chạy lệnh sinh mã client của Prisma: `npx prisma generate`.
3.  **Stage `runner` (Production):** Tạo một Alpine Linux sạch, cài đặt các package bổ sung cần thiết như `wget` và `openssl`. 
    *   Tạo nhóm người dùng `nodejs` và user hệ thống `expressjs` nhằm đảm bảo ứng dụng **không chạy dưới quyền `root`** (Tránh lỗ hổng leo thang đặc quyền).
    *   Chỉ copy file thực thi cần thiết từ giai đoạn build và thư viện của production từ giai đoạn deps.
    *   Cấu hình `USER expressjs`, lắng nghe ở cổng `5000`.

### 4.2 Frontend Dockerfile ([Dockerfile](../../../frontend/Dockerfile))
Áp dụng cơ chế **Standalone output** của Next.js giúp thu nhỏ kích thước container xuống còn khoảng dưới 100MB thay vì hàng GB như các cách thông thường:

1.  **Stage `deps`:** Cài đặt toàn bộ thư viện cần thiết.
2.  **Stage `builder`:** Sao chép mã nguồn, nhận tham số build `NEXT_PUBLIC_API_URL` thông qua `ARG` và biên dịch ứng dụng bằng lệnh `npm run build`. Sau khi build, Next.js sẽ sinh ra thư mục `.next/standalone` chứa toàn bộ mã nguồn tối giản đủ để chạy độc lập không cần `node_modules` bên ngoài.
3.  **Stage `runner`:** Khởi tạo môi trường chạy nhẹ nhất dựa trên Node Alpine.
    *   Tạo user bảo mật `nextjs` thuộc group `nodejs`.
    *   Sao chép thư mục `.next/standalone` và `.next/static`.
    *   Lắng nghe cổng `3000` và chạy ứng dụng bằng lệnh `node server.js`.

### 4.3 Cấu hình Production Compose ([docker-compose.yml](../../../docker-compose.yml))
Quản lý vòng đời chạy của 3 container trên VPS:
*   **postgres:**
    *   Ghi log ra dạng file xoay vòng với kích thước tối đa là 10MB và tối đa 3 file để tránh làm đầy ổ cứng VPS.
    *   Có phân vùng `postgres_data` gắn với thư mục vật lý của VPS để đảm bảo dữ liệu không bị mất khi container restart.
    *   Có `healthcheck` chạy lệnh nội bộ `pg_isready` mỗi 10 giây.
*   **backend:**
    *   Đọc biến môi trường từ tệp cấu hình sinh ra tự động.
    *   Chỉ khởi động khi cơ sở dữ liệu `postgres` đạt trạng thái `service_healthy`.
    *   Bật `healthcheck` thực hiện lệnh kiểm tra `/health` định kỳ mỗi 30 giây.
*   **frontend:**
    *   Sử dụng cổng `3000`.
    *   Chỉ khởi chạy sau khi `backend` đạt trạng thái `service_healthy`.

---

## 5. QUY TRÌNH CI/CD CHI TIẾT QUA GITHUB ACTIONS (DEPLOY.YML)

Quy trình triển khai tự động lên VPS được cấu hình trong [deploy.yml](../../../.github/workflows/deploy.yml) bao gồm 4 Job chính:

```
┌────────────────────────────────────────────────────────┐
│                    Job 1: validate                     │
│  - Tạo tên Image định dạng lowercase từ repo github.  │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│  Job 2a: build-backend  │ │ Job 2b: build-frontend  │
│ - Checkout code         │ │ - Checkout code         │
│ - Login Container Reg   │ │ - Login Container Reg   │
│ - Build Docker Image    │ │ - Build & Inject API URL│
│ - Push Tag SHA & latest │ │ - Push Tag SHA & latest │
└────────────┬────────────┘ └────────────┬────────────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│                     Job 3: deploy                      │
│ - Kết nối VPS bằng SSH & SCP file docker-compose.yml   │
│ - Tạo tệp .env cấu hình trên máy chủ                   │
│ - Đăng nhập GHCR và kéo (pull) image mới               │
│ - Khởi chạy và giám sát database                       │
│ - Áp dụng Prisma Migration và Seed dữ liệu             │
│ - Tạo mới Backend/Frontend containers (Force Recreate) │
│ - Xác thực kiểm tra sức khỏe (/health)                 │
│ - Dọn dẹp dung lượng thừa (Prune images & builder)     │
└────────────────────────────────────────────────────────┘
```

---

## 6. CÁC BƯỚC THỰC THI TRÊN VPS KHI DEPLOY (STEP-BY-STEP VPS SCRIPT)

Khi quá trình build image trên GitHub Actions hoàn tất, Job `deploy` sẽ kết nối tới máy chủ VPS thông qua giao thức SSH và thực thi tuần tự các bước dưới đây để cập nhật hệ thống mà không gây gián đoạn lớn:

### Bước 1: Thiết lập thư mục và sao chép cấu hình
*   Tạo thư mục lưu trữ mã nguồn trên VPS (nếu chưa có) dựa theo biến bí mật `secrets.VPS_DEPLOY_PATH`.
*   Sử dụng `appleboy/scp-action` sao chép trực tiếp tệp [docker-compose.yml](../../../docker-compose.yml) từ GitHub lên thư mục triển khai của VPS.

### Bước 2: Tạo tệp cấu hình `.env` động trên VPS
Hệ thống tự động sinh tệp `.env` trực tiếp trên VPS bằng mã script:
```bash
cat > .env << 'ENVEOF'
POSTGRES_USER=${{ secrets.POSTGRES_USER }}
POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
POSTGRES_DB=${{ secrets.POSTGRES_DB }}
JWT_SECRET=${{ secrets.JWT_SECRET }}
JWT_EXPIRES_IN=24h
CORS_ORIGIN=${{ secrets.CORS_ORIGIN }}
NEXT_PUBLIC_API_URL=${{ secrets.NEXT_PUBLIC_API_URL }}
GITHUB_REPOSITORY=${{ needs.validate.outputs.image_name_lower }}
IMAGE_TAG=${{ github.sha }}
COOKIE_SECURE=true
TZ_OFFSET_HOURS=7
ENVEOF
sed -i 's/^[[:space:]]*//' .env
```
*Tác vụ này giúp toàn bộ các Container Docker Compose khi khởi động trên VPS sẽ đọc các cấu hình này mà không cần lưu trữ bất kỳ file chứa mật khẩu nào trên Github.*

### Bước 3: Đăng nhập Registry và kéo Image mới
Thực hiện đăng nhập vào hệ thống chứa Container của GitHub (GHCR) và kéo các bản build ứng dụng mới nhất về:
```bash
echo "${{ secrets.CR_PAT }}" | docker login ghcr.io -u "${{ github.actor }}" --password-stdin

# Thực hiện thử lại tối đa 3 lần nếu kết nối kéo image gặp lỗi mạng
for i in $(seq 1 3); do
  if docker compose pull backend 2>&1 && docker compose pull frontend 2>&1; then
    echo "Pull images success."
    break
  fi
  sleep 10
done
```

### Bước 4: Khởi động Database và giám sát trạng thái sẵn sàng
Bật riêng container PostgreSQL lên trước:
```bash
docker compose up -d postgres
```
Chạy kiểm tra trạng thái của PostgreSQL mỗi 2 giây (tối đa 30 lần tương đương 1 phút):
```bash
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U ${{ secrets.POSTGRES_USER }} -d ${{ secrets.POSTGRES_DB }} > /dev/null 2>&1; then
    echo "PostgreSQL is ready."
    break
  fi
  sleep 2
done
```

### Bước 5: Áp dụng nâng cấp Database (Migration & Seeding)
Chạy container backend tạm thời để đồng bộ database và chạy seeding (Chi tiết xem tại Mục 7).

### Bước 6: Khởi chạy hai thành phần Backend & Frontend mới
Bắt buộc Docker dựng lại container ứng dụng để nhận phiên bản code mới nhất nhưng **không tắt hay khởi động lại Database Postgres** nhằm tránh mất kết nối:
```bash
docker compose up -d --no-deps --force-recreate backend frontend
```

### Bước 7: Kiểm thử sức khỏe (Health Check Verification)
Sau khi container backend được dựng lại, hệ thống chạy lệnh kiểm tra liên tục trạng thái sức khỏe của container này:
```bash
for i in $(seq 1 20); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' cloudschool-backend 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    echo "Backend is healthy!"
    break
  fi
  sleep 5
done
```
*Nếu sau 100 giây backend vẫn không ở trạng thái `healthy`, quy trình deploy sẽ lập tức bị hủy bỏ và in ra log 50 dòng cuối cùng của backend để lập trình viên kiểm tra lỗi.*

### Bước 8: Dọn dẹp đĩa cứng VPS tránh tràn bộ nhớ
Khi build và chạy Docker liên tục, đĩa cứng VPS sẽ nhanh chóng bị đầy do các image cũ không còn tag (dangling images). Hệ thống chạy lệnh dọn dẹp an toàn:
```bash
docker container prune -f
docker image prune -f

# Giữ lại tối đa 3 bản build backend và frontend gần đây nhất để có thể rollback, xóa toàn bộ các bản build cũ hơn
docker images "ghcr.io/..." --format "{{.ID}} {{.CreatedAt}}" | sort -k2 -r | tail -n +4 | awk '{print $1}' | xargs -r docker rmi -f 2>/dev/null || true

# Giải phóng bộ đệm của Docker build, chỉ giữ lại tối đa 500MB
docker builder prune -f --keep-storage 500MB 2>/dev/null || true
docker network prune -f
```
> [!WARNING]
> **Tuyệt đối không dùng lệnh `docker volume prune`** vì lệnh này sẽ quét và xóa toàn bộ phân vùng ổ đĩa `postgres_data` đang chạy chứa dữ liệu cơ sở dữ liệu thực tế của toàn bộ hệ thống trường học SaaS.

---

## 7. CƠ CHẾ MIGRATION & DỮ LIỆU SEED (MIGRATION FLOW & SEEDING)

Cơ chế cập nhật cơ sở dữ liệu trên VPS được thiết kế để xử lý linh hoạt hai kịch bản nhằm đảm bảo hệ thống không bị lỗi xung đột cấu trúc dữ liệu:

### 7.1 Luồng chạy Migration chính (Prisma Migrate Deploy)
Pipeline cố gắng áp dụng các thay đổi cấu trúc dữ liệu mới bằng lệnh:
```bash
docker compose run --rm --user root backend npx prisma migrate deploy
```
Lệnh này chỉ đọc thư mục `prisma/migrations` và áp dụng những tệp SQL thay đổi cấu trúc chưa từng chạy lên cơ sở dữ liệu.

### 7.2 Luồng dự phòng (Legacy Fallback Flow)
Nếu cơ sở dữ liệu cũ chưa có bảng lịch sử migration của Prisma (gây ra lỗi khi so khớp mã băm di trú), hệ thống tự động nhảy vào khối lệnh dự phòng:
1.  **Đồng bộ cưỡng bức:** Chạy lệnh `npx prisma db push` để đẩy trực tiếp cấu trúc của schema mới nhất vào database.
2.  **Đánh dấu hoàn thành di trú:** Duyệt qua tất cả các thư mục con trong thư mục `prisma/migrations` (ngoại trừ file lock cấu hình) và dùng lệnh:
    ```bash
    npx prisma migrate resolve --applied "<tên_thư_mục_migration>"
    ```
    Lệnh này đánh dấu cho Prisma biết cấu trúc đó đã được áp dụng trực tiếp rồi để tránh việc Prisma cố gắng chạy lại tệp SQL gây ra lỗi trùng lặp bảng.
3.  **Khởi tạo lại:** Áp dụng lệnh `npx prisma migrate deploy` để đồng bộ lại hoàn toàn.

### 7.3 Chạy dữ liệu mẫu Idempotent (Seeding)
Sau khi migrate thành công, hệ thống thực thi:
```bash
docker compose run --rm --user root backend npm run db:seed
```
*   **Idempotent:** Script seed của hệ thống được lập trình với cơ chế kiểm tra sự tồn tại (Upsert hoặc kiểm tra bản ghi trước khi tạo), đảm bảo rằng lệnh này có thể chạy đi chạy lại vô số lần khi deploy mà không tạo ra các bản ghi bị trùng lặp hay lỗi khóa chính.

---

## 8. GIÁM SÁT HỆ THỐNG VÀ XỬ LÝ SỰ CỐ (MONITORING & TROUBLESHOOTING)

Sau khi deploy thành công, bạn có thể thực hiện kiểm tra hoạt động của hệ thống trên VPS thông qua các câu lệnh quản trị Docker tiêu chuẩn:

### 1. Xem nhật ký hoạt động (Logs)
*   **Xem log thời gian thực của toàn bộ hệ thống:**
    ```bash
    docker compose logs -f
    ```
*   **Xem log riêng của Backend để kiểm tra lỗi kết nối DB hoặc lỗi logic:**
    ```bash
    docker compose logs -f backend
    ```

### 2. Kiểm tra sức khỏe container
*   Xem trạng thái tài nguyên CPU, RAM đang sử dụng của các container:
    ```bash
    docker stats
    ```
*   Xem chi tiết thông tin và trạng thái Health Check của Backend:
    ```bash
    docker inspect --format='{{json .State.Health}}' cloudschool-backend
    ```

### 3. Khôi phục nhanh (Rollback)
Nếu bản cập nhật mới bị lỗi logic nghiêm trọng trên Production, bạn có thể thực hiện rollback nhanh về phiên bản trước đó bằng cách thay đổi giá trị `IMAGE_TAG` trong file `.env` trên VPS thành mã hash commit của phiên bản ổn định gần nhất, sau đó chạy lệnh khởi động lại:
```bash
docker compose up -d --no-deps --force-recreate backend frontend
```
