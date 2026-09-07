let currentHolidays = [];
const GRADE_NAMES = {
  'primary1': 'أولى ابتدائي', 'primary2': 'ثانية ابتدائي', 'primary3': 'ثالثة ابتدائي',
  'primary4': 'رابعة ابتدائي', 'primary5': 'خامسة ابتدائي', 'primary6': 'سادسة ابتدائي',
  'prep1': 'أولى إعدادي', 'prep2': 'ثانية إعدادي', 'prep3': 'ثالثة إعدادي',
  'secondary1': 'أولى ثانوي', 'secondary2': 'ثانية ثانوي', 'secondary3': 'ثالثة ثانوي'
};

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }

  const userDoc = await db.collection('users').doc(user.uid).get();
  const role = userDoc.exists ? userDoc.data().role : null;

  if (role !== 'school_admin') {
    alert('هذا الحساب لا يملك صلاحية الوصول لهذه الصفحة');
    auth.signOut();
    window.location.href = 'index.html';
    return;
  }

  loadSchoolSettings();
  loadAnnouncements();
  loadTeachers();
});

async function loadSchoolSettings() {
  const doc = await db.collection('school').doc('main').get();
  if (!doc.exists) return;

  const data = doc.data();
  document.getElementById('schoolName').value = data.name || '';
  document.getElementById('checkInLat').value = data.checkInPoint ? data.checkInPoint.lat : '';
  document.getElementById('checkInLng').value = data.checkInPoint ? data.checkInPoint.lng : '';
  document.getElementById('checkInRadius').value = data.checkInRadius || 15;
  document.getElementById('schoolStartTime').value = data.schoolStartTime || '';
  document.getElementById('schoolEndTime').value = data.schoolEndTime || '';

  const workingDays = data.workingDays || [];
  document.querySelectorAll('.workday').forEach(cb => {
    cb.checked = workingDays.includes(Number(cb.value));
  });

  currentHolidays = data.holidays || [];
  renderHolidays();
}

function addHoliday() {
  const input = document.getElementById('holidayInput');
  if (!input.value) return;
  if (!currentHolidays.includes(input.value)) {
    currentHolidays.push(input.value);
    renderHolidays();
  }
  input.value = '';
}

function removeHoliday(date) {
  currentHolidays = currentHolidays.filter(d => d !== date);
  renderHolidays();
}

function renderHolidays() {
  const list = document.getElementById('holidaysList');
  list.innerHTML = '';
  currentHolidays.forEach(date => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.padding = '6px 0';
    div.innerHTML = `<span>${date}</span> <button onclick="removeHoliday('${date}')" style="width:auto;padding:4px 10px;background:#dc2626">حذف</button>`;
    list.appendChild(div);
  });
}

async function saveSchoolSettings() {
  const statusEl = document.getElementById('status');
  const workingDays = Array.from(document.querySelectorAll('.workday:checked')).map(cb => Number(cb.value));

  const lat = parseFloat(document.getElementById('checkInLat').value);
  const lng = parseFloat(document.getElementById('checkInLng').value);

  if (isNaN(lat) || isNaN(lng)) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'إحداثيات نقطة تسجيل الحضور غير صحيحة';
    return;
  }

  try {
    await db.collection('school').doc('main').set({
      name: document.getElementById('schoolName').value,
      checkInPoint: { lat: lat, lng: lng },
      checkInRadius: Number(document.getElementById('checkInRadius').value) || 15,
      schoolStartTime: document.getElementById('schoolStartTime').value,
      schoolEndTime: document.getElementById('schoolEndTime').value,
      workingDays: workingDays,
      holidays: currentHolidays,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    statusEl.style.color = 'green';
    statusEl.textContent = 'تم حفظ الإعدادات بنجاح';
  } catch (e) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'خطأ: ' + e.message;
  }
}

async function postAnnouncement() {
  const title = document.getElementById('announcementTitle').value.trim();
  const message = document.getElementById('announcementMessage').value.trim();
  const annStatusEl = document.getElementById('annStatus');

  if (!title || !message) {
    annStatusEl.style.color = 'red';
    annStatusEl.textContent = 'من فضلك اكتب العنوان والرسالة';
    return;
  }

  try {
    await db.collection('announcements').add({
      title: title,
      message: message,
      postedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('announcementTitle').value = '';
    document.getElementById('announcementMessage').value = '';
    annStatusEl.style.color = 'green';
    annStatusEl.textContent = 'تم نشر الإعلان بنجاح';
  } catch (e) {
    annStatusEl.style.color = 'red';
    annStatusEl.textContent = 'خطأ: ' + e.message;
  }
}

function loadAnnouncements() {
  db.collection('announcements').orderBy('postedAt', 'desc').limit(10)
    .onSnapshot(snapshot => {
      const list = document.getElementById('announcementsList');
      list.innerHTML = '';
      snapshot.forEach(doc => {
        const ann = doc.data();
        const div = document.createElement('div');
        div.style.padding = '10px 0';
        div.style.borderBottom = '1px solid #eee';
        div.innerHTML = `<strong>${ann.title}</strong><p>${ann.message}</p>`;
        list.appendChild(div);
      });
    });
}

async function addTeacher() {
  const grade = document.getElementById('teacherGrade').value;
  const subject = document.getElementById('subjectName').value.trim();
  const teacherName = document.getElementById('teacherName').value.trim();
  const email = document.getElementById('teacherEmail').value.trim();
  const password = document.getElementById('teacherPassword').value;
  const statusEl = document.getElementById('teacherStatus');

  if (!subject || !teacherName || !email || !password) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'من فضلك املأ كل الحقول';
    return;
  }
  if (password.length < 6) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'كلمة المرور لازم تكون 6 أحرف على الأقل';
    return;
  }

  const secondaryApp = firebase.initializeApp(firebase.app().options, 'Secondary');
  const secondaryAuth = secondaryApp.auth();

  try {
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);

    await db.collection('users').doc(cred.user.uid).set({
      role: 'teacher',
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('teachers').doc(cred.user.uid).set({
      grade: grade,
      subject: subject,
      teacherName: teacherName,
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await secondaryAuth.signOut();
    await secondaryApp.delete();

    document.getElementById('subjectName').value = '';
    document.getElementById('teacherName').value = '';
    document.getElementById('teacherEmail').value = '';
    document.getElementById('teacherPassword').value = '';
    statusEl.style.color = 'green';
    statusEl.textContent = 'تم إنشاء حساب المدرس بنجاح';
  } catch (e) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'خطأ: ' + e.message;
    await secondaryApp.delete();
  }
}

function loadTeachers() {
  db.collection('teachers').orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const list = document.getElementById('teachersList');
      list.innerHTML = '';
      snapshot.forEach(doc => {
        const t = doc.data();
        const div = document.createElement('div');
        div.className = 'log-item';
        div.innerHTML = `<span>${GRADE_NAMES[t.grade] || t.grade} — ${t.subject}</span><span>${t.teacherName}</span>`;
        list.appendChild(div);
      });
    });
}
