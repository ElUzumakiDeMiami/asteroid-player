import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Song } from '../types';
import { Play, Volume2, GripVertical, Settings2, MoreHorizontal, ChevronUp, Save, Trash2, ListStart, ListEnd, Plus } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult, DragStart } from '@hello-pangea/dnd';

interface QueueViewProps {
  songs: Song[];
  currentIndex: number;
  onPlaySong: (index: number) => void;
  bottomPadding?: string; 
  queueTitle?: string;
  onReorderQueue?: (startIndex: number, endIndex: number) => void;
  onSaveQueue?: () => void;
  onClearQueue?: () => void;
  onAddTracksNext?: () => void;
  onAddTracksEnd?: () => void;
}

export const QueueView: React.FC<QueueViewProps> = ({ 
    songs, 
    currentIndex, 
    onPlaySong,
    bottomPadding = "pb-0",
    queueTitle = "Queue",
    onReorderQueue,
    onSaveQueue,
    onClearQueue,
    onAddTracksNext,
    onAddTracksEnd
}) => {
  const activeItemRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSong = songs[currentIndex];

  const [headerBlur, setHeaderBlur] = useState(() => parseInt(localStorage.getItem('queue_header_blur') || '40'));
  const [headerOpacity, setHeaderOpacity] = useState(() => parseFloat(localStorage.getItem('queue_header_opacity') || '0.5'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('queue_header_blur', headerBlur.toString());
    localStorage.setItem('queue_header_opacity', headerOpacity.toString());
  }, [headerBlur, headerOpacity]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        if (isSettingsOpen && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
            setIsSettingsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isSettingsOpen]);

  const scrollToActiveItem = useCallback(() => {
    if (activeItemRef.current && listRef.current) {
        const list = listRef.current;
        const element = activeItemRef.current;
        const elementTop = element.offsetTop;
        const headerHeight = 128; 
        const targetScrollTop = elementTop - headerHeight - 16; 
        list.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => { scrollToActiveItem(); }, 10000);
  }, [scrollToActiveItem]);

  const handleUserInteraction = () => resetInactivityTimer();

  useEffect(() => {
    const timer = setTimeout(() => { scrollToActiveItem(); resetInactivityTimer(); }, 100);
    return () => { clearTimeout(timer); if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); };
  }, [currentIndex, scrollToActiveItem, resetInactivityTimer]); 

  const formatDuration = (seconds: number) => {
    if (!seconds) return "-:--";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handleDragStart = (start: DragStart) => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
  };

  const handleDragEnd = (result: DropResult) => {
      resetInactivityTimer();
      if (!result.destination || !onReorderQueue) return;
      if (result.destination.index === result.source.index) return;
      onReorderQueue(result.source.index, result.destination.index);
  };

  const getItemStyle = (style: any, isDragging: boolean) => {
      const baseStyle = style || {};
      if (isDragging && baseStyle.transform) {
          return {
              ...baseStyle,
              transform: baseStyle.transform.replace(/\(([^,]+),/, '(0px,'),
              background: '#171717',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
          };
      }
      return baseStyle;
  };

  return (
    <div 
        className="relative w-full h-full flex flex-col font-sans overflow-hidden bg-black/50"
        onMouseMove={handleUserInteraction}
        onTouchStart={handleUserInteraction}
        onClick={handleUserInteraction}
    >
        <style>{`
          @keyframes equalizer { 0% { height: 20%; } 50% { height: 80%; } 100% { height: 20%; } }
          .eq-bar { width: 4px; background-color: white; border-radius: 999px; animation: equalizer 1s ease-in-out infinite; }
          .eq-bar:nth-child(1) { animation-duration: 0.8s; }
          .eq-bar:nth-child(2) { animation-duration: 1.1s; height: 40%; }
          .eq-bar:nth-child(3) { animation-duration: 0.9s; }
        `}</style>
        
        <div 
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
            style={{ 
                backgroundImage: currentSong?.coverUrl ? `url(${currentSong.coverUrl})` : 'none',
                filter: 'blur(80px)', opacity: 0.4, transform: 'scale(1.2)'
            }}
        />
        
        <div 
            className="absolute top-0 left-0 right-0 z-40 h-32 border-b border-white/5 shadow-2xl transition-all duration-300 pointer-events-auto"
            style={{ 
                backgroundColor: `rgba(0,0,0,${headerOpacity})`,
                backdropFilter: `blur(${headerBlur}px)`,
                WebkitBackdropFilter: `blur(${headerBlur}px)`
            }}
        >
            <div className="w-full h-full relative px-8 pt-4">
                <div className="flex flex-col justify-center min-h-[50px] pl-12 md:pl-16">
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate leading-tight drop-shadow-md pr-16">{queueTitle}</h2>
                    <div className="flex items-center gap-2 mt-0.5 opacity-60">
                        <span className="text-sm font-medium">{currentIndex + 1} / {songs.length}</span>
                        <span className="text-xs uppercase tracking-wider font-bold">Tracks</span>
                    </div>
                </div>

                <div className="absolute top-6 right-6 z-50">
                    <div className="relative">
                        <button 
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`p-3 rounded-full transition backdrop-blur-md ${isSettingsOpen ? 'bg-white text-black' : 'bg-black/20 text-white/60 hover:text-white hover:bg-white/10'}`}
                        >
                            <MoreHorizontal size={24} />
                        </button>

                        {isSettingsOpen && (
                            <div ref={settingsRef} className="absolute right-0 top-full mt-2 w-72 bg-neutral-900/95 border border-white/10 backdrop-blur-xl rounded-xl shadow-2xl p-4 animate-fade-in z-50">
                                
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Add Tracks</p>
                                <div className="space-y-1 mb-4">
                                    {onAddTracksNext && (
                                        <button 
                                            onClick={() => { onAddTracksNext(); setIsSettingsOpen(false); }}
                                            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition text-sm text-left text-white border border-white/5"
                                        >
                                            <ListStart size={18} className="text-accent" /> 
                                            <div>
                                                <span className="block font-bold">Play Next</span>
                                            </div>
                                        </button>
                                    )}
                                    {onAddTracksEnd && (
                                        <button 
                                            onClick={() => { onAddTracksEnd(); setIsSettingsOpen(false); }}
                                            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition text-sm text-left text-white border border-white/5"
                                        >
                                            <ListEnd size={18} className="text-accent" /> 
                                            <div>
                                                <span className="block font-bold">Add to End</span>
                                            </div>
                                        </button>
                                    )}
                                </div>

                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Manage</p>
                                <div className="space-y-1 mb-4">
                                    {onSaveQueue && (
                                        <button onClick={() => { onSaveQueue(); setIsSettingsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition text-sm text-left"><Save size={16} /> Save as Playlist</button>
                                    )}
                                    {onClearQueue && (
                                        <button onClick={() => { onClearQueue(); setIsSettingsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/20 text-white hover:text-red-400 transition text-sm text-left"><Trash2 size={16} /> Clear Upcoming</button>
                                    )}
                                </div>
                                
                                <div className="h-px bg-white/10 my-3"></div>

                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-4">Appearance</p>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-white/60"><span>Blur</span><span>{headerBlur}px</span></div>
                                        <input type="range" min="0" max="100" value={headerBlur} onChange={(e) => setHeaderBlur(Number(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-white/60"><span>Opacity</span><span>{Math.round(headerOpacity * 100)}%</span></div>
                                        <input type="range" min="0" max="100" step="5" value={headerOpacity * 100} onChange={(e) => setHeaderOpacity(Number(e.target.value) / 100)} className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="absolute bottom-2 left-8 md:left-12 flex items-center gap-2 opacity-30 text-white">
                    <ChevronUp size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Previously Played</span>
                </div>
            </div>
        </div>

        <div ref={listRef} onScroll={handleUserInteraction} className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-6 md:px-12 pb-[70vh]" style={{ paddingTop: '128px' }}>
            <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
                <Droppable droppableId="queue-list">
                    {(provided) => (
                        <div className="flex flex-col" {...provided.droppableProps} ref={provided.innerRef}>
                            {songs.map((song, index) => {
                                const isActive = index === currentIndex;
                                return (
                                    <Draggable key={`${song.id}-${index}`} draggableId={`${song.id}-${index}`} index={index} isDragDisabled={isActive}>
                                        {(provided, snapshot) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps} style={getItemStyle(provided.draggableProps.style, snapshot.isDragging)} className="mb-1 transition-opacity duration-300">
                                                {isActive ? (
                                                    <div ref={activeItemRef} className="my-4 scale-100 md:scale-105 transition-transform duration-500 origin-center relative z-20">
                                                        <p className="text-[10px] md:text-xs font-bold text-accent uppercase tracking-widest mb-3 pl-1 flex items-center gap-2 animate-fade-in"><Volume2 size={12} /> Now Playing</p>
                                                        <div className="bg-white/10 border border-white/20 rounded-xl p-4 flex items-center gap-5 shadow-2xl backdrop-blur-md">
                                                            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow-lg">
                                                                <img src={song.coverUrl || "https://picsum.photos/200"} className="w-full h-full object-cover opacity-60" alt={song.title}/>
                                                                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/20"><div className="eq-bar h-3"></div><div className="eq-bar h-5"></div><div className="eq-bar h-4"></div></div>
                                                            </div>
                                                            <div className="flex-1 min-w-0"><h3 className="text-xl md:text-2xl font-bold text-white truncate leading-tight">{song.title}</h3><p className="text-accent text-sm md:text-base truncate font-medium mt-0.5">{song.artist}</p></div>
                                                            <span className="text-white font-mono font-bold text-sm md:text-base mr-2">{formatDuration(song.duration)}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className={`group relative flex items-center gap-4 py-3 px-2 border-b border-white/5 hover:bg-white/10 hover:rounded-lg transition-all duration-200 ${snapshot.isDragging ? 'opacity-0' : 'opacity-100'} ${index < currentIndex ? 'opacity-50 hover:opacity-100' : 'opacity-100'}`}>
                                                        <div onClick={() => onPlaySong(index)} className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer">
                                                            <div className="w-8 flex justify-center text-white/40 font-medium text-sm font-mono"><span className="group-hover:hidden">{index + 1}</span><Play size={14} className="hidden group-hover:block text-white" fill="currentColor"/></div>
                                                            <div className="w-10 h-10 rounded bg-neutral-800 overflow-hidden flex-shrink-0 shadow-sm"><img src={song.coverUrl || "https://picsum.photos/100"} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" alt="art"/></div>
                                                            <div className="flex-1 min-w-0 flex flex-col justify-center"><h4 className="text-white font-medium text-sm truncate leading-tight group-hover:text-white transition-colors">{song.title}</h4><p className="text-white/40 text-xs truncate mt-0.5 group-hover:text-white/60 transition-colors">{song.artist}</p></div>
                                                        </div>
                                                        <div className="text-white/40 text-sm font-mono tracking-tight">{formatDuration(song.duration)}</div>
                                                        <div className="text-white/20 hover:text-white cursor-grab active:cursor-grabbing p-2 transition-colors" {...provided.dragHandleProps}><GripVertical size={16} /></div>
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
        </div>
    </div>
  );
};