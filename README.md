# 🛡️ InsuranceCRM Pro — دليل الإعداد والتشغيل

## 📁 هيكل المشروع

```
insurance-crm-pro/
├── src/
│   ├── App.tsx                    — Router الرئيسي + حماية المسارات
│   ├── main.tsx                   — نقطة الدخول
│   ├── index.css                  — Tailwind base styles
│   ├── firebase/
│   │   └── config.ts              — إعداد Firebase
│   ├── types/
│   │   └── index.ts               — كل الـ Types والثوابت
│   ├── services/
│   │   ├── authService.ts         — Auth + Users + Registration Requests
│   │   ├── companyService.ts      — إدارة الشركات
│   │   ├── agentService.ts        — إدارة الوكلاء
│   │   ├── clientService.ts       — إدارة العملاء
│   │   ├── paymentService.ts      — منطق حساب الإنتاج والتقارير
│   │   └── paymentRecordsService.ts — سجلات التحصيل
│   ├── hooks/
│   │   ├── useAuth.tsx            — Auth Context
│   │   └── useData.ts             — Data hooks (clients, agents, users...)
│   ├── components/
│   │   ├── layout/
│   │   │   └── Layout.tsx         — Sidebar + Header + Navigation
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Modal.tsx
│   ├── pages/
│   │   ├── Login.tsx              — تسجيل دخول + طلب انضمام
│   │   ├── Dashboard.tsx          — لوحة التحكم الرئيسية
│   │   ├── MyDashboard.tsx        — أداء الوكيل الشخصي
│   │   ├── Clients.tsx            — إدارة العملاء
│   │   ├── Collections.tsx        — التحصيل الشهري
│   │   ├── Agents.tsx             — إدارة الوكلاء
│   │   ├── Reports.tsx            — التقارير الشهرية
│   │   ├── AnnualStats.tsx        — الإحصائيات السنوية
│   │   ├── Users.tsx              — إدارة المستخدمين
│   │   ├── Companies.tsx          — إدارة الشركات (super_admin)
│   │   ├── Requests.tsx           — طلبات الانضمام
│   │   └── DataDeletion.tsx       — صفحة حذف البيانات
│   └── utils/
│       ├── formatUtils.ts         — تنسيق الأرقام والألوان
│       └── exportUtils.ts         — تصدير CSV و Excel
├── public/
│   ├── icon-192.png
│   └── manifest.json
├── firestore.rules                — قواعد أمان Firestore
├── .env.example                   — نموذج متغيرات البيئة
├── vercel.json                    — إعداد Vercel deployment
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## 🚀 خطوات الإعداد والتشغيل

### 1. إنشاء مشروع Firebase

1. اذهب لـ [Firebase Console](https://console.firebase.google.com)
2. أنشئ مشروع جديد
3. فعّل **Authentication** > Email/Password
4. فعّل **Firestore Database** في وضع Production
5. من **Project Settings** → **Your apps** → أضف Web App واحفظ الـ config

### 2. ضبط متغيرات البيئة

انسخ `.env.example` إلى `.env.local` واملأ البيانات:

```bash
cp .env.example .env.local
```

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. رفع قواعد Firestore

في Firebase Console → Firestore → Rules، انسخ محتوى `firestore.rules`، أو استخدم Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### 4. إنشاء حساب super_admin يدوياً

في Firebase Console → Authentication → Add User:
- Email: `admin@yourcompany.com`
- Password: اختر كلمة مرور قوية

ثم في Firestore → `users` collection → Add Document:
- **Document ID**: نفس الـ UID من Authentication
```json
{
  "uid": "UID_FROM_AUTH",
  "displayName": "مدير النظام",
  "email": "admin@yourcompany.com",
  "role": "super_admin",
  "companyId": "",
  "status": "active",
  "createdAt": (server timestamp)
}
```

### 5. تثبيت الحزم وتشغيل التطبيق

```bash
# تثبيت الحزم
npm install

# تشغيل بيئة التطوير
npm run dev
```

افتح المتصفح على: **http://localhost:5173**

### 6. البناء للإنتاج

```bash
npm run build
```

الملفات تُبنى في مجلد `dist/`

---

## ☁️ النشر على Vercel

```bash
npm install -g vercel
vercel

# أو اربط GitHub repo وأضف متغيرات البيئة في Vercel Dashboard
```

> ملاحظة: ملف `vercel.json` موجود بالفعل ويعالج SPA routing.

---

## 📋 الفهارس المطلوبة في Firestore

أنشئ هذه الفهارس من Firebase Console → Firestore → Indexes:

| Collection | Fields | Order |
|-----------|--------|-------|
| clients | companyId (ASC), createdAt (DESC) | Composite |
| agents | companyId (ASC), name (ASC) | Composite |
| paymentRecords | companyId (ASC), month (ASC), year (ASC), collectedAt (DESC) | Composite |
| registrationRequests | status (ASC), createdAt (DESC) | Composite |
| users | companyId (ASC), displayName (ASC) | Composite |

> سيظهر رابط إنشاء الفهرس تلقائياً في console المتصفح عند أول query تحتاجه.

---

## 👥 التدرج الوظيفي

```
super_admin
    └── sales_manager (مدير مبيعات — يرى شركته فقط)
            └── general_supervisor (مراقب عام)
                    └── supervisor (مراقب)
                            └── group_leader (رئيس مجموعة)
                                    └── agent (وكيل — له تارجت فردي)
```

### آلية التسجيل:
1. المستخدم يقدم طلب انضمام من صفحة Login
2. يختار الشركة + الوظيفة + المدير المباشر
3. الطلب يُحفظ بحالة `pending`
4. `super_admin` أو `sales_manager` يوافق من صفحة **طلبات الانضمام**
5. عند الموافقة: يُنشأ حساب Firebase Auth + وثيقة user تلقائياً

---

## 💡 منطق الإنتاج

- **قيمة الدفعة** تُحسب دائماً من `annualTarget`:
  - شهري = `annualTarget ÷ 12`
  - ربع سنوي = `annualTarget ÷ 4`
  - نصف سنوي = `annualTarget ÷ 2`
  - سنوي = `annualTarget` كامل

- **شهر التسجيل** = إنتاج جديد دائماً
- **التحصيل** يبدأ من الشهر التالي ويستمر حسب الطريقة

---

## 🛠 التقنيات المستخدمة

| التقنية | الإصدار | الغرض |
|---------|---------|-------|
| React | 18 | واجهة المستخدم |
| TypeScript | 5 | Type Safety |
| Vite | 5 | Build Tool + Dev Server |
| Tailwind CSS | 3 | Styling |
| Firebase | 10 | Auth + Firestore |
| React Router | 6 | Navigation |
| Lucide React | latest | Icons |
| vite-plugin-pwa | latest | PWA Support |
| xlsx | 0.18 | Excel Export |

