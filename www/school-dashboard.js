async function runStudentOfMonth() {
  const statusEl = document.getElementById('somStatus');
  const resultEl = document.getElementById('somResult');
  statusEl.textContent = 'جاري الاحتساب...';

  try {
    const winner = await calculateStudentOfMonth();
    if (winner) {
      statusEl.style.color = 'green';
      statusEl.textContent = 'تم الاحتساب بنجاح';
      resultEl.textContent = `🏆 ${winner.name} — ${GRADE_NAMES[winner.grade] || winner.grade}`;
    } else {
      statusEl.style.color = 'red';
      statusEl.textContent = 'لا توجد بيانات كافية للاحتساب';
    }
  } catch (e) {
    statusEl.style.color = 'red';
    statusEl.textContent = 'خطأ: ' + e.message;
  }
}
