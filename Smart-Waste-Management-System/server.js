
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// ===============================
// MongoDB Connection
// ===============================

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI is missing from the .env file.');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB Atlas');
    })
    .catch((err) => {
        console.error('❌ MongoDB Connection Error:', err.message);
    });

// ===============================
// User Schema
// ===============================

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);

// ===============================
// Signup Route
// ===============================

app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(400).json({
                error: 'Username already exists'
            });
        }

        const newUser = new User({
            username,
            password
        });

        await newUser.save();

        return res.status(201).json({
            message: 'User created successfully'
        });

    } catch (err) {
        console.error('Signup Error:', err.message);

        if (err.code === 11000) {
            return res.status(400).json({
                error: 'Username already exists'
            });
        }

        return res.status(500).json({
            error: 'Server error during signup'
        });
    }
});

// ===============================
// Login Route
// ===============================

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        // Admin login
        if (username === 'admin' && password === 'admin@123') {
            return res.json({
                role: 'admin',
                username: 'Administrator'
            });
        }

        // Regular user login
        const user = await User.findOne({
            username,
            password
        });

        if (!user) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        return res.json({
            role: user.role || 'user',
            username: user.username
        });

    } catch (err) {
        console.error('Login Error:', err.message);

        return res.status(500).json({
            error: 'Server error during login'
        });
    }
});

// ===============================
// Frontend Route
// ===============================

app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===============================
// Start Server
// ===============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
