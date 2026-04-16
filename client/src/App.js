import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

// Keep your Render URL here!
const socket = io.connect("https://dev-chat-server-0dgn.onrender.com");

function App() {
  // NEW: Check local storage first so it remembers you after a refresh!
  const [username, setUsername] = useState(localStorage.getItem("devchat_user") || "");
  const [room, setRoom] = useState(localStorage.getItem("devchat_room") || ""); 
  const [showChat, setShowChat] = useState(localStorage.getItem("devchat_show") === "true");
  
  const [message, setMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [typingUser, setTypingUser] = useState("");

  const joinRoom = () => {
    if (username !== "" && room !== "") {
      socket.emit("join_room", room); 
      setShowChat(true);
      // Save details to local storage
      localStorage.setItem("devchat_user", username);
      localStorage.setItem("devchat_room", room);
      localStorage.setItem("devchat_show", "true");
    }
  };

  // If returning to page after refresh, automatically rejoin the room
  useEffect(() => {
    if (showChat) {
      socket.emit("join_room", room);
    }
  }, [showChat, room]);

  const sendMessage = () => {
    if (message !== "") {
      const messageData = {
        room: room, 
        author: username,
        text: message,
        time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
      };

      socket.emit("send_message", messageData);
      setMessageList((list) => [...list, messageData]);
      setMessage("");
    }
  };

  const leaveRoom = () => {
    setShowChat(false);
    localStorage.clear();
    window.location.reload();
  };

  useEffect(() => {
    const receiveHandler = (data) => setMessageList((list) => [...list, data]);
    const typingHandler = (authorName) => {
      setTypingUser(authorName);
      setTimeout(() => setTypingUser(""), 3000); 
    };
    
    // NEW: Listen for chat history from the database!
    const historyHandler = (history) => {
      setMessageList(history);
    };

    socket.on("receive_message", receiveHandler);
    socket.on("user_typing", typingHandler);
    socket.on("chat_history", historyHandler);

    return () => {
      socket.off("receive_message", receiveHandler);
      socket.off("user_typing", typingHandler);
      socket.off("chat_history", historyHandler);
    };
  }, []);

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'Arial' }}>
      <h1>DevChat 🚀</h1>

      {!showChat ? (
        <div className="joinContainer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Join a Chat Room</h3>
          <input type="text" value={username} placeholder="Your Name..." onChange={(e) => setUsername(e.target.value)} style={{ padding: '10px' }} />
          <input type="text" value={room} placeholder="Room ID (e.g. 123)..." onChange={(e) => setRoom(e.target.value)} style={{ padding: '10px' }} />
          <button onClick={joinRoom} style={{ padding: '10px', cursor: 'pointer', background: '#2c3e50', color: 'white', border: 'none' }}>Join Room</button>
        </div>
      ) : (
        <div className="chat-window">
          <div style={{ background: '#2c3e50', color: 'white', padding: '10px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0 }}>Live Chat: Room {room}</p>
            <button onClick={leaveRoom} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Leave</button>
          </div>
          <div style={{ border: '1px solid #ccc', height: '350px', marginBottom: '10px', overflowY: 'scroll', padding: '10px', textAlign: 'left' }}>
            {messageList.map((msg, index) => (
              <div key={index} style={{ margin: '10px 0', textAlign: msg.author === username ? 'right' : 'left' }}>
                <div style={{ background: msg.author === username ? '#DCF8C6' : '#EAEAEA', display: 'inline-block', padding: '8px', borderRadius: '10px' }}>
                  <p style={{ margin: 0 }}><strong>{msg.author}:</strong> {msg.text}</p>
                  <span style={{ fontSize: '10px', color: '#888' }}>{msg.time}</span>
                </div>
              </div>
            ))}
            
            {typingUser && (
              <div style={{ margin: '10px 0', textAlign: 'left', fontStyle: 'italic', color: 'gray', fontSize: '12px' }}>
                {typingUser} is typing...
              </div>
            )}
          </div>
          <div style={{ display: 'flex' }}>
            <input 
              type="text" 
              value={message} 
              placeholder="Message..." 
              onChange={(e) => setMessage(e.target.value)} 
              onKeyDown={(e) => {
                socket.emit("typing", { room: room, author: username });
                if (e.key === 'Enter') sendMessage();
              }} 
              style={{ flex: '1', padding: '10px' }} 
            />
            <button onClick={sendMessage} style={{ padding: '10px' }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
