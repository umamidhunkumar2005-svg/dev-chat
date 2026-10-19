const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config(); // Load secret variables from .env file
const mongoose = require('mongoose');

const app = express();
app.use(cors());

// Use the hidden URL from your .env file
const db_link = process.env.MONGO_URL; 

mongoose.connect(db_link)
  .then(() => console.log("💾 MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Failed:", err));

// Create a blueprint (Schema) for our messages
const messageSchema = new mongoose.Schema({
  room: String,
  author: String,
  text: String,
  time: String
});
const Message = mongoose.model("Message", messageSchema); // Create the database collection

// 1. Create the standard HTTP server
const server = http.createServer(app);

// 2. Set up the live chat connection (WebSockets)
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const roomUsers = {}; // Store active users in each room

// 3. Listen for events
io.on('connection', (socket) => {
  console.log(`🟢 User Connected: ${socket.id}`);

  // Listen for a user wanting to join a specific room
  socket.on("join_room", async (data) => {
    const roomID = typeof data === "object" ? data.room : data;
    const username = typeof data === "object" ? data.username : "Anonymous";

    socket.join(roomID); 
    socket.data = { room: roomID, username };
    console.log(`👤 User ${socket.id} (${username}) joined room: ${roomID}`);

    // Track online users per room
    if (!roomUsers[roomID]) {
      roomUsers[roomID] = [];
    }
    if (!roomUsers[roomID].some((u) => u.id === socket.id)) {
      roomUsers[roomID].push({ id: socket.id, username });
    }

    // Broadcast updated active user list to everyone in the room
    io.to(roomID).emit("user_list", roomUsers[roomID]);

    // Fetch all previous messages for this room from the database
    try {
      const previousMessages = await Message.find({ room: roomID });
      // Send history only to the user who just joined
      socket.emit("chat_history", previousMessages); 
    } catch (error) {
      console.log("Error fetching history:", error);
    }
  });

  // Listen for a message being sent (Instant broadcast + background safe save)
  socket.on("send_message", (data) => {
    console.log("Message received for room:", data.room);
    
    // 1. Broadcast to the other user instantly over WebSockets (Zero delay!)
    socket.to(data.room).emit("receive_message", data);

    // 2. Save to MongoDB in the background asynchronously so persistence works without lag
    const newMessage = new Message(data);
    newMessage.save().catch((error) => {
      console.log("❌ Error saving message to MongoDB:", error);
    });
  });

  // Listen for a user typing
  socket.on("typing", (data) => {
    socket.to(data.room).emit("user_typing", data.author);
  });

  // Listen for users leaving / disconnecting
  socket.on('disconnect', () => {
    const { room, username } = socket.data || {};
    if (room && roomUsers[room]) {
      roomUsers[room] = roomUsers[room].filter((u) => u.id !== socket.id);
      io.to(room).emit("user_list", roomUsers[room]);
    }
    console.log(`🔴 User Disconnected: ${socket.id}`);
  });
});

// 4. Turn the server on
const PORT = process.env.PORT || 5000; 
server.listen(PORT, () => {
  console.log(`🚀 DevChat Server is running on port ${PORT}`);
});
