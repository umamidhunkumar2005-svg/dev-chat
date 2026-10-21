import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io.connect("https://dev-chat-server-0dgn.onrender.com", {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

function App() {
  const [username, setUsername] = useState(localStorage.getItem("devchat_user") || "");
  const [room, setRoom] = useState(localStorage.getItem("devchat_room") || ""); 
  const [showChat, setShowChat] = useState(localStorage.getItem("devchat_show") === "true");
  
  const [currentChatTitle, setCurrentChatTitle] = useState(localStorage.getItem("devchat_room") ? `Room: ${localStorage.getItem("devchat_room")}` : "");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [messageList, setMessageList] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);
  const [modalImage, setModalImage] = useState(null);

  const [theme, setTheme] = useState(localStorage.getItem("devchat_theme") || "system");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  const leaveRoom = () => {
    setShowChat(false);
    localStorage.removeItem("devchat_user");
    localStorage.removeItem("devchat_room");
    localStorage.removeItem("devchat_show");
    window.location.reload();
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      let active = theme;
      if (theme === "system") { active = mediaQuery.matches ? "dark" : "light"; }
      setResolvedTheme(active);
      localStorage.setItem("devchat_theme", theme);
    };
    updateTheme();
    if (theme === "system") {
      mediaQuery.addEventListener("change", updateTheme);
      return () => mediaQuery.removeEventListener("change", updateTheme);
    }
  }, [theme]);

  useEffect(() => {
    const receiveHandler = (data) => {
      setMessageList((list) => [...list, data]);
    };

    const typingHandler = (authorName) => {
      setTypingUser(authorName);
      setTimeout(() => setTypingUser(""), 3000); 
    };
    
    const historyHandler = (history) => setMessageList(history);
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

  useEffect(() => {
    if (showChat && room && username) {
      socket.emit("join_room", { room, username });
    }
  }, [showChat, room, username]);

  const joinRoom = () => {
    if (username !== "" && room !== "") {
      socket.emit("join_room", { room, username }); 
      setShowChat(true);
      setCurrentChatTitle(`Room: ${room}`);
      localStorage.setItem("devchat_user", username);
      localStorage.setItem("devchat_room", room);
      localStorage.setItem("devchat_show", "true");
    }
  };

  const startDM = (targetUser) => {
    if (targetUser === username) return;
    const sortedUsers = [username, targetUser].sort();
    const dmRoomID = `dm_${sortedUsers[0]}_${sortedUsers[1]}`;
    setRoom(dmRoomID);
    setCurrentChatTitle(`DM with ${targetUser}`);
    setMessageList([]); 
    socket.emit("join_room", { room: dmRoomID, username });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile({ data: reader.result, type: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = () => {
    if (message !== "" || selectedFile) {
      const messageData = {
        room: room, 
        author: username,
        text: message,
        file: selectedFile ? selectedFile.data : null,
        fileType: selectedFile ? selectedFile.type : null,
        time: new Date(Date.now()).getHours() + ":" + String(new Date(Date.now()).getMinutes()).padStart(2, "0"),
      };

      socket.emit("send_message", messageData);
      setMessageList((list) => [...list, messageData]);
      setMessage("");
      setSelectedFile(null);
    }
  };

  const styles = {
    app: {
      padding: "20px", maxWidth: "720px", margin: "0 auto", fontFamily: "Inter, sans-serif",
      color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a", minHeight: "100vh",
      backgroundColor: resolvedTheme === "dark" ? "#0f172a" : "#f8f9fa", transition: "all 0.3s ease",
    },
    card: {
      border: resolvedTheme === "dark" ? "1px solid #334155" : "1px solid #cbd5e1",
      borderRadius: "10px", overflow: "hidden",
      backgroundColor: resolvedTheme === "dark" ? "#1e293b" : "#ffffff",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
    header: {
      background: resolvedTheme === "dark" ? "#0f172a" : "#2c3e50",
      color: "#fff", padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center",
    },
    sidebar: {
      width: "180px", borderRight: resolvedTheme === "dark" ? "1px solid #334155" : "1px solid #e2e8f0",
      padding: "12px", backgroundColor: resolvedTheme === "dark" ? "#0f172a" : "#f8f9fa",
    },
    chatBox: { height: "340px", overflowY: "scroll", padding: "15px", textAlign: "left" },
    myBubble: {
      background: resolvedTheme === "dark" ? "#065f46" : "#DCF8C6",
      color: resolvedTheme === "dark" ? "#ecfdf5" : "#000000",
    },
    otherBubble: {
      background: resolvedTheme === "dark" ? "#334155" : "#EAEAEA",
      color: resolvedTheme === "dark" ? "#f8fafc" : "#000000",
    },
    inputArea: {
      display: "flex", alignItems: "center",
      borderTop: resolvedTheme === "dark" ? "1px solid #334155" : "1px solid #e2e8f0",
      backgroundColor: resolvedTheme === "dark" ? "#1e293b" : "#ffffff", padding: "5px 10px",
    },
    input: {
      flex: "1", padding: "10px", border: "none", outline: "none",
      backgroundColor: "transparent", color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
    }
  };

  return (
    <div style={styles.app}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ margin: 0 }}>DevChat 🚀</h1>
        <div>
          <select 
            value={theme} 
            onChange={(e) => setTheme(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "6px", cursor: "pointer", background: resolvedTheme === "dark" ? "#334155" : "#fff", color: resolvedTheme === "dark" ? "#fff" : "#000", border: "1px solid #ccc" }}
          >
            <option value="light">☀️ Light</option>
            <option value="dark">🌙 Dark</option>
            <option value="system">💻 System</option>
          </select>
        </div>
      </div>

      {!showChat ? (
        <div className="joinContainer" style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px", margin: "40px auto", padding: "20px", ...styles.card }}>
          <h3>Join a Chat Room</h3>
          <input type="text" value={username} placeholder="Your Name..." onChange={(e) => setUsername(e.target.value)} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
          <input type="text" value={room} placeholder="Room ID (e.g. 123)..." onChange={(e) => setRoom(e.target.value)} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
          <button onClick={joinRoom} style={{ padding: "10px", cursor: "pointer", background: "#2c3e50", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold" }}>Join Room</button>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={styles.header}>
            <p style={{ margin: 0, fontWeight: 500 }}>{currentChatTitle || `Room: ${room}`}</p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button onClick={leaveRoom} style={{ background: "#e74c3c", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Leave</button>
            </div>
          </div>

          <div style={{ display: "flex", background: resolvedTheme === "dark" ? "#1e293b" : "#fff" }}>
            <div style={styles.sidebar}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", opacity: 0.8 }}>🟢 Online ({activeUsers.length})</h4>
              <p style={{ fontSize: "11px", opacity: 0.6, margin: "0 0 10px 0" }}>Click a user to DM:</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "13px" }}>
                {activeUsers.map((user) => (
                  <li 
                    key={user.id} 
                    onClick={() => startDM(user.username)}
                    style={{ 
                      fontWeight: user.username === username ? "bold" : "normal", 
                      margin: "6px 0", wordBreak: "break-all", 
                      cursor: user.username !== username ? "pointer" : "default",
                      color: user.username !== username ? "#3498db" : "inherit",
                      textDecoration: user.username !== username ? "underline" : "none"
                    }}
                  >
                    {user.username} {user.username === username ? "(You)" : ""}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={styles.chatBox}>
                {messageList.map((msg, index) => (
                  <div key={index} style={{ margin: "10px 0", textAlign: msg.author === username ? "right" : "left" }}>
                    <div style={{ 
                      ...(msg.author === username ? styles.myBubble : styles.otherBubble), 
                      display: "inline-block", padding: "10px 12px", borderRadius: "12px", 
                      maxWidth: "80%", wordBreak: "break-word", textAlign: "left"
                    }}>
                      <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}><strong>{msg.author}</strong></p>
                      
                      {msg.text && <p style={{ margin: 0, fontSize: "14px" }}>{msg.text}</p>}

                      {msg.file && (
                        <div style={{ marginTop: "8px" }}>
                          <img 
                            src={msg.file} alt="shared-media" title="Click to view full image"
                            onClick={() => setModalImage(msg.file)}
                            style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "8px", display: "block", cursor: "pointer" }} 
                          />
                        </div>
                      )}

                      <span style={{ fontSize: "10px", opacity: 0.6, float: "right", marginTop: "4px", marginLeft: "8px" }}>{msg.time}</span>
                    </div>
                  </div>
                ))}
                
                {typingUser && (
                  <div style={{ margin: "5px 0", textAlign: "left", fontStyle: "italic", opacity: 0.6, fontSize: "12px" }}>
                    {typingUser} is typing...
                  </div>
                )}
              </div>

              {selectedFile && (
                <div style={{ padding: "6px 12px", fontSize: "12px", background: resolvedTheme === "dark" ? "#0f172a" : "#e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📎 Image selected for upload</span>
                  <button onClick={() => setSelectedFile(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#e74c3c", fontWeight: "bold" }}>✕</button>
                </div>
              )}

              <div style={styles.inputArea}>
                <label style={{ cursor: "pointer", fontSize: "18px", padding: "0 8px", marginRight: "4px" }} title="Attach image">
                  📷
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                </label>

                <input 
                  type="text" value={message} placeholder="Type a message..." 
                  onChange={(e) => setMessage(e.target.value)} 
                  onKeyDown={(e) => {
                    socket.emit("typing", { room: room, author: username });
                    if (e.key === "Enter") sendMessage();
                  }} 
                  style={styles.input} 
                />
                <button onClick={sendMessage} style={{ padding: "8px 20px", background: "#2c3e50", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Send</button>
              </div>
            </div>

          </div>
        </div>
      )}

      {modalImage && (
        <div 
          onClick={() => setModalImage(null)}
          style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, cursor: "pointer"
          }}
        >
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            <img src={modalImage} alt="fullscreen" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: "8px", objectFit: "contain", display: "block", margin: "0 auto" }} />
            <button 
              onClick={() => setModalImage(null)}
              style={{
                position: "absolute", top: "-40px", right: "0px", background: "#e74c3c", color: "#fff",
                border: "none", borderRadius: "50%", width: "32px", height: "32px", fontSize: "16px", cursor: "pointer", fontWeight: "bold"
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
