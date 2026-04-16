const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config(); // NEW: Load secret variables from .env file

const app = express();
app.use(cors());

// NEW: Use the hidden URL from your .env file
const db_link = process.env.MONGO_URL; 

mongoose.connect(db_link)
  .then(() => console.log("💾 MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Failed:", err));

// NEW: Create a blueprint (Schema) for our messages
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

// 3. Listen for events
io.on('connection', (socket) => {
  console.log(`🟢 User Connected: ${socket.id}`);

  // Listen for a user wanting to join a specific room
  socket.on("join_room", async (roomID) => {
    socket.join(roomID); 
    console.log(`👤 User ${socket.id} joined room: ${roomID}`);

    // Fetch all previous messages for this room from the database
    try {
      const previousMessages = await Message.find({ room: roomID });
      // Send the history only to the user who just joined
      socket.emit("chat_history", previousMessages); 
    } catch (error) {
      console.log("Error fetching history:", error);
    }
  });

  // Listen for a message being sent
  socket.on("send_message", async (data) => {
    console.log("Message received for room:", data.room);
    
    // Save the message to the database before sending it to others
    try {
      const newMessage = new Message(data);
      await newMessage.save();
    } catch (error) {
      console.log("Error saving message:", error);
    }

    // Send ONLY to people in that specific room
    socket.to(data.room).emit("receive_message", data);
  });

  // Listen for a user typing
  socket.on("typing", (data) => {
    socket.to(data.room).emit("user_typing", data.author);
  });

  // Listen for users leaving
  socket.on('disconnect', () => {
    console.log(`🔴 User Disconnected: ${socket.id}`);
  });
});

// 4. Turn the server on
const PORT = process.env.PORT || 5000; 
server.listen(PORT, () => {
  console.log(`🚀 DevChat Server is running on port ${PORT}`);
});
