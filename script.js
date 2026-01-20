/* script.js - Logic Điểm danh đa người dùng (Firestore) */

function formatDate(date) { return date.toISOString().split('T')[0]; }
function today() { return formatDate(new Date()); }

const USER_KEY = 'attendanceUsername';
function getUsername() { return localStorage.getItem(USER_KEY) || ''; }
function setUsername(name) { localStorage.setItem(USER_KEY, name); }

const usersCol = db.collection('users');

const statusEl = document.getElementById('status');
const btn = document.getElementById('checkinBtn');
const countdownEl = document.getElementById('countdown');
const nameField = document.getElementById('nameField');
const saveNameBtn = document.getElementById('saveNameBtn');
const leaderBody = document.getElementById('leaderBody');

async function createUserIfNotExists(username) {
  const doc = await usersCol.doc(username).get();
  if (!doc.exists) {
    await usersCol.doc(username).set({ checkins: [] });
  }
}

async function updateUI() {
  const username = getUsername();
  if (!username) {
    statusEl.textContent = '⚠️ Vui lòng nhập tên để bắt đầu.';
    btn.disabled = true;
    return;
  }

  const snap = await usersCol.doc(username).get();
  const checkins = (snap.data() && snap.data().checkins) || [];
  const todayStr = today();

  if (checkins.includes(todayStr)) {
    statusEl.textContent = '✅ Đã điểm danh hôm nay';
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.textContent = 'Đã điểm danh';
  } else {
    // Check death condition (2 days missed)
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    const dayBefore = formatDate(new Date(Date.now() - 2 * 86400000));
    const missedTwo = !checkins.includes(yesterday) && !checkins.includes(dayBefore);

    // Only apply "dead" if they have at least one previous checkin, 
    // to avoid new users being "dead" on day 1. 
    // Actually, user requested "qua hai ngay k diem danh".
    if (missedTwo && checkins.length > 0) {
      statusEl.innerHTML = '<span class="dead">💀 Bạn đã chết vì không điểm danh 2 ngày liên tiếp!</span>';
      btn.disabled = true;
      btn.textContent = 'Không thể điểm danh';
    } else {
      statusEl.textContent = '🔔 Chưa điểm danh hôm nay';
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = '🟢 Điểm danh hôm nay';
    }
  }
}

async function checkIn() {
  const username = getUsername();
  const todayStr = today();
  const docRef = usersCol.doc(username);
  const snap = await docRef.get();
  const data = snap.data() || { checkins: [] };
  if (!data.checkins.includes(todayStr)) {
    data.checkins.push(todayStr);
    await docRef.update({ checkins: data.checkins });
  }
  await updateUI();
}

function startLeaderboardListener() {
  usersCol.onSnapshot(snapshot => {
    const rows = [];
    snapshot.forEach(doc => {
      const { checkins = [] } = doc.data();
      rows.push({ name: doc.id, count: checkins.length });
    });
    rows.sort((a, b) => b.count - a.count);

    leaderBody.innerHTML = '';
    rows.forEach((row, idx) => {
      const tr = document.createElement('tr');
      // Highlight current user
      if (row.name === getUsername()) tr.style.background = "rgba(56, 189, 248, 0.1)";
      tr.innerHTML = `<td>${idx + 1}</td><td>${row.name}</td><td>${row.count}</td>`;
      leaderBody.appendChild(tr);
    });
  });
}

saveNameBtn.addEventListener('click', async () => {
  const name = nameField.value.trim();
  if (!name) return;
  setUsername(name);
  await createUserIfNotExists(name);
  nameField.value = '';
  await updateUI();
});

btn.addEventListener('click', async () => {
  await checkIn();
});

function updateCountdown() {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0); // Midnight tonight

  const diff = tomorrow - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  countdownEl.textContent = `⏳ Hết hạn sau: ${h}h ${m}m ${s}s`;
}

setInterval(updateCountdown, 1000);
updateCountdown();

(async () => {

  const username = getUsername();
  if (username) {
    nameField.placeholder = "Tên hiện tại: " + username;
    await createUserIfNotExists(username);
  }
  await updateUI();
  startLeaderboardListener();
})();
