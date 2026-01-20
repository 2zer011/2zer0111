/* script.js - Logic Điểm danh đa người dùng (Firestore) - Cập nhật Error Handling */

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

// Helper to show errors to user
function showError(msg) {
  statusEl.innerHTML = `<span style="color: #f87171;">❌ Lỗi: ${msg}</span>`;
  console.error("Attendance Error:", msg);
}

async function createUserIfNotExists(username) {
  try {
    const doc = await usersCol.doc(username).get();
    if (!doc.exists) {
      await usersCol.doc(username).set({ checkins: [] });
    }
  } catch (e) {
    showError("Không thể kết nối Firestore. Kiểm tra Rules (Quy chuẩn) trên Firebase.");
    throw e;
  }
}

async function updateUI() {
  try {
    const username = getUsername();
    if (!username) {
      statusEl.textContent = '⚠️ Vui lòng nhập tên để bắt đầu.';
      btn.disabled = true;
      btn.style.opacity = "0.5";
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
      const yesterday = formatDate(new Date(Date.now() - 86400000));
      const dayBefore = formatDate(new Date(Date.now() - 2 * 86400000));
      const missedTwo = !checkins.includes(yesterday) && !checkins.includes(dayBefore);

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
  } catch (e) {
    showError("Lỗi cập nhật UI. Hãy kiểm tra lại Firebase.");
  }
}

async function checkIn() {
  try {
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
  } catch (e) {
    showError("Lỗi khi điểm danh. Hãy kiểm tra Firestore Database.");
  }
}

function startLeaderboardListener() {
  try {
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
        if (row.name === getUsername()) tr.style.background = "rgba(56, 189, 248, 0.1)";
        tr.innerHTML = `<td>${idx + 1}</td><td>${row.name}</td><td>${row.count}</td>`;
        leaderBody.appendChild(tr);
      });
    }, (err) => {
      console.error("Firestore Listen fail:", err);
      showError("Lỗi bảng xếp hạng (onSnapshot).");
    });
  } catch (e) {
    showError("Lỗi lắng nghe dữ liệu.");
  }
}

saveNameBtn.addEventListener('click', async () => {
  const name = nameField.value.trim();
  if (!name) return;

  // Show loading
  saveNameBtn.disabled = true;
  saveNameBtn.textContent = "Đang lưu...";

  try {
    setUsername(name);
    await createUserIfNotExists(name);
    nameField.value = '';
    nameField.placeholder = "Tên hiện tại: " + name;
    await updateUI();
  } catch (e) {
    // Reset if failed
    saveNameBtn.disabled = false;
    saveNameBtn.textContent = "Lưu tên";
  } finally {
    saveNameBtn.disabled = false;
    saveNameBtn.textContent = "Lưu tên";
  }
});

btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = "Đang xử lý...";
  await checkIn();
});

function updateCountdown() {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);

  const diff = tomorrow - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  countdownEl.textContent = `⏳ Hết hạn sau: ${h}h ${m}m ${s}s`;
}

setInterval(updateCountdown, 1000);
updateCountdown();

(async () => {
  try {
    const username = getUsername();
    if (username) {
      nameField.placeholder = "Tên hiện tại: " + username;
      await createUserIfNotExists(username);
    }
    await updateUI();
    startLeaderboardListener();
  } catch (e) {
    showError("Khởi tạo thất bại. Hãy chắc chắn Firestore đã được tạo.");
  }
})();
