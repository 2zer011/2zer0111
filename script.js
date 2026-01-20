/* script.js - SIÊU DEBUG - Kiểm tra từng bước */

console.log("🚀 Script.js đang tải...");

function formatDate(date) { return date.toISOString().split('T')[0]; }
function today() { return formatDate(new Date()); }

const USER_KEY = 'attendanceUsername';
function getUsername() { return localStorage.getItem(USER_KEY) || ''; }
function setUsername(name) { localStorage.setItem(USER_KEY, name); }

// Kiểm tra db đã sẵn sàng chưa
if (typeof db === 'undefined') {
  console.error("❌ BIẾN 'db' CHƯA ĐƯỢC ĐỊNH NGHĨA! Kiểm tra firebase-config.js");
} else {
  console.log("✅ Firestore 'db' đã sẵn sàng.");
}

const usersCol = db.collection('users');

const statusEl = document.getElementById('status');
const btn = document.getElementById('checkinBtn');
const countdownEl = document.getElementById('countdown');
const nameField = document.getElementById('nameField');
const saveNameBtn = document.getElementById('saveNameBtn');
const leaderBody = document.getElementById('leaderBody');

function showError(msg) {
  statusEl.innerHTML = `<span style="color: #f87171;">❌ Lỗi: ${msg}</span>`;
  console.error("DEBUG ERROR:", msg);
}

async function createUserIfNotExists(username) {
  console.log(`🔍 Đang kiểm tra người dùng: ${username}`);
  try {
    const doc = await usersCol.doc(username).get();
    if (!doc.exists) {
      console.log(`🆕 Người dùng mới, đang tạo document...`);
      await usersCol.doc(username).set({ checkins: [] });
      console.log(`✅ Đã tạo document cho ${username}`);
    } else {
      console.log(`👤 Người dùng đã tồn tại.`);
    }
  } catch (e) {
    showError("Lỗi kết nối Firebase (Quyền truy cập).");
    console.error(e);
    throw e;
  }
}

async function updateUI() {
  console.log("🔄 Đang cập nhật giao diện...");
  try {
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
      btn.textContent = 'Đã điểm danh';
    } else {
      const yesterday = formatDate(new Date(Date.now() - 86400000));
      const dayBefore = formatDate(new Date(Date.now() - 2 * 86400000));
      const missedTwo = !checkins.includes(yesterday) && !checkins.includes(dayBefore);

      if (missedTwo && checkins.length > 0) {
        statusEl.innerHTML = '<span class="dead">💀 Bạn đã chết! (Bỏ 2 ngày)</span>';
        btn.disabled = true;
      } else {
        statusEl.textContent = '🔔 Chưa điểm danh hôm nay';
        btn.disabled = false;
        btn.textContent = '🟢 Điểm danh hôm nay';
      }
    }
  } catch (e) {
    showError("Không thể lấy dữ liệu từ Firestore.");
    console.error(e);
  }
}

async function checkIn() {
  console.log("🖱️ Đang xử lý nhấn nút Điểm danh...");
  try {
    const username = getUsername();
    const todayStr = today();
    const docRef = usersCol.doc(username);
    const snap = await docRef.get();
    const data = snap.data() || { checkins: [] };

    if (!data.checkins.includes(todayStr)) {
      data.checkins.push(todayStr);
      console.log(`📝 Đang ghi ngày ${todayStr} vào Firestore...`);
      await docRef.update({ checkins: data.checkins });
      console.log("✅ Ghi dữ liệu thành công!");
    }
    await updateUI();
  } catch (e) {
    showError("Lỗi ghi dữ liệu. Kiểm tra tab Rules (Sécurité).");
    console.error(e);
  }
}

function startLeaderboardListener() {
  console.log("📈 Bắt đầu lắng nghe Bảng xếp hạng...");
  usersCol.onSnapshot(snapshot => {
    console.log("📥 Nhận dữ liệu mới từ Firestore!");
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
    console.error("🔥 Bảng xếp hạng lỗi:", err);
    showError("Lỗi Firebase (Hãy nhấn Publier trong tab Rules).");
  });
}

saveNameBtn.addEventListener('click', async () => {
  const name = nameField.value.trim();
  console.log(`🖱️ Nhấn Lưu tên: ${name}`);
  if (!name) return;

  saveNameBtn.disabled = true;
  saveNameBtn.textContent = "...";

  try {
    setUsername(name);
    await createUserIfNotExists(name);
    nameField.value = '';
    nameField.placeholder = "Chào " + name;
    await updateUI();
  } catch (e) {
    console.error("Lỗi khi lưu tên:", e);
  } finally {
    saveNameBtn.disabled = false;
    saveNameBtn.textContent = "Lưu tên";
  }
});

btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = "...";
  await checkIn();
});

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
  console.log("🏁 Khởi chạy ứng dụng...");
  const username = getUsername();
  if (username) {
    console.log(`👤 Tìm thấy session cho: ${username}`);
    await createUserIfNotExists(username);
  }
  await updateUI();
  startLeaderboardListener();
})();
