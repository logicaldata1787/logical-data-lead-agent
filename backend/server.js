const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// PostgreSQL client setup
const client = new Client({
    user: 'your_user',
    host: 'localhost',
    database: 'your_database',
    password: 'your_password',
    port: 5432,
});

client.connect()
    .then(() => console.log('PostgreSQL connected'))
    .catch(err => console.error('Connection error', err.stack));

// Lead routes
app.get('/api/leads', async (req, res) => {
    const result = await client.query('SELECT * FROM leads');
    res.json(result.rows);
});

app.post('/api/leads', async (req, res) => {
    const { name, email } = req.body;
    await client.query('INSERT INTO leads(name, email) VALUES($1, $2)', [name, email]);
    res.status(201).send('Lead created');
});

// Campaign routes
app.get('/api/campaigns', async (req, res) => {
    const result = await client.query('SELECT * FROM campaigns');
    res.json(result.rows);
});

app.post('/api/campaigns', async (req, res) => {
    const { title, budget } = req.body;
    await client.query('INSERT INTO campaigns(title, budget) VALUES($1, $2)', [title, budget]);
    res.status(201).send('Campaign created');
});

// Call routes
app.get('/api/calls', async (req, res) => {
    const result = await client.query('SELECT * FROM calls');
    res.json(result.rows);
});

app.post('/api/calls', async (req, res) => {
    const { leadId, duration } = req.body;
    await client.query('INSERT INTO calls(lead_id, duration) VALUES($1, $2)', [leadId, duration]);
    res.status(201).send('Call logged');
});

// Analytics routes
app.get('/api/analytics', async (req, res) => {
    const result = await client.query('SELECT * FROM analytics');
    res.json(result.rows);
});

// Integration routes
app.post('/api/integrations', async (req, res) => {
    const { type, config } = req.body;
    await client.query('INSERT INTO integrations(type, config) VALUES($1, $2)', [type, config]);
    res.status(201).send('Integration created');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});