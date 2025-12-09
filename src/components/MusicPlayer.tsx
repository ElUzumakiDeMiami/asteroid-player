import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Volume1, Repeat, Shuffle, Maximize2, Mic2, MoreHorizontal, Info, ListPlus, FileText, Activity, ListMusic, Repeat1 } from 'lucide-react';
import { Song, PlaybackState } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { SongArtwork } from './SongArtwork';

interface MusicPlayerProps {
  onToggleFullScreen: () => void;
  onArtistClick?: () => void;
  onAlbumClick?: () => void;
  onOpenAbout: () => void;
  onAddToPlaylist: () => void;
  onOpenFileInfo: () => void;
  onOpenVisualizer: () => void;
  onOpenLyrics: () => void;
  onOpenQueue: () => void;
  // Customization for FullScreen reuse
  className?: string;
  style?: React.CSSProperties;
  isFullScreen?: boolean;
  hasSongs?: boolean;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  onToggleFullScreen,
  onArtistClick,
  onAlbumClick,
  onOpenAbout,
  onAddToPlaylist,
  onOpenFileInfo,
  onOpenVisualizer,
  onOpenLyrics,
  onOpenQueue,
  className = "",
  style = {},
  isFullScreen = false,
  hasSongs = false
}) => {
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ bottom: 0, left: 0 });
  
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ZUSTAND
  const {
      queue, currentIndex, isPlaying, setIsPlaying,
      volume, setVolume,
      currentTime, duration,
      isShuffled, toggleShuffle,
      repeatMode, toggleRepeat,
      setCurrentIndex
  } = usePlayerStore();

  const { seek } = useAudioPlayer();

  const currentSong = currentIndex !== null ? queue[currentIndex] : null;

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (
              isMenuOpen &&
              menuRef.current && 
              !menuRef.current.contains(event.target as Node) &&
              buttonRef.current &&
              !buttonRef.current.contains(event.target as Node)
          ) {
              setIsMenuOpen(false);
          }
      };
      
      const handleScroll = () => {
          if (isMenuOpen) setIsMenuOpen(false);
      };

      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          window.removeEventListener('scroll', handleScroll, true);
      };
  }, [isMenuOpen]);

  const toggleMenu = () => {
      if (isMenuOpen) {
          setIsMenuOpen(false);
      } else if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const openUp = window.innerHeight - rect.bottom < 200;
          
          setMenuPosition({
              bottom: openUp ? window.innerHeight - rect.top + 8 : 0, 
              left: rect.left
          });
          setIsMenuOpen(true);
      }
  };

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

  const handleMenuAction = (action: () => void) => {
      setIsMenuOpen(false);
      action();
  };

  const handleNext = () => {
      if (currentIndex !== null && currentIndex < queue.length - 1) {
          setCurrentIndex(currentIndex + 1);
      } else if (repeatMode === 'ALL') {
          setCurrentIndex(0);
      }
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

  const togglePlayPause = () => {
      if (currentSong) {
          setIsPlaying(!isPlaying);
      } else if (queue.length > 0) {
          setCurrentIndex(0);
          setIsPlaying(true);
      }
  };

  const isDisabled = !currentSong;

  return (
    <div 
        className={`h-24 w-full bg-glass-bg backdrop-blur-xl border-t border-glass-border flex items-center justify-between px-4 md:px-6 z-50 select-none transition-all duration-300 ${className}`}
        style={style}
    >
      {/* Left: Song Info - Responsive width */}
      <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 mr-4">
        {currentSong ? (
          <>
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-md overflow-hidden shadow-lg relative group bg-neutral-800 flex-shrink-0">
              <SongArtwork 
                song={currentSong} 
                className="w-full h-full object-cover"
              />
               <div 
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                onClick={onToggleFullScreen}
               >
                  <Maximize2 size={20} className="text-white" />
               </div>
            </div>
            <div className="flex flex-col justify-center overflow-hidden mr-1 min-w-0">
              <h4 className="font-semibold text-white truncate text-sm md:text-base cursor-default" title={currentSong.title}>{currentSong.title}</h4>
              <div className="flex items-center gap-1 text-xs md:text-sm text-neutral-400 truncate">
                 <span 
                    onClick={onArtistClick} 
                    className={`truncate ${onArtistClick ? 'hover:text-white hover:underline cursor-pointer' : ''}`}
                 >
                    {currentSong.artist}
                 </span>
                 {currentSong.album && (
                    <span className="hidden sm:inline truncate">
                        <span className="text-neutral-600 mx-1">•</span>
                        <span 
                            onClick={onAlbumClick} 
                            className={`${onAlbumClick ? 'hover:text-white hover:underline cursor-pointer' : ''}`}
                        >
                            {currentSong.album}
                        </span>
                    </span>
                 )}
              </div>
            </div>

            {/* Menu Button */}
            <div className="relative flex-shrink-0">
                <button 
                    ref={buttonRef}
                    onClick={toggleMenu}
                    className={`p-2 rounded-full transition ${isMenuOpen ? 'text-white bg-white/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}
                    title="More Options"
                >
                    <MoreHorizontal size={18} />
                </button>
                
                {isMenuOpen && ReactDOM.createPortal(
                    <div 
                        ref={menuRef}
                        className="fixed z-[9999] w-64 bg-neutral-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in origin-bottom-left"
                        style={{ 
                            bottom: `${menuPosition.bottom}px`, 
                            left: `${menuPosition.left}px` 
                        }}
                    >
                        <button 
                            onClick={() => handleMenuAction(onOpenAbout)} 
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm font-medium text-left text-white"
                        >
                            <Info size={16} /> About Song
                        </button>
                        <button 
                            onClick={() => handleMenuAction(onAddToPlaylist)} 
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm font-medium text-left text-white"
                        >
                            <ListPlus size={16} /> Add to Playlist
                        </button>
                        <button 
                            onClick={() => handleMenuAction(onOpenFileInfo)} 
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm font-medium text-left text-white border-t border-white/5"
                        >
                            <FileText size={16} /> File Info / Edit
                        </button>
                    </div>,
                    document.body
                )}
            </div>
          </>
        ) : (
          <div className="text-neutral-500 text-sm">Select a song to play</div>
        )}
      </div>

      {/* Center: Controls - Responsive Hiding */}
      <div className="flex flex-col items-center gap-1 w-full max-w-md md:w-auto md:flex-1">
        <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
          <button 
            onClick={toggleShuffle}
            disabled={isDisabled}
            className={`transition ${isDisabled ? 'text-white/10 cursor-not-allowed' : isShuffled ? 'text-accent' : 'text-white/40 hover:text-white'}`}
          >
            <Shuffle size={18} />
          </button>
          
          <button 
            onClick={handlePrev} 
            disabled={isDisabled}
            className={`transition p-2 rounded-full ${isDisabled ? 'text-white/10 cursor-not-allowed' : 'text-white hover:text-accent hover:bg-white/5'}`}
          >
            <SkipBack className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" />
          </button>
          
          <button 
            onClick={togglePlayPause} 
            disabled={isDisabled && !hasSongs} // Can play if library has songs but no current song loaded
            className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition shadow-lg ${isDisabled && !hasSongs ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-white text-black hover:scale-105 shadow-white/10'}`}
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
          
          <button 
            onClick={handleNext} 
            disabled={isDisabled}
            className={`transition p-2 rounded-full ${isDisabled ? 'text-white/10 cursor-not-allowed' : 'text-white hover:text-accent hover:bg-white/5'}`}
          >
            <SkipForward className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" />
          </button>
          
          <button 
            onClick={toggleRepeat}
            disabled={isDisabled}
            className={`transition ${isDisabled ? 'text-white/10 cursor-not-allowed' : repeatMode !== 'OFF' ? 'text-accent' : 'text-white/40 hover:text-white'}`}
          >
            {repeatMode === 'ONE' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>
        
        <div className="w-full flex items-center gap-2 text-[10px] md:text-xs text-neutral-400 font-medium group px-2 sm:px-0">
          <span className="w-8 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            disabled={isDisabled}
            onChange={(e) => seek(Number(e.target.value))}
            className={`flex-1 h-1 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full transition-all ${isDisabled ? 'bg-neutral-800 cursor-not-allowed [&::-webkit-slider-thumb]:bg-neutral-600' : 'bg-neutral-700 cursor-pointer [&::-webkit-slider-thumb]:bg-white group-hover:[&::-webkit-slider-thumb]:scale-125'}`}
          />
          <span className="w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Extras - Responsive */}
      <div className="flex items-center justify-end gap-2 md:gap-3 flex-1 min-w-0 ml-4">
        
        {/* Queue Button (Circular) - First */}
        <button 
            onClick={onOpenQueue}
            disabled={isDisabled}
            className={`hidden md:flex w-9 h-9 rounded-full transition items-center justify-center ${isDisabled ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'}`}
            title="Queue"
        >
            <ListMusic size={18} />
        </button>

        {/* Visualizer Button (Pill) - Second */}
        <button 
            onClick={onOpenVisualizer}
            disabled={isDisabled}
            className={`hidden md:flex px-4 py-2 rounded-full transition items-center gap-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap ${isDisabled ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'}`}
            title="Visualizer"
        >
            <Activity size={16} />
            <span className="hidden xl:inline">Visualizer</span>
        </button>

        {/* Lyrics Button (Pill) - Third */}
        <button 
            onClick={onOpenLyrics}
            disabled={isDisabled}
            className={`hidden md:flex px-4 py-2 rounded-full transition items-center gap-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap ${isDisabled ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'}`}
            title="Lyrics"
        >
            <Mic2 size={16} />
            <span className="hidden xl:inline">Lyrics</span>
        </button>
        
        {/* Mobile Lyrics Icon Only */}
        <button 
            onClick={onToggleFullScreen}
            disabled={isDisabled}
            className={`md:hidden p-2 transition ${isDisabled ? 'text-white/20 cursor-not-allowed' : 'text-white/60 hover:text-white'}`}
        >
             <Mic2 size={20} />
        </button>

        {/* Volume Control - Last with margin */}
        <div 
            className="relative flex items-center z-50 md:mr-20"
        >
            <button 
                onClick={() => setIsVolumeOpen(!isVolumeOpen)} 
                className={`relative z-20 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-colors ${isVolumeOpen ? 'text-white bg-white/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}
                title="Volume"
            >
                {getVolumeIcon()}
            </button>
            
            <div 
                className={`
                    absolute left-0 top-1/2 -translate-y-1/2 h-10 flex items-center pl-10 pr-3 
                    bg-neutral-800/90 backdrop-blur-md border border-white/10 rounded-full 
                    transition-all duration-300 ease-out origin-left shadow-xl
                    ${isVolumeOpen ? 'w-28 md:w-32 opacity-100 scale-100 pointer-events-auto' : 'w-9 opacity-0 scale-90 pointer-events-none'}
                `}
            >
                 <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
            </div>
        </div>

        {/* Full Screen */}
        <button 
            className={`p-2 rounded-full transition hidden sm:block ${isDisabled ? 'text-white/20 cursor-not-allowed' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} 
            onClick={onToggleFullScreen}
            disabled={isDisabled}
            title={isFullScreen ? "Minimize" : "Full Screen"}
        >
             {isFullScreen ? <Maximize2 size={20} className="rotate-180" /> : <Maximize2 size={20} />}
        </button>
      </div>
    </div>
  );
};