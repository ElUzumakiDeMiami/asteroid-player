
import React, { useState } from 'react';
import { Song } from '../types';
import { Visualizer } from './Visualizer';
import { ChevronDown } from 'lucide-react';
import { MusicPlayer } from './MusicPlayer';

interface VisualizerViewProps {
  currentSong: Song;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  analyser: AnalyserNode | null;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onMinimize: () => void;
  onExitVisualizer: () => void;
  onSwitchToLyrics: () => void;
  onOpenAbout: () => void;
  onAddToPlaylist: () => void;
  onOpenFileInfo: () => void;
  onArtistClick?: (artist: string) => void;
  onAlbumClick?: (album: string) => void;
  onOpenQueue: () => void;
  // New Props for Shuffle/Repeat
  isShuffled?: boolean;
  repeatMode?: 'OFF' | 'ALL' | 'ONE';
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
}

export const VisualizerView: React.FC<VisualizerViewProps> = ({
  currentSong,
  currentTime,
  duration,
  isPlaying,
  volume,
  analyser,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onMinimize,
  onExitVisualizer,
  onSwitchToLyrics,
  onOpenAbout,
  onAddToPlaylist,
  onOpenFileInfo,
  onArtistClick,
  onAlbumClick,
  onOpenQueue,
  isShuffled = false,
  repeatMode = 'OFF',
  onToggleShuffle,
  onToggleRepeat
}) => {
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-black animate-fade-in">
        <div className="flex-1 relative overflow-hidden">
            {/* Visualizer Canvas */}
            {analyser && <Visualizer analyser={analyser} isPlaying={isPlaying} className="opacity-100" />}
            
            {/* Top Left Minimize (Floating) */}
            <button 
                onClick={onMinimize}
                className="absolute top-6 left-6 z-50 p-3 bg-black/20 hover:bg-white/10 backdrop-blur-md rounded-full text-white/60 hover:text-white transition"
            >
                <ChevronDown size={24} />
            </button>
        </div>

        {/* Unified Player Bar */}
        <MusicPlayer
            onToggleFullScreen={onMinimize}
            onArtistClick={() => onArtistClick && onArtistClick(currentSong.artist)}
            onAlbumClick={() => onAlbumClick && currentSong.album && onAlbumClick(currentSong.album)}
            onOpenAbout={onOpenAbout}
            onAddToPlaylist={onAddToPlaylist}
            onOpenFileInfo={onOpenFileInfo}
            onOpenVisualizer={onExitVisualizer} // Toggle off
            onOpenLyrics={onSwitchToLyrics}
            onOpenQueue={onOpenQueue}
            className="absolute bottom-0 left-0 w-full border-t border-white/5"
            style={{
                backgroundColor: `rgba(0,0,0,0.6)`,
                backdropFilter: `blur(20px)`,
                WebkitBackdropFilter: `blur(20px)`
            }}
            isFullScreen={true}
        />
    </div>
  );
};
