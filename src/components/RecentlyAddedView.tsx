
import React from 'react';
import { Song } from '../types';
import { ChevronLeft, Play, Calendar } from 'lucide-react';

interface RecentlyAddedViewProps {
  songs: Song[];
  onSongSelect: (song: Song) => void;
  onBack: () => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
}

export const RecentlyAddedView: React.FC<RecentlyAddedViewProps> = ({ 
    songs, 
    onSongSelect, 
    onBack,
    currentSong,
    isPlaying
}) => {
  // Get last 100 songs sorted by addedAt descending
  const recentSongs = [...songs]
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    .slice(0, 100);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-black p-6 md:p-12 pb-32 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 sticky top-0 bg-black/95 z-20 py-4 border-b border-white/10 backdrop-blur-xl">
             <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition">
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold">Recently Added</h2>
                    <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Last 100 Tracks</p>
                </div>
             </div>
        </div>

        {/* List */}
        <div className="space-y-1">
            {recentSongs.map((song, idx) => {
                const isActive = currentSong?.id === song.id;
                return (
                    <div 
                        key={`${song.id}-${idx}`} 
                        onClick={() => onSongSelect(song)}
                        className={`flex items-center gap-4 p-3 rounded-lg group transition cursor-pointer border-b border-white/5 last:border-0 ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    >
                         <div className="w-6 text-center flex-shrink-0 flex items-center justify-center">
                            {isActive && isPlaying ? (
                                <div className="flex items-end gap-[2px] h-4 w-4 justify-center pb-1">
                                    <div className="w-1 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.8s', height: '60%' }}></div>
                                    <div className="w-1 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '1.1s', height: '100%' }}></div>
                                    <div className="w-1 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.9s', height: '80%' }}></div>
                                </div>
                            ) : (
                                <>
                                    <span className={`text-sm font-medium group-hover:hidden ${isActive ? 'text-accent' : 'text-white/40'}`}>
                                        {idx + 1}
                                    </span>
                                    <Play 
                                        size={16} 
                                        className={`hidden group-hover:block w-6 ${isActive ? 'text-accent' : 'text-accent'}`} 
                                        fill="currentColor"
                                    />
                                </>
                            )}
                        </div>
                        
                        <div className="w-12 h-12 rounded overflow-hidden bg-neutral-800 flex-shrink-0">
                            <img 
                                src={song.coverUrl || "https://picsum.photos/100"} 
                                className={`w-full h-full object-cover transition ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} 
                                alt="art" 
                            />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <h4 className={`font-medium truncate transition ${isActive ? 'text-accent' : 'text-white'}`}>{song.title}</h4>
                            <div className="flex items-center gap-2 text-xs text-white/40">
                                <span className="truncate max-w-[150px]">{song.artist}</span>
                                <span>•</span>
                                <span className="truncate max-w-[150px]">{song.album}</span>
                            </div>
                        </div>
                        
                        <div className="hidden md:flex items-center gap-2 text-white/30 text-xs">
                            <Calendar size={12} />
                            <span>Just Added</span>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};