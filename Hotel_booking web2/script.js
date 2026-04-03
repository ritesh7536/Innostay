// Application state
const appState = {
    API_BASE: ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '5500' ? 'http://localhost:4001' : window.location.origin,
    currentUser: null,
    fetchedRooms: [],
    currentOtp: null,
    aadhaarNumber: ''
};

// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const registerLink = document.getElementById('register-link');
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');
    const userDisplay = document.getElementById('user-display');
    const adminLink = document.getElementById('admin-link');
    const bookingsLink = document.getElementById('bookings-link');
    const registerModal = document.getElementById('register-modal');
    const loginModal = document.getElementById('login-modal');
    const adminModal = document.getElementById('admin-modal');
    const bookNowModal = document.getElementById('booknow-modal');
    const closeButtons = document.querySelectorAll('.close-modal');
    const modalOverlays = document.querySelectorAll('.modal-overlay');
    const customersList = document.getElementById('customers-list');
    
    // Form elements
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const bookingForm = document.getElementById('booking-form');
    // const openBookingBtn = document.getElementById('open-booking'); // Removed
    const bookNowForm = document.getElementById('book-now-form');
    const bnRoom = document.getElementById('bn-room');
    const bnCheckin = document.getElementById('bn-checkin');
    const bnCheckout = document.getElementById('bn-checkout');
    const bnGuests = document.getElementById('bn-guests');
    const bnFullname = document.getElementById('bn-fullname');
    const bnEmail = document.getElementById('bn-email');
    const bnPhone = document.getElementById('bn-phone');
    // Optional subroom input (may not exist on this page)
    const bnSubroom = document.getElementById('bn-subroom');
    const adminRoomForm = document.getElementById('admin-room-form');

    // User Menu Elements
    const userIcon = document.getElementById('user-icon');
    const userDropdown = document.getElementById('user-dropdown');
    const dropdownLogout = document.getElementById('dropdown-logout');

    console.log('DOM elements loaded:');
    // console.log('openBookingBtn:', openBookingBtn);
    console.log('bookNowModal:', bookNowModal);
    console.log('loginModal:', loginModal);

    // User Icon Click Handler
    if (userIcon && userDropdown) {
        console.log('User icon and dropdown found');
        
        // Ensure initial state matches
        if (!userDropdown.style.display) {
            userDropdown.style.display = 'none';
        }

        userIcon.addEventListener('click', (e) => {
            console.log('User icon clicked');
            e.preventDefault();
            e.stopPropagation(); // Prevent document click from closing it immediately
            
            // Robust toggle using getComputedStyle
            const style = window.getComputedStyle(userDropdown);
            const isVisible = style.display !== 'none';
            console.log('Current display:', style.display, 'Visible:', isVisible);
            
            if (isVisible) {
                userDropdown.style.display = 'none';
            } else {
                userDropdown.style.display = 'block';
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userIcon.contains(e.target) && !userDropdown.contains(e.target)) {
                if (userDropdown.style.display === 'block') {
                    console.log('Closing dropdown (clicked outside)');
                    userDropdown.style.display = 'none';
                }
            }
        });
    } else {
        console.error('User icon or dropdown NOT found:', { userIcon, userDropdown });
    }

    // Dropdown Logout Handler
    if (dropdownLogout) {
        dropdownLogout.addEventListener('click', (e) => {
            e.preventDefault();
            // Clear user data from localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isLoggedIn');
            
            // Hide dropdown
            if (userDropdown) userDropdown.style.display = 'none';
            
            // Update UI
            updateAuthUI(null);
            showMessage('You have been logged out successfully.', 'success');
        });
    }

    // Test modal opening
    window.testModal = () => {
        console.log('Testing modal...');
        const modal = document.getElementById('booknow-modal');
        if (modal) {
            console.log('Modal exists, trying to show it');
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
            modal.style.opacity = '1';
            document.body.style.overflow = 'hidden';
        } else {
            console.log('Modal not found!');
        }
    };

    // --- Custom Message Box ---
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');

    // Function to show messages
    const showMessage = (message, type = 'info') => {
        let messageEl = document.getElementById('message-container');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'message-container';
            messageEl.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 10000; max-width: 500px;';
            document.body.appendChild(messageEl);
        }

        const msg = document.createElement('div');
        msg.className = `message ${type}`;
        msg.style.cssText = `
            padding: 15px 20px;
            margin: 10px 0;
            border-radius: 8px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
            opacity: 0.95;
        `;
        msg.textContent = message;
        messageEl.appendChild(msg);

        setTimeout(() => {
            msg.style.opacity = '0';
            msg.style.transform = 'translateY(-20px)';
            setTimeout(() => msg.remove(), 300);
        }, 5000);
    };

    // Function to show a modal
    const showModal = (modal) => {
        if (!modal) return;
        document.body.style.overflow = 'hidden'; // Prevent scrolling
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.style.opacity = '1';
        }, 10);
    };
    
    // Function to hide a modal
    const hideModal = (modal) => {
        if (!modal) return;
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.body.style.overflow = ''; // Re-enable scrolling
        }, 300);
    };

    // Function to generate and show booking receipt in a new tab
    async function showBookingReceipt(bookingData, roomName) {
        console.log('Generating receipt for booking:', bookingData);
        
        // Format dates
        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return new Date(dateString).toLocaleDateString(undefined, options);
        };
        
        // Calculate total nights
        const calculateNights = (checkIn, checkOut) => {
            if (!checkIn || !checkOut) return 0;
            const oneDay = 24 * 60 * 60 * 1000;
            const firstDate = new Date(checkIn);
            const secondDate = new Date(checkOut);
            return Math.round(Math.abs((firstDate - secondDate) / oneDay));
        };
        
        const nights = calculateNights(bookingData.checkIn, bookingData.checkOut);
        const bookingId = bookingData._id || 'N/A';
        const currentDate = new Date().toLocaleDateString();
        
        // Create a new window with a clean, modern UI
        const receiptWindow = window.open('', '_blank');
        
        try {
            // Start building the HTML content
            let receiptHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Booking Receipt - ${bookingId}</title>
                <style>
                    body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f8f9fa;
                }
                .receipt-container {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    padding: 30px;
                    margin: 20px auto;
                }
                .receipt-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #f0f0f0;
                }
                .receipt-header h1 {
                    color: #2c3e50;
                    margin: 0 0 10px 0;
                    font-size: 2em;
                }
                .receipt-header p {
                    color: #666;
                    margin: 5px 0;
                }
                .receipt-body {
                    margin: 20px 0;
                }
                .receipt-section {
                    margin-bottom: 25px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #f0f0f0;
                }
                .receipt-section:last-child {
                    border-bottom: none;
                }
                .receipt-section h2 {
                    color: #3498db;
                    font-size: 1.4em;
                    margin-bottom: 15px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #eee;
                }
                .receipt-row {
                    display: flex;
                    margin-bottom: 10px;
                    padding: 8px 0;
                    border-bottom: 1px solid #f8f9fa;
                }
                .receipt-row:last-child {
                    border-bottom: none;
                }
                .label {
                    font-weight: 600;
                    color: #555;
                    min-width: 150px;
                }
                .value {
                    color: #2c3e50;
                    flex: 1;
                }
                .guest-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                .guest-card {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 15px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .guest-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .guest-card h3 {
                    margin: 0 0 15px 0;
                    color: #2c3e50;
                    font-size: 1.1em;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 8px;
                }
                .guest-details {
                    padding: 0 5px;
                }
                .receipt-footer {
                    margin-top: 40px;
                    text-align: center;
                    padding-top: 20px;
                    border-top: 2px solid #f0f0f0;
                    color: #666;
                    font-style: italic;
                }
                .action-buttons {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    margin-top: 30px;
                    flex-wrap: wrap;
                }
                .btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                    text-decoration: none;
                }
                .btn-primary {
                    background-color: #3498db;
                    color: white;
                }
                .btn-primary:hover {
                    background-color: #2980b9;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
                }
                .btn-secondary {
                    background-color: #f1f1f1;
                    color: #333;
                }
                .btn-secondary:hover {
                    background-color: #e0e0e0;
                    transform: translateY(-2px);
                }
                .btn-icon {
                    width: 18px;
                    height: 18px;
                }
                @media print {
                    body {
                        padding: 0;
                        background: white;
                    }
                    .receipt-container {
                        box-shadow: none;
                        padding: 0;
                        margin: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .action-buttons {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="receipt-header">
                    <h1>Booking Confirmation</h1>
                    <p>Booking ID: ${bookingId}</p>
                    <p>Date: ${currentDate}</p>
                </div>
                
                <div class="receipt-body">
                    <div class="receipt-section">
                        <h2>Booking Details</h2>
                        <div class="guest-card">
                            <div class="guest-details">
                                <div class="receipt-row">
                                    <span class="label">Room Type</span>
                                    <span class="value">${roomName || 'Standard Room'}</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="label">Check-in</span>
                                    <span class="value">${formatDate(bookingData.checkIn)} (2:00 PM)</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="label">Check-out</span>
                                    <span class="value">${formatDate(bookingData.checkOut)} (12:00 PM) • ${nights} night${nights !== 1 ? 's' : ''}</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="label">Total Guests</span>
                                    <span class="value">${bookingData.guests || 1} guest${bookingData.guests > 1 ? 's' : ''}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="receipt-section">
                        <h2>Guest Information</h2>
                        <div class="guest-card">
                            <h3>Primary Guest</h3>
                            <div class="guest-details">
                                <div class="receipt-row">
                                    <span class="label">Name</span>
                                    <span class="value">${bookingData.contact?.name || 'N/A'}</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="label">Email</span>
                                    <span class="value">${bookingData.contact?.email || 'N/A'}</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="label">Phone</span>
                                    <span class="value">${bookingData.contact?.phone || 'N/A'}</span>
                                </div>
                            </div>
                        </div>`;

        // Add additional guests if any
        if (bookingData.customers && bookingData.customers.length > 0) {
            receiptWindow.document.write(`
                        <div class="guest-cards">`);
            
            bookingData.customers.forEach((guest, index) => {
                receiptWindow.document.write(`
                            <div class="guest-card">
                                <h3>Guest ${index + 1}</h3>
                                <div class="guest-details">
                                    <div class="receipt-row">
                                        <span class="label">Name</span>
                                        <span class="value">${guest.name || 'N/A'}</span>
                                    </div>
                                    <div class="receipt-row">
                                        <span class="label">Age</span>
                                        <span class="value">${guest.age || 'N/A'}</span>
                                    </div>`);
                
                if (guest.gender) {
                    receiptWindow.document.write(`
                                    <div class="receipt-row">
                                        <span class="label">Gender</span>
                                        <span class="value">${guest.gender}</span>
                                    </div>`);
                }
                
                if (guest.idType) {
                    receiptWindow.document.write(`
                                    <div class="receipt-row">
                                        <span class="label">ID Type</span>
                                        <span class="value">${guest.idType}</span>
                                    </div>
                                    <div class="receipt-row">
                                        <span class="label">ID Number</span>
                                        <span class="value">${guest.idNumber || 'N/A'}</span>
                                    </div>`);
                }
                
                if (guest.relation) {
                    receiptWindow.document.write(`
                                    <div class="receipt-row">
                                        <span class="label">Relation</span>
                                        <span class="value">${guest.relation}</span>
                                    </div>`);
                }
                
                receiptWindow.document.write(`
                                </div>
                            </div>`);
            });
            
            receiptWindow.document.write(`
                        </div>`);
        }
        
        // Add payment information if available
        if (bookingData.payment) {
            receiptWindow.document.write(`
                    <div class="receipt-section">
                        <h2>Payment Information</h2>
                        <div class="guest-card">
                            <div class="guest-details">
                                <div class="receipt-row">
                                    <span class="label">Payment Status</span>
                                    <span class="value" style="color: ${bookingData.payment.status === 'Paid' ? '#27ae60' : '#e74c3c'}; font-weight: 600;">
                                        ${bookingData.payment.status || 'Pending'}
                                    </span>
                                </div>`);
            
            if (bookingData.payment.amount) {
                receiptWindow.document.write(`
                                <div class="receipt-row">
                                    <span class="label">Amount</span>
                                    <span class="value">₹${bookingData.payment.amount.toLocaleString('en-IN')}</span>
                                </div>`);
            }
            
            if (bookingData.payment.method) {
                receiptWindow.document.write(`
                                <div class="receipt-row">
                                    <span class="label">Payment Method</span>
                                    <span class="value">${bookingData.payment.method}</span>
                                </div>`);
            }
            
            if (bookingData.payment.transactionId) {
                receiptWindow.document.write(`
                                <div class="receipt-row">
                                    <span class="label">Transaction ID</span>
                                    <span class="value">${bookingData.payment.transactionId}</span>
                                </div>`);
            }
            
            receiptWindow.document.write(`
                            </div>
                        </div>
                    </div>`);
        }
        
        // Add hotel information
        receiptWindow.document.write(`
                    <div class="receipt-section">
                        <h2>Hotel Information</h2>
                        <div class="guest-card">
                            <div class="guest-details">
                                <div class="receipt-row">
                                    <span class="label">Hotel Name</span>
                                    <span class="value">InnoStay Hotel</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="label">Address</span>
                                    <span class="value">123 Luxury Street, Mumbai, Maharashtra 400001</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="label">Contact</span>
                                    <span class="value">+91 12345 67890 | info@innostay.com</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="label">Check-in/out</span>
                                    <span class="value">Check-in: 2:00 PM | Check-out: 12:00 PM</span>
                                </div>
                            </div>
                        </div>
                    </div>`);
        
        // Add action buttons and footer
        receiptWindow.document.write(`
                    <div class="action-buttons">
                        <button id="printBtn" class="btn btn-primary">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
                            </svg>
                            Print Receipt
                        </button>
                        <button id="downloadPdfBtn" class="btn btn-secondary">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                            </svg>
                            Download PDF
                        </button>
                    </div>
                    
                    <div class="receipt-footer">
                        <p>Thank you for choosing InnoStay! We look forward to serving you.</p>
                        <p>For any assistance, please contact our 24/7 customer support.</p>
                    </div>
                </div>
            </div>
            
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <script>
                // Print button functionality
                document.getElementById('printBtn').addEventListener('click', () => {
                    window.print();
                });
                
                // Download PDF button functionality
                document.getElementById('downloadPdfBtn').addEventListener('click', async () => {
                    const element = document.querySelector('.receipt-container');
                    const opt = {
                        margin: 10,
                        filename: 'booking-receipt-${bookingId}.pdf',
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { 
                            scale: 2,
                            useCORS: true,
                            allowTaint: true
                        },
                        jsPDF: { 
                            unit: 'mm', 
                            format: 'a4', 
                            orientation: 'portrait' 
                        }
                    };
                    
                    try {
                        const button = document.getElementById('downloadPdfBtn');
                        const originalText = button.innerHTML;
                        button.disabled = true;
                        button.innerHTML = 'Generating PDF...';
                        
                        await html2pdf().set(opt).from(element).save();
                        
                        button.innerHTML = originalText;
                        button.disabled = false;
                        
                        // Show success message
                        const message = document.createElement('div');
                        message.textContent = 'PDF downloaded successfully!';
                        message.style.position = 'fixed';
                        message.style.bottom = '20px';
                        message.style.left = '50%';
                        message.style.transform = 'translateX(-50%)';
                        message.style.backgroundColor = '#27ae60';
                        message.style.color = 'white';
                        message.style.padding = '10px 20px';
                        message.style.borderRadius = '4px';
                        message.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                        message.style.zIndex = '1000';
                        document.body.appendChild(message);
                        
                        setTimeout(() => {
                            message.style.opacity = '0';
                            message.style.transition = 'opacity 0.5s';
                            setTimeout(() => message.remove(), 500);
                        }, 3000);
                    } catch (error) {
                        console.error('Error generating PDF:', error);
                        alert('Error generating PDF. Please try again.');
                        button.innerHTML = originalText;
                        button.disabled = false;
                    }
                });
                
                // Auto-close print dialog after printing
                window.onafterprint = () => {
                    // Optional: Add any post-print actions here
                };
            </script>
        </body>
        </html>`);
        
        // Close the document to finish writing
        receiptWindow.document.close();
        
        // Focus on the new window
        receiptWindow.focus();
        
        // Return the window reference in case it's needed
        return receiptWindow;
        } catch (error) {
            console.error('Error generating receipt:', error);
            if (receiptWindow) {
                receiptWindow.close();
            }
            alert('Error generating receipt. Please try again.');
        }
    }

    // Show Register Modal - Disabled, using separate page
    // Register and Login are separate pages (register.html and login.html)
    
    // Show Login Modal - Disabled, using separate page
    // Register and Login are separate pages (register.html and login.html)

    // Update UI based on authentication state
    const updateAuthUI = (user) => {
        // Handle nested user object if it comes from API response { user: { ... } }
        const actualUser = user && user.user ? user.user : user;
        
        appState.currentUser = actualUser;
        const loginLink = document.getElementById('login-link');
        const registerLink = document.getElementById('register-link');
        const logoutLink = document.getElementById('logout-link');
        const userDisplay = document.getElementById('user-display');
        const userProfile = document.getElementById('user-profile');
        const navBookNow = document.getElementById('nav-book-now');
        const myBookingsLink = document.getElementById('my-bookings-link');
        
        // User Dropdown Elements
        const userMenuContainer = document.getElementById('user-menu-container');
        const dropdownUserName = document.getElementById('dropdown-user-name');

        const isLoggedIn = !!actualUser;
        
        if (isLoggedIn) {
            // User is logged in
            if (loginLink) {
                loginLink.classList.add('hidden');
                loginLink.style.display = 'none'; // Force hide
            }
            if (registerLink) {
                registerLink.classList.add('hidden');
                registerLink.style.display = 'none'; // Force hide
            }
            
            // Show User Menu Dropdown
            if (userMenuContainer) {
                userMenuContainer.classList.remove('hidden');
                userMenuContainer.style.display = 'flex';
                
                if (dropdownUserName) {
                    const displayName = actualUser.fullname || actualUser.name || actualUser.username || actualUser.email || 'User';
                    dropdownUserName.textContent = displayName;
                }
            }

            // Hide legacy elements just in case
            if (logoutLink) {
                logoutLink.classList.remove('hidden');
                logoutLink.style.display = 'none'; // Hide legacy logout
            }
            if (userDisplay) {
                userDisplay.classList.remove('hidden');
                userDisplay.style.display = 'none'; // Hide legacy display
            }

            if (userProfile) {
                userProfile.classList.remove('hidden');
                userProfile.style.display = 'flex'; // Force show
            }
            if (navBookNow) {
                navBookNow.classList.remove('hidden');
                navBookNow.style.display = 'inline-block'; // Force show
            }
            if (myBookingsLink) {
                myBookingsLink.classList.remove('hidden');
                myBookingsLink.style.display = 'inline-block'; // Force show
            }
        } else {
            // User is logged out
            if (loginLink) {
                loginLink.classList.remove('hidden');
                loginLink.style.display = ''; // Reset to default
            }
            if (registerLink) {
                registerLink.classList.remove('hidden');
                registerLink.style.display = ''; // Reset to default
            }
            
            // Hide User Menu Dropdown
            if (userMenuContainer) {
                userMenuContainer.classList.add('hidden');
                userMenuContainer.style.display = 'none';
            }

            if (logoutLink) {
                logoutLink.classList.add('hidden');
                logoutLink.style.display = 'none'; // Force hide
            }
            if (userProfile) {
                userProfile.classList.add('hidden');
                userProfile.style.display = 'none'; // Force hide
            }
            if (navBookNow) {
                navBookNow.classList.add('hidden');
                navBookNow.style.display = 'none'; // Force hide
            }
            if (myBookingsLink) {
                myBookingsLink.classList.add('hidden');
                myBookingsLink.style.display = 'none'; // Force hide
            }
            if (userDisplay) {
                userDisplay.classList.add('hidden');
                userDisplay.style.display = 'none'; // Force hide
            }
        }
    }
    
    // Initialize auth state on page load
    // Check for currentUser object first, then fallback to isLoggedIn flag
    const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    if (storedUser) {
        updateAuthUI(storedUser);
    } else {
        updateAuthUI(isLoggedIn ? {} : null); // Fallback to empty object if only flag is present
    }
    
    // Handle Logout - Using the logoutLink from the top of the file
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Clear user data from localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('currentUser'); // Added currentUser
            localStorage.removeItem('isLoggedIn');
            // Update UI
            updateAuthUI(null);
            showMessage('You have been logged out successfully.', 'success');
        });
    }

    // Show Admin Modal
    if (adminLink) {
        adminLink.addEventListener('click', (e) => {
            e.preventDefault();
            showModal(adminModal);
            loadAdminDashboard();
        });
    }

    // Function to load rooms from API
    async function loadRoomsFromHTML() {
        try {
            const response = await fetch(`${appState.API_BASE}/api/rooms`);
            if (!response.ok) {
                throw new Error('Failed to fetch rooms');
            }
            const data = await response.json();
            return data.rooms || data;
        } catch (error) {
            console.error('Error loading rooms:', error);
            showMessage('Unable to load rooms. Please try again later.', 'error');
            return [];
        }
    }

    // Open Booking Page - Redirect to separate booking page
    // Removed old button handler since 'open-booking' button was removed from navbar
    
    // Close modal when clicking the X button
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay');
            if (modal) hideModal(modal);
        });
    });
    
    // Close modal when clicking outside the modal content
    modalOverlays.forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideModal(overlay);
            }
        });
    });
    
    // Close modal when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal:not(.hidden)');
            if (openModal) hideModal(openModal);
        }
    });

    // Setup form handlers (placeholder for now)
    const setupFormHandlers = () => {
    // 1. Handle Search Form on Index Page
    const searchForm = document.getElementById('booking-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const checkin = document.getElementById('checkin').value;
            const checkout = document.getElementById('checkout').value;
            const guests = document.getElementById('guests').value;
            
            if (!checkin || !checkout) {
                showMessage('Please select check-in and check-out dates', 'error');
                return;
            }
            
            // Redirect to booknow.html with query params
            const params = new URLSearchParams({
                checkin,
                checkout,
                guests
            });
            
            window.location.href = `booknow.html?${params.toString()}`;
        });
    }

    // 2. Handle Booking Form on Booknow Page (if it exists there)
    // Note: booknow.html might have its own script or use this one. 
    // We will check booknow.html content next.
};

    // Initialize the application
    const init = () => {
        bootstrapAuth();
        setupModalListeners();
        setupFormHandlers();
        initializeRoomSelection();
    };

    // Set up modal event listeners
    const setupModalListeners = () => {
        // Disabled modal listeners as we are using separate pages for login/register
        // if (registerLink) registerLink.addEventListener('click', () => showModal(registerModal));
        // if (loginLink) loginLink.addEventListener('click', () => showModal(loginModal));

        if (adminLink) adminLink.addEventListener('click', () => showModal(adminModal));
        if (bookingsLink) bookingsLink.addEventListener('click', () => {
            window.location.href = 'bookings.html';
        });
    };

    // Initialize room selection dropdown
    const initializeRoomSelection = () => {
        const roomSelect = document.getElementById('room-select');
        if (!roomSelect) return;
        
        roomSelect.innerHTML = '<option value="" disabled selected>Select a room</option>';
        
        // Group rooms by type
        const roomsByType = {};
        appState.fetchedRooms.forEach((room) => {
            if (!roomsByType[room.type]) {
                roomsByType[room.type] = [];
        }
        roomsByType[room.type].push(room);
    });
    
    // Add options for each room type
    Object.entries(roomsByType).forEach(([type, rooms]) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${type} Rooms`;
        
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room._id;
            option.textContent = `${room.name} - $${room.price}/night`;
            option.dataset.maxGuests = room.capacity;
            optgroup.appendChild(option);
        });
        
        bnRoom.appendChild(optgroup);
    });
    
    // Update guests max based on selected room
    bnRoom.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption?.dataset.maxGuests) {
            const guestsInput = document.getElementById('bn-guests');
            if (guestsInput) {
                guestsInput.max = selectedOption.dataset.maxGuests;
                if (parseInt(guestsInput.value) > parseInt(guestsInput.max)) {
                    guestsInput.value = guestsInput.max;
                }
            }
        }
    });
};

// ... (rest of the code remains the same)

// --- Auth bootstrap (keep user logged in) ---
    const bootstrapAuth = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            // Only update UI if we are sure we are logged out
            // updateAuthUI(null); // Don't force logout here, let initialization handle it
            return;
        }

        try {
            const response = await fetch(`${appState.API_BASE}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const user = await response.json();
                updateAuthUI(user);
            } else if (response.status === 401 || response.status === 403) {
                // Only clear if explicitly unauthorized
                console.warn('Auth token invalid/expired, logging out...');
                localStorage.removeItem('token');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('currentUser');
                updateAuthUI(null);
            } else {
                console.warn('Auth check returned unexpected status:', response.status);
                // Do NOT logout on 500 or other errors, keep local state
            }
        } catch (error) {
            console.error('Auth check failed (network/server error):', error);
            // Do NOT logout on network error, keep local state
            // localStorage.removeItem('token');
            // localStorage.removeItem('isLoggedIn');
            // updateAuthUI(null);
        }
    };

// ... (rest of the code remains the same)

// Aadhaar Verification Section
const aadhaarForm = document.getElementById('aadhaar-verification');
const aadhaarInput = document.getElementById('aadhaar-number');
const verifyAadhaarBtn = document.getElementById('verify-aadhaar');
const otpSection = document.getElementById('otp-section');
const otpInput = document.getElementById('otp');
const verifyOtpBtn = document.getElementById('verify-otp');
const aadhaarStatus = document.getElementById('aadhaar-status');
    
// Generate random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
    
// Send OTP to the registered mobile number (simulated)
// ... (rest of the code remains the same)

// Verify OTP button click handler
if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', () => {
        const enteredOtp = otpInput.value.trim();
        if (enteredOtp === appState.currentOtp) {
            alert('Aadhaar verified successfully!');
            document.getElementById('aadhaar-verified').value = 'true';
            document.getElementById('customer-section').style.display = 'block';
            otpSection.style.display = 'none';
            
            // Update verify button to show verified state
            const verifyBtn = document.getElementById('verify-aadhaar');
            verifyBtn.textContent = '✓ Verified';
            verifyBtn.disabled = true;
            verifyBtn.classList.remove('btn-secondary');
            verifyBtn.classList.add('btn-verified');
        } else {
            alert('Invalid OTP. Please try again.');
        }
    });
}

// ... (rest of the code remains the same)

const addCustomerRow = () => {
    if (!customersList) return;
    const row = document.createElement('div');
    row.className = 'customer-row';
    
    row.innerHTML = `
        <input type="text" placeholder="Full Name" required data-field="name">
        <input type="number" placeholder="Age" min="1" max="120" required data-field="age">
        <select required data-field="gender">
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
        </select>
        <button type="button" class="remove-customer" aria-label="Remove customer">×</button>
    `;
    
    const removeBtn = row.querySelector('.remove-customer');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            if (customersList.children.length > 1) {
                row.remove();
            }
        });
    }
    
    customersList.appendChild(row);
};

// ... (rest of the code remains the same)

const collectCustomers = () => {
    const rows = customersList ? Array.from(customersList.querySelectorAll('.customer-row')) : [];
    return rows.map(row => {
        const name = row.querySelector('[data-field="name"]')?.value || '';
        const age = parseInt(row.querySelector('[data-field="age"]')?.value) || 0;
        const gender = row.querySelector('[data-field="gender"]')?.value || '';
        const idTypeSelect = row.querySelector('[data-field="idType"]');
        
        return { name, age, gender };
    }).filter(customer => customer.name.trim() !== ''); // Only include customers with names
};

// ... (rest of the code remains the same)

// --- Admin Create Room ---
if (adminRoomForm) {
    adminRoomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('Please login to create rooms.', 'error');
            return;
        }

        const name = document.getElementById('room-name').value;
        const type = document.getElementById('room-type').value;
        const capacity = parseInt(document.getElementById('room-capacity').value, 10);
        const pricePerNight = parseInt(document.getElementById('room-price').value, 10);
        const amenitiesStr = document.getElementById('room-amenities').value;
        const imagesStr = document.getElementById('room-images').value;
        const description = document.getElementById('room-description').value;

        const amenities = amenitiesStr ? amenitiesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        const images = imagesStr ? imagesStr.split(',').map(s => s.trim()).filter(Boolean) : [];

        try {
                const res = await fetch(`${API_BASE}/api/rooms`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        name, 
                        type, 
                        capacity, 
                        pricePerNight, 
                        amenities, 
                        images, 
                        description 
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (res.status === 401) {
                    localStorage.removeItem('token');
                    showMessage('Please login to create rooms.', 'error');
                    showModal(loginModal);
                } else if (res.ok) {
                    showMessage('Room created.', 'success');
                    hideModal(adminModal);
                    adminRoomForm.reset();
                    fetchRooms();
                } else {
                    showMessage(data.message || 'Failed to create room', 'error');
                }
            } catch (err) {
                console.error('Error creating room:', err);
                showMessage(err.message || 'Network error. Please try again.', 'error');
            }
        });
    }

    // --- Admin Dashboard Logic ---
    const loadAdminDashboard = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('Please login to access the dashboard', 'error');
            return;
        }

        try {
            // Show loading state
            const dashboardSection = document.getElementById('admin-dashboard');
            if (dashboardSection) dashboardSection.classList.add('loading');

            // 1. Fetch booking summary
            const summaryRes = await fetch(`${appState.API_BASE}/api/bookings/admin/summary`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!summaryRes.ok) {
                if (summaryRes.status === 401) {
                    localStorage.removeItem('token');
                    showMessage('Session expired. Please login again.', 'error');
                    showModal(loginModal);
                    return;
                }
                throw new Error('Failed to load dashboard data');
            }

            const summaryData = await summaryRes.json();
            
            // Update UI with summary data
            setText('stat-total-rooms', summaryData.totalRooms || 0);
            setText('stat-total-bookings', summaryData.totalBookings || 0);
            setText('stat-active-bookings', summaryData.activeBookings || 0);
            setText('stat-needs-cleaning', summaryData.roomsNeedingCleaning || 0);

            // 2. Fetch rooms data
            const roomsRes = await fetch(`${appState.API_BASE}/api/rooms`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!roomsRes.ok) throw new Error('Failed to load rooms data');
            const roomsData = await roomsRes.json();

            // 3. Process rooms needing cleaning
            const needsCleaning = (roomsData.rooms || []).filter(r => r.needsCleaning);
            renderCleaningList(needsCleaning);

            // 4. Load booking statistics
            const { from, to } = getStatsRange();
            const qs = new URLSearchParams();
            if (from) qs.set('from', from);
            if (to) qs.set('to', to);

            const statsRes = await fetch(
                `${appState.API_BASE}/api/bookings/admin/stats?${qs.toString()}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!statsRes.ok) throw new Error('Failed to load statistics');
            const statsData = await statsRes.json();

            // 5. Render charts and tables
            renderBookingsChart(statsData.byRoom || [], roomsData.rooms || []);
            renderRoomsTable(roomsData.rooms || []);

        } catch (error) {
            console.error('Dashboard error:', error);
            showMessage(error.message || 'Failed to load dashboard', 'error');
        } finally {
            // Remove loading state
            const dashboardSection = document.getElementById('admin-dashboard');
            if (dashboardSection) dashboardSection.classList.remove('loading');
        }
    }

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    }

    const renderCleaningList = (rooms) => {
        const list = document.getElementById('cleaning-list');
        if (!list) return;
        list.innerHTML = '';
        rooms.forEach(r => {
            const li = document.createElement('li');
            li.textContent = `${r.name} (${r.type})`;
            const btn = document.createElement('button');
            btn.textContent = 'Mark Cleaned';
            btn.className = 'btn btn-secondary';
            btn.style.marginLeft = '8px';
            btn.addEventListener('click', () => markCleaned(r._id));
            li.appendChild(btn);
            list.appendChild(li);
        });
    }

    async function markCleaned(roomId) {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_BASE}/api/rooms/${roomId}/cleaning`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ needsCleaning: false })
            });
            if (res.ok) {
                showMessage('Room marked as cleaned.', 'success');
                loadAdminDashboard();
            } else if (res.status === 401) {
                localStorage.removeItem('token');
                showMessage('Session expired. Please login again.', 'error');
                showModal(loginModal);
            } else {
                showMessage('Failed to update room.', 'error');
            }
        } catch {
            showMessage('Network error.', 'error');
        }
    }

    const getStatsRange = () => {
        const fromEl = document.getElementById('stats-from');
        const toEl = document.getElementById('stats-to');
        return { from: fromEl && fromEl.value ? fromEl.value : null, to: toEl && toEl.value ? toEl.value : null };
    }

    const statsApply = document.getElementById('stats-apply');
    if (statsApply) {
        statsApply.addEventListener('click', () => loadAdminDashboard());
    }

    // Minimal chart renderer without external libs
    function renderBookingsChart(byRoom, allRooms) {
        const canvas = document.getElementById('bookings-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const labels = byRoom.map(x => {
            const r = allRooms.find(ar => String(ar._id) === String(x._id));
            return r ? r.name : x._id;
        });
        const values = byRoom.map(x => x.count);
        const max = Math.max(1, ...values);
        const barWidth = Math.max(20, Math.floor((canvas.width - 40) / Math.max(1, values.length)) - 10);
        labels.forEach((label, i) => {
            const x = 30 + i * (barWidth + 10);
            const h = Math.round((values[i] / max) * (canvas.height - 50));
            const y = canvas.height - 20 - h;
            ctx.fillStyle = '#2b6cb0';
            ctx.fillRect(x, y, barWidth, h);
            ctx.fillStyle = '#000';
            ctx.font = '12px sans-serif';
            ctx.fillText(String(values[i]), x + barWidth / 3, y - 4);
            ctx.save();
            ctx.translate(x, canvas.height - 5);
            ctx.rotate(-Math.PI / 4);
            ctx.fillText(label, 0, 0);
            ctx.restore();
        });
    }

    function renderRoomsTable(rooms) {
        const tbody = document.querySelector('#rooms-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        rooms.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input value="${r.name}" data-field="name"></td>
                <td>
                    <select data-field="type">
                        <option value="standard" ${r.type==='standard'?'selected':''}>standard</option>
                        <option value="deluxe" ${r.type==='deluxe'?'selected':''}>deluxe</option>
                        <option value="suite" ${r.type==='suite'?'selected':''}>suite</option>
                    </select>
                </td>
                <td><input type="number" value="${r.capacity}" data-field="capacity" style="width:80px;"></td>
                <td><input type="number" value="${r.pricePerNight}" data-field="pricePerNight" style="width:100px;"></td>
                <td>${r.needsCleaning ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn btn-secondary" data-action="save">Save</button>
                    <button class="btn btn-secondary" data-action="delete" style="margin-left:6px;">Delete</button>
                </td>
            `;
            // Wire actions
            tr.querySelector('[data-action="save"]').addEventListener('click', () => saveRoomRow(r._id, tr));
            tr.querySelector('[data-action="delete"]').addEventListener('click', () => deleteRoom(r._id));
            tbody.appendChild(tr);
        });
    }

    async function saveRoomRow(roomId, tr) {
        const token = localStorage.getItem('token');
        const payload = {};
        tr.querySelectorAll('input, select').forEach(el => {
            const field = el.getAttribute('data-field');
            if (field === 'capacity' || field === 'pricePerNight') {
                payload[field] = Number(el.value);
            } else {
                payload[field] = el.value;
            }
        });
        try {
            const res = await fetch(`${API_BASE}/api/rooms/${roomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                showMessage('Room saved.', 'success');
                loadAdminDashboard();
            } else {
                showMessage('Failed to save room.', 'error');
            }
        } catch {
            showMessage('Network error.', 'error');
        }
    }

    async function deleteRoom(roomId) {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_BASE}/api/rooms/${roomId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                showMessage('Room deleted.', 'success');
                loadAdminDashboard();
            } else {
                showMessage('Failed to delete room.', 'error');
            }
        } catch {
            showMessage('Network error.', 'error');
        }
    }
    async function createBooking(roomId, checkIn, checkOut, guests, contact, customers, selectedSubroom = '', idFiles = []) {
        const token = localStorage.getItem('token');
        
        // If not logged in, show login modal
        if (!token) {
            showMessage('Please login to make a booking.', 'error');
            showModal(loginModal);
            return { ok: false, message: 'Not authenticated' };
        }

        // Check if this is a temporary room (from HTML fallback)
        const isTemporaryRoom = roomId.startsWith('temp-');
        
        try {
            if (isTemporaryRoom) {
                // Handle temporary room (offline mode)
                console.log('Using temporary room data - backend not available');
                
                // Create a mock success response
                const mockBooking = {
                    _id: 'temp-booking-' + Date.now(),
                    roomId,
                    checkIn,
                    checkOut,
                    guests: parseInt(guests),
                    contact,
                    customers,
                    status: 'confirmed',
                    createdAt: new Date().toISOString(),
                    isTemporary: true
                };
                
                // Store in localStorage for offline access
                const userBookings = JSON.parse(localStorage.getItem('tempBookings') || '[]');
                userBookings.push(mockBooking);
                localStorage.setItem('tempBookings', JSON.stringify(userBookings));
                
                showMessage('Booking received! (Offline Mode)', 'success');
                hideModal(bookNowModal);
                return { 
                    ok: true, 
                    booking: mockBooking,
                    isTemporary: true,
                    message: 'Your booking has been received. Please note: This is an offline booking. Please check back later to confirm with the hotel.'
                };
            } else {
                // Handle real API call for non-temporary rooms
                const formData = new FormData();
                formData.append('roomId', roomId);
                formData.append('checkIn', checkIn);
                formData.append('checkOut', checkOut);
                formData.append('guests', String(guests));
                formData.append('contact', JSON.stringify(contact));
                formData.append('customers', JSON.stringify(customers));
                formData.append('selectedSubroom', selectedSubroom || '');
                idFiles.forEach((f, i) => formData.append('idProofs', f, f.name || `id_${i}.jpg`));

                const response = await fetch(`${API_BASE}/api/bookings`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (response.status === 401) {
                    localStorage.removeItem('token');
                    showMessage('Session expired. Please login again.', 'error');
                    showModal(loginModal);
                    return { ok: false, message: 'Unauthorized' };
                }

                const data = await response.json().catch(() => ({}));
                
                if (!response.ok) {
                    showMessage(data.message || 'Booking failed. Please try again.', 'error');
                    return { 
                        ok: false, 
                        message: data.message || 'Booking failed. Please try again.' 
                    };
                }

                // If we get here, booking was successful
                showMessage('Booking successful!', 'success');
                hideModal(bookNowModal);
                return { 
                    ok: true, 
                    booking: data,
                    isTemporary: false
                };
            }
        } catch (error) {
            console.error('Booking error:', error);
            
            let errorMessage = 'An unexpected error occurred. Please try again.';
            
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                errorMessage = 'Unable to connect to the booking service. ';
                if (isTemporaryRoom) {
                    errorMessage += 'Your booking has been saved offline.';
                } else {
                    errorMessage += 'Please try again later or check your internet connection.';
                }
            }
            
            showMessage(errorMessage, 'error');
            return { 
                ok: false, 
                message: errorMessage,
                error: error.message
            };
        }
    }

    // Cancel booking function
    const cancelBooking = async (bookingId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const res = await fetch(`${appState.API_BASE}/api/bookings/${bookingId}/cancel`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                localStorage.removeItem('token');
                showMessage('Session expired. Please login again.', 'error');
                if (typeof showModal === 'function') {
                    showModal(loginModal);
                }
                throw new Error('Unauthorized');
            }

            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.message || 'Failed to cancel booking');
            }

            const result = await res.json();
            showMessage('Booking cancelled successfully!', 'success');
            // Reload the page to reflect changes
            setTimeout(() => window.location.reload(), 1500);
            return result;
        } catch (error) {
            console.error('Error cancelling booking:', error);
            showMessage(error.message || 'Failed to cancel booking', 'error');
            throw error;
        }
    };

    // Expose cancelBooking to the global scope if needed
    window.cancelBooking = cancelBooking;

}); // Close the DOMContentLoaded event listener
