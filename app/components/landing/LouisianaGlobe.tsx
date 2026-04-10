'use client'

import { useState } from 'react'

/* ── Louisiana simplified SVG path (recognizable boot shape) ── */
const LOUISIANA_PATH = `M 180 80 L 200 78 L 215 82 L 230 75 L 245 78 L 260 72 L 275 76 L 290 74 L 305 78 L 320 76 L 325 82 L 322 95 L 318 110 L 320 125 L 315 140 L 310 155 L 312 170 L 308 185 L 300 195 L 290 200 L 278 205 L 270 215 L 258 225 L 250 235 L 245 250 L 255 258 L 268 262 L 280 268 L 290 275 L 298 282 L 305 290 L 295 295 L 280 292 L 265 288 L 250 290 L 240 295 L 228 292 L 220 285 L 210 280 L 200 278 L 192 282 L 185 290 L 178 285 L 172 275 L 168 265 L 175 255 L 180 245 L 178 235 L 170 228 L 165 218 L 168 208 L 175 198 L 178 188 L 175 178 L 170 168 L 172 158 L 178 148 L 180 138 L 178 128 L 175 118 L 178 108 L 180 98 L 178 88 Z`

/* ── Parish boundary lines (simplified internal divisions) ── */
const PARISH_LINES = [
  'M 200 78 L 198 140', 'M 215 82 L 220 160', 'M 245 78 L 240 170',
  'M 260 72 L 265 155', 'M 275 76 L 270 180', 'M 290 74 L 285 195',
  'M 305 78 L 300 165', 'M 178 120 L 320 110', 'M 175 155 L 315 145',
  'M 172 185 L 308 180', 'M 230 160 L 250 235', 'M 195 150 L 195 220',
]

/* ── East Baton Rouge parish (highlighted region) ── */
const EBR_PATH = `M 230 140 L 250 138 L 260 142 L 262 155 L 258 168 L 245 172 L 232 170 L 225 160 L 228 148 Z`

/* ── City positions (relative to SVG viewBox 0 0 400 380) ── */
const CITIES = [
  { name: 'Baton Rouge', x: 245, y: 155, primary: true, stat: '$3.38M Q1 Volume' },
  { name: 'New Orleans', x: 295, y: 275, primary: false },
  { name: 'Lafayette', x: 205, y: 210, primary: false },
  { name: 'Shreveport', x: 195, y: 85, primary: false },
]

/* ── Connection lines between cities ── */
const CONNECTIONS = [
  [0, 1], [0, 2], [0, 3], [1, 2], [2, 3],
]

export function LouisianaGlobe() {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative w-full max-w-[500px] mx-auto select-none"
      style={{ perspective: '1200px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Ambient glow behind the globe */}
      <div
        className="absolute inset-0 rounded-full blur-[80px] opacity-30"
        style={{ background: 'radial-gradient(circle, var(--globe-sage) 0%, transparent 70%)' }}
      />

      {/* Globe container — rotating sphere */}
      <div
        className="relative w-full aspect-square rounded-full overflow-hidden"
        style={{
          background: `radial-gradient(circle at 35% 35%, rgba(154,171,126,0.12) 0%, rgba(30,36,22,0.06) 50%, rgba(30,36,22,0.15) 100%)`,
          boxShadow: `
            inset -30px -30px 60px rgba(30,36,22,0.15),
            inset 20px 20px 40px rgba(154,171,126,0.08),
            0 0 80px rgba(154,171,126,0.1)
          `,
          animation: hovered ? 'none' : 'globe-rotate 60s linear infinite',
          transform: hovered ? 'rotateY(0deg) scale(1.05)' : undefined,
          transition: hovered ? 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)' : undefined,
        }}
      >
        {/* Specular highlight — makes it look spherical */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            top: '8%', left: '12%', width: '35%', height: '35%',
            background: 'radial-gradient(ellipse, rgba(245,242,234,0.2) 0%, transparent 70%)',
          }}
        />

        {/* Grid lines — longitude/latitude feel */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" viewBox="0 0 400 400">
          {/* Latitude lines */}
          {[100, 150, 200, 250, 300].map(y => (
            <ellipse key={`lat-${y}`} cx="200" cy={y} rx={180 - Math.abs(y - 200) * 0.5} ry="8" fill="none" stroke="#9aab7e" strokeWidth="0.5" />
          ))}
          {/* Longitude arcs */}
          {[-30, -15, 0, 15, 30].map(offset => (
            <ellipse key={`lng-${offset}`} cx={200 + offset * 3} cy="200" rx="6" ry={180 - Math.abs(offset) * 2} fill="none" stroke="#9aab7e" strokeWidth="0.5" />
          ))}
        </svg>

        {/* Louisiana map SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 380" preserveAspectRatio="xMidYMid meet">
          {/* Connection lines between cities */}
          {CONNECTIONS.map(([a, b], i) => (
            <line
              key={`conn-${i}`}
              x1={CITIES[a].x} y1={CITIES[a].y}
              x2={CITIES[b].x} y2={CITIES[b].y}
              stroke="var(--globe-sage)"
              strokeWidth="0.8"
              opacity="0.15"
              strokeDasharray="4 3"
            />
          ))}

          {/* State outline */}
          <path
            d={LOUISIANA_PATH}
            fill="var(--globe-olive)"
            fillOpacity="0.35"
            stroke="var(--globe-olive)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Parish boundary lines */}
          {PARISH_LINES.map((d, i) => (
            <path
              key={`parish-${i}`}
              d={d}
              fill="none"
              stroke="var(--globe-sage)"
              strokeWidth="0.5"
              opacity="0.3"
            />
          ))}

          {/* East Baton Rouge highlight */}
          <path
            d={EBR_PATH}
            fill="var(--globe-sage)"
            fillOpacity="0.5"
            stroke="var(--globe-sage)"
            strokeWidth="1"
            className="animate-parish-pulse"
          />

          {/* City dots */}
          {CITIES.map((city, i) => (
            <g key={city.name}>
              {/* Glow ring */}
              <circle
                cx={city.x} cy={city.y}
                r={city.primary ? 12 : 8}
                fill="var(--globe-sage)"
                opacity="0.1"
                className="animate-dot-glow"
                style={{ animationDelay: `${i * 0.5}s` }}
              />
              {/* Dot */}
              <circle
                cx={city.x} cy={city.y}
                r={city.primary ? 4 : 2.5}
                fill="var(--globe-sage)"
                className="animate-dot-glow"
                style={{ animationDelay: `${i * 0.5}s` }}
              />
              {/* Inner bright core */}
              <circle
                cx={city.x} cy={city.y}
                r={city.primary ? 1.5 : 1}
                fill="var(--globe-cream)"
                opacity="0.8"
              />
            </g>
          ))}
        </svg>

        {/* City labels (HTML for better typography) */}
        <div className="absolute inset-0">
          {CITIES.map((city, i) => (
            <div
              key={`label-${city.name}`}
              className="absolute animate-label-fade"
              style={{
                left: `${(city.x / 400) * 100}%`,
                top: `${(city.y / 380) * 100}%`,
                transform: 'translate(12px, -50%)',
                animationDelay: `${0.8 + i * 0.2}s`,
              }}
            >
              <p
                className="whitespace-nowrap text-[10px] uppercase tracking-[0.12em] font-[family-name:var(--font-mono)]"
                style={{ color: city.primary ? 'var(--globe-olive)' : 'var(--globe-sage)', fontWeight: city.primary ? 600 : 400 }}
              >
                {city.name}
              </p>
              {city.stat && (
                <p
                  className="whitespace-nowrap text-[8px] tracking-[0.08em] mt-0.5 font-[family-name:var(--font-mono)]"
                  style={{ color: 'var(--globe-sage)', opacity: 0.7 }}
                >
                  {city.stat}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Edge shadow — creates depth on sphere border */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 60px 20px rgba(30,36,22,0.2)',
          }}
        />
      </div>

      {/* CSS custom properties + animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --globe-sage: #9aab7e;
          --globe-olive: #6b7d52;
          --globe-cream: #f5f2ea;
          --globe-linen: #e8e4d8;
          --globe-forest: #1e2416;
        }
        @keyframes globe-rotate {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(360deg); }
        }
        @keyframes parish-pulse {
          0%, 100% { fill-opacity: 0.5; }
          50% { fill-opacity: 0.75; }
        }
        @keyframes dot-glow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
        @keyframes label-fade {
          from { opacity: 0; transform: translate(12px, -50%) translateX(5px); }
          to { opacity: 1; transform: translate(12px, -50%) translateX(0); }
        }
        .animate-parish-pulse {
          animation: parish-pulse 3s ease-in-out infinite;
        }
        .animate-dot-glow {
          animation: dot-glow 2s ease-in-out infinite;
        }
        .animate-label-fade {
          opacity: 0;
          animation: label-fade 0.6s ease-out forwards;
        }
      `}} />
    </div>
  )
}
