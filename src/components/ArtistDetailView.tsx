
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Song, ArtistMetadata, AlbumMetadata } from '../types';
import { ChevronLeft, Play, Grid, List, Disc, Loader2, Info, Globe, MoreHorizontal, Edit2, Camera, X, Save, FileText } from 'lucide-react';
import { loadArtistMetadata, saveArtistMetadata } from '../services/fileSystemService';
import { getArtistDetails } from '../services/artistDataService';
import { getAlbumId } from '../services/metadataService';

interface ArtistDetailViewProps {
  artist: string;
  songs: Song[];
  onSongSelect: (song: Song) => void;
  onBack: () => void;
  onAlbumClick?: (album: string) => void;
  albumMetadata?: Record<string, AlbumMetadata>;
  onArtistUpdate?: (oldName: string, newName: string, newImage: string, newBio: string) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
}

export const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({ 
    artist, 
    songs, 
    onSongSelect, 
    onBack, 
    onAlbumClick,
    albumMetadata = {},
    onArtistUpdate,
    currentSong,
    isPlaying
}) => {
  const [seeAllMode, setSeeAllMode] = useState<'list' | 'grid'>('list');
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Artist Metadata State
  const [artistMeta, setArtistMeta] = useState<ArtistMetadata | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  // Menu & Edit State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', bio: '', image: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load metadata on mount
  useEffect(() => {
    let mounted = true;

    const fetchMeta = async () => {
        const cached = await loadArtistMetadata(artist);
        
        if (cached) {
            if (mounted) setArtistMeta(cached);
        } else {
            if (mounted) setIsLoadingMeta(true);
            try {
                const onlineData = await getArtistDetails(artist);
                if (onlineData && mounted) {
                    setArtistMeta(onlineData);
                    await saveArtistMetadata(onlineData);
                }
            } catch (e) {
                console.error("Failed to fetch artist info", e);
            } finally {
                if (mounted) setIsLoadingMeta(false);
            }
        }
    };

    fetchMeta();
    return () => { mounted = false; };
  }, [artist]);


  // Get Artist Image
  const artistImage = useMemo(() => {
    if (artistMeta?.imageUrl) return artistMeta.imageUrl;
    const withCover = songs.find(s => s.coverUrl);
    return withCover?.coverUrl || "https://picsum.photos/800/800";
  }, [songs, artistMeta]);

  // Sort albums by year (descending)
  const albums = useMemo(() => {
    const albumMap = new Map<string, { title: string; year: string; cover: string; songs: Song[] }>();
    
    songs.forEach(song => {
      const key = song.album || "Unknown Album";
      const metaKey = getAlbumId(song.artist, key);

      if (!albumMap.has(key)) {
        const customCover = albumMetadata[metaKey]?.coverUrl;

        albumMap.set(key, {
          title: key,
          year: song.year || "Unknown",
          cover: customCover || song.coverUrl || "https://picsum.photos/400",
          songs: []
        });
      }
      albumMap.get(key)?.songs.push(song);
    });

    return Array.from(albumMap.values()).sort((a, b) => {
      if (a.year === "Unknown") return 1;
      if (b.year === "Unknown") return -1;
      return b.year.localeCompare(a.year);
    });
  }, [songs, albumMetadata]);

  // Popular songs
  const popularSongs = songs.slice(0, 5);

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Handle Scroll to animate header
  const handleScroll = () => {
      if (scrollContainerRef.current) {
          setScrollY(scrollContainerRef.current.scrollTop);
      }
  };

  const isCollapsed = scrollY > 150;

  // Edit Handlers
  const handleOpenEdit = () => {
      setEditForm({
          name: artist,
          bio: artistMeta?.bio || '',
          image: artistImage
      });
      setIsMenuOpen(false);
      setIsEditModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              if (reader.result) {
                  setEditForm(prev => ({ ...prev, image: reader.result as string }));
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveEdit = () => {
      if (onArtistUpdate) {
          onArtistUpdate(artist, editForm.name, editForm.image, editForm.bio);
          setArtistMeta(prev => ({
              ...(prev || { source: 'User Edited', lastUpdated: Date.now() }),
              name: editForm.name,
              imageUrl: editForm.image,
              bio: editForm.bio,
          }));
      }
      setIsEditModalOpen(false);
  };

  // Render a single song row
  const renderSongRow = (song: Song, index: number) => {
    const isActive = currentSong?.id === song.id;
    return (
      <div 
        key={song.id} 
        onClick={() => onSongSelect(song)}
        className={`group flex items-center gap-4 py-3 px-2 rounded-lg cursor-pointer transition border-b border-white/5 last:border-0 ${isActive ? 'bg-white/10' : 'hover:bg-white/10'}`}
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
                    <span className={`font-medium text-sm font-mono group-hover:hidden ${isActive ? 'text-accent' : 'text-white/40'}`}>{index + 1}</span>
                    <Play size={14} className={`hidden group-hover:block mx-auto ${isActive ? 'text-accent' : 'text-white'}`} fill="currentColor"/>
                </>
            )}
        </div>
        <div className="w-10 h-10 rounded overflow-hidden bg-neutral-800 flex-shrink-0">
            <img src={song.coverUrl || "https://picsum.photos/100"} className={`w-full h-full object-cover transition ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} alt="art" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-base truncate transition ${isActive ? 'text-accent' : 'text-white'}`}>{song.title}</h4>
          <p className={`text-xs truncate ${onAlbumClick ? 'text-white/40 hover:text-white hover:underline cursor-pointer' : 'text-white/40'}`} onClick={(e) => { e.stopPropagation(); if (onAlbumClick && song.album) onAlbumClick(song.album); }}>{song.album}</p>
        </div>
        <div className="text-white/40 text-xs font-mono font-medium text-right min-w-[40px]">
            {formatDuration(song.duration || 0)}
        </div>
      </div>
    );
  };

  // If "See All" songs mode is active
  if (showAllSongs) {
      return (
        <div className="h-full overflow-y-auto no-scrollbar p-6 md:p-10 bg-neutral-900 animate-fade-in flex flex-col">
             <div className="flex items-center justify-between mb-6 sticky top-0 bg-neutral-900/95 backdrop-blur-xl z-20 py-4 border-b border-white/10 flex-shrink-0">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setShowAllSongs(false)} className="p-2 hover:bg-white/10 rounded-full">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-2xl font-bold">{artist} - All Songs</h2>
                 </div>
                 <div className="flex bg-white/10 rounded-lg p-1">
                     <button onClick={() => setSeeAllMode('list')} className={`p-2 rounded-md transition ${seeAllMode === 'list' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}><List size={20} /></button>
                     <button onClick={() => setSeeAllMode('grid')} className={`p-2 rounded-md transition ${seeAllMode === 'grid' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}><Grid size={20} /></button>
                 </div>
             </div>
             {seeAllMode === 'list' ? (
                 <div className="space-y-1">{songs.map((song, idx) => renderSongRow(song, idx))}</div>
             ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                     {songs.map(song => {
                         const isActive = currentSong?.id === song.id;
                         return (
                             <div key={song.id} onClick={() => onSongSelect(song)} className="group cursor-pointer">
                                 <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 relative shadow-lg">
                                     <img src={song.coverUrl || "https://picsum.photos/300"} alt={song.title} className={`w-full h-full object-cover transition pointer-events-none ${isActive ? 'opacity-50' : 'opacity-90 group-hover:opacity-100'}`}/>
                                     {isActive && isPlaying && (
                                        <div className="absolute inset-0 flex items-center justify-center gap-[3px] z-20">
                                            <div className="w-1.5 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.8s', height: '60%' }}></div>
                                            <div className="w-1.5 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '1.1s', height: '100%' }}></div>
                                            <div className="w-1.5 bg-accent rounded-full animate-equalizer" style={{ animationDuration: '0.9s', height: '80%' }}></div>
                                        </div>
                                     )}
                                     <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition ${isActive ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}><Play fill="white" className="text-white"/></div>
                                 </div>
                                 <h4 className={`font-bold truncate text-sm ${isActive ? 'text-accent' : 'text-white group-hover:text-white/90'}`}>{song.title}</h4>
                                 <p className="text-xs text-white/50 truncate">{song.album}</p>
                             </div>
                         )
                     })}
                 </div>
             )}
        </div>
      );
  }

  // Standard Artist Profile View
  return (
    <div className="relative flex-1 h-full overflow-hidden bg-neutral-900 animate-fade-in flex flex-col">
      
      {/* 
          DYNAMIC HEADER
          - Fixed height container matching image height when expanded (h-48 / h-56)
          - Flex-stretch to enforce height equality
      */}
      <div 
        className={`absolute top-0 left-0 w-full z-30 transition-all duration-500 ease-in-out border-b ${isCollapsed ? 'h-24 bg-neutral-900/95 backdrop-blur-xl border-white/10 shadow-xl' : 'h-[280px] bg-transparent border-transparent'}`}
      >
         {/* Background Image */}
         <div 
            className={`absolute inset-0 bg-cover bg-center pointer-events-none transition-opacity duration-500 ${isCollapsed ? 'opacity-0' : 'opacity-40 blur-3xl'}`}
            style={{ backgroundImage: `url("${artistImage}")` }}
         />
         {!isCollapsed && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-900/50 to-neutral-900 pointer-events-none" />}
         
         {/* Header Content */}
         <div className={`relative h-full flex flex-row transition-all duration-500 items-center pl-24 pr-6 md:pr-24`}>
             
             {/* Back Button */}
             <button 
                onClick={onBack} 
                className={`absolute top-6 left-6 z-50 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition ${isCollapsed ? '' : 'bg-black/20 backdrop-blur-md'}`}
             >
                <ChevronLeft size={24} />
             </button>

             {/* Menu Button */}
             <div className="absolute top-6 right-6 z-50">
                <div className="relative">
                     <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition ${isCollapsed ? '' : 'bg-black/20 backdrop-blur-md'}`}
                     >
                        <MoreHorizontal size={24} />
                     </button>
                     {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-neutral-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in origin-top-right">
                             <button 
                                onClick={handleOpenEdit}
                                className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm flex items-center gap-3 transition"
                             >
                                 <Edit2 size={16} /> Edit Details
                             </button>
                        </div>
                     )}
                </div>
             </div>

             {/* 
                MAIN LAYOUT CONTAINER
                - items-stretch: Forces children to be same height
                - h-48 md:h-56: Explicit height for the expanded state
             */}
             <div className={`flex flex-row gap-6 md:gap-8 w-full transition-all duration-500 ${isCollapsed ? 'items-center' : 'items-stretch h-48 md:h-56'}`}>
                 
                 {/* Artist Image (Fixed width, height fills parent) */}
                 <div 
                    className={`relative rounded-lg overflow-hidden shadow-2xl flex-shrink-0 transition-all duration-500 ease-in-out bg-neutral-800 ${isCollapsed ? 'w-12 h-12 rounded-full' : 'w-48 md:w-56 rounded-xl'}`}
                 >
                     <img src={artistImage} className="w-full h-full object-cover" alt={artist} />
                 </div>

                 {/* Text Info Column */}
                 {/* justify-between: Pushes Name to top and Bio to bottom */}
                 <div className={`flex flex-col min-w-0 flex-1 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                     
                     {/* Top: Name & Stats */}
                     <div>
                         {!isCollapsed && (
                            <h2 className="text-accent font-bold uppercase tracking-widest text-xs md:text-sm mb-1 animate-fade-in leading-none -mt-1">Artist</h2>
                         )}
                         
                         <h1 className={`font-bold tracking-tight text-white transition-all duration-500 ${isCollapsed ? 'text-2xl truncate' : 'text-4xl md:text-5xl lg:text-6xl drop-shadow-2xl leading-none line-clamp-2'}`}>
                             {artist}
                         </h1>
                         
                         <div className={`flex items-center gap-3 text-white/60 transition-all duration-500 ${isCollapsed ? 'text-xs' : 'text-sm md:text-base mt-2'}`}>
                            <span>{songs.length} Tracks</span>
                            <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                            <span>{albums.length} Albums</span>
                            {!isCollapsed && isLoadingMeta && (
                                 <div className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-white/10">
                                     <Loader2 size={12} className="animate-spin"/> <span className="text-xs">Syncing</span>
                                 </div>
                            )}
                         </div>
                     </div>

                     {/* Bottom: Bio Box (Only when expanded) */}
                     {!isCollapsed && (
                        <div className="bg-white/5 border border-white/5 rounded-xl p-3 relative group w-full animate-fade-in backdrop-blur-sm mb-0">
                             {artistMeta?.bio ? (
                                <div className="flex flex-col gap-1">
                                    <p className="text-white/70 text-xs md:text-sm leading-relaxed line-clamp-2 md:line-clamp-3">
                                        {artistMeta.bio}
                                    </p>
                                    <div className="">
                                        <button 
                                            onClick={() => setIsBioModalOpen(true)}
                                            className="text-[10px] md:text-xs font-bold text-accent hover:text-white uppercase tracking-wider flex items-center gap-1 transition"
                                        >
                                            <FileText size={12} /> Read More
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <p className="text-white/20 text-xs italic">
                                        No biography available.
                                    </p>
                                    <button 
                                        onClick={() => setIsBioModalOpen(true)} 
                                        className="text-[10px] font-bold text-white/20 hover:text-white uppercase"
                                    >
                                        Add Info
                                    </button>
                                </div>
                            )}
                        </div>
                     )}
                 </div>
             </div>
         </div>
      </div>

      {/* Main Scrollable Content */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto no-scrollbar bg-neutral-900 relative z-10"
      >
          {/* Spacer */}
          <div className="h-[280px]"></div>

          <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
            
            {/* Top Songs */}
            <div>
                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                    <h2 className="text-2xl font-bold">Popular Songs</h2>
                    <button onClick={() => setShowAllSongs(true)} className="text-xs font-bold text-white/40 hover:text-accent transition uppercase tracking-wider">See All</button>
                </div>
                <div className="space-y-1">
                    {popularSongs.map((song, idx) => renderSongRow(song, idx))}
                </div>
            </div>

            {/* Albums */}
            <div>
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
                    <h2 className="text-2xl font-bold">Albums</h2>
                    <span className="text-white/40 text-sm font-medium">{albums.length} Releases</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {albums.map((album) => (
                        <div key={album.title} onClick={() => onAlbumClick && onAlbumClick(album.title)} className="group cursor-pointer">
                            <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-900 mb-3 relative shadow-lg">
                                <img src={album.cover} alt={album.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100" />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                                    <div className="bg-black/40 backdrop-blur-sm p-3 rounded-full"><Disc size={24} className="text-white" /></div>
                                </div>
                            </div>
                            <h3 className="font-bold text-white truncate group-hover:text-white/90">{album.title}</h3>
                            <p className="text-sm text-white/50">{album.year} • Album</p>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="h-32"></div>
          </div>
      </div>

      {/* BIO MODAL */}
      {isBioModalOpen && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                         <div className="flex items-center gap-3">
                            <Info size={20} className="text-accent"/>
                            <h3 className="font-bold text-lg">About {artist}</h3>
                         </div>
                         <button onClick={() => setIsBioModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                             <X size={20} />
                         </button>
                    </div>
                    <div className="p-8 overflow-y-auto custom-scrollbar">
                         <p className="text-white/80 leading-relaxed text-lg whitespace-pre-line">
                             {artistMeta?.bio}
                         </p>
                         <div className="mt-8 pt-8 border-t border-white/10 flex items-center gap-2 text-sm text-white/30">
                             <Globe size={16} />
                             <span>Source: {artistMeta?.source || 'Web'}</span>
                         </div>
                    </div>
                </div>
            </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                    <div className="flex items-center justify-between p-4 border-b border-white/5 flex-shrink-0">
                        <h3 className="font-bold text-lg">Edit Artist</h3>
                        <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                         <div className="flex flex-col items-center">
                            <div 
                                className="w-32 h-32 rounded-full bg-neutral-800 relative group cursor-pointer overflow-hidden shadow-xl"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <img src={editForm.image} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition">
                                    <Camera size={24} className="text-white drop-shadow-lg" />
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange}/>
                            </div>
                            <span className="text-xs text-white/40 mt-2">Tap to change photo</span>
                        </div>

                        <div>
                            <label className="text-xs text-white/40 font-bold uppercase block mb-1">Artist Name</label>
                            <input 
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-accent focus:outline-none transition" 
                                value={editForm.name} 
                                onChange={e => setEditForm({...editForm, name: e.target.value})} 
                            />
                            <p className="text-[10px] text-red-400 mt-1 opacity-80">Warning: Changing name will update all associated songs.</p>
                        </div>

                        <div>
                            <label className="text-xs text-white/40 font-bold uppercase block mb-1">Biography</label>
                            <textarea 
                                className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-accent focus:outline-none transition resize-none custom-scrollbar" 
                                value={editForm.bio} 
                                onChange={e => setEditForm({...editForm, bio: e.target.value})} 
                            />
                        </div>

                        <button 
                            onClick={handleSaveEdit}
                            className="w-full bg-accent hover:bg-purple-400 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                        >
                            <Save size={18} /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
      )}
    </div>
  );
};