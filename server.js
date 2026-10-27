const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const { connectDB } = require('./config/db');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
}

// Route Imports
const authRoutes = require('./routes/authRoutes');
const kalipRoutes = require('./routes/kalipRoutes');
const userRoutes = require('./routes/userRoutes');
const logRoutes = require('./routes/logRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5000', 'http://localhost:5173'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 8 * 60 * 60 * 1000 // 8 saat
    }
}));

// Route Mapping
app.use('/api/auth', authRoutes);
app.use('/api', kalipRoutes); // Mounts kaliplar and processes (deneme, etc.)
app.use('/api/kullanicilar', userRoutes);
app.use('/api', logRoutes); // Mounts logs and stats

// Start Server
const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
        console.log('✅ MVC Mimarisi ile yeniden şahlandı! 🌟');
    });
};

startServer();