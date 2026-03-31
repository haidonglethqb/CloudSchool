# 1. TỔNG QUAN

## 1.1. Giới thiệu bài toán

Trong bối cảnh chuyển đổi số đang diễn ra mạnh mẽ trong lĩnh vực giáo dục tại Việt Nam, các trường trung học phổ thông đang đối mặt với khối lượng công tác quản lý ngày càng lớn và phức tạp. Việc quản lý thông tin học sinh, phân lớp, nhập điểm, xét lên lớp  và lập báo cáo theo từng năm học — nếu thực hiện thủ công trên giấy tờ hoặc bảng tính — không chỉ tốn nhiều thời gian, nhân lực mà còn dễ phát sinh sai sót, thiếu nhất quán dữ liệu và khó kiểm soát khi quy mô trường mở rộng. Ngoài ra, mỗi trường học có những quy định riêng về độ tuổi tuyển sinh, sĩ số lớp, thang điểm và điều kiện lên lớp, đòi hỏi hệ thống phần mềm phải đủ linh hoạt để tùy chỉnh theo nhu cầu thực tế.

Từ thực trạng đó, nhóm đề xuất xây dựng **Hệ thống Quản lý Trường học SaaS (CloudSchool)** — một nền tảng phần mềm dạng dịch vụ (Software as a Service) cho phép nhiều trường cùng vận hành trên một hạ tầng duy nhất, nhưng đảm bảo cách ly dữ liệu hoàn toàn giữa các trường. Hệ thống hướng đến việc số hóa toàn bộ quy trình quản lý học vụ, từ tuyển sinh, xếp lớp, quản lý điểm số, xét kết quả học tập, quản lý học phí cho đến lập báo cáo thống kê — đáp ứng đầy đủ các quy định nghiệp vụ giáo dục Việt Nam.

## 1.2. Mục đích và yêu cầu của đề tài

### 1.2.1. Mục đích

- Giảm thiểu khối lượng công việc thủ công trong quản lý học vụ, tiết kiệm thời gian và nhân lực cho cán bộ nhà trường.
- Tăng năng suất và độ chính xác trong việc nhập liệu điểm số, quản lý danh sách học sinh, xét lên lớp và lập báo cáo.
- Tăng tính bảo mật và minh bạch trong công tác quản lý thông qua phân quyền chặt chẽ theo vai trò người dùng.
- Cung cấp mô hình SaaS đa trường (multi-tenant), cho phép triển khai nhanh chóng cho nhiều trường học mà không cần cài đặt riêng lẻ.
- Hỗ trợ phụ huynh và học sinh tra cứu thông tin điểm số, học phí một cách chủ động và thuận tiện.

### 1.2.2. Đối tượng sử dụng

Phần mềm được thiết kế phục vụ cho sáu nhóm người dùng chính:

- **Quản trị nền tảng (Platform Admin):** Người vận hành hệ thống SaaS, quản lý danh sách các trường, gói dịch vụ và giám sát hoạt động toàn hệ thống.
- **Ban giám hiệu (Super Admin):** Hiệu trưởng hoặc phó hiệu trưởng, có toàn quyền quản lý trong phạm vi trường mình.
- **Giáo vụ (Staff):** Cán bộ phụ trách học vụ, thực hiện các nghiệp vụ quản lý học sinh, lớp học, điểm số và học phí.
- **Giáo viên (Teacher):** Nhập và xem điểm cho các lớp, môn học được phân công.
- **Học sinh (Student):** Tra cứu điểm số cá nhân.
- **Phụ huynh (Parent):** Theo dõi kết quả học tập và tình hình đóng học phí của con em.

### 1.2.3. Yêu cầu

- Giao diện chương trình được thiết kế hợp lý, rõ ràng, dễ sử dụng và tương thích trên nhiều trình duyệt web.
- Tốc độ xử lý nhanh, đáp ứng được lượng truy cập đồng thời từ nhiều trường học trên cùng nền tảng.
- Các nghiệp vụ phải được hệ thống ghi nhận chính xác, bao gồm: quản lý học sinh, phân lớp, nhập điểm, xét lên lớp, quản lý học phí và lập báo cáo.
- Đảm bảo cách ly dữ liệu giữa các trường (multi-tenant isolation), ngăn chặn truy cập trái phép dữ liệu chéo trường.
- Hệ thống phân quyền theo vai trò (RBAC) hoạt động chính xác, mỗi vai trò chỉ truy cập được chức năng và dữ liệu trong phạm vi được phép.
- Người quản lý trường có thể tùy chỉnh các quy định nghiệp vụ (độ tuổi, sĩ số, điểm trung bình lên lớp) phù hợp với quy chế riêng của trường.

## 1.3. Quy trình thực hiện

Trong khuôn khổ đồ án môn học, nhóm chia quy trình phát triển phần mềm **CloudSchool** thành các giai đoạn chính như sau:

- **Giai đoạn 1: Xác định và mô hình hóa yêu cầu phần mềm.**
  Nhóm tiến hành khảo sát nghiệp vụ quản lý học vụ tại các trường THPT, thu thập các quy định của Bộ Giáo dục (QĐ về độ tuổi, sĩ số, thang điểm, điều kiện lên lớp). Từ đó xác định 12 biểu mẫu nghiệp vụ và 6 quy định cần tuân thủ, đặc tả thành tài liệu yêu cầu phần mềm.

- **Giai đoạn 2: Phân tích và thiết kế.**
  - *Giai đoạn 2.1:* Phân tích các thành phần chức năng — xác định 18 module API (xác thực, quản lý học sinh, lớp, môn học, điểm, xét lên lớp, học phí, báo cáo, ...) và luồng tương tác giữa các vai trò người dùng.
  - *Giai đoạn 2.2:* Thiết kế kiến trúc hệ thống — lựa chọn mô hình multi-tenant trên shared database với cách ly dữ liệu theo `tenantId`, thiết kế chuỗi middleware xác thực ba lớp (Authenticate → Authorize → TenantGuard).
  - *Giai đoạn 2.3:* Thiết kế cơ sở dữ liệu — xây dựng lược đồ gồm nhiều bảng, 7 enum, 28 chỉ mục (index) trên PostgreSQL, đảm bảo ràng buộc toàn vẹn dữ liệu và hiệu năng truy vấn.
  - *Giai đoạn 2.4:* Thiết kế giao diện — phác thảo wireframe cho dashboard, các trang quản lý và trang tra cứu dành cho từng vai trò, đảm bảo trải nghiệm người dùng nhất quán.

- **Giai đoạn 3: Cài đặt.**
  Tiến hành lập trình theo kiến trúc đã thiết kế: backend sử dụng Node.js + Express.js 5 với Prisma ORM, frontend sử dụng Next.js 14 (App Router) + TypeScript + Tailwind CSS, triển khai bằng Docker Compose. Quá trình cài đặt được thực hiện theo thứ tự: xây dựng schema cơ sở dữ liệu → phát triển API backend → xây dựng giao diện frontend → tích hợp và kiểm thử liên tục.

- **Giai đoạn 4: Kiểm thử và sửa lỗi.**
  Thực hiện rà soát toàn diện gồm: kiểm tra bảo mật (phát hiện và xử lý ~40 lỗi bảo mật, bao gồm các lỗ hổng cross-tenant IDOR), kiểm tra logic nghiệp vụ (~10 lỗi logic), tối ưu hiệu năng (48 vấn đề, bổ sung 17 chỉ mục mới, xử lý N+1 query), và kiểm tra edge case (~10 trường hợp biên). Sau mỗi vòng kiểm thử, nhóm sửa lỗi và kiểm thử lại để đảm bảo hệ thống hoạt động ổn định.
