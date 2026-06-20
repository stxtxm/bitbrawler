import { useEffect, useRef } from 'react';

interface DecorElement {
  type: 'rock' | 'bush' | 'glow';
  x: number;
  y: number;
  scale: number;
}

interface ProceduralDecorProps {
  elements: DecorElement[];
}

export const ProceduralDecor: React.FC<ProceduralDecorProps> = ({ elements }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    elements.forEach(el => {
      ctx.fillStyle = el.type === 'rock' ? '#795548' : '#4CAF50';
      ctx.beginPath();
      ctx.arc(el.x, el.y, el.scale * 10, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [elements]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', position: 'absolute' }} />;
};
