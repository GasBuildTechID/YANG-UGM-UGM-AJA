import Image from 'next/image';

/**
 * Komponen Logo hearme yang responsif di semua perangkat (mobile hingga desktop).
 * Menjaga aspek rasio, ketajaman, dan visibilitas di berbagai ukuran layar.
 */
export default function Logo({ size = 32, className = '' }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <Image
        src="/logo-bg.png"
        alt="hearme logo"
        width={size * 2} // 2x resolusi untuk layar Retina / High-DPI agar tidak buram
        height={size * 2}
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`rounded-lg object-cover shadow-sm select-none ${className}`}
        priority
      />
    </span>
  );
}

