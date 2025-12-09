import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Playlist, Song } from '../types';
import { ChevronLeft, Play, Trash2, Edit2, Camera, MoreHorizontal, X, Save, Music, Clock, GripVertical, Zap } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useLibraryStore } from '../store/playerStore';

interface PlaylistDetailViewProps {
  playlist: Playlist;
  onPlaySong: (song: Song) => void;
  onBack: () => void;
  onUpdatePlaylist: (updatedPlaylist: Playlist) => void;
  onDeletePlaylist: (id: string) => void;
  onRemoveSong: (songId: string) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
}

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({ 
  playlist, 
  onPlaySong, 
  onBack, 
  onUpdatePlaylist,
  onDeletePlaylist,
  onRemoveSong,
  currentSong,
  isPlaying
}) => {
  const { library } = useLibraryStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // HYDRATE SONGS: Handle Manual vs Smart
  const songs = useMemo(() => {
      if (playlist.rules && playlist.rules.length > 0) {
          // Smart Playlist Logic
          return library.filter(song => {
              return playlist.rules!.every(rule => {
                  if (!rule.field || !rule.value) return false;
                  
                  const val = String((song as any)[rule.field] || "").toLowerCase();
                  const ruleVal = rule.value.toLowerCase();
                  
                  switch(rule.operator) {
                      case 'contains': return val.includes(ruleVal);
                      case 'equals': return val === ruleVal;
                      case 'gt': 
                        const numValGt = parseFloat(val);
                        const numRuleGt = parseFloat(ruleVal);
                        return !isNaN(numValGt) && !isNaN(numRuleGt) && numValGt > numRuleGt;
                      case 'lt': 
                        const numValLt = parseFloat(val);
                        const numRuleLt = parseFloat(ruleVal);
                        return !isNaN(numValLt) && !isNaN(numRuleLt) && numValLt < numRuleLt;
                      default: return false;
                  }
              });
          });
      } else {
          // Manual Playlist
          return playlist.songIds
            .map(id => library.find(s => s.id === id))
            .filter((s): s is Song => !!s);
      }
  }, [playlist, library]);

  // Scroll to top on mount
  useEffect(() => {
      if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [playlist.id]);

  const handleSave = () => {
      if (editName.trim()) {
          onUpdatePlaylist({ ...playlist, name: editName });
          setIsEditing(false);
      }
  };

  const handleCoverClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              if (reader.result) {
                  onUpdatePlaylist({ ...playlist, coverUrl: reader.result as string });
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const onDragEnd = (result: DropResult) => {
      if (!result.destination || playlist.rules) return; // Disable drag for smart lists
      if (result.destination.index === result.source.index) return;

      const newIds = Array.from(playlist.songIds);
      const [removed] = newIds.splice(result.source.index, 1);
      newIds.splice(result.destination.index, 0, removed);

      onUpdatePlaylist({ ...playlist, songIds: newIds });
  };

  const totalDuration = songs.reduce((acc, curr) => acc + (curr.duration || 0), 0);
  const formatTotalDuration = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return h > 0 ? `${h} hr ${m} min` : `${m} min`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const getItemStyle = (style: any, isDragging: boolean) => {
      const baseStyle = style || {};
      if (isDragging && baseStyle.transform) {
          return {
              ...baseStyle,
              transform: baseStyle.transform.replace(/\(([^,]+),/, '(0px,'), 
              background: '#171717',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
          };
      }
      return baseStyle;
  };

  const isSmart = !!playlist.rules;

  return (
    <div className="relative flex-1 h-full overflow-hidden bg-neutral-900 animate-fade-in flex flex-col font-sans">
       
       {/* Ambient Background */}
       <div 
            className="absolute inset-0 bg-cover bg-center opacity-40 blur-3xl scale-110 pointer-events-none"
            style={{ backgroundImage: playlist.coverUrl ? `url(${playlist.coverUrl})` : 'none' }}
       ></div>
       <div className="absolute inset-0 bg-black/50 pointer-events-none"></div>

        {/* Header / Back Button */}
        <div className="relative z-20 pt-8 pl-8 pb-2 flex-shrink-0">
             <button 
                onClick={onBack} 
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition backdrop-blur-md"
                title="Back to Playlists"
            >
                <ChevronLeft size={24} />
            </button>
        </div>

        {/* Content Container */}
        <div ref={containerRef} className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left Side: Cover Art */}
            <div className="w-full md:w-5/12 lg:w-1/2 p-8 md:pl-16 lg:pl-24 flex flex-col items-center md:items-start flex-shrink-0 pt-12">
                <div className="w-full max-w-md aspect-square shadow-2xl shadow-black/50 rounded-lg overflow-hidden bg-neutral-900 relative group">
                     {playlist.coverUrl ? (
                         <img src={playlist.coverUrl} className="w-full h-full object-cover" alt="Playlist Cover" />
                     ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                             {isSmart ? <Zap size={80} className="text-accent/50"/> : <Music size={80} className="text-white/10" />}
                         </div>
                     )}

                     <div 
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                        onClick={() => songs.length > 0 && onPlaySong(songs[0])}
                     >
                         <div className="bg-white text-black p-4 rounded-full shadow-xl transform scale-90 group-hover:scale-100 transition">
                             <Play size={32} fill="currentColor" className="ml-1"/>
                         </div>
                     </div>

                     <button 
                        onClick={handleCoverClick}
                        className="absolute bottom-4 right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition backdrop-blur-md"
                        title="Change Cover"
                     >
                         <Camera size={20} />
                     </button>
                     <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
            </div>

            {/* Right Side: Info & Tracks */}
            <div className="w-full md:w-7/12 lg:w-1/2 bg-black/30 backdrop-blur-md md:bg-transparent md:backdrop-blur-none flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:pr-12 pt-12">
                    
                    {/* Playlist Info */}
                    <div className="mb-8 text-center md:text-left relative">
                        <div className="absolute right-0 top-0">
                            <div className="relative">
                                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition">
                                    <MoreHorizontal size={24} />
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-neutral-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in origin-top-right">
                                        <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm flex items-center gap-3 transition">
                                            <Edit2 size={16} /> Rename Playlist
                                        </button>
                                        <button onClick={() => { if (window.confirm("Delete this playlist?")) onDeletePlaylist(playlist.id); }} className="w-full text-left px-4 py-3 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-sm flex items-center gap-3 transition border-t border-white/5">
                                            <Trash2 size={16} /> Delete Playlist
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                            {isSmart && <Zap size={16} className="text-accent" />}
                            <h2 className="text-sm font-bold text-accent uppercase tracking-widest">{isSmart ? 'Smart Playlist' : 'Playlist'}</h2>
                        </div>
                        
                        {isEditing ? (
                             <div className="flex items-center gap-2 mb-4">
                                 <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-white/10 border border-white/20 text-3xl md:text-5xl font-bold text-white rounded-lg px-4 py-2 w-full focus:outline-none focus:border-accent" onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
                                 <button onClick={handleSave} className="p-3 bg-accent text-white rounded-full hover:scale-105 transition"><Save size={24} /></button>
                             </div>
                        ) : (
                            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">{playlist.name}</h1>
                        )}

                        {isSmart && playlist.rules && (
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                                {playlist.rules.map(rule => (
                                    <span key={rule.id} className="bg-white/10 border border-white/10 px-2 py-1 rounded text-xs text-white/70">
                                        {rule.field} {rule.operator === 'equals' ? '=' : rule.operator} "{rule.value}"
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-center md:justify-start gap-3 text-sm text-white/50 font-medium">
                            <span>{songs.length} Songs</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Clock size={14}/> {formatTotalDuration(totalDuration)}</span>
                        </div>
                    </div>

                    <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mb-6"></div>

                    <div className="pb-32">
                        {songs.length === 0 ? (
                            <div className="text-center py-12 text-white/30">
                                <p>This playlist is empty.</p>
                                {isSmart ? <p className="text-sm mt-2">No songs match your rules.</p> : <p className="text-sm mt-2">Add songs from your Library.</p>}
                            </div>
                        ) : (
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId={`playlist-${playlist.id}`} isDropDisabled={isSmart}>
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                                            {songs.map((song, idx) => {
                                                const isActive = currentSong?.id === song.id;
                                                return (
                                                    <Draggable key={`${song.id}-${idx}`} draggableId={`${song.id}-${idx}`} index={idx} isDragDisabled={isSmart}>
                                                        {(provided, snapshot) => (
                                                            <div 
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                style={getItemStyle(provided.draggableProps.style, snapshot.isDragging)}
                                                                className={`group flex items-center gap-4 py-2 px-2 rounded-lg cursor-pointer transition border-b border-white/5 last:border-0 relative pr-10 ${isActive ? 'bg-white/10' : 'hover:bg-white/10'} ${snapshot.isDragging ? 'opacity-90' : ''}`}
                                                                onClick={() => onPlaySong(song)}
                                                            >
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
                                                                            <Play size={14} className={`hidden group-hover:block mx-auto ${isActive ? 'text-accent' : 'text-white'}`} fill="currentColor"/>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className="w-10 h-10 rounded overflow-hidden bg-neutral-800 flex-shrink-0">
                                                                    <img src={song.coverUrl || "https://picsum.photos/100"} className={`w-full h-full object-cover transition ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} alt="art" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className={`font-medium text-base truncate transition ${isActive ? 'text-accent' : 'text-white'}`}>{song.title}</h4>
                                                                    <p className="text-white/40 text-xs truncate">{song.artist}</p>
                                                                </div>
                                                                <div className="text-white/40 text-xs font-mono font-medium text-right min-w-[40px]">
                                                                    {formatDuration(song.duration || 0)}
                                                                </div>
                                                                {!isSmart && (
                                                                    <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                                                        <button onClick={(e) => { e.stopPropagation(); onRemoveSong(song.id); }} className="p-2 text-white/20 hover:text-red-400 transition" title="Remove"><X size={16} /></button>
                                                                        <div {...provided.dragHandleProps} className="p-2 text-white/20 hover:text-white cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}><GripVertical size={16} /></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};