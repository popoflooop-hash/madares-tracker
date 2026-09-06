async function register() {
  const role = document.getElementById('role').value;
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('error');
  const successEl = document.getElementById('success');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (!email || !password) {
    errorEl.textContent = 'من فضلك املأ كل الحقول';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'كلمة المرور لازم تكون 6 أحرف على الأقل';
    return;
  }
  if (password !== confirmPassword) {
    errorEl.textContent = 'كلمتا المرور غير متطابقتين';
    return;
  }

  const secondaryApp = firebase.initializeApp(firebase.app().options, 'Secondary');
  const secondaryAuth = secondaryApp.auth();

  try {
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);

    await db.collection('users').doc(cred.user.uid).set({
      role: role,
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (role === 'student') {
      await db.collection('students').doc(cred.user.uid).set({
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    if (role === 'parent') {
      await db.collection('users').doc(cred.user.uid).update({ linkedStudents: [] });
    }

    await secondaryAuth.signOut();
    await secondaryApp.delete();

    successEl.textContent = 'تم إنشاء الحساب بنجاح! سجّل دخولك الآن من الشاشة الرئيسية.';
    setTimeout(() => window.location.href = 'index.html', 1500);

  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      errorEl.textContent = 'هذا البريد الإلكتروني مستخدم بالفعل';
    } else {
      errorEl.textContent = 'خطأ: ' + e.message;
    }
    await secondaryApp.delete();
  }
}
