'use client';

import { useEffect, useRef } from 'react';

export function AtmosphereCanvas({
  className,
}: Readonly<{ className?: string }>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const stars = Array.from({ length: 42 }, (_, index) => ({
      x: (index * 71) % 1000,
      y: (index * 43) % 1600,
      radius: 0.8 + (index % 3) * 0.6,
    }));

    let frameId = 0;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(
        width * 0.5,
        height * 0.24,
        20,
        width * 0.5,
        height * 0.24,
        width * 0.65,
      );
      glow.addColorStop(0, 'rgba(255, 186, 110, 0.22)');
      glow.addColorStop(0.34, 'rgba(123, 188, 255, 0.12)');
      glow.addColorStop(1, 'rgba(5, 12, 20, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(width * 0.5, height * 0.28);
      context.strokeStyle = 'rgba(122, 186, 255, 0.08)';
      context.lineWidth = 1;
      for (let ring = 0; ring < 6; ring += 1) {
        context.beginPath();
        context.ellipse(
          0,
          0,
          110 + ring * 32,
          40 + ring * 16,
          0,
          0,
          Math.PI * 2,
        );
        context.stroke();
      }

      context.strokeStyle = 'rgba(255, 174, 92, 0.18)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(0, 0, 168, time / 5500, time / 5500 + Math.PI * 1.35);
      context.stroke();
      context.restore();

      context.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      context.lineWidth = 1;
      for (let y = 0; y < height; y += 4) {
        context.beginPath();
        context.moveTo(0, y + ((time / 35) % 4));
        context.lineTo(width, y + ((time / 35) % 4));
        context.stroke();
      }

      stars.forEach((star, index) => {
        const drift = (time / 90 + index * 11) % height;
        context.fillStyle =
          index % 4 === 0
            ? 'rgba(255, 181, 102, 0.9)'
            : 'rgba(181, 220, 255, 0.78)';
        context.beginPath();
        context.arc(
          (star.x % width) + 12,
          (star.y + drift) % height,
          star.radius,
          0,
          Math.PI * 2,
        );
        context.fill();
      });

      frameId = window.requestAnimationFrame(draw);
    };

    resize();
    frameId = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
