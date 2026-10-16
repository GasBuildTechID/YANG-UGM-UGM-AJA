'use client';

/**
 * Komponen indikator loading titik tiga bergelombang (waving three-dots loading).
 * Cocok untuk feedback visual saat sistem/AI sedang memproses, bernalar, atau menunggu data.
 */
export default function WaveDots({ size = 'md', className = '', label = '' }) {
  const sizeMap = {
    xs: 'size-1.5 gap-1',
    sm: 'size-2 gap-1.5',
    md: 'size-2.5 gap-2',
    lg: 'size-3.5 gap-2.5',
  };

  const dotClasses = sizeMap[size] || sizeMap.md;

  return (
    <span
      className={`inline-flex items-center ${label ? 'gap-2.5' : ''} ${className}`}
      role="status"
      aria-label={label || 'Memuat...'}
    >
      <span className={`wave-dots inline-flex items-center ${dotClasses}`}>
        <span className="wave-dot" />
        <span className="wave-dot" />
        <span className="wave-dot" />
      </span>
      {label && <span className="text-xs text-mist font-medium">{label}</span>}
    </span>
  );
}

