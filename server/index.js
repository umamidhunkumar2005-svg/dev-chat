const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

// 1. Create the standard HTTP server
const server = http.createServer(app);

// 2. Set up the live chat connection (WebSockets)
const io = new Server(server, {
  cors: {
    origin: "*", // CHANGED: This now allows your deployed website to connect!
    methods: ["GET", "POST"]
  }
});

// 3. Listen for events
io.on('connection', (socket) => {
  console.log(`🟢 User Connected: ${socket.id}`);

  // Listen for a user wanting to join a specific room
  socket.on("join_room", (roomID) => {
    socket.join(roomID); 
    console.log(`👤 User ${socket.id} joined room: ${roomID}`);
  });

  // Listen for a message being sent
  socket.on("send_message", (data) => {
    console.log("Message received for room:", data.room);
    
    // Send ONLY to people in that specific room
    socket.to(data.room).emit("receive_message", data);
  });

  // NEW: Listen for a user typing
  socket.on("typing", (data) => {
    // Broadcast to everyone else in the room that this user is typing
    socket.to(data.room).emit("user_typing", data.author);
  });

  // Listen for users leaving
  socket.on('disconnect', () => {
    console.log(`🔴 User Disconnected: ${socket.id}`);
  });
});

// 4. Turn the server on
const PORT = process.env.PORT || 5000; // Ready for Render deployment
server.listen(PORT, () => {
  console.log(`🚀 DevChat Server is running on port ${PORT}`);
});
