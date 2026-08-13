const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Middlewares
app.use(cors());
app.use(express.json());

// Load static frontend files from ../frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Helper functions for reading/writing persistent database file
function readDatabase() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            // Create folder and empty file if doesn't exist
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            fs.writeFileSync(DB_PATH, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('Error reading JSON DB:', err);
        return [];
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Error writing JSON DB:', err);
    }
}

// Generate last 7 days weight log for mock profiles
function generateMockWeightHistory(baseWeight) {
    const history = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const fluctuation = (Math.sin(i) * 0.8) + (Math.random() * 0.4 - 0.2);
        history.push({
            date: d.toISOString().split('T')[0],
            weight: parseFloat((baseWeight + fluctuation).toFixed(1))
        });
    }
    return history;
}


// ==================== AUTHENTICATION API ROUTES ====================

// REGISTER ENDPOINT
app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All registration parameters are required.' });
    }

    const users = readDatabase();
    const emailExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (emailExists) {
        return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const newUser = {
        name,
        email: email.toLowerCase(),
        password,
        profiles: [
            {
                name: 'Self',
                age: 25,
                height: 170,
                weight: 70,
                gender: 'Male',
                weightHistory: generateMockWeightHistory(70)
            }
        ]
    };

    users.push(newUser);
    writeDatabase(users);

    res.status(201).json({
        email: newUser.email,
        name: newUser.name,
        profiles: newUser.profiles
    });
});

// LOGIN ENDPOINT
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    const users = readDatabase();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user || user.password !== password) {
        return res.status(400).json({ message: 'Invalid credentials. Check your email or password.' });
    }

    res.status(200).json({
        email: user.email,
        name: user.name,
        profiles: user.profiles
    });
});

// GOOGLE AUTHENTICATION SIMULATOR ENDPOINT
app.post('/api/auth/google', (req, res) => {
    const { email, name } = req.body;

    if (!email || !name) {
        return res.status(400).json({ message: 'Invalid oauth response payload.' });
    }

    const users = readDatabase();
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        user = {
            name: name,
            email: email.toLowerCase(),
            password: '', // oauth sign-in
            profiles: [
                {
                    name: 'Google Account',
                    age: 28,
                    height: 180,
                    weight: 78,
                    gender: 'Male',
                    weightHistory: generateMockWeightHistory(78)
                }
            ]
        };
        users.push(user);
        writeDatabase(users);
    }

    res.status(200).json({
        email: user.email,
        name: user.name,
        profiles: user.profiles
    });
});


// ==================== USER PROFILE API ROUTES ====================

// MIDDLEWARE to get user and validate active sessions
function fetchUserMiddleware(req, res, next) {
    const emailHeader = req.headers['x-user-email'];
    if (!emailHeader) {
        return res.status(401).json({ message: 'Unauthorized. x-user-email header missing.' });
    }

    const users = readDatabase();
    const user = users.find(u => u.email.toLowerCase() === emailHeader.toLowerCase());

    if (!user) {
        return res.status(404).json({ message: 'User account session not found.' });
    }

    req.usersList = users;
    req.currentUser = user;
    next();
}

// GET ALL PROFILES
app.get('/api/profiles', fetchUserMiddleware, (req, res) => {
    res.status(200).json({ profiles: req.currentUser.profiles });
});

// CREATE NEW PROFILE
app.post('/api/profiles', fetchUserMiddleware, (req, res) => {
    const { name, age, height, weight, gender } = req.body;

    if (!name || !age || !height || !weight || !gender) {
        return res.status(400).json({ message: 'Profile details fields are required.' });
    }

    const newProfile = {
        name,
        age: parseInt(age),
        height: parseFloat(height),
        weight: parseFloat(weight),
        gender,
        weightHistory: generateMockWeightHistory(parseFloat(weight))
    };

    req.currentUser.profiles.push(newProfile);
    writeDatabase(req.usersList);

    res.status(201).json({ profiles: req.currentUser.profiles });
});

// UPDATE PROFILE METRICS
app.put('/api/profiles/:profileIndex', fetchUserMiddleware, (req, res) => {
    const profileIndex = parseInt(req.params.profileIndex);
    const { height, weight, gender } = req.body;

    if (profileIndex < 0 || profileIndex >= req.currentUser.profiles.length) {
        return res.status(404).json({ message: 'Profile index out of bounds.' });
    }

    const profile = req.currentUser.profiles[profileIndex];
    if (height) profile.height = parseFloat(height);
    if (weight) profile.weight = parseFloat(weight);
    if (gender) profile.gender = gender;

    // Log today's weight changes
    if (weight) {
        const todayStr = new Date().toISOString().split('T')[0];
        const existingIndex = profile.weightHistory.findIndex(h => h.date === todayStr);

        if (existingIndex !== -1) {
            profile.weightHistory[existingIndex].weight = parseFloat(weight);
        } else {
            profile.weightHistory.push({
                date: todayStr,
                weight: parseFloat(weight)
            });
        }
    }

    writeDatabase(req.usersList);
    res.status(200).json({ profiles: req.currentUser.profiles });
});

// DELETE SUB-PROFILE
app.delete('/api/profiles/:profileIndex', fetchUserMiddleware, (req, res) => {
    const profileIndex = parseInt(req.params.profileIndex);

    if (profileIndex < 0 || profileIndex >= req.currentUser.profiles.length) {
        return res.status(404).json({ message: 'Profile index out of bounds.' });
    }

    if (req.currentUser.profiles.length <= 1) {
        return res.status(400).json({ message: 'Cannot delete the only profile remaining.' });
    }

    req.currentUser.profiles.splice(profileIndex, 1);
    writeDatabase(req.usersList);

    res.status(200).json({ profiles: req.currentUser.profiles });
});

// ADD WEIGHT HISTORICAL ENTRY
app.post('/api/profiles/:profileIndex/logs', fetchUserMiddleware, (req, res) => {
    const profileIndex = parseInt(req.params.profileIndex);
    const { weight, date } = req.body;

    if (profileIndex < 0 || profileIndex >= req.currentUser.profiles.length) {
        return res.status(404).json({ message: 'Profile index out of bounds.' });
    }

    if (!weight || !date) {
        return res.status(400).json({ message: 'Weight and date parameters are required.' });
    }

    const profile = req.currentUser.profiles[profileIndex];
    const existingIndex = profile.weightHistory.findIndex(h => h.date === date);

    if (existingIndex !== -1) {
        profile.weightHistory[existingIndex].weight = parseFloat(weight);
    } else {
        profile.weightHistory.push({
            date,
            weight: parseFloat(weight)
        });
    }

    writeDatabase(req.usersList);
    res.status(200).json({ profiles: req.currentUser.profiles });
});

// DELETE WEIGHT HISTORICAL LOG ENTRY
app.delete('/api/profiles/:profileIndex/logs/:logDate', fetchUserMiddleware, (req, res) => {
    const profileIndex = parseInt(req.params.profileIndex);
    const logDate = req.params.logDate;

    if (profileIndex < 0 || profileIndex >= req.currentUser.profiles.length) {
        return res.status(404).json({ message: 'Profile index out of bounds.' });
    }

    const profile = req.currentUser.profiles[profileIndex];
    profile.weightHistory = profile.weightHistory.filter(h => h.date !== logDate);

    writeDatabase(req.usersList);
    res.status(200).json({ profiles: req.currentUser.profiles });
});


// Serve index.html as fallback for front-end routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Start Server Listen
app.listen(PORT, () => {
    console.log(`Node Express Server successfully started on port ${PORT}`);
});
