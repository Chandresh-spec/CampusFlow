'use client';
import React from 'react';

interface AiSymbolProps {
  size?: number;
  className?: string;
  useImage?: boolean;
}

export default function AiSymbol({ size = 20, className = 'text-blue-600', useImage = false }: AiSymbolProps) {
  if (useImage) {
    return (
      <img
        src="/ai-symbol.png"
        alt="NexusAI"
        width={size}
        height={size}
        className={`inline-block object-contain shrink-0 ${className}`}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* Central Nucleus Dot */}
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />

      {/* Orbit 1: Horizontal */}
      <ellipse
        cx="12"
        cy="12"
        rx="9.5"
        ry="3.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Orbit 2: Rotated 60 degrees */}
      <ellipse
        cx="12"
        cy="12"
        rx="9.5"
        ry="3.8"
        transform="rotate(60 12 12)"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Orbit 3: Rotated 120 degrees */}
      <ellipse
        cx="12"
        cy="12"
        rx="9.5"
        ry="3.8"
        transform="rotate(120 12 12)"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
