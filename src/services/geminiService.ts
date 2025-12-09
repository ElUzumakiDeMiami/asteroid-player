import { GoogleGenAI } from "@google/genai";
import { LyricsLine, LyricSearchResult, ArtistMetadata } from "../types";

// Initialize GenAI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to clean potential markdown from JSON response
const cleanJson = (text: string) => {
  if (!text) return "[]";
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  const startArr = clean.indexOf('[');
  const endArr = clean.lastIndexOf(']');

  // Determine if object or array
  if (start !== -1 && end !== -1 && (startArr === -1 || start < startArr)) {
     clean = clean.substring(start, end + 1);
  } else if (startArr !== -1 && endArr !== -1) {
     clean = clean.substring(startArr, endArr + 1);
  }
  
  return clean;
};

// Helper to parse standard LRC format
const parseLrcContent = (lrcString: string): LyricsLine[] => {
  const lines = lrcString.split('\n');
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

/**
 * PART 1: LRCLIB API INTEGRATION (Non-AI, Database Search)
 */
const searchLrcLib = async (title: string, artist: string, duration?: number): Promise<LyricSearchResult[]> => {
  try {
    // Build query
    const query = `${title} ${artist}`;
    const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    
    // Filter and map results
    return data
      .filter((track: any) => track.syncedLyrics) // Only want synced lyrics
      .map((track: any) => {
         // Simple duration check (if provided) to prioritize correct matches (+/- 5 seconds)
         const durationMatch = duration ? Math.abs(track.duration - duration) < 5 : true;
         
         return {
            id: `lrclib-${track.id}`, // Prefix to identify source
            sourceName: `LRCLIB (Database)${durationMatch ? ' ⭐' : ''}`,
            isSynced: true,
            // Expanded preview length for better identification
            preview: track.plainLyrics ? track.plainLyrics.substring(0, 300).replace(/\n/g, ' / ') : "Synced lyrics available"
         };
      });
  } catch (e) {
    console.error("LRCLIB Error:", e);
    return [];
  }
};

const getLrcLibLyrics = async (id: string): Promise<LyricsLine[]> => {
  try {
    const realId = id.replace('lrclib-', '');
    const response = await fetch(`https://lrclib.net/api/get/${realId}`);
    if (!response.ok) return [];
    const data = await response.json();
    
    if (data.syncedLyrics) {
      return parseLrcContent(data.syncedLyrics);
    }
    return [];
  } catch (e) {
    console.error("LRCLIB Fetch Error:", e);
    return [];
  }
};

/**
 * PART 2: GEMINI AI WEB SEARCH (Fallback & Manual Search)
 */
const searchAiWeb = async (title: string, artist: string): Promise<LyricSearchResult[]> => {
  try {
    const prompt = `
      You are a music metadata assistant. 
      Use Google Search to find REAL lyric pages for: "${title}" by "${artist}".
      
      Target Domains:
      - musixmatch.com
      - genius.com
      - lyricfind.com

      Action:
      1. Search for the song lyrics on these sites.
      2. Identify versions (e.g. "Original", "Remix").
      3. Return a JSON list.

      Format: JSON array of objects:
      - id: Unique string (URL or generated ID).
      - sourceName: Website Name (e.g. "Musixmatch").
      - isSynced: Boolean (true if snippet mentions "LRC" or "Synced").
      - preview: The first 4-5 lines of the lyrics.
      
      IMPORTANT: Return ONLY raw JSON. No markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0, 
      }
    });

    if (response.text) {
      try {
        const cleaned = cleanJson(response.text);
        return JSON.parse(cleaned) as LyricSearchResult[];
      } catch (e) {
        return [];
      }
    }
    return [];
  } catch (error) {
    console.error("AI Search Error:", error);
    return [];
  }
};

const getAiLyrics = async (optionId: string, title: string, artist: string): Promise<LyricsLine[]> => {
  try {
    const prompt = `
      Task: Extract lyrics for "${title}" by "${artist}" from Source ID: "${optionId}".
      Instructions:
      1. Use Google Search to find the content.
      2. If LRC timestamps [mm:ss] exist, keep them.
      3. If text only, return plain text and I will sync manually later, OR estimate timestamps if structure is clear.
      
      Output: JSON Array [{ "time": number (seconds), "text": string }]
      Return ONLY raw JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], 
        temperature: 0,
      }
    });

    if (response.text) {
       try {
         const cleaned = cleanJson(response.text);
         const data = JSON.parse(cleaned);
         if (Array.isArray(data)) return data;
       } catch (e) {
         console.error("AI Parse error:", e);
       }
    }
    return [];
  } catch (error) {
    return [];
  }
};

/**
 * PART 3: AI PLAYLIST GENERATOR (Secure JSON only)
 */
export const generatePlaylistByPrompt = async (userPrompt: string): Promise<{ title: string, artist: string }[]> => {
    try {
        const prompt = `
            You are a music expert API.
            User Request: "${userPrompt}"
            
            Task:
            1. Create a list of 25-30 essential songs that match this request perfectly.
            2. If the request references a specific chart or decade (e.g., "Billboard 90s"), use your knowledge to pick real hits.
            3. Return strictly valid JSON.
            
            Output Format:
            [
                { "title": "Song Title", "artist": "Artist Name" },
                ...
            ]
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.7, // Slightly creative but grounded
            }
        });

        if (response.text) {
            try {
                const cleaned = cleanJson(response.text);
                const data = JSON.parse(cleaned);
                if (Array.isArray(data)) {
                    return data.map((item: any) => ({
                        title: String(item.title || ''),
                        artist: String(item.artist || '')
                    }));
                }
            } catch (e) {
                console.error("Failed to parse AI playlist", e);
            }
        }
        return [];
    } catch (e) {
        console.error("AI Playlist Error", e);
        return [];
    }
};

export interface CuratedPlaylist {
    title: string;
    description: string;
    tracks: { title: string; artist: string }[];
}

/**
 * AUTO-CURATOR: Mimics Apple Music / Spotify Editorial Lists
 */
export const generateCuratedPlaylists = async (): Promise<CuratedPlaylist[]> => {
    try {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        
        const prompt = `
            Act as an Editorial Curator for Apple Music or YouTube Music.
            Current Date: ${today}.
            
            Task:
            Generate 6 DISTINCT, high-quality playlist concepts relevant to *today's vibe* or current trending genres.
            
            Guidelines:
            - Include 1 "Mood" playlist relevant to the day of the week (e.g., "Monday Focus", "Friday Party").
            - Include 1 "Timeless" playlist (e.g., "80s Rock Anthems").
            - Include 4 Genre/Vibe playlists (e.g., "Lo-Fi Beats", "Workout Energy", "Indie Chill").
            
            For EACH playlist:
            1. Provide a catchy, official-sounding Title.
            2. A short description.
            3. A list of 15-20 DEFINING tracks (Title - Artist) for that genre/mood.
            
            Output Format: JSON Array
            [
              {
                "title": "Playlist Title",
                "description": "Short description...",
                "tracks": [ { "title": "Song", "artist": "Artist" }, ... ]
              }
            ]
            
            Return strictly valid JSON.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.8, // High creativity for variety
            }
        });

        if (response.text) {
            try {
                const cleaned = cleanJson(response.text);
                const data = JSON.parse(cleaned);
                if (Array.isArray(data)) {
                    return data as CuratedPlaylist[];
                }
            } catch (e) {
                console.error("Failed to parse Curated playlists", e);
            }
        }
        return [];
    } catch (e) {
        return [];
    }
};

/**
 * MAIN EXPORT: COMBINED SEARCH
 */
export const searchLyricOptions = async (title: string, artist: string, album: string, duration?: number): Promise<LyricSearchResult[]> => {
  // Run both searches in parallel
  const [lrcLibResults, aiResults] = await Promise.all([
    searchLrcLib(title, artist, duration),
    searchAiWeb(title, artist)
  ]);

  // Combine results, prioritizing LRCLIB (Database) first as it's usually cleaner
  return [...lrcLibResults, ...aiResults];
};

/**
 * MAIN EXPORT: GET CONTENT
 */
export const getLyricsByOption = async (optionId: string, title: string, artist: string): Promise<LyricsLine[]> => {
  // Route to the correct handler based on ID prefix
  if (optionId.startsWith('lrclib-')) {
    return await getLrcLibLyrics(optionId);
  } else {
    return await getAiLyrics(optionId, title, artist);
  }
};