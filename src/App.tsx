
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Router, Switch, Route, useLocation } from 'wouter';
import { MusicPlayer } from './components/MusicPlayer';
import { Library } from './components/Library';
import { FullScreenPlayer, PlayerViewMode } from './components/FullScreenPlayer';
import { ArtistsView } from './components/ArtistsView';
import { ArtistDetailView } from './components/ArtistDetailView';
import { AlbumsView } from './components/AlbumsView';
import { GenresView } from './components/GenresView'; 
import { SearchView } from './components/SearchView';
import { RecentlyAddedView } from './components/RecentlyAddedView';
import { PlaylistsView } from './components/PlaylistsView';
import { PlaylistDetailView } from './components/PlaylistDetailView';
import { AudioController } from './components/AudioController';
import { PermissionRecoveryModal } from './components/PermissionRecoveryModal';
import { PartyMode } from './components/PartyMode';
import { EqualizerModal } from './components/EqualizerModal';

import { Song, Playlist, AlbumMetadata, ArtistMetadata } from './types';
import { parseFileMetadata, generateId, getAlbumId } from './services/metadataService';
import { loadSongsRange, selectDirectoryAndScan, isFileSystemAPISupported, updateSongMetadata, getPlaylists, savePlaylist, deletePlaylist, saveAlbumMetadata, loadAllAlbumsMetadata, migrateAddedAtTimestamps, saveArtistMetadata, saveSongsToStorage, deleteSongFromStorage, removeSongFromPlaylists, processEphemeralPlaylists, analyzeAndGenerateSmartPlaylists, scanLocalImageFolder, scanSavedLibrary } from './services/fileSystemService';
import { syncArtistLibrary, getSongWikiDescription, searchWikipedia, WikiSearchResult, getWikiPageContent, getAlbumDetails } from './services/artistDataService';
import { generateCuratedPlaylists } from './services/geminiService';
import { fuzzySearch } from './services/searchService';
import { Search, Menu, X, Loader2, Info, FolderSymlink, Download, Home, Mic2, Disc, Guitar, ListMusic, Plus, Save, Globe, RefreshCw, Filter, ChevronRight, ListPlus, Palette, Wand2, Camera, Settings, FolderOpen, Image as ImageIcon } from 'lucide-react';
import { extractDominantColor } from './services/colorService';

import { usePlayerStore, useLibraryStore } from './store/playerStore';
import { useAudioPlayer } from './hooks/useAudioPlayer';

// --- HASH LOCATION HOOK FOR ELECTRON ---
const currentLocation = () => window.location.hash.replace(/^#/, '') || "/";

const navigate = (to: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
        window.location.replace('#' + to);
    } else {
        window.location.hash = to;
    }
};

const useHashLocation = () => {
  const [loc, setLoc] = useState(currentLocation());
  useEffect(() => {
    const handler = () => setLoc(currentLocation());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return [loc, navigate] as [string, (to: string, options?: { replace?: boolean }) => void];
};

// --- COLOR UTILS ---
const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '168, 85, 247';
};

const rgbToHex = (rgb: string): string => {
    // Check if already hex
    if (rgb.startsWith('#')) return rgb;
    
    // Parse "r, g, b" string
    const parts = rgb.split(',').map(x => parseInt(x.trim()));
    if (parts.length !== 3 || parts.some(isNaN)) return '#a855f7'; // Default purple if invalid

    const [r, g, b] = parts;
    const toHex = (n: number) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

function App() {
  // --- ZUSTAND STORE ACCESS ---
  const {
      queue, setQueue, originalQueue, setOriginalQueue, queueTitle, setQueueTitle,
      currentIndex, setCurrentIndex,
      isPlaying, setIsPlaying,
      volume, setVolume,
      currentTime, duration,
      isShuffled, toggleShuffle,
      repeatMode, toggleRepeat,
      analyser,
      selectedArtist, setSelectedArtist,
      selectedAlbum, setSelectedAlbum,
      activePlaylistId, setActivePlaylistId,
      activeModal, setActiveModal,
      reorderQueue, addToQueue, playNext, clearQueue, bulkAddToQueue,
      deleteSongFromQueue,
      updateSongInQueue,
      isFullScreenPlayer, setIsFullScreenPlayer,
      isPartyMode, setIsPartyMode,
      isDynamicTheme, setIsDynamicTheme,
      accentColor, setAccentColor,
      colorHistory, addColorToHistory, removeColorFromHistory,
      localImageMap, setLocalImageMap
  } = usePlayerStore();

  const {
      library, setLibrary,
      playlists, setPlaylists,
      albumMetadata, setAlbumMetadata,
      recentlyPlayed,
      deleteSongFromLibrary,
      updateSongInLibrary
  } = useLibraryStore();

  const { seek } = useAudioPlayer(); 
  const [location, setLocation] = useHashLocation(); // Use custom hash hook

  // --- NAVIGATION HISTORY STACK ---
  const historyStack = useRef<string[]>([]);

  const rootNav = (path: string) => {
      historyStack.current = [];
      setLocation(path);
      setIsSidebarOpen(false);
  };

  const pushNav = (path: string) => {
      if (location !== path) {
          historyStack.current.push(location);
          setLocation(path);
      }
  };

  const goBack = (fallbackPath: string) => {
      const previousPath = historyStack.current.pop();
      if (previousPath) {
          setLocation(previousPath);
      } else {
          setLocation(fallbackPath);
      }
  };

  // --- LOCAL UI STATE ---
  const [playerInitialMode, setPlayerInitialMode] = useState<PlayerViewMode>('STANDARD');
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [pendingQueueSave, setPendingQueueSave] = useState<Song[] | null>(null);
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);
  const [songsToAddToPlaylist, setSongsToAddToPlaylist] = useState<Song[] | null>(null);
  
  const [wikiText, setWikiText] = useState<string | null>(null);
  const [isLoadingWiki, setIsLoadingWiki] = useState(false);
  const [songSearchInputs, setSongSearchInputs] = useState({ title: '', artist: '' });
  const [wikiSearchResults, setWikiSearchResults] = useState<WikiSearchResult[]>([]);
  const [wikiSearchFilter, setWikiSearchFilter] = useState('');
  const [showWikiResults, setShowWikiResults] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', artist: '', album: '', year: '', genre: '', coverUrl: '' });
  const [isAutoFetchingCover, setIsAutoFetchingCover] = useState(false);
  const editCoverInputRef = useRef<HTMLInputElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); 
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [supportsFileSystem, setSupportsFileSystem] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'party'>('appearance');
  // Initialize tempColor by converting the store's RGB string to Hex for the input
  const [tempColor, setTempColor] = useState(rgbToHex(accentColor));

  // Global Inactivity Timer for Party Mode
  const appInactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PARTY_MODE_TRIGGER_TIME = 180000; 

  const currentSong = currentIndex !== null ? queue[currentIndex] : null;

  // --- THEME ENGINE ---
  useEffect(() => {
      const applyTheme = async () => {
          if (isDynamicTheme && currentSong && currentSong.coverUrl) {
              const color = await extractDominantColor(currentSong.coverUrl);
              document.documentElement.style.setProperty('--color-accent', color);
          } else {
              // Ensure we are setting "R, G, B" string for the CSS variable
              document.documentElement.style.setProperty('--color-accent', accentColor);
          }
      };
      applyTheme();
  }, [currentSong?.id, isDynamicTheme, accentColor]);

  // Sync tempColor when accentColor changes externally (or initialization)
  useEffect(() => {
      if (!isDynamicTheme) {
          setTempColor(rgbToHex(accentColor));
      }
  }, [accentColor, isDynamicTheme]);

  // Toast Helper
  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  const resetAppInactivityTimer = useCallback(() => {
      if (appInactivityTimerRef.current) clearTimeout(appInactivityTimerRef.current);
      if (isPlaying && !isPartyMode) {
          appInactivityTimerRef.current = setTimeout(() => {
              setIsPartyMode(true);
          }, PARTY_MODE_TRIGGER_TIME);
      }
  }, [isPlaying, isPartyMode, setIsPartyMode]);

  useEffect(() => {
      window.addEventListener('mousemove', resetAppInactivityTimer);
      window.addEventListener('touchstart', resetAppInactivityTimer);
      window.addEventListener('keydown', resetAppInactivityTimer);
      window.addEventListener('click', resetAppInactivityTimer);
      resetAppInactivityTimer();
      return () => {
          if (appInactivityTimerRef.current) clearTimeout(appInactivityTimerRef.current);
          window.removeEventListener('mousemove', resetAppInactivityTimer);
          window.removeEventListener('touchstart', resetAppInactivityTimer);
          window.removeEventListener('keydown', resetAppInactivityTimer);
          window.removeEventListener('click', resetAppInactivityTimer);
      };
  }, [resetAppInactivityTimer]);


  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (isPartyMode) return;
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

          switch(e.code) {
              case 'Space':
                  e.preventDefault();
                  if (queue.length > 0) setIsPlaying(!isPlaying);
                  break;
              case 'ArrowLeft':
                  if(e.metaKey || e.ctrlKey) {
                      if (currentIndex !== null) {
                          if (currentTime > 3) seek(0);
                          else if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
                      }
                  } else {
                      seek(Math.max(0, currentTime - 5));
                  }
                  break;
              case 'ArrowRight':
                  if(e.metaKey || e.ctrlKey) {
                      if (currentIndex !== null && currentIndex < queue.length - 1) {
                          setCurrentIndex(currentIndex + 1);
                      }
                  } else {
                      seek(Math.min(duration, currentTime + 5));
                  }
                  break;
              case 'KeyM':
                  setVolume(volume > 0 ? 0 : 1);
                  break;
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, queue, currentIndex, currentTime, duration, volume, isPartyMode]);

  // --- INITIALIZATION ---
  useEffect(() => {
    setSupportsFileSystem(isFileSystemAPISupported());
    
    const initApp = async () => {
        await migrateAddedAtTimestamps();

        // 1. Load initial chunk (DB Cache)
        const initialSongs = await loadSongsRange(0, 50);
        const savedAlbums = await loadAllAlbumsMetadata();

        if (initialSongs.length > 0) {
            setLibrary(initialSongs);
            // Restore session...
            const savedSession = localStorage.getItem('asteroid_session');
            if (savedSession) {
                try {
                    const session = JSON.parse(savedSession);
                    if (session.queueIds && session.queueIds.length > 0) {
                         const queueMap = new Map(initialSongs.map(s => [s.id, s]));
                         const restoredQueue = session.queueIds
                            .map((id: string) => queueMap.get(id))
                            .filter((s: Song | undefined): s is Song => !!s);
                         
                         if (restoredQueue.length > 0) {
                             setQueue(restoredQueue, session.queueTitle || "Queue");
                             if (session.isShuffled) usePlayerStore.setState({ isShuffled: true });
                             setOriginalQueue(restoredQueue);
                             if (session.index !== null && session.index < restoredQueue.length) {
                                 setCurrentIndex(session.index);
                             }
                         }
                    }
                } catch (e) {}
            } else {
                setQueue(initialSongs, "All Songs");
            }
        }
        
        const albumMap: Record<string, AlbumMetadata> = {};
        savedAlbums.forEach(a => { albumMap[a.id] = a; });
        setAlbumMetadata(albumMap);

        setIsInitialLoad(false);

        // 3. BACKGROUND: AUTO-SCAN FOLDER (Hybrid Mode)
        // If user has a saved path, scan it silently and update DB/Library
        if (window.electronAPI) {
            // No await here, let it run in background and update library state when done
            scanSavedLibrary().then((newScannedSongs) => {
                if (newScannedSongs.length > 0) {
                    // Refetch everything from DB because scanSavedLibrary modifies DB
                    loadSongsRange(0, -1).then(fullLibrary => {
                        setLibrary(fullLibrary);
                        // Trigger Smart Playlists
                        analyzeAndGenerateSmartPlaylists(fullLibrary).then(pl => {
                            setPlaylists(pl);
                            runBackgroundCuration(fullLibrary, pl);
                        });
                        showToast("Library synced with folder");
                    });
                } else if (initialSongs.length > 0) {
                    // Fallback normal lazy load if no new scan results but we have DB data
                    loadSongsRange(50, -1).then(remaining => {
                        const full = [...initialSongs, ...remaining];
                        setLibrary(full);
                        analyzeAndGenerateSmartPlaylists(full).then(pl => {
                            setPlaylists(pl);
                            runBackgroundCuration(full, pl);
                        });
                    });
                }
            });
        } else {
            // WEB MODE: Standard lazy load
            if (initialSongs.length > 0) {
                const remainingSongs = await loadSongsRange(50, -1);
                let allSongs = [...initialSongs];
                if (remainingSongs.length > 0) {
                    allSongs = [...initialSongs, ...remainingSongs];
                    setLibrary(allSongs);
                }
                const processedPlaylists = await analyzeAndGenerateSmartPlaylists(allSongs);
                setPlaylists(processedPlaylists);
                runBackgroundCuration(allSongs, processedPlaylists);
            } else {
                const pl = await analyzeAndGenerateSmartPlaylists([]);
                setPlaylists(pl);
            }
        }
    };

    initApp();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // --- AUTOMATIC AI CURATION ---
  const runBackgroundCuration = async (allSongs: Song[], existingPlaylists: Playlist[]) => {
      // 1. Time Check (24 Hours)
      const LAST_RUN_KEY = 'last_curation_run_ts';
      const lastRun = parseInt(localStorage.getItem(LAST_RUN_KEY) || '0');
      const now = Date.now();
      const INTERVAL = 24 * 60 * 60 * 1000; // 24 Hours

      // If we have auto-generated playlists, we strictly obey the 24h timer.
      // If we have ZERO auto-generated playlists, we run it anyway to populate initial data.
      const hasAutoLists = existingPlaylists.some(p => p.isGenerated);
      if (hasAutoLists && (now - lastRun < INTERVAL)) {
          return; 
      }

      if (allSongs.length < 10) return; // Need songs to curate

      try {
          // Call Gemini
          const concepts = await generateCuratedPlaylists();
          
          let updatesCount = 0;
          // Working copy of playlists
          const newPlaylists = [...existingPlaylists];

          for (const concept of concepts) {
              // Find matches in library
              const matchedSongIds: Set<string> = new Set();
              
              // We search for songs matching the AI's tracks
              const matchPromises = concept.tracks.map(track => 
                  fuzzySearch(allSongs, `${track.title} ${track.artist}`)
              );
              
              const results = await Promise.all(matchPromises);
              results.forEach(res => {
                  if (res.songs.length > 0) matchedSongIds.add(res.songs[0].id);
              });

              // Threshold: At least 3 songs matched locally
              if (matchedSongIds.size >= 3) {
                  // Check if playlist already exists by name (Refresh logic)
                  const existingIndex = newPlaylists.findIndex(p => p.name === concept.title && p.isGenerated);
                  
                  const playlistData: Playlist = {
                      id: existingIndex !== -1 ? newPlaylists[existingIndex].id : Date.now().toString() + Math.random().toString().slice(2,5),
                      name: concept.title,
                      songIds: Array.from(matchedSongIds),
                      createdAt: now,
                      isGenerated: true,
                      // Renew expiration on update: 48 hours from now
                      expiresAt: now + (48 * 60 * 60 * 1000) 
                  };

                  await savePlaylist(playlistData);
                  
                  if (existingIndex !== -1) {
                      newPlaylists[existingIndex] = playlistData;
                  } else {
                      newPlaylists.push(playlistData);
                  }
                  updatesCount++;
              }
          }

          if (updatesCount > 0) {
              setPlaylists(newPlaylists);
              localStorage.setItem(LAST_RUN_KEY, now.toString());
              showToast("Official Editorial Playlists Updated", 'success');
          }

      } catch (e) {
          console.warn("Background curation skipped due to error", e);
      }
  };

  // --- SESSION SAVER ---
  useEffect(() => {
      if (!isInitialLoad && queue.length > 0) {
          const timeout = setTimeout(() => {
              const session = {
                  queueIds: queue.map(s => s.id),
                  index: currentIndex,
                  currentTime: currentTime,
                  repeatMode: repeatMode,
                  isShuffled: isShuffled,
                  queueTitle: queueTitle
              };
              localStorage.setItem('asteroid_session', JSON.stringify(session));
          }, 1000);
          return () => clearTimeout(timeout);
      }
  }, [queue, currentIndex, currentTime, isInitialLoad, repeatMode, isShuffled, queueTitle]);

  // BACKGROUND SYNC
  useEffect(() => {
    if (library.length > 0) {
        const uniqueArtists = Array.from(new Set(library.map(s => s.artist))) as string[];
        syncArtistLibrary(uniqueArtists);
    }
  }, [library]);

  const handlePlaySongContext = (index: number, contextList: Song[], title: string) => {
      setQueue(contextList, title);
      setCurrentIndex(index);
      setIsPlaying(true);
  };

  const handleDeleteSongs = async (songIds: string[]) => {
      let successCount = 0;
      for (const id of songIds) {
          const success = await deleteSongFromStorage(id);
          if (success) {
              await removeSongFromPlaylists(id);
              deleteSongFromLibrary(id);
              deleteSongFromQueue(id);
              successCount++;
          }
      }
      if (successCount > 0) showToast(`Deleted ${successCount} songs`);
      else showToast("Failed to delete songs", 'error');
  };

  const handleFileSelect = async (files: FileList) => {
    setIsProcessingFiles(true);
    const baseTime = Date.now();
    const newSongsPromises = Array.from(files).map(async (file, index) => parseFileMetadata(file, baseTime + (index * 10)));
    const newSongs = await Promise.all(newSongsPromises);
    await saveSongsToStorage(newSongs);

    const updatedLibrary = [...library];
    const existingIds = new Set(library.map(s => s.id));
    
    newSongs.forEach(s => {
        if (!existingIds.has(s.id)) {
            updatedLibrary.push(s);
        }
    });

    setLibrary(updatedLibrary);
    
    // TRIGGER IMMEDIATE SMART ANALYSIS & AI CURATION
    const newPlaylists = await analyzeAndGenerateSmartPlaylists(updatedLibrary);
    setPlaylists(newPlaylists);
    runBackgroundCuration(updatedLibrary, newPlaylists); // Check if we can make new lists now

    if (queue.length === 0) setQueue(newSongs, "All Songs");
    setIsProcessingFiles(false);
    if (newSongs.length > 0) showToast(`${newSongs.length} tracks imported`);
  };

  const handleLinkFolder = async () => {
      try {
          setIsProcessingFiles(true);
          const newSongs = await selectDirectoryAndScan();
          
          const updatedLibrary = [...library];
          const existingIds = new Set(library.map(s => s.id));
          
          newSongs.forEach(s => {
              if (!existingIds.has(s.id)) {
                  updatedLibrary.push(s);
              }
          });

          setLibrary(updatedLibrary);

          // TRIGGER IMMEDIATE SMART ANALYSIS & AI CURATION
          const newPlaylists = await analyzeAndGenerateSmartPlaylists(updatedLibrary);
          setPlaylists(newPlaylists);
          runBackgroundCuration(updatedLibrary, newPlaylists);

          if (queue.length === 0) setQueue(newSongs, "All Songs");
          if (newSongs.length > 0) showToast(`Linked ${newSongs.length} tracks`);
      } catch (e: any) {
          if (e.name !== 'AbortError') showToast("Folder access failed.", 'error');
      } finally {
          setIsProcessingFiles(false);
      }
  };

  // --- SETTINGS HANDLERS ---
  const handleLinkImageFolder = async () => {
      const map = await scanLocalImageFolder();
      const count = Object.keys(map).length;
      if (count > 0) {
          setLocalImageMap(map);
          showToast(`Mapped ${count} visual assets`);
      } else {
          showToast('No images found', 'error');
      }
  };

  const handleSaveColor = () => {
      // CONVERT HEX INPUT TO RGB FOR STORE
      const rgb = hexToRgb(tempColor);
      setAccentColor(rgb);
      setIsDynamicTheme(false);
      addColorToHistory(rgb); // Save as RGB
      showToast('Theme Saved');
  };

  // --- SONG UPDATES ---
  const handleSongUpdate = async (originalId: string, updatedSong: Song, showNotification = true) => {
      const success = await updateSongMetadata(originalId, updatedSong);
      if (success) {
          updateSongInLibrary(originalId, updatedSong);
          updateSongInQueue(originalId, updatedSong);
          if (showNotification) showToast("Metadata updated successfully");
      } else {
          showToast("Failed to save changes", 'error');
      }
  };

  const handleSaveMetadata = async () => {
      if (!currentSong) return;
      const updated: Song = {
          ...currentSong,
          title: editForm.title,
          artist: editForm.artist,
          album: editForm.album,
          year: editForm.year,
          genre: editForm.genre,
          coverUrl: editForm.coverUrl
      };
      const newId = generateId(updated.artist, updated.album, updated.title);
      if (newId !== currentSong.id) updated.id = newId;
      
      // Pass the CURRENT (Old) ID as the originalId
      await handleSongUpdate(currentSong.id, updated);
      setActiveModal('none');
  };

  const handleAutoFetchCover = async () => {
      setIsAutoFetchingCover(true);
      try {
          const query = `${editForm.artist} ${editForm.album}`;
          const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.deezer.com/search/album?q=' + encodeURIComponent(query))}`);
          const data = await res.json();
          
          if (data.data && data.data.length > 0) {
              const cover = data.data[0].cover_xl || data.data[0].cover_big;
              if (cover) {
                  setEditForm(prev => ({ ...prev, coverUrl: cover }));
                  showToast("Cover found!", "success");
              } else {
                  showToast("No cover found.", "error");
              }
          } else {
              showToast("No album found.", "error");
          }
      } catch (e) {
          showToast("Search failed.", "error");
      } finally {
          setIsAutoFetchingCover(false);
      }
  };

  const handleEditCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              if (reader.result) {
                  setEditForm(prev => ({ ...prev, coverUrl: reader.result as string }));
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleBulkSongUpdate = async (songsToUpdate: Song[], updates: Partial<Song>) => {
      for (const song of songsToUpdate) {
          const updated = { ...song, ...updates };
          const newId = generateId(updated.artist, updated.album, updated.title);
          if (newId !== song.id) updated.id = newId;
          
          await updateSongMetadata(song.id, updated);
          updateSongInLibrary(song.id, updated);
          updateSongInQueue(song.id, updated);
      }
      showToast(`Updated ${songsToUpdate.length} songs`);
  };

  const handleUpdateAlbumDescription = async (albumTitle: string, artist: string, description: string) => {
      const id = getAlbumId(artist, albumTitle);
      const newMeta = { ...albumMetadata[id], id, artist, title: albumTitle, description };
      await saveAlbumMetadata(newMeta);
      setAlbumMetadata(prev => ({ ...prev, [id]: newMeta }));
  };

  const handleUpdateAlbumCover = async (albumTitle: string, artist: string, coverUrl: string) => {
      const id = getAlbumId(artist, albumTitle);
      const newMeta = { ...albumMetadata[id], id, artist, title: albumTitle, coverUrl };
      await saveAlbumMetadata(newMeta);
      setAlbumMetadata(prev => ({ ...prev, [id]: newMeta }));
  };

  const handleArtistUpdate = async (oldName: string, newName: string, newImage: string, newBio: string) => {
      const meta: ArtistMetadata = { name: newName, imageUrl: newImage, bio: newBio, source: 'User Edited', lastUpdated: Date.now() };
      await saveArtistMetadata(meta);
      if (oldName !== newName) {
          const songsToUpdate = library.filter(s => s.artist === oldName);
          await handleBulkSongUpdate(songsToUpdate, { artist: newName });
      }
      showToast("Artist info saved");
  };

  const handleSaveNewPlaylist = async () => {
      if (!newPlaylistName.trim()) return;
      let songsToAdd: Song[] = [];
      if (pendingQueueSave) songsToAdd = pendingQueueSave;
      else if (songsToAddToPlaylist) songsToAdd = songsToAddToPlaylist;

      const newPlaylist: Playlist = {
          id: Date.now().toString(),
          name: newPlaylistName,
          songIds: songsToAdd.map(s => s.id),
          createdAt: Date.now()
      };

      await savePlaylist(newPlaylist);
      setPlaylists(prev => [...prev, newPlaylist]);
      setIsCreatePlaylistOpen(false);
      setPendingQueueSave(null);
      setSongsToAddToPlaylist(null);
      setNewPlaylistName("");
      showToast(`Playlist "${newPlaylist.name}" created`);
  };

  const handleAddToPlaylist = async (playlistId: string) => {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) return;
      let songsToAdd: Song[] = [];
      if (songToAddToPlaylist) songsToAdd = [songToAddToPlaylist];
      else if (songsToAddToPlaylist) songsToAdd = songsToAddToPlaylist;

      if (songsToAdd.length > 0) {
          const newIds = songsToAdd.map(s => s.id);
          const updated = { ...playlist, songIds: [...playlist.songIds, ...newIds] };
          await savePlaylist(updated);
          setPlaylists(prev => prev.map(p => p.id === playlistId ? updated : p));
          showToast(`Added ${songsToAdd.length} songs to "${playlist.name}"`);
      }
      setSongToAddToPlaylist(null);
      setSongsToAddToPlaylist(null);
  };

  // --- WIKI / ABOUT LOGIC ---
  const handleOpenAbout = async () => {
    if (!currentSong) return;
    setActiveModal('about');
    if (currentSong.description) {
        setWikiText(currentSong.description);
    } else {
        setIsLoadingWiki(true);
        setWikiText(null);
        try {
            const desc = await getSongWikiDescription(currentSong.title, currentSong.artist);
            setWikiText(desc || "No information found.");
            if (desc) {
                // Keep same ID for description updates usually
                const updated = { ...currentSong, description: desc };
                updateSongInQueue(currentSong.id, updated);
            }
        } catch (e) {
            setWikiText("Error fetching information.");
        } finally {
            setIsLoadingWiki(false);
        }
    }
  };

  const handleManualSongInfoSearch = async () => {
      setIsLoadingWiki(true);
      const query = `${songSearchInputs.title} ${songSearchInputs.artist}`;
      const results = await searchWikipedia(query);
      setWikiSearchResults(results);
      setShowWikiResults(true);
      setIsLoadingWiki(false);
  };

  const handleSelectWikiResult = async (title: string) => {
      setIsLoadingWiki(true);
      const text = await getWikiPageContent(title);
      setWikiText(text);
      setShowWikiResults(false);
      setIsLoadingWiki(false);
      if (currentSong && text) {
          const updated = { ...currentSong, description: text };
          // Description update doesn't change ID, so original ID is safe
          await handleSongUpdate(currentSong.id, updated, false);
      }
  };
  
  const handleOpenEdit = () => { if (currentSong) { setEditForm({ title: currentSong.title, artist: currentSong.artist, album: currentSong.album || '', year: currentSong.year || '', genre: currentSong.genre || '', coverUrl: currentSong.coverUrl || '' }); setActiveModal('edit'); }};

  return (
    <Router hook={useHashLocation}>
    <div className="fixed inset-0 w-full h-full bg-black text-white flex flex-col overflow-hidden font-sans select-none">
      <AudioController /> 
      <PermissionRecoveryModal />
      
      {/* Dynamic Background */}
      <div 
        className="absolute inset-0 z-0 transition-all duration-1000 ease-in-out opacity-30 blur-3xl scale-110 pointer-events-none"
        style={{ 
            backgroundImage: currentSong?.coverUrl ? `url(${currentSong.coverUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        }}
      />
      
      <div className="absolute top-0 left-0 w-full h-8 z-50 app-region-drag" style={{ WebkitAppRegion: 'drag' } as any}></div>

      {toast && (
        <div className={`fixed top-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 animate-[slideIn_0.3s_ease-out] ${toast.type === 'success' ? 'bg-neutral-900/90 border-green-500/30 text-green-400' : 'bg-neutral-900/90 border-red-500/30 text-red-400'}`}>
           <Info size={18} />
           <span className="text-white text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* PARTY MODE OVERLAY */}
      {isPartyMode && <PartyMode onExit={() => setIsPartyMode(false)} />}

      {/* FULL SCREEN PLAYER OVERLAY */}
      {isFullScreenPlayer && (
          <div className="fixed inset-0 z-[80] bg-black animate-fade-in">
              <FullScreenPlayer 
                initialViewMode={playerInitialMode} 
                onLyricsUpdate={(lyrics) => { 
                    const updated = { ...currentSong!, lyrics, isSyncedFromMetadata: false }; 
                    handleSongUpdate(currentSong!.id, updated); 
                }} 
                onArtistClick={(artist) => { setIsFullScreenPlayer(false); pushNav(`/artist/${encodeURIComponent(artist)}`); }} 
                onAlbumClick={(album) => { setIsFullScreenPlayer(false); pushNav(`/album/${encodeURIComponent(album)}`); }} 
                onOpenAbout={handleOpenAbout} 
                onAddToPlaylist={() => currentSong && setSongToAddToPlaylist(currentSong)} 
                onOpenFileInfo={() => setActiveModal('fileInfo')} 
                onSaveQueue={() => { setPendingQueueSave(queue); setNewPlaylistName(""); setIsCreatePlaylistOpen(true); }}
                onMinimize={() => setIsFullScreenPlayer(false)}
              />
          </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && !isPartyMode && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
                  <div className="flex items-center justify-between p-6 border-b border-white/5">
                      <h3 className="font-bold text-xl flex items-center gap-2"><Settings size={20} className="text-accent"/> Settings</h3>
                      <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                  </div>
                  
                  <div className="flex bg-white/5 p-2 gap-2">
                      <button 
                        onClick={() => setSettingsTab('appearance')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${settingsTab === 'appearance' ? 'bg-accent text-white' : 'hover:bg-white/10 text-white/50'}`}
                      >
                          <Palette size={16} /> Appearance
                      </button>
                      <button 
                        onClick={() => setSettingsTab('party')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${settingsTab === 'party' ? 'bg-accent text-white' : 'hover:bg-white/10 text-white/50'}`}
                      >
                          <ImageIcon size={16} /> Visuals
                      </button>
                  </div>

                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                      {settingsTab === 'appearance' && (
                          <div className="space-y-6">
                              <div>
                                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-4">Custom Accent Color</label>
                                  <div className="flex items-center gap-4">
                                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 relative shadow-lg">
                                          <input 
                                            type="color" 
                                            value={tempColor}
                                            onChange={(e) => setTempColor(e.target.value)}
                                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                                          />
                                      </div>
                                      <div className="flex-1">
                                          <button onClick={handleSaveColor} className="bg-white text-black font-bold px-6 py-2 rounded-lg hover:bg-neutral-200 transition shadow-lg mb-2">
                                              Apply & Save
                                          </button>
                                          <p className="text-xs text-white/40">Pick any color from the wheel.</p>
                                      </div>
                                  </div>
                              </div>

                              <div>
                                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-4">Saved Colors</label>
                                  <div className="flex flex-wrap gap-3">
                                      {/* Defaults (Hex because we convert on click) */}
                                      {['#a855f7', '#3b82f6', '#ef4444', '#22c55e', '#eab308'].map(c => (
                                          <button 
                                            key={c}
                                            onClick={() => { setTempColor(c); setAccentColor(hexToRgb(c)); setIsDynamicTheme(false); }}
                                            className="w-10 h-10 rounded-full border-2 border-transparent hover:border-white transition shadow-lg"
                                            style={{ backgroundColor: c }}
                                          />
                                      ))}
                                      {/* Custom History (Stored as RGB strings in store, so need rgb() wrapper) */}
                                      {colorHistory.map((c, i) => (
                                          <div key={i} className="relative group">
                                              <button 
                                                onClick={() => { setTempColor(rgbToHex(c)); setAccentColor(c); setIsDynamicTheme(false); }}
                                                className="w-10 h-10 rounded-full border-2 border-white/20 hover:border-white transition shadow-lg"
                                                style={{ backgroundColor: `rgb(${c})` }}
                                              />
                                              <button 
                                                onClick={() => removeColorFromHistory(c)}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition transform scale-75 hover:scale-100"
                                              >
                                                  <X size={10} />
                                              </button>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                              
                              <div className="pt-4 border-t border-white/10">
                                  <div className="flex items-center justify-between">
                                      <span className="font-bold">Dynamic Theme</span>
                                      <button 
                                          onClick={() => setIsDynamicTheme(!isDynamicTheme)}
                                          className={`w-12 h-6 rounded-full relative transition-colors ${isDynamicTheme ? 'bg-accent' : 'bg-white/20'}`}
                                      >
                                          <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${isDynamicTheme ? 'left-7' : 'left-1'}`}></div>
                                      </button>
                                  </div>
                                  <p className="text-xs text-white/40 mt-2">Automatically matches the player accent color to the current song's album art.</p>
                              </div>
                          </div>
                      )}

                      {settingsTab === 'party' && (
                          <div className="space-y-6">
                              <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                                  <h4 className="font-bold mb-2">Party Mode Visuals</h4>
                                  <p className="text-sm text-white/60 leading-relaxed mb-4">
                                      Party Mode automatically downloads artist backgrounds from the web.
                                      For even more variety, you can link a local folder containing your own wallpapers.
                                  </p>
                                  
                                  {window.electronAPI ? (
                                      <div className="space-y-4">
                                          <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/10">
                                              <div className="flex items-center gap-3">
                                                  <FolderOpen size={20} className="text-accent" />
                                                  <div>
                                                      <p className="font-bold text-sm">Local Library</p>
                                                      <p className="text-xs text-white/40">{Object.keys(localImageMap).length > 0 ? `${Object.keys(localImageMap).length} items mapped` : 'Not linked'}</p>
                                                  </div>
                                              </div>
                                              <button 
                                                onClick={handleLinkImageFolder}
                                                className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-xs font-bold transition"
                                              >
                                                  {Object.keys(localImageMap).length > 0 ? 'Rescan' : 'Link Folder'}
                                              </button>
                                          </div>
                                          <p className="text-[10px] text-white/30 italic">
                                              Supported: .jpg, .png, .webp. Files named "Artist.jpg" or "Artist - Song.jpg" will be automatically matched.
                                          </p>
                                      </div>
                                  ) : (
                                      <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex items-start gap-3">
                                          <Info size={16} className="text-yellow-500 mt-0.5" />
                                          <p className="text-xs text-yellow-200/80">
                                              Local folder linking is only available in the Desktop App version. 
                                              Web version relies solely on online APIs.
                                          </p>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* MODALS */}
      {!isPartyMode && (
          <>
            {isCreatePlaylistOpen && (
                <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
                        <h3 className="font-bold text-lg mb-4">
                            {pendingQueueSave ? "Save Queue as Playlist" : 
                             songsToAddToPlaylist ? `Add ${songsToAddToPlaylist.length} Songs to New Playlist` : 
                             "Create New Playlist"}
                        </h3>
                        <input autoFocus className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none mb-6" placeholder="Playlist Name" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveNewPlaylist()} />
                        <div className="flex gap-3">
                            <button onClick={() => { setIsCreatePlaylistOpen(false); setSongsToAddToPlaylist(null); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg transition">Cancel</button>
                            <button onClick={handleSaveNewPlaylist} className="flex-1 bg-accent hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD TO PLAYLIST MODAL */}
            {(songToAddToPlaylist || songsToAddToPlaylist) && (
                <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[70vh]">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="font-bold text-lg">Add to Playlist</h3>
                            <button onClick={() => { setSongToAddToPlaylist(null); setSongsToAddToPlaylist(null); }} className="p-1 hover:bg-white/10 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            <button onClick={() => { setIsCreatePlaylistOpen(true); setNewPlaylistName(""); }} className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition text-left">
                                <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center border border-white/10"><Plus size={24} className="text-accent"/></div>
                                <span className="font-bold">New Playlist</span>
                            </button>
                            {playlists.map(playlist => (
                                <button key={playlist.id} onClick={() => handleAddToPlaylist(playlist.id)} className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition text-left">
                                    <div className="w-12 h-12 bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0">
                                        {playlist.coverUrl ? <img src={playlist.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ListMusic size={20} className="text-white/20"/></div>}
                                    </div>
                                    <div className="flex-1 min-w-0"><p className="font-bold truncate">{playlist.name}</p><p className="text-xs text-white/40">{playlist.songIds.length} Songs</p></div>
                                    <ListPlus size={20} className="text-white/20 group-hover:text-white"/>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {/* EQUALIZER MODAL */}
            {activeModal === 'equalizer' && <EqualizerModal />}

            {/* SHARED INFO MODALS */}
            {activeModal !== 'none' && activeModal !== 'equalizer' && currentSong && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-white/5 flex-shrink-0">
                            <h3 className="font-bold text-lg">
                                {activeModal === 'about' && 'About Song'}
                                {activeModal === 'fileInfo' && 'File Metadata'}
                                {activeModal === 'edit' && 'Edit Metadata'}
                            </h3>
                            <button onClick={() => setActiveModal('none')} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            {/* ... Content of modals ... */}
                            {activeModal === 'about' && (
                                <div className="flex flex-col h-full min-h-[300px]">
                                    {isLoadingWiki && ( <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-2xl"><Loader2 size={32} className="animate-spin text-accent"/><p className="text-sm font-medium mt-2">Loading...</p></div> )}
                                    {!showWikiResults && wikiText && ( <div className="space-y-4"><div className="flex items-center justify-between"><h4 className="font-bold text-white/90">Detailed Info</h4><button onClick={() => { setWikiText(null); setShowWikiResults(false); }} className="text-xs font-bold text-accent uppercase tracking-wider hover:text-white transition">Search Again</button></div><p className="text-white/80 leading-relaxed text-sm whitespace-pre-line">{wikiText}</p><div className="flex items-center gap-2 text-xs text-white/30 italic mt-4 pt-4 border-t border-white/5"><Globe size={12}/> Source: Wikipedia</div></div> )}
                                    {showWikiResults && ( <div className="flex flex-col h-full"><div className="flex items-center gap-2 mb-4 bg-white/5 rounded-lg p-2 border border-white/5"><Filter size={16} className="text-accent" /><input autoFocus className="bg-transparent border-none text-sm w-full focus:outline-none text-white placeholder-white/40" placeholder="Type to filter..." value={wikiSearchFilter} onChange={(e) => setWikiSearchFilter(e.target.value)} /></div><div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">{wikiSearchResults.filter(r => r.title.toLowerCase().includes(wikiSearchFilter.toLowerCase())).map((result, idx) => (<button key={idx} onClick={() => handleSelectWikiResult(result.title)} className="w-full text-left p-3 hover:bg-white/10 rounded-lg transition text-sm flex items-center justify-between group border border-transparent hover:border-white/5"><span className="font-medium truncate">{result.title}</span><ChevronRight size={14} className="text-white/20 group-hover:text-white" /></button>))}</div><button onClick={() => setShowWikiResults(false)} className="mt-4 text-xs font-bold text-white/40 hover:text-white text-center w-full">Cancel</button></div> )}
                                    {!showWikiResults && !wikiText && ( <div className="flex flex-col justify-center h-full"><div className="bg-white/5 p-6 rounded-xl border border-white/5"><div className="flex items-center gap-2 mb-4"><Search size={16} className="text-accent" /><span className="font-bold text-white/80">Search Wikipedia</span></div><div className="space-y-3"><div><label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Song Name</label><input className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none mt-1" value={songSearchInputs.title} onChange={(e) => setSongSearchInputs({...songSearchInputs, title: e.target.value})} /></div><div><label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Artist</label><input className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none mt-1" value={songSearchInputs.artist} onChange={(e) => setSongSearchInputs({...songSearchInputs, artist: e.target.value})} /></div><button onClick={handleManualSongInfoSearch} disabled={isLoadingWiki} className="w-full bg-accent hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 mt-2 shadow-lg shadow-purple-900/20">{isLoadingWiki ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Search Catalog</button></div></div></div> )}
                                </div>
                            )}

                            {activeModal === 'fileInfo' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div><p className="text-white/40 text-xs uppercase">Title</p><p className="font-medium">{currentSong.title}</p></div>
                                        <div><p className="text-white/40 text-xs uppercase">Artist</p><p className="font-medium">{currentSong.artist}</p></div>
                                        <div><p className="text-white/40 text-xs uppercase">Album</p><p className="font-medium">{currentSong.album}</p></div>
                                        <div><p className="text-white/40 text-xs uppercase">Year</p><p className="font-medium">{currentSong.year || '-'}</p></div>
                                            <div><p className="text-white/40 text-xs uppercase">Genre</p><p className="font-medium">{currentSong.genre || '-'}</p></div>
                                    </div>
                                    <div className="pt-4 border-t border-white/5"><button onClick={handleOpenEdit} className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-2 rounded-lg transition">Edit Metadata</button></div>
                                </div>
                            )}

                            {activeModal === 'edit' && (
                                <div className="space-y-4">
                                    <div className="flex flex-col items-center mb-4">
                                        <div 
                                            className="w-32 h-32 rounded-lg bg-neutral-800 relative group cursor-pointer overflow-hidden shadow-xl"
                                            onClick={() => editCoverInputRef.current?.click()}
                                        >
                                            <img 
                                                src={editForm.coverUrl || "https://picsum.photos/300"} 
                                                className="w-full h-full object-cover transition duration-300 group-hover:opacity-50" 
                                                alt="Cover"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                                                <Camera size={24} className="text-white drop-shadow-md" />
                                            </div>
                                            <input 
                                                type="file" 
                                                ref={editCoverInputRef} 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={handleEditCoverChange}
                                            />
                                        </div>
                                        <span className="text-xs text-white/40 mt-2">Tap image to change</span>
                                    </div>

                                    <div><label className="text-xs text-white/40 font-bold uppercase">Title</label><input className="w-full bg-white/5 border border-white/10 rounded-lg p-2 mt-1 focus:border-accent focus:outline-none" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} /></div>
                                    <div><label className="text-xs text-white/40 font-bold uppercase">Artist</label><input className="w-full bg-white/5 border border-white/10 rounded-lg p-2 mt-1 focus:border-accent focus:outline-none" value={editForm.artist} onChange={(e) => setEditForm({...editForm, artist: e.target.value})} /></div>
                                    <div><label className="text-xs text-white/40 font-bold uppercase">Album</label><input className="w-full bg-white/5 border border-white/10 rounded-lg p-2 mt-1 focus:border-accent focus:outline-none" value={editForm.album} onChange={(e) => setEditForm({...editForm, album: e.target.value})} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-xs text-white/40 font-bold uppercase">Year</label><input className="w-full bg-white/5 border border-white/10 rounded-lg p-2 mt-1 focus:border-accent focus:outline-none" value={editForm.year} onChange={(e) => setEditForm({...editForm, year: e.target.value})} /></div>
                                            <div><label className="text-xs text-white/40 font-bold uppercase">Genre</label><input className="w-full bg-white/5 border border-white/10 rounded-lg p-2 mt-1 focus:border-accent focus:outline-none" value={editForm.genre} onChange={(e) => setEditForm({...editForm, genre: e.target.value})} /></div>
                                    </div>
                                    
                                    {/* Auto Cover Button */}
                                    <button onClick={handleAutoFetchCover} disabled={isAutoFetchingCover} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition">
                                        {isAutoFetchingCover ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} className="text-accent" />} Auto-Fetch Cover
                                    </button>

                                    <div className="pt-4"><button onClick={handleSaveMetadata} className="w-full bg-accent hover:bg-purple-400 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"><Save size={18} /> Save Changes</button></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </>
      )}

      <div className="relative z-10 flex flex-1 overflow-hidden min-w-0 min-h-0">
        {/* SIDEBAR */}
        {!isFullScreenPlayer && !isPartyMode && (
            <div className={`fixed md:static inset-y-0 left-0 bg-black/60 backdrop-blur-xl border-r border-white/10 transform transition-all duration-300 z-40 safe-top safe-bottom ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'} ${isSidebarExpanded ? 'md:w-64' : 'md:w-24'}`}>
                <div className={`p-6 flex items-center mb-2 cursor-pointer hover:bg-white/5 transition-colors ${isSidebarExpanded ? 'gap-3' : 'justify-center'}`} onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} title="Toggle Sidebar">
                    <div className="w-8 h-8 bg-gradient-to-br from-accent to-purple-800 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0"><span className="font-bold text-lg text-white">A</span></div>
                    {isSidebarExpanded && <h1 className="text-xl font-bold tracking-tight whitespace-nowrap animate-fade-in">Asteroid</h1>}
                </div>

                <nav className="px-3 space-y-2">
                    <button onClick={() => rootNav('/search')} className={`w-full flex items-center px-4 py-3 rounded-lg transition group relative ${location === '/search' ? 'bg-white/10 text-accent' : 'text-neutral-400 hover:text-white hover:bg-white/5'} ${!isSidebarExpanded && 'justify-center'}`}><Search size={22} />{isSidebarExpanded && <span className="ml-3 font-medium animate-fade-in">Search</span>}</button>
                    <button onClick={() => rootNav('/')} className={`w-full flex items-center px-4 py-3 rounded-lg transition group relative ${location === '/' ? 'bg-white/10 text-accent' : 'text-neutral-400 hover:text-white hover:bg-white/5'} ${!isSidebarExpanded && 'justify-center'}`}><Home size={22} />{isSidebarExpanded && <span className="ml-3 font-medium animate-fade-in">Home</span>}</button>
                    <button onClick={() => rootNav('/artists')} className={`w-full flex items-center px-4 py-3 rounded-lg transition group relative ${location.startsWith('/artist') ? 'bg-white/10 text-accent' : 'text-neutral-400 hover:text-white hover:bg-white/5'} ${!isSidebarExpanded && 'justify-center'}`}><Mic2 size={22} />{isSidebarExpanded && <span className="ml-3 font-medium animate-fade-in">Artists</span>}</button>
                    <button onClick={() => rootNav('/albums')} className={`w-full flex items-center px-4 py-3 rounded-lg transition group relative ${location.startsWith('/album') ? 'bg-white/10 text-accent' : 'text-neutral-400 hover:text-white hover:bg-white/5'} ${!isSidebarExpanded && 'justify-center'}`}><Disc size={22} />{isSidebarExpanded && <span className="ml-3 font-medium animate-fade-in">Albums</span>}</button>
                     <button onClick={() => rootNav('/playlists')} className={`w-full flex items-center px-4 py-3 rounded-lg transition group relative ${location.startsWith('/playlist') ? 'bg-white/10 text-accent' : 'text-neutral-400 hover:text-white hover:bg-white/5'} ${!isSidebarExpanded && 'justify-center'}`}><ListMusic size={22} />{isSidebarExpanded && <span className="ml-3 font-medium animate-fade-in">Playlists</span>}</button>
                    <button onClick={() => rootNav('/genres')} className={`w-full flex items-center px-4 py-3 rounded-lg transition group relative ${location.startsWith('/genre') ? 'bg-white/10 text-accent' : 'text-neutral-400 hover:text-white hover:bg-white/5'} ${!isSidebarExpanded && 'justify-center'}`}><Guitar size={22} />{isSidebarExpanded && <span className="ml-3 font-medium animate-fade-in">Genres</span>}</button>
                    
                    {/* Settings Button (Bottom of Nav) */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <button 
                            onClick={() => setIsSettingsOpen(true)}
                            className={`w-full flex items-center px-4 py-3 rounded-lg transition group relative text-neutral-400 hover:text-white hover:bg-white/5 ${!isSidebarExpanded && 'justify-center'}`}
                        >
                            <Settings size={22} />
                            {isSidebarExpanded && <span className="ml-3 font-medium animate-fade-in">Settings</span>}
                        </button>
                    </div>

                    {isInstallable && (
                        <div className="pt-4 px-2 mt-auto"><button onClick={() => deferredPrompt?.prompt()} className={`w-full flex items-center px-4 py-3 rounded-lg bg-white text-black font-bold hover:scale-105 transition shadow-lg ${!isSidebarExpanded && 'justify-center'}`}><Download size={20} />{isSidebarExpanded && <span className="ml-3">Install App</span>}</button></div>
                    )}
                </nav>
                
                {isSidebarExpanded && (
                    <div className="absolute bottom-8 px-6 w-full">
                        {isProcessingFiles && (
                            <div className="flex items-center gap-2 text-accent text-sm animate-pulse"><Loader2 size={16} className="animate-spin" /> Scanning...</div>
                        )}
                    </div>
                )}
                
                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden absolute top-4 right-4 p-2 text-white/50"><X size={24} /></button>
            </div>
        )}

        <main className="flex-1 flex flex-col relative transition-all duration-500 safe-top min-w-0 min-h-0 overflow-hidden">
             {!isFullScreenPlayer && !isPartyMode && (
                 <div className="md:hidden h-16 flex items-center px-4 border-b border-white/10 flex-shrink-0">
                    <button onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
                 </div>
             )}
             
             {/* ROUTING SWITCH */}
             <Switch>
                {/* LIBRARY */}
                <Route path="/">
                    <Library 
                        songs={library} 
                        recentlyPlayed={recentlyPlayed} 
                        currentSong={currentSong} 
                        isPlaying={isPlaying} 
                        onSongSelect={(s) => handlePlaySongContext(library.indexOf(s), library, "All Songs")} 
                        onFileSelect={handleFileSelect} 
                        onLinkFolder={handleLinkFolder} 
                        onSeeAllRecentlyAdded={() => pushNav('/recent')} 
                        onDeleteSongs={handleDeleteSongs}
                        onPlayNext={playNext}
                        onAddToQueue={addToQueue}
                        onBulkAdd={bulkAddToQueue}
                        onAddToPlaylist={(song) => setSongToAddToPlaylist(song)}
                        onBulkAddToPlaylist={(songs) => setSongsToAddToPlaylist(songs)}
                        onEdit={(song) => { showToast("Edit from playing screen for now"); }}
                    />
                </Route>

                {/* ARTISTS */}
                <Route path="/artists">
                    <ArtistsView songs={library} onSelectArtist={(a) => pushNav(`/artist/${encodeURIComponent(a)}`)} />
                </Route>
                <Route path="/artist/:name">
                    {(params: any) => {
                        if (!params) return null;
                        const artistName = decodeURIComponent(params.name);
                        return (
                            <ArtistDetailView 
                                artist={artistName} 
                                songs={library.filter(s => s.artist === artistName)} 
                                onSongSelect={(s) => handlePlaySongContext(library.filter(s => s.artist === artistName).indexOf(s), library.filter(s => s.artist === artistName), artistName)} 
                                onBack={() => goBack('/artists')} 
                                onAlbumClick={(album) => pushNav(`/album/${encodeURIComponent(album)}`)} 
                                albumMetadata={albumMetadata} 
                                onArtistUpdate={handleArtistUpdate} 
                                currentSong={currentSong} 
                                isPlaying={isPlaying} 
                            />
                        );
                    }}
                </Route>

                {/* ALBUMS */}
                <Route path="/albums">
                    <AlbumsView 
                        songs={library} 
                        onSongSelect={(s) => { const albumSongs = library.filter(song => song.album === s.album && song.artist === s.artist); handlePlaySongContext(albumSongs.indexOf(s), albumSongs, s.album || "Album"); }} 
                        onSelectAlbum={(a) => a && pushNav(`/album/${encodeURIComponent(a)}`)}
                    />
                </Route>
                <Route path="/album/:name">
                    {(params: any) => {
                        if (!params) return null;
                        const albumName = decodeURIComponent(params.name);
                        return (
                            <AlbumsView 
                                songs={library} 
                                selectedAlbum={albumName} 
                                onSongSelect={(s) => { const albumSongs = library.filter(song => song.album === s.album && song.artist === s.artist); handlePlaySongContext(albumSongs.indexOf(s), albumSongs, s.album || "Album"); }} 
                                onBack={() => goBack('/albums')} 
                                onArtistClick={(a) => pushNav(`/artist/${encodeURIComponent(a)}`)} 
                                albumMetadata={albumMetadata} 
                                onUpdateAlbumDescription={handleUpdateAlbumDescription} 
                                onUpdateAlbumCover={handleUpdateAlbumCover} 
                                onBulkUpdate={handleBulkSongUpdate} 
                                currentSong={currentSong} 
                                isPlaying={isPlaying} 
                            />
                        );
                    }}
                </Route>

                {/* PLAYLISTS */}
                <Route path="/playlists">
                    <PlaylistsView 
                        playlists={playlists} 
                        onCreatePlaylist={() => { setNewPlaylistName(""); setPendingQueueSave(null); setIsCreatePlaylistOpen(true); }} 
                        onSelectPlaylist={(p) => pushNav(`/playlist/${p.id}`)} 
                    />
                </Route>
                <Route path="/playlist/:id">
                    {(params: any) => {
                        if (!params) return null;
                        const activePlaylist = playlists.find(p => p.id === params.id); 
                        if (activePlaylist) {
                            return (
                                <PlaylistDetailView 
                                    playlist={activePlaylist} 
                                    onPlaySong={(s) => {
                                        // Dynamic songs calculation is handled inside PlaylistDetailView now
                                        const fullPlaylistSongs = activePlaylist.rules 
                                            ? library.filter(song => activePlaylist.rules!.every(rule => {
                                                const val = String((song as any)[rule.field] || "").toLowerCase();
                                                const rVal = rule.value.toLowerCase();
                                                return rule.operator === 'contains' ? val.includes(rVal) : rule.operator === 'equals' ? val === rVal : rule.operator === 'gt' ? parseFloat(val) > parseFloat(rVal) : parseFloat(val) < parseFloat(rVal);
                                            }))
                                            : activePlaylist.songIds.map(id => library.find(item => item.id === id)).filter((item): item is Song => !!item);
                                        
                                        const index = fullPlaylistSongs.findIndex(item => item.id === s.id);
                                        handlePlaySongContext(index, fullPlaylistSongs, activePlaylist.name);
                                    }}
                                    onBack={() => goBack('/playlists')} 
                                    onUpdatePlaylist={async (up) => { 
                                        const oldPlaylist = playlists.find(p => p.id === up.id);
                                        await savePlaylist(up); 
                                        setPlaylists(prev => prev.map(p => p.id === up.id ? up : p)); 
                                        if (oldPlaylist && queueTitle === oldPlaylist.name) { setQueueTitle(up.name); }
                                    }} 
                                    onDeletePlaylist={async (id) => { 
                                        await deletePlaylist(id); 
                                        setPlaylists(prev => prev.filter(p => p.id !== id)); 
                                        goBack('/playlists');
                                    }} 
                                    onRemoveSong={async (songId) => { 
                                        const updated = { ...activePlaylist, songIds: activePlaylist.songIds.filter(id => id !== songId) }; 
                                        await savePlaylist(updated); 
                                        setPlaylists(prev => prev.map(p => p.id === updated.id ? updated : p)); 
                                    }} 
                                    currentSong={currentSong} 
                                    isPlaying={isPlaying} 
                                />
                            );
                        }
                        return <div>Playlist not found</div>; 
                    }}
                </Route>

                {/* GENRES */}
                <Route path="/genres">
                    <GenresView songs={library} onSelectGenre={(g) => pushNav(`/genre/${encodeURIComponent(g)}`)} />
                </Route>
                <Route path="/genre/:name">
                    {(params: any) => {
                        if (!params) return null;
                        const genreName = decodeURIComponent(params.name);
                        const genreSongs = library.filter(s => s.genre === genreName);
                        // Filter playlists related to this genre (e.g., "90s Rock Mix" when in "Rock")
                        const relatedPlaylists = playlists.filter(p => p.isGenerated && p.name.includes(genreName));
                        
                        return (
                            <div className="flex-1 h-full flex flex-col">
                                {relatedPlaylists.length > 0 && (
                                    <div className="flex-shrink-0 px-6 py-4 bg-black/95 border-b border-white/5 flex gap-4 overflow-x-auto no-scrollbar">
                                        {relatedPlaylists.map(pl => (
                                            <button 
                                                key={pl.id}
                                                onClick={() => pushNav(`/playlist/${pl.id}`)}
                                                className="flex-shrink-0 bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 rounded-full text-xs font-bold text-white transition whitespace-nowrap flex items-center gap-2"
                                            >
                                                <ListMusic size={14} className="text-accent"/> {pl.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <Library 
                                    songs={genreSongs} 
                                    title={genreName}
                                    subtitle={`${genreSongs.length} TRACKS`}
                                    onBack={() => goBack('/genres')}
                                    recentlyPlayed={[]} 
                                    currentSong={currentSong} 
                                    isPlaying={isPlaying} 
                                    onSongSelect={(s) => handlePlaySongContext(genreSongs.indexOf(s), genreSongs, genreName)} 
                                    onFileSelect={handleFileSelect} 
                                    onLinkFolder={handleLinkFolder} 
                                    onSeeAllRecentlyAdded={() => {}} 
                                    onDeleteSongs={handleDeleteSongs}
                                    onPlayNext={playNext}
                                    onAddToQueue={addToQueue}
                                    onBulkAdd={bulkAddToQueue}
                                    onAddToPlaylist={(song) => setSongToAddToPlaylist(song)}
                                    onBulkAddToPlaylist={(songs) => setSongsToAddToPlaylist(songs)}
                                    onEdit={(song) => { showToast("Edit from playing screen for now"); }}
                                />
                            </div>
                        );
                    }}
                </Route>

                {/* SEARCH */}
                <Route path="/search">
                    <SearchView 
                        songs={library} 
                        onPlaySong={(s) => handlePlaySongContext(library.indexOf(s), library, "All Songs")} 
                        onArtistClick={(a) => pushNav(`/artist/${encodeURIComponent(a)}`)} 
                        onAlbumClick={(a) => pushNav(`/album/${encodeURIComponent(a)}`)} 
                        currentSong={currentSong} 
                        isPlaying={isPlaying} 
                    />
                </Route>

                {/* RECENTLY ADDED */}
                <Route path="/recent">
                    <RecentlyAddedView 
                        songs={library} 
                        onSongSelect={(s) => handlePlaySongContext(library.indexOf(s), library, "All Songs")} 
                        onBack={() => goBack('/')} 
                        currentSong={currentSong} 
                        isPlaying={isPlaying} 
                    />
                </Route>
             </Switch>
        </main>
      </div>

      {/* PLAYER BAR */}
      {!isFullScreenPlayer && !isPartyMode && (
          <div className="safe-bottom flex-shrink-0">
            <MusicPlayer 
                onToggleFullScreen={() => {
                    setPlayerInitialMode('STANDARD');
                    setIsFullScreenPlayer(true);
                }}
                onArtistClick={() => currentSong?.artist && pushNav(`/artist/${encodeURIComponent(currentSong.artist)}`)}
                onAlbumClick={() => currentSong?.album && pushNav(`/album/${encodeURIComponent(currentSong.album)}`)}
                onOpenAbout={handleOpenAbout}
                onAddToPlaylist={() => currentSong && setSongToAddToPlaylist(currentSong)}
                onOpenFileInfo={() => setActiveModal('fileInfo')}
                onOpenVisualizer={() => { 
                    setPlayerInitialMode('VISUALIZER'); 
                    setIsFullScreenPlayer(true); 
                }}
                onOpenLyrics={() => { 
                    setPlayerInitialMode('LYRICS'); 
                    setIsFullScreenPlayer(true); 
                }}
                onOpenQueue={() => { 
                    setPlayerInitialMode('QUEUE'); 
                    setIsFullScreenPlayer(true); 
                }}
                hasSongs={queue.length > 0}
            />
          </div>
      )}
    </div>
    </Router>
  );
}

export default App;
