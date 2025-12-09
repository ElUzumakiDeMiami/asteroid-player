
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AlbumMetadata, Song } from '../types';
import { ChevronLeft, Play, Music, MoreHorizontal, Edit2, X, Save, Camera, Info, Loader2, FileText, Download, Globe, Database, Search, Disc } from 'lucide-react';
import { getAlbumId } from '../services/metadataService';
import { getAlbumDetails, getAlbumFromWikipedia, getAlbumFromAudioDB } from '../services/artistDataService';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface AlbumsViewProps {
  songs: Song[];
  onSongSelect: (song: Song) => void;
  selectedAlbum?: string | null;
  onSelectAlbum?: (album: string | null) => void;
  onBack?: () => void;
  onArtistClick?: (artist: string) => void;
  onBulkUpdate?: (songs: Song[], updates: Partial<Song>) => void;
  albumMetadata?: Record<string, AlbumMetadata>;
  onUpdateAlbumCover?: (albumTitle: string, artist: string, coverUrl: string) => void;
  onUpdateAlbumDescription?: (albumTitle: string, artist: string, description: string) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
}

// Separate Cell Component
const AlbumCell = ({ columnIndex, rowIndex, style, data }: any) => {
    const { albums, columnCount, onSelectAlbum } = data;
    const index = rowIndex * columnCount + columnIndex;
    if (index >= albums.length) return null;

    const album = albums[index];

    return (
        <div style={{ ...style, padding: '12px' }}>
            <div 
                onClick={() => onSelectAlbum && onSelectAlbum(album.title)}
                className="group cursor-pointer h-full flex flex-col"
            >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-900 mb-3 shadow-lg relative">
                    <img 
                        src={album.cover} 
                        alt={album.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100" 
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                    
                    {/* Hover Overlay Icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                            <div className="bg-black/40 backdrop-blur-sm p-3 rounded-full">
                            <Music size={24} className="text-white" />
                            </div>
                    </div>
                </div>
                <h3 className="font-bold text-white truncate text-sm md:text-base">{album.title}</h3>
                <p className="text-xs md:text-sm text-white/50 truncate">{album.artist}</p>
            </div>
        </div>
    );
};

export const AlbumsView: React.FC<AlbumsViewProps> = ({ 
    songs, 
    onSongSelect, 
    selectedAlbum, 
    onSelectAlbum,
    onBack, 
    onArtistClick,
    onBulkUpdate,
    albumMetadata = {},
    onUpdateAlbumCover,
    onUpdateAlbumDescription,
    currentSong,
    isPlaying
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [loadingDescription, setLoadingDescription] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'searching' | 'success' | 'error'>('idle');

  const [editForm, setEditForm] = useState({ album: '', artist: '', year: '', coverUrl: '' });
  const [searchInputs, setSearchInputs] = useState({ album: '', artist: '' });
  const [isCoverChanged, setIsCoverChanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailContainerRef = useRef<HTMLDivElement>(null);
  
  const albums = useMemo(() => {
    const map = new Map<string, { title: string; artist: string; year: string; cover: string; description?: string; songs: Song[] }>();
    
    songs.forEach(song => {
      const key = song.album || "Unknown Album";
      const metaKey = getAlbumId(song.artist, key);

      if (!map.has(key)) {
        // Use custom cover/desc if exists in meta, else first song defaults
        const meta = albumMetadata[metaKey];
        const customCover = meta?.coverUrl;
        const customDesc = meta?.description;
        
        map.set(key, {
          title: key,
          artist: song.artist,
          year: song.year || "Unknown",
          cover: customCover || song.coverUrl || "https://picsum.photos/400",
          description: customDesc,
          songs: []
        });
      }
      map.get(key)?.songs.push(song);
    });
    
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [songs, albumMetadata]);

  // Scroll to top when entering an album
  useEffect(() => {
      if (selectedAlbum && detailContainerRef.current) {
          detailContainerRef.current.scrollTop = 0;
      }
  }, [selectedAlbum]);

  // AUTOMATIC FETCHING (Defaults to Wikipedia via getAlbumDetails)
  useEffect(() => {
      if (selectedAlbum && onUpdateAlbumDescription) {
          const album = albums.find(a => a.title === selectedAlbum);
          
          // Only fetch if description is missing and not currently loading
          if (album && !album.description && !loadingDescription) {
              const fetchAuto = async () => {
                  setLoadingDescription(true);
                  try {
                      // getAlbumDetails prioritizes Wikipedia now
                      const desc = await getAlbumDetails(album.artist, album.title);
                      if (desc) {
                          onUpdateAlbumDescription(album.title, album.artist, desc);
                      }
                  } catch (e) {
                      console.error("Auto fetch failed", e);
                  } finally {
                      setLoadingDescription(false);
                  }
              };
              
              // Small debounce to prevent flickering on quick navigation
              const timer = setTimeout(fetchAuto, 500);
              return () => clearTimeout(timer);
          }
      }
  }, [selectedAlbum, albums]); // Dependent on albums to see if description updates

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (songs: Song[]) => {
      const totalSeconds = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
      const min = Math.floor(totalSeconds / 60);
      return `${min} min`;
  };

  const handleOpenEdit = (album: any) => {
      setEditForm({
          album: album.title,
          artist: album.artist,
          year: album.year === "Unknown" ? "" : album.year,
          coverUrl: album.cover
      });
      setIsCoverChanged(false);
      setIsMenuOpen(false);
      setIsEditModalOpen(true);
  };

  const handleOpenDownload = () => {
      const album = albums.find(a => a.title === selectedAlbum);
      if (album) {
          setSearchInputs({
              artist: album.artist,
              album: album.title
          });
      }
      setIsMenuOpen(false);
      setDownloadStatus('idle');
      setIsDownloadModalOpen(true);
  };

  // HANDLES MANUAL DOWNLOAD SELECTION WITH CUSTOM SEARCH TERMS
  const handleDownloadFromSource = async (source: 'wiki' | 'audiodb') => {
      if (!onUpdateAlbumDescription || !selectedAlbum) return;
      
      const albumData = albums.find(a => a.title === selectedAlbum);
      if (!albumData) return;
      
      setDownloadStatus('searching');
      let desc: string | null = null;

      // Use the inputs from the modal state (searchInputs) instead of album metadata
      if (source === 'wiki') {
          desc = await getAlbumFromWikipedia(searchInputs.artist, searchInputs.album);
      } else {
          desc = await getAlbumFromAudioDB(searchInputs.artist, searchInputs.album);
      }

      if (desc) {
          // Update the ACTUAL album metadata key, even if we searched for something else
          onUpdateAlbumDescription(albumData.title, albumData.artist, desc);
          setDownloadStatus('success');
          setTimeout(() => setIsDownloadModalOpen(false), 1500);
      } else {
          setDownloadStatus('error');
      }
  };

  const handleSaveEdit = (album: any) => {
      // 1. Handle Independent Cover Update
      if (isCoverChanged && onUpdateAlbumCover && editForm.coverUrl) {
          onUpdateAlbumCover(album.title, album.artist, editForm.coverUrl);
      }

      // 2. Handle Text Metadata Update (Synced across songs)
      if (onBulkUpdate) {
          const updates: Partial<Song> = {};
          if (editForm.album !== album.title) updates.album = editForm.album;
          if (editForm.artist !== album.artist) updates.artist = editForm.artist;
          if (editForm.year !== album.year) updates.year = editForm.year;
          // Note: We DO NOT add coverUrl to 'updates' here, preserving individual song covers.

          if (Object.keys(updates).length > 0) {
              onBulkUpdate(album.songs, updates);
          }
      }
      setIsEditModalOpen(false);
  };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              if (reader.result) {
                  setEditForm(prev => ({ ...prev, coverUrl: reader.result as string }));
                  setIsCoverChanged(true);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleBackAction = () => {
      if (onBack) {
          onBack();
      } else if (onSelectAlbum) {
          onSelectAlbum(null);
      }
  };

  // DETAIL VIEW (Matches the Reference Image)
  if (selectedAlbum) {
      const album = albums.find(a => a.title === selectedAlbum);
      
      // If not found
      if (!album) {
           return (
               <div className="flex-1 overflow-y-auto no-scrollbar bg-black p-6 md:p-12 pb-32">
                   <button 
                        onClick={handleBackAction} 
                        className="flex items-center gap-2 text-white/60 hover:text-white mb-8 transition"
                    >
                        <ChevronLeft size={20} />
                        All Albums
                    </button>
                   <div className="flex flex-col items-center justify-center h-64">
                       <p className="text-white/40">Album not found</p>
                   </div>
               </div>
           )
      }

      return (
        <div key={selectedAlbum} className="relative flex-1 h-full overflow-hidden bg-neutral-900 animate-fade-in flex flex-col">
            {/* Ambient Background */}
            <div 
                className="absolute inset-0 bg-cover bg-center opacity-40 blur-3xl scale-110 pointer-events-none"
                style={{ backgroundImage: `url(${album.cover})` }}
            ></div>
            <div className="absolute inset-0 bg-black/50 pointer-events-none"></div>

            {/* DESCRIPTION MODAL (Floating Window) */}
            {isDescriptionModalOpen && (
                 <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                             <div className="flex items-center gap-3">
                                <Info size={20} className="text-accent"/>
                                <h3 className="font-bold text-lg">About Album</h3>
                             </div>
                             <button onClick={() => setIsDescriptionModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                                 <X size={20} />
                             </button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar">
                             <h4 className="text-2xl font-bold mb-4">{album.title}</h4>
                             <p className="text-white/80 leading-relaxed text-lg whitespace-pre-line">
                                 {album.description}
                             </p>
                             <div className="mt-8 pt-8 border-t border-white/10 flex items-center gap-2 text-sm text-white/30">
                                 <span>Source: Wikipedia / TheAudioDB</span>
                             </div>
                        </div>
                    </div>
                 </div>
            )}

            {/* DOWNLOAD INFO SELECTION MODAL */}
            {isDownloadModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
                         <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="font-bold text-lg">Download Album Info</h3>
                            <button onClick={() => setIsDownloadModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            {(downloadStatus === 'idle' || downloadStatus === 'error') && (
                                <div className="mb-6 space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Search Terms</p>
                                        <span className="text-[10px] text-white/30">Edit to refine</span>
                                    </div>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
                                        <input 
                                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-accent focus:outline-none transition"
                                            placeholder="Artist Name"
                                            value={searchInputs.artist}
                                            onChange={e => setSearchInputs({...searchInputs, artist: e.target.value})}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
                                        <input 
                                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-accent focus:outline-none transition"
                                            placeholder="Album Title"
                                            value={searchInputs.album}
                                            onChange={e => setSearchInputs({...searchInputs, album: e.target.value})}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {downloadStatus === 'idle' && (
                                <div className="space-y-3">
                                    <button 
                                        onClick={() => handleDownloadFromSource('wiki')}
                                        className="w-full bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 flex items-center gap-4 transition group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center group-hover:scale-110 transition">
                                            <Globe size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-bold">Wikipedia</span>
                                            <span className="text-xs text-white/40">Best for history & details</span>
                                        </div>
                                    </button>

                                    <button 
                                        onClick={() => handleDownloadFromSource('audiodb')}
                                        className="w-full bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 flex items-center gap-4 transition group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center group-hover:scale-110 transition">
                                            <Database size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-bold">TheAudioDB</span>
                                            <span className="text-xs text-white/40">Music community database</span>
                                        </div>
                                    </button>
                                </div>
                            )}

                            {downloadStatus === 'searching' && (
                                <div className="flex flex-col items-center py-8 gap-4">
                                    <Loader2 size={32} className="animate-spin text-accent" />
                                    <p className="text-white/50 text-sm">Searching for info...</p>
                                    <p className="text-white/30 text-xs italic">"{searchInputs.album}"</p>
                                </div>
                            )}

                            {downloadStatus === 'success' && (
                                <div className="flex flex-col items-center py-8 gap-2 text-green-400">
                                    <p className="font-bold">Info Updated!</p>
                                </div>
                            )}

                            {downloadStatus === 'error' && (
                                <div className="flex flex-col items-center py-4 gap-4">
                                    <p className="text-red-400 text-sm text-center">No info found matching these terms.</p>
                                    <button 
                                        onClick={() => setDownloadStatus('idle')}
                                        className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm transition"
                                    >
                                        Try again or change source
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="font-bold text-lg">Edit Album Info</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex justify-center mb-4">
                                <div 
                                    className="w-32 h-32 rounded-lg bg-neutral-800 relative group cursor-pointer overflow-hidden"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <img src={editForm.coverUrl || album.cover} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Camera size={24} className="text-white drop-shadow-lg" />
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleCoverChange}/>
                                </div>
                            </div>
                            
                            <p className="text-xs text-center text-accent/80 font-medium">
                                Note: Changing the cover here only updates the Main Album Art. Individual song covers remain unchanged.
                            </p>

                            <div>
                                <label className="text-xs text-white/40 font-bold uppercase">Album Title</label>
                                <input className="w-full bg-white/5 border border-white/10 rounded-lg p-2 mt-1 focus:border-accent focus:outline-none" value={editForm.album} onChange={e => setEditForm({...editForm, album: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs text-white/40 font-bold uppercase">Album Artist</label>
                                <input className="w-full bg-white/5 border border-white/10 rounded-lg p-2 mt-1 focus:border-accent focus:outline-none" value={editForm.artist} onChange={e => setEditForm({...editForm, artist: e.target.value})} />
                            </div>
                             <div>
                                <label className="text-xs text-white/40 font-bold uppercase">Year</label>
                                <input className="w-full bg-white/5 border border-white/10 rounded-lg p-2 mt-1 focus:border-accent focus:outline-none" value={editForm.year} onChange={e => setEditForm({...editForm, year: e.target.value})} />
                            </div>
                            <div className="pt-4">
                                <button 
                                    onClick={() => handleSaveEdit(album)}
                                    className="w-full bg-accent hover:bg-purple-400 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    <Save size={18} /> Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Back Button Header Area */}
            <div className="relative z-20 pt-8 pl-8 pb-2 flex-shrink-0">
                 <button 
                    onClick={handleBackAction} 
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition backdrop-blur-md"
                    title="Go Back"
                >
                    <ChevronLeft size={24} />
                </button>
            </div>

            {/* Content Container */}
            <div ref={detailContainerRef} className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden">
                
                {/* Left Side: Cover Art */}
                <div className="w-full md:w-5/12 lg:w-1/2 p-8 md:pl-16 lg:pl-24 flex flex-col items-center md:items-start flex-shrink-0">
                    <div className="w-full max-w-md aspect-square shadow-2xl shadow-black/50 rounded-lg overflow-hidden bg-neutral-900 relative group">
                         <img src={album.cover} className="w-full h-full object-cover" alt={album.title}/>
                         {/* Play Album Overlay */}
                         <div 
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                            onClick={() => album.songs.length > 0 && onSongSelect(album.songs[0])}
                         >
                             <div className="bg-white text-black p-4 rounded-full shadow-xl transform scale-90 group-hover:scale-100 transition">
                                 <Play size={32} fill="currentColor" className="ml-1"/>
                             </div>
                         </div>
                    </div>
                </div>

                {/* Right Side: Metadata & Tracks */}
                <div className="w-full md:w-7/12 lg:w-1/2 bg-black/30 backdrop-blur-md md:bg-transparent md:backdrop-blur-none flex flex-col h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:pr-12">
                        
                        {/* Header Metadata */}
                        <div className="mb-8 text-center md:text-left relative">
                            {/* MORE OPTIONS MENU BUTTON */}
                            <div className="absolute right-0 top-0">
                                <div className="relative">
                                    <button 
                                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
                                    >
                                        <MoreHorizontal size={24} />
                                    </button>
                                    {isMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-56 bg-neutral-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in origin-top-right">
                                            <button 
                                                onClick={() => handleOpenEdit(album)}
                                                className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm flex items-center gap-3 transition"
                                            >
                                                <Edit2 size={16} /> Edit Info
                                            </button>
                                            <button 
                                                onClick={handleOpenDownload}
                                                className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm flex items-center gap-3 transition border-t border-white/5"
                                            >
                                                <Download size={16} /> Download Info
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h2 
                                className={`text-xl md:text-2xl font-bold text-accent mb-1 w-fit inline-block ${onArtistClick ? 'hover:underline cursor-pointer' : ''}`}
                                onClick={() => onArtistClick && onArtistClick(album.artist)}
                            >
                                {album.artist}
                            </h2>
                            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">{album.title}</h1>
                            
                            <div className="flex items-center justify-center md:justify-start gap-3 text-sm text-white/50 font-medium mb-6">
                                <span>{album.songs.length} Songs</span>
                                <span>•</span>
                                <span>{formatTotalDuration(album.songs)}</span>
                                {album.year !== "Unknown" && (
                                    <>
                                        <span>•</span>
                                        <span>{album.year}</span>
                                    </>
                                )}
                            </div>

                            {/* AUTOMATIC DESCRIPTION SECTION */}
                            <div className="bg-white/5 border border-white/5 rounded-xl p-4 mb-6 relative group">
                                {loadingDescription ? (
                                    <div className="flex items-center gap-2 text-white/40 text-sm py-2">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Fetching album info...</span>
                                    </div>
                                ) : album.description ? (
                                    <div>
                                        <p className="text-white/60 text-sm leading-relaxed line-clamp-3">
                                            {album.description}
                                        </p>
                                        <div className="mt-2">
                                            <button 
                                                onClick={() => setIsDescriptionModalOpen(true)}
                                                className="text-xs font-bold text-accent hover:text-white uppercase tracking-wider flex items-center gap-1 transition"
                                            >
                                                <FileText size={12} /> Read More
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-white/20 text-sm italic">
                                        No description available. 
                                        <button onClick={handleOpenDownload} className="text-accent ml-1 hover:underline">Download?</button>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mb-6"></div>

                        {/* Tracklist */}
                        <div className="space-y-1 pb-32">
                            {album.songs.map((song, idx) => {
                                const isActive = currentSong?.id === song.id;
                                return (
                                    <div 
                                        key={song.id} 
                                        onClick={() => onSongSelect(song)}
                                        className={`group flex items-center gap-4 py-3 px-2 rounded-lg cursor-pointer transition border-b border-white/5 last:border-0 ${isActive ? 'bg-white/10' : 'hover:bg-white/10'}`}
                                    >
                                        {/* Index / Play Icon */}
                                        <div className="w-8 text-center flex-shrink-0 flex items-center justify-center">
                                            {isActive && isPlaying ? (
                                                 <div className="flex items-end gap-[2px] h-4 w-4 justify-center pb-1">
                                                    <div className="w-1 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.8s', height: '60%' }}></div>
                                                    <div className="w-1 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '1.1s', height: '100%' }}></div>
                                                    <div className="w-1 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.9s', height: '80%' }}></div>
                                                 </div>
                                            ) : (
                                                <>
                                                    <span className={`font-medium text-sm font-mono group-hover:hidden ${isActive ? 'text-accent' : 'text-white/40'}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <Play size={14} className={`hidden group-hover:block mx-auto ${isActive ? 'text-accent' : 'text-white'}`} fill="currentColor"/>
                                                </>
                                            )}
                                        </div>

                                        {/* Title */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-medium text-base truncate transition ${isActive ? 'text-accent' : 'text-white'}`}>{song.title}</h4>
                                        </div>

                                        {/* Duration */}
                                        <div className="text-white/40 text-xs font-mono font-medium text-right min-w-[40px]">
                                            {formatDuration(song.duration || 0)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // GRID VIEW (Virtualization Added)
  return (
    <div className="flex-1 h-full flex flex-col bg-black">
        {/* Header */}
        <div className="flex-shrink-0 p-6 md:p-10 pb-0">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-4xl font-bold">Albums</h1>
                <span className="text-white/40 font-bold text-sm tracking-wider">{albums.length} ALBUMS</span>
            </div>
        </div>

        <div className="flex-1 px-4 md:px-8">
            <AutoSizer>
                {({ height, width }) => {
                    const minCardWidth = 180;
                    const columnCount = Math.max(2, Math.floor(width / minCardWidth));
                    const columnWidth = Math.floor(width / columnCount);
                    const rowHeight = columnWidth + 70; // Square + text
                    const rowCount = Math.ceil(albums.length / columnCount);

                    return (
                        <FixedSizeGrid
                            columnCount={columnCount}
                            columnWidth={columnWidth}
                            height={height}
                            rowCount={rowCount}
                            rowHeight={rowHeight}
                            width={width}
                            itemData={{ albums, columnCount, onSelectAlbum }}
                            className="no-scrollbar pb-32"
                        >
                            {AlbumCell}
                        </FixedSizeGrid>
                    );
                }}
            </AutoSizer>
        </div>
    </div>
  );
};
