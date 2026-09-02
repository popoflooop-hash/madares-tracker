// استبدل القيم دي ببيانات مشروعك من Firebase Console
const firebaseConfig = {
  apiKey: "ضع_apiKey_هنا",
  authDomain: "ضع_المشروع.firebaseapp.com",
  projectId: "ضع_projectId_هنا",
  storageBucket: "ضع_المشروع.appspot.com",
  messagingSenderId: "ضع_الرقم_هنا",
  appId: "ضع_appId_هنا"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
