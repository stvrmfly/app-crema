export default function Skeleton({ width = '100%', height = '1rem', className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
    />
  );
}
