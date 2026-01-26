// src/app.js
require('dotenv').config();
// Trigger restart
const path = require('path');
const express = require('express');
const cors = require('cors');
const loanRoutes = require('./routes/loans');
const exportRoutes = require('./routes/export'); // export routes
const authRoutes = require('./routes/auth'); // auth routes
const { verifyToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

// Public routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Explicitly serve index.html for root route
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../client/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading frontend');
    }
  });
});

app.use('/api/auth', authRoutes); // login endpoint – no JWT required

// Protected routes – require JWT and set user context for audit
app.use('/api/loans', verifyToken, loanRoutes);
app.use('/api/export', verifyToken, exportRoutes);
app.use('/api/reports', verifyToken, require('./routes/reports'));

// Serve static frontend files from 'client' folder
app.use(express.static(path.join(__dirname, '../client')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Melann Lending API listening on port ${PORT}`);
});
