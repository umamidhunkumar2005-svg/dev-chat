const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();
const mongoose = require('mongoose');

const app = express();
app.use(cors());

const db_link = process.env.MONGO_URL; 

mongoose.connect(db_link)
  .then(() => console.log("💾 MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Failed:", err));

const messageSchema = new mongoose.Schema({
  room: String,
  author: String,
  text: String,
  file: String, // Support for base64 image strings or file data
  fileType: String,
  time: String
});
const Message = mongoose.model("Message", messageSchema);

const server = http.createServer(app);

// Enable high payload limit (10MB) for handling image sharing over sockets
const io = new Server(server, {
  maxHttpBufferSize: 1e7, // 10 MB limit for file transfers
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const roomUsers = {}; 

io.on('connection', (socket) => {
  console.log(`🟢 User Connected: ${socket.id}`);

  // Join room (Supports both public rooms and private DM rooms)
  socket.on("join_room", async (data) => {
    const roomID = typeof data === "object" ? data.room : data;
    const username = typeof data === "object" ? data.username : "Anonymous";

    socket.join(roomID); 
    socket.data = { room: roomID, username };
    console.log(`👤 User ${socket.id} (${username}) joined room/DM: ${roomID}`);

    if (!roomUsers[roomID]) {
      roomUsers[roomID] = [];
    }
    
    // Prevent duplicate entries on refresh
    roomUsers[roomID] = roomUsers[roomID].filter((u) => u.username !== username);
    roomUsers[roomID].push({ id: socket.id, username });

    io.to(roomID).emit("user_list", roomUsers[roomID]);

    try {
      const previousMessages = await Message.find({ room: roomID });
      socket.emit("chat_history", previousMessages); 
    } catch (error) {
      console.log("Error fetching history:", error);
    }
  });

  // Handle sending text or file messages
  socket.on("send_message", (data) => {
    console.log("Message received for room/DM:", data.room);
    
    // 1. Instant socket broadcast
    socket.to(data.room).emit("receive_message", data);

    // 2. Safe background save to MongoDB
    const newMessage = new Message(data);
    newMessage.save().catch((error) => {
      console.log("❌ Error saving message to MongoDB:", error);
    });
  });

  socket.on("typing", (data) => {
    socket.to(data.room).emit("user_typing", data.author);
  });

  socket.on('disconnect', () => {
    const { room, username } = socket.data || {};
    if (room && roomUsers[room]) {
      roomUsers[room] = roomUsers[room].filter((u) => u.id !== socket.id);
      io.to(room).emit("user_list", roomUsers[room]);
    }
    console.log(`🔴 User Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000; 
server.listen(PORT, () => {
  console.log(`🚀 DevChat Server is running on port ${PORT}`);
});
