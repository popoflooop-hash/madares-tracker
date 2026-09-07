let map, homeMarker, routeLine, schoolData;
let homeLocation = null;
let routePoints = [];

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }

  const schoolDoc = await db.collection('school').doc('main').get();
  if (schoolDoc.exists) schoolData = schoolDoc.data();

  initMap();
});

function initMap() {
  const centerLat = schoolData && schoolData.checkInPoint ? schoolData.checkInPoint.lat : 30.0444;
  const centerLng = schoolData && schoolData.checkInPoint ? schoolData.checkInPoint.lng : 31.2357;

  map = L.map('map').setView([centerLat, centerLng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  if (schoolData && schoolData.checkInPoint) {
    L.marker([schoolData.checkInPoint.lat, schoolData.checkInPoint.lng], {
      icon: L.divIcon({ className: '', html: '🏫', iconSize: [30, 30] })
    }).addTo(map).bindPopup('المدرسة');
  }

  map.on('click', onMapClick);
}

function onMapClick(e) {
  if (!homeLocation) {
    homeLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
    if (homeMarker) map.removeLayer(homeMarker);
    homeMarker = L.marker([homeLocation.lat, homeLocation.lng]).addTo(map).bindPopup('منزل الطالب');
  } else {
    routePoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
    drawRoute();
  }
}

async function suggestRoute() {
  if (!homeLocation) {
    alert('من فضلك اضغط على الخريطة أولاً لتحديد موقع المنزل');
    return;
  }
  if (!schoolData || !schoolData.checkInPoint) {
    alert('لم يتم تحديد موقع المدرسة بعد من لوحة المدرسة');
    return;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${homeLocation.lng},${homeLocation.lat};${schoolData.checkInPoint.lng},${schoolData.checkInPoint.lat}?geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      alert('تعذر إيجاد مسار، يمكنك إضافة نقاط المسار يدوياً بالضغط على الخريطة');
      return;
    }

    const coords = data.routes[0].geometry.coordinates;
    const step = Math.max(1, Math.floor(coords.length / 20));
    routePoints = [];
    for (let i = 0; i < coords.length; i += step) {
      routePoints.push({ lat: coords[i][1], lng: coords[i][0] });
    }
    drawRoute();
  } catch (e) {
    alert('تعذر الاتصال بخدمة المسارات، يمكنك إضافة نقاط المسار يدوياً بالضغط على الخريطة');
  }
}

function drawRoute() {
  if (routeLine) map.removeLayer(routeLine);
  const latlngs = routePoints.map(p => [p.lat, p.lng]);
  routeLine = L.polyline(latlngs, { color: 'blue' }).addTo(map);
}

async function saveStudent() {
  const statusEl = document.getElementById('status');
  const studentEmail = document.getElementById('studentEmail').value.trim();
  const studentName = document.getElementById('studentName').value.trim();
  const grade = document.getElementById('grade').value;
  const classNumber = document.getElementById('classNumber').value;
  const departureTime = document.getElementById('departureTime').value;
  const returnTimeMin = document.getElementById('returnTimeMin').value;
  const returnTimeMax = document.getElementById('returnTimeMax').value;

  statusEl.textContent = '';

  if (!studentEmail || !studentName || !departureTime || !returnTimeMin || !returnTimeMax) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'من فضلك املأ كل الحقول';
    return;
  }
  if (!homeLocation) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'من فضلك حدد موقع المنزل على الخريطة';
    return;
  }
  if (schoolData && schoolData.schoolStartTime && departureTime >= schoolData.schoolStartTime) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'موعد النزول يجب أن يكون قبل موعد بداية اليوم الدراسي';
    return;
  }
  if (schoolData && schoolData.schoolEndTime && returnTimeMin < schoolData.schoolEndTime) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'الحد الأدنى لموعد العودة يجب أن يكون بعد موعد نهاية اليوم الدراسي';
    return;
  }
  if (returnTimeMax <= returnTimeMin) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'الحد الأقصى لموعد العودة يجب أن يكون بعد الحد الأدنى';
    return;
  }

  try {
    const usersSnap = await db.collection('users')
      .where('email', '==', studentEmail)
      .where('role', '==', 'student')
      .limit(1).get();

    if (usersSnap.empty) {
      statusEl.style.color = 'red';
      statusEl.textContent = 'لا يوجد حساب طالب مسجل بهذا البريد الإلكتروني';
      return;
    }

    const studentUid = usersSnap.docs[0].id;

    await db.collection('students').doc(studentUid).set({
      name: studentName,
      grade: grade,
      classNumber: classNumber,
      homeLocation: homeLocation,
      route: routePoints,
      departureTime: departureTime,
      returnTimeMin: returnTimeMin,
      returnTimeMax: returnTimeMax,
      schoolStartTime: schoolData ? schoolData.schoolStartTime : '',
      schoolLocation: schoolData ? schoolData.checkInPoint : null
    }, { merge: true });

    const currentUser = auth.currentUser;
    await db.collection('users').doc(currentUser.uid).update({
      linkedStudents: firebase.firestore.FieldValue.arrayUnion(studentUid)
    });

    statusEl.style.color = 'green';
    statusEl.textContent = 'تم حفظ بيانات الطالب بنجاح';
    setTimeout(() => window.location.href = 'parent.html', 1500);

  } catch (e) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'خطأ: ' + e.message;
  }
}
