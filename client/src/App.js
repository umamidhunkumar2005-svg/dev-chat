import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { playMessageSound } from './notificationSound';
import './App.css';

// Keep your Render URL here!
const socket = io.connect("https://dev-chat-server-0dgn.onrender.com");

function App() {
  const [username, setUsername] = useState(localStorage.getItem("devchat_user") || "");
  const [room, setRoom] = useState(localStorage.getItem("devchat_room") || ""); 
  const [showChat, setShowChat] = useState(localStorage.getItem("devchat_show") === "true");
  
  const [message, setMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [activeUsers, setActiveUsers] = useState([]); // Active users list

  const joinRoom = () => {
    if (username !== "" && room !== "") {
      // Pass both room and username so the backend tracks who is online accurately
      socket.emit("join_room", { room, username }); 
      setShowChat(true);
      localStorage.setItem("devchat_user", username);
      localStorage.setItem("devchat_room", room);
      localStorage.setItem("devchat_show", "true");
    }
  };

  // If returning to page after refresh, automatically rejoin the room
  useEffect(() => {
    if (showChat && room && username) {
      socket.emit("join_room", { room, username });
    }
  }, [showChat, room, username]);

  const sendMessage = () => {
    if (message !== "") {
      const messageData = {
        room: room, 
        author: username,
        text: message,
        time: new Date(Date.now()).getHours() + ":" + String(new Date(Date.now()).getMinutes()).padStart(2, '0'),
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
    const receiveHandler = (data) => {
      setMessageList((list) => [...list, data]);
      playMessageSound(); // Play chime when a new message arrives!
    };

    const typingHandler = (authorName) => {
      setTypingUser(authorName);
      setTimeout(() => setTypingUser(""), 3000); 
    };
    
    const historyHandler = (history) => {
      setMessageList(history);
    };

    const userListHandler = (users) => {
      setActiveUsers(users);
    };

    socket.on("receive_message", receiveHandler);
    socket.on("user_typing", typingHandler);
    socket.on("chat_history", historyHandler);
    socket.on("user_list", userListHandler);

    return () => {
      socket.off("receive_message", receiveHandler);
      socket.off("user_typing", typingHandler);
      socket.off("chat_history", historyHandler);
      socket.off("user_list", userListHandler);
    };
  }, []);

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial' }}>
      <h1>DevChat 🚀</h1>

      {!showChat ? (
        <div className="joinContainer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Join a Chat Room</h3>
          <input type="text" value={username} placeholder="Your Name..." onChange={(e) => setUsername(e.target.value)} style={{ padding: '10px' }} />
          <input type="text" value={room} placeholder="Room ID (e.g. 123)..." onChange={(e) => setRoom(e.target.value)} style={{ padding: '10px' }} />
          <button onClick={joinRoom} style={{ padding: '10px', cursor: 'pointer', background: '#2c3e50', color: 'white', border: 'none' }}>Join Room</button>
        </div>
      ) : (
        <div className="chat-window" style={{ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: '#2c3e50', color: 'white', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0 }}>Live Chat: Room {room}</p>
            <button onClick={leaveRoom} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Leave</button>
          </div>

          {/* Body Container with Sidebar and Chat Box */}
          <div className="chat-body-container" style={{ display: 'flex', background: '#fff', color: '#000' }}>
            
            {/* Online Users Sidebar */}
            <div className="users-sidebar" style={{ width: '150px', borderRight: '1px solid #ccc', padding: '10px', background: '#f8f9fa' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>🟢 Online ({activeUsers.length})</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px' }}>
                {activeUsers.map((user) => (
                  <li key={user.id} style={{ fontWeight: user.username === username ? 'bold' : 'normal', margin: '6px 0' }}>
                    {user.username} {user.username === username ? "(You)" : ""}
                  </li>
                ))}
              </ul>
            </div>

            {/* Message Feed Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '320px', overflowY: 'scroll', padding: '10px', textAlign: 'left' }}>
                {messageList.map((msg, index) => (
                  <div key={index} style={{ margin: '10px 0', textAlign: msg.author === username ? 'right' : 'left' }}>
                    <div style={{ background: msg.author === username ? '#DCF8C6' : '#EAEAEA', display: 'inline-block', padding: '8px', borderRadius: '10px', maxWidth: '80%', wordBreak: 'break-word' }}>
                      <p style={{ margin: 0, fontSize: '14px' }}><strong>{msg.author}:</strong> {msg.text}</p>
                      <span style={{ fontSize: '10px', color: '#888', float: 'right', marginTop: '4px', marginLeft: '8px' }}>{msg.time}</span>
                    </div>
                  </div>
                ))}
                
                {typingUser && (
                  <div style={{ margin: '5px 0', textAlign: 'left', fontStyle: 'italic', color: 'gray', fontSize: '12px' }}>
                    {typingUser} is typing...
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div style={{ display: 'flex', borderTop: '1px solid #ccc' }}>
                <input 
                  type="text" 
                  value={message} 
                  placeholder="Message..." 
                  onChange={(e) => setMessage(e.target.value)} 
                  onKeyDown={(e) => {
                    socket.emit("typing", { room: room, author: username });
                    if (e.key === 'Enter') sendMessage();
                  }} 
                  style={{ flex: '1', padding: '10px', border: 'none', outline: 'none' }} 
                />
                <button onClick={sendMessage} style={{ padding: '10px 20px', background: '#2c3e50', color: 'white', border: 'none', cursor: 'pointer' }}>Send</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;
