---
title: "Bổ sung tính năng theo yêu cầu đặc tả hệ thống quản lý trường học"
description: "Implement các tính năng còn thiếu so với requirement: AcademicYear, ClassEnrollment, configurable settings, báo cáo lưu ban, chuyển lớp, tra cứu điểm yearly"
status: complete
priority: P1
effort: 16h
branch: main
tags: [database, backend, frontend, requirements, gap-analysis]
created: 2026-03-30
---

# Plan: Bổ sung tính năng theo yêu cầu đặc tả

## Tổng quan

Hệ thống CloudSchool hiện tại đã có nền tảng tốt nhưng thiếu một số tính năng so với requirement đặc tả. Plan này bổ sung đầy đủ DB schema, BE API, FE pages theo đúng kiến trúc đang có.

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | Database Schema Migration | 2h | complete |
| 2 | Backend API - AcademicYear + Enrollment | 3h | complete |
| 3 | Backend API - Settings mở rộng + Validations | 2h | complete |
| 4 | Backend API - Báo cáo chuyển lớp & lưu ban | 2h | complete |
| 5 | Backend API - Tra cứu điểm yearly | 1h | complete |
| 6 | Frontend - Quản lý Năm học + UI cập nhật | 3h | complete |
| 7 | Frontend - Settings mở rộng + Báo cáo mới | 3h | complete |

## Dependencies

```
Phase 1 (DB) → Phase 2, 3, 4, 5 (BE) → Phase 6, 7 (FE)
```
