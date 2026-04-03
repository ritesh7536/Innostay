const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const fs = require('fs');
const crypto = require('crypto');

// Configure multer storage for ID proofs
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
// Ensure uploads directory exists to avoid ENOENT on write
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `id-${unique}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', requireAuth, upload.array('idProofs'), async (req, res) => {
  let { roomId, checkIn, checkOut, guests, contact, customers, selectedSubroom, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  try { if (typeof contact === 'string') contact = JSON.parse(contact); } catch {}
  try { if (typeof customers === 'string') customers = JSON.parse(customers); } catch {}
  
  // Validate roomId
  if (!roomId || roomId.trim() === '') {
    return res.status(400).json({ message: 'Room ID is required' });
  }
  
  // Validate ObjectId format
  if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: 'Invalid Room ID format' });
  }
  
  const room = await Room.findById(roomId);
  if (!room) return res.status(400).json({ message: 'Invalid room' });

  // Payment Verification
  let paymentStatus = 'pending';
  let paymentId = null;
  let orderId = null;

  if (razorpay_payment_id) {
    try {
      const sign = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSign = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
          .update(sign.toString())
          .digest("hex");

      if (razorpay_signature === expectedSign) {
          paymentStatus = 'paid';
          paymentId = razorpay_payment_id;
          orderId = razorpay_order_id;
      } else {
          return res.status(400).json({ message: "Payment verification failed: Invalid signature" });
      }
    } catch (error) {
       console.error("Payment verification error:", error);
       return res.status(400).json({ message: "Payment verification failed" });
    }
  }

  const nights = Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)));
  const totalPrice = nights * room.pricePerNight;

  const idProofPaths = (req.files || []).map(f => `/uploads/${path.basename(f.path)}`);

  const booking = await Booking.create({
    userId: req.user.id, roomId, checkIn, checkOut, guests, totalPrice, contact, customers, selectedSubroom, idProofPaths,
    paymentStatus, paymentId, orderId
  });

  // Send receipt email in background (best-effort)
  try {
    await sendReceiptEmail(booking);
  } catch (e) {
    // ignore failures for email
  }

  res.status(201).json({ booking });
});

router.get('/me', requireAuth, async (req, res) => {
  const bookings = await Booking.find({ userId: req.user.id }).populate('roomId', 'name type pricePerNight');
  res.json({ bookings });
});

// Cancel a booking (DELETE from database)
router.delete('/:id/cancel', requireAuth, async (req, res) => {
  console.log('=== BOOKING DELETION REQUEST ===');
  console.log('Booking ID:', req.params.id);
  console.log('User ID:', req.user.id);
  
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    console.log('Booking not found');
    return res.status(404).json({ message: 'Booking not found' });
  }
  
  console.log('Found booking:', {
    id: booking._id,
    userId: booking.userId,
    status: booking.status,
    roomId: booking.roomId
  });
  
  if (String(booking.userId) !== String(req.user.id)) {
    console.log('Access denied - user mismatch');
    return res.status(403).json({ message: 'Access denied' });
  }
  
  console.log('Deleting booking from database...');
  const deletedBooking = await Booking.findByIdAndDelete(req.params.id);
  
  if (!deletedBooking) {
    console.log('Failed to delete booking');
    return res.status(500).json({ message: 'Failed to delete booking' });
  }
  
  console.log('Booking deleted successfully:', {
    id: deletedBooking._id,
    wasDeleted: true
  });
  
  res.json({ message: 'Booking cancelled and deleted successfully', deletedBooking });
});

// Clear all cancelled bookings
router.delete('/admin/clear-cancelled', requireAuth, requireAdmin, async (req, res) => {
  console.log('=== CLEARING ALL CANCELLED BOOKINGS ===');
  
  try {
    const result = await Booking.deleteMany({ status: 'cancelled' });
    console.log('Deleted cancelled bookings:', result.deletedCount);
    
    res.json({ 
      message: `Cleared ${result.deletedCount} cancelled bookings`, 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error clearing cancelled bookings:', error);
    res.status(500).json({ message: 'Failed to clear cancelled bookings' });
  }
});

// When a booking is "checked out" (simple mark), auto-flag room for cleaning
router.post('/:id/checkout', requireAuth, async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Not found' });
  // Only booking owner or admin can mark
  if (String(booking.userId) !== String(req.user.id) && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  
  // Update booking status to checked_out
  booking.status = 'checked_out';
  await booking.save();
  
  const room = await Room.findByIdAndUpdate(booking.roomId, { needsCleaning: true }, { new: true });
  res.json({ ok: true, room, booking });
});

// Admin stats with optional date filters
router.get('/admin/stats', requireAuth, requireAdmin, async (req, res) => {
  const { from, to } = req.query; // ISO dates
  const match = {};
  if (from) match.checkIn = { ...(match.checkIn || {}), $gte: new Date(from) };
  if (to) match.checkOut = { ...(match.checkOut || {}), $lte: new Date(to) };

  const totalBookings = await Booking.countDocuments(match);
  const byRoom = await Booking.aggregate([
    { $match: match },
    { $group: { _id: '$roomId', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.json({ totalBookings, byRoom });
});

async function sendReceiptEmail(booking) {
  const email = booking.contact?.email;
  if (!email) return;
  const b = await Booking.findById(booking._id).populate('roomId', 'name type');
  const pdf = await generateReceiptBuffer(b);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@innostay.local',
    to: email,
    subject: 'Your InnoStay Booking Receipt',
    text: `Thank you for your booking. Booking ID: ${booking._id}`,
    attachments: [{ filename: `booking-${booking._id}.pdf`, content: pdf }]
  });
}


// Admin summary endpoints
router.get('/admin/summary', requireAuth, requireAdmin, async (_req, res) => {
  const [totalRooms, totalBookings, roomsNeedingCleaning] = await Promise.all([
    Room.countDocuments({}),
    Booking.countDocuments({}),
    Room.countDocuments({ needsCleaning: true })
  ]);

  // Rough occupancy: bookings with checkOut >= today and not cancelled/checked_out
  const today = new Date();
  const activeBookings = await Booking.countDocuments({ 
    checkOut: { $gte: today },
    status: { $nin: ['cancelled', 'checked_out'] }
  });

  res.json({
    totalRooms,
    totalBookings,
    activeBookings,
    roomsNeedingCleaning
  });
});

// Get all bookings for admin with customer details
router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('roomId', 'name type pricePerNight')
      .populate('userId', 'fullname username email phone')
      .sort({ createdAt: -1 });
    
    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

// Generate PDF receipt for a booking
router.get('/:id/receipt', requireAuth, async (req, res) => {
  // Check if it's a temporary booking ID
  if (req.params.id.startsWith('temp-booking-')) {
    return res.status(200).json({ 
      isTemporary: true,
      message: 'This is a temporary booking. Receipt will be generated after confirmation.'
    });
  }

  // Handle regular MongoDB ObjectId
  const booking = await Booking.findById(req.params.id).populate('roomId', 'name type pricePerNight');
  if (!booking) return res.status(404).json({ message: 'Not found' });
  if (String(booking.userId) !== String(req.user.id) && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=booking-${booking._id}.pdf`);
  const doc = new PDFDocument();
  doc.pipe(res);
  doc.fontSize(20).text('InnoStay - Booking Receipt', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Booking ID: ${booking._id}`);
  doc.text(`Room: ${booking.roomId?.name} ${booking.selectedSubroom ? `(${booking.selectedSubroom})` : ''}`);
  doc.text(`Check-in: ${new Date(booking.checkIn).toDateString()}`);
  doc.text(`Check-out: ${new Date(booking.checkOut).toDateString()}`);
  doc.text(`Guests: ${booking.guests}`);
  doc.text(`Total Price: ₹${booking.totalPrice}`);
  if (booking.contact) {
    doc.moveDown().text('Contact Details:');
    doc.text(`Name: ${booking.contact.fullName || ''}`);
    doc.text(`Email: ${booking.contact.email || ''}`);
    doc.text(`Phone: ${booking.contact.phone || ''}`);
  }
  if (booking.customers && booking.customers.length) {
    doc.moveDown().text('Customers:');
    booking.customers.forEach((c, i) => {
      doc.text(`${i + 1}. ${c.name || ''} (${c.age || ''}) ${c.relation ? '- ' + c.relation : ''}`);
    });
  }
  doc.end();
});

// Get a single booking by ID (JSON)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    // Prevent catching "admin" or other paths if they somehow fall through
    if (req.params.id === 'admin' || req.params.id === 'me') {
      return res.status(404).json({ message: 'Not found' });
    }

    const booking = await Booking.findById(req.params.id).populate('roomId', 'name type pricePerNight');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Authorization check
    if (String(booking.userId) !== String(req.user.id) && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Error fetching booking:', error);
    // Handle invalid ObjectId cast error
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }
    res.status(500).json({ message: 'Error fetching booking details' });
  }
});

async function generateReceiptBuffer(booking) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.fontSize(20).text('InnoStay - Booking Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Booking ID: ${booking._id}`);
    doc.text(`Room: ${booking.roomId?.name || ''} ${booking.selectedSubroom ? `(${booking.selectedSubroom})` : ''}`);
    doc.text(`Check-in: ${new Date(booking.checkIn).toDateString()}`);
    doc.text(`Check-out: ${new Date(booking.checkOut).toDateString()}`);
    doc.text(`Guests: ${booking.guests}`);
    doc.text(`Total Price: ₹${booking.totalPrice}`);
    if (booking.contact) {
      doc.moveDown().text('Contact Details:');
      doc.text(`Name: ${booking.contact.fullName || ''}`);
      doc.text(`Email: ${booking.contact.email || ''}`);
      doc.text(`Phone: ${booking.contact.phone || ''}`);
    }
    if (booking.customers && booking.customers.length) {
      doc.moveDown().text('Customers:');
      booking.customers.forEach((c, i) => {
        doc.text(`${i + 1}. ${c.name || ''} (${c.age || ''}) ${c.relation ? '- ' + c.relation : ''}`);
      });
    }
    doc.end();
  });
}

module.exports = router;


