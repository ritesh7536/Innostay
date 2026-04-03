const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['standard', 'deluxe', 'suite'], required: true },
  capacity: { type: Number, required: true },
  pricePerNight: { type: Number, required: true },
  images: [String],
  amenities: [String],
  description: String,
  needsCleaning: { type: Boolean, default: false },
  lastCleanedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);


