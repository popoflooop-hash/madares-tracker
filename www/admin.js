const ADMIN_EMAIL = "popofloop@gmail.com";
let currentHolidays = [];

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  if (user.email !== ADMIN_EMAIL) {
    alert('هذا الحساب لا يملك صلاحية الوصول لهذه الصفحة');
    auth.signOut();
    window.location.href = 'index.html';
    return;
  }
  loadSchoolSettings();
});

async function loadSchoolSettings() {
  const doc = await db.collection('school').doc('main').get();
  if (!doc.exists) return; // أول مرة، الحقول هتفضل فاضية لحد ما تحفظ

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
