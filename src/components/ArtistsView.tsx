
import React, { useMemo, useEffect, useState } from 'react';
import { Song, ArtistMetadata } from '../types';
import { User } from 'lucide-react';
import { loadAllArtistsMetadata } from '../services/fileSystemService';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface ArtistsViewProps {
  songs: Song[];
  onSelectArtist: (artist: string) => void;
}

// Separate Cell component
const ArtistCell = ({ columnIndex, rowIndex, style, data }: any) => {
    const { artists, columnCount, onSelectArtist, cachedImages } = data;
    const index = rowIndex * columnCount + columnIndex;
    if (index >= artists.length) return null;

    const artist = artists[index];
    const displayImage = cachedImages[artist.name] || artist.image;

    return (
        <div style={{ ...style, padding: '12px' }}>
            <div 
                onClick={() => onSelectArtist(artist.name)}
                className="group cursor-pointer flex flex-col items-center text-center h-full"
            >
                <div className="w-full aspect-square rounded-full overflow-hidden bg-neutral-900 mb-4 shadow-2xl shadow-black/50 relative border-2 border-transparent group-hover:border-accent/50 transition-colors">
                    {displayImage ? (
                        <img 
                            src={displayImage} 
                            alt={artist.name} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-90 group-hover:opacity-100" 
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                            <User size="40%" />
                        </div>
                    )}
                </div>
                <h3 className="font-bold text-white group-hover:text-accent transition truncate w-full text-sm md:text-base">{artist.name}</h3>
                <p className="text-xs text-white/40 mt-1">Artist</p>
            </div>
        </div>
    );
};

export const ArtistsView: React.FC<ArtistsViewProps> = ({ songs, onSelectArtist }) => {
  // Store DB images in a map: "Artist Name" -> "Image URL"
  const [cachedImages, setCachedImages] = useState<Record<string, string>>({});

  // Load cached images on mount AND listen for updates
  useEffect(() => {
    const fetchCachedImages = async () => {
        const allMeta = await loadAllArtistsMetadata();
        const imgMap: Record<string, string> = {};
        allMeta.forEach(meta => {
            if (meta.imageUrl) {
                imgMap[meta.name] = meta.imageUrl;
            }
        });
        setCachedImages(prev => ({ ...prev, ...imgMap }));
    };
    
    fetchCachedImages();

    // Real-time listener for background sync
    const handleUpdate = (event: Event) => {
        const customEvent = event as CustomEvent<ArtistMetadata>;
        const newData = customEvent.detail;
        if (newData && newData.imageUrl) {
            setCachedImages(prev => ({
                ...prev,
                [newData.name]: newData.imageUrl
            }));
        }
    };

    window.addEventListener('artist-metadata-updated', handleUpdate);
    return () => window.removeEventListener('artist-metadata-updated', handleUpdate);
  }, []);

  const artists = useMemo(() => {
    const map = new Map<string, { name: string; count: number; image: string }>();
    
    songs.forEach(song => {
      if (!map.has(song.artist)) {
        map.set(song.artist, {
            name: song.artist,
            count: 0,
            image: song.coverUrl || ""
        });
      }
      const entry = map.get(song.artist)!;
      entry.count++;
      // If we don't have an image from songs yet, try to get one
      if (!entry.image && song.coverUrl) {
          entry.image = song.coverUrl;
      }
    });
    
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [songs]);

  return (
    <div className="flex-1 h-full flex flex-col bg-black">
        {/* Header */}
        <div className="flex-shrink-0 p-6 md:p-10 pb-0">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-4xl font-bold">Artists</h1>
                <span className="text-white/40 font-bold text-sm tracking-wider">{artists.length} ARTISTS</span>
            </div>
        </div>

        {/* Virtual Grid */}
        <div className="flex-1 px-4 md:px-8">
            <AutoSizer>
                {({ height, width }) => {
                    const minCardWidth = 180;
                    const columnCount = Math.max(2, Math.floor(width / minCardWidth));
                    const columnWidth = Math.floor(width / columnCount);
                    // Row Height = Width (Square) + Text space (approx 70px)
                    const rowHeight = columnWidth + 70;
                    const rowCount = Math.ceil(artists.length / columnCount);

                    return (
                        <FixedSizeGrid
                            columnCount={columnCount}
                            columnWidth={columnWidth}
                            height={height}
                            rowCount={rowCount}
                            rowHeight={rowHeight}
                            width={width}
                            itemData={{ artists, columnCount, onSelectArtist, cachedImages }}
                            className="no-scrollbar pb-32"
                        >
                            {ArtistCell}
                        </FixedSizeGrid>
                    );
                }}
            </AutoSizer>
        </div>
    </div>
  );
};
