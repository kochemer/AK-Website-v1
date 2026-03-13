'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const SECTIONS = [
  { id: 'ecommerce-retail-tech', label: 'Ecommerce', color: '#4A6741' },
  { id: 'jewellery-industry',    label: 'Jewellery',  color: '#8B6914' },
  { id: 'ai-strategy',           label: 'AI',         color: '#3D5A80' },
  { id: 'luxury-consumer',       label: 'Luxury',     color: '#722F37' },
] as const;

type SectionColor = (typeof SECTIONS)[number]['color'];

export default function ScrollProgressBar() {
  const [progress, setProgress]         = useState(0);
  const [color, setColor]               = useState<SectionColor>(SECTIONS[0].color);
  const [label, setLabel]               = useState('');
  const [visible, setVisible]           = useState(false);
  const [complete, setComplete]         = useState(false);
  const rafRef                          = useRef(0);

  // Global page scroll progress (0–100)
  const updateProgress = useCallback(() => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    if (total <= 0) return;
    const pct = Math.min(100, Math.max(0, (window.scrollY / total) * 100));
    setProgress(pct);
    setVisible(pct > 2);
    if (pct >= 99.5) setComplete(true);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateProgress);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    updateProgress();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateProgress]);

  // IntersectionObserver — update label + color as sections enter viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observers: IntersectionObserver[] = [];
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry?.isIntersecting) { setColor(section.color); setLabel(section.label); } },
        { threshold: 0.15 },
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    /* Fixed vertical bar — right edge of viewport, full viewport height */
    <div
      className="fixed right-0 top-0 bottom-0 z-50 w-[4px] pointer-events-none"
      aria-hidden="true"
      style={{ backgroundColor: `${color}18` }}
    >
      {/* Fill — grows downward */}
      <div
        className={complete ? 'progress-complete' : ''}
        style={{
          width: '100%',
          height: `${progress}%`,
          backgroundColor: color,
          transition: 'height 80ms linear, background-color 400ms ease',
        }}
      />

      {/* Section label — rotated, appears left of bar when scrolling */}
      <span
        className="absolute right-[10px] font-mono text-[9px] tracking-[0.2em] uppercase select-none whitespace-nowrap"
        style={{
          top: `${Math.min(progress, 92)}%`,
          color,
          opacity: visible && label ? 1 : 0,
          transition: 'opacity 300ms ease, color 400ms ease, top 80ms linear',
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg) translateY(-4px)',
        }}
      >
        {label}
      </span>
    </div>
  );
}
