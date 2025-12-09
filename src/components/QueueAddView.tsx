import React, { useState, useMemo, useEffect } from 'react';
import { Search, User, Disc, Play, Music, Check, ArrowUpDown, ChevronLeft, Calendar, Circle } from 'lucide-react';
import { Song } from '../types';
import { fuzzySearch } from '../services/searchService';
import { SongArtwork } from './SongArtwork';

interface QueueAddViewProps {
  songs: Song[];
  onConfirm: (selectedSongs: Song[]) => void;
  onCancel: () => void;
  mode: 'NEXT' | 'END';
}

type SortOption = 'added' | 'alpha' | 'year_desc' | 'year_asc';

export const QueueAddView: React.FC<QueueAddViewProps> = ({ 
    songs, 
    onConfirm, 
    onCancel,
    mode
}) => {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('added');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [filteredSongs, setFilteredSongs] = useState<Song[] | null>(null);

  // Async Search Effect
  useEffect(() => {
    if (!query.trim()) {
        setFilteredSongs(null);
        return;
    }
    
    let isMounted = true;
    const runSearch = async () => {
        const results = await fuzzySearch(songs, query);
        if (isMounted) {
            setFilteredSongs(results.songs);
        }
    };
    
    // Debounce
    const timeout = setTimeout(runSearch, 200);
    return () => {
        isMounted = false;
        clearTimeout(timeout);
    };
  }, [query, songs]);

  // Toggle selection of a song
  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  // Filter and Sort
  const displayedSongs = useMemo(() => {
    let result = songs;

    // 1. Filter by Query (if exists)
    if (query.trim()) {
        // Use the async result stored in state
        result = filteredSongs || [];
    }

    // 2. Sort
    return [...result].sort((a, b) => {
        switch (sortBy) {
            case 'alpha':
                return a.title.localeCompare(b.title);
            case 'year_desc':
                return (parseInt(b.year || '0') || 0) - (parseInt(a.year || '0') || 0);
            case 'year_asc':
                return (parseInt(a.year || '0') || 0) - (parseInt(b.year || '0') || 0);
            case 'added':
            default:
                // Default fallback to index or addedAt if available
                return (b.addedAt || 0) - (a.addedAt || 0);
        }
    });
  }, [query, songs, sortBy, filteredSongs]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
  };

  const handleConfirm = () => {
      // Map IDs back to song objects, maintaining the order they appear in the current filtered list
      const selectedSongs = displayedSongs.filter(s => selectedIds.has(s.id));
      // If some selected songs are filtered out by search, include them
      const missingIds = Array.from(selectedIds).filter(id => !selectedSongs.find(s => s.id === id));
      const missingSongs = songs.filter(s => missingIds.includes(s.id));
      
      onConfirm([...selectedSongs, ...missingSongs]);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-black animate-fade-in relative z-50">
        
        {/* Header */}
        <div className="flex-shrink-0 bg-black/95 z-20 py-4 border-b border-white/5 px-6 md:px-12 flex flex-col gap-4">
            
            {/* Top Bar: Back & Title */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold">Add Tracks</h2>
                        <p className="text-xs text-accent font-bold uppercase tracking-wider">
                            {mode === 'NEXT' ? 'Playing Next' : 'Adding to End'}
                        </p>
                    </div>
                </div>
                
                {/* Sort Dropdown */}
                <div className="relative">
                    <button 
                        onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider hover:text-white text-white/60 bg-white/5 px-3 py-2 rounded-lg transition"
                    >
                        <ArrowUpDown size={14} /> 
                        {sortBy === 'added' && 'Recent'}
                        {sortBy === 'alpha' && 'A-Z'}
                        {sortBy === 'year_desc' && 'Newest'}
                        {sortBy === 'year_asc' && 'Oldest'}
                    </button>
                    
                    {isSortMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-40 bg-neutral-900 border border-white/10 rounded-xl overflow-hidden shadow-xl z-50">
                            <button onClick={() => { setSortBy('added'); setIsSortMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm">Recently Added</button>
                            <button onClick={() => { setSortBy('alpha'); setIsSortMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm">Alphabetical</button>
                            <button onClick={() => { setSortBy('year_desc'); setIsSortMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm">Year (Newest)</button>
                            <button onClick={() => { setSortBy('year_asc'); setIsSortMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm">Year (Oldest)</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearch} className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search library..."
                    className="w-full bg-white/10 border border-white/10 rounded-xl py-3 pl-12 pr-14 text-base text-white placeholder:text-white/30 focus:outline-none focus:bg-white/15 focus:border-white/20 transition"
                    autoFocus
                />
                {query && (
                    <button 
                        type="button" 
                        onClick={() => setQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs font-bold uppercase tracking-wider"
                    >
                        Clear
                    </button>
                )}
            </form>
        </div>

        {/* Songs List */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 md:px-12 pb-32 pt-4">
            <div className="space-y-1">
                    {displayedSongs.map((song) => {
                        const isSelected = selectedIds.has(song.id);
                        return (
                            <div 
                                key={song.id} 
                                onClick={() => toggleSelection(song.id)}
                                className={`group flex items-center gap-4 py-2 px-3 rounded-lg cursor-pointer transition border-b border-white/5 last:border-0 ${isSelected ? 'bg-accent/10 border-accent/20' : 'hover:bg-white/10'}`}
                            >
                                {/* Selection Circle */}
                                <div className="flex-shrink-0">
                                    {isSelected ? (
                                        <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white shadow-lg shadow-purple-500/40 transition-transform scale-110">
                                            <Check size={12} strokeWidth={4} />
                                        </div>
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-white/20 group-hover:border-white/60 transition-colors"></div>
                                    )}
                                </div>

                                {/* Cover */}
                                <div className="w-10 h-10 rounded overflow-hidden bg-neutral-800 flex-shrink-0">
                                    <SongArtwork 
                                        song={song}
                                        className={`w-full h-full object-cover transition ${isSelected ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`} 
                                    />
                                </div>

                                {/* Metadata */}
                                <div className="flex-1 min-w-0">
                                    <h4 className={`font-medium truncate transition text-base ${isSelected ? 'text-accent' : 'text-white'}`}>{song.title}</h4>
                                    <div className="flex items-center gap-1 text-xs text-white/40 truncate">
                                        <span className="text-white/60">{song.artist}</span>
                                        <span>•</span>
                                        <span>{song.album}</span>
                                        {song.year && song.year !== 'Unknown' && (
                                            <>
                                                <span>•</span>
                                                <span>{song.year}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Duration */}
                                <div className="text-white/40 text-xs font-mono font-medium text-right min-w-[40px]">
                                    {formatDuration(song.duration || 0)}
                                </div>
                            </div>
                        );
                    })}
                    
                    {displayedSongs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-white/30">
                            <p>No songs found.</p>
                        </div>
                    )}
            </div>
        </div>

        {/* Floating Confirm Bar */}
        <div className={`absolute bottom-6 left-0 right-0 px-6 flex justify-center transition-transform duration-300 ${selectedIds.size > 0 ? 'translate-y-0' : 'translate-y-32'}`}>
            <button 
                onClick={handleConfirm}
                className="bg-accent hover:bg-purple-400 text-white font-bold py-4 px-8 rounded-2xl shadow-2xl shadow-purple-900/50 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 w-full max-w-md"
            >
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
                    {selectedIds.size}
                </div>
                <span className="flex-1 text-center">
                    {mode === 'NEXT' ? 'Play Next' : 'Add to Queue'}
                </span>
                <Check size={20} />
            </button>
        </div>

    </div>
  );
};