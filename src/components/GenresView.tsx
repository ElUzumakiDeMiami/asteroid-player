
import React, { useMemo } from 'react';
import { Song } from '../types';
import { Guitar, Music2, Hash } from 'lucide-react';

interface GenresViewProps {
  songs: Song[];
  onSelectGenre?: (genre: string) => void;
}

export const GenresView: React.FC<GenresViewProps> = ({ songs, onSelectGenre }) => {
  
  const genres = useMemo(() => {
    const map = new Map<string, { name: string; count: number; covers: string[] }>();
    
    songs.forEach(song => {
      const genre = song.genre || "Unknown Genre";
      if (!map.has(genre)) {
        map.set(genre, {
            name: genre,
            count: 0,
            covers: []
        });
      }
      const entry = map.get(genre)!;
      entry.count++;
      if (song.coverUrl && entry.covers.length < 4) {
          entry.covers.push(song.coverUrl);
      }
    });
    
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [songs]);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-black p-6 md:p-12 pb-32 animate-fade-in">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold">Genres</h1>
            <span className="text-white/40 font-bold text-sm tracking-wider">{genres.length} GENRES</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {genres.map((genre) => (
                <div 
                    key={genre.name} 
                    onClick={() => onSelectGenre && onSelectGenre(genre.name)}
                    className="group cursor-pointer bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 p-6 rounded-2xl transition flex items-center gap-6 relative overflow-hidden"
                >
                    {/* Decorative Background Gradient */}
                    <div className="absolute right-0 top-0 w-32 h-32 bg-accent/10 blur-[50px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-accent/20 transition"></div>

                    <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 shadow-lg z-10">
                         <Hash size={24} className="text-accent" />
                    </div>

                    <div className="flex-1 z-10">
                        <h3 className="text-xl font-bold text-white truncate">{genre.name}</h3>
                        <p className="text-white/50 font-medium text-sm">{genre.count} Tracks</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};
