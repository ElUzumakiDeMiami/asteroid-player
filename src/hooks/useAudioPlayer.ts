import { usePlayerStore } from '../store/playerStore';
import { audio } from '../services/audioBase';

export const useAudioPlayer = () => {
  const { setCurrentTime } = usePlayerStore();

  const seek = (time: number) => {
      if (Number.isFinite(time) && !isNaN(time)) {
          audio.currentTime = time;
          setCurrentTime(time);
      }
  };

  return { seek };
};
