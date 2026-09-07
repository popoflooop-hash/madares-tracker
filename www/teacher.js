let teacherData;
let teacherUid;

const POSITIVE_TAGS = ['متفوق دراسياً', 'متعاون ونشيط', 'منضبط في الفصل', 'يساعد زملاءه'];
const NEGATIVE_TAGS = ['مشتت وغير منتبه', 'لا يذاكر واجباته', 'يعطل زملاءه', 'سلوك غير لائق'];

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  teacherUid = user.uid;

  const userDoc = await db.collection('users').doc(user.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'teacher') {
    alert('هذا الحساب لا يملك صلاحية الوصول لهذه الصفحة');
    auth.signOut();
    window.location.href = 'index.html';
    return;
  }

  const teacherDoc = await db.collection('teachers').doc(user.uid).get();
  teacherData = teacherDoc.data();
  document.getElementById('teacherInfo').textContent = `${teacherData.teacherName} — ${teacherData.subject}`;
});

async function loadStudents() {
  const classNumber = document.getElementById('classFilter').value;

  const snap = await db.collection('students')
    .where('grade', '==', teacherData.grade)
    .where('classNumber', '==', classNumber)
    .get();

  const list = document.getElementById('studentsList');
  list.innerHTML = '';

  if (snap.empty) {
    list.innerHTML = '<p style="color:#666">لا يوجد طلاب في هذا الفصل</p>';
    return;
  }

  snap.forEach(doc => {
    const student = doc.data();
    const studentId = doc.id;
    const card = document.createElement('div');
    card.className = 'card';

    let tagsHtml = '';
    [...POSITIVE_TAGS, ...NEGATIVE_TAGS].forEach(tag => {
      tagsHtml += `<label style="display:inline-block;margin:4px"><input type="checkbox" class="tag-${studentId}" value="${tag}"> ${tag}</label>`;
    });

    card.innerHTML = `
      <h2>${student.name}</h2>
      <div id="stars-${studentId}" style="font-size:28px;margin-bottom:10px">
        ${[1,2,3,4,5].map(n => `<span onclick="setStars('${studentId}',${n})" id="star-${studentId}-${n}" style="cursor:pointer;color:#ccc">★</span>`).join('')}
      </div>
      <div>${tagsHtml}</div>
      <button onclick="submitRating('${studentId}')" style="margin-top:10px">إرسال التقييم</button>
      <p id="ratingStatus-${studentId}" style="margin-top:6px"></p>
    `;
    list.appendChild(card);
  });
}

const selectedStars = {};

function setStars(studentId, n) {
  selectedStars[studentId] = n;
  for (let i = 1; i <= 5; i++) {
    document.getElementById(`star-${studentId}-${i}`).style.color = i <= n ? '#f59e0b' : '#ccc';
  }
}

async function submitRating(studentId) {
  const statusEl = document.getElementById(`ratingStatus-${studentId}`);
  const stars = selectedStars[studentId] || 0;
  const tags = Array.from(document.querySelectorAll(`.tag-${studentId}:checked`)).map(cb => cb.value);

  if (stars === 0) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'من فضلك اختر عدد النجوم';
    return;
  }

  const now = new Date();
  const weekKey = `${now.getFullYear()}-W${Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)}-${now.getMonth() + 1}`;
  const ratingId = `${teacherUid}_${weekKey}`;

  try {
    const existing = await db.collection('students').doc(studentId)
      .collection('teacherRatings').doc(ratingId).get();

    if (existing.exists) {
      statusEl.style.color = 'red';
      statusEl.textContent = 'تم تقييم هذا الطالب بالفعل هذا الأسبوع';
      return;
    }

    await db.collection('students').doc(studentId)
      .collection('teacherRatings').doc(ratingId).set({
        teacherName: teacherData.teacherName,
        subject: teacherData.subject,
        stars: stars,
        tags: tags,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    statusEl.style.color = 'green';
    statusEl.textContent = 'تم إرسال التقييم بنجاح';
  } catch (e) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'خطأ: ' + e.message;
  }
}
