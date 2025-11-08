import { useEffect, useRef } from "react";

interface VoiceVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
}

const VoiceVisualizer = ({ isActive, isSpeaking }: VoiceVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
        // Draw flat line when inactive
        ctx.strokeStyle = "hsl(var(--muted))";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
      } else {
        // Draw animated waveform
        ctx.strokeStyle = isSpeaking ? "hsl(var(--accent))" : "hsl(var(--primary))";
        ctx.lineWidth = 3;
        ctx.beginPath();

        const amplitude = isSpeaking ? 30 : 15;
        const frequency = isSpeaking ? 0.02 : 0.01;

        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin((x * frequency) + phase) * amplitude;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
        phase += 0.1;
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive, isSpeaking]);

  return (
    <div className="w-full h-32 bg-muted/20 rounded-lg border border-border overflow-hidden">
      <canvas
        ref={canvasRef}
        width={800}
        height={128}
        className="w-full h-full"
      />
    </div>
  );
};

export default VoiceVisualizer;
