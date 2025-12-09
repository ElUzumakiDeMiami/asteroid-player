import React, { useState, useEffect } from 'react';
import { usePlayerStore, EQ_PRESETS } from '../store/playerStore';
import { X, Sliders, Check, RotateCcw } from 'lucide-react';
import { setFilterGain } from '../services/audioBase';

export const EqualizerModal: React.FC = () => {
  const { eqBands, setEqBands, setActiveModal } = usePlayerStore();
  const [localBands, setLocalBands] = useState<number[]>([...eqBands]);

  const frequencies = ['32', '63', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

  // Handle Close / Cancel
  const handleClose = () => {
      // Revert audio engine to the saved store state
      eqBands.forEach((val, idx) => setFilterGain(idx, val));
      setActiveModal('none');
  };

  // Handle Confirm
  const handleConfirm = () => {
      setEqBands(localBands);
      setActiveModal('none');
  };

  // Handle Reset (to Flat) - Affects local state and audio, but not store yet
  const handleReset = () => {
      const flat = EQ_PRESETS['Flat'];
      setLocalBands([...flat]);
      flat.forEach((val, idx) => setFilterGain(idx, val));
  };

  // Handle Preset Click - Affects local state and audio
  const applyPreset = (presetName: string) => {
      const preset = EQ_PRESETS[presetName] || EQ_PRESETS['Flat'];
      setLocalBands([...preset]);
      preset.forEach((val, idx) => setFilterGain(idx, val));
  };

  // Handle Slider Change
  const updateBand = (index: number, value: number) => {
      const newBands = [...localBands];
      newBands[index] = value;
      setLocalBands(newBands);
      setFilterGain(index, value); // Live preview
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
        <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/20 rounded-lg text-accent">
                        <Sliders size={24} />
                    </div>
                    <h3 className="font-bold text-xl text-white">Equalizer</h3>
                </div>
                <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition" title="Close without saving">
                    <X size={24} />
                </button>
            </div>

            {/* Presets */}
            <div className="p-6 overflow-x-auto no-scrollbar flex gap-2 border-b border-white/5 flex-shrink-0">
                {Object.keys(EQ_PRESETS).map(preset => (
                    <button
                        key={preset}
                        onClick={() => applyPreset(preset)}
                        className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-medium whitespace-nowrap transition active:scale-95 hover:border-accent hover:text-accent"
                    >
                        {preset}
                    </button>
                ))}
            </div>

            {/* Sliders Container */}
            <div className="p-6 md:p-10 flex-1 overflow-y-auto flex items-center justify-center min-h-[250px]">
                <div className="flex justify-between w-full h-full gap-2 md:gap-4">
                    {localBands.map((gain, index) => (
                        <div key={index} className="flex flex-col items-center h-full group flex-1">
                            {/* Gain Value Label (appears on hover or drag) */}
                            <span className="text-xs font-mono text-accent mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {gain > 0 ? `+${gain}` : gain}dB
                            </span>

                            {/* Slider Track */}
                            <div className="relative flex-1 w-full flex justify-center bg-white/5 rounded-full py-2">
                                {/* Vertical Range Input */}
                                <input
                                    type="range"
                                    min="-12"
                                    max="12"
                                    step="1"
                                    value={gain}
                                    onChange={(e) => updateBand(index, Number(e.target.value))}
                                    className="h-full w-full appearance-none bg-transparent cursor-pointer vertical-slider"
                                    style={{
                                        writingMode: 'vertical-lr',
                                        WebkitAppearance: 'slider-vertical',
                                    }}
                                />
                                {/* Center Line Visual */}
                                <div className="absolute top-1/2 left-0 w-full h-px bg-white/10 pointer-events-none -z-10"></div>
                            </div>
                            
                            {/* Frequency Label */}
                            <span className="text-[10px] md:text-xs font-medium text-white/40 mt-3 group-hover:text-white transition-colors">
                                {frequencies[index]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Action Footer */}
            <div className="p-6 border-t border-white/5 flex items-center justify-between gap-4 bg-black/20 mt-auto">
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition hover:text-red-400"
                >
                    <RotateCcw size={18} />
                    Reset
                </button>

                <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-accent hover:brightness-110 text-white font-bold transition shadow-lg shadow-purple-500/20"
                >
                    <Check size={18} />
                    Confirm
                </button>
            </div>
        </div>
    </div>
  );
};