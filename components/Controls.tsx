import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize } from 'lucide-react';

interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  currentTime: number;
  duration: number;
  visible: boolean;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlayPause,
  onSeek,
  currentTime,
  duration,
  visible
}) => {
  return (
    <div
      className={`absolute inset-0 bg-black/60 flex flex-col justify-end p-4 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Progress Bar */}
      <div className="w-full mb-4">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
        <div className="flex justify-between text-xs text-gray-300 mt-1 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => onSeek(currentTime - 10)} className="text-white hover:text-brand-400 transition-colors">
            <SkipBack size={24} />
          </button>
          
          <button 
            onClick={onPlayPause}
            className="bg-white text-black rounded-full p-3 hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </button>

          <button onClick={() => onSeek(currentTime + 10)} className="text-white hover:text-brand-400 transition-colors">
            <SkipForward size={24} />
          </button>
        </div>

        <div className="flex items-center gap-4">
            <div className="px-2 py-1 bg-brand-900/80 rounded border border-brand-500/30 text-xs text-brand-200">
                LIVE SYNC
            </div>
        </div>
      </div>
    </div>
  );
};