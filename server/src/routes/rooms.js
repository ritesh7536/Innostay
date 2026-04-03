const router = require('express').Router();
const Room = require('../models/Room');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', async (_req, res) => {
  const rooms = await Room.find().select('name type capacity pricePerNight images amenities needsCleaning lastCleanedAt');
  res.json({ rooms });
});

router.get('/:id', async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ message: 'Not found' });
  res.json({ room });
});

module.exports = router;

// Admin-like simple creation endpoint (auth required)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, type, capacity, pricePerNight, images = [], amenities = [], description = '' } = req.body;
    if (!name || !type || !capacity || !pricePerNight) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const room = await Room.create({ name, type, capacity, pricePerNight, images, amenities, description });
    res.status(201).json({ room });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle/mark cleaning status
router.patch('/:id/cleaning', requireAuth, requireAdmin, async (req, res) => {
  const { needsCleaning } = req.body;
  const update = { needsCleaning: !!needsCleaning };
  if (!needsCleaning) update.lastCleanedAt = new Date();
  const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!room) return res.status(404).json({ message: 'Not found' });
  res.json({ room });
});

// Update room
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, type, capacity, pricePerNight, images, amenities, description } = req.body;
  const room = await Room.findByIdAndUpdate(
    req.params.id,
    { name, type, capacity, pricePerNight, images, amenities, description },
    { new: true }
  );
  if (!room) return res.status(404).json({ message: 'Not found' });
  res.json({ room });
});

// Delete room
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await Room.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});


