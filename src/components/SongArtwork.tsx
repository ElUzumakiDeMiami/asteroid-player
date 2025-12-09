import React, { useEffect, useState } from 'react';
import { Song } from '../types';
import { getSongCoverImage } from '../services/fileSystemService';
import { Music } from 'lucide-react';

interface SongArtworkProps {
  song: Song;
  className?: string;
  alt?: string;
}

export const SongArtwork: React.FC<SongArtworkProps> = ({ song, className, alt }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    // 1. If we have a legacy/memory URL, use it immediately
    if (song.coverUrl) {
        setImageSrc(song.coverUrl);
        return;
    }

    // 2. If we know there is a cover in DB, fetch it
    if (song.hasCover) {
        let isMounted = true;
        getSongCoverImage(song.id).then((data) => {
            if (isMounted && data) {
                setImageSrc(data);
            }
        });
        return () => { isMounted = false; };
    }

    // 3. No cover
    setImageSrc(null);
  }, [song.id, song.coverUrl, song.hasCover]);

  if (imageSrc) {
      return <img src={imageSrc} alt={alt || song.title} className={className} loading="lazy" />;
  }

  // Fallback placeholder
  return (
      <div className={`flex items-center justify-center bg-neutral-800 text-white/20 ${className}`}>
          <Music size="40%" />
      </div>
  );
};