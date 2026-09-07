let studentId = null;
let studentData = null;
let watchId = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  studentId = user.uid;
  const doc = await db.collection('students').doc(studentId).get();
  if (!doc.exists) { alert('بيانات الطالب مش موجودة، تواصل مع المدرسة'); return; }
  studentData = doc.data();
  checkTrackingWindow();
  setInterval(checkTrackingWindow, 60000);
  loadChat();

  const schoolDoc = await db.collection('school').doc('main').get();
  if (schoolDoc.exists) {
    initTeacherRating(studentData, schoolDoc.data());
  }
});

function checkTrackingWindow() {
  if (!studentData) return;
  const now = new Date();
  const [depH, depM] = studentData.departureTime.split(':').map(Number);
  const [schH, schM] = studentData.schoolStartTime.split(':').map(Number);

  const departure = new Date(now); departure.setHours(depH, depM, 0);
  const schoolStart = new Date(now); schoolStart.setHours(schH, schM, 0);
  const graceEnd = new Date(schoolStart.getTime() + 15 * 60000);

  if (now >= departure && now <= graceEnd) {
    startTracking();
  } else {
    stopTracking();
  }
}

function startTracking() {
  if (watchId !== null) return;
  updateStatus('جاري التتبع', 'status-tracking');
  watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, {
    enableHighAccuracy: true, maximumAge: 10000, timeout: 15000
  });
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function onPosition(pos) {
  const { latitude, longitude } = pos.coords;

  db.collection('students').doc(studentId).collection('tracking').doc('current').set({
    lat: latitude,
    lng: longitude,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  checkDeviation(latitude, longitude);
  checkArrival(latitude, longitude);
}

function onGeoError(err) {
  console.error('خطأ في تحديد الموقع:', err.message);
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function checkDeviation(lat, lng) {
  if (!studentData.route || studentData.route.length === 0) return;
  const bufferMeters = 150;
  const minDist = Math.min(...studentData.route.map(p => distanceMeters(lat, lng, p.lat, p.lng)));

  if (minDist > bufferMeters) {
    db.collection('students').doc(studentId).collection('tracking').doc('current').update({
      status: 'deviated'
    });
    updateStatus('تم رصد انحراف عن المسار', 'status-late');
  } else {
    updateStatus('جاري التتبع - على المسار', 'status-tracking');
  }
}

function checkArrival(lat, lng) {
  const schoolLat = studentData.schoolLocation.lat;
  const schoolLng = studentData.schoolLocation.lng;
  const geofenceRadius = 40;

  if (distanceMeters(lat, lng, schoolLat, schoolLng) <= geofenceRadius) {
    recordAttendance();
  }
}

async function recordAttendance() {
  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];

  const attendanceRef = db.collection('students').doc(studentId).collection('attendance').doc(dateKey);
  const existing = await attendanceRef.get();
  if (existing.exists) return;

  const [schH, schM] = studentData.schoolStartTime.split(':').map(Number);
  const schoolStart = new Date(now); schoolStart.setHours(schH, schM, 0);
  const graceMinutes = 5;
  const lateThreshold = new Date(schoolStart.getTime() + graceMinutes * 60000);

  let status = 'on_time';
  let lateMinutes = 0;
  if (now > lateThreshold) {
    status = 'late';
    lateMinutes = Math.round((now - schoolStart) / 60000);
  }

  await attendanceRef.set({
    checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
    status: status,
    lateMinutes: lateMinutes
  });

  stopTracking();
  updateStatus(status === 'late' ? `تم تسجيل الحضور متأخر ${lateMinutes} دقيقة` : 'تم تسجيل الحضور في الوقت',
    status === 'late' ? 'status-late' : 'status-ontime');
}

function updateStatus(text, cls) {
  const el = document.getElementById('statusBadge');
  el.textContent = text;
  el.className = 'status-badge ' + cls;
}

async function triggerSOS() {
  if (!confirm('هل أنت متأكد إنك عايز تبعت نداء استغاثة؟')) return;

  navigator.geolocation.getCurrentPosition(async (pos) => {
    await db.collection('sos_alerts').add({
      studentId: studentId,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    });
    alert('تم إرسال الاستغاثة، جاري إبلاغ ولي الأمر والمدرسة');
  }, () => {
    alert('تعذر تحديد الموقع، لكن جاري إرسال الاستغاثة بدون موقع');
    db.collection('sos_alerts').add({
      studentId: studentId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    });
  });
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  db.collection('students').doc(studentId).collection('chat').add({
    text: text,
    sender: 'student',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  input.value = '';
}

function loadChat() {
  db.collection('students').doc(studentId).collection('chat')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      const log = document.getElementById('chatLog');
      log.innerHTML = '';
      snapshot.forEach(doc => {
        const msg = doc.data();
        const div = document.createElement('div');
        div.style.textAlign = msg.sender === 'student' ? 'left' : 'right';
        div.style.color = msg.sender === 'student' ? '#2563eb' : '#111';
        div.textContent = msg.text;
        log.appendChild(div);
      });
      log.scrollTop = log.scrollHeight;
    });
}
