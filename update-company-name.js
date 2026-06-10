import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateCompanyName() {
  try {
    console.log('جاري البحث عن الشركة...');
    
    // البحث عن الشركة بالاسم القديم
    const q = query(
      collection(db, 'companies'),
      where('name', '==', 'قناة السويس لتأمينات الحياه')
    );
    
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log('لم يتم العثور على الشركة بهذا الاسم');
      process.exit(0);
    }
    
    console.log(`تم العثور على ${snap.size} شركة`);
    
    // تحديث كل شركة
    for (const docSnap of snap.docs) {
      console.log(`جاري تحديث الشركة: ${docSnap.id}`);
      await updateDoc(doc(db, 'companies', docSnap.id), {
        name: 'قناة السويس طنطا'
      });
      console.log(`✓ تم تحديث الشركة: ${docSnap.id}`);
    }
    
    console.log('✓ تم تحديث جميع الشركات بنجاح');
    process.exit(0);
  } catch (error) {
    console.error('خطأ:', error);
    process.exit(1);
  }
}

updateCompanyName();
