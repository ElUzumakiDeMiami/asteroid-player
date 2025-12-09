
import { ArtistMetadata } from "../types";
import { loadArtistMetadata, saveArtistMetadata } from "./fileSystemService";

// Using a reliable public CORS proxy for Web Mode to access Deezer
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

// APIs
const DEEZER_SEARCH_URL = "https://api.deezer.com/search/artist?q=";
const AUDIODB_SEARCH_URL = "https://www.theaudiodb.com/api/v1/json/2/search.php?s="; // '2' is the public test key
const AUDIODB_ALBUM_SEARCH_URL = "https://www.theaudiodb.com/api/v1/json/2/searchalbum.php?"; // s=Artist&a=Album
const WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const WIKIPEDIA_SEARCH_URL = "https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&limit=10&namespace=0&format=json&search=";

/**
 * ASYNC TASK QUEUE WITH BACKOFF
 * Prevents API Rate Limiting bans by managing concurrency and retrying smartly.
 */
class SmartQueue {
    private queue: string[] = [];
    private activeCount = 0;
    private maxConcurrency = 2; // Low concurrency to be safe
    private isPaused = false;
    private retryDelay = 1000; // Start with 1s
    
    // Add item to queue
    enqueue(items: string[]) {
        // Deduplicate against queue and active
        const newItems = items.filter(i => !this.queue.includes(i));
        this.queue.push(...newItems);
        this.process();
    }

    private async process() {
        if (this.isPaused || this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }

        const artist = this.queue.shift();
        if (!artist) return;

        this.activeCount++;

        try {
            await this.handleTask(artist);
            
            // Success: Reset backoff
            this.retryDelay = 1000; 
            
        } catch (error: any) {
            console.warn(`Sync failed for ${artist}:`, error);
            
            // Handle Rate Limit (429) specifically
            if (error?.status === 429 || error?.message?.includes("429")) {
                console.warn(`Rate Limit Hit! Backing off for ${this.retryDelay}ms...`);
                this.isPaused = true;
                
                // Re-queue item
                this.queue.unshift(artist);
                
                // Wait and resume
                setTimeout(() => {
                    this.isPaused = false;
                    this.activeCount--;
                    this.process();
                }, this.retryDelay);

                // Increase backoff for next time (Exponential: 1s, 2s, 4s...)
                this.retryDelay = Math.min(this.retryDelay * 2, 60000); 
                return; // Early return to handle "activeCount" logic inside timeout
            } 
            // If it's another error (404, etc), just ignore and move on
        }

        this.activeCount--;
        
        // Small friendly delay between requests even on success
        setTimeout(() => this.process(), 500);
        // Try to spawn another worker if queue is full
        this.process();
    }

    private async handleTask(artist: string) {
        // 1. Check Cache First
        const exists = await loadArtistMetadata(artist);
        // If exists and has image, skip
        if (exists && exists.imageUrl) return;

        // 2. Fetch Online
        const newData = await getArtistDetails(artist);
        
        if (newData) {
            await saveArtistMetadata(newData);
            // 3. Notify UI
            const event = new CustomEvent('artist-metadata-updated', { detail: newData });
            window.dispatchEvent(event);
        }
    }
}

// Global Singleton Instance
const syncQueue = new SmartQueue();


/**
 * Fetch specifically from TheAudioDB
 */
export const getAlbumFromAudioDB = async (artist: string, album: string): Promise<string | null> => {
    try {
        const url = `${AUDIODB_ALBUM_SEARCH_URL}s=${encodeURIComponent(artist)}&a=${encodeURIComponent(album)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.album && data.album.length > 0 && data.album[0].strDescriptionEN) {
                return data.album[0].strDescriptionEN;
            }
        }
        return null;
    } catch (e) {
        console.error("AudioDB Error", e);
        return null;
    }
};

/**
 * Fetch specifically from Wikipedia
 */
export const getAlbumFromWikipedia = async (artist: string, album: string): Promise<string | null> => {
    try {
        const q1 = `${album} (${artist} album)`;
        const res1 = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(q1)}`);
        if (res1.ok) {
            const data = await res1.json();
            if (data.type === 'standard' && !data.title.includes("Not found")) {
                return data.extract;
            }
        }

        const q2 = `${album} (album)`;
        const res2 = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(q2)}`);
        if (res2.ok) {
            const data = await res2.json();
            if (data.type === 'standard' && !data.title.includes("Not found")) {
                return data.extract;
            }
        }

        const res3 = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(album)}`);
        if (res3.ok) {
            const data = await res3.json();
            if (data.type === 'standard' && !data.title.includes("Not found")) {
                const text = data.extract.toLowerCase();
                if (text.includes("album") || text.includes("studio") || text.includes(artist.toLowerCase())) {
                    return data.extract;
                }
            }
        }

        return null;
    } catch (e) {
        console.error("Wikipedia Error", e);
        return null;
    }
};

export const getAlbumDetails = async (artist: string, album: string): Promise<string | null> => {
    const wikiResult = await getAlbumFromWikipedia(artist, album);
    if (wikiResult) return wikiResult;
    return await getAlbumFromAudioDB(artist, album);
}

export const getArtistDetails = async (artistName: string): Promise<ArtistMetadata | null> => {
  const cleanName = artistName.trim();
  let imageUrl = "";
  let bio = "";
  let source = "";
  let images: string[] = [];

  try {
    const deezerPromise = fetchDeezerImage(cleanName);
    const audioDbPromise = fetchAudioDbData(cleanName);
    const wikiPromise = fetchWikipediaData(cleanName);

    const [deezerImg, audioDbData, wikiData] = await Promise.allSettled([
        deezerPromise,
        audioDbPromise,
        wikiPromise
    ]);

    if (deezerImg.status === 'fulfilled' && deezerImg.value) {
        imageUrl = deezerImg.value;
    } else if (audioDbData.status === 'fulfilled' && audioDbData.value?.image) {
        imageUrl = audioDbData.value.image;
    } else if (wikiData.status === 'fulfilled' && wikiData.value?.image) {
        imageUrl = wikiData.value.image;
    }

    if (audioDbData.status === 'fulfilled' && audioDbData.value) {
        if (audioDbData.value.bio) {
            bio = audioDbData.value.bio;
            source = "TheAudioDB";
        }
        if (audioDbData.value.fanart && audioDbData.value.fanart.length > 0) {
            images = audioDbData.value.fanart;
        }
    } else if (wikiData.status === 'fulfilled' && wikiData.value?.bio) {
        bio = wikiData.value.bio;
        source = "Wikipedia";
    }

    if (!imageUrl && !bio) return null;

    return {
        name: cleanName,
        imageUrl: imageUrl || "", 
        images: images, 
        bio: bio || "Biography not available.",
        source: source || "Web",
        lastUpdated: Date.now()
    };

  } catch (e) {
    console.error("Error fetching artist details:", e);
    return null;
  }
};

export interface WikiSearchResult {
    title: string;
    url: string;
}

export const searchWikipedia = async (query: string): Promise<WikiSearchResult[]> => {
    try {
        const res = await fetch(`${WIKIPEDIA_SEARCH_URL}${encodeURIComponent(query)}`);
        if (res.ok) {
            const data = await res.json();
            const titles = data[1] as string[];
            const urls = data[3] as string[];
            
            return titles.map((t, i) => ({
                title: t,
                url: urls[i]
            }));
        }
        return [];
    } catch (e) {
        return [];
    }
};

export const getWikiPageContent = async (title: string): Promise<string | null> => {
     try {
        const res = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(title)}`);
        if (res.ok) {
            const data = await res.json();
            return data.extract || null;
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const getSongWikiDescription = async (title: string, artist: string): Promise<string | null> => {
    try {
        const q2 = `${title} (${artist} song)`;
        const res2 = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(q2)}`);
        
        if (res2.ok) {
            const data = await res2.json();
            if (data.type === 'standard' && !data.title.includes("Not found")) {
                return data.extract;
            }
        }
        
        const q1 = `${title} (song)`;
        const res1 = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(q1)}`);
        
        if (res1.ok) {
            const data = await res1.json();
            if (data.type === 'standard' && !data.title.includes("Not found")) {
                return data.extract;
            }
        }

        return null;
    } catch (e) {
        console.error(e);
        return null;
    }
};

// --- BACKGROUND SYNC LOGIC (REPLACED WITH SMART QUEUE) ---

/**
 * Synchronizes a list of artists using the SmartQueue.
 */
export const syncArtistLibrary = async (uniqueArtists: string[]) => {
    // Filter out "Unknown Artist"
    const candidates = uniqueArtists.filter(a => a && a !== "Unknown Artist");
    syncQueue.enqueue(candidates);
};


// --- API HELPERS ---

const fetchDeezerImage = async (artist: string): Promise<string | null> => {
    try {
        const url = `${CORS_PROXY}${encodeURIComponent(DEEZER_SEARCH_URL + encodeURIComponent(artist))}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        
        if (data.data && data.data.length > 0) {
            return data.data[0].picture_xl || data.data[0].picture_big || data.data[0].picture_medium;
        }
        return null;
    } catch (e) {
        return null;
    }
};

const fetchAudioDbData = async (artist: string): Promise<{image?: string, bio?: string, fanart?: string[]} | null> => {
    try {
        const res = await fetch(`${AUDIODB_SEARCH_URL}${encodeURIComponent(artist)}`);
        if (!res.ok) return null;
        const data = await res.json();

        if (data.artists && data.artists[0]) {
            const artistObj = data.artists[0];
            
            const fanart: string[] = [];
            if (artistObj.strArtistFanart) fanart.push(artistObj.strArtistFanart);
            if (artistObj.strArtistFanart2) fanart.push(artistObj.strArtistFanart2);
            if (artistObj.strArtistFanart3) fanart.push(artistObj.strArtistFanart3);
            if (artistObj.strArtistFanart4) fanart.push(artistObj.strArtistFanart4);

            return {
                image: artistObj.strArtistThumb || artistObj.strArtistFanart,
                bio: artistObj.strBiographyEN,
                fanart
            };
        }
        return null;
    } catch (e) {
        return null;
    }
};

const fetchWikipediaData = async (artist: string): Promise<{image?: string, bio?: string} | null> => {
    try {
        const res = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(artist)}`);
        if (!res.ok) return null;
        const data = await res.json();

        if (data.type === 'standard') {
            return {
                image: data.thumbnail?.source,
                bio: data.extract
            };
        }
        return null;
    } catch (e) {
        return null;
    }
};