import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  className?: string; // Allow custom classes
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Buffer setup
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!isPlaying) {
          // Slow fade out if paused
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          animationRef.current = requestAnimationFrame(render);
          return;
      }

      analyser.getByteFrequencyData(dataArray);

      // Clear with fade effect for trails
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Visualizer settings
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) * 0.4; // Base radius
      const barWidth = (Math.PI * 2) / (bufferLength / 2); // Use half buffer for cleaner look (bass to treble)
      
      // Draw Circular Bars
      for (let i = 0; i < bufferLength / 1.5; i++) {
        const value = dataArray[i];
        const barHeight = (value / 255) * (Math.min(centerX, centerY) * 0.8);
        
        // Mirror effect (Left/Right)
        const angle1 = i * barWidth - Math.PI / 2;
        const angle2 = -i * barWidth - Math.PI / 2;

        const hue = (i / bufferLength) * 360 + 260; // Purple range
        ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;

        // Draw First Side
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle1);
        ctx.fillRect(0, radius, barWidth * radius * 0.8, barHeight);
        ctx.restore();

        // Draw Mirrored Side
        if (i > 0) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle2);
            ctx.fillRect(0, radius, barWidth * radius * 0.8, barHeight);
            ctx.restore();
        }
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isPlaying]);

  // Handle Resize
  useEffect(() => {
      const handleResize = () => {
          if (canvasRef.current && canvasRef.current.parentElement) {
              canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
              canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
          }
      };
      window.addEventListener('resize', handleResize);
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas 
        ref={canvasRef} 
        className={`w-full h-full block ${className || ''}`}
    />
  );
};