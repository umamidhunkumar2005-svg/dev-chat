import React, { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";
import { playMessageSound } from "./notificationSound";
import "./App.css";

const socket = io.connect("https://dev-chat-server-0dgn.onrender.com", {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" }
  ]
};

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

  const [callType, setCallType] = useState("video");
  const [calling, setCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callerName, setCallerName] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidatesQueue = useRef([]);
  const ringtoneIntervalRef = useRef(null);

  const [theme, setTheme] = useState(localStorage.getItem("devchat_theme") || "system");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  const startRingtone = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") { audioCtx.resume(); }
      ringtoneIntervalRef.current = setInterval(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      }, 1500);
    } catch (e) { console.log(e); }
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  const closeCallUI = useCallback(() => {
    stopRingtone();
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setCalling(false);
    setCallActive(false);
    setIncomingCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setCallerName("");
  }, []);

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
      playMessageSound();
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

    socket.on("call_incoming", (data) => {
      setIncomingCall(data);
      setCallerName(data.from);
      setCallType(data.type || "video");
      startRingtone();
    });

    socket.on("call_accepted", async (data) => {
      stopRingtone();
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        setCallActive(true);
        setCalling(false);
      }
    });

    socket.on("ice_candidate", async (candidate) => {
      if (candidate) {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) { console.error(e); }
        } else {
          iceCandidatesQueue.current.push(candidate);
        }
      }
    });

    socket.on("call_ended", () => { closeCallUI(); });

    return () => {
      socket.off("receive_message", receiveHandler);
      socket.off("user_typing", typingHandler);
      socket.off("chat_history", historyHandler);
      socket.off("user_list", userListHandler);
      socket.off("call_incoming");
      socket.off("call_accepted");
      socket.off("ice_candidate");
      socket.off("call_ended");
    };
  }, [closeCallUI]);

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

  const initPeerConnection = () => {
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice_candidate", { room, candidate: event.candidate });
      }
    };

    return pc;
  };

  const startCall = (type) => {
    setCallType(type);
    setCalling(true);
    startRingtone();
    
    const otherUser = activeUsers.find(u => u.username !== username)?.username || "User";
    setCallerName(otherUser);

    navigator.mediaDevices.getUserMedia(type === "video" ? { video: true, audio: true } : { video: false, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (type === "video" && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = initPeerConnection();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          socket.emit("call_user", { room, offer, from: username, type });
        });
      })
      .catch((e) => {
        console.error(e);
        stopRingtone();
        setCalling(false);
      });
  };

  const answerCall = () => {
    stopRingtone();
    const type = incomingCall?.type || "video";
    setCallType(type);

    navigator.mediaDevices.getUserMedia(type === "video" ? { video: true, audio: true } : { video: false, audio: true })
      .then(async (stream) => {
        localStreamRef.current = stream;
        if (type === "video" && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = initPeerConnection();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("answer_call", { room, answer });
        setCallActive(true);
        setIncomingCall(null);
      })
      .catch((e) => { console.error(e); });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current && callType === "video") {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => { setIsSpeakerOn(!isSpeakerOn); };

  const endVideoCall = () => {
    socket.emit("end_call", { room });
    closeCallUI();
  };

  const getFirstLetter = (name) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  const styles = {
    app: {
      padding: "20px", maxWidth: "720px", margin: "0 auto", fontFamily: "Inter, sans-serif",
      color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a", minHeight: "100vh",
      backgroundColor: resolvedTheme === "dark" ? "#0f172a" : "#f8fafc", transition: "all 0.3s ease",
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
      <audio ref={remoteAudioRef} autoPlay />

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
              {!callActive && !calling && (
                <>
                  <button onClick={() => startCall("audio")} title="Voice Call" style={{ background: "#3498db", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                    📞 Voice Call
                  </button>
                  <button onClick={() => startCall("video")} title="Video Call" style={{ background: "#27ae60", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                    📹 Video Call
                  </button>
                </>
              )}
              <button onClick={leaveRoom} style={{ background: "#e74c3c", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Leave</button>
            </div>
          </div>

          {incomingCall && (
            <div style={{ padding: "12px 15px", background: "#27ae60", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.2)" }}>
              <span>🔔 Incoming {incomingCall.type || "video"} call from <strong>{incomingCall.from}</strong></span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={answerCall} style={{ background: "#fff", color: "#27ae60", border: "none", padding: "6px 12px", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Accept</button>
                <button onClick={() => { stopRingtone(); setIncomingCall(null); }} style={{ background: "#e74c3c", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Decline</button>
              </div>
            </div>
          )}

          {(calling || callActive) && (
            <div style={{
              position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
              backgroundColor: "#0f172a", zIndex: 9999, display: "flex", flexDirection: "column",
              justifyContent: "space-between", alignItems: "center", padding: "15px 10px", boxSizing: "border-box"
            }}>
              <div style={{ color: "#fff", textAlign: "center", marginTop: "5px" }}>
                <h2 style={{ margin: "0 0 2px 0", fontSize: "18px" }}>{calling ? "Calling..." : "In Call"}</h2>
                <p style={{ opacity: 0.8, margin: 0, fontSize: "14px", fontWeight: "bold" }}>
                  {callerName ? `Talking with ${callerName}` : currentChatTitle} ({callType.toUpperCase()})
                </p>
              </div>

              {callType === "video" ? (
                <div style={{ position: "relative", width: "100%", maxWidth: "700px", height: "52vh", background: "#000", borderRadius: "12px", overflow: "hidden", margin: "5px 0" }}>
                  <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", bottom: "15px", right: "15px", width: "100px", height: "130px", borderRadius: "8px", overflow: "hidden", border: "2px solid #fff", boxShadow: "0 4px 10px rgba(0,0,0,0.5)", background: "#222" }}>
                    <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "12px" }}>
                  <div style={{ 
                    width: "100px", height: "100px", borderRadius: "50px", 
                    background: "linear-gradient(135deg, #3498db, #2ecc71)", 
                    display: "flex", justifyContent: "center", alignItems: "center", 
                    fontSize: "42px", fontWeight: "bold", color: "#fff", boxShadow: "0 8px 25px rgba(0,0,0,0.5)"
                  }}>
                    {getFirstLetter(callerName)}
                  </div>
                  <h3 style={{ color: "#fff", margin: 0, fontSize: "18px" }}>{callerName || "Connected"}</h3>
                </div>
              )}

              <div style={{ 
                display: "flex", gap: "12px", background: "rgba(255,255,255,0.15)", 
                padding: "10px 20px", borderRadius: "30px", backdropFilter: "blur(10px)", 
                marginBottom: "10px", alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
              }}>
                <button onClick={toggleMute} title="Mute" style={{ background: isMuted ? "#e74c3c" : "#ffffff33", color: "#fff", border: "none", width: "45px", height: "45px", borderRadius: "22.5px", fontSize: "18px", cursor: "pointer" }}>
                  {isMuted ? "🔇" : "🎙️"}
                </button>

                {callType === "video" ? (
                  <button onClick={toggleVideo} title="Toggle Video" style={{ background: isVideoOff ? "#e74c3c" : "#ffffff33", color: "#fff", border: "none", width: "45px", height: "45px", borderRadius: "22.5px", fontSize: "18px", cursor: "pointer" }}>
                    {isVideoOff ? "🚫" : "📹"}
                  </button>
                ) : (
                  <button onClick={toggleSpeaker} title="Speaker Toggle" style={{ background: isSpeakerOn ? "#27ae60" : "#ffffff33", color: "#fff", border: "none", width: "45px", height: "45px", borderRadius: "22.5px", fontSize: "18px", cursor: "pointer" }}>
                    {isSpeakerOn ? "🔊" : "🔈"}
                  </button>
                )}

                <button onClick={endVideoCall} title="Hang Up" style={{ background: "#e74c3c", color: "#fff", border: "none", width: "48px", height: "48px", borderRadius: "24px", fontSize: "20px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(231,76,60,0.5)" }}>
                  📞
                </button>
              </div>
            </div>
          )}

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
