alert('بدء تحميل firebase-config.js');

const firebaseConfig = {
  apiKey: "AIzaSyBNVNqvhQs7i2PZfk2WEW0ON4PdoErk1i4",
  authDomain: "my-school-57688.firebaseapp.com",
  projectId: "my-school-57688",
  storageBucket: "my-school-57688.firebasestorage.app",
  messagingSenderId: "842457078793",
  appId: "1:842457078793:web:7b2045d827feabf1fe6cd8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

alert('تم تعريف auth بنجاح: ' + typeof auth);
