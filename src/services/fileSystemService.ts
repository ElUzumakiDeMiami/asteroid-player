
import { LyricsLine, Song, ArtistMetadata, Playlist, AlbumMetadata, PlaylistRule } from "../types";
import { parseFileMetadata, generateId } from "./metadataService";

const DB_NAME = 'AuraMusicDB';
const LYRICS_STORE = 'lyrics';
const SONGS_STORE = 'songs';
const ARTISTS_STORE = 'artists';
const PLAYLISTS_STORE = 'playlists';
const ALBUMS_STORE = 'albums_meta';
const IMAGES_STORE = 'images'; 
const DB_VERSION = 6; 

// Detect Native Mode
const isElectron = () => {
  return window.electronAPI?.isElectron === true;
};

/**
 * Initialize IndexedDB
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(LYRICS_STORE)) {
        db.createObjectStore(LYRICS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SONGS_STORE)) {
        db.createObjectStore(SONGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ARTISTS_STORE)) {
        db.createObjectStore(ARTISTS_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
        db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ALBUMS_STORE)) {
        db.createObjectStore(ALBUMS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// ... (Keep existing LRC Helpers and Getters/Setters) ...
export const formatLrcTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
};

export const createLrcContent = (lyrics: LyricsLine[]): string => {
  return lyrics
    .map(line => `${formatLrcTimestamp(line.time)}${line.text}`)
    .join('\n');
};

const parseLrcContent = (content: string): LyricsLine[] => {
    const lines = content.split('\n');
    const result: LyricsLine[] = [];
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
        if (text) result.push({ time: totalSeconds, text });
      }
    }
    return result;
  };

export const saveLyricsToStorage = async (artist: string, album: string, title: string, lyrics: LyricsLine[]): Promise<boolean> => {
  try {
    const db = await openDB();
    const tx = db.transaction(LYRICS_STORE, 'readwrite');
    const store = tx.objectStore(LYRICS_STORE);
    const content = createLrcContent(lyrics);
    const id = generateId(artist, album, title);
    await new Promise((resolve, reject) => {
      const request = store.put({ id, artist, album, title, content, savedAt: Date.now() });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
    return true;
  } catch (error) { return false; }
};

export const loadLyricsFromStorage = async (artist: string, album: string, title: string): Promise<LyricsLine[] | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(LYRICS_STORE, 'readonly');
    const store = tx.objectStore(LYRICS_STORE);
    const id = generateId(artist, album, title);
    const record: any = await new Promise((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    if (record && record.content) return parseLrcContent(record.content);
    return null;
  } catch (error) { return null; }
};

// ... (Existing Metadata functions omitted for brevity, assume they exist) ...
export const saveArtistMetadata = async (metadata: ArtistMetadata): Promise<boolean> => {
  try {
    const db = await openDB();
    const tx = db.transaction(ARTISTS_STORE, 'readwrite');
    const store = tx.objectStore(ARTISTS_STORE);
    await new Promise((resolve, reject) => {
      const request = store.put(metadata);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
    return true;
  } catch (error) { return false; }
};

export const loadArtistMetadata = async (artistName: string): Promise<ArtistMetadata | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(ARTISTS_STORE, 'readonly');
    const store = tx.objectStore(ARTISTS_STORE);
    return await new Promise((resolve) => {
      const request = store.get(artistName);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (error) { return null; }
};

export const loadAllArtistsMetadata = async (): Promise<ArtistMetadata[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(ARTISTS_STORE, 'readonly');
    const store = tx.objectStore(ARTISTS_STORE);
    return await new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) { return []; }
};

export const saveAlbumMetadata = async (metadata: AlbumMetadata): Promise<boolean> => {
  try {
    const db = await openDB();
    const tx = db.transaction(ALBUMS_STORE, 'readwrite');
    const store = tx.objectStore(ALBUMS_STORE);
    await new Promise((resolve, reject) => {
      const request = store.put(metadata);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
    return true;
  } catch (error) { return false; }
};

export const loadAllAlbumsMetadata = async (): Promise<AlbumMetadata[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(ALBUMS_STORE, 'readonly');
    const store = tx.objectStore(ALBUMS_STORE);
    return await new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) { return []; }
};

export const savePlaylist = async (playlist: Playlist): Promise<boolean> => {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
    const store = tx.objectStore(PLAYLISTS_STORE);
    await new Promise((resolve, reject) => {
      const request = store.put(playlist);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
    return true;
  } catch (error) { return false; }
};

export const getPlaylists = async (): Promise<Playlist[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLISTS_STORE, 'readonly');
    const store = tx.objectStore(PLAYLISTS_STORE);
    return await new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) { return []; }
};

export const deletePlaylist = async (id: string): Promise<boolean> => {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
    const store = tx.objectStore(PLAYLISTS_STORE);
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
    return true;
  } catch (error) { return false; }
};

// --- SMART PLAYLIST ANALYSIS & GENERATION ---

// Helper to get decade
const getDecade = (year?: string): number | null => {
    if (!year) return null;
    // Extract first 4 digits
    const match = year.match(/\d{4}/);
    if (!match) return null;
    const y = parseInt(match[0]);
    if (isNaN(y)) return null;
    return Math.floor(y / 10) * 10;
};

export const analyzeAndGenerateSmartPlaylists = async (library: Song[]): Promise<Playlist[]> => {
    if (library.length < 5) return await getPlaylists(); // Need some data

    const db = await openDB();
    const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
    const store = tx.objectStore(PLAYLISTS_STORE);

    // 1. Get Existing Playlists
    const existingPlaylists: Playlist[] = await new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });

    const newPlaylists: Playlist[] = [...existingPlaylists];
    const createdIds: string[] = [];

    // Helper to create or update playlist
    const createOrUpdate = (name: string, songs: Song[], type: 'decade_genre' | 'decade_best' | 'discovery', cover?: string) => {
        if (songs.length < 5) return; // Ignore small clusters

        // Limit playlist size for optimization (infinite scroll prevention)
        const MAX_SIZE = 50; 
        // Heuristic: Prefer songs with Cover Art or higher bitrate (simulated by having more metadata)
        const sortedSongs = songs.sort((a, b) => {
            const scoreA = (a.coverUrl ? 2 : 0) + (a.album !== 'Unknown Album' ? 1 : 0);
            const scoreB = (b.coverUrl ? 2 : 0) + (b.album !== 'Unknown Album' ? 1 : 0);
            return scoreB - scoreA;
        }).slice(0, MAX_SIZE);

        const songIds = sortedSongs.map(s => s.id);
        const existingIndex = newPlaylists.findIndex(p => p.name === name && p.isGenerated);

        const now = Date.now();
        const playlist: Playlist = {
            id: existingIndex !== -1 ? newPlaylists[existingIndex].id : Date.now().toString() + Math.random().toString().slice(2, 6),
            name,
            songIds,
            createdAt: existingIndex !== -1 ? newPlaylists[existingIndex].createdAt : now,
            isGenerated: true,
            // Renew expiration on update
            expiresAt: now + (48 * 60 * 60 * 1000), // 48 Hours life
            coverUrl: cover || sortedSongs[0]?.coverUrl // Use first song cover as fallback
        };

        if (existingIndex !== -1) {
            newPlaylists[existingIndex] = playlist;
        } else {
            newPlaylists.push(playlist);
        }
        
        store.put(playlist);
    };

    // --- LOGIC 1: DECADE + GENRE MATRIX ---
    // Example: "90s Rock Mix", "80s Pop Mix"
    const matrix: Record<string, Song[]> = {};
    
    library.forEach(song => {
        const decade = getDecade(song.year);
        const genre = song.genre;
        if (decade && genre && genre !== 'Unknown Genre') {
            const key = `${decade}s ${genre}`;
            if (!matrix[key]) matrix[key] = [];
            matrix[key].push(song);
        }
    });

    Object.entries(matrix).forEach(([key, songs]) => {
        createOrUpdate(`${key} Mix`, songs, 'decade_genre');
    });

    // --- LOGIC 2: DECADE BEST ---
    // Example: "Best of 1990s"
    const decades: Record<number, Song[]> = {};
    library.forEach(song => {
        const decade = getDecade(song.year);
        if (decade) {
            if (!decades[decade]) decades[decade] = [];
            decades[decade].push(song);
        }
    });

    Object.entries(decades).forEach(([decade, songs]) => {
        // Only make "Best of" if we have a substantial amount
        if (songs.length > 10) {
            createOrUpdate(`Best of ${decade}s`, songs, 'decade_best');
        }
    });

    // Clean up truly expired or empty generated playlists (garbage collection)
    const now = Date.now();
    for (const pl of existingPlaylists) {
        if (pl.isGenerated && pl.expiresAt && pl.expiresAt < now) {
            store.delete(pl.id);
        }
    }

    return newPlaylists;
};

// Kept for backward compatibility but calls the new logic
export const processEphemeralPlaylists = analyzeAndGenerateSmartPlaylists;

export const removeSongFromPlaylists = async (songId: string): Promise<boolean> => {
    try {
        const playlists = await getPlaylists();
        const db = await openDB();
        const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
        const store = tx.objectStore(PLAYLISTS_STORE);
        let hasChanges = false;
        const updates = playlists.map(playlist => {
            const originalCount = playlist.songIds.length;
            const newSongIds = playlist.songIds.filter(id => id !== songId);
            if (newSongIds.length !== originalCount) {
                hasChanges = true;
                return new Promise<void>((resolve) => {
                    store.put({ ...playlist, songIds: newSongIds });
                    resolve();
                });
            }
            return Promise.resolve();
        });
        await Promise.all(updates);
        return true;
    } catch (e) { return false; }
}

export const isFileSystemAPISupported = () => {
  if (isElectron()) return true;
  return typeof window !== 'undefined' && !!window.showDirectoryPicker;
};

const prepareSongForStorage = (song: Song) => {
    const songToStore = { ...song };
    if (songToStore.path) {
        delete songToStore.file;
        delete songToStore.fileHandle; 
    } else if (songToStore.fileHandle) {
        delete songToStore.file;
    }
    // Remove base64 image string to save space in song object
    // We will store it separately in IMAGES_STORE if hasCover is true
    if (songToStore.coverUrl && songToStore.coverUrl.startsWith('data:')) {
        delete songToStore.coverUrl;
        songToStore.hasCover = true;
    }
    return songToStore;
};

export const getSongCoverImage = async (songId: string): Promise<string | null> => {
    try {
        const db = await openDB();
        const tx = db.transaction(IMAGES_STORE, 'readonly');
        const store = tx.objectStore(IMAGES_STORE);
        const record: any = await new Promise((resolve) => {
            const req = store.get(songId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
        if (record && record.data) {
            return record.data;
        }
        return null;
    } catch (e) { return null; }
};

export const getSongById = async (songId: string): Promise<Song | null> => {
    try {
        const db = await openDB();
        const tx = db.transaction(SONGS_STORE, 'readonly');
        const store = tx.objectStore(SONGS_STORE);
        const song: Song = await new Promise((resolve, reject) => {
            const req = store.get(songId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return song || null;
    } catch (e) { return null; }
};

export const saveSongToStorage = async (song: Song): Promise<boolean> => {
  return saveSongsToStorage([song]);
};

export const deleteSongFromStorage = async (songId: string): Promise<boolean> => {
    try {
        const db = await openDB();
        const tx = db.transaction([SONGS_STORE, IMAGES_STORE], 'readwrite');
        const songStore = tx.objectStore(SONGS_STORE);
        songStore.delete(songId);
        const imageStore = tx.objectStore(IMAGES_STORE);
        imageStore.delete(songId);
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
        return true;
    } catch (e) { return false; }
};

export const updateSongMetadata = async (originalSongId: string, updatedSong: Song): Promise<boolean> => {
    try {
        // --- 1. ELECTRON ID3 TAG WRITING ---
        if (isElectron() && updatedSong.path && window.electronAPI) {
            const writeSuccess = await window.electronAPI.writeMetadata(updatedSong.path, {
                title: updatedSong.title,
                artist: updatedSong.artist,
                album: updatedSong.album,
                year: updatedSong.year,
                genre: updatedSong.genre,
                coverUrl: updatedSong.coverUrl
            });
            if (!writeSuccess) console.warn("Failed to write ID3 tags to file system.");
        }

        // --- 2. UPDATE INDEXEDDB ---
        const db = await openDB();
        const tx = db.transaction([SONGS_STORE, IMAGES_STORE], 'readwrite');
        const songStore = tx.objectStore(SONGS_STORE);
        const imageStore = tx.objectStore(IMAGES_STORE);
        
        // Handle ID Change (e.g. Title changed)
        if (originalSongId !== updatedSong.id) {
            
            // If the user DID NOT provide a new cover (coverUrl is undefined or not base64),
            // but the ID changed, we must migrate the old cover to the new ID.
            let hasNewCover = updatedSong.coverUrl && updatedSong.coverUrl.startsWith('data:');
            
            if (!hasNewCover) {
                const getOldReq = imageStore.get(originalSongId);
                getOldReq.onsuccess = () => {
                    const oldData = getOldReq.result;
                    if (oldData) {
                        imageStore.put({ id: updatedSong.id, data: oldData.data });
                        imageStore.delete(originalSongId);
                    }
                }
            } else {
                imageStore.delete(originalSongId);
            }
            songStore.delete(originalSongId);
        }
        
        if (updatedSong.coverUrl && updatedSong.coverUrl.startsWith('data:')) {
            imageStore.put({ id: updatedSong.id, data: updatedSong.coverUrl });
        }

        const preparedSong = prepareSongForStorage(updatedSong);
        
        await new Promise((resolve, reject) => {
            const request = songStore.put(preparedSong);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
        
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });

        return true;
    } catch (e) { 
        return false; 
    }
}

export const saveSongsToStorage = async (songs: Song[]): Promise<boolean> => {
    if (songs.length === 0) return true;
    try {
        const db = await openDB();
        const tx = db.transaction([SONGS_STORE, IMAGES_STORE], 'readwrite');
        const songStore = tx.objectStore(SONGS_STORE);
        const imageStore = tx.objectStore(IMAGES_STORE);

        const promises = songs.map(song => {
            return new Promise<void>((resolve) => {
                try {
                    if (song.coverUrl && song.coverUrl.startsWith('data:')) {
                        imageStore.put({ id: song.id, data: song.coverUrl });
                    }
                    const cleanSong = prepareSongForStorage(song);
                    if (song.coverUrl && song.coverUrl.startsWith('data:')) {
                        cleanSong.hasCover = true;
                    }
                    const request = songStore.put(cleanSong);
                    request.onsuccess = () => resolve();
                    request.onerror = () => resolve(); 
                } catch (e) { resolve(); }
            });
        });
        await Promise.all(promises);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => { resolve(true); };
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) { return false; }
};

export const migrateAddedAtTimestamps = async (): Promise<boolean> => {
  try {
    const db = await openDB();
    const readTx = db.transaction(SONGS_STORE, 'readonly');
    const readStore = readTx.objectStore(SONGS_STORE);
    const songs = await new Promise<Song[]>((resolve) => {
      const request = readStore.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
    const updates = songs
        .filter(s => !s.addedAt)
        .map((s, i) => ({ ...s, addedAt: Date.now() - (songs.length * 10000) + (i * 10000) }));
    if (updates.length === 0) return true;
    const writeTx = db.transaction(SONGS_STORE, 'readwrite');
    const writeStore = writeTx.objectStore(SONGS_STORE);
    await Promise.all(updates.map(song => {
      return new Promise((resolve) => {
        const req = writeStore.put(prepareSongForStorage(song));
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    }));
    return true;
  } catch (error) { return false; }
};

export async function* loadSongsInBatches(batchSize: number = 200): AsyncGenerator<Song[], void, unknown> {
    const db = await openDB();
    const tx = db.transaction(SONGS_STORE, 'readonly');
    const store = tx.objectStore(SONGS_STORE);
    
    let cursorRequest = store.openCursor();
    let batch: Song[] = [];

    await new Promise<void>((resolve, reject) => {
        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
            if (cursor) {
                const s = cursor.value as Song;
                batch.push({
                    id: s.id,
                    title: s.title,
                    artist: s.artist,
                    album: s.album,
                    duration: s.duration,
                    year: s.year,
                    genre: s.genre,
                    addedAt: s.addedAt,
                    hasCover: s.hasCover,
                    path: s.path,
                    fileHandle: s.fileHandle,
                    coverUrl: s.coverUrl 
                });
                cursor.continue();
            } else {
                resolve();
            }
        };
        cursorRequest.onerror = () => reject();
    });
}

export const loadSongsRange = async (offset: number, limit: number): Promise<Song[]> => {
    try {
        const db = await openDB();
        const tx = db.transaction(SONGS_STORE, 'readonly');
        const store = tx.objectStore(SONGS_STORE);
        
        return await new Promise<Song[]>((resolve, reject) => {
            const items: Song[] = [];
            let hasAdvanced = false;
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
                if (!cursor) {
                    resolve(items);
                    return;
                }

                if (offset > 0 && !hasAdvanced) {
                    hasAdvanced = true;
                    cursor.advance(offset);
                    return;
                }

                const s = cursor.value as Song;
                items.push({
                    id: s.id,
                    title: s.title,
                    artist: s.artist,
                    album: s.album,
                    duration: s.duration,
                    year: s.year,
                    genre: s.genre,
                    addedAt: s.addedAt,
                    hasCover: s.hasCover,
                    path: s.path,
                    fileHandle: s.fileHandle,
                    coverUrl: s.coverUrl
                });

                if (limit !== -1 && items.length >= limit) {
                    resolve(items);
                } else {
                    cursor.continue();
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        return [];
    }
};

export const loadAllSongsFromStorage = async (): Promise<Song[]> => {
    return loadSongsRange(0, -1);
};

export const getSongFile = async (song: Song): Promise<File | string | null> => {
  if (song.path && isElectron()) {
    return song.path;
  }
  if (song.file) return song.file;

  if (song.fileHandle) {
    try {
      const options = { mode: 'read' as 'read' | 'readwrite' };
      const handle = song.fileHandle;

      if ((handle as any).queryPermission) {
         const perm = await (handle as any).queryPermission(options);
         if (perm !== 'granted') {
            if ((handle as any).requestPermission) {
                const req = await (handle as any).requestPermission(options);
                if (req !== 'granted') throw new Error("Permission denied");
            }
         }
      }
      return await song.fileHandle.getFile();
    } catch (e) {
      console.error("Could not retrieve file from handle:", e);
      throw e; 
    }
  }
  return null;
};

// --- MODIFIED: Scan Logic with Persistence ---
export const selectDirectoryAndScan = async (): Promise<Song[]> => {
  const baseTime = Date.now();
  let importCounter = 0;

  if (isElectron() && window.electronAPI) {
     try {
        // Updated to receive { rootPath, songs } from Electron
        const { rootPath, songs: nativeRawSongs } = await window.electronAPI.selectFolder();
        
        if (!nativeRawSongs) return [];

        const processedSongs: Song[] = nativeRawSongs.map((raw: any, index: number) => ({
            id: generateId(raw.artist, raw.album, raw.title),
            path: raw.path,
            title: raw.title,
            artist: raw.artist,
            album: raw.album,
            duration: 0,
            coverUrl: raw.coverUrl,
            year: raw.year,
            genre: raw.genre,
            addedAt: baseTime + (index * 10) 
        }));
        
        await saveSongsToStorage(processedSongs);
        
        // Save the path for next time
        if (rootPath) {
            localStorage.setItem('library_root_path', rootPath);
        }

        return processedSongs;
     } catch (e) {
        console.error("Native scan failed", e);
        return [];
     }
  }

  if (!isFileSystemAPISupported() || !window.showDirectoryPicker) {
    throw new Error("Not supported");
  }

  try {
    const dirHandle = await window.showDirectoryPicker();
    const allSongs: Song[] = [];
    const BATCH_SIZE = 100; 
    let batch: Song[] = [];

    const processBatch = async () => {
        if (batch.length > 0) {
            await saveSongsToStorage(batch);
            allSongs.push(...batch);
            batch = [];
        }
    };

    const scanDir = async (handle: FileSystemDirectoryHandle) => {
      // @ts-ignore
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
           const fileEntry = entry as FileSystemFileHandle;
           const name = fileEntry.name.toLowerCase();
           if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.m4a') || name.endsWith('.ogg')) {
             try {
               const file = await fileEntry.getFile();
               const song = await parseFileMetadata(file, baseTime + (importCounter * 10));
               importCounter++; 
               
               song.fileHandle = fileEntry;
               batch.push(song);
               if (batch.length >= BATCH_SIZE) {
                   await processBatch();
               }
             } catch (e) {
             }
           }
        } else if (entry.kind === 'directory') {
          await scanDir(entry as FileSystemDirectoryHandle);
        }
      }
    };

    await scanDir(dirHandle);
    await processBatch();
    return allSongs;

  } catch (err) {
    if ((err as Error).name === 'AbortError') return [];
    throw err;
  }
};

// --- NEW: AUTO SCAN ON STARTUP ---
export const scanSavedLibrary = async (): Promise<Song[]> => {
    if (!isElectron() || !window.electronAPI) return [];

    const savedPath = localStorage.getItem('library_root_path');
    if (!savedPath) return [];

    try {
        const rawSongs = await window.electronAPI.scanDirectory(savedPath);
        if (!rawSongs || rawSongs.length === 0) return [];

        const baseTime = Date.now();
        const processedSongs: Song[] = rawSongs.map((raw: any, index: number) => ({
            id: generateId(raw.artist, raw.album, raw.title),
            path: raw.path,
            title: raw.title,
            artist: raw.artist,
            album: raw.album,
            duration: 0,
            coverUrl: raw.coverUrl,
            year: raw.year,
            genre: raw.genre,
            addedAt: baseTime + (index * 10) 
        }));

        // --- SYNC LOGIC: Add new ones, Remove deleted ones ---
        
        // 1. Save all found (Update/Add)
        await saveSongsToStorage(processedSongs);

        // 2. Identify missing files (Garbage Collection)
        // Get all DB songs that have a 'path' (are native files)
        const allDbSongs = await loadAllSongsFromStorage();
        const currentPathSet = new Set(processedSongs.map(s => s.path));
        
        const songsToDelete = allDbSongs.filter(s => s.path && !currentPathSet.has(s.path));
        
        for (const song of songsToDelete) {
            await deleteSongFromStorage(song.id);
            await removeSongFromPlaylists(song.id);
        }

        return processedSongs;
    } catch (e) {
        console.error("Auto-scan failed", e);
        return [];
    }
};

// --- NEW: SCAN LOCAL IMAGES FOR PARTY MODE ---
export const scanLocalImageFolder = async (): Promise<Record<string, string[]>> => {
    if (!isElectron() || !window.electronAPI?.selectImageFolder) return {};

    try {
        const filePaths = await window.electronAPI.selectImageFolder();
        const map: Record<string, string[]> = {};

        // Helper to normalize
        const normalize = (str: string) => str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

        filePaths.forEach(path => {
            // Extract filename without extension
            // e.g. "C:/Images/Coldplay - Yellow.jpg" -> "Coldplay - Yellow"
            const filename = path.split('\\').pop()?.split('/').pop()?.replace(/\.[^/.]+$/, "") || "";
            
            // Heuristic 1: "Artist - Title"
            if (filename.includes(' - ')) {
                const parts = filename.split(' - ');
                const artist = normalize(parts[0]);
                const title = normalize(parts[1]);
                
                // Index by specific song
                const songKey = `${artist}_${title}`; 
                if (!map[songKey]) map[songKey] = [];
                map[songKey].push(`file://${path}`);

                // Index by artist generally as well
                if (!map[artist]) map[artist] = [];
                map[artist].push(`file://${path}`);
            } 
            // Heuristic 2: Just "Artist"
            else {
                const artist = normalize(filename);
                if (!map[artist]) map[artist] = [];
                map[artist].push(`file://${path}`);
            }
        });

        return map;
    } catch (e) {
        console.error("Image scan failed", e);
        return {};
    }
};

export const downloadLrcFile = (artist: string, title: string, lyrics: LyricsLine[]) => {
    const content = createLrcContent(lyrics);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artist} - ${title}.lrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
