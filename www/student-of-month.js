async function calculateStudentOfMonth() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonthSoFar = now.getDate();

  const studentsSnap = await db.collection('students').get();
  let bestStudent = null;
  let bestScore = -1;

  for (const doc of studentsSnap.docs) {
    const studentId = doc.id;
    const student = doc.data();

    const attendanceSnap = await db.collection('students').doc(studentId)
      .collection('attendance').get();

    let onTimeCount = 0;
    let totalCount = 0;
    attendanceSnap.forEach(a => {
      const date = new Date(a.id);
      if (date >= firstDay && date <= now) {
        totalCount++;
        if (a.data().status === 'on_time') onTimeCount++;
      }
    });
    const attendanceScore = totalCount > 0 ? (onTimeCount / totalCount) * 100 : 0;

    const ratingsSnap = await db.collection('students').doc(studentId)
      .collection('teacherRatings').get();

    let starsSum = 0;
    let ratingsCount = 0;
    ratingsSnap.forEach(r => {
      const created = r.data().createdAt ? r.data().createdAt.toDate() : null;
      if (created && created >= firstDay && created <= now) {
        starsSum += r.data().stars;
        ratingsCount++;
      }
    });
    const ratingScore = ratingsCount > 0 ? (starsSum / ratingsCount) * 20 : 0;

    const totalScore = (attendanceScore * 0.5) + (ratingScore * 0.5);

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestStudent = {
        studentId: studentId,
        name: student.name,
        grade: student.grade,
        classNumber: student.classNumber,
        score: totalScore
      };
    }
  }

  if (bestStudent) {
    await db.collection('studentOfMonth').doc(monthKey).set({
      ...bestStudent,
      monthKey: monthKey,
      calculatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  return bestStudent;
}
