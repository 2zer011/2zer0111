/* script.js - PHIÊN BẢN SỬA LỖI KẾT NỐI (FIRESTORE FIX) */

// 1. Ép buộc Firestore sử dụng Long-Polling để tránh bị chặn mạng
db.settings({
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

console.log("🚀 Đang khởi động ứng dụng với chế độ Long-Polling...");

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

function showError(msg, detail = "") {
  statusEl.innerHTML = `<div style="color: #f87171; font-size: 0.9rem;">
    ❌ Lỗi: ${msg}<br>
    <small style="color: #94a3b8;">${detail}</small>
  </div>`;
  console.error("DEBUG ERROR:", msg, detail);
}

async function createUserIfNotExists(username) {
  console.log(`🔍 Kiểm tra người dùng: ${username}`);
  try {
    const doc = await usersCol.doc(username).get();
    if (!doc.exists) {
      console.log("🆕 Tạo mới user...");
      await usersCol.doc(username).set({ checkins: [] });
    }
    console.log("✅ User sẵn sàng.");
  } catch (e) {
    showError("Không thể kết nối Firebase.", "Gợi ý: Kiểm tra mạng hoặc nhấn 'Publier' trong tab Sécurité.");
    throw e;
  }
}

async function updateUI() {
  const username = getUsername();
  if (!username) {
    statusEl.textContent = '⚠️ Về trang chủ nhập tên để bắt đầu.';
    btn.disabled = true;
    return;
  }

  try {
    const snap = await usersCol.doc(username).get();
    const checkins = (snap.data() && snap.data().checkins) || [];
    const todayStr = today();

    if (checkins.includes(todayStr)) {
      statusEl.innerHTML = '<span style="color: #4ade80;">✅ Đã điểm danh hôm nay!</span>';
      btn.disabled = true;
      btn.textContent = 'Đã xong';
    } else {
      const y = formatDate(new Date(Date.now() - 86400000));
      const dbDate = formatDate(new Date(Date.now() - 2 * 86400000));
      const missedTwo = !checkins.includes(y) && !checkins.includes(dbDate);

      if (missedTwo && checkins.length > 0) {
        statusEl.innerHTML = '<span class="dead">💀 Bạn đã chết (Bỏ 2 ngày)!</span>';
        btn.disabled = true;
      } else {
        statusEl.textContent = '🔔 Sẵn sàng điểm danh hôm nay';
        btn.disabled = false;
        btn.textContent = '🟢 Điểm danh hôm nay';
      }
    }
  } catch (e) {
    showError("Lỗi đồng bộ dữ liệu.", e.message);
  }
}

async function checkIn() {
  btn.disabled = true;
  btn.textContent = "Đang xử lý...";
  const username = getUsername();
  const todayStr = today();

  try {
    const docRef = usersCol.doc(username);
    const snap = await docRef.get();
    const data = snap.data() || { checkins: [] };

    if (!data.checkins.includes(todayStr)) {
      data.checkins.push(todayStr);
      await docRef.update({ checkins: data.checkins });
      console.log("📝 Đã ghi ngày điểm danh mới.");
    }
    await updateUI();
  } catch (e) {
    showError("Lỗi khi ghi dữ liệu.", e.message);
    btn.disabled = false;
    btn.textContent = "Thử lại";
  }
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
      if (row.name === getUsername()) tr.style.background = "rgba(56, 189, 248, 0.1)";
      tr.innerHTML = `<td>${idx + 1}</td><td>${row.name}</td><td>${row.count}</td>`;
      leaderBody.appendChild(tr);
    });
  }, (err) => {
    showError("Bảng xếp hạng không tải được.", err.message);
  });
}

saveNameBtn.addEventListener('click', async () => {
  const name = nameField.value.trim();
  if (!name) return;
  saveNameBtn.disabled = true;
  try {
    setUsername(name);
    await createUserIfNotExists(name);
    nameField.placeholder = "Chào " + name;
    nameField.value = "";
    await updateUI();
  } catch (e) {
    saveNameBtn.disabled = false;
  } finally {
    saveNameBtn.disabled = false;
  }
});

btn.addEventListener('click', checkIn);

function updateCountdown() {
  const diff = new Date().setHours(24, 0, 0, 0) - new Date();
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
    nameField.placeholder = "Tên: " + username;
    try { await createUserIfNotExists(username); } catch (e) { }
  }
  await updateUI();
  startLeaderboardListener();
})();
