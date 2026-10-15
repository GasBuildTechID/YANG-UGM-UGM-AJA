'use client';

// Orb animasi untuk alur voice AI.
// state: 'idle' (menunggu) | 'speaking' (AI bicara) | 'listening' (pengguna bicara) | 'thinking'
// Murni dekoratif — selalu aria-hidden, tidak pernah satu-satunya pembawa informasi.

export default function VoiceOrb({ state = 'idle', size = 220 }) {
  return (
    <div
      className="voice-orb"
      data-state={state}
      style={{ '--orb-size': `${size}px` }}
      aria-hidden="true"
    >
      <span className="voice-orb__ring" />
      <span className="voice-orb__ring voice-orb__ring--2" />
      <span className="voice-orb__core" />
      <div className="voice-orb__bars">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ '--i': i }} />
        ))}
      </div>
    </div>
  );
}
