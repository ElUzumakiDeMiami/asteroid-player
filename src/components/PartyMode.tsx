import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Song } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { SongArtwork } from './SongArtwork';
import { getArtistDetails } from '../services/artistDataService';
import { loadArtistMetadata } from '../services/fileSystemService';

interface PartyModeProps {
  onExit: () => void;
}

// Fallback images if no artist fanart is found
const DEFAULT_IMAGES = [
    "https://images.unsplash.com/photo-1534796636912-3b95b3ab5980?auto=format&fit=crop&w=1080&q=80", // Nebula
    "https://images.unsplash.com/photo-1614730341194-75c6074065db?auto=format&fit=crop&w=1080&q=80", // Abstract Purple
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1080&q=80", // Earth from space
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1080&q=80", // Neon Fluids
];

export const PartyMode: React.FC<PartyModeProps> = ({ onExit }) => {
  const { 
      queue, currentIndex, isPlaying, setIsPlaying, 
      currentTime, duration,
      isShuffled, toggleShuffle,
      repeatMode, toggleRepeat,
      localImageMap 
  } = usePlayerStore();
  const { seek } = useAudioPlayer();
  const { setCurrentIndex } = usePlayerStore();

  const currentSong = currentIndex !== null ? queue[currentIndex] : null;

  // States
  const [mode, setMode] = useState<'AWAKE' | 'ASLEEP'>('AWAKE');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideshowImages, setSlideshowImages] = useState<string[]>(DEFAULT_IMAGES);
  const [timeString, setTimeString] = useState("");
  const [dateString, setDateString] = useState("");
  
  // Interaction Refs
  const lastTapTimeRef = useRef<number>(0);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Constants
  const SLEEP_DELAY = 60000; // 1 minute to go to sleep
  const DOUBLE_TAP_DELAY = 300; // ms to consider a double tap

  // --- IMAGE FETCHING LOGIC ---
  useEffect(() => {
    if (!currentSong) return;

    let isMounted = true;
    const fetchVisuals = async () => {
        const artistName = currentSong.artist;
        const normalize = (str: string) => str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        
        let images: string[] = [];

        // 1. LOCAL IMAGES (High Priority)
        // Check for specific Song Match first "Artist - Title"
        const songKey = `${normalize(artistName)}_${normalize(currentSong.title)}`;
        if (localImageMap[songKey]) {
            images.push(...localImageMap[songKey]);
        }
        // Check for Artist Match
        const artistKey = normalize(artistName);
        if (localImageMap[artistKey]) {
            images.push(...localImageMap[artistKey]);
        }

        // 2. API IMAGES (Fallback/Supplement)
        const localMeta = await loadArtistMetadata(artistName);
        if (localMeta && localMeta.images && localMeta.images.length > 0) {
            images.push(...localMeta.images);
        } else {
            // Try Online if not in cache
            const onlineMeta = await getArtistDetails(artistName);
            if (onlineMeta && onlineMeta.images && onlineMeta.images.length > 0) {
                images.push(...onlineMeta.images);
            }
        }

        if (isMounted) {
            // Create a mix: Song Cover -> Found Images -> Fallback Abstracts
            const mix = [];
            if (currentSong.coverUrl) mix.push(currentSong.coverUrl);
            
            if (images.length > 0) {
                // Deduplicate
                const unique = Array.from(new Set(images));
                mix.push(...unique);
            } else {
                // If absolutely no images found, use defaults
                mix.push(...DEFAULT_IMAGES);
            }

            // Shuffle the abstracts in if we have very few real images to add variety
            if (mix.length < 3) {
                 mix.push(DEFAULT_IMAGES[Math.floor(Math.random() * DEFAULT_IMAGES.length)]);
            }

            setSlideshowImages(mix);
            setCurrentSlide(0);
        }
    };

    fetchVisuals();

    return () => { isMounted = false; };
  }, [currentSong?.id, currentSong?.artist, localImageMap]);


  // --- TIME & DATE CLOCK ---
  useEffect(() => {
      const updateClock = () => {
          const now = new Date();
          setTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
          setDateString(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));
      };
      updateClock();
      const interval = setInterval(updateClock, 1000);
      return () => clearInterval(interval);
  }, []);

  // --- SLEEP LOGIC ---
  const resetSleepTimer = useCallback(() => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      
      // Only set timer if currently AWAKE
      if (mode === 'AWAKE') {
          sleepTimerRef.current = setTimeout(() => {
              setMode('ASLEEP');
          }, SLEEP_DELAY);
      }
  }, [mode]);

  // Initial trigger
  useEffect(() => {
      resetSleepTimer();
      return () => { if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current); };
  }, [resetSleepTimer]);

  // --- SLIDESHOW LOGIC ---
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (mode === 'ASLEEP') {
          interval = setInterval(() => {
              setCurrentSlide(prev => (prev + 1) % slideshowImages.length);
          }, 10000); // Change image every 10s
      }
      return () => clearInterval(interval);
  }, [mode, slideshowImages.length]);

  // --- INTERACTION HANDLER (The Core Logic) ---
  const handleInteraction = useCallback((e?: React.MouseEvent | React.TouchEvent | KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;

      if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
          // DOUBLE TAP DETECTED
          if (doubleTapTimeoutRef.current) clearTimeout(doubleTapTimeoutRef.current);
          onExit(); // Wake up completely (Exit Party Mode)
      } else {
          // SINGLE TAP CANDIDATE
          lastTapTimeRef.current = now;
          
          if (mode === 'ASLEEP') {
              setMode('AWAKE');
              resetSleepTimer(); 
          } else {
              resetSleepTimer();
          }
      }
  }, [mode, onExit, resetSleepTimer]);

  // Keyboard Listener (Spacebar)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space') {
              handleInteraction(e);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInteraction]);


  // Playback Controls
  const handlePrev = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleInteraction();
      if (currentTime > 3) seek(0);
      else if (currentIndex !== null && currentIndex > 0) setCurrentIndex(currentIndex - 1);
      else if (repeatMode === 'ALL') setCurrentIndex(queue.length - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleInteraction();
      if (currentIndex !== null && currentIndex < queue.length - 1) setCurrentIndex(currentIndex + 1);
      else if (repeatMode === 'ALL') setCurrentIndex(0);
  };

  const togglePlayPause = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleInteraction();
      setIsPlaying(!isPlaying);
  };

  const handleShuffle = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleInteraction();
      toggleShuffle();
  }

  const handleRepeat = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleInteraction();
      toggleRepeat();
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  return (
    <div 
        className="fixed inset-0 z-[200] bg-black overflow-hidden font-sans select-none cursor-pointer"
        onClick={handleInteraction}
        onTouchStart={handleInteraction}
    >
        {/* --- BACKGROUND LAYER --- */}
        <div className="absolute inset-0 transition-opacity duration-1000 ease-in-out bg-black">
            {/* Awake Background: Song Cover Blur */}
            <div 
                className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ${mode === 'AWAKE' ? 'opacity-100 blur-3xl scale-110' : 'opacity-0'}`}
                style={{ backgroundImage: currentSong.coverUrl ? `url(${currentSong.coverUrl})` : 'none' }}
            />
            
            {/* Asleep Background: Slideshow (Artist Fanart + Cover) */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ${mode === 'ASLEEP' ? 'opacity-60' : 'opacity-0'}`}>
                {slideshowImages.map((img, idx) => (
                    <div 
                        key={idx}
                        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-2000 ease-in-out ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                        style={{ backgroundImage: `url(${img})` }}
                    />
                ))}
                {/* Dark overlay for readability when asleep */}
                <div className="absolute inset-0 bg-black/40"></div>
            </div>
        </div>

        {/* --- CONTENT LAYER --- */}
        <div className={`relative z-10 w-full h-full flex flex-col items-center justify-between px-6 py-3 transition-all duration-1000 ${mode === 'ASLEEP' ? 'brightness-75' : 'brightness-100'}`}>
            
            {/* TOP: CLOCK - Positioned much closer to top (mt-1) */}
            <div className="flex flex-col items-center text-center drop-shadow-lg flex-shrink-0 mt-1">
                <div className="text-sm md:text-base text-white/80 font-medium mb-0 tracking-wide">{dateString}</div>
                <div className="text-5xl md:text-7xl font-bold text-white tracking-tighter leading-none font-[system-ui]">{timeString}</div>
            </div>

            {/* MIDDLE: COVER ART (Only Awake) */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center py-4">
                <div 
                    className={`
                        relative aspect-square h-full w-auto max-w-full rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden bg-neutral-900
                        transition-all duration-1000 ease-in-out
                        ${mode === 'AWAKE' ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-10'}
                    `}
                >
                    <SongArtwork song={currentSong} className="w-full h-full object-cover" />
                </div>
            </div>

            {/* BOTTOM: COMPACT CONTROLS - Positioned closer to bottom (mb-3) */}
            <div className="w-full flex flex-col items-center flex-shrink-0 mb-3 origin-bottom transition-transform duration-300">
                
                {/* Song Info - Smaller text, closer to card (mb-2) */}
                <div className="text-center px-4 space-y-0.5 animate-fade-in mb-2">
                    <h2 className="text-lg md:text-xl font-bold text-white truncate drop-shadow-xl">{currentSong.title}</h2>
                    <p className="text-xs md:text-sm text-white/70 truncate drop-shadow-md">{currentSong.artist}</p>
                </div>
                
                {/* Card Container - Dynamic Sizing: 85% width for small screens, fixed for larger */}
                <div className="bg-neutral-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl py-3 px-4 md:py-4 md:px-6 shadow-2xl animate-fade-in flex flex-col gap-2 md:gap-3 w-[85%] max-w-[320px] md:max-w-[380px] transition-all duration-300">
                    
                    {/* 1. Compact Controls Row */}
                    <div className="flex items-center justify-between px-1 md:px-2">
                        {/* Shuffle */}
                        <button 
                            onClick={handleShuffle}
                            className={`p-1.5 md:p-2 transition ${isShuffled ? 'text-accent' : 'text-white/40 hover:text-white'}`}
                        >
                            <Shuffle size={18} className="md:w-5 md:h-5" />
                        </button>

                        {/* Prev */}
                        <button onClick={handlePrev} className="text-white hover:text-accent transition p-1.5 md:p-2 rounded-full hover:bg-white/5">
                            <SkipBack size={24} className="md:w-7 md:h-7" fill="currentColor" />
                        </button>
                        
                        {/* Play/Pause (Matches normal player size) */}
                        <button 
                            onClick={togglePlayPause} 
                            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg shadow-white/20"
                        >
                            {isPlaying ? <Pause size={24} className="md:w-[28px] md:h-[28px]" fill="currentColor" /> : <Play size={24} className="ml-1 md:w-[28px] md:h-[28px]" fill="currentColor" />}
                        </button>
                        
                        {/* Next */}
                        <button onClick={handleNext} className="text-white hover:text-accent transition p-1.5 md:p-2 rounded-full hover:bg-white/5">
                            <SkipForward size={24} className="md:w-7 md:h-7" fill="currentColor" />
                        </button>

                        {/* Repeat */}
                        <button 
                            onClick={handleRepeat}
                            className={`p-1.5 md:p-2 transition ${repeatMode !== 'OFF' ? 'text-accent' : 'text-white/40 hover:text-white'}`}
                        >
                            {repeatMode === 'ONE' ? <Repeat1 size={18} className="md:w-5 md:h-5" /> : <Repeat size={18} className="md:w-5 md:h-5" />}
                        </button>
                    </div>

                    {/* 2. Scrubber */}
                    <div className="w-full flex items-center gap-3 text-[10px] text-white/50 font-medium font-mono">
                        <span className="w-8 text-right">{formatTime(currentTime)}</span>
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                            <div 
                                className="h-full bg-white rounded-full transition-all duration-300 ease-linear shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                            />
                        </div>
                        <span className="w-8">{formatTime(duration)}</span>
                    </div>
                </div>

                <p className="text-[9px] text-white/30 uppercase tracking-widest animate-pulse mt-2">Double Tap to Exit</p>
            </div>
        </div>
    </div>
  );
};