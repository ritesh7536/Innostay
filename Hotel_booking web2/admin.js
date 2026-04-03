// Minimal shared helpers
const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '5500' ? 'http://localhost:4001' : window.location.origin;
function showMessage(message, type = 'error') {
  const box = document.getElementById('message-box');
  const text = document.getElementById('message-text');
  if (!box || !text) return;
  text.textContent = message;
  box.className = 'message-box';
  box.classList.add(type);
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    window.location.href = 'index.html';
  });

  // Redirect to login if not admin
  bootstrapAuth().then((user) => {
    if (!user || !user.isAdmin) {
      showMessage('Admin access required.', 'error');
      setTimeout(() => (window.location.href = 'index.html'), 800);
      return;
    }
    // Update admin name if element exists
    const adminNameEl = document.getElementById('admin-name');
    if (adminNameEl) adminNameEl.textContent = user.fullname || user.username;
    
    loadAdminDashboard();
    wireAdminCreate();
  });

  const applyBtn = document.getElementById('stats-apply');
  if (applyBtn) applyBtn.addEventListener('click', () => loadAdminDashboard());

  // Clear cancelled bookings button
  const clearCancelledBtn = document.getElementById('clear-cancelled-btn');
  if (clearCancelledBtn) {
    clearCancelledBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete ALL cancelled bookings? This cannot be undone.')) {
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/bookings/admin/clear-cancelled`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const result = await res.json();
          showMessage(`Cleared ${result.deletedCount} cancelled bookings`, 'success');
          loadAdminDashboard(); // Reload the dashboard
        } else {
          const error = await res.json();
          showMessage(error.message || 'Failed to clear cancelled bookings', 'error');
        }
      } catch (err) {
        showMessage('Network error. Please try again.', 'error');
      }
    });
  }
});

async function bootstrapAuth() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function getStatsRange() {
  const fromEl = document.getElementById('stats-from');
  const toEl = document.getElementById('stats-to');
  return { from: fromEl && fromEl.value ? fromEl.value : null, to: toEl && toEl.value ? toEl.value : null };
}

async function loadAdminDashboard() {
  const token = localStorage.getItem('token');
  const ts = Date.now();
  try {
    const res = await fetch(`${API_BASE}/api/bookings/admin/summary?_t=${ts}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setText('stat-total-rooms', data.totalRooms);
    setText('stat-total-bookings', data.totalBookings);
    setText('stat-active-bookings', data.activeBookings);
    setText('stat-needs-cleaning', data.roomsNeedingCleaning);

    const roomsRes = await fetch(`${API_BASE}/api/rooms?_t=${ts}`);
    const roomsData = await roomsRes.json();
    const needing = (roomsData.rooms || []).filter((r) => r.needsCleaning);
    renderCleaningList(needing);

    const { from, to } = getStatsRange();
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    qs.set('_t', ts);
    const statsRes = await fetch(`${API_BASE}/api/bookings/admin/stats?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    const statsData = await statsRes.json();
    renderBookingsChart(statsData.byRoom, roomsData.rooms || []);

    renderRoomsTable(roomsData.rooms || []);
    
    // Load all bookings
    const bookingsRes = await fetch(`${API_BASE}/api/bookings/admin/all?_t=${ts}`, { headers: { Authorization: `Bearer ${token}` } });
    const bookingsData = await bookingsRes.json();
    renderBookingsTable(bookingsData.bookings || []);
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderCleaningList(rooms) {
  const list = document.getElementById('cleaning-list');
  if (!list) return;
  list.innerHTML = '';
  if (rooms.length === 0) {
    list.innerHTML = '<li style="padding: 10px; color: #666; font-style: italic;">No rooms need cleaning.</li>';
    return;
  }
  rooms.forEach((r) => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    li.style.marginBottom = '8px';
    li.style.padding = '8px 12px';
    li.style.background = '#f8f9fa';
    li.style.borderRadius = '6px';
    
    const span = document.createElement('span');
    span.textContent = `${r.name} (${r.type})`;
    
    const btn = document.createElement('button');
    btn.textContent = 'Mark Cleaned';
    btn.className = 'btn btn-sm btn-success';
    btn.onclick = () => markCleaned(r._id);
    
    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

async function markCleaned(roomId) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/api/rooms/${roomId}/cleaning`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ needsCleaning: false })
    });
    if (res.ok) {
      showMessage('Room marked as cleaned.', 'success');
      loadAdminDashboard();
    } else {
      showMessage('Failed to update room.', 'error');
    }
  } catch {
    showMessage('Network error.', 'error');
  }
}

function renderBookingsChart(byRoom, allRooms) {
  const canvas = document.getElementById('bookings-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const labels = byRoom.map((x) => {
    const r = allRooms.find((ar) => String(ar._id) === String(x._id));
    return r ? r.name : x._id;
  });
  const values = byRoom.map((x) => x.count);
  const max = Math.max(1, ...values);
  const barWidth = Math.max(20, Math.floor((canvas.width - 40) / Math.max(1, values.length)) - 10);
  labels.forEach((label, i) => {
    const x = 30 + i * (barWidth + 10);
    const h = Math.round((values[i] / max) * (canvas.height - 50));
    const y = canvas.height - 20 - h;
    
    // Gradient fill
    const gradient = ctx.createLinearGradient(0, y, 0, canvas.height - 20);
    gradient.addColorStop(0, '#4361ee');
    gradient.addColorStop(1, '#3a56d4');
    ctx.fillStyle = gradient;
    
    ctx.fillRect(x, y, barWidth, h);
    ctx.fillStyle = '#000';
    ctx.font = '12px Poppins';
    ctx.textAlign = 'center';
    ctx.fillText(String(values[i]), x + barWidth / 2, y - 4);
    ctx.save();
    ctx.translate(x + barWidth / 2, canvas.height - 5);
    // ctx.rotate(-Math.PI / 4);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

function renderBookingsTable(bookings) {
  const tbody = document.querySelector('#bookings-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  bookings.forEach((b) => {
    const tr = document.createElement('tr');
    
    let statusClass = 'status-confirmed';
    if (b.status === 'cancelled') statusClass = 'status-cancelled';
    else if (b.status === 'checked_out') statusClass = 'status-checked-out';
    
    const displayStatus = b.status ? b.status.replace('_', ' ').toUpperCase() : 'CONFIRMED';
    
    const roomName = b.roomId?.name || 'Unknown Room';
    const subroomText = b.selectedSubroom ? ` (${b.selectedSubroom})` : '';
    const customerName = b.userId?.fullname || b.userId?.username || 'Unknown';
    const customerEmail = b.userId?.email || '';
    
    tr.innerHTML = `
      <td><span style="font-family: monospace; font-weight: bold;">${b._id.slice(-6)}</span></td>
      <td>
        <div style="font-weight: 500;">${customerName}</div>
        <div style="font-size:12px; color:#666;">${customerEmail}</div>
        ${b.customers && b.customers.length > 0 ? `
            <div style="font-size: 11px; margin-top: 4px; color: #4361ee;">
                + ${b.customers.length} guest(s)
            </div>
        ` : ''}
      </td>
      <td>${roomName}${subroomText}</td>
      <td>${new Date(b.checkIn).toLocaleDateString()}</td>
      <td>${new Date(b.checkOut).toLocaleDateString()}</td>
      <td>₹${b.totalPrice}</td>
      <td><span class="status-badge ${statusClass}">${displayStatus}</span></td>
      <td>
        <div class="action-buttons">
            <button class="btn-icon" onclick="downloadAdminReceipt('${b._id}')" title="Download Receipt">
                <span class="material-icons-round">receipt</span>
            </button>
            ${b.status !== 'checked_out' && b.status !== 'cancelled' ? `
                <button class="btn-icon btn-checkout" onclick="checkOutBooking('${b._id}')" title="Check Out / Empty Room">
                    <span class="material-icons-round">logout</span>
                </button>
            ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function checkOutBooking(bookingId) {
    if (!confirm('Are you sure you want to check out this booking? This will mark the room as empty and needing cleaning.')) return;
    
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/checkout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
            showMessage('Guest checked out successfully. Room status updated.', 'success');
            loadAdminDashboard();
        } else {
            showMessage('Failed to check out.', 'error');
        }
    } catch {
        showMessage('Network error.', 'error');
    }
}
// Expose to window for onclick
window.checkOutBooking = checkOutBooking;

async function downloadAdminReceipt(bookingId) {
  const token = localStorage.getItem('token');
  if (!token) {
    showMessage('Please login to download receipt', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/receipt`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      showMessage('Failed to generate receipt', 'error');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `booking-${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    showMessage('Network error. Please try again.', 'error');
  }
}
window.downloadAdminReceipt = downloadAdminReceipt;

function renderRoomsTable(rooms) {
  const tbody = document.querySelector('#rooms-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  rooms.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="table-input" value="${r.name}" data-field="name"></td>
      <td>
        <select class="table-input" data-field="type">
          <option value="standard" ${r.type === 'standard' ? 'selected' : ''}>Standard</option>
          <option value="deluxe" ${r.type === 'deluxe' ? 'selected' : ''}>Deluxe</option>
          <option value="suite" ${r.type === 'suite' ? 'selected' : ''}>Suite</option>
        </select>
      </td>
      <td><input type="number" class="table-input" value="${r.capacity}" data-field="capacity" style="width: 60px;"></td>
      <td><input type="number" class="table-input" value="${r.pricePerNight}" data-field="pricePerNight" style="width: 80px;"></td>
      <td>
        <span class="status-badge ${r.needsCleaning ? 'status-cancelled' : 'status-confirmed'}">
            ${r.needsCleaning ? 'Needs Cleaning' : 'Ready'}
        </span>
      </td>
      <td>
        <div class="action-buttons">
            <button class="btn-icon" data-action="save" title="Save Changes">
                <span class="material-icons-round">save</span>
            </button>
            <button class="btn-icon btn-delete" data-action="delete" title="Delete Room">
                <span class="material-icons-round">delete</span>
            </button>
        </div>
      </td>
    `;
    tr.querySelector('[data-action="save"]').addEventListener('click', () => saveRoomRow(r._id, tr));
    tr.querySelector('[data-action="delete"]').addEventListener('click', () => deleteRoom(r._id));
    tbody.appendChild(tr);
  });
}

async function saveRoomRow(roomId, tr) {
  const token = localStorage.getItem('token');
  const payload = {};
  tr.querySelectorAll('input, select').forEach((el) => {
    const field = el.getAttribute('data-field');
    if (field === 'capacity' || field === 'pricePerNight') payload[field] = Number(el.value);
    else payload[field] = el.value;
  });
  try {
    const res = await fetch(`${API_BASE}/api/rooms/${roomId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showMessage('Room saved.', 'success');
      loadAdminDashboard();
    } else showMessage('Failed to save room.', 'error');
  } catch {
    showMessage('Network error.', 'error');
  }
}

async function deleteRoom(roomId) {
  if (!confirm('Are you sure you want to delete this room?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/api/rooms/${roomId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      showMessage('Room deleted.', 'success');
      loadAdminDashboard();
    } else showMessage('Failed to delete room.', 'error');
  } catch {
    showMessage('Network error.', 'error');
  }
}

function wireAdminCreate() {
  const form = document.getElementById('admin-room-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const name = document.getElementById('room-name').value;
    const type = document.getElementById('room-type').value;
    const capacity = parseInt(document.getElementById('room-capacity').value, 10);
    const pricePerNight = parseInt(document.getElementById('room-price').value, 10);
    const amenitiesStr = document.getElementById('room-amenities').value;
    const imagesStr = document.getElementById('room-images').value;
    const description = document.getElementById('room-description').value;
    const amenities = amenitiesStr ? amenitiesStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const images = imagesStr ? imagesStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, capacity, pricePerNight, amenities, images, description })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showMessage('Room created successfully.', 'success');
        form.reset();
        loadAdminDashboard();
      } else showMessage(data.message || 'Failed to create room', 'error');
    } catch {
      showMessage('Network error.', 'error');
    }
  });
}
