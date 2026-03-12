const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();

// Configuration
const PORT = process.env.PORT || 5000;
const DATABASE_URL = process.env.DATABASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

// Example of modular routes
app.use('/api/auth', require('./routes/auth')); // Auth routes

// Connect to the database (You can use mongoose or any other library)
// mongoose.connect(DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
//     .then(() => console.log('Database connected'))
//     .catch(err => console.error('Database connection error:', err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
