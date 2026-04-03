const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  roomId: { type: mongoose.Types.ObjectId, ref: 'Room', required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['confirmed', 'cancelled', 'checked_out'], default: 'confirmed' },
  contact: {
    fullName: String,
    email: String,
    phone: String
  },
  customers: [
    {
      name: String,
      age: Number,
      relation: String
    }
  ],
  idProofPaths: [String],
  selectedSubroom: String,
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  paymentId: String,
  orderId: String
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);


