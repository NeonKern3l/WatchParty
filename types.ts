export enum VideoSourceType {
  FILE = 'FILE',
  YOUTUBE = 'YOUTUBE',
  DIRECT_URL = 'DIRECT_URL',
}

export interface VideoSource {
  type: VideoSourceType;
  url: string; // Blob URL for file, or string URL for others
  name: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isAi?: boolean;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  isHost?: boolean;
}

export interface SyncedPartyState {
  partyCode: string;
  hostId: string;
  videoSource: VideoSource | null;
  isPlaying: boolean;
  currentTime: number;
  lastUpdateTimestamp: number; // To calculate drift/sync
  users: User[];
  messages: ChatMessage[];
}

export interface PartyState {
  isPlaying: boolean;
  currentTime: number; // in seconds
  duration: number; // in seconds
  playbackRate: number;
}