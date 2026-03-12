const express = require('express');
const app = express();

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'UP' });
});

// Mount existing routes
// const existingRoutes = require('./routes');
// app.use('/api', existingRoutes);

// Listen on the specified port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});