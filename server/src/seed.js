require('dotenv').config();
const { connectToDatabase } = require('./mongo');
const Room = require('./models/Room');
const User = require('./models/User');
const bcrypt = require('bcrypt');

(async () => {
  try {
    await connectToDatabase();
    
    // Ensure admin user exists
    const adminUsername = 'riteshsalve7536';
    const adminEmail = 'riteshsalve7536@email.com';
    const adminPassword = 'admin123';
    const existingAdmin = await User.findOne({ username: adminUsername });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await User.create({ fullname: 'Admin Ritesh', username: adminUsername, email: adminEmail, phone: '', passwordHash, isAdmin: true });
      console.log('Admin user created');
    } else if (!existingAdmin.isAdmin) {
      existingAdmin.isAdmin = true;
      await existingAdmin.save();
      console.log('Existing user promoted to admin');
    }

    await Room.deleteMany({});
    
    const rooms = [
        // Standard Rooms
        {
          name: 'Standard Queen Room',
          type: 'standard',
          capacity: 2,
          pricePerNight: 13200,
          images: ['./images/standard_room1.jpg'],
          amenities: ['WiFi', 'AC', '1 Queen Bed', 'TV'],
          description: 'Comfortable room with a Queen bed.'
        },
        {
          name: 'City View Twin',
          type: 'standard',
          capacity: 2,
          pricePerNight: 14520,
          images: ['./images/standard_room2.jpg'],
          amenities: ['WiFi', 'AC', '2 Twin Beds', 'City View'],
          description: 'Twin room with beautiful city views.'
        },
        {
          name: 'Classic King Room',
          type: 'standard',
          capacity: 2,
          pricePerNight: 15400,
          images: ['./images/standard_room3.jpg'],
          amenities: ['WiFi', 'AC', '1 King Bed', 'Work Desk'],
          description: 'Spacious room with a King bed.'
        },
        {
          name: 'Standard Double',
          type: 'standard',
          capacity: 4,
          pricePerNight: 15840,
          images: ['./images/standard_room4.jpg'],
          amenities: ['WiFi', 'AC', '2 Double Beds'],
          description: 'Perfect for small families or groups.'
        },
        {
          name: 'Compact Solo Room',
          type: 'standard',
          capacity: 1,
          pricePerNight: 11880,
          images: ['./images/standard_room5.jpg'],
          amenities: ['WiFi', 'AC', '1 Single Bed'],
          description: 'Ideal for solo travelers.'
        },

        // Deluxe Rooms
        {
          name: 'Deluxe King with Balcony',
          type: 'deluxe',
          capacity: 2,
          pricePerNight: 22000,
          images: ['./images/deluxe_room1.jpg'],
          amenities: ['WiFi', 'AC', 'Balcony', 'King Bed', 'Minibar'],
          description: 'Luxurious King room with private balcony.'
        },
        {
          name: 'Ocean View Deluxe',
          type: 'deluxe',
          capacity: 2,
          pricePerNight: 24200,
          images: ['./images/deluxe_room2.jpg'],
          amenities: ['WiFi', 'AC', 'Ocean View', 'King Bed', 'Bathtub'],
          description: 'Stunning ocean views and premium amenities.'
        },
        {
          name: 'Family Deluxe Room',
          type: 'deluxe',
          capacity: 4,
          pricePerNight: 26400,
          images: ['./images/deluxe_room3.jpg'],
          amenities: ['WiFi', 'AC', '2 Queen Beds', 'Seating Area'],
          description: 'Spacious room for families.'
        },
        {
          name: 'Deluxe Twin with View',
          type: 'deluxe',
          capacity: 2,
          pricePerNight: 22800,
          images: ['./images/deluxe_room4.jpg'],
          amenities: ['WiFi', 'AC', '2 Twin Beds', 'Scenic View'],
          description: 'Twin beds with great views.'
        },
        {
          name: 'Corner King Deluxe',
          type: 'deluxe',
          capacity: 2,
          pricePerNight: 25080,
          images: ['./images/deluxe_room5.jpg'],
          amenities: ['WiFi', 'AC', 'King Bed', 'Panoramic Windows'],
          description: 'Corner room with extra light and space.'
        },

        // Executive Suites
        {
          name: 'Presidential Suite',
          type: 'suite',
          capacity: 4,
          pricePerNight: 48400,
          images: ['./images/executive_room1.jpg'],
          amenities: ['WiFi', 'AC', 'Living Room', 'King Bed', 'Sofa Bed', 'Jacuzzi'],
          description: 'The ultimate luxury experience.'
        },
        {
          name: 'Terrace Suite',
          type: 'suite',
          capacity: 2,
          pricePerNight: 39600,
          images: ['./images/executive_room2.jpg'],
          amenities: ['WiFi', 'AC', 'Private Terrace', 'King Bed', 'Dining Area'],
          description: 'Suite with a large private terrace.'
        },
        {
          name: 'Panoramic Suite',
          type: 'suite',
          capacity: 2,
          pricePerNight: 42240,
          images: ['./images/executive_room3.jpg'],
          amenities: ['WiFi', 'AC', 'Panoramic Views', 'King Bed', 'Lounge Access'],
          description: 'Breathtaking views from every corner.'
        },
        {
          name: 'Junior Suite',
          type: 'suite',
          capacity: 3,
          pricePerNight: 33440,
          images: ['./images/executive_room4.jpg'],
          amenities: ['WiFi', 'AC', 'Sitting Area', 'King Bed'],
          description: 'Spacious suite with separate sitting area.'
        },
        {
          name: 'Executive Family Suite',
          type: 'suite',
          capacity: 5,
          pricePerNight: 45760,
          images: ['./images/executive_room5.jpg'],
          amenities: ['WiFi', 'AC', '2 King Beds', 'Kitchenette', 'Living Room'],
          description: 'Huge suite perfect for large families.'
        }
    ];

    await Room.insertMany(rooms);
    console.log(`Seeded ${rooms.length} rooms`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
