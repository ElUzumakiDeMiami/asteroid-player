import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Song, LyricsLine } from '../types';
import { LyricsView } from './LyricsView';
import { VisualizerView } from './VisualizerView';
import { QueueView } from './QueueView';
import { MusicPlayer } from './MusicPlayer';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1, MoreHorizontal, Mic2, Activity, Maximize2, Repeat, Shuffle, ListMusic, Repeat1, Info, ListPlus, FileText, Sliders } from 'lucide-react';
import { QueueAddView } from './QueueAddView';
import { usePlayerStore } from '../store/playerStore';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

export type PlayerViewMode = 'STANDARD' | 'LYRICS' | 'VISUALIZER' | 'QUEUE' | 'QUEUE_ADD';

interface FullScreenPlayerProps {
  initialViewMode?: PlayerViewMode;
  onLyricsUpdate?: (lyrics: LyricsLine[]) => void;
  // UI callbacks still needed from App.tsx due to modal handling
  onMinimize?: () => void;
  onArtistClick: (artist: string) => void;
  onAlbumClick: (album: string) => void;
  onOpenAbout: () => void;
  onAddToPlaylist: () => void;
  onOpenFileInfo: () => void;
  onSaveQueue: () => void;
}

export const FullScreenPlayer: React.FC<FullScreenPlayerProps> = ({
  initialViewMode = 'STANDARD',
  onLyricsUpdate,
  onArtistClick,
  onAlbumClick,
  onOpenAbout,
  onAddToPlaylist,
  onOpenFileInfo,
  onSaveQueue,
  onMinimize
}) => {
  
  // ZUSTAND
  const {
      queue, currentIndex, isPlaying, setIsPlaying,
      volume, setVolume,
      currentTime, duration,
      isShuffled, toggleShuffle,
      repeatMode, toggleRepeat,
      addToQueue,
      setCurrentIndex,
      analyser,
      library,
      bulkAddToQueue,
      queueTitle,
      reorderQueue,
      setQueue, 
      setOriginalQueue,
      setIsFullScreenPlayer,
      clearQueue,
      setActiveModal
  } = usePlayerStore();

  const { seek } = useAudioPlayer();

  const currentSong = currentIndex !== null ? queue[currentIndex] : null;

  const [viewMode, setLocalViewMode] = useState<PlayerViewMode>(initialViewMode);
  const [queueAddMode, setQueueAddMode] = useState<'NEXT' | 'END'>('NEXT');
  
  // Settings State (Persisted)
  const [bgBlur, setBgBlur] = useState(() => parseInt(localStorage.getItem('lyrics_blur') || '60'));
  const [bgOpacity, setBgOpacity] = useState(() => parseFloat(localStorage.getItem('lyrics_opacity') || '0.6'));
  const [barBlur, setBarBlur] = useState(() => parseInt(localStorage.getItem('bar_blur') || '20'));
  const [barOpacity, setBarOpacity] = useState(() => parseFloat(localStorage.getItem('bar_opacity') || '0.7'));

  const [isImmersive, setIsImmersive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  
  // Swipe Gestures
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const SWIPE_THRESHOLD = 150; // px to trigger close

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ... (Existing touch logic & useEffects remain the same) ...

  const handleTouchStart = (e: React.TouchEvent) => {
      if (viewMode === 'QUEUE' || viewMode === 'QUEUE_ADD') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && target.getAttribute('type') === 'range') return;
      setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (viewMode === 'QUEUE' || viewMode === 'QUEUE_ADD') return;
      if (touchStartY === null) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY;

      if (diff > 0) {
          setSwipeOffset(diff);
      }
  };

  const handleTouchEnd = () => {
      if (swipeOffset > SWIPE_THRESHOLD) {
          handleMinimize();
      }
      setTouchStartY(null);
      setSwipeOffset(0);
  };

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (
            isMenuOpen && 
            menuRef.current && !menuRef.current.contains(event.target as Node) &&
            buttonRef.current && !buttonRef.current.contains(event.target as Node)
          ) {
              setIsMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  useEffect(() => {
      localStorage.setItem('lyrics_blur', bgBlur.toString());
      localStorage.setItem('lyrics_opacity', bgOpacity.toString());
      localStorage.setItem('bar_blur', barBlur.toString());
      localStorage.setItem('bar_opacity', barOpacity.toString());
  }, [bgBlur, bgOpacity, barBlur, barOpacity]);

  if (!currentSong) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVolumeIcon = () => {
      if (volume === 0) return <VolumeX size={20} />;
      if (volume < 0.5) return <Volume1 size={20} />;
      return <Volume2 size={20} />;
  };

  const toggleMenu = () => {
      if (isMenuOpen) {
          setIsMenuOpen(false);
      } else if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          setMenuStyle({
              top: `${rect.bottom + 10}px`,
              right: `${window.innerWidth - rect.right}px`
          });
          setIsMenuOpen(true);
      }
  };

  const handleMenuAction = (action: () => void) => {
      setIsMenuOpen(false);
      action();
  };

  const handleMinimize = () => {
      setIsFullScreenPlayer(false);
      if (onMinimize) onMinimize();
  }

  // --- SMART VIEW TOGGLE LOGIC ---
  const toggleView = (mode: PlayerViewMode) => {
      if (viewMode === mode) {
          // If turning off the current mode...
          if (initialViewMode === 'STANDARD') {
              // If we originally opened the player in Standard mode (Expanded from miniplayer),
              // return to Standard mode.
              setLocalViewMode('STANDARD');
          } else {
              // If we originally opened the player directly into a specific mode (Lyrics/Queue/Visualizer),
              // minimize back to the library.
              handleMinimize();
          }
      } else {
          // Switching to a new mode
          setLocalViewMode(mode);
      }
  };

  const handleOpenAddTracks = (mode: 'NEXT' | 'END') => {
      setQueueAddMode(mode);
      setLocalViewMode('QUEUE_ADD');
  };

  const handleConfirmAddTracks = (selectedSongs: Song[]) => {
      bulkAddToQueue(selectedSongs, queueAddMode);
      setLocalViewMode('QUEUE');
  };

  const handlePrev = () => {
      if (currentTime > 3) {
          seek(0);
          return;
      }
      if (currentIndex !== null && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
      } else if (repeatMode === 'ALL') {
          setCurrentIndex(queue.length - 1);
      } else {
          seek(0);
      }
  };

  const handleNext = () => {
      if (currentIndex !== null && currentIndex < queue.length - 1) {
          setCurrentIndex(currentIndex + 1);
      } else if (repeatMode === 'ALL') {
          setCurrentIndex(0);
      }
  };

  const togglePlayPause = () => setIsPlaying(!isPlaying);

  return (
    <div 
        ref={containerRef}
        className={`flex-1 flex flex-col h-full overflow-hidden animate-fade-in bg-black relative ${viewMode === 'STANDARD' ? 'touch-none' : 'touch-auto'}`}
        style={{ 
            transform: `translateY(${swipeOffset}px)`,
            transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
            opacity: 1 - (swipeOffset / (window.innerHeight * 0.8))
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      
      {/* ----------------- MODE: VISUALIZER ----------------- */}
      {viewMode === 'VISUALIZER' && (
          <div className="relative w-full h-full">
            <VisualizerView 
                currentSong={currentSong}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                volume={volume}
                analyser={analyser || null}
                onPlayPause={togglePlayPause}
                onNext={handleNext}
                onPrev={handlePrev}
                onSeek={seek}
                onVolumeChange={setVolume}
                onMinimize={handleMinimize}
                onExitVisualizer={() => toggleView('VISUALIZER')}
                onSwitchToLyrics={() => toggleView('LYRICS')}
                onOpenAbout={onOpenAbout}
                onAddToPlaylist={onAddToPlaylist}
                onOpenFileInfo={onOpenFileInfo}
                onArtistClick={onArtistClick}
                onAlbumClick={onAlbumClick}
                onOpenQueue={() => toggleView('QUEUE')}
                isShuffled={isShuffled}
                repeatMode={repeatMode}
                onToggleShuffle={toggleShuffle}
                onToggleRepeat={toggleRepeat}
            />
          </div>
      )}

      {/* ----------------- MODE: STANDARD ----------------- */}
      {viewMode === 'STANDARD' && (
          <div className="flex flex-col md:flex-row h-full relative">
            
            {/* Left Side (Cover Art) */}
            <div className="w-full md:w-1/2 h-[45vh] md:h-full flex flex-col p-6 md:p-12 relative z-10 transition-all duration-500">
                <div className="flex-shrink-0 flex justify-start mb-4">
                    <button 
                        onClick={handleMinimize}
                        className="p-3 bg-black/20 hover:bg-white/10 backdrop-blur-md rounded-full text-white/60 hover:text-white transition"
                        title="Minimize Player"
                    >
                        <ChevronDown size={24} />
                    </button>
                </div>

                <div className="flex-1 min-h-0 flex items-center justify-center w-full overflow-hidden">
                    <img 
                        src={currentSong.coverUrl || "https://picsum.photos/800"} 
                        alt="Album Art" 
                        className="aspect-square max-w-full max-h-full w-auto h-auto object-cover rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-neutral-900 ring-1 ring-white/10 scale-100 transition-all duration-1000 ease-in-out"
                    />
                </div>
            </div>

            {/* Right Side (Controls) */}
            <div className="w-full md:w-1/2 h-[55vh] md:h-full flex flex-col justify-center px-8 md:px-20 lg:px-24 bg-neutral-900/30 backdrop-blur-sm z-10 border-l border-white/5 transition-all duration-700 ease-in-out">
                
                <div className="mb-8 md:mb-12 flex items-start justify-between gap-4">
                        <div className="text-center md:text-left flex-1 min-w-0">
                            <h2 className="text-3xl md:text-5xl font-bold text-white mb-2 md:mb-4 leading-tight line-clamp-2">{currentSong.title}</h2>
                            <h3 className="text-xl md:text-2xl text-accent font-medium cursor-pointer hover:underline truncate" onClick={() => onArtistClick(currentSong.artist)}>{currentSong.artist}</h3>
                            <p className="text-white/40 text-base md:text-lg mt-1 cursor-pointer hover:underline truncate" onClick={() => currentSong.album && onAlbumClick(currentSong.album)}>{currentSong.album}</p>
                        </div>

                        <div className="relative pt-2">
                            <button 
                                ref={buttonRef}
                                onClick={toggleMenu}
                                className={`p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition ${isMenuOpen ? 'text-white bg-white/10' : ''}`}
                                title="More Options"
                            >
                                <MoreHorizontal size={24} />
                            </button>
                        </div>
                </div>

                {/* Progress Bar & Controls (Same as before) */}
                <div className="mb-8 md:mb-12 group/scrubber">
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={(e) => seek(Number(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                        />
                        <div className="flex justify-between text-xs md:text-sm text-white/30 font-medium mt-2">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-8 md:mb-12 gap-4">
                        <button onClick={toggleShuffle} className={`transition ${isShuffled ? 'text-accent' : 'text-white/40 hover:text-white'}`}><Shuffle size={20} /></button>
                        <div className="flex items-center gap-6 md:gap-8">
                            <button onClick={handlePrev} className="text-white hover:text-accent transition p-2 hover:bg-white/5 rounded-full"><SkipBack size={32} fill="currentColor"/></button>
                            <button onClick={togglePlayPause} className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-xl shadow-white/10">
                                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                            </button>
                            <button onClick={handleNext} className="text-white hover:text-accent transition p-2 hover:bg-white/5 rounded-full"><SkipForward size={32} fill="currentColor"/></button>
                        </div>
                        <button onClick={toggleRepeat} className={`transition ${repeatMode !== 'OFF' ? 'text-accent' : 'text-white/40 hover:text-white'}`}>
                            {repeatMode === 'ONE' ? <Repeat1 size={20} /> : <Repeat size={20} />}
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-6">
                        <button onClick={() => toggleView('QUEUE')} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition flex items-center justify-center" title="Queue"><ListMusic size={18} /></button>
                        <button onClick={() => toggleView('VISUALIZER')} className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap" title="Visualizer Mode"><Activity size={16} /><span className="hidden sm:inline">Visualizer</span></button>
                        <button onClick={() => toggleView('LYRICS')} className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap" title="Lyrics"><Mic2 size={16} /> <span className="hidden sm:inline">Lyrics</span></button>
                        <div className="relative flex items-center z-50 md:mr-20">
                            <button onClick={() => setIsVolumeOpen(!isVolumeOpen)} className={`relative z-20 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-colors ${isVolumeOpen ? 'text-white bg-white/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}>{getVolumeIcon()}</button>
                            <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-10 flex items-center pl-10 pr-3 bg-neutral-800/90 backdrop-blur-md border border-white/10 rounded-full transition-all duration-300 ease-out origin-left shadow-xl ${isVolumeOpen ? 'w-28 md:w-32 opacity-100 scale-100 pointer-events-auto' : 'w-9 opacity-0 scale-90 pointer-events-none'}`}>
                                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white" />
                            </div>
                        </div>
                    </div>
            </div>

            {/* MODIFIED: Popup Menu includes Equalizer */}
            {isMenuOpen && ReactDOM.createPortal(
                <div 
                    ref={menuRef}
                    className={`fixed z-[9999] w-64 bg-neutral-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in origin-top-right`}
                    style={menuStyle}
                >
                    <button onClick={() => handleMenuAction(() => setActiveModal('equalizer'))} className="flex items-center gap-3 px-4 py-4 hover:bg-white/10 text-sm font-medium text-left border-b border-white/5">
                        <Sliders size={18} /> Equalizer
                    </button>
                    
                    <button onClick={() => handleMenuAction(onAddToPlaylist)} className="flex items-center gap-3 px-4 py-4 hover:bg-white/10 text-sm font-medium text-left"><ListPlus size={18} /> Add to Playlist</button>
                    <button onClick={() => handleMenuAction(onOpenAbout)} className="flex items-center gap-3 px-4 py-4 hover:bg-white/10 text-sm font-medium text-left"><Info size={18} /> About Song</button>
                    <button onClick={() => handleMenuAction(onOpenFileInfo)} className="flex items-center gap-3 px-4 py-4 hover:bg-white/10 text-sm font-medium text-left border-t border-white/5"><FileText size={18} /> File Info / Edit</button>
                </div>,
                document.body
            )}
          </div>
      )}

      {/* Mode Renderers (Lyrics, Queue, QueueAdd) - Unchanged */}
      {viewMode === 'LYRICS' && (
         <div className="absolute inset-0 z-10 block bg-black animate-fade-in overflow-hidden">
             {/* Background & Overlays */}
             <div className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-1000 ease-in-out" style={{ backgroundImage: currentSong.coverUrl ? `url(${currentSong.coverUrl})` : 'none', filter: `blur(${bgBlur}px)`, transform: 'scale(1.1)' }}/>
             <div className="absolute inset-0 pointer-events-none transition-all duration-300" style={{ backgroundColor: `rgba(0,0,0,${bgOpacity})` }}/>

             <div className="absolute inset-0 z-10 overflow-hidden bg-transparent">
                 <button onClick={(e) => { e.stopPropagation(); handleMinimize(); }} className={`absolute top-6 left-6 z-50 p-3 bg-black/20 hover:bg-white/10 backdrop-blur-md rounded-full text-white/60 hover:text-white transition duration-500 ${isImmersive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><ChevronDown size={24} /></button>
                <LyricsView song={currentSong} currentTime={currentTime} onLyricsUpdate={onLyricsUpdate || (() => {})} onSeek={seek} bgBlur={bgBlur} setBgBlur={setBgBlur} bgOpacity={bgOpacity} setBgOpacity={setBgOpacity} barBlur={barBlur} setBarBlur={setBarBlur} barOpacity={barOpacity} setBarOpacity={setBarOpacity} isImmersive={isImmersive} setIsImmersive={setIsImmersive} />
             </div>

             <div className={`absolute bottom-0 left-0 w-full z-50 transition-all duration-700 ease-in-out ${isImmersive ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`} onClick={(e) => e.stopPropagation()}>
                <MusicPlayer onToggleFullScreen={handleMinimize} onArtistClick={() => onArtistClick && onArtistClick(currentSong.artist)} onAlbumClick={() => onAlbumClick && currentSong.album && onAlbumClick(currentSong.album)} onOpenAbout={onOpenAbout} onAddToPlaylist={onAddToPlaylist} onOpenFileInfo={onOpenFileInfo} onOpenVisualizer={() => toggleView('VISUALIZER')} onOpenLyrics={() => toggleView('LYRICS')} onOpenQueue={() => toggleView('QUEUE')} className="border-t border-white/5" style={{ backgroundColor: `rgba(0,0,0,${barOpacity})`, backdropFilter: `blur(${barBlur}px)`, WebkitBackdropFilter: `blur(${barBlur}px)` }} isFullScreen={true} />
             </div>
         </div>
      )}

      {viewMode === 'QUEUE' && (
          <div className="absolute inset-0 z-10 block bg-black animate-fade-in overflow-hidden">
                <div className="absolute inset-0 z-10 overflow-hidden bg-transparent">
                    <button onClick={handleMinimize} className="absolute top-6 left-6 z-50 p-3 bg-black/20 hover:bg-white/10 backdrop-blur-md rounded-full text-white/60 hover:text-white transition duration-500 opacity-100"><ChevronDown size={24} /></button>
                    <QueueView songs={queue} currentIndex={currentIndex || 0} onPlaySong={(index) => { setCurrentIndex(index); setIsPlaying(true); }} queueTitle={queueTitle} onReorderQueue={reorderQueue} onSaveQueue={onSaveQueue} onClearQueue={clearQueue} onAddTracksNext={() => handleOpenAddTracks('NEXT')} onAddTracksEnd={() => handleOpenAddTracks('END')} />
                </div>
                <div className="absolute bottom-0 left-0 w-full transition-all duration-700 ease-in-out translate-y-0 opacity-100 z-50">
                    <MusicPlayer onToggleFullScreen={handleMinimize} onArtistClick={() => onArtistClick && onArtistClick(currentSong.artist)} onAlbumClick={() => onAlbumClick && currentSong.album && onAlbumClick(currentSong.album)} onOpenAbout={onOpenAbout} onAddToPlaylist={onAddToPlaylist} onOpenFileInfo={onOpenFileInfo} onOpenVisualizer={() => toggleView('VISUALIZER')} onOpenLyrics={() => toggleView('LYRICS')} onOpenQueue={() => toggleView('QUEUE')} className="border-t border-white/5" style={{ backgroundColor: `rgba(0,0,0,${barOpacity})`, backdropFilter: `blur(${barBlur}px)`, WebkitBackdropFilter: `blur(${barBlur}px)` }} isFullScreen={true} />
                </div>
          </div>
      )}

      {viewMode === 'QUEUE_ADD' && (
          <QueueAddView songs={library} onConfirm={handleConfirmAddTracks} onCancel={() => setLocalViewMode('QUEUE')} mode={queueAddMode} />
      )}
    </div>
  );
};