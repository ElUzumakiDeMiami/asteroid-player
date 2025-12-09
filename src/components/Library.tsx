
import React, { useRef, useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { FilePlus, FolderInput, Play, Music, Settings2, Trash2, SortAsc, Calendar, User, Disc, Check, ListEnd, ListStart, ListPlus, Edit2, X, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Download, ArrowDownUp } from 'lucide-react';
import { Song } from '../types';
import { isFileSystemAPISupported } from '../services/fileSystemService';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useLibraryStore } from '../store/playerStore'; 
import { SongArtwork } from './SongArtwork';

interface LibraryProps {
  songs: Song[];
  recentlyPlayed: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  onSongSelect: (song: Song) => void;
  onFileSelect: (files: FileList) => void;
  onLinkFolder: () => void;
  onSeeAllRecentlyAdded: () => void;
  onDeleteSongs?: (songIds: string[]) => void;
  onPlayNext?: (song: Song) => void;
  onAddToQueue?: (song: Song) => void;
  onBulkAdd?: (songs: Song[], mode: 'NEXT' | 'END') => void;
  onAddToPlaylist?: (song: Song) => void;
  onBulkAddToPlaylist?: (songs: Song[]) => void;
  onEdit?: (song: Song) => void;
  // New props for reusability (Genre View)
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

// 1. Cell Component: Handles Long Press and Selection
const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
  const { items, columnCount, onSongSelect, currentSong, isPlaying, selectionMode, setSelectionMode, selectedIds, toggleSelection, onContextMenu } = data; 
  const index = rowIndex * columnCount + columnIndex;
  
  if (index >= items.length) return null;
  
  const song = items[index];
  const isActive = currentSong?.id === song.id;
  const isSelected = selectedIds.has(song.id);
  
  // Refs for Long Press
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const startPress = () => {
      isLongPress.current = false;
      timerRef.current = setTimeout(() => {
          isLongPress.current = true;
          // Trigger Selection Mode
          if (!selectionMode) setSelectionMode(true);
          toggleSelection(song.id);
          // Optional: Haptic Feedback
          if (navigator.vibrate) navigator.vibrate(50);
      }, 500); // 500ms for long press
  };

  const endPress = () => {
      if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
      }
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      // If it was a long press, ignore the click (already handled in timeout)
      if (isLongPress.current) {
          isLongPress.current = false;
          return;
      }

      if (selectionMode) {
          toggleSelection(song.id);
      } else {
          onSongSelect(song);
      }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      // Always allow context menu
      onContextMenu(e, song);
  };

  return (
    <div style={{ ...style, padding: '12px' }}>
        <div 
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            className={`group cursor-pointer block h-full flex flex-col relative transition-transform duration-200 ${isSelected ? 'scale-95' : ''}`}
        >
            {/* Cover Art Container */}
            <div className={`w-full aspect-square bg-neutral-800 rounded-xl overflow-hidden shadow-lg relative mb-3 ${isSelected ? 'ring-2 ring-accent' : ''}`}>
                <SongArtwork 
                    song={song}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity pointer-events-none ${isActive ? 'opacity-40' : 'opacity-90 group-hover:opacity-100'}`}
                />
                
                {/* Active Overlay (Equalizer) - Only if NOT selecting */}
                {isActive && isPlaying && !selectionMode && (
                    <div className="absolute inset-0 flex items-center justify-center gap-[3px] z-20">
                        <div className="w-1.5 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.8s', height: '60%' }}></div>
                        <div className="w-1.5 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '1.1s', height: '100%' }}></div>
                        <div className="w-1.5 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.9s', height: '80%' }}></div>
                    </div>
                )}
                
                {/* Hover Overlay (Play) - Only if NOT selecting */}
                {!selectionMode && (
                    <div className={`absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 ${isActive ? 'hidden' : ''}`}>
                        <div className="bg-white text-black p-3 rounded-full shadow-xl transform scale-90 group-hover:scale-100 transition">
                            <Play size={24} fill="currentColor" className="ml-1" />
                        </div>
                    </div>
                )}

                {/* Selection Overlay (Checkbox) */}
                {selectionMode && (
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isSelected ? (
                            <div className="bg-accent text-white p-2 rounded-full shadow-lg">
                                <Check size={24} strokeWidth={3} />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full border-2 border-white/50"></div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Text Info */}
            <div className="w-full overflow-hidden">
                <h4 className={`font-bold text-sm truncate ${isActive ? 'text-accent' : 'text-white'}`}>{song.title}</h4>
                <p className="text-white/50 text-xs truncate">{song.artist}</p>
            </div>
        </div>
    </div>
  );
};

export const Library: React.FC<LibraryProps> = ({ 
  songs, 
  onSongSelect, 
  onFileSelect, 
  onLinkFolder,
  currentSong,
  isPlaying,
  onDeleteSongs,
  onPlayNext,
  onAddToQueue,
  onBulkAdd,
  onAddToPlaylist,
  onBulkAddToPlaylist,
  onEdit,
  title = "Library",
  subtitle,
  onBack
}) => {
  const [cardSize, setCardSize] = useState(() => {
    const saved = localStorage.getItem('libraryCardSize');
    return saved ? parseInt(saved, 10) : 160;
  }); 
  
  // Menu States
  const [activeMenu, setActiveMenu] = useState<'none' | 'sort' | 'import'>('none');

  const [supportsFileSystem, setSupportsFileSystem] = useState(false);
  
  // SELECTION MODE STATE
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // CONTEXT MENU STATE
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, song: Song | null }>({ x: 0, y: 0, song: null });
  
  const { librarySortOption, setLibrarySortOption } = useLibraryStore(); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupportsFileSystem(isFileSystemAPISupported());
    
    const handleClickOutside = (event: MouseEvent) => {
        // Sort Menu Outside Click
        if (
            activeMenu === 'sort' && 
            sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node) &&
            sortButtonRef.current && !sortButtonRef.current.contains(event.target as Node)
        ) {
            setActiveMenu('none');
        }
        // Import Menu Outside Click
        if (
            activeMenu === 'import' && 
            importMenuRef.current && !importMenuRef.current.contains(event.target as Node) &&
            importButtonRef.current && !importButtonRef.current.contains(event.target as Node)
        ) {
            setActiveMenu('none');
        }
        // Context Menu Outside Click
        if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
            setContextMenu({ x: 0, y: 0, song: null });
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  useEffect(() => {
    localStorage.setItem('libraryCardSize', cardSize.toString());
  }, [cardSize]);

  // Handle Sort Logic
  const sortedSongs = useMemo(() => {
      const sorted = [...songs];
      switch (librarySortOption) {
          case 'title_asc': return sorted.sort((a, b) => a.title.localeCompare(b.title));
          case 'title_desc': return sorted.sort((a, b) => b.title.localeCompare(a.title));
          
          case 'artist_asc': return sorted.sort((a, b) => a.artist.localeCompare(b.artist));
          case 'artist_desc': return sorted.sort((a, b) => b.artist.localeCompare(a.artist));
          
          case 'album_asc': return sorted.sort((a, b) => (a.album || "").localeCompare(b.album || ""));
          case 'album_desc': return sorted.sort((a, b) => (b.album || "").localeCompare(a.album || ""));
          
          case 'year_desc': return sorted.sort((a, b) => (parseInt(b.year || '0') || 0) - (parseInt(a.year || '0') || 0));
          case 'year_asc': return sorted.sort((a, b) => (parseInt(a.year || '0') || 0) - (parseInt(b.year || '0') || 0));
          
          case 'added_asc': return sorted.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
          case 'added_desc':
          default:
              return sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      }
  }, [songs, librarySortOption]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files);
      setActiveMenu('none');
    }
  };

  const getSortLabel = () => {
      switch(librarySortOption) {
          case 'title_asc': return 'Title (A-Z)';
          case 'title_desc': return 'Title (Z-A)';
          case 'artist_asc': return 'Artist (A-Z)';
          case 'artist_desc': return 'Artist (Z-A)';
          case 'album_asc': return 'Album (A-Z)';
          case 'album_desc': return 'Album (Z-A)';
          case 'year_desc': return 'Year (Newest)';
          case 'year_asc': return 'Year (Oldest)';
          case 'added_asc': return 'Oldest Added';
          case 'added_desc': default: return 'Recently Added';
      }
  }

  // --- SELECTION LOGIC ---
  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  // --- CONTEXT MENU LOGIC ---
  const handleContextMenu = (e: React.MouseEvent, song: Song) => {
      const menuWidth = 220;
      const menuHeight = 320;
      let x = e.pageX;
      let y = e.pageY;

      // Check boundaries
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 20;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 20;

      // Smart Selection Logic for Right Click
      if (selectionMode) {
          if (!selectedIds.has(song.id)) {
              toggleSelection(song.id);
          }
          setContextMenu({ x, y, song });
      } else {
          setContextMenu({ x, y, song });
      }
  };

  const handleContextAction = (action: () => void) => {
      setContextMenu({ x: 0, y: 0, song: null });
      action();
  };

  // --- BULK HELPERS ---
  const getSelectedSongs = () => {
      if (selectionMode && selectedIds.size > 0) {
          return songs.filter(s => selectedIds.has(s.id));
      }
      return contextMenu.song ? [contextMenu.song] : [];
  };

  const handlePlayNext = () => {
      const targets = getSelectedSongs();
      if (targets.length === 1 && onPlayNext) onPlayNext(targets[0]);
      else if (targets.length > 1 && onBulkAdd) onBulkAdd(targets, 'NEXT');
  };

  const handleAddToQueue = () => {
      const targets = getSelectedSongs();
      if (targets.length === 1 && onAddToQueue) onAddToQueue(targets[0]);
      else if (targets.length > 1 && onBulkAdd) onBulkAdd(targets, 'END');
  };

  const handleAddToPlaylist = () => {
      const targets = getSelectedSongs();
      if (targets.length === 1 && onAddToPlaylist) onAddToPlaylist(targets[0]);
      else if (targets.length > 1 && onBulkAddToPlaylist) onBulkAddToPlaylist(targets);
  };

  const handleDelete = () => {
      const targets = getSelectedSongs();
      if (targets.length > 0 && onDeleteSongs) {
          if (window.confirm(`Delete ${targets.length} song(s) permanently?`)) {
              onDeleteSongs(targets.map(s => s.id));
              setSelectionMode(false);
              setSelectedIds(new Set());
          }
      }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-black font-sans relative">
        
        {/* HEADER */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 md:px-10 py-6 border-b border-white/10 bg-black/95 backdrop-blur-md z-10">
            <div className="flex items-center gap-4">
                {onBack && (
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition">
                        <ChevronLeft size={24} />
                    </button>
                )}
                <div className="flex items-baseline gap-3">
                    <h1 className="text-4xl font-bold tracking-tight text-white">{title}</h1>
                    <span className="text-white/40 font-bold text-sm tracking-wider">{subtitle || `${songs.length} TRACKS`}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                
                {/* Selection Mode Toggle */}
                {selectionMode ? (
                    <button 
                        onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                        className="px-4 py-1.5 bg-white text-black rounded-full text-xs font-bold uppercase tracking-wider hover:bg-neutral-200 transition"
                    >
                        Cancel ({selectedIds.size})
                    </button>
                ) : (
                    <>
                        {/* SORT BUTTON */}
                        <div className="relative">
                            <button 
                                ref={sortButtonRef}
                                onClick={() => setActiveMenu(activeMenu === 'sort' ? 'none' : 'sort')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-full border transition text-xs font-bold uppercase tracking-wider ${activeMenu === 'sort' ? 'bg-white text-black border-white' : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/5'}`}
                            >
                                <ArrowDownUp size={14} /> {getSortLabel()}
                            </button>
                            
                            {activeMenu === 'sort' && (
                                <div ref={sortMenuRef} className="absolute right-0 top-full mt-2 w-72 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in p-2 z-50">
                                    <div className="flex items-center justify-between px-3 py-2 mb-1 border-b border-white/5">
                                        <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Sort By</span>
                                    </div>
                                    <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar px-1">
                                        <button onClick={() => setLibrarySortOption('added_desc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'added_desc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><Calendar size={16}/> Recently Added</div>
                                            {librarySortOption === 'added_desc' && <Check size={16}/>}
                                        </button>
                                        <button onClick={() => setLibrarySortOption('added_asc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'added_asc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><Calendar size={16}/> Oldest Added</div>
                                            {librarySortOption === 'added_asc' && <Check size={16}/>}
                                        </button>
                                        <div className="h-px bg-white/10 my-1"></div>
                                        <button onClick={() => setLibrarySortOption('title_asc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'title_asc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><SortAsc size={16}/> Title (A-Z)</div>
                                            {librarySortOption === 'title_asc' && <Check size={16}/>}
                                        </button>
                                        <button onClick={() => setLibrarySortOption('title_desc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'title_desc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><SortAsc size={16}/> Title (Z-A)</div>
                                            {librarySortOption === 'title_desc' && <Check size={16}/>}
                                        </button>
                                        <div className="h-px bg-white/10 my-1"></div>
                                        <button onClick={() => setLibrarySortOption('artist_asc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'artist_asc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><User size={16}/> Artist (A-Z)</div>
                                            {librarySortOption === 'artist_asc' && <Check size={16}/>}
                                        </button>
                                        <button onClick={() => setLibrarySortOption('artist_desc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'artist_desc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><User size={16}/> Artist (Z-A)</div>
                                            {librarySortOption === 'artist_desc' && <Check size={16}/>}
                                        </button>
                                        <div className="h-px bg-white/10 my-1"></div>
                                        <button onClick={() => setLibrarySortOption('album_asc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'album_asc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><Disc size={16}/> Album (A-Z)</div>
                                            {librarySortOption === 'album_asc' && <Check size={16}/>}
                                        </button>
                                        <button onClick={() => setLibrarySortOption('album_desc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'album_desc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><Disc size={16}/> Album (Z-A)</div>
                                            {librarySortOption === 'album_desc' && <Check size={16}/>}
                                        </button>
                                        <div className="h-px bg-white/10 my-1"></div>
                                        <button onClick={() => setLibrarySortOption('year_desc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'year_desc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><ArrowUp size={16}/> Year (Newest)</div>
                                            {librarySortOption === 'year_desc' && <Check size={16}/>}
                                        </button>
                                        <button onClick={() => setLibrarySortOption('year_asc')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${librarySortOption === 'year_asc' ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-white'}`}>
                                            <div className="flex items-center gap-3"><ArrowDown size={16}/> Year (Oldest)</div>
                                            {librarySortOption === 'year_asc' && <Check size={16}/>}
                                        </button>
                                    </div>
                                    
                                    <div className="h-px bg-white/10 my-2 mx-1"></div>
                                    
                                    {/* View Size Slider moved here */}
                                    <div className="px-3 py-2 pb-3">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Card Size</span>
                                            <Settings2 size={14} className="text-white/40"/>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="120" 
                                            max="300" 
                                            step="20"
                                            value={cardSize}
                                            onChange={(e) => setCardSize(Number(e.target.value))}
                                            className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* IMPORT BUTTON */}
                        <div className="relative">
                            <button
                                ref={importButtonRef}
                                onClick={() => setActiveMenu(activeMenu === 'import' ? 'none' : 'import')}
                                className={`p-2 rounded-full transition border border-transparent ${activeMenu === 'import' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/5'}`}
                                title="Import"
                            >
                                <Download size={20} />
                            </button>
                            {activeMenu === 'import' && (
                                <div ref={importMenuRef} className="absolute right-0 top-full mt-2 w-64 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in p-2 z-50">
                                    <div className="px-3 py-2 mb-1 border-b border-white/5">
                                        <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Add to Library</span>
                                    </div>
                                    <div className="space-y-1">
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/10 rounded-lg transition text-sm text-white"
                                        >
                                            <FilePlus size={18} className="text-accent"/> 
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold">Import Files</span>
                                                <span className="text-[10px] text-white/50">Select audio files</span>
                                            </div>
                                        </button>
                                        
                                        <button 
                                            onClick={() => supportsFileSystem ? onLinkFolder() : folderInputRef.current?.click()}
                                            className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/10 rounded-lg transition text-sm text-white"
                                        >
                                            <FolderInput size={18} className="text-accent"/> 
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold">{supportsFileSystem ? 'Link Folder' : 'Import Folder'}</span>
                                                <span className="text-[10px] text-white/50">Scan a directory</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>

        <input type="file" multiple accept="audio/*" className="hidden" ref={fileInputRef} onChange={handleFiles} />
        <input type="file" multiple className="hidden" ref={folderInputRef} onChange={handleFiles} {...({ webkitdirectory: "", directory: "" } as any)} />

        {/* EMPTY STATE */}
        {songs.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-white/30">
                <Music size={64} strokeWidth={1} className="mb-4"/>
                <p>{title === "Library" ? "Library is empty. Import music to begin." : "No songs found for this selection."}</p>
            </div>
        )}

        {/* VIRTUALIZED GRID */}
        {songs.length > 0 && (
            <div className="flex-1 px-4 md:px-8">
                <AutoSizer>
                    {({ height, width }: { height: number, width: number }) => {
                        const minCardWidth = cardSize;
                        const columnCount = Math.max(1, Math.floor(width / minCardWidth));
                        const columnWidth = Math.floor(width / columnCount);
                        const imageSize = columnWidth - 24; 
                        const textHeight = 70; 
                        const rowHeight = imageSize + textHeight;
                        const rowCount = Math.ceil(sortedSongs.length / columnCount);

                        return (
                            <FixedSizeGrid
                                columnCount={columnCount}
                                columnWidth={columnWidth}
                                height={height}
                                rowCount={rowCount}
                                rowHeight={rowHeight}
                                width={width}
                                itemData={{ 
                                    items: sortedSongs, 
                                    columnCount, 
                                    onSongSelect, 
                                    currentSong, 
                                    isPlaying, 
                                    selectionMode,
                                    setSelectionMode,
                                    selectedIds, 
                                    toggleSelection,
                                    onContextMenu: handleContextMenu 
                                }}
                                className="no-scrollbar pt-6 pb-32"
                            >
                                {Cell}
                            </FixedSizeGrid>
                        );
                    }}
                </AutoSizer>
            </div>
        )}

        {/* BULK ACTION BAR - JUST CANCEL */}
        {selectionMode && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50 animate-fade-in pointer-events-none">
                <div className="bg-neutral-800/90 backdrop-blur-md border border-white/10 rounded-full py-2 px-6 flex items-center gap-4 shadow-2xl pointer-events-auto">
                    <span className="text-sm font-bold text-white/90">{selectedIds.size} Selected</span>
                    <div className="h-4 w-px bg-white/20"></div>
                    <button 
                        onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                        className="text-white/60 hover:text-white transition"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
        )}

        {/* CONTEXT MENU PORTAL */}
        {contextMenu.song && ReactDOM.createPortal(
            <div 
                className="fixed inset-0 z-[9999]" 
                onClick={() => setContextMenu({ x: 0, y: 0, song: null })}
                onContextMenu={(e) => e.preventDefault()}
            >
                <div 
                    ref={contextMenuRef}
                    className="absolute bg-neutral-800/95 border border-white/10 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden w-64 animate-fade-in"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {/* Header */}
                    <div className="p-3 border-b border-white/5 bg-white/5">
                        {selectionMode && selectedIds.size > 1 ? (
                            <p className="text-sm font-bold text-white truncate">{selectedIds.size} Tracks Selected</p>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-white truncate">{contextMenu.song.title}</p>
                                <p className="text-xs text-white/50 truncate">{contextMenu.song.artist}</p>
                            </>
                        )}
                    </div>
                    
                    <div className="p-1">
                        <button onClick={() => handleContextAction(handlePlayNext)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-lg text-sm text-left transition">
                            <ListStart size={16}/> Play Next {selectionMode && selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
                        </button>
                        <button onClick={() => handleContextAction(handleAddToQueue)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-lg text-sm text-left transition">
                            <ListEnd size={16}/> Add to Queue {selectionMode && selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
                        </button>
                        <button onClick={() => handleContextAction(handleAddToPlaylist)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-lg text-sm text-left transition">
                            <ListPlus size={16}/> Add to Playlist {selectionMode && selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
                        </button>
                        
                        {/* Hide Edit/Info for Bulk */}
                        {(!selectionMode || selectedIds.size <= 1) && (
                            <button onClick={() => handleContextAction(() => onEdit && onEdit(contextMenu.song!))} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-lg text-sm text-left transition">
                                <Edit2 size={16}/> Edit Info
                            </button>
                        )}
                        
                        <div className="h-px bg-white/5 my-1"></div>
                        
                        <button 
                            onClick={() => handleContextAction(handleDelete)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-sm text-left transition font-bold"
                        >
                            <Trash2 size={16}/> Delete {selectionMode && selectedIds.size > 1 ? `(${selectedIds.size})` : 'Song'}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};
