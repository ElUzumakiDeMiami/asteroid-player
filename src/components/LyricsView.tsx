import React, { useEffect, useRef, useState } from 'react';
import { LyricsLine, LyricSearchResult, Song } from '../types';
import { Clock, Minus, Plus, Search, Download, X, Edit3, Music, Mic, Disc, ChevronDown, Globe, Database, Settings2, AlignLeft, AlignCenter, AlignJustify, FileDown, Check, Expand } from 'lucide-react';
import { searchLyricOptions, getLyricsByOption } from '../services/geminiService';
import { saveLyricsToStorage, downloadLrcFile } from '../services/fileSystemService';

interface LyricsViewProps {
  song: Song | null;
  currentTime: number;
  onLyricsUpdate: (lyrics: LyricsLine[]) => void;
  onSeek: (time: number) => void;
  // Settings Props from Parent (Background)
  bgBlur?: number;
  setBgBlur?: (v: number) => void;
  bgOpacity?: number;
  setBgOpacity?: (v: number) => void;
  // Settings Props from Parent (Player Bar)
  barBlur?: number;
  setBarBlur?: (v: number) => void;
  barOpacity?: number;
  setBarOpacity?: (v: number) => void;
  // Immersive Mode
  isImmersive?: boolean;
  setIsImmersive?: (v: boolean) => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ 
    song, 
    currentTime, 
    onLyricsUpdate, 
    onSeek,
    bgBlur = 40,
    setBgBlur,
    bgOpacity = 0.6,
    setBgOpacity,
    barBlur = 20,
    setBarBlur,
    barOpacity = 0.7,
    setBarOpacity,
    isImmersive = false,
    setIsImmersive
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const [offset, setOffset] = useState(0);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'word'>(() => {
      return (localStorage.getItem('lyrics_alignment') as 'left' | 'center' | 'word') || 'left';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  // Search State
  const [viewState, setViewState] = useState<'LYRICS' | 'INPUT' | 'SEARCHING' | 'RESULTS' | 'LOADING_SELECTION'>('LYRICS');
  const [searchResults, setSearchResults] = useState<LyricSearchResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual Search Form State
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [searchAlbum, setSearchAlbum] = useState("");

  const hasLyrics = song?.lyrics && song.lyrics.length > 0;

  // Auto-Exit Immersive Mode if no lyrics are present
  useEffect(() => {
      if (!hasLyrics && isImmersive && setIsImmersive) {
          setIsImmersive(false);
      }
  }, [hasLyrics, isImmersive, setIsImmersive]);

  useEffect(() => {
      localStorage.setItem('lyrics_alignment', alignment);
  }, [alignment]);

  // Click outside to close settings
  useEffect(() => {
      const handleClick = (e: MouseEvent) => {
          if (isSettingsOpen && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
              setIsSettingsOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
  }, [isSettingsOpen]);

  // Reset offset when song changes
  useEffect(() => {
    setOffset(0);
    setViewState('LYRICS');
    setSearchResults([]);
    setSelectedResultId("");
    setErrorMsg(null);
  }, [song?.id]);

  // Auto-scroll
  useEffect(() => {
    if (viewState === 'LYRICS' && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime, song?.lyrics, offset, viewState]);

  // Initialize search form with current metadata
  const openSearchForm = () => {
    if (!song) return;
    setSearchTitle(song.title || "");
    setSearchArtist(song.artist || "");
    setSearchAlbum(song.album || "");
    setViewState('INPUT');
    setIsSettingsOpen(false);
    setErrorMsg(null);
  };

  const executeSearch = async () => {
    setViewState('SEARCHING');
    setErrorMsg(null);
    
    try {
      const results = await searchLyricOptions(
        searchTitle, 
        searchArtist, 
        searchAlbum, 
        song?.duration
      );

      if (results.length === 0) {
        setErrorMsg("No lyrics found. Try correcting the title/artist.");
        setViewState('INPUT'); 
      } else {
        setSearchResults(results);
        if (results.length > 0) setSelectedResultId(results[0].id);
        setViewState('RESULTS');
      }
    } catch (e) {
      setErrorMsg("Connection error during search.");
      setViewState('INPUT');
    }
  };

  const handleConfirmSelection = async () => {
    if (!song || !selectedResultId) return;
    const selectedOption = searchResults.find(r => r.id === selectedResultId);
    if (!selectedOption) return;

    setViewState('LOADING_SELECTION');
    try {
      const lyrics = await getLyricsByOption(selectedOption.id, song.title, song.artist);
      if (lyrics.length > 0) {
        onLyricsUpdate(lyrics);
        await saveLyricsToStorage(song.artist, song.album, song.title, lyrics);
        setViewState('LYRICS');
      } else {
        setErrorMsg("Failed to download content from this source.");
        setViewState('RESULTS');
      }
    } catch (e) {
      setErrorMsg("Error downloading lyrics.");
      setViewState('RESULTS');
    }
  };

  // 1. Empty State
  if (!hasLyrics && viewState === 'LYRICS') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-8 relative">
        <div className="bg-white/5 p-6 rounded-full">
            <Search size={40} className="text-white/30" />
        </div>
        <div>
            <h3 className="text-xl font-bold text-white">No Lyrics Found</h3>
            <p className="text-white/50 mt-2 text-sm">
                Search in LRCLIB, Musixmatch or Genius?
            </p>
        </div>
        <button 
            onClick={openSearchForm}
            className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition"
        >
            <Search size={18} />
            Search Online
        </button>
        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
      </div>
    );
  }

  // 2. Manual Input Form
  if (viewState === 'INPUT') {
      return (
        <div className="h-full flex flex-col justify-center px-8 animate-fade-in">
            <div className="w-full max-w-md mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold">Manual Search</h3>
                    <button onClick={() => setViewState('LYRICS')} className="p-2 hover:bg-white/10 rounded-full">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
                            <Music size={12} /> Song Title
                        </label>
                        <input 
                            type="text" 
                            value={searchTitle}
                            onChange={(e) => setSearchTitle(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
                            <Mic size={12} /> Artist
                        </label>
                        <input 
                            type="text" 
                            value={searchArtist}
                            onChange={(e) => setSearchArtist(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                        />
                    </div>
                </div>

                {errorMsg && <p className="text-red-400 mt-4 text-sm">{errorMsg}</p>}

                <button 
                    onClick={executeSearch}
                    className="w-full bg-accent hover:bg-purple-400 text-white font-bold py-4 rounded-xl mt-8 transition shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
                >
                    <Search size={20} /> Search All Sources
                </button>
            </div>
        </div>
      );
  }

  // 3. Searching / Loading State
  if (viewState === 'SEARCHING' || viewState === 'LOADING_SELECTION') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 animate-pulse">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <p className="text-white/60 text-lg font-medium">Processing...</p>
      </div>
    );
  }

  // 4. Results State (FIXED LAYOUT)
  if (viewState === 'RESULTS') {
      const selectedOption = searchResults.find(r => r.id === selectedResultId);
      return (
        // Increased padding bottom to clear Player Bar (pb-40 = 160px)
        // Added pt-28 to clear Top Left Minimize Button
        <div className="h-full flex flex-col px-8 pt-28 md:pt-32 pb-40 relative z-20">
             {/* Header with left padding to avoid minimize button */}
             <div className="flex items-center justify-between mb-6 flex-shrink-0 pl-12 md:pl-0">
                <h3 className="text-2xl font-bold">Select Version</h3>
                <button onClick={() => setViewState('INPUT')} className="p-2 hover:bg-white/10 rounded-full"><Edit3 size={16} /></button>
             </div>
             
             <div className="flex flex-col gap-4 max-w-lg w-full mx-auto flex-1 min-h-0">
                 {/* Results List */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {searchResults.map((result) => {
                        const isSelected = selectedResultId === result.id;
                        return (
                            <button 
                                key={result.id} 
                                onClick={() => setSelectedResultId(result.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 group relative ${
                                  isSelected
                                    ? 'bg-accent/20 border-accent shadow-lg shadow-purple-900/10' 
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`font-bold ${isSelected ? 'text-accent' : 'text-white'}`}>
                                        {result.sourceName}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {result.isSynced && (
                                            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Synced</span>
                                        )}
                                        {isSelected && <Check size={16} className="text-accent"/>}
                                    </div>
                                </div>
                                {/* Expanded preview text for selected item to help identification */}
                                <p className={`text-sm leading-relaxed font-medium transition-all ${
                                    isSelected 
                                        ? 'text-white/90 line-clamp-6' 
                                        : 'text-white/40 line-clamp-2'
                                }`}>
                                    {result.preview}
                                </p>
                            </button>
                        );
                    })}
                 </div>

                 {/* Action Bar - Fixed brightness hover effect */}
                 <div className="pt-4 border-t border-white/10 flex-shrink-0">
                     {errorMsg && <p className="text-red-400 text-center text-sm mb-3 animate-fade-in">{errorMsg}</p>}
                     <button 
                        onClick={handleConfirmSelection}
                        disabled={!selectedOption}
                        className="w-full bg-accent hover:brightness-125 disabled:opacity-50 disabled:hover:brightness-100 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                    >
                        <Download size={20} /> Apply Lyrics
                    </button>
                 </div>
             </div>
        </div>
      )
  }

  // 5. Main Lyrics Display
  return (
    <div 
        className="relative h-full group/container cursor-default"
        // Tap anywhere on background to exit immersive mode (only active if immersive is enabled)
        onClick={() => {
            if (isImmersive && setIsImmersive) {
                setIsImmersive(false);
            }
        }}
    >
      
      {/* === SAFE ZONES (ONLY IN IMMERSIVE MODE) === */}
      {/* 
          These zones sit at the very top (z-50) to catch clicks meant for the "exit" action 
          in the areas where controls/player bar would usually be.
          They are ONLY rendered when isImmersive is true.
      */}
      
      {isImmersive && (
          <>
            {/* Top Safe Zone: Covers where the minimize/settings buttons would be */}
            <div 
                className="absolute top-0 left-0 right-0 h-24 z-50 w-full cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    if (setIsImmersive) setIsImmersive(false);
                }}
            />
            
            {/* Bottom Safe Zone: Covers where the player bar would be */}
            <div 
                className="absolute bottom-0 left-0 right-0 h-28 z-50 w-full cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    if (setIsImmersive) setIsImmersive(false);
                }}
            />
          </>
      )}

      {/* Top Right Controls (Immersive Toggle & Settings) */}
      {/* Hidden/Disabled in Immersive Mode (so Safe Zone takes over) */}
      <div 
        className={`absolute top-6 right-6 z-50 flex items-center gap-2 transition-all duration-500 ${isImmersive || viewState !== 'LYRICS' ? 'opacity-0 pointer-events-none translate-y-[-20px]' : 'opacity-100 translate-y-0'}`}
      >
          {setIsImmersive && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsImmersive(true); }}
                className="p-3 rounded-full bg-black/20 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-md transition"
                title="Immersive Mode"
              >
                  <Expand size={24} />
              </button>
          )}

          <button 
              onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); }}
              className={`p-3 rounded-full transition ${isSettingsOpen ? 'bg-white text-black' : 'bg-black/20 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-md'}`}
              title="Lyrics Settings"
          >
              <Settings2 size={24} />
          </button>
      </div>

      {/* Settings Menu */}
      {isSettingsOpen && (
          <div 
            ref={settingsRef} 
            className="absolute top-20 right-6 z-50 w-72 bg-neutral-900/95 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-4 animate-fade-in flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()} // Prevent closing immersive when clicking inside menu
          >
              
              {/* Actions Section */}
              <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                      <button onClick={openSearchForm} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 flex flex-col items-center gap-1 transition">
                          <Search size={16} className="text-accent" />
                          <span className="text-xs font-medium">Search</span>
                      </button>
                      <button onClick={() => song && song.lyrics && downloadLrcFile(song.artist, song.title, song.lyrics)} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 flex flex-col items-center gap-1 transition">
                          <FileDown size={16} className="text-accent" />
                          <span className="text-xs font-medium">Save .LRC</span>
                      </button>
                  </div>
              </div>

              {/* Sync Section */}
              <div>
                  <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Timing Sync</p>
                      <span className="text-xs font-mono text-accent">{offset > 0 ? '+' : ''}{offset.toFixed(1)}s</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
                      <button onClick={() => setOffset(prev => prev - 0.5)} className="p-2 hover:bg-white/10 rounded flex-1 flex justify-center"><Minus size={14}/></button>
                      <div className="h-4 w-px bg-white/10"></div>
                      <button onClick={() => setOffset(0)} className="text-[10px] font-bold text-white/40 hover:text-white px-2 uppercase">Reset</button>
                      <div className="h-4 w-px bg-white/10"></div>
                      <button onClick={() => setOffset(prev => prev + 0.5)} className="p-2 hover:bg-white/10 rounded flex-1 flex justify-center"><Plus size={14}/></button>
                  </div>
              </div>

              {/* Alignment Section */}
              <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Alignment</p>
                  <div className="flex bg-white/5 rounded-lg p-1">
                      <button onClick={() => setAlignment('left')} className={`flex-1 p-1.5 rounded flex justify-center transition ${alignment === 'left' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}><AlignLeft size={16}/></button>
                      <button onClick={() => setAlignment('center')} className={`flex-1 p-1.5 rounded flex justify-center transition ${alignment === 'center' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}><AlignCenter size={16}/></button>
                      <button onClick={() => setAlignment('word')} className={`flex-1 p-1.5 rounded flex justify-center transition ${alignment === 'word' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}><AlignJustify size={16}/></button>
                  </div>
              </div>

              {/* Background Visuals */}
              {setBgBlur && setBgOpacity && (
                  <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Background</p>
                      <div className="space-y-3">
                          <div className="flex items-center gap-3">
                              <span className="text-[10px] w-8 text-white/50">Blur</span>
                              <input 
                                  type="range" min="0" max="100" value={bgBlur} 
                                  onChange={(e) => setBgBlur(Number(e.target.value))}
                                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                              />
                              <span className="text-[10px] w-6 text-right font-mono">{bgBlur}</span>
                          </div>
                          <div className="flex items-center gap-3">
                              <span className="text-[10px] w-8 text-white/50">Dim</span>
                              <input 
                                  type="range" min="0" max="90" step="5" value={bgOpacity * 100} 
                                  onChange={(e) => setBgOpacity(Number(e.target.value) / 100)}
                                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                              />
                              <span className="text-[10px] w-6 text-right font-mono">{Math.round(bgOpacity * 100)}%</span>
                          </div>
                      </div>
                  </div>
              )}

              {/* Player Bar Visuals */}
              {setBarBlur && setBarOpacity && (
                  <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Player Bar</p>
                      <div className="space-y-3">
                          <div className="flex items-center gap-3">
                              <span className="text-[10px] w-8 text-white/50">Blur</span>
                              <input 
                                  type="range" min="0" max="100" value={barBlur} 
                                  onChange={(e) => setBarBlur(Number(e.target.value))}
                                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                              />
                              <span className="text-[10px] w-6 text-right font-mono">{barBlur}</span>
                          </div>
                          <div className="flex items-center gap-3">
                              <span className="text-[10px] w-8 text-white/50">Dim</span>
                              <input 
                                  type="range" min="0" max="100" step="5" value={barOpacity * 100} 
                                  onChange={(e) => setBarOpacity(Number(e.target.value) / 100)}
                                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                              />
                              <span className="text-[10px] w-6 text-right font-mono">{Math.round(barOpacity * 100)}%</span>
                          </div>
                      </div>
                  </div>
              )}

              <button onClick={() => { 
                  if(setBgBlur) setBgBlur(60); 
                  if(setBgOpacity) setBgOpacity(0.6);
                  if(setBarBlur) setBarBlur(20);
                  if(setBarOpacity) setBarOpacity(0.7);
              }} className="w-full text-[10px] text-white/30 hover:text-accent mt-2">Reset Visuals</button>

          </div>
      )}

      {/* Lyrics Container */}
      <div 
        ref={containerRef} 
        className={`
            h-full overflow-y-auto no-scrollbar relative z-10
            ${alignment === 'center' ? 'text-center px-8' : ''}
            ${alignment === 'left' ? 'text-left px-8 md:px-20' : ''}
            ${alignment === 'word' ? 'text-left max-w-3xl mx-auto px-8 md:px-12' : ''}
        `}
        style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 100%)'
        }}
      >
        {/* Visual Spacer Top - To center start */}
        <div className="w-full h-[15vh] shrink-0" />

        <div className="flex flex-col gap-8">
          {song?.lyrics?.map((line, index) => {
            const effectiveTime = line.time + offset;
            const nextEffectiveTime = (song.lyrics![index + 1]?.time || Infinity) + offset;
            const isActive = currentTime >= effectiveTime && currentTime < nextEffectiveTime;
            
            return (
              <p
                key={index}
                ref={isActive ? activeLineRef : null}
                onClick={(e) => { 
                    e.stopPropagation(); // CRITICAL: Stop exit immersive mode when clicking text
                    onSeek(effectiveTime); 
                }}
                className={`
                  text-4xl md:text-5xl font-bold transition-all duration-500 cursor-pointer leading-tight relative z-20
                  ${isActive ? 'text-white scale-105 opacity-100 blur-none' : 'text-white/40 opacity-60 blur-[1px] hover:opacity-80'}
                `}
              >
                {line.text}
              </p>
            );
          })}
        </div>
        
        {/* Visual Spacer Bottom - To center end */}
        <div className="w-full h-[50vh] shrink-0" />
      </div>
    </div>
  );
};