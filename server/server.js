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

const app = express();
const server = http.createServer(app);

// Dev mode : Allow ANY device on the Wi-Fi to connect 
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Basic session storage
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// routes 
app.use('/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/intents', intentRoutes);
app.use('/api/pools', poolRoutes); 

// Websockets
const io = new Server(server, { cors: { origin: true, credentials: true } });
io.on('connection', (socket) => {
  // console.log('User connected to Live Node:', socket.id);

  socket.on('join_pool_room', (poolId) => {
    socket.join(poolId);
    console.log(`User joined pool chat: ${poolId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const Message = require('./models/Message');
      const newMessage = await Message.create(data);
      io.to(data.poolId).emit('receive_message', newMessage); 
    } catch(err) { console.error("Socket Error:", err); }
  });
});

// Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// --- SERVER START & TERMINAL MAGIC ---
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

  /*
  Multi-device testing 
  console.log(`User 1 (Avinash) : http://${localIP}:5173`);
  console.log(`User 2 (Rahul)   : http://${localIP}:5173`);
  console.log(`User 3 (Priya)   : http://${localIP}:5173`);
  */
 
});