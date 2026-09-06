const ADMIN_EMAIL = "popofloop@gmail.com";

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  if (user.email !== ADMIN_EMAIL) {
    alert('هذا الحساب لا يملك صلاحية الوصول لهذه الصفحة');
    auth.signOut();
    window.location.href = 'index.html';
    return;
  }
});

async function createSchoolAdmin() {
  const email = document.getElementById('schoolEmail').value.trim();
  const password = document.getElementById('schoolPassword').value;
  const statusEl = document.getElementById('status');
  statusEl.textContent = '';

  if (!email || !password) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'من فضلك املأ كل الحقول';
    return;
  }
  if (password.length < 6) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'كلمة المرور لازم تكون 6 أحرف على الأقل';
    return;
  }

  // ننشئ تطبيق Firebase ثانوي منفصل تماماً عشان ما يأثرش على جلسة الأدمن الحالية
  const secondaryApp = firebase.initializeApp(firebase.app().options, 'Secondary');
  const secondaryAuth = secondaryApp.auth();

  try {
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);

    await db.collection('users').doc(cred.user.uid).set({
      role: 'school_admin',
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // نسجل خروج من الجلسة الثانوية فقط، وجلسة الأدمن الأساسية تفضل زي ما هي
    await secondaryAuth.signOut();
    await secondaryApp.delete();

    statusEl.style.color = 'green';
    statusEl.textContent = 'تم إنشاء حساب المدرسة بنجاح: ' + email;

  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      statusEl.style.color = 'red';
      statusEl.textContent = 'هذا البريد الإلكتروني مستخدم بالفعل';
    } else {
      statusEl.style.color = 'red';
      statusEl.textContent = 'خطأ: ' + e.message;
    }
    await secondaryApp.delete();
  }
}
