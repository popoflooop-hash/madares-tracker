let map, marker, studentId;

const GRADE_NAMES = {
  'primary1': 'أولى ابتدائي', 'primary2': 'ثانية ابتدائي', 'primary3': 'ثالثة ابتدائي',
  'primary4': 'رابعة ابتدائي', 'primary5': 'خامسة ابتدائي', 'primary6': 'سادسة ابتدائي',
  'prep1': 'أولى إعدادي', 'prep2': 'ثانية إعدادي', 'prep3': 'ثالثة إعدادي',
  'secondary1': 'أولى ثانوي', 'secondary2': 'ثانية ثانوي', 'secondary3': 'ثالثة ثانوي'
};
const CLASS_NAMES = { '1': 'الأول', '2': 'الثاني', '3': 'الثالث', '4': 'الرابع', '5': 'الخامس' };

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }

  const userDoc = await db.collection('users').doc(user.uid).get();
  const linkedStudents = userDoc.data().linkedStudents || [];
  if (linkedStudents.length === 0) { alert('لا يوجد طالب مرتبط بحسابك'); return; }

  studentId = linkedStudents[0];

  loadStudentGradeInfo();
  initMap();
  listenToTracking();
  listenToAttendance();
  listenToAnnouncements();
});

async function loadStudentGradeInfo() {
  const doc = await db.collection('students').doc(studentId).get();
  if (!doc.exists) return;
  const data = doc.data();
  const gradeText = GRADE_NAMES[data.grade] || '';
  const classText = CLASS_NAMES[data.classNumber] || '';
  const infoEl = document.getElementById('studentGradeInfo');
  if (gradeText && classText) {
    infoEl.textContent = `${data.name || 'الطالب'} — ${gradeText} ${classText}`;
  }
}

function initMap() {
  map = L.map('map').setView([30.0444, 31.2357], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  marker = L.marker([30.0444, 31.2357]).addTo(map);
}

function listenToTracking() {
  db.collection('students').doc(studentId).collection('tracking').doc('current')
    .onSnapshot(doc => {
      if (!doc.exists) return;
      const data = doc.data();
      marker.setLatLng([data.lat, data.lng]);
      map.setView([data.lat, data.lng], 15);

      const badge = document.getElementById('statusBadge');
      if (data.status === 'deviated') {
        badge.textContent = 'تنبيه: انحراف عن المسار المحدد';
        badge.className = 'status-badge status-late';
      } else {
        badge.textContent = 'الطالب في الطريق - على المسار';
        badge.className = 'status-badge status-tracking';
      }
    });
}

function listenToAttendance() {
  db.collection('students').doc(studentId).collection('attendance')
    .orderBy('checkInTime', 'desc').limit(15)
    .onSnapshot(snapshot => {
      const log = document.getElementById('attendanceLog');
      log.innerHTML = '';
      snapshot.forEach(doc => {
        const rec = doc.data();
        const date = doc.id;
        const div = document.createElement('div');
        div.className = 'log-item';
        const statusText = rec.status === 'on_time' ? 'حضور في الوقت'
          : rec.status === 'late' ? `متأخر ${rec.lateMinutes} دقيقة` : 'غياب';
        const statusClass = rec.status === 'on_time' ? 'status-ontime'
          : rec.status === 'late' ? 'status-late' : 'status-absent';
        div.innerHTML = `<span>${date}</span><span class="status-badge ${statusClass}">${statusText}</span>`;
        log.appendChild(div);
      });
    });
}

function listenToAnnouncements() {
  db.collection('announcements').orderBy('postedAt', 'desc').limit(10)
    .onSnapshot(snapshot => {
      const list = document.getElementById('announcementsLog');
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
