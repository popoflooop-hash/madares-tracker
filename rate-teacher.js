const PARENT_POSITIVE_TAGS = ['راقي في التعامل', 'يشرح الحصة بوضوح', 'محبوب من الطلاب', 'المفضل لدي', 'صبور ومتفهم'];
const PARENT_NEGATIVE_TAGS = ['لا يشرح جيداً', 'صوته عالٍ دائماً', 'يستخدم العنف (بيضرب)', 'متعصب وسريع الغضب'];

let currentStudentDataForRating;
let currentSchoolData;
const selectedRatingStars = {};

async function initTeacherRating(studentData, schoolData) {
  currentStudentDataForRating = studentData;
  currentSchoolData = schoolData;

  const now = new Date();
  const currentTime = now.toTimeString().slice(0,5);
  const container = document.getElementById('teacherRatingSection');
  if (!container) return;

  const canRateNow = schoolData.schoolEndTime && schoolData.schoolStartTime &&
    (currentTime >= schoolData.schoolEndTime || currentTime < schoolData.schoolStartTime);

  if (!canRateNow) {
    container.innerHTML = '<p style="color:#666">تقييم المدرسين متاح فقط بعد موعد الانصراف وقبل موعد الحضور</p>';
    return;
  }

  const snap = await db.collection('teachers').where('grade', '==', studentData.grade).get();
  if (snap.empty) {
    container.innerHTML = '<p style="color:#666">لا يوجد مدرسون مسجلون لهذه المرحلة</p>';
    return;
  }

  container.innerHTML = '';
  for (const doc of snap.docs) {
    const teacher = doc.data();
    const teacherId = doc.id;

    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const limitDoc = await db.collection('teacherRatingLimits').doc(`${teacherId}_${monthKey}`).get();
    const currentCount = limitDoc.exists ? limitDoc.data().count : 0;

    const card = document.createElement('div');
    card.className = 'card';

    if (currentCount >= 2) {
      card.innerHTML = `<h2>${teacher.subject} — ${teacher.teacherName}</h2><p style="color:#999">تم الوصول للحد الأقصى من التقييمات لهذا الشهر</p>`;
      container.appendChild(card);
      continue;
    }

    let tagsHtml = '';
    [...PARENT_POSITIVE_TAGS, ...PARENT_NEGATIVE_TAGS].forEach(tag => {
      tagsHtml += `<label style="display:inline-block;margin:4px"><input type="checkbox" class="ptag-${teacherId}" value="${tag}"> ${tag}</label>`;
    });

    card.innerHTML = `
      <h2>${teacher.subject} — ${teacher.teacherName}</h2>
      <div style="font-size:28px;margin-bottom:10px">
        ${[1,2,3,4,5].map(n => `<span onclick="setRatingStars('${teacherId}',${n})" id="pstar-${teacherId}-${n}" style="cursor:pointer;color:#ccc">★</span>`).join('')}
      </div>
      <div>${tagsHtml}</div>
      <button onclick="submitTeacherRating('${teacherId}','${monthKey}')" style="margin-top:10px">إرسال التقييم (مجهول)</button>
      <p id="pRatingStatus-${teacherId}" style="margin-top:6px"></p>
    `;
    container.appendChild(card);
  }
}

function setRatingStars(teacherId, n) {
  selectedRatingStars[teacherId] = n;
  for (let i = 1; i <= 5; i++) {
    document.getElementById(`pstar-${teacherId}-${i}`).style.color = i <= n ? '#f59e0b' : '#ccc';
  }
}

async function submitTeacherRating(teacherId, monthKey) {
  const statusEl = document.getElementById(`pRatingStatus-${teacherId}`);
  const stars = selectedRatingStars[teacherId] || 0;
  const tags = Array.from(document.querySelectorAll(`.ptag-${teacherId}:checked`)).map(cb => cb.value);

  if (stars === 0) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'من فضلك اختر عدد النجوم';
    return;
  }

  const limitRef = db.collection('teacherRatingLimits').doc(`${teacherId}_${monthKey}`);

  try {
    await db.runTransaction(async (transaction) => {
      const limitDoc = await transaction.get(limitRef);
      const currentCount = limitDoc.exists ? limitDoc.data().count : 0;

      if (currentCount >= 2) {
        throw new Error('تم الوصول للحد الأقصى من التقييمات لهذا الشهر');
      }

      transaction.set(limitRef, { count: currentCount + 1 }, { merge: true });

      const ratingRef = db.collection('teacherRatings').doc();
      transaction.set(ratingRef, {
        teacherId: teacherId,
        stars: stars,
        tags: tags,
        grade: currentStudentDataForRating.grade,
        monthKey: monthKey,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    statusEl.style.color = 'green';
    statusEl.textContent = 'تم إرسال التقييم بنجاح (مجهول المصدر)';
  } catch (e) {
    statusEl.style.color = 'red';
    statusEl.textContent = e.message;
  }
}
