import React, { useEffect, useRef } from 'react';
import { usePlayerStore, useLibraryStore } from '../store/playerStore';
import { getSongFile, loadLyricsFromStorage, getSongCoverImage, getSongById } from '../services/fileSystemService';
import { audioEngine, initAudioContext } from '../services/audioBase';

export const AudioController: React.FC = () => {
  const {
    queue,
    currentIndex,
    isPlaying,
    volume,
    repeatMode,
    setCurrentIndex,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setAnalyser,
    setPermissionErrorSong,
    saveLastPosition,
    consumeSongProgress,
    songProgress,
    updateSongInQueue
  } = usePlayerStore();

  const { addRecentlyPlayed, updateSongInLibrary } = useLibraryStore();

  const playRequestRef = useRef<number>(0);
  const activeObjectUrlRef = useRef<string | null>(null);
  const lastPlayedSourceRef = useRef<File | string | null>(null);

  const currentSong = currentIndex !== null ? queue[currentIndex] : null;

  // Helper to get Source URL (File Path or Blob)
  const getSourceUrl = async (song: any): Promise<{ src: string | null, rawSource: File | string | null }> => {
      if (window.electronAPI && song.path) {
          return { src: `file://${song.path}`, rawSource: song.path };
      }
      try {
          const fileOrPath = await getSongFile(song);
          if (!fileOrPath) return { src: null, rawSource: null };
          
          if (typeof fileOrPath === 'string') {
              return { src: fileOrPath, rawSource: fileOrPath };
          }
          
          // It's a File object (Blob)
          return { src: URL.createObjectURL(fileOrPath), rawSource: fileOrPath };
      } catch (e) {
          console.error("Error getting source", e);
          return { src: null, rawSource: null };
      }
  };

  const cleanupUrl = () => {
      if (activeObjectUrlRef.current) URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
  };

  // 1. INITIALIZE & VOLUME
  useEffect(() => {
      audioEngine.init();
  }, []);

  useEffect(() => {
      audioEngine.setVolume(volume);
  }, [volume]);

  // 2. PLAY/PAUSE
  useEffect(() => {
      if (isPlaying) {
          const ctxData = initAudioContext();
          if (ctxData) setAnalyser(ctxData.analyser);
          
          audioEngine.play().catch(e => {
              if (e.name === 'NotAllowedError') setIsPlaying(false);
          });

          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      } else {
          audioEngine.pause();
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      }
  }, [isPlaying, setAnalyser, setIsPlaying]);

  // 3. LOAD SONG
  useEffect(() => {
      const loadSong = async () => {
          if (!currentSong) {
              audioEngine.pause();
              cleanupUrl();
              lastPlayedSourceRef.current = null;
              return;
          }

          const requestId = Date.now();
          playRequestRef.current = requestId;
          
          // Get the underlying file source
          const { src, rawSource } = await getSourceUrl(currentSong);

          // CHECK: Is this essentially the same file? (Metadata edit scenario)
          // If the rawSource (File object or Path string) matches the last played source,
          // AND the player currently has a source, we assume it's just a metadata update.
          const isMetadataUpdate = lastPlayedSourceRef.current === rawSource || 
                                   (rawSource instanceof File && lastPlayedSourceRef.current instanceof File && 
                                    rawSource.name === lastPlayedSourceRef.current.name && 
                                    rawSource.size === lastPlayedSourceRef.current.size);

          if (isMetadataUpdate && audioEngine.player.src) {
              // Just update the UI metadata without stopping audio
              updateMetadata(currentSong);
              // Clean up the NEW url created by getSourceUrl since we aren't using it
              if (src && src.startsWith('blob:')) URL.revokeObjectURL(src);
              return; 
          }

          // --- FULL LOAD (New Song) ---
          
          cleanupUrl(); // Clean old blob
          lastPlayedSourceRef.current = rawSource;

          if (!src) {
              setIsPlaying(false);
              return;
          }

          // Store URL for cleanup if it's a blob
          if (src.startsWith('blob:')) activeObjectUrlRef.current = src;

          if (playRequestRef.current !== requestId) return;

          // Update Metadata/History
          addRecentlyPlayed(currentSong);
          updateMetadata(currentSong);
          
          // Set Source and Play
          audioEngine.player.src = src;
          
          // Resume Logic
          const savedTime = songProgress[currentSong.id];
          if (savedTime && savedTime > 0 && savedTime < (currentSong.duration || 300) - 10) {
              audioEngine.player.currentTime = savedTime;
              consumeSongProgress(currentSong.id);
          } else {
              audioEngine.player.currentTime = 0;
          }

          if (isPlaying) {
              try {
                  await audioEngine.play();
              } catch(e) {
                  console.warn("Autoplay failed", e);
                  setIsPlaying(false);
              }
          }
      };

      loadSong();
  }, [currentSong?.id]); // Trigger on ID change

  // 4. UPDATE METADATA HELPER
  const updateMetadata = async (song: any) => {
      // Fetch full details if needed (e.g. loading from minimal state)
      // BUT avoid overwriting if we just edited locally (which populates description/lyrics)
      if (song.description === undefined) {
          const fullData = await getSongById(song.id);
          if (fullData) {
              // Merge to keep latest edit if any
              const merged = { ...fullData, ...song };
              updateSongInQueue(song.id, merged);
              updateSongInLibrary(song.id, merged);
          }
      }
      
      // Media Session
      if ('mediaSession' in navigator) {
          let coverUrl = song.coverUrl;
          
          // If we don't have a direct URL, try fetching from DB
          if (!coverUrl && song.hasCover) {
              const dbCover = await getSongCoverImage(song.id);
              if (dbCover) coverUrl = dbCover;
          }
          
          // Fallback to placeholder if absolutely nothing
          if (!coverUrl) coverUrl = ''; 

          navigator.mediaSession.metadata = new MediaMetadata({
              title: song.title,
              artist: song.artist,
              album: song.album,
              artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }] : []
          });
          
          // Setup Handlers
          navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
          navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
          navigator.mediaSession.setActionHandler('previoustrack', () => {
             if (audioEngine.player.currentTime > 3) audioEngine.player.currentTime = 0;
             else if (currentIndex !== null && currentIndex > 0) setCurrentIndex(currentIndex - 1);
          });
          navigator.mediaSession.setActionHandler('nexttrack', () => {
             if (currentIndex !== null && currentIndex < queue.length - 1) setCurrentIndex(currentIndex + 1);
          });
      }

      // Lyrics Auto-Load
      if (!song.lyrics || song.lyrics.length === 0) {
          const localLyrics = await loadLyricsFromStorage(song.artist, song.album, song.title);
          if (localLyrics) {
              const updated = { ...song, lyrics: localLyrics };
              updateSongInQueue(song.id, updated);
          }
      }
  };

  // 5. TIME UPDATE & ENDED
  useEffect(() => {
      let rafId: number;

      const loop = () => {
          const player = audioEngine.player;
          const ct = player.currentTime;
          const dur = player.duration;

          // Sync State
          if (!player.paused) {
             setCurrentTime(ct);
             if (!isNaN(dur) && dur > 0) setDuration(dur);
          }

          if (player.ended) {
              if (repeatMode === 'ONE') {
                  player.currentTime = 0;
                  player.play();
              } else {
                  if (currentIndex !== null && currentIndex < queue.length - 1) {
                      setCurrentIndex(currentIndex + 1);
                  } else if (repeatMode === 'ALL') {
                      setCurrentIndex(0);
                  } else {
                      setIsPlaying(false);
                  }
              }
          }

          rafId = requestAnimationFrame(loop);
      };

      rafId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(rafId);
  }, [isPlaying, currentIndex, queue, repeatMode]);

  return null;
};