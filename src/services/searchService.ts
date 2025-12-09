import { Song } from '../types';

export interface SearchResults {
    songs: Song[];
    artists: { name: string; image?: string }[];
    albums: { title: string; artist: string; cover?: string }[];
}

// 1. Define the worker code as a string (to avoid separate file build issues)
const workerCode = `
importScripts("https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js");

self.onmessage = function(e) {
    const { songs, query } = e.data;
    if (!query || !query.trim()) {
        self.postMessage({ songs: [], artists: [], albums: [] });
        return;
    }

    // 1. Search Songs
    const songFuse = new Fuse(songs, {
        keys: ['title', 'artist', 'album'],
        threshold: 0.3,
        distance: 100,
        minMatchCharLength: 2
    });
    const songResults = songFuse.search(query).map(r => r.item);

    // 2. Search Artists (Manual Dedupe)
    const artistMap = new Map();
    songs.forEach(s => {
        if(s.artist && s.artist !== "Unknown Artist") {
            if(!artistMap.has(s.artist)) artistMap.set(s.artist, s.coverUrl);
        }
    });
    
    const uniqueArtists = Array.from(artistMap.keys()).map(name => ({ name }));
    const artistFuse = new Fuse(uniqueArtists, { keys: ['name'], threshold: 0.3 });
    const artistResults = artistFuse.search(query).map(r => ({
        name: r.item.name,
        image: artistMap.get(r.item.name)
    }));

    // 3. Search Albums (Manual Dedupe)
    const albumMap = new Map();
    songs.forEach(s => {
        if(s.album && s.album !== "Unknown Album") {
            if(!albumMap.has(s.album)) {
                albumMap.set(s.album, { artist: s.artist || "Unknown", cover: s.coverUrl });
            }
        }
    });

    const uniqueAlbums = Array.from(albumMap.keys()).map(title => ({ title }));
    const albumFuse = new Fuse(uniqueAlbums, { keys: ['title'], threshold: 0.3 });
    const albumResults = albumFuse.search(query).map(r => ({
        title: r.item.title,
        ...albumMap.get(r.item.title)
    }));

    self.postMessage({
        songs: songResults,
        artists: artistResults,
        albums: albumResults
    });
};
`;

// 2. Initialize Worker
let searchWorker: Worker | null = null;

if (typeof window !== 'undefined') {
    const blob = new Blob([workerCode], { type: "application/javascript" });
    searchWorker = new Worker(URL.createObjectURL(blob));
}

// 3. Async search function
export const fuzzySearch = async (songs: Song[], query: string): Promise<SearchResults> => {
    if (!searchWorker) return { songs: [], artists: [], albums: [] };

    return new Promise((resolve) => {
        const handler = (e: MessageEvent) => {
            resolve(e.data);
            searchWorker?.removeEventListener('message', handler);
        };
        searchWorker?.addEventListener('message', handler);
        searchWorker?.postMessage({ songs, query });
    });
};