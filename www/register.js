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

  try {
    // إنشاء الحساب في Authentication
    const cred = await auth.createUserWithEmailAndPassword(email, password);

    // إنشاء document المستخدم في Firestore تلقائياً بنفس الـ UID
    await db.collection('users').doc(cred.user.uid).set({
      role: role,
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // لو الحساب طالب، نعمل مستند مبدئي في students (فاضي، هيتملى لاحقاً)
    if (role === 'student') {
      await db.collection('students').doc(cred.user.uid).set({
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // لو الحساب ولي أمر، نعمل الحقل linkedStudents فاضي من البداية
    if (role === 'parent') {
      await db.collection('users').doc(cred.user.uid).update({
        linkedStudents: []
      });
    }

    successEl.textContent = 'تم إنشاء الحساب بنجاح! جاري تحويلك...';

    setTimeout(() => {
      if (role === 'parent') window.location.href = 'parent.html';
      else window.location.href = 'student.html';
    }, 1500);

  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      errorEl.textContent = 'هذا البريد الإلكتروني مستخدم بالفعل';
    } else if (e.code === 'auth/invalid-email') {
      errorEl.textContent = 'صيغة البريد الإلكتروني غير صحيحة';
    } else {
      errorEl.textContent = 'خطأ: ' + e.message;
    }
  }
}
