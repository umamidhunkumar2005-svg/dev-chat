import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

// 1. This is the big change: Replace the localhost link with your Render URL
const socket = io.connect("https://dev-chat-server-0dgn.onrender.com");

function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState(""); 
  const [message, setMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [showChat, setShowChat] = useState(false);

  const joinRoom = () => {
    if (username !== "" && room !== "") {
      socket.emit("join_room", room); 
      setShowChat(true);
    }
  };

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

  useEffect(() => {
    const handler = (data) => {
      setMessageList((list) => [...list, data]);
    };
    socket.on("receive_message", handler);
    return () => socket.off("receive_message", handler);
  }, [socket]);

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'Arial' }}>
      <h1>DevChat 🚀</h1>

      {!showChat ? (
        <div className="joinContainer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Join a Chat Room</h3>
          <input type="text" placeholder="Your Name..." onChange={(e) => setUsername(e.target.value)} style={{ padding: '10px' }} />
          <input type="text" placeholder="Room ID (e.g. 123)..." onChange={(e) => setRoom(e.target.value)} style={{ padding: '10px' }} />
          <button onClick={joinRoom} style={{ padding: '10px', cursor: 'pointer', background: '#2c3e50', color: 'white', border: 'none' }}>Join Room</button>
        </div>
      ) : (
        <div className="chat-window">
          <div style={{ background: '#2c3e50', color: 'white', padding: '5px', borderRadius: '8px 8px 0 0' }}>
            <p>Live Chat: Room {room}</p>
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
          </div>
          <div style={{ display: 'flex' }}>
            <input type="text" value={message} placeholder="Message..." onChange={(e) => setMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} style={{ flex: '1', padding: '10px' }} />
            <button onClick={sendMessage} style={{ padding: '10px' }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
