import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import io from 'socket.io-client';
import RideRequestForm from './components/RideRequestForm';

const API_URL = 'https://kgp-pooling.onrender.com';
const socket = io(API_URL);

const USER_DIRECTORY = {
  'user_avinash': { name: 'Avinash', phone: '+91 91234 56780' },
  'user_rahul': { name: 'Rahul', phone: '+91 99887 76655' },
  'user_priya': { name: 'Priya', phone: '+91 98765 43210' },
  'user_aman': { name: 'Aman', phone: '+91 91111 22222' }
};

const LiveTimer = ({ startTime }) => {
  const calculateTimeLeft = () => {
    const elapsed = Math.floor((new Date() - new Date(startTime)) / 1000);
    const left = 300 - elapsed; 
    return left > 0 ? left : 0;
  };
  
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  return <span className="font-mono">{mins}:{secs < 10 ? '0' : ''}{secs}</span>;
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('ride'); 
  const [rideToggle, setRideToggle] = useState('intents'); 
  
  const [myIntents, setMyIntents] = useState([]);
  const [myPools, setMyPools] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [chatMessage, setChatMessage] = useState("");
  const [liveMessages, setLiveMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'domain_restricted') {
      toast.error("Access Denied: Only @kgpian.iitkgp.ac.in accounts allowed!", { duration: 5000 });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/current_user`, { credentials: 'include' });
        if (res.ok) {
          const user = await res.json();
          if (user && user._id) setCurrentUser(user);
        }
      } catch (err) { console.log("Not logged in."); }
      finally { setIsCheckingAuth(false); }
    };
    checkAuth(); 
  }, []);

  const handleDevLogin = async (name, email, mobile, gender) => {
    try {
      const res = await fetch(`${API_URL}/auth/dev_login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, mobile, gender })
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        toast.success(`Sandbox Mode: Connected as ${name}`);
      }
    } catch (err) { toast.error("Sandbox authentication down."); }
  };

  const handleDevLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST' });
    setCurrentUser(null);
    setMyIntents([]);
    setMyPools([]);
    setActiveTab('ride');
    setRideToggle('intents');
  };

  const fetchDashboard = async () => {
    if (!currentUser?._id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/intents/dashboard?userId=${currentUser._id}`);
      if (res.ok) {
        const data = await res.json();
        setMyIntents(data.intents || []);
        setMyPools(data.pools || []);
      }
    } catch (err) { toast.error("Failed to sync network."); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'ride' && currentUser) fetchDashboard();
  }, [activeTab, rideToggle, currentUser]);

  const respondToPool = async (poolId, action) => {
    const toastId = toast.loading(action === 'interested' ? "Locking in..." : "Declining...");
    try {
      const res = await fetch(`${API_URL}/api/intents/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId, userId: currentUser._id, action })
      });
      if (res.ok) {
        toast.success(action === 'interested' ? "Locked In" : "Declined.", { id: toastId });
        fetchDashboard();
      }
    } catch (err) { toast.error("Failed action.", { id: toastId }); }
  };

  const activePool = myPools.find(p => p.status === 'confirmed');
  const interestedPool = myPools.find(p => p.acceptances?.includes(currentUser?._id));
  const displayPools = interestedPool ? [interestedPool] : (myPools.length > 0 ? [myPools[0]] : []);
  const hasActiveIntent = myIntents.length > 0;

  useEffect(() => {
    if (!activePool) return;

    socket.emit("join_room", activePool._id);

    const fetchDBMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/api/messages/${activePool._id}`);
        if (res.ok) {
          const dbMessages = await res.json();
          if (Array.isArray(dbMessages)) {
            const formatted = dbMessages.map(m => ({
              id: m._id,
              text: m.text,
              sender: m.senderName,
              time: new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            }));
            setLiveMessages(formatted);
          }
        }
      } catch (err) { console.error("Failed to load chat history"); }
    };
    fetchDBMessages();

    const receiveMessageHandler = (newMsg) => setLiveMessages((prev) => [...prev, newMsg]);
    const userTypingHandler = (name) => setTypingUser(name);
    const userStoppedTypingHandler = () => setTypingUser(null);

    socket.on("receive_message", receiveMessageHandler);
    socket.on("user_typing", userTypingHandler);
    socket.on("user_stopped_typing", userStoppedTypingHandler);

    return () => {
      socket.off("receive_message", receiveMessageHandler);
      socket.off("user_typing", userTypingHandler);
      socket.off("user_stopped_typing", userStoppedTypingHandler);
    };
  }, [activePool]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveMessages, typingUser, activeTab]);

  const handleTyping = (e) => {
    setChatMessage(e.target.value);
    if (!activePool) return;
    
    if (e.target.value.trim().length > 0) {
      socket.emit("typing", { room: activePool._id, name: currentUser.name });
    } else {
      socket.emit("stop_typing", activePool._id);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if(!chatMessage.trim() || !activePool) return;
    
    const msgText = chatMessage;
    setChatMessage(""); 

    const newMsg = { 
      id: Date.now(), 
      text: msgText, 
      sender: currentUser.name, 
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    };
    
    setLiveMessages((prev) => [...prev, newMsg]);
    socket.emit("send_message", { room: activePool._id, message: newMsg });
    socket.emit("stop_typing", activePool._id);
    
    const actualDepartureTime = activePool.intents?.find(i => typeof i === 'object' && i.departureTime)?.departureTime || new Date();

    try {
      await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: activePool._id,
          senderId: currentUser._id || currentUser.id,
          senderName: currentUser.name,
          text: msgText,
          rideDepartureTime: actualDepartureTime 
        })
      });
    } catch (err) {
      toast.error("Database sync failed, but message was sent.");
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})} at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  const renderRideScreen = () => (
    <div className="p-4 pb-24 pt-20">
      <div className="bg-slate-200 p-1 rounded-xl flex mb-6 shadow-inner">
        <button onClick={() => setRideToggle('intents')} className={`flex-1 py-2 font-bold rounded-lg transition-all text-sm ${rideToggle === 'intents' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Create Intent</button>
        <button onClick={() => setRideToggle('pools')} className={`flex-1 py-2 font-bold rounded-lg transition-all text-sm ${rideToggle === 'pools' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Suggested Pools</button>
      </div>

      {rideToggle === 'intents' ? (
        hasActiveIntent ? (
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-center shadow-sm">
            <h3 className="font-black text-amber-800 text-lg">Intent Already Active</h3>
            <p className="text-amber-700 text-sm font-medium mt-2 mb-4">You can only have one active travel intent at a time.</p>
            <button onClick={() => setRideToggle('pools')} className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold shadow-sm active:scale-95">View Suggested Pools</button>
          </div>
        ) : (
          <RideRequestForm currentUser={currentUser} refreshData={() => { fetchDashboard(); setRideToggle('pools'); }} />
        )
      ) : (
        <div className="space-y-8 animate-fade-in">
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 tracking-widest uppercase border-b border-slate-200 pb-2">My Active Intents</h3>
            {myIntents.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400 font-bold text-sm">No active travel requests.</div>
            ) : (
              myIntents.map(intent => (
                <div key={intent._id} className="bg-slate-900 p-5 rounded-2xl shadow-md text-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-black text-lg leading-tight">{intent.fromNode} ➔ <br/>{intent.toNode}</p>
                      <p className="text-emerald-400 font-bold text-sm mt-1">{formatDate(intent.departureTime)} ±{intent.flexibilityMinutes}m</p>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">Active</span>
                  </div>
                  {activePool || interestedPool ? (
                    <div className="w-full bg-slate-800 text-slate-400 py-3 rounded-xl text-center text-sm font-black shadow-sm opacity-50 cursor-not-allowed">Locked in Pool (Waiting for Match)</div>
                  ) : (
                    <button onClick={() => { fetchDashboard(); setMyIntents([]) }} className="w-full bg-red-500 text-white py-3 rounded-xl text-sm font-black hover:bg-red-600 transition shadow-sm active:scale-95">Cancel Ride Request</button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-slate-200 pb-2">
              <h3 className="text-xs font-black text-slate-400 tracking-widest uppercase">My Matches</h3>
              <button onClick={fetchDashboard} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 bg-slate-200 px-2 py-1 rounded-md">↻ Refresh Feed</button>
            </div>
            {isLoading ? (
              <p className="text-center font-bold text-slate-400 animate-pulse py-4">Syncing Matchmaker...</p>
            ) : displayPools.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                <span className="text-3xl mb-2 block">📡</span>
                <p className="text-slate-500 font-bold text-sm mt-2">Searching for others...</p>
              </div>
            ) : (
              displayPools.map(pool => {
                const safeStops = pool.uiStops || [];
                const safeIntents = pool.intents || [];
                const maxCap = pool.inferredVehicle === 'SUV' ? 4 : (pool.inferredVehicle === 'SEDAN' ? 3 : 4);

                return (
                  <div key={pool._id} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-xl relative transition-all">
                    <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🚖</span>
                        <div>
                          <h3 className="font-black text-slate-900 text-md">Suggested Route</h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider mb-1 ${pool.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : pool.status === 'gathering' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{pool.status}</span>
                        <p className="text-[10px] font-bold text-slate-500 uppercase"> Suggested Vehicle: {pool.inferredVehicle}</p>
                      </div>
                    </div>

                    <div className="mb-4 border-b border-slate-100 pb-4">
                      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:h-full before:w-0.5 before:bg-slate-100">
                        {safeStops.map((stop, index) => (
                          <div key={index} className="relative flex items-start gap-4">
                            <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 mt-1 ${index === safeStops.length - 1 ? 'bg-red-500' : index === 0 ? 'bg-emerald-500' : 'bg-slate-900'}`}></div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex-1">
                               <p className="text-xs font-black text-slate-900 mb-1">{stop}</p>
                               {safeIntents.filter(intent => typeof intent === 'object' && (intent.fromNode === stop || intent.toNode === stop)).map((b, i) => (
                                 <div key={i} className="text-[10px] font-bold text-slate-500 flex flex-col gap-0.5 mt-1">
                                    <div className="flex items-center gap-1">
                                      <span>{(USER_DIRECTORY[b.userId] || { name: 'Student' }).name} ({b.gender === 'male' ? 'M' : 'F'})</span>
                                      <span className="opacity-50">•</span>
                                      <span>{b.luggageSize === 'none' ? '📱' : b.luggageSize === 'backpack' ? '🎒' : '🧳'} {b.luggageSize}</span>
                                      {b.toNode === stop && <span className="ml-1 text-red-400 italic">(Drop-off)</span>}
                                    </div>
                                    <span className="text-[9px] text-emerald-600 font-bold">🕒 {formatDate(b.departureTime)} (±{b.flexibilityMinutes}m)</span>
                                 </div>
                               ))}
                               {index === 0 && <p className="text-[10px] font-bold text-emerald-500 mt-1">Origin</p>}
                               {index === safeStops.length - 1 && <p className="text-[10px] font-bold text-red-500 mt-1">Final Destination</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl mb-4">
                      <div><span className="block text-[9px] font-black text-slate-400 uppercase">Est. Fare</span><span className="text-sm font-black text-slate-900">₹{pool.metrics?.estimatedFarePerPerson || '--'}</span></div>
                      <div className="text-right"><span className="block text-[9px] font-black text-emerald-500 uppercase">Savings</span><span className="text-sm font-black text-emerald-600">+{pool.metrics?.savingsPercentage || '--'}%</span></div>
                    </div>

                    {pool.status === 'confirmed' ? (
                      <button onClick={() => setActiveTab('chat')} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black transition-all text-sm shadow-md animate-pulse">Open Group Chat</button>
                    ) : pool.acceptances?.includes(currentUser._id) ? (
                      <div className="w-full bg-blue-50 border border-blue-200 text-blue-800 py-4 rounded-xl font-bold text-center text-sm shadow-sm flex flex-col items-center gap-1">
                        <span>Waiting for Others... ({pool.acceptances?.length || 0} / {maxCap} Max Capacity)</span>
                        {pool.gatheringStartedAt && (
                          <span className="text-[10px] font-black bg-blue-200 px-2 py-1 rounded-md text-blue-900 mt-1 shadow-inner">
                            Auto-Confirm in <LiveTimer startTime={pool.gatheringStartedAt} />
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => respondToPool(pool._id, 'decline')} className="flex-1 bg-white text-slate-700 py-3 rounded-xl font-bold border border-slate-200 text-sm active:scale-95">Decline</button>
                        <button onClick={() => respondToPool(pool._id, 'interested')} className="flex-[2] bg-slate-900 text-white py-3 rounded-xl font-black shadow-md text-sm active:scale-95">Interested</button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderChatScreen = () => {
    const isCoordinator = activePool?.coordinator === currentUser?._id;
    const safeAcceptances = activePool?.acceptances || [];
    const safeStops = activePool?.uiStops || [];
    const safeIntents = activePool?.intents || [];

    return (
      <div className="flex flex-col h-full pt-16 bg-slate-50 relative pb-[70px]">
        <div className="bg-white border-b border-slate-200 p-4 shadow-sm z-10 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <button onClick={() => setActiveTab('ride')} className="mr-3 text-slate-500 hover:text-slate-900 active:scale-95 transition-all text-xl pb-1">←</button>
              <div>
                <h2 className="font-black text-slate-900 leading-tight">Confirmed Pool</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{activePool?.inferredVehicle || 'Vehicle'} • {safeAcceptances.length} Riders</span>
                  {isCoordinator && <span className="text-[8px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-black uppercase">You are Coordinator</span>}
                </div>
              </div>
            </div>
            <div className="bg-slate-100 p-2 rounded-lg text-center min-w-[70px]">
              <span className="block text-[8px] font-black text-slate-400 uppercase">Est. Fare</span>
              <span className="font-black text-slate-900 text-sm">₹{activePool?.metrics?.estimatedFarePerPerson || '--'}</span>
            </div>
          </div>

          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:h-full before:w-0.5 before:bg-slate-100 mb-2">
            {safeStops.map((stop, index) => (
              <div key={index} className="relative flex items-start gap-4">
                <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 mt-1 ${index === safeStops.length - 1 ? 'bg-red-500' : index === 0 ? 'bg-emerald-500' : 'bg-slate-900'}`}></div>
                <div className="flex-1">
                    <p className="text-[11px] font-black text-slate-900">{stop}</p>
                    {safeIntents.filter(intent => typeof intent === 'object' && (intent.fromNode === stop || intent.toNode === stop)).map((b, i) => (
                      <div key={i} className="text-[9px] font-bold text-slate-500 flex flex-col gap-0.5 mt-1">
                        <div className="flex items-center gap-1">
                          <span>{(USER_DIRECTORY[b.userId] || { name: 'Student' }).name} ({b.gender === 'male' ? 'M' : 'F'})</span>
                          <span className="opacity-50">•</span>
                          <span>{b.luggageSize === 'none' ? '📱' : b.luggageSize === 'backpack' ? '🎒' : '🧳'}</span>
                          <span className="opacity-50">•</span>
                          <span className="text-slate-700 tracking-wide">{(USER_DIRECTORY[b.userId] || {}).phone || ''}</span>
                          {b.toNode === stop && <span className="text-red-400 italic">(Drop)</span>}
                        </div>
                        <div className="text-emerald-600 font-medium">
                          🕒 {formatDate(b.departureTime)} (±{b.flexibilityMinutes}m)
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          <div className="text-center"><span className="bg-slate-200 text-slate-500 text-[9px] font-black uppercase px-3 py-1 rounded-full">Secure Live Chat</span></div>
          <div className="flex flex-col gap-1 items-start">
            <span className="text-[10px] font-bold text-slate-400 ml-2">System (Automated)</span>
            <div className="bg-emerald-100 border border-emerald-200 text-emerald-900 p-3 rounded-2xl rounded-tl-sm text-sm font-medium max-w-[85%] shadow-sm">
              You are locked into this ride. Coordinate pickups here!
            </div>
          </div>

          {(liveMessages || []).map(msg => (
            <div key={msg.id} className={`flex flex-col gap-1 ${msg.sender === currentUser.name ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-bold text-slate-400 mx-2">{msg.sender} • {msg.time}</span>
              <div className={`p-3 rounded-2xl text-sm font-medium max-w-[85%] shadow-sm ${msg.sender === currentUser.name ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          
          {typingUser && typingUser !== currentUser.name && (
             <div className="flex flex-col gap-1 items-start animate-fade-in">
                <span className="text-[10px] font-bold text-slate-400 ml-2">{typingUser} is typing...</span>
                <div className="bg-white border border-slate-100 text-slate-500 p-3 rounded-2xl rounded-tl-sm text-sm font-medium shadow-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="bg-white border-t border-slate-200 p-3 fixed bottom-[65px] w-full max-w-md flex gap-2 z-20 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
          <input type="text" value={chatMessage} onChange={handleTyping} placeholder="Message the pool..." className="flex-1 bg-slate-100 border-none rounded-full px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900" />
          <button type="submit" className="bg-emerald-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all">↑</button>
        </form>
      </div>
    );
  };

  const renderProfileScreen = () => (
    <div className="p-4 pb-24 pt-20 animate-fade-in">
      <h2 className="text-2xl font-black text-slate-900 mb-6">Profile</h2>
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-6 mb-6">
        <div className="flex items-center gap-5 pb-6 border-b border-slate-50">
          <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-inner">
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-xl leading-tight">{currentUser?.name}</h3>
            <p className="text-slate-500 text-xs font-bold mt-1">{currentUser?.email}</p>
            <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-md mt-2 uppercase tracking-widest">{currentUser?.rollNo || 'TEST_ACCOUNT'}</span>
          </div>
        </div>
        <div className="pt-6 space-y-4">
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mobile</span>
            <span className="text-sm font-black text-slate-900">{currentUser?.mobile}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gender</span>
            <span className="text-sm font-black text-slate-900 capitalize">{currentUser?.gender}</span>
          </div>
        </div>
      </div>
      <button onClick={handleDevLogout} className="w-full bg-red-50 text-red-600 border border-red-100 font-bold py-4 rounded-xl shadow-sm hover:bg-red-100 active:scale-95 transition-all">Sign Out</button>
    </div>
  );

  if (isCheckingAuth) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-400">Loading...</div>;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col items-center p-4 pt-16">
        <Toaster position="top-center" />
        <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center font-black text-white text-4xl mb-6 shadow-2xl mt-4 animate-fade-in">KGP</div>
        <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Pooling</h1>
        <p className="text-sm font-bold text-slate-500 mb-10">Smart Pooling for IIT KGP</p>

        <div className="w-full max-w-sm bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl mb-8">
          <h3 className="text-xs font-black text-slate-400 tracking-widest uppercase mb-4">Student Login</h3>
          <button 
            onClick={() => window.location.href = `${API_URL}/auth/google`} 
            className="w-full bg-slate-50 text-slate-900 py-4 rounded-xl font-black border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-sm"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>
          <p className="text-[10px] font-bold text-slate-400 mt-4">Requires @kgpian.iitkgp.ac.in email</p>
        </div>

        <div className="w-full max-w-sm bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 border-dashed">
          <h3 className="text-xs font-black text-indigo-400 tracking-widest uppercase mb-4">Test users</h3>
          <div className="space-y-2">
           <button onClick={() => handleDevLogin('Avinash', 'avinash@kgp.ac.in', '+91 91234 56780', 'male')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all text-sm">Test as Avinash </button>
            <button onClick={() => handleDevLogin('Rahul', 'rahul@kgp.ac.in', '+91 99887 76655', 'male')} className="w-full bg-indigo-100 text-indigo-800 py-3 rounded-xl font-bold active:scale-95 transition-all text-sm">Test as Rahul</button>
            <button onClick={() => handleDevLogin('Priya', 'priya@kgp.ac.in', '+91 98765 43210', 'female')} className="w-full bg-pink-100 text-pink-800 py-3 rounded-xl font-bold active:scale-95 transition-all text-sm">Test as Priya</button>
          </div>
        </div>
      </div>
    );
  }

  const isProfileComplete = currentUser.mobile && currentUser.gender && currentUser.rollNo;
  if (!isProfileComplete) {
    const handleCompleteProfile = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const updates = {
        userId: currentUser._id,
        mobile: formData.get('mobile'),
        gender: formData.get('gender'),
        rollNo: formData.get('rollNo')
      };
      
      const toastId = toast.loading("Saving Profile...");
      try {
        const res = await fetch(`${API_URL}/auth/complete-profile`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (res.ok) {
          const resData = await res.json();
          setCurrentUser(resData.user || { ...currentUser, ...updates });
          toast.success("Welcome to KGP-Pooling!", { id: toastId });
        }
      } catch (err) { toast.error("Failed to save onboarding details.", { id: toastId }); }
    };

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col p-4 pt-20 animate-fade-in">
        <Toaster position="top-center" />
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6 text-center shadow-sm">
          <h2 className="text-lg font-black text-amber-900 mb-1">Complete Your Profile</h2>
          <p className="text-xs font-bold text-amber-700">Provide registration details to unlock campus matchmaking.</p>
        </div>

        <form onSubmit={handleCompleteProfile} className="space-y-4 bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Roll Number</label>
            <input name="rollNo" required placeholder="e.g. 21CS100XX" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none uppercase" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mobile Number</label>
            <input name="mobile" required placeholder="+91" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gender</label>
            <select name="gender" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none">
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black shadow-md mt-4 active:scale-95 transition-all">Save & Enter App</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      <Toaster position="top-center" />
      
      {activeTab !== 'chat' && (
        <header className="absolute top-0 w-full max-w-md flex items-center gap-2 p-4 z-50 bg-slate-50/90 backdrop-blur-md border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center font-black text-white text-sm shadow-md">KGP</div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">Pooling</h1>
        </header>
      )}

      <main className="flex-1 overflow-y-auto w-full h-full relative">
        {activeTab === 'ride' && renderRideScreen()}
        {activeTab === 'chat' && renderChatScreen()}
        {activeTab === 'profile' && renderProfileScreen()}
      </main>

      {activeTab !== 'chat' && (
        <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-200 flex justify-around items-center pt-3 pb-6 px-2 z-50">
          {[{ id: 'ride', icon: '🚖', label: 'Ride' }, { id: 'chat', icon: '💬', label: 'Chats' }, { id: 'profile', icon: '👤', label: 'Profile' }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 w-20 transition-all ${activeTab === tab.id ? 'text-slate-900 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
              <span className={`text-2xl ${activeTab === tab.id ? 'opacity-100' : 'opacity-60 grayscale'}`}>{tab.icon}</span>
              <span className={`text-[10px] font-bold ${activeTab === tab.id ? 'text-slate-900' : 'text-slate-400'}`}>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export default App;