import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'path';
import fs from 'fs';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { seed } from '../seed.js';

let mongodInstance = null;

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vschool';
  console.log(`⏳ Connecting to MongoDB at ${mongoURI}...`);

  let connected = false;

  // 1. Try connecting to configured MongoDB (e.g., local daemon or Atlas)
  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    connected = true;
  } catch (err) {
    console.log(`ℹ️  No external MongoDB detected (${err.message}).`);
  }

  // 2. If connection failed, spin up embedded MongoDB with persistence
  if (!connected) {
    console.log('⚡ Starting embedded MongoDB engine with local persistence...');
    const dbPath = path.resolve(process.cwd(), '.mongo-data');
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    try {
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
    } catch {
      // If port 27017 is already in use or restricted, let MongoMemoryServer choose a free port
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
    }

    const uri =
      mongodInstance.getUri() + (mongodInstance.getUri().endsWith('/') ? 'vschool' : '/vschool');
    const conn = await mongoose.connect(uri);
    console.log(`✅ Embedded MongoDB connected: ${conn.connection.host} (${uri})`);
  }

  // 3. Bring indexes in line with the schema (e.g. partial double-booking indexes)
  try {
    await Appointment.syncIndexes();
  } catch (indexErr) {
    console.error('⚠️  Index sync error:', indexErr.message);
  }

  // 4. Auto-seed if database is empty
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Database is empty. Running initial auto-seed...');
      await seed();
      console.log('✅ Initial database seed completed!');
    }
  } catch (seedErr) {
    console.error('⚠️  Auto-seed error:', seedErr.message);
  }
};

const cleanup = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongodInstance) {
      await mongodInstance.stop();
    }
  } catch {
    // Ignore shutdown errors
  }
};

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

export default connectDB;
