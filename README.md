# ระบบบันทึกการประชุมออนไลน์ (e-mesyuarat)

## โครงสร้างไฟล์

```
e-mesyuarat/
├── index.html          # หน้าเข้าสู่ระบบ + แนะนำระบบ
├── app.html            # หน้าใช้งานหลัก (หลังล็อกอิน)
├── css/
│   └── style.css       # สไตล์ทั้งหมด
└── js/
    ├── core.js         # Config, Supabase, API, helpers
    ├── auth.js         # ล็อกอิน / ออกจากระบบ / idle
    └── views.js        # แดชบอร์ด, การประชุม, ผู้ใช้, ฯลฯ
```

## Deploy บน GitHub Pages

1. อัปโหลดทั้งโฟลเดอร์นี้ไปที่ repo (root หรือ /docs)
2. ตั้ง GitHub Pages ให้ชี้ที่โฟลเดอร์นี้
3. เปิด `https://<user>.github.io/<repo>/` จะเจอหน้า login

## พัฒนาต่อ

| แก้เรื่อง | แก้ไฟล์ |
|-----------|---------|
| สี / ฟอนต์ / layout | `css/style.css` |
| URL/Key Supabase | `js/core.js` (ด้านบน) |
| ล็อกอิน / session | `js/auth.js` |
| หน้าจอแต่ละเมนู | `js/views.js` |

## ลบผู้ใช้

ส่วนกลางกดปุ่ม **ลบ** ในเมนูผู้ใช้ได้  
จะลบแถวในตาราง `profiles` (เข้าสู่ระบบไม่ได้)  
ถ้าต้องการลบบัญชี Auth ถาวร ให้ไปที่ Supabase → Authentication → Users
