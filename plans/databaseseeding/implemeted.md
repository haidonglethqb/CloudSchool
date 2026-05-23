## Plan: Fresh Seed Handoff For Next Deploy

Muc tieu: tao du lieu demo day du cho moi truong hop test sau khi reset DB (fresh deploy), gom 3 nam hoc, moi nam 2 hoc ky, 3 lop moi khoi, du giao vien bo mon va giao vien chu nhiem tung lop; dong thoi giu on dinh login demo va flow test hien tai.

**Steps**
1. Doc va map toan bo logic hien tai trong `backend/prisma/seed.js` de xac dinh diem nghen (dac biet logic bo qua seed khi tenant da ton tai) va cac helper co the tai su dung.  
2. Thiet ke du lieu target theo matrix: 3 nam hoc x 2 hoc ky, khoi/lop, mon hoc, giao vien bo mon, giao vien chu nhiem, hoc sinh + diem; quy uoc naming ro rang de de truy vet khi test.  
3. Cap nhat seed theo huong idempotent (upsert/createMany voi skipDuplicates): chay tren DB moi va DB da co du lieu deu khong vo. *depends on 1*  
4. Seed hoc ky va nam hoc day du: tao 3 AcademicYear, moi nam 2 Semester (HK1/HK2) voi `semesterNum`, `isActive` hop ly (chi active 1 nam + 1 hoc ky hien tai). *depends on 3*  
5. Seed cau truc hoc vu: khoi lop, 3 lop moi khoi, danh sach mon hoc day du; tao teacher cho tung mon va phan cong giang day theo lop/mon. *depends on 3*  
6. Seed giao vien chu nhiem: dam bao moi lop co dung 1 homeroom teacher trong assignment; validate khong xung dot unique/rang buoc. *depends on 5*  
7. Seed hoc sinh + phu huynh + enrollment theo nam hoc; phan bo hoc sinh theo lop de du lieu test co tinh thuc te. *depends on 5*  
8. Seed diem day du theo hoc ky/mon/dau diem cho bo du lieu mau, bao gom du truong hop PASS/FAIL de test bao cao/xet len lop. *depends on 4,5,7*  
9. Cap nhat doc demo account/du lieu seed trong `README.md` (va neu can `docs/system/database/*`) de agent khac/QA biet du bo du lieu moi. *parallel voi 8 khi schema on dinh*  
10. Verification: chay `npx prisma validate`, `npm run db:seed`, query nhanh bang Prisma Studio/SQL de check du 3 nam hoc, 2 ky/nam, 3 lop/khoi, du assignment GV bo mon + GVCN; sau do chay test API can thiet (khong can Playwright theo yeu cau). *depends on 4-9*

**Relevant files**
- `backend/prisma/seed.js` — file chinh can mo rong logic seed fresh + idempotent.
- `backend/prisma/schema.prisma` — doi chieu ranh buoc/quan he truoc khi seed so luong lon.
- `README.md` — cap nhat mo ta bo tai khoan/du lieu demo sau khi mo rong seed.
- `tests/api/*.spec.ts` — check xem co hardcode gia tri mau nao can giu tuong thich.
- `docs/system/database/*.md` — cap nhat neu quy tac du lieu seed anh huong cach test/he thong.

**Verification**
1. `cd backend && npx prisma validate`
2. `cd backend && npm run db:seed`
3. Verify DB:
   - 3 AcademicYear
   - moi AcademicYear co 2 Semester
   - moi khoi co 3 lop
   - moi lop co GVCN
   - co GV bo mon du cho cac mon hoc
4. Smoke APIs lien quan: score/report/promotion de dam bao du lieu seed dung de test nghiep vu.
5. Neu co regression test, chay bo `tests/api` toi thieu cac spec: `scores`, `reports`, `settings`, `classes`.

**Decisions**
- In scope: seed data fresh, mo rong du lieu test, giu account demo cu de khong vo flow dang dung.
- Out of scope: doi schema lon, them test e2e Playwright, thay doi UI.
- Gia dinh: DB deploy toi la fresh reset, nen uu tien bo du lieu day du cho QA/agent tiep theo.

**Further Considerations**
1. Quy uoc quy mo du lieu: can so hoc sinh/lop cu the (vd 30/lop) hay de seed theo muc vua phai (vd 10-15/lop) de chay nhanh?
2. Co can seed them truong hop bien (lop du si so, hoc sinh mat diem tung thanh phan) de test edge cases promotion khong?