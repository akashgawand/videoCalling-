import { io } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

const socket = io.connect("http://localhost:8080");

const App = () => {
  const [me, setMe] = useState("");
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callerName, setCallerName] = useState("");
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [inputRoomId, setInputRoomId] = useState("");
  const [otherUserName, setOtherUserName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const peerConnection = useRef(null);

  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  };

  useEffect(() => {
    // Get user media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setStream(stream);
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
        }
      })
      .catch((error) => {
        console.error("Error accessing media devices:", error);
      });

    // Socket event listeners
    socket.on("me", (id) => setMe(id));

    socket.on("callUser", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
      setCallerName(data.name);
    });

    socket.on("callAccepted", async (data) => {
      setCallAccepted(true);
      setIsConnecting(false);
      setOtherUserName(data.name);
      
      if (peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.signal));
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      }
    });

    socket.on("ice-candidate", async (data) => {
      if (peerConnection.current) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error("Error adding ice candidate:", error);
        }
      }
    });

    return () => {
      socket.off("me");
      socket.off("callUser");
      socket.off("callAccepted");
      socket.off("ice-candidate");
    };
  }, []);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(configuration);

    // Add local stream to peer connection
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      if (userVideo.current) {
        userVideo.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: caller || inputRoomId,
          candidate: event.candidate
        });
      }
    };

    return pc;
  };

  const generateRoomId = () => {
    if (!name.trim()) {
      alert("Please enter your name first!");
      return;
    }
    const id = uuidv4().slice(0, 8);
    setRoomId(id);
  };

  const copyRoomId = async () => {
    await navigator.clipboard.writeText(me);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const callUser = async () => {
    if (!name.trim()) {
      alert("Please enter your name first!");
      return;
    }
    if (!inputRoomId.trim()) {
      alert("Please enter a Room ID to join!");
      return;
    }
    
    setIsConnecting(true);
    
    try {
      // Create peer connection
      peerConnection.current = createPeerConnection();
      
      // Create offer
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      
      // Send offer through socket
      socket.emit("callUser", {
        to: inputRoomId,
        signal: offer,
        from: me,
        name: name
      });
    } catch (error) {
      console.error("Error calling user:", error);
      setIsConnecting(false);
    }
  };

  const answerCall = async () => {
    try {
      setCallAccepted(true);
      setReceivingCall(false);
      
      // Create peer connection
      peerConnection.current = createPeerConnection();
      
      // Set remote description with the offer
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(callerSignal));
      
      // Create answer
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      
      // Send answer through socket
      socket.emit("answerCall", {
        signal: answer,
        to: caller,
        name: name
      });
      
      setOtherUserName(callerName);
    } catch (error) {
      console.error("Error answering call:", error);
    }
  };

  const leaveCall = () => {
    setCallEnded(true);
    
    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    // Reset states
    setCallAccepted(false);
    setReceivingCall(false);
    setOtherUserName("");
    setIsConnecting(false);
    setCaller("");
    setCallerSignal(null);
    setCallerName("");
    
    // Reload page to reset everything
    window.location.reload();
  };

  const declineCall = () => {
    setReceivingCall(false);
    setCaller("");
    setCallerSignal(null);
    setCallerName("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📹 Video Call Room
          </h1>
          <p className="text-gray-600">Connect with friends instantly</p>
        </div>

        {/* Name Input Section */}
        <div className="mb-8">
          <div className="flex flex-col items-center space-y-4">
            <input
              className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-200 text-center text-lg"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            
            {!roomId ? (
              <button
                onClick={generateRoomId}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold px-8 py-3 rounded-lg transform transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
              >
                🎯 Create Room
              </button>
            ) : (
              <div className="text-center space-y-3">
                <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Your Room ID:</p>
                  <p className="text-2xl font-mono font-bold text-blue-600 break-all">{me}</p>
                </div>
                <button
                  onClick={copyRoomId}
                  className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 ${
                    copied 
                      ? 'bg-green-500 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {copied ? '✅ Copied!' : '📋 Copy Room ID'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Join Room Section */}
        <div className="mb-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-full max-w-md">
              <input
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors duration-200 text-center text-lg"
                placeholder="Enter Room ID to join"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
              />
            </div>
            
            <button
              onClick={callUser}
              disabled={isConnecting}
              className={`font-semibold px-8 py-3 rounded-lg transform transition-all duration-200 shadow-lg ${
                isConnecting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 hover:scale-105 active:scale-95 text-white'
              }`}
            >
              {isConnecting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Connecting...</span>
                </div>
              ) : (
                '🚀 Join Call'
              )}
            </button>
          </div>
        </div>

        {/* Video Section */}
        {stream && (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* My Video */}
              <div className="relative">
                <video
                  ref={myVideo}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-64 bg-gray-900 rounded-lg shadow-lg object-cover"
                />
                <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium">
                  👤 {name || 'You'}
                </div>
              </div>

              {/* Other User's Video */}
              {callAccepted && !callEnded && (
                <div className="relative animate-in fade-in duration-500">
                  <video
                    ref={userVideo}
                    autoPlay
                    playsInline
                    className="w-full h-64 bg-gray-900 rounded-lg shadow-lg object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium">
                    👤 {otherUserName || callerName || 'Other User'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Call Controls */}
        {callAccepted && !callEnded && (
          <div className="text-center mb-4">
            <button
              onClick={leaveCall}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold px-8 py-3 rounded-lg transform transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
            >
              📞 Leave Call
            </button>
          </div>
        )}

        {/* Incoming Call Modal */}
        {receivingCall && !callAccepted && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center animate-in zoom-in duration-300">
              <div className="text-6xl mb-4">📞</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Incoming Call</h3>
              <p className="text-gray-600 mb-6">
                <strong>{callerName}</strong> is calling you...
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={answerCall}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 rounded-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  ✅ Answer
                </button>
                <button
                  onClick={declineCall}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 rounded-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  ❌ Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {callAccepted && !callEnded && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Connected with {otherUserName || callerName}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;