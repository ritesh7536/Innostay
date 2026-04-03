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

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    showMessage('Please login to view bookings.', 'error');
    setTimeout(() => (window.location.href = 'index.html'), 800);
    return;
  }
  const logout = document.getElementById('logout-link');
  if (logout) logout.addEventListener('click', (e) => { e.preventDefault(); localStorage.removeItem('token'); window.location.href = 'index.html'; });

  try {
    // Try to load online bookings
    let onlineBookings = [];
    try {
      const res = await fetch(`${API_BASE}/api/bookings/me`, { 
        headers: { Authorization: `Bearer ${token}` },
        // Don't fail the entire load if online fetch fails
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      if (res.ok) {
        const data = await res.json();
        onlineBookings = Array.isArray(data.bookings) ? data.bookings : [];
      } else {
        console.warn('Failed to fetch online bookings, will try offline data');
      }
    } catch (onlineError) {
      console.warn('Error fetching online bookings:', onlineError);
    }

    // Load offline bookings from localStorage
    const offlineBookings = JSON.parse(localStorage.getItem('tempBookings') || '[]');
    
    // Mark offline bookings
    const offlineBookingsWithFlag = offlineBookings.map(b => ({
      ...b,
      isOffline: true,
      status: 'pending'
    }));

    // Combine and sort by date (newest first)
    const allBookings = [...onlineBookings, ...offlineBookingsWithFlag].sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    renderBookings(allBookings);
  } catch (error) {
    console.error('Error loading bookings:', error);
    showMessage('Failed to load bookings. ' + (error.message || ''), 'error');
  }
});

function renderBookings(bookings) {
  const tbody = document.querySelector('#my-bookings-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  bookings.forEach((b) => {
    const tr = document.createElement('tr');
    const statusClass = b.isOffline ? 'offline' : (b.status === 'cancelled' ? 'cancelled' : 'confirmed');
    const roomName = b.roomId?.name || '';
    const subroomText = b.selectedSubroom ? ` (${b.selectedSubroom})` : '';
    
    tr.innerHTML = `
      <td>${b._id ? b._id.slice(-8) : 'N/A'}</td>
      <td>${roomName}${subroomText}</td>
      <td>${b.checkIn ? new Date(b.checkIn).toDateString() : 'N/A'}</td>
      <td>${b.checkOut ? new Date(b.checkOut).toDateString() : 'N/A'}</td>
      <td>${b.totalPrice ? '₹' + b.totalPrice : 'N/A'}</td>
      <td><span class="status ${statusClass}">${b.status}</span></td>
      <td>
        <button class="btn btn-secondary" onclick="downloadPDF('${b._id}')">PDF</button>
        ${!b.isOffline && b.status === 'confirmed' ? `<button class="btn btn-danger" onclick="cancelBooking('${b._id}')">Cancel</button>` : ''}
        ${b.isOffline ? '<span class="badge bg-warning text-dark">Offline</span>' : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Make functions globally available
window.downloadPDF = async function(bookingId) {
  console.log('Downloading PDF for booking:', bookingId);
  
  // Check if this is an offline booking
  const tempBookings = JSON.parse(localStorage.getItem('tempBookings') || '[]');
  const offlineBooking = tempBookings.find(b => b._id === bookingId);
  
  if (offlineBooking) {
    // Generate a simple HTML receipt for offline bookings
    generateAndDownloadReceipt(offlineBooking);
    return;
  }
  
  // For online bookings, try to fetch from the server
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      showMessage('Please login to download PDF', 'error');
      return;
    }
    
    // First check if it's a temporary booking
    if (bookingId.startsWith('temp-booking-')) {
      // Get the booking from localStorage
      const tempBookings = JSON.parse(localStorage.getItem('tempBookings') || '[]');
      const tempBooking = tempBookings.find(b => b._id === bookingId);
      
      if (tempBooking) {
        generateAndDownloadReceipt(tempBooking);
      } else {
        showMessage('Temporary booking not found', 'error');
      }
      return;
    }
    
    // For non-temporary bookings, try to get the PDF
    const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/receipt`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      // If PDF generation fails, try to get the booking details and generate HTML receipt
      const bookingRes = await fetch(`${API_BASE}/api/bookings/${bookingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (bookingRes.ok) {
        const bookingData = await bookingRes.json();
        generateAndDownloadReceipt(bookingData);
        return;
      }
      throw new Error('Failed to fetch receipt');
    }

    // If we get here, the PDF was generated successfully
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${bookingId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (err) {
    console.error('Error generating receipt:', err);
    showMessage('Could not generate receipt. Please try again later or contact support.', 'error');
  }
};

function generateAndDownloadReceipt(booking) {
    const receiptContent = `
        <html>
          <head>
            <title>Booking Receipt - ${booking._id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .section { margin-bottom: 20px; }
              .section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
              .row { display: flex; margin-bottom: 5px; }
              .label { font-weight: bold; width: 150px; }
              .value { flex: 1; }
              .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Booking Receipt</h2>
              <p>Booking ID: ${booking._id}</p>
              <p>Status: <strong>${booking.status || 'Confirmed'}</strong></p>
            </div>
            
            <div class="section">
              <div class="section-title">Booking Details</div>
              <div class="row">
                <div class="label">Check-in:</div>
                <div class="value">${new Date(booking.checkIn).toLocaleDateString()}</div>
              </div>
              <div class="row">
                <div class="label">Check-out:</div>
                <div class="value">${new Date(booking.checkOut).toLocaleDateString()}</div>
              </div>
              <div class="row">
                <div class="label">Guests:</div>
                <div class="value">${booking.guests || 1}</div>
              </div>
              <div class="row">
                <div class="label">Room Type:</div>
                <div class="value">${booking.roomId?.name || 'Standard Room'}</div>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Primary Guest Information</div>
              <div class="row">
                <div class="label">Name:</div>
                <div class="value">${booking.contact?.name || 'N/A'}</div>
              </div>
              <div class="row">
                <div class="label">Email:</div>
                <div class="value">${booking.contact?.email || 'N/A'}</div>
              </div>
              <div class="row">
                <div class="label">Phone:</div>
                <div class="value">${booking.contact?.phone || 'N/A'}</div>
              </div>
            </div>
            
            ${booking.customers && booking.customers.length > 0 ? `
            <div class="section">
              <div class="section-title">Additional Guests</div>
              ${booking.customers.map((guest, index) => `
                <div style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
                  <div class="row">
                    <div class="label">Guest ${index + 1} Name:</div>
                    <div class="value">${guest.name || 'N/A'}</div>
                  </div>
                  <div class="row">
                    <div class="label">Age:</div>
                    <div class="value">${guest.age || 'N/A'}</div>
                  </div>
                  <div class="row">
                    <div class="label">Gender:</div>
                    <div class="value">${guest.gender || 'N/A'}</div>
                  </div>
                  ${guest.idType ? `
                  <div class="row">
                    <div class="label">ID Type:</div>
                    <div class="value">${guest.idType}</div>
                  </div>
                  <div class="row">
                    <div class="label">ID Number:</div>
                    <div class="value">${guest.idNumber || 'N/A'}</div>
                  </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
            ` : ''}
            
            <div class="footer">
              <p>Thank you for choosing our hotel!</p>
              <p>This is an HTML receipt. A PDF receipt will be available when the service is back online.</p>
              <p>Generated on: ${new Date().toLocaleString()}</p>
            </div>
          </body>
        </html>
      `;
      
      const blob = new Blob([receiptContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `booking-${booking._id}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
}

window.cancelBooking = async function(bookingId) {
  console.log('Cancel booking clicked for ID:', bookingId);
  
  if (!confirm('Are you sure you want to cancel this booking?')) {
    console.log('User cancelled the confirmation');
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    console.log('Sending cancellation request...');
    
    const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/cancel`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Response status:', res.status);
    
    if (res.ok) {
      const result = await res.json();
      console.log('Cancellation successful:', result);
      console.log('Updated booking status:', result.booking?.status);
      showMessage('Booking cancelled successfully', 'success');
      
      // Force a page reload to ensure we get fresh data
      console.log('Reloading page to refresh data...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      const error = await res.json();
      console.error('Cancellation failed:', error);
      showMessage(error.message || 'Failed to cancel booking', 'error');
    }
  } catch (err) {
    console.error('Network error:', err);
    showMessage('Network error. Please try again.', 'error');
  }
}

