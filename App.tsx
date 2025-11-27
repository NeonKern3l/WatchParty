import React, { useState, useEffect, useCallback } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { Chat } from './components/Chat';
import { Controls } from './components/Controls';
import { VideoSource, VideoSourceType, ChatMessage, User, SyncedPartyState } from './types';
import { Film, Link as LinkIcon, Upload, Users, PlayCircle, MessageSquare, X, ArrowRight, Copy, LogOut } from 'lucide-react';

const SAMPLE_VIDEOS = [
  {
    name: 'Big Buck Bunny',
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    type: VideoSourceType.DIRECT_URL
  },
  {
    name: 'Lofi Girl (YouTube)',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    type: VideoSourceType.YOUTUBE
  }
];

// -- Views --
type ViewState = 'AUTH' | 'LOBBY' | 'ROOM';

function App() {
  // -- App State --
  const [view, setView] = useState<ViewState>('AUTH');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [partyCode, setPartyCode] = useState<string | null>(null);
  
  // -- Room State (Synced) --
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  
  // -- Player State --
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekRequest, setSeekRequest] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  
  // -- UI State --
  const [activeTab, setActiveTab] = useState<'video' | 'chat'>('video');
  const [urlInput, setUrlInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [controlsTimeout, setControlsTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [joinError, setJoinError] = useState('');

  // ---------------------------------------------------------------------------
  // SYNC SERVICE (Simulated Backend via LocalStorage)
  // ---------------------------------------------------------------------------

  const updateSyncedState = (newState: Partial<SyncedPartyState>) => {
    if (!partyCode) return;
    const key = `syncstream_party_${partyCode}`;
    const currentStored = localStorage.getItem(key);
    const currentState = currentStored ? JSON.parse(currentStored) : {};
    
    const updated = {
      ...currentState,
      ...newState,
      partyCode,
      lastUpdateTimestamp: Date.now()
    };
    
    localStorage.setItem(key, JSON.stringify(updated));
    // Trigger local update immediately for the sender
    syncStateFromStorage(updated);
  };

  const syncStateFromStorage = useCallback((state: SyncedPartyState) => {
    if (state.videoSource) setVideoSource(state.videoSource);
    if (state.isPlaying !== undefined) setIsPlaying(state.isPlaying);
    // Only seek if difference is significant to avoid stutter
    if (state.currentTime && Math.abs(state.currentTime - currentTime) > 2) {
       setSeekRequest(state.currentTime);
    }
    if (state.users) setUsers(state.users);
    if (state.messages) setMessages(state.messages);
  }, [currentTime]);

  // Listen for storage events (updates from other tabs)
  useEffect(() => {
    if (view !== 'ROOM' || !partyCode) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `syncstream_party_${partyCode}` && e.newValue) {
        const state = JSON.parse(e.newValue) as SyncedPartyState;
        syncStateFromStorage(state);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Initial Load
    const initial = localStorage.getItem(`syncstream_party_${partyCode}`);
    if (initial) syncStateFromStorage(JSON.parse(initial));

    return () => window.removeEventListener('storage', handleStorageChange);
  }, [view, partyCode, syncStateFromStorage]);

  // Heartbeat / Polling for robustness (in case storage event misses)
  useEffect(() => {
    if (view !== 'ROOM' || !partyCode) return;
    const interval = setInterval(() => {
        const raw = localStorage.getItem(`syncstream_party_${partyCode}`);
        if (raw) syncStateFromStorage(JSON.parse(raw));
    }, 2000);
    return () => clearInterval(interval);
  }, [view, partyCode, syncStateFromStorage]);

  // ---------------------------------------------------------------------------
  // AUTH & LOBBY LOGIC
  // ---------------------------------------------------------------------------

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: nameInput.trim()
    };
    setCurrentUser(user);
    setView('LOBBY');
  };

  const createParty = () => {
    if (!currentUser) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const initialState: SyncedPartyState = {
      partyCode: code,
      hostId: currentUser.id,
      videoSource: null,
      isPlaying: false,
      currentTime: 0,
      lastUpdateTimestamp: Date.now(),
      users: [{ ...currentUser, isHost: true }],
      messages: [{
        id: 'sys_init',
        sender: 'System',
        text: `Party created! Code: ${code}`,
        timestamp: Date.now(),
        isSystem: true
      }]
    };
    localStorage.setItem(`syncstream_party_${code}`, JSON.stringify(initialState));
    setPartyCode(code);
    setUsers(initialState.users);
    setMessages(initialState.messages);
    setView('ROOM');
  };

  const joinParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !joinCodeInput.trim()) return;
    
    const code = joinCodeInput.trim().toUpperCase();
    const raw = localStorage.getItem(`syncstream_party_${code}`);
    
    if (!raw) {
      setJoinError("Party not found. Check the code.");
      return;
    }

    const state = JSON.parse(raw) as SyncedPartyState;
    const updatedUsers = [...state.users, currentUser];
    
    // Announce join
    const joinMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'System',
      text: `${currentUser.name} joined the party.`,
      timestamp: Date.now(),
      isSystem: true
    };

    const newState = {
      ...state,
      users: updatedUsers,
      messages: [...state.messages, joinMsg]
    };
    
    localStorage.setItem(`syncstream_party_${code}`, JSON.stringify(newState));
    setPartyCode(code);
    setView('ROOM');
  };

  // ---------------------------------------------------------------------------
  // ROOM LOGIC
  // ---------------------------------------------------------------------------

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newSource = {
        type: VideoSourceType.FILE,
        url,
        name: file.name
      };
      setVideoSource(newSource);
      updateSyncedState({ 
        videoSource: newSource,
        isPlaying: false,
        currentTime: 0,
        messages: [...messages, { id: Date.now().toString(), sender: 'System', text: `Changed video to ${file.name}`, timestamp: Date.now(), isSystem: true }]
      });
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    
    let type = VideoSourceType.DIRECT_URL;
    if (urlInput.includes('youtube.com') || urlInput.includes('youtu.be')) {
      type = VideoSourceType.YOUTUBE;
    }

    const newSource = { type, url: urlInput, name: 'Streamed Video' };
    setVideoSource(newSource);
    setUrlInput('');
    updateSyncedState({ 
      videoSource: newSource,
      isPlaying: false,
      currentTime: 0,
      messages: [...messages, { id: Date.now().toString(), sender: 'System', text: `Loaded video from URL`, timestamp: Date.now(), isSystem: true }]
    });
  };

  const joinSample = (sample: typeof SAMPLE_VIDEOS[0]) => {
    setVideoSource(sample);
    updateSyncedState({ 
      videoSource: sample,
      isPlaying: false,
      currentTime: 0,
      messages: [...messages, { id: Date.now().toString(), sender: 'System', text: `Loaded ${sample.name}`, timestamp: Date.now(), isSystem: true }]
    });
  };

  const handleSendMessage = (text: string) => {
    if (!currentUser) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: currentUser.name,
      text,
      timestamp: Date.now()
    };
    // Optimistic update
    const newMessages = [...messages, msg];
    setMessages(newMessages);
    updateSyncedState({ messages: newMessages });
  };

  const handleAiResponse = (text: string) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'Gemini AI',
      text,
      timestamp: Date.now(),
      isAi: true
    };
    const newMessages = [...messages, msg];
    setMessages(newMessages);
    updateSyncedState({ messages: newMessages });
  };

  // ---------------------------------------------------------------------------
  // PLAYER HANDLERS
  // ---------------------------------------------------------------------------

  const togglePlay = () => {
    const newStatus = !isPlaying;
    setIsPlaying(newStatus);
    updateSyncedState({ 
      isPlaying: newStatus, 
      currentTime, // Sync time on pause/play to prevent drift
      messages: [...messages, { id: Date.now().toString(), sender: 'System', text: newStatus ? 'Resumed video' : 'Paused video', timestamp: Date.now(), isSystem: true }]
    });
    resetControlsTimer();
  };

  const handleSeek = (time: number) => {
    setSeekRequest(time);
    setCurrentTime(time);
    updateSyncedState({ currentTime: time });
    resetControlsTimer();
    setTimeout(() => setSeekRequest(null), 100);
  };

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    const timeout = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
    setControlsTimeout(timeout);
  };

  const handleScreenClick = () => {
    setShowControls(prev => !prev);
    if (!showControls) resetControlsTimer();
  };

  const leaveParty = () => {
    setVideoSource(null);
    setPartyCode(null);
    setMessages([]);
    setUsers([]);
    setView('LOBBY');
  };

  // ---------------------------------------------------------------------------
  // RENDERING
  // ---------------------------------------------------------------------------

  if (view === 'AUTH') {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          <div className="space-y-4">
             <div className="w-20 h-20 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-brand-500/20 rotate-3">
              <PlayCircle size={48} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-200">
              SyncStream
            </h1>
            <p className="text-gray-400">Watch movies together, perfectly synced.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 pt-6">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Enter your display name" 
                className="w-full bg-dark-900 border border-dark-800 text-white rounded-xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder-gray-600 text-center text-lg"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={12}
              />
            </div>
            <button 
              type="submit"
              disabled={!nameInput.trim()}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              Get Started <ArrowRight size={20} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'LOBBY') {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center text-brand-300 font-bold">
                {currentUser?.name[0]}
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Welcome back</p>
                <h2 className="text-white font-semibold">{currentUser?.name}</h2>
              </div>
            </div>
            <button onClick={() => setView('AUTH')} className="text-gray-500 hover:text-white transition-colors">
              <LogOut size={20} />
            </button>
          </div>

          <div className="bg-gradient-to-br from-brand-900/50 to-dark-900 p-8 rounded-2xl border border-brand-500/20 text-center space-y-4">
            <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto text-brand-400 mb-2">
              <Users size={32} />
            </div>
            <h3 className="text-xl font-bold text-white">Create a Party</h3>
            <p className="text-sm text-gray-400">Start a new room and invite your friends with a unique code.</p>
            <button 
              onClick={createParty}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-brand-900/50"
            >
              Create New Party
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-dark-800"></div>
            <span className="flex-shrink-0 mx-4 text-gray-600 text-xs uppercase">Or join existing</span>
            <div className="flex-grow border-t border-dark-800"></div>
          </div>

          <form onSubmit={joinParty} className="space-y-3">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="ENTER CODE" 
                className="flex-1 bg-dark-900 border border-dark-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase tracking-widest text-center font-mono"
                value={joinCodeInput}
                onChange={(e) => {
                  setJoinCodeInput(e.target.value.toUpperCase());
                  setJoinError('');
                }}
                maxLength={6}
              />
              <button 
                type="submit"
                disabled={joinCodeInput.length < 4}
                className="bg-dark-800 hover:bg-dark-700 text-white px-6 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Join
              </button>
            </div>
            {joinError && <p className="text-red-400 text-xs text-center">{joinError}</p>}
          </form>
        </div>
      </div>
    );
  }

  // ROOM VIEW
  return (
    <div className="h-full flex flex-col md:flex-row bg-black overflow-hidden animate-in fade-in duration-500">
      
      {/* Video Area */}
      <div 
        className={`relative flex-1 bg-black flex items-center justify-center group ${activeTab === 'chat' ? 'hidden md:flex' : 'flex'}`}
        onClick={handleScreenClick}
      >
        {videoSource ? (
          <VideoPlayer
            source={videoSource}
            isPlaying={isPlaying}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            onEnded={() => {
              setIsPlaying(false);
              updateSyncedState({ isPlaying: false });
            }}
            seekTo={seekRequest}
          />
        ) : (
          <div className="text-center p-8 max-w-lg">
            <div className="w-20 h-20 bg-dark-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <Film size={32} className="text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ready to Watch?</h2>
            <p className="text-gray-400 mb-8">Load a video or choose a sample to start synchronizing with friends.</p>
            
            <div className="space-y-4">
               {/* URL Input */}
              <form onSubmit={handleUrlSubmit} className="relative group">
                <input 
                  type="text" 
                  placeholder="Paste YouTube or Video Link..." 
                  className="w-full bg-dark-900/80 border border-dark-800 text-white rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder-gray-600 text-sm"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onClick={(e) => e.stopPropagation()} 
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-brand-600 rounded-lg text-white hover:bg-brand-500">
                  <ArrowRight size={16} />
                </button>
              </form>
              
              <div className="grid grid-cols-2 gap-3">
                 <label className="flex items-center justify-center gap-2 p-3 bg-dark-900 hover:bg-dark-800 rounded-xl cursor-pointer transition-colors border border-dark-800 hover:border-gray-700" onClick={e => e.stopPropagation()}>
                    <Upload size={16} className="text-brand-400" />
                    <span className="text-sm text-gray-300">Upload File</span>
                    <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
                 </label>
                 {SAMPLE_VIDEOS.map(sample => (
                  <button
                    key={sample.name}
                    onClick={(e) => { e.stopPropagation(); joinSample(sample); }}
                    className="p-3 text-sm bg-dark-900 hover:bg-dark-800 text-gray-300 rounded-xl transition-colors border border-dark-800 hover:border-gray-700 truncate"
                  >
                    {sample.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">* For local files, all users must select the same file.</p>
            </div>
          </div>
        )}

        <Controls 
          isPlaying={isPlaying} 
          onPlayPause={togglePlay} 
          onSeek={handleSeek} 
          currentTime={currentTime} 
          duration={duration} 
          visible={showControls && !!videoSource}
        />
        
        {/* Header Overlay */}
        <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-20 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex justify-between items-start">
             <div className="flex items-center gap-4">
               <button onClick={leaveParty} className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-white transition-colors">
                  <ArrowRight size={20} className="rotate-180" />
               </button>
               <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-white font-bold drop-shadow-md text-lg">{videoSource?.name || 'Waiting for video...'}</h1>
                    <span className="px-2 py-0.5 rounded bg-brand-900/80 border border-brand-500/30 text-[10px] text-brand-300 font-mono tracking-widest flex items-center gap-1">
                      {partyCode} <Copy size={10} className="cursor-pointer hover:text-white" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(partyCode || ''); }} />
                    </span>
                  </div>
                 <div className="flex items-center gap-2 mt-1">
                   <div className="flex -space-x-2">
                     {users.map(u => (
                       <div key={u.id} className="w-6 h-6 rounded-full bg-brand-600 ring-2 ring-black flex items-center justify-center text-[10px] font-bold text-white uppercase" title={u.name}>
                         {u.name[0]}
                       </div>
                     ))}
                   </div>
                   <span className="text-xs text-gray-300 drop-shadow-md">{users.length} online</span>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`md:w-80 lg:w-96 bg-dark-950 border-l border-dark-800 flex flex-col ${activeTab === 'video' ? 'hidden md:flex' : 'flex h-full'}`}>
        {currentUser && (
          <Chat
            messages={messages}
            currentUser={currentUser}
            onSendMessage={handleSendMessage}
            onSendAiMessage={handleAiResponse}
            mediaName={videoSource?.name || 'Waiting Room'}
          />
        )}
      </div>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden flex h-16 bg-dark-950 border-t border-dark-800 shrink-0 z-50">
        <button 
          onClick={() => setActiveTab('video')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeTab === 'video' ? 'text-brand-400' : 'text-gray-500'}`}
        >
          <Film size={20} />
          <span className="text-xs font-medium">Watch</span>
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeTab === 'chat' ? 'text-brand-400' : 'text-gray-500'}`}
        >
          <div className="relative">
            <MessageSquare size={20} />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-500 rounded-full border-2 border-dark-950"></span>
            )}
          </div>
          <span className="text-xs font-medium">Chat</span>
        </button>
      </div>
    </div>
  );
}

export default App;