import { useEffect, useState, useCallback } from "react";
import {
  playCinematicClick,
  startCinematicMusic,
  stopCinematicMusic,
} from "@/lib/sfx";

// Served from the public/ folder so production Docker builds (Railway) include
// them — attached_assets/ is excluded by .dockerignore.
const BASE = import.meta.env.BASE_URL;
const SLIDES = [
  { src: `${BASE}images/cinematic-ch1/01-chapitre.png`, alt: "Chapitre 1 : Maître Crousty" },
  { src: `${BASE}images/cinematic-ch1/02-crousty.png`, alt: "Maître Crousty a envahi la planète Terre" },
  { src: `${BASE}images/cinematic-ch1/03-mission.png`, alt: "Vous devez traverser tout le royaume" },
  { src: `${BASE}images/cinematic-ch1/04-duel.png`,    alt: "Combattez en duel Maître Crousty" },
];

interface CinematicChapter1Props {
  onComplete: () => void;
}

export default function CinematicChapter1({ onComplete }: CinematicChapter1Props) {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  // Start music on first user interaction with the cinematic.
  // Browsers block autoplay until a gesture, so we attach the start to
  // the very first click anywhere on the cinematic surface.
  const [musicStarted, setMusicStarted] = useState(false);

  // Preload images so transitions feel instant
  useEffect(() => {
    SLIDES.forEach((s) => {
      const img = new Image();
      img.src = s.src;
    });
  }, []);

  // Stop music on unmount no matter how we leave the cinematic
  useEffect(() => {
    return () => {
      stopCinematicMusic();
    };
  }, []);

  const ensureMusic = useCallback(() => {
    if (musicStarted) return;
    startCinematicMusic();
    setMusicStarted(true);
  }, [musicStarted]);

  const handleNext = useCallback(() => {
    ensureMusic();
    playCinematicClick();
    if (index >= SLIDES.length - 1) {
      stopCinematicMusic();
      onComplete();
      return;
    }
    setIndex((i) => i + 1);
    setAnimKey((k) => k + 1);
  }, [index, ensureMusic, onComplete]);

  // Keyboard support: Enter / Space / ArrowRight advance
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext]);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black overflow-hidden"
      onClick={ensureMusic}
      role="dialog"
      aria-label="Cinématique Chapitre 1"
    >
      {/* Full-bleed slide image — fills the entire viewport.
          Ken-Burns style zoom + fade-in per slide. */}
      <img
        key={animKey}
        src={slide.src}
        alt={slide.alt}
        className="absolute inset-0 w-full h-full object-cover animate-cine-in"
        draggable={false}
      />

      {/* Soft vignette so the button reads cleanly against any artwork */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Slide progress dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={[
              "w-3 h-3 rounded-full border-2 border-white/80 transition-all",
              i === index
                ? "bg-yellow-400 scale-110 shadow-[0_0_8px_rgba(250,204,21,0.9)]"
                : i < index
                ? "bg-white/70"
                : "bg-white/10",
            ].join(" ")}
          />
        ))}
      </div>

      {/* "Suite" button — sits inside the image at the bottom-right,
          styled so it feels like part of the artwork (comic panel). */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
        className={[
          "absolute bottom-6 right-6 sm:bottom-10 sm:right-10 z-20",
          "px-8 py-4 select-none",
          "bg-gradient-to-b from-blue-500 to-blue-700",
          "text-white graffiti-text text-2xl sm:text-3xl tracking-widest",
          "border-4 border-yellow-300 rounded-md",
          "shadow-[0_6px_0_0_#1e3a8a,0_0_24px_rgba(59,130,246,0.7)]",
          "hover:from-blue-400 hover:to-blue-600 hover:scale-105",
          "active:translate-y-[3px] active:shadow-[0_3px_0_0_#1e3a8a,0_0_18px_rgba(59,130,246,0.6)]",
          "transition-transform duration-100",
          "animate-cine-pulse",
        ].join(" ")}
        aria-label={isLast ? "Commencer le niveau" : "Image suivante"}
      >
        {isLast ? "COMMENCER ▶" : "SUITE ▶"}
      </button>

      <style>{`
        @keyframes cine-in {
          0%   { opacity: 0; transform: scale(1.06); filter: blur(8px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: scale(1.0); filter: blur(0); }
        }
        @keyframes cine-pulse {
          0%, 100% { box-shadow: 0 6px 0 0 #1e3a8a, 0 0 24px rgba(59,130,246,0.7); }
          50%      { box-shadow: 0 6px 0 0 #1e3a8a, 0 0 38px rgba(250,204,21,0.85); }
        }
        .animate-cine-in    { animation: cine-in 1.6s ease-out both; }
        .animate-cine-pulse { animation: cine-pulse 1.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
