

import { Song, LyricsLine } from "../types";

// Helper to generate consistent IDs
export const generateId = (artist: string, album: string, title: string) => {
  const clean = (str: string) => (str || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return `${clean(artist)}_${clean(album)}_${clean(title)}`;
};

export const getAlbumId = (artist: string, album: string) => {
  const clean = (str: string) => (str || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return `${clean(artist)}_${clean(album)}`;
};

// Helper to get duration from audio file
const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const audio = new Audio(objectUrl);
        
        audio.onloadedmetadata = () => {
            const duration = audio.duration;
            URL.revokeObjectURL(objectUrl);
            if (duration === Infinity || isNaN(duration)) {
                resolve(0);
            } else {
                resolve(duration);
            }
        };

        audio.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(0);
        };
    });
};

export const parseFileMetadata = async (file: File, customAddedAt?: number): Promise<Song> => {
    // 1. Get Duration (Parallel to tags for speed)
    const durationPromise = getAudioDuration(file);

    // 2. Parse Tags
    const tagsPromise = new Promise<any>((resolve) => {
        if (!window.jsmediatags) {
            resolve(null);
            return;
        }
        
        window.jsmediatags.read(file, {
            onSuccess: (tag: any) => resolve(tag),
            onError: () => resolve(null)
        });
    });

    const [duration, tagResult] = await Promise.all([durationPromise, tagsPromise]);
    
    // Fallback basic data
    const basicData = parseMetadataFromFilename(file.name);
    
    const songData: Song = {
      id: "", 
      file: file, 
      title: basicData.title,
      artist: basicData.artist,
      album: "Unknown Album",
      genre: "Unknown Genre",
      year: "",
      duration: duration || 0, // Use the calculated duration
      coverUrl: undefined,
      lyrics: undefined,
      isSyncedFromMetadata: false,
      description: undefined,
      // If customAddedAt is provided (for batch processing order), use it. 
      // Otherwise use current time with random buffer.
      addedAt: customAddedAt !== undefined ? customAddedAt : (Date.now() + Math.random()) 
    };

    if (tagResult) {
        const tags = tagResult.tags;
        
        if (tags.title) songData.title = tags.title;
        
        // --- ARTIST DETECTION LOGIC ---
        const getText = (field: any): string | null => {
            if (!field) return null;
            if (Array.isArray(field)) return getText(field[0]);
            if (typeof field === 'string') return field.trim();
            if (typeof field === 'object' && field.data) {
                return typeof field.data === 'string' ? field.data.trim() : null;
            }
            return null;
        };

        const getTxxxValue = (validDescriptions: string[]): string | null => {
            if (!tags.TXXX) return null;
            const frames = Array.isArray(tags.TXXX) ? tags.TXXX : [tags.TXXX];
            for (const f of frames) {
                const description = f.description || f.user_description;
                if (description && typeof description === 'string') {
                    if (validDescriptions.includes(description.toLowerCase().trim())) {
                        return getText(f);
                    }
                }
            }
            return null;
        };

        const detectedArtist = 
            getTxxxValue(['album artist', 'albumartist', 'album_artist']) ||
            getText(tags.TPE2) ||           
            getText(tags.TP2) ||            
            getText(tags.aART) ||           
            getText(tags.band) ||           
            getText(tags.performerInfo) ||  
            getText(tags.albumArtist) ||    
            getText(tags.ALBUMARTIST) ||    
            getText(tags['Album Artist']) || 
            getTxxxValue(['band', 'orchestra', 'accompaniment', 'performer']) ||
            getText(tags.TPE1) ||
            getText(tags.TP1) ||
            getText(tags.artist);

        if (detectedArtist) {
            songData.artist = detectedArtist;
        }

        if (tags.album) songData.album = tags.album;
        if (tags.year) songData.year = tags.year;
        if (tags.genre) songData.genre = tags.genre;

        // Extract Cover Art
        if (tags.picture) {
          const { data, format } = tags.picture;
          let base64String = "";
          for (let i = 0; i < data.length; i++) {
            base64String += String.fromCharCode(data[i]);
          }
          songData.coverUrl = `data:${format};base64,${window.btoa(base64String)}`;
        }

        // Extract Lyrics
        if (tags.lyrics) {
          const rawLyrics = typeof tags.lyrics === 'object' ? tags.lyrics.lyrics : tags.lyrics;
          if (rawLyrics && typeof rawLyrics === 'string') {
            const parsedLyrics = parseUnsyncedLyrics(rawLyrics);
            if (parsedLyrics.length > 0) {
               songData.lyrics = parsedLyrics;
               if (rawLyrics.includes('[0')) {
                   songData.isSyncedFromMetadata = true;
               }
            }
          }
        }
    }
        
    // Generate ID after all metadata is processed
    songData.id = generateId(songData.artist, songData.album, songData.title);
    return songData;
};

const parseUnsyncedLyrics = (raw: string): LyricsLine[] => {
  const lines = raw.split('\n');
  const result: LyricsLine[] = [];
  let estimatedTime = 0;

  const timeRegex = /\[(\d{2}):(\d{2})(\.\d{2,3})?\]/;

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    const match = cleanLine.match(timeRegex);
    
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const milliseconds = match[3] ? parseFloat(match[3]) : 0;
      const totalSeconds = minutes * 60 + seconds + milliseconds;
      const text = cleanLine.replace(timeRegex, '').trim();
      
      if (text) {
        result.push({ time: totalSeconds, text });
      }
    } else {
      result.push({ time: estimatedTime, text: cleanLine });
      estimatedTime += 4; 
    }
  }
  
  return result;
};

export const parseMetadataFromFilename = (filename: string) => {
  const name = filename.replace(/\.[^/.]+$/, "");
  return {
    artist: "Unknown Artist",
    title: name
  };
};