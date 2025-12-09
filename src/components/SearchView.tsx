import React, { useState, useEffect } from 'react';
import { Search, User, Disc, Play, Music, Loader2 } from 'lucide-react';
import { Song } from '../types';
import { fuzzySearch, SearchResults } from '../services/searchService';
import { SongArtwork } from './SongArtwork';

interface SearchViewProps {
  songs: Song[];
  onPlaySong: (song: Song) => void;
  onArtistClick: (artist: string) => void;
  onAlbumClick: (album: string) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
}

export const SearchView: React.FC<SearchViewProps> = ({ 
    songs, 
    onPlaySong, 
    onArtistClick, 
    onAlbumClick,
    currentSong,
    isPlaying
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ songs: [], artists: [], albums: [] });
  const [isSearching, setIsSearching] = useState(false);

  // Use Async Fuzzy Search Effect
  useEffect(() => {
      let active = true;
      const doSearch = async () => {
          if (!query.trim()) {
              setResults({ songs: [], artists: [], albums: [] });
              setIsSearching(false);
              return;
          }
          
          setIsSearching(true);
          const res = await fuzzySearch(songs, query);
          
          if (active) {
              setResults(res);
              setIsSearching(false);
          }
      };
      
      const timer = setTimeout(doSearch, 200); // Debounce
      return () => { active = false; clearTimeout(timer); };
  }, [query, songs]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-black p-6 md:p-12 pb-32 animate-fade-in">
        {/* Search Header */}
        <div className="mb-8 sticky top-0 bg-black/95 z-20 py-4 -mt-4 backdrop-blur-md border-b border-white/5">
            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">
                    {isSearching ? <Loader2 size={20} className="animate-spin text-accent" /> : <Search size={20} />}
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search songs, artists, albums..."
                    className="w-full bg-white/10 border border-white/10 rounded-xl py-4 pl-12 pr-14 text-lg text-white placeholder:text-white/30 focus:outline-none focus:bg-white/15 focus:border-white/20 transition shadow-lg shadow-black/50"
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

        {!query && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-white/30 gap-6 animate-pulse-slow">
                <div className="p-8 bg-white/5 rounded-full ring-1 ring-white/10">
                    <Search size={48} strokeWidth={1.5} />
                </div>
                <div className="text-center">
                    <p className="text-xl font-bold text-white/50">Ready to Explore</p>
                    <p className="text-sm mt-2">Search your local library for tracks, artists, and albums.</p>
                </div>
            </div>
        )}

        {query && (
            <div className="max-w-7xl mx-auto space-y-12">
                
                {/* Artists Section */}
                {results.artists.length > 0 && (
                    <section className="animate-fade-in">
                        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <User size={24} className="text-accent" /> Artists
                            </h2>
                            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">{results.artists.length} FOUND</span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                            {results.artists.map(artist => (
                                <div key={artist.name} onClick={() => onArtistClick(artist.name)} className="group cursor-pointer flex flex-col items-center text-center">
                                    <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-neutral-800 mb-4 relative shadow-lg border-2 border-transparent group-hover:border-accent transition-all duration-300 transform group-hover:scale-105">
                                        {artist.image ? (
                                            <img src={artist.image} alt={artist.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center"><User size={40} className="text-white/20"/></div>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-white truncate w-full group-hover:text-accent transition">{artist.name}</h3>
                                    <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Artist</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Albums Section */}
                {results.albums.length > 0 && (
                    <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
                        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Disc size={24} className="text-accent" /> Albums
                            </h2>
                            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">{results.albums.length} FOUND</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                            {results.albums.map(album => (
                                <div key={album.title} onClick={() => onAlbumClick(album.title)} className="group cursor-pointer">
                                    <div className="aspect-square rounded-xl overflow-hidden bg-neutral-900 mb-3 relative shadow-lg">
                                        <img 
                                            src={album.cover || "https://picsum.photos/300"} 
                                            alt={album.title} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500 opacity-90 group-hover:opacity-100" 
                                        />
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                        
                                        {/* Hover Overlay Icon */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                                            <div className="bg-black/40 backdrop-blur-sm p-3 rounded-full">
                                                <Disc size={24} className="text-white" />
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-white truncate group-hover:text-white/90">{album.title}</h3>
                                    <p className="text-sm text-white/50 truncate">{album.artist}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Songs Section */}
                {results.songs.length > 0 && (
                    <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
                        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Music size={24} className="text-accent" /> Songs
                            </h2>
                            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">{results.songs.length} FOUND</span>
                        </div>

                        <div className="space-y-1">
                             {results.songs.map((song, idx) => {
                                 const isActive = currentSong?.id === song.id;
                                 return (
                                     <div 
                                        key={song.id} 
                                        onClick={() => onPlaySong(song)} 
                                        className={`group flex items-center gap-4 py-3 px-3 rounded-lg cursor-pointer transition border-b border-white/5 last:border-0 ${isActive ? 'bg-white/10' : 'hover:bg-white/10'}`}
                                    >
                                         {/* Index / Play */}
                                         <div className="w-8 text-center flex-shrink-0 flex items-center justify-center">
                                            {isActive && isPlaying ? (
                                                <div className="flex items-end gap-[2px] h-4 w-4 justify-center pb-1">
                                                    <div className="w-1 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.8s', height: '60%' }}></div>
                                                    <div className="w-1 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '1.1s', height: '100%' }}></div>
                                                    <div className="w-1 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.9s', height: '80%' }}></div>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className={`font-medium text-sm font-mono group-hover:hidden ${isActive ? 'text-accent' : 'text-white/40'}`}>{idx + 1}</span>
                                                    <Play size={14} className={`hidden group-hover:block mx-auto ${isActive ? 'text-accent' : 'text-accent'}`} fill="currentColor"/>
                                                </>
                                            )}
                                         </div>

                                         {/* Cover */}
                                         <div className="w-10 h-10 rounded overflow-hidden bg-neutral-800 flex-shrink-0">
                                             <SongArtwork 
                                                song={song}
                                                className={`w-full h-full object-cover transition ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} 
                                            />
                                         </div>

                                         {/* Metadata */}
                                         <div className="flex-1 min-w-0">
                                             <h4 className={`font-medium truncate transition text-base ${isActive ? 'text-accent' : 'text-white'}`}>{song.title}</h4>
                                             <div className="flex items-center gap-1 text-xs text-white/40 truncate">
                                                 <span 
                                                    className="hover:text-white hover:underline cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); onArtistClick(song.artist); }}
                                                 >
                                                    {song.artist}
                                                 </span>
                                                 <span>•</span>
                                                 <span
                                                    className="hover:text-white hover:underline cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); if(song.album) onAlbumClick(song.album); }}
                                                 >
                                                    {song.album}
                                                 </span>
                                             </div>
                                         </div>

                                         {/* Duration */}
                                         <div className="text-white/40 text-xs font-mono font-medium text-right min-w-[40px]">
                                             {formatDuration(song.duration || 0)}
                                         </div>
                                     </div>
                                 );
                             })}
                        </div>
                    </section>
                )}

                {results.artists.length === 0 && results.albums.length === 0 && results.songs.length === 0 && !isSearching && (
                     <div className="flex flex-col items-center justify-center py-20 text-white/30">
                         <Search size={32} className="mb-4 opacity-50"/>
                         <p className="text-lg">No matches found for "{query}"</p>
                         <p className="text-sm mt-1">Try checking for typos or using different keywords.</p>
                     </div>
                )}
            </div>
        )}
    </div>
  );
};