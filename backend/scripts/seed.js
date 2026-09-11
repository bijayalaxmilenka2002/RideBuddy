'use strict';

/**
 * Fills a development database with demo commuters and open ride pools, so the
 * app has something to show on first run.
 *
 *   npm run seed
 *
 * Refuses to run against NODE_ENV=production: it deletes every user, ride and
 * message first so repeated runs stay idempotent.
 */
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const Ride = require('../src/models/Ride');
const Message = require('../src/models/Message');

const PASSWORD = 'ridebuddy123';

const PEOPLE = [
  { name: 'Asha Nair', email: 'asha@example.com', phone: '9800000001' },
  { name: 'Priya Rao', email: 'priya@example.com', phone: '9800000002' },
  { name: 'Sanjay Mehta', email: 'sanjay@example.com', phone: '9800000003' },
  { name: 'Arjun Kumar', email: 'arjun@example.com', phone: '9800000004' },
];

// Coordinates are GeoJSON order: [longitude, latitude].
const RIDES = [
  {
    admin: 0,
    riders: [1],
    vehicleType: 'CAB',
    pickup: { name: 'Andheri Station', coordinates: [72.8479, 19.1197] },
    drop: { name: 'BKC Tech Park', coordinates: [72.8677, 19.0662] },
    inMinutes: 45,
  },
  {
    admin: 1,
    riders: [],
    vehicleType: 'AUTO',
    pickup: { name: 'Hinjewadi Phase 1', coordinates: [73.7389, 18.5913] },
    drop: { name: 'Wakad Circle', coordinates: [73.7625, 18.5983] },
    inMinutes: 90,
  },
  {
    admin: 2,
    riders: [3],
    vehicleType: 'CAB',
    pickup: { name: 'Whitefield ITPL', coordinates: [77.7499, 12.9855] },
    drop: { name: 'Marathahalli', coordinates: [77.6974, 12.9569] },
    inMinutes: 120,
  },
  {
    admin: 3,
    riders: [],
    vehicleType: 'BIKE',
    pickup: { name: 'Koramangala 5th Block', coordinates: [77.6245, 12.9352] },
    drop: { name: 'Indiranagar Metro', coordinates: [77.6408, 12.9784] },
    inMinutes: 30,
  },
];

async function seed() {
  if (env.nodeEnv === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  await mongoose.connect(env.mongoUri);
  console.log(`Connected to ${mongoose.connection.name}`);

  await Promise.all([User.deleteMany({}), Ride.deleteMany({}), Message.deleteMany({})]);
  console.log('Cleared existing users, rides and messages');

  // create() runs the pre-save hook, so passwords are hashed like any signup.
  const users = await User.create(PEOPLE.map((person) => ({ ...person, password: PASSWORD })));
  console.log(`Created ${users.length} users`);

  const rides = await Ride.create(
    RIDES.map((ride) => ({
      admin: users[ride.admin]._id,
      // The admin always occupies the first seat.
      members: [users[ride.admin]._id, ...ride.riders.map((i) => users[i]._id)],
      vehicleType: ride.vehicleType,
      pickupLocation: { ...ride.pickup, type: 'Point' },
      dropLocation: { ...ride.drop, type: 'Point' },
      departureTime: new Date(Date.now() + ride.inMinutes * 60_000),
    }))
  );
  console.log(`Created ${rides.length} ride pools`);

  await Message.create([
    {
      rideId: rides[0]._id,
      sender: users[0]._id,
      senderName: users[0].name,
      message: 'I will be at the east gate, near the ticket counter.',
    },
    {
      rideId: rides[0]._id,
      sender: users[1]._id,
      senderName: users[1].name,
      message: 'Got it — I am two minutes away.',
    },
  ]);

  console.log('\nDone. Log in with any of these:');
  PEOPLE.forEach((person) => console.log(`  ${person.email}  /  ${PASSWORD}`));

  await mongoose.connection.close();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
