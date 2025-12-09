
export interface LyricsLine {
  time: number; // seconds
  text: string;
}

export interface LyricSearchResult {
  id: string;
  sourceName: string; // e.g. "Studio Album Version", "Genius", "Musixmatch"
  isSynced: boolean;
  preview: string; // Short preview of the text
}

export interface Song {
  id: string;
  file?: File; // Web Mode: The actual file object
  fileHandle?: FileSystemFileHandle; // Web Mode: FileSystemHandle
  path?: string; // Native Mode: Full path to file (e.g. C:\Music\song.mp3)
  title: string;
  artist: string;
  album: string;
  genre?: string; // Added genre support
  year?: string; // Added for sorting albums
  duration: number;
  coverUrl?: string; // Legacy/Cache: Keep for small usage or immediate display
  hasCover?: boolean; // Optimization: If true, fetch image from 'images' store in DB
  lyrics?: LyricsLine[];
  isSyncedFromMetadata?: boolean;
  color?: string;
  description?: string; // New field for persisting Wikipedia info
  addedAt?: number; // Timestamp for Recently Added sorting
}

// --- SMART PLAYLISTS ---
export type PlaylistRuleOperator = 'equals' | 'contains' | 'gt' | 'lt';
export type PlaylistRuleField = 'title' | 'artist' | 'album' | 'genre' | 'year';

export interface PlaylistRule {
  id: string;
  field: PlaylistRuleField;
  operator: PlaylistRuleOperator;
  value: string;
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  songIds: string[]; // NORMALIZED: Stores IDs for manual playlists
  rules?: PlaylistRule[]; // If present, this is a Smart Playlist
  createdAt: number;
  // Ephemeral / Auto-generated properties
  expiresAt?: number; // Timestamp when this playlist should be auto-deleted
  isGenerated?: boolean; // Flag to identify auto-created lists
}

export interface ArtistMetadata {
  name: string;
  bio: string;
  imageUrl: string;
  images?: string[]; // Array of background fanart images
  source: string;
  lastUpdated: number;
}

export interface AlbumMetadata {
  id: string; // Composite key: artist_album
  artist: string;
  title: string;
  coverUrl?: string;
  description?: string;
}

export enum PlaybackState {
  PAUSED,
  PLAYING,
  LOADING
}

export enum ViewMode {
  LIBRARY, // Home
  ARTISTS,
  ALBUMS,
  GENRES, 
  PLAYLISTS, // New View
  PLAYLIST_DETAIL, // New View
  PLAYER_FULL,
  SEARCH,
  RECENTLY_ADDED_LIST,
  QUEUE_ADD, // New View for adding songs to queue
  PARTY // New Party Mode
}

// Global Window Extensions for Electron and File System API
export interface ElectronAPI {
  selectFolder: () => Promise<{ rootPath: string, songs: any[] }>; // Modified return signature
  scanDirectory: (path: string) => Promise<any[]>; // New method for auto-scan
  selectImageFolder: () => Promise<string[]>; // NEW: Returns array of image file paths
  parseMetadata: (filePath: string) => Promise<any>;
  writeMetadata: (filePath: string, metadata: any) => Promise<boolean>; // ADDED
  isElectron: boolean;
  // Media Control Listeners
  onGlobalPlayPause: (callback: () => void) => void;
  onGlobalNext: (callback: () => void) => void;
  onGlobalPrev: (callback: () => void) => void;
  // Status Broadcaster
  setThumbarState: (isPlaying: boolean) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    jsmediatags?: any;
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}
