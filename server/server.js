require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');

const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes'); 
const messageRoutes = require('./routes/messageRoutes'); 
const intentRoutes = require('./routes/intentRoutes');
const poolRoutes = require('./routes/poolRoutes'); 
const passport = require('passport');
require('./services/passport');

const app = express();
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === 'production';

// 1. Update CORS to accept the future Vercel URL
app.use(cors({ 
  origin: [
    'http://localhost:5173', 
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
    'https://kgp-pooling.vercel.app'
  ], 
  credentials: true 
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_key',
  resave: true,              
  saveUninitialized: true,   
  cookie: { 
  maxAge: 30 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: true,      
  sameSite: 'none'   
  }
}));

// routes 
app.use('/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/intents', intentRoutes);
app.use('/api/pools', poolRoutes); 

app.use(passport.initialize());
app.use(passport.session());

// sockets.io
const io = new Server(server, { cors: { origin: true, credentials: true } });

io.on('connection', (socket) => {
  
  // Put the user in an isolated room for their specific ride pool
  socket.on('join_room', (room) => {
    socket.join(room);
  });

  // (The DB saving is handled securely by the frontend hitting /api/messages)
  socket.on('send_message', (data) => {
    socket.to(data.room).emit('receive_message', data.message);
  });

  socket.on('typing', (data) => {
    socket.to(data.room).emit('user_typing', data.name);
  });

  socket.on('stop_typing', (room) => {
    socket.to(room).emit('user_stopped_typing');
  });

});

// Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Server start 
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nKGPooling Engine running on port ${PORT}`);
  
  // Find Local IP Address for Network Testing
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const interfaceName in networkInterfaces) {
    for (const net of networkInterfaces[interfaceName]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
      }
    }
  }

  //console.log(`➜ http://${localIP}:5173\n`);
});