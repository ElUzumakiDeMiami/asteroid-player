// Audio Graph Nodes
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
const eqFilters: BiquadFilterNode[] = [];

// Standard 10-Band EQ Frequencies (ISO Standard)
const EQ_FREQUENCIES = [32, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

class AudioEngine {
    // Single player architecture
    player: HTMLAudioElement;
    
    constructor() {
        this.player = new Audio();
        this.player.crossOrigin = "anonymous";
        this.player.preload = "auto";
    }

    // Initialize the Web Audio API graph
    init() {
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                audioContext = new AudioContextClass();
            } else {
                console.error("Web Audio API is not supported in this browser.");
                return;
            }
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        if (!analyser) {
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
        }

        // Initialize Source Node (wraps the HTMLAudioElement)
        if (!sourceNode) {
            sourceNode = audioContext.createMediaElementSource(this.player);
        }

        // Initialize EQ Filters if empty
        if (eqFilters.length === 0) {
            EQ_FREQUENCIES.forEach(freq => {
                if (!audioContext) return;
                const filter = audioContext.createBiquadFilter();
                filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1.4;
                filter.gain.value = 0;
                eqFilters.push(filter);
            });
        }

        // --- GRAPH CONNECTION ---
        // Player -> SourceNode -> Filter[0] -> ... -> Filter[9] -> Analyser -> Destination
        
        // 1. Disconnect everything to be safe
        try { sourceNode.disconnect(); } catch(e){}
        try { analyser.disconnect(); } catch(e){}
        eqFilters.forEach(f => { try { f.disconnect(); } catch(e) {} });

        // 2. Connect Chain
        let currentNode: AudioNode = sourceNode;
        
        // EQ Chain
        for (const filter of eqFilters) {
            currentNode.connect(filter);
            currentNode = filter;
        }

        // Analyser
        currentNode.connect(analyser);
        
        // Output
        analyser.connect(audioContext.destination);

        return { ctx: audioContext, analyser };
    }

    play() {
        return this.player.play();
    }

    pause() {
        this.player.pause();
    }

    seek(time: number) {
        if (Number.isFinite(time)) {
            // Ensure we don't seek past duration
            const safeTime = Math.min(time, this.player.duration || time);
            this.player.currentTime = safeTime;
        }
    }

    setVolume(val: number) {
        const logVol = Math.max(0, Math.min(1, Math.pow(val, 3)));
        this.player.volume = logVol;
    }
}

// Singleton Export
export const audioEngine = new AudioEngine();
export const audio = audioEngine.player; // Legacy export for direct access if needed

export const initAudioContext = () => audioEngine.init();

export const setFilterGain = (index: number, value: number) => {
    if (eqFilters.length === 0) audioEngine.init();
    if (eqFilters[index]) {
        eqFilters[index].gain.value = value;
    }
};

export const getAudioContext = () => audioContext;