import React from 'react';
import { Playlist } from '../types';
import { Plus, ListMusic, ChevronRight, Zap, Clock, Sparkles, Wand2, RefreshCw } from 'lucide-react';

interface PlaylistsViewProps {
  playlists: Playlist[];
  onCreatePlaylist: () => void;
  onSelectPlaylist: (playlist: Playlist) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({ playlists, onCreatePlaylist, onSelectPlaylist }) => {
  
  const getExpirationLabel = (playlist: Playlist) => {
      if (!playlist.expiresAt) return null;
      // If generated, expiresAt indicates the next potential refresh check
      const diff = playlist.expiresAt - Date.now();
      const hours = Math.ceil(diff / (1000 * 60 * 60));
      
      // If it's fresh (created recently), show that
      if (hours > 24) return 'Fresh';
      if (hours > 0) return `Updates in ${hours}h`;
      return 'Updating...';
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-black p-6 md:p-12 pb-32 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Playlists</h1>
        
        {/* Only Manual Create Button Remains */}
        <button 
            onClick={onCreatePlaylist}
            className="bg-white text-black hover:bg-neutral-200 px-6 py-3 rounded-full font-bold flex items-center gap-2 transition shadow-lg shadow-white/10"
        >
            <Plus size={20} />
            <span>Create Playlist</span>
        </button>
      </div>

      {playlists.length === 0 ? (
         <div className="flex flex-col items-center justify-center h-[50vh] text-center border border-dashed border-white/10 rounded-3xl bg-white/5 p-12">
            <ListMusic size={64} className="text-white/20 mb-6" />
            <h3 className="text-2xl font-bold mb-2">No Playlists Yet</h3>
            <p className="text-white/50 mb-8 max-w-md">
                Create your own playlist, or wait a moment while the AI analyzes your library to build editorial mixes for you automatically.
            </p>
            <button onClick={onCreatePlaylist} className="bg-white text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition">Create Manual Playlist</button>
         </div>
      ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {playlists.map(playlist => {
                  const statusLabel = getExpirationLabel(playlist);
                  return (
                    <div 
                        key={playlist.id} 
                        onClick={() => onSelectPlaylist(playlist)}
                        className="group cursor-pointer"
                    >
                        <div className="aspect-square rounded-xl overflow-hidden bg-neutral-900 mb-3 relative shadow-lg">
                            {playlist.coverUrl ? (
                                <img 
                                    src={playlist.coverUrl} 
                                    alt={playlist.name} 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 relative">
                                    {playlist.isGenerated ? (
                                        <Sparkles size={48} className="text-indigo-400/50" />
                                    ) : playlist.rules ? (
                                        <Zap size={48} className="text-accent/50" />
                                    ) : (
                                        <ListMusic size={48} className="text-white/20" />
                                    )}
                                    
                                    {/* Badges */}
                                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                        {playlist.isGenerated && !playlist.rules && (
                                            <div className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md backdrop-blur-md">
                                                <Wand2 size={10} /> FOR YOU
                                            </div>
                                        )}
                                        {playlist.isGenerated && playlist.rules && (
                                            <div className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                                                MIX
                                            </div>
                                        )}
                                        {playlist.rules && !playlist.isGenerated && (
                                            <div className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full">SMART</div>
                                        )}
                                        {statusLabel && (
                                            <div className="bg-black/60 backdrop-blur-md text-white/80 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <RefreshCw size={10} /> {statusLabel}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <div className="bg-white text-black rounded-full p-3">
                                    <ChevronRight size={20} fill="currentColor" />
                                </div>
                            </div>
                        </div>
                        <h3 className="font-bold text-white truncate">{playlist.name}</h3>
                        <p className="text-sm text-white/50">{playlist.rules ? 'Dynamic' : `${playlist.songIds.length} Songs`}</p>
                    </div>
                  );
              })}
          </div>
      )}
    </div>
  );
};