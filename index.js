const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User'); // User model
const Exercise = require('./models/Exercise'); // Exercise model
require('dotenv').config();

app.use(cors());

// FreeCodeCamp tests often send form data (urlencoded).
// Using extended: true is generally safer. Keep JSON body parser too.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/public', express.static(__dirname + '/public'));

// Root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// MongoDB connection
// Ensure process.env.MONGO_URI is correct in your .env file!
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connection successful'))
  .catch((err) => console.error('MongoDB connection error:', err.message)); // Log specific error message

// Test endpoint (optional, can be removed)
app.get('/api/hello', (req, res) => {
  res.json({ greeting: 'hello API' });
});

// --- API Endpoints ---

// 1. Create new user: POST /api/users
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;

    // Check if username is provided
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      // If user exists, return their info as per FCC test requirements
      return res.json({ username: existingUser.username, _id: existingUser._id });
    }

    const newUser = new User({ username });
    const savedUser = await newUser.save();
    res.json({ username: savedUser.username, _id: savedUser._id });
  } catch (err) {
    // Check for MongoDB duplicate key error (code 11000)
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error(err); // Log error details
    res.status(500).json({ error: 'User creation failed' });
  }
});

// 2. Get all users: GET /api/users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id'); // Select only username and _id fields
    res.json(users);
  } catch (err) {
    console.error(err); // Log error details
    res.status(500).json({ error: 'Failed to retrieve user list' });
  }
});

// 3. Add exercise: POST /api/users/:_id/exercises
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const userId = req.params._id;
    let { description, duration, date } = req.body;

    // Check if required fields are provided
    if (!description || !duration) {
      return res.status(400).json({ error: 'Description and duration are required' });
    }

    // Ensure duration is a number
    duration = Number(duration);
    if (isNaN(duration)) {
      return res.status(400).json({ error: 'Duration must be a number' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle date, use current date if not provided
    let exerciseDate;
    if (date) {
      exerciseDate = new Date(date);
      // Check for invalid date
      if (exerciseDate.toString() === 'Invalid Date') {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }
    } else {
      exerciseDate = new Date(); // Use current date if none provided
    }

    const newExercise = new Exercise({
      userId,
      description,
      duration,
      date: exerciseDate
    });

    const savedExercise = await newExercise.save();

    res.json({
      _id: user._id,
      username: user.username,
      date: savedExercise.date.toDateString(), // Use toDateString format
      duration: savedExercise.duration,
      description: savedExercise.description
    });

  } catch (err) {
    console.error(err); // Log error details
    res.status(500).json({ error: 'Exercise could not be added' });
  }
});

// 4. Get user exercise logs: GET /api/users/:_id/logs
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let dateFilter = {};
    if (from) {
      const fromDate = new Date(from);
      if (fromDate.toString() === 'Invalid Date') {
        return res.status(400).json({ error: 'Invalid "from" date format. Use YYYY-MM-DD' });
      }
      dateFilter.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (toDate.toString() === 'Invalid Date') {
        return res.status(400).json({ error: 'Invalid "to" date format. Use YYYY-MM-DD' });
      }
      dateFilter.$lte = toDate;
    }

    let filter = { userId };
    if (from || to) {
      filter.date = dateFilter;
    }

    // Build query, sort by date, and select required fields
    let query = Exercise.find(filter)
      .select('description duration date')
      .sort({ date: 1 }); // Sort by date in ascending order

    if (limit) {
      const parsedLimit = Number(limit);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        return res.status(400).json({ error: 'Limit must be a positive number' });
      }
      query = query.limit(parsedLimit);
    }

    const exercises = await query.exec();

    const log = exercises.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString() // Use toDateString format
    }));

    res.json({
      _id: user._id,
      username: user.username,
      count: exercises.length,
      log
    });

  } catch (err) {
    console.error(err); // Log error details
    res.status(500).json({ error: 'Could not retrieve logs' });
  }
});

// Start the server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Server is running on port ' + listener.address().port);
});