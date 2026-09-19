import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } = require('mongodb');

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Debug logger
app.use((req, res, next) => {
  console.log(`[VERCEL API] ${req.method} ${req.url} (path: ${req.path})`);
  next();
});

// MongoDB connection caching for Vercel Serverless
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://irfanmohamed1182005_db_user:Irfan1123@polling.e6halcl.mongodb.net/?appName=Polling";
const MONGO_DB = process.env.MONGO_DB || "livepolling";
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-hcl-guvi-2026";

let cachedClient = null;
let cachedDb = null;
let clientPromise = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }
  if (!clientPromise) {
    const client = new MongoClient(MONGO_URI, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  const db = client.db(MONGO_DB);
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

// Authentication Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Helper to generate 6-character random uppercase share code
function generateShareCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to format Poll objects with full field compatibility
function formatPoll(poll) {
  if (!poll) return null;
  const options = (poll.options || []).map(opt => {
    const vCount = opt.votesCount !== undefined ? opt.votesCount : (opt.votes || 0);
    return {
      id: opt.id,
      text: opt.text,
      votes: vCount,
      votesCount: vCount
    };
  });
  const totalVotes = options.reduce((sum, o) => sum + o.votesCount, 0);
  const status = poll.status || (poll.is_active !== false && poll.isActive !== false ? 'active' : 'closed');
  const pollIdStr = poll._id ? poll._id.toString() : (poll.id || poll.pollId);
  return {
    id: pollIdStr,
    pollId: pollIdStr,
    question: poll.question,
    options: options,
    shareCode: poll.share_code || poll.shareCode,
    status: status,
    isActive: status === 'active',
    totalVotes: totalVotes,
    createdAt: poll.created_at || poll.createdAt
  };
}

// ---------------- ROUTES (Flexible path matching) ----------------

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', message: 'Pollify Vercel Serverless Backend operational' });
});

// Auth: Signup
app.post(['/api/auth/signup', '/auth/signup', '/signup'], async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Invalid input fields. Password must be at least 6 characters.' });
    }

    const { db } = await connectToDatabase();
    const usersCol = db.collection('users');

    const existing = await usersCol.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      name,
      email: email.toLowerCase(),
      password_hash: hashedPassword,
      created_at: new Date()
    };

    const result = await usersCol.insertOne(newUser);
    const userId = result.insertedId.toString();

    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: userId,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.created_at
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    next(err);
  }
});

// Auth: Login
app.post(['/api/auth/login', '/auth/login', '/login'], async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password' });
    }

    const { db } = await connectToDatabase();
    const usersCol = db.collection('users');

    const user = await usersCol.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userId = user._id.toString();
    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    next(err);
  }
});

// Auth: Get Me
app.get(['/api/auth/me', '/auth/me', '/me'], authMiddleware, async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.created_at
    });
  } catch (err) {
    next(err);
  }
});

// Auth: Reset Password
app.post(['/api/auth/reset-password', '/auth/reset-password', '/reset-password'], async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Email and new password (min 6 chars) required' });
    }

    const { db } = await connectToDatabase();
    const usersCol = db.collection('users');

    const user = await usersCol.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'Registered email address not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await usersCol.updateOne({ email: email.toLowerCase() }, { $set: { password_hash: hashedPassword } });

    res.json({ message: 'Password updated successfully in database' });
  } catch (err) {
    next(err);
  }
});

// Polls: Create Poll
app.post(['/api/polls', '/polls'], authMiddleware, async (req, res, next) => {
  try {
    const { question, options } = req.body;
    if (!question || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options are required' });
    }

    const formattedOptions = options.map((opt, idx) => ({
      id: 'opt_' + (idx + 1),
      text: typeof opt === 'string' ? opt : opt.text,
      votes: 0
    }));

    const { db } = await connectToDatabase();
    const pollsCol = db.collection('polls');

    let shareCode = generateShareCode();
    while (await pollsCol.findOne({ share_code: shareCode })) {
      shareCode = generateShareCode();
    }

    const newPoll = {
      user_id: new ObjectId(req.userId),
      question,
      options: formattedOptions,
      share_code: shareCode,
      is_active: true,
      created_at: new Date()
    };

    const result = await pollsCol.insertOne(newPoll);
    res.status(201).json(formatPoll({
      _id: result.insertedId,
      ...newPoll
    }));
  } catch (err) {
    console.error('Create poll error:', err);
    next(err);
  }
});

// Polls: Get User Polls
app.get(['/api/polls', '/polls'], authMiddleware, async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    const polls = await db.collection('polls')
      .find({ user_id: new ObjectId(req.userId) })
      .sort({ created_at: -1 })
      .toArray();

    res.json(polls.map(p => formatPoll(p)));
  } catch (err) {
    next(err);
  }
});

// Polls: Get Poll By Share Code
app.get(['/api/polls/share/:shareCode', '/polls/share/:shareCode'], async (req, res, next) => {
  try {
    const { shareCode } = req.params;
    const { db } = await connectToDatabase();
    const poll = await db.collection('polls').findOne({ share_code: shareCode.toUpperCase() });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    res.json(formatPoll(poll));
  } catch (err) {
    next(err);
  }
});

// Polls: Get Poll By ID or Share Code
app.get(['/api/polls/:id', '/polls/:id'], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { db } = await connectToDatabase();
    const pollsCol = db.collection('polls');
    let poll = null;
    if (ObjectId.isValid(id) && id.length === 24) {
      poll = await pollsCol.findOne({ _id: new ObjectId(id) });
    }
    if (!poll) {
      poll = await pollsCol.findOne({ share_code: id.toUpperCase() });
    }
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    res.json(formatPoll(poll));
  } catch (err) {
    next(err);
  }
});

// Polls: Delete Poll
app.delete(['/api/polls/:id', '/polls/:id'], authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { db } = await connectToDatabase();
    const result = await db.collection('polls').deleteOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(req.userId)
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Poll not found or not authorized' });
    }
    res.json({ message: 'Poll deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Polls: Toggle Status (Freeze/Unfreeze)
app.patch(['/api/polls/:id/status', '/polls/:id/status'], authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const isActive = status === 'active';

    const { db } = await connectToDatabase();
    const result = await db.collection('polls').updateOne(
      { _id: new ObjectId(id), user_id: new ObjectId(req.userId) },
      { $set: { is_active: isActive, status: status } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Poll not found or not authorized' });
    }

    res.json({ message: `Poll status updated to ${status}` });
  } catch (err) {
    next(err);
  }
});

// Voting: Cast Vote
app.post(['/api/polls/:id/vote', '/polls/:id/vote'], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { optionId } = req.body;
    const voterToken = req.headers['x-voter-token'];

    if (!optionId || !voterToken) {
      return res.status(400).json({ error: 'Option ID and Voter Token are required' });
    }

    const { db } = await connectToDatabase();
    const pollsCol = db.collection('polls');
    const votesCol = db.collection('votes');

    let poll = null;
    if (ObjectId.isValid(id) && id.length === 24) {
      poll = await pollsCol.findOne({ _id: new ObjectId(id) });
    }
    if (!poll) {
      poll = await pollsCol.findOne({ share_code: id.toUpperCase() });
    }

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (!poll.is_active) {
      return res.status(403).json({ error: 'This poll has been frozen by the host and is no longer accepting votes' });
    }

    // Check if voter already voted
    const existingVote = await votesCol.findOne({
      poll_id: poll._id,
      voter_token: voterToken
    });

    if (existingVote) {
      return res.status(400).json({ error: 'You have already voted in this poll' });
    }

    // Record vote
    await votesCol.insertOne({
      poll_id: poll._id,
      voter_token: voterToken,
      option_id: optionId,
      created_at: new Date()
    });

    // Update poll options count
    await pollsCol.updateOne(
      { _id: poll._id, "options.id": optionId },
      { $inc: { "options.$.votes": 1 } }
    );

    // Fetch updated poll
    const updatedPoll = await pollsCol.findOne({ _id: poll._id });

    res.json({
      message: 'Vote recorded successfully',
      poll: formatPoll(updatedPoll)
    });
  } catch (err) {
    console.error('Vote error:', err);
    next(err);
  }
});

// Voting: Get Results
app.get(['/api/polls/:id/results', '/polls/:id/results'], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { db } = await connectToDatabase();
    const pollsCol = db.collection('polls');
    let poll = null;
    if (ObjectId.isValid(id) && id.length === 24) {
      poll = await pollsCol.findOne({ _id: new ObjectId(id) });
    }
    if (!poll) {
      poll = await pollsCol.findOne({ share_code: id.toUpperCase() });
    }

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    res.json(formatPoll(poll));
  } catch (err) {
    next(err);
  }
});

// Global Express Error Middleware
app.use((err, req, res, next) => {
  console.error('[VERCEL API ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Export Express App for Vercel Serverless ES Module Runtime
export default function handler(req, res) {
  return app(req, res);
}
