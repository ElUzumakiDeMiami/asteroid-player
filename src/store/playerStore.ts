import { create } from 'zustand';
import { Song, Playlist, AlbumMetadata } from '../types';
import { setFilterGain } from '../services/audioBase';

export type SortOption = 
    | 'added_desc' | 'added_asc' 
    | 'title_asc' | 'title_desc' 
    | 'artist_asc' | 'artist_desc' 
    | 'album_asc' | 'album_desc'
    | 'year_desc' | 'year_asc';

// EQ Presets
export const EQ_PRESETS: Record<string, number[]> = {
    'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Bass Boost': [5, 4, 3, 2, 0, 0, 0, 0, 0, 0],
    'Classical': [0, 0, 0, 0, 0, 0, -2, -3, -3, -4],
    'Dance': [4, 6, 2, 0, 0, 0, 2, 3, 4, 5],
    'Pop': [-2, -1, 0, 2, 3, 3, 1, -1, -1, -1],
    'Rock': [4, 3, 1, 0, -1, -1, 1, 3, 4, 5],
    'Vocal': [-2, -3, -2, 1, 4, 5, 4, 2, 0, -1]
};

// Helper to migrate old sort values
const getInitialSort = (): SortOption => {
    const saved = localStorage.getItem('lib_sort');
    if (saved === 'title') return 'title_asc';
    if (saved === 'artist') return 'artist_asc';
    if (saved === 'album') return 'album_asc';
    if (saved === 'added') return 'added_desc';
    // Return saved if it matches new types, else default
    return (saved as SortOption) || 'added_desc';
};

// 1. LIBRARY STORE: Data Source of Truth
interface LibraryState {
  library: Song[];
  setLibrary: (songs: Song[] | ((prev: Song[]) => Song[])) => void;
  
  playlists: Playlist[];
  setPlaylists: (playlists: Playlist[] | ((prev: Playlist[]) => Playlist[])) => void;
  
  albumMetadata: Record<string, AlbumMetadata>;
  setAlbumMetadata: (meta: Record<string, AlbumMetadata> | ((prev: Record<string, AlbumMetadata>) => Record<string, AlbumMetadata>)) => void;
  
  recentlyPlayed: Song[];
  addRecentlyPlayed: (song: Song) => void;
  
  librarySortOption: SortOption;
  setLibrarySortOption: (opt: SortOption) => void;
  
  // Actions
  deleteSongFromLibrary: (songId: string) => void;
  updateSongInLibrary: (originalId: string, newSong: Song) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  library: [],
  setLibrary: (val) => set((state) => ({ 
      library: typeof val === 'function' ? val(state.library) : val 
  })),
  
  playlists: [],
  setPlaylists: (val) => set((state) => ({
      playlists: typeof val === 'function' ? val(state.playlists) : val
  })),
  
  albumMetadata: {},
  setAlbumMetadata: (val) => set((state) => ({
      albumMetadata: typeof val === 'function' ? val(state.albumMetadata) : val
  })),
  
  recentlyPlayed: [],
  addRecentlyPlayed: (song) => set((state) => {
      const filtered = state.recentlyPlayed.filter(s => s.id !== song.id);
      return { recentlyPlayed: [song, ...filtered].slice(0, 10) };
  }),
  
  librarySortOption: getInitialSort(),
  setLibrarySortOption: (opt) => {
      localStorage.setItem('lib_sort', opt);
      set({ librarySortOption: opt });
  },

  deleteSongFromLibrary: (songId) => set((state) => ({
      library: state.library.filter(s => s.id !== songId),
      playlists: state.playlists.map(p => ({
          ...p,
          songIds: p.songIds.filter(id => id !== songId) // IDs only now
      })),
      recentlyPlayed: state.recentlyPlayed.filter(s => s.id !== songId)
  })),

  updateSongInLibrary: (originalId, newSong) => set((state) => ({
      library: state.library.map(s => s.id === originalId ? newSong : s)
  }))
}));


// 2. PLAYER STORE: UI & Playback State
interface PlayerState {
  // Queue State
  queue: Song[];
  originalQueue: Song[];
  queueTitle: string;
  setQueueTitle: (title: string) => void;
  currentIndex: number | null;
  setQueue: (songs: Song[], title?: string) => void;
  setOriginalQueue: (songs: Song[]) => void;
  setCurrentIndex: (index: number | null) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  addToQueue: (song: Song) => void;
  playNext: (song: Song) => void;
  clearQueue: () => void;
  bulkAddToQueue: (songs: Song[], mode: 'NEXT' | 'END') => void;
  
  // Actions
  deleteSongFromQueue: (songId: string) => void;
  updateSongInQueue: (originalId: string, newSong: Song) => void;

  // Playback State
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  
  // Progress Persistence
  songProgress: Record<string, number>;
  saveLastPosition: (id: string, time: number) => void;
  consumeSongProgress: (id: string) => void;
  
  // Permission Handling
  permissionErrorSong: Song | null;
  setPermissionErrorSong: (song: Song | null) => void;

  // Modes
  isShuffled: boolean;
  toggleShuffle: () => void;
  repeatMode: 'OFF' | 'ALL' | 'ONE';
  toggleRepeat: () => void;

  // Theme
  isDynamicTheme: boolean;
  setIsDynamicTheme: (val: boolean) => void;
  accentColor: string;
  setAccentColor: (val: string) => void;
  // New: Color History
  colorHistory: string[];
  addColorToHistory: (color: string) => void;
  removeColorFromHistory: (color: string) => void;

  // New: Local Images (Party Mode)
  localImageMap: Record<string, string[]>;
  setLocalImageMap: (map: Record<string, string[]>) => void;

  // Equalizer
  eqBands: number[]; 
  setEqBand: (index: number, value: number) => void;
  setEqBands: (bands: number[]) => void; // New bulk update
  setEqPreset: (presetName: string) => void;

  // Visualizer
  analyser: AnalyserNode | null;
  setAnalyser: (analyser: AnalyserNode | null) => void;

  // UI STATE (Player Overlay)
  isFullScreenPlayer: boolean;
  setIsFullScreenPlayer: (isOpen: boolean) => void;
  
  // Party Mode (Global State)
  isPartyMode: boolean;
  setIsPartyMode: (isOn: boolean) => void;

  // Active Modal (Global)
  activeModal: 'none' | 'about' | 'fileInfo' | 'edit' | 'equalizer'; 
  setActiveModal: (modal: 'none' | 'about' | 'fileInfo' | 'edit' | 'equalizer') => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  originalQueue: [],
  queueTitle: "Queue",
  setQueueTitle: (title) => set({ queueTitle: title }),
  currentIndex: null,
  
  setQueue: (songs, title = "Queue") => set({ 
      queue: songs, 
      originalQueue: songs, 
      queueTitle: title,
      isShuffled: false 
  }),
  setOriginalQueue: (songs) => set({ originalQueue: songs }),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  
  reorderQueue: (startIndex, endIndex) => set((state) => {
      const result = Array.from(state.queue);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      let newIndex = state.currentIndex;
      if (state.currentIndex === startIndex) newIndex = endIndex;
      else if (state.currentIndex !== null && startIndex < state.currentIndex && endIndex >= state.currentIndex) newIndex = state.currentIndex - 1;
      else if (state.currentIndex !== null && startIndex > state.currentIndex && endIndex <= state.currentIndex) newIndex = state.currentIndex + 1;

      const newOriginal = state.isShuffled ? state.originalQueue : result;
      return { queue: result, currentIndex: newIndex, originalQueue: newOriginal };
  }),

  addToQueue: (song) => set((state) => ({
      queue: [...state.queue, song],
      originalQueue: [...state.originalQueue, song]
  })),

  playNext: (song) => set((state) => {
      if (state.currentIndex === null) {
          return { queue: [song], originalQueue: [song], currentIndex: 0 };
      }
      const newQueue = [...state.queue];
      newQueue.splice(state.currentIndex + 1, 0, song);

      const currentSong = state.queue[state.currentIndex];
      const originalIndex = state.originalQueue.findIndex(s => s.id === currentSong.id);
      let newOriginal = [...state.originalQueue];
      if (originalIndex !== -1) {
          newOriginal.splice(originalIndex + 1, 0, song);
      } else {
          newOriginal.push(song);
      }
      return { queue: newQueue, originalQueue: newOriginal };
  }),

  clearQueue: () => set((state) => {
      if (state.currentIndex !== null && state.queue[state.currentIndex]) {
          const current = state.queue[state.currentIndex];
          return { queue: [current], originalQueue: [current], currentIndex: 0 };
      }
      return {};
  }),

  bulkAddToQueue: (songs, mode) => set((state) => {
      if (mode === 'NEXT') {
          if (state.currentIndex === null) {
              return { queue: songs, originalQueue: songs, currentIndex: 0 };
          }
          const newQueue = [...state.queue];
          newQueue.splice(state.currentIndex + 1, 0, ...songs);
          
          const currentSong = state.queue[state.currentIndex];
          const originalIndex = state.originalQueue.findIndex(s => s.id === currentSong.id);
          let newOriginal = [...state.originalQueue];
          if (originalIndex !== -1) {
              newOriginal.splice(originalIndex + 1, 0, ...songs);
          } else {
              newOriginal.push(...songs);
          }
          return { queue: newQueue, originalQueue: newOriginal };
      } else {
          return { 
              queue: [...state.queue, ...songs], 
              originalQueue: [...state.originalQueue, ...songs] 
          };
      }
  }),

  deleteSongFromQueue: (songId) => set((state) => {
      const newQueue = state.queue.filter(s => s.id !== songId);
      const newOriginal = state.originalQueue.filter(s => s.id !== songId);
      
      let newIndex = state.currentIndex;
      if (state.currentIndex !== null && state.queue[state.currentIndex]?.id === songId) {
          newIndex = null; // Current playing song deleted
      } else if (state.currentIndex !== null) {
          // Re-calculate index based on current song ID
          const currentId = state.queue[state.currentIndex].id;
          newIndex = newQueue.findIndex(s => s.id === currentId);
      }

      return {
          queue: newQueue,
          originalQueue: newOriginal,
          currentIndex: newIndex,
          isPlaying: newIndex === null ? false : state.isPlaying
      };
  }),

  updateSongInQueue: (originalId, newSong) => set((state) => {
      const updateList = (list: Song[]) => list.map(s => s.id === originalId ? newSong : s);
      return {
          queue: updateList(state.queue),
          originalQueue: updateList(state.originalQueue)
      };
  }),

  // --- PLAYBACK ---
  isPlaying: false,
  setIsPlaying: (val) => set({ isPlaying: val }),
  
  volume: Number(localStorage.getItem('player_volume')) || 0.8,
  setVolume: (val) => {
      localStorage.setItem('player_volume', val.toString());
      set({ volume: val });
  },
  
  currentTime: 0,
  setCurrentTime: (val) => set({ currentTime: val }),
  duration: 0,
  setDuration: (val) => set({ duration: val }),

  songProgress: JSON.parse(localStorage.getItem('song_progress') || '{}'),
  saveLastPosition: (id, time) => set((state) => {
      const newProgress = { [id]: time };
      localStorage.setItem('song_progress', JSON.stringify(newProgress));
      return { songProgress: newProgress };
  }),
  consumeSongProgress: (id) => set((state) => {
      const newProgress = { ...state.songProgress };
      delete newProgress[id];
      localStorage.setItem('song_progress', JSON.stringify(newProgress));
      return { songProgress: newProgress };
  }),

  permissionErrorSong: null,
  setPermissionErrorSong: (song) => set({ permissionErrorSong: song }),

  isShuffled: false,
  toggleShuffle: () => set((state) => {
      if (state.currentIndex === null || state.queue.length === 0) return {};
      if (state.isShuffled) {
          const currentSong = state.queue[state.currentIndex];
          const originalIndex = state.originalQueue.findIndex(s => s.id === currentSong.id);
          return {
              isShuffled: false,
              queue: state.originalQueue,
              currentIndex: originalIndex !== -1 ? originalIndex : 0
          };
      } else {
          const currentSong = state.queue[state.currentIndex];
          const remaining = state.queue.filter(s => s.id !== currentSong.id);
          for (let i = remaining.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
          }
          return {
              isShuffled: true,
              queue: [currentSong, ...remaining],
              currentIndex: 0
          };
      }
  }),

  repeatMode: 'OFF',
  toggleRepeat: () => set((state) => {
      const modes: ('OFF' | 'ALL' | 'ONE')[] = ['OFF', 'ALL', 'ONE'];
      const nextIndex = (modes.indexOf(state.repeatMode) + 1) % modes.length;
      return { repeatMode: modes[nextIndex] };
  }),

  // --- THEME ---
  isDynamicTheme: (localStorage.getItem('theme_dynamic') !== 'false'),
  setIsDynamicTheme: (val) => {
      localStorage.setItem('theme_dynamic', String(val));
      set({ isDynamicTheme: val });
  },
  accentColor: localStorage.getItem('theme_color') || '168, 85, 247',
  setAccentColor: (val) => {
      localStorage.setItem('theme_color', val);
      set({ accentColor: val });
  },
  
  colorHistory: JSON.parse(localStorage.getItem('theme_history') || '[]'),
  addColorToHistory: (color) => set((state) => {
      // Add to beginning, remove duplicates, keep max 10
      const newHistory = [color, ...state.colorHistory.filter(c => c !== color)].slice(0, 10);
      localStorage.setItem('theme_history', JSON.stringify(newHistory));
      return { colorHistory: newHistory };
  }),
  removeColorFromHistory: (color) => set((state) => {
      const newHistory = state.colorHistory.filter(c => c !== color);
      localStorage.setItem('theme_history', JSON.stringify(newHistory));
      return { colorHistory: newHistory };
  }),

  // --- LOCAL IMAGES ---
  localImageMap: JSON.parse(localStorage.getItem('local_image_map') || '{}'),
  setLocalImageMap: (map) => {
      // Don't persist super massive maps in local storage if not needed, but for now it's fine
      // ideally these would be in IndexedDB if huge.
      localStorage.setItem('local_image_map', JSON.stringify(map));
      set({ localImageMap: map });
  },

  // --- EQUALIZER ---
  eqBands: JSON.parse(localStorage.getItem('eq_bands') || '[0,0,0,0,0,0,0,0,0,0]'),
  
  setEqBand: (index, value) => {
      const state = get();
      const newBands = [...state.eqBands];
      newBands[index] = value;
      setFilterGain(index, value);
      localStorage.setItem('eq_bands', JSON.stringify(newBands));
      set({ eqBands: newBands });
  },

  setEqBands: (bands) => {
      // Bulk update that persists everything
      bands.forEach((val, idx) => setFilterGain(idx, val));
      localStorage.setItem('eq_bands', JSON.stringify(bands));
      set({ eqBands: bands });
  },

  setEqPreset: (presetName) => {
      const values = EQ_PRESETS[presetName] || EQ_PRESETS['Flat'];
      values.forEach((val, idx) => setFilterGain(idx, val));
      localStorage.setItem('eq_bands', JSON.stringify(values));
      set({ eqBands: values });
  },

  analyser: null,
  setAnalyser: (val) => set({ analyser: val }),

  // --- UI STATES ---
  isFullScreenPlayer: false,
  setIsFullScreenPlayer: (val) => set({ isFullScreenPlayer: val }),
  
  isPartyMode: false,
  setIsPartyMode: (val) => set({ isPartyMode: val }),

  activeModal: 'none',
  setActiveModal: (modal) => set({ activeModal: modal }),
}));