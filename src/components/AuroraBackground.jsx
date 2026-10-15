// Komponen dekoratif murni — aurora + grain untuk tema malam.
// aria-hidden, pointer-events none, hormat prefers-reduced-motion (via CSS).
export default function AuroraBackground() {
  return (
    <>
      <div className="aurora-layer" aria-hidden="true">
        <div className="aurora-blob aurora-blob--teal" />
        <div className="aurora-blob aurora-blob--indigo" />
        <div className="aurora-blob aurora-blob--violet" />
      </div>
      <div className="grain" aria-hidden="true" />
    </>
  );
}
