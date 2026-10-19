import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { playMessageSound } from './notificationSound';
import './App.css';

const socket = io.connect("https://dev-chat-server-0dgn.onrender.com", {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

function App() {
  const [username, setUsername] = useState(localStorage.getItem("devchat_user") || "");
  const [room, setRoom] = useState(localStorage.getItem("devchat_room") || ""); 
  const [showChat, setShowChat] = useState(localStorage.getItem("devchat_show") === "true");
  
  const [message, setMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);

  const [theme, setTheme] = useState(localStorage.getItem("devchat_theme") || "system");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  // Handle Theme Resolution
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateTheme = () => {
      let active = theme;
      if (theme === "system") {
        active = mediaQuery.matches ? "dark" : "light";
      }
      setResolvedTheme(active);
      localStorage.setItem("devchat_theme", theme);
    };

    updateTheme();

    if (theme === "system") {
      mediaQuery.addEventListener("change", updateTheme);
      return () => mediaQuery.removeEventListener("change", updateTheme);
    }
  }, [theme]);

  const joinRoom = () => {
    if (username !== "" && room !== "") {
      socket.emit("join_room", { room, username }); 
      setShowChat(true);
      localStorage.setItem("devchat_user", username);
      localStorage.setItem("devchat_room", room);
      localStorage.setItem("devchat_show", "true");
    }
  };

  // Automatically rejoin room and fetch history on refresh if session exists
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
    // Only clear chat session data, keeping theme preferences intact
    localStorage.removeItem("devchat_user");
    localStorage.removeItem("devchat_room");
    localStorage.removeItem("devchat_show");
    window.location.reload();
  };

  useEffect(() => {
    const receiveHandler = (data) => {
      setMessageList((list) => {
        // Prevent duplicate appending if the message is already in the list
        return [...list, data];
      });
      playMessageSound();
    };

    const typingHandler = (authorName) => {
      setTypingUser(authorName);
      setTimeout(() => setTypingUser(""), 3000); 
    };
    
    // Load database history cleanly when joining or refreshing
    const historyHandler = (history) => {
      setMessageList(history);
    };

    const userListHandler = (users) => setActiveUsers(users);

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

  // Theme styles dictionary
  const styles = {
    app: {
      padding: '20px',
      maxWidth: '650px',
      margin: '0 auto',
      fontFamily: 'Inter, sans-serif',
      color: resolvedTheme === 'dark' ? '#f8fafc' : '#0f172a',
      minHeight: '100vh',
      backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#f8fafc',
      transition: 'all 0.3s ease',
    },
    card: {
      border: resolvedTheme === 'dark' ? '1px solid #334155' : '1px solid #cbd5e1',
      borderRadius: '10px',
      overflow: 'hidden',
      backgroundColor: resolvedTheme === 'dark' ? '#1e293b' : '#ffffff',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },
    header: {
      background: resolvedTheme === 'dark' ? '#0f172a' : '#2c3e50',
      color: '#fff',
      padding: '12px 15px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sidebar: {
      width: '160px',
      borderRight: resolvedTheme === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0',
      padding: '12px',
      backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#f8f9fa',
    },
    chatBox: {
      height: '340px',
      overflowY: 'scroll',
      padding: '15px',
      textAlign: 'left',
    },
    myBubble: {
      background: resolvedTheme === 'dark' ? '#065f46' : '#DCF8C6',
      color: resolvedTheme === 'dark' ? '#ecfdf5' : '#000000',
    },
    otherBubble: {
      background: resolvedTheme === 'dark' ? '#334155' : '#EAEAEA',
      color: resolvedTheme === 'dark' ? '#f8fafc' : '#000000',
    },
    inputArea: {
      display: 'flex',
      borderTop: resolvedTheme === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0',
      backgroundColor: resolvedTheme === 'dark' ? '#1e293b' : '#ffffff',
    },
    input: {
      flex: '1',
      padding: '12px',
      border: 'none',
      outline: 'none',
      backgroundColor: 'transparent',
      color: resolvedTheme === 'dark' ? '#f8fafc' : '#0f172a',
    }
  };

  return (
    <div style={styles.app}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>DevChat 🚀</h1>
        <div>
          <select 
            value={theme} 
            onChange={(e) => setTheme(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', background: resolvedTheme === 'dark' ? '#334155' : '#fff', color: resolvedTheme === 'dark' ? '#fff' : '#000', border: '1px solid #ccc' }}
          >
            <option value="light">☀️ Light</option>
            <option value="dark">🌙 Dark</option>
            <option value="system">💻 System</option>
          </select>
        </div>
      </div>

      {!showChat ? (
        <div className="joinContainer" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px', margin: '40px auto', padding: '20px', ...styles.card }}>
          <h3>Join a Chat Room</h3>
          <input type="text" value={username} placeholder="Your Name..." onChange={(e) => setUsername(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
          <input type="text" value={room} placeholder="Room ID (e.g. 123)..." onChange={(e) => setRoom(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
          <button onClick={joinRoom} style={{ padding: '10px', cursor: 'pointer', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>Join Room</button>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={styles.header}>
            <p style={{ margin: 0, fontWeight: 500 }}>Live Chat: Room {room}</p>
            <button onClick={leaveRoom} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Leave</button>
          </div>

          <div style={{ display: 'flex', background: resolvedTheme === 'dark' ? '#1e293b' : '#fff' }}>
            <div style={styles.sidebar}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', opacity: 0.8 }}>🟢 Online ({activeUsers.length})</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px' }}>
                {activeUsers.map((user) => (
                  <li key={user.id} style={{ fontWeight: user.username === username ? 'bold' : 'normal', margin: '6px 0', wordBreak: 'break-all' }}>
                    {user.username} {user.username === username ? "(You)" : ""}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={styles.chatBox}>
                {messageList.map((msg, index) => (
                  <div key={index} style={{ margin: '10px 0', textAlign: msg.author === username ? 'right' : 'left' }}>
                    <div style={{ 
                      ...(msg.author === username ? styles.myBubble : styles.otherBubble), 
                      display: 'inline-block', 
                      padding: '10px 12px', 
                      borderRadius: '12px', 
                      maxWidth: '80%', 
                      wordBreak: 'break-word',
                      textAlign: 'left'
                    }}>
                      <p style={{ margin: 0, fontSize: '14px' }}><strong>{msg.author}:</strong> {msg.text}</p>
                      <span style={{ fontSize: '10px', opacity: 0.6, float: 'right', marginTop: '4px', marginLeft: '8px' }}>{msg.time}</span>
                    </div>
                  </div>
                ))}
                
                {typingUser && (
                  <div style={{ margin: '5px 0', textAlign: 'left', fontStyle: 'italic', opacity: 0.6, fontSize: '12px' }}>
                    {typingUser} is typing...
                  </div>
                )}
              </div>

              <div style={styles.inputArea}>
                <input 
                  type="text" 
                  value={message} 
                  placeholder="Type a message..." 
                  onChange={(e) => setMessage(e.target.value)} 
                  onKeyDown={(e) => {
                    socket.emit("typing", { room: room, author: username });
                    if (e.key === 'Enter') sendMessage();
                  }} 
                  style={styles.input} 
                />
                <button onClick={sendMessage} style={{ padding: '0 25px', background: '#2c3e50', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;
