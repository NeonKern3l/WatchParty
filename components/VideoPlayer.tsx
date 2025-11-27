import React, { useRef, useEffect, useState } from 'react';
import { VideoSource, VideoSourceType } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface VideoPlayerProps {
  source: VideoSource;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
  seekTo: number | null; // Timestamp to seek to
}

const getYouTubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  source,
  isPlaying,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  seekTo
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null); // Google YT Iframe API object
  const [ytReady, setYtReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset error when source changes
  useEffect(() => {
    setError(null);
  }, [source]);

  // Handle Seek
  useEffect(() => {
    if (seekTo !== null) {
      if (source.type === VideoSourceType.YOUTUBE) {
        if (ytReady && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
          ytPlayerRef.current.seekTo(seekTo, true);
        }
      } else {
        if (videoRef.current) {
          videoRef.current.currentTime = seekTo;
        }
      }
    }
  }, [seekTo, source.type, ytReady]);

  // Handle Play/Pause
  useEffect(() => {
    if (source.type === VideoSourceType.YOUTUBE) {
      if (ytReady && ytPlayerRef.current && ytPlayerRef.current.playVideo) {
        if (isPlaying) ytPlayerRef.current.playVideo();
        else ytPlayerRef.current.pauseVideo();
      }
    } else {
      if (videoRef.current) {
        if (isPlaying) videoRef.current.play().catch(e => console.log("Autoplay prevented", e));
        else videoRef.current.pause();
      }
    }
  }, [isPlaying, source.type, ytReady]);

  // Setup YouTube API
  useEffect(() => {
    if (source.type === VideoSourceType.YOUTUBE) {
      const videoId = getYouTubeId(source.url);
      if (!videoId) {
        setError("Invalid YouTube URL");
        return;
      }

      const loadYT = () => {
        if (!window.YT) {
          const tag = document.createElement('script');
          tag.src = "https://www.youtube.com/iframe_api";
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
          
          window.onYouTubeIframeAPIReady = () => {
            initPlayer(videoId);
          };
        } else {
          initPlayer(videoId);
        }
      };

      const initPlayer = (id: string) => {
        // Destroy existing instance if any
        if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
          try {
            ytPlayerRef.current.destroy();
          } catch(e) { /* ignore */ }
        }

        // @ts-ignore
        ytPlayerRef.current = new window.YT.Player('yt-player', {
          height: '100%',
          width: '100%',
          videoId: id,
          playerVars: {
            'playsinline': 1,
            'controls': 0, // Hide default controls for sync feel
            'modestbranding': 1,
            'rel': 0,
            'origin': window.location.origin, // CRITICAL FIX for Error 135/150
            'enablejsapi': 1,
            'iv_load_policy': 3 // Hide annotations
          },
          events: {
            'onReady': () => setYtReady(true),
            'onStateChange': (event: any) => {
               if (event.data === window.YT.PlayerState.ENDED) {
                 onEnded();
               }
            },
            'onError': (e: any) => {
              console.error("YouTube Player Error:", e.data);
              let msg = "Error loading video.";
              if (e.data === 150 || e.data === 101) msg = "This video does not allow playback outside of YouTube.";
              else if (e.data === 135) msg = "Player configuration error. Try a different video.";
              setError(msg);
            }
          }
        });
      };

      loadYT();

      // Polling for time update on YT since it doesn't emit continuous events
      const interval = setInterval(() => {
        if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
          const time = ytPlayerRef.current.getCurrentTime();
          const duration = ytPlayerRef.current.getDuration();
          if (time) onTimeUpdate(time);
          if (duration) onDurationChange(duration);
        }
      }, 500);

      return () => {
        clearInterval(interval);
        // We generally don't destroy immediately on unmount to avoid flicker in some updates, 
        // but here it's cleaner.
      };
    }
  }, [source.type, source.url]);

  if (source.type === VideoSourceType.YOUTUBE) {
    return (
      <div className="w-full h-full bg-black relative flex items-center justify-center">
         {error ? (
          <div className="text-red-400 text-center p-4">
            <p className="font-bold">Playback Error</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="w-full h-full">
             <div id="yt-player" className="w-full h-full pointer-events-none" /> 
             {/* pointer-events-none prevents user from clicking YT native controls */}
             <div className="absolute inset-0 bg-transparent" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={source.url}
        playsInline
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
        onEnded={onEnded}
        onError={() => console.error("Video element error")}
      />
    </div>
  );
};