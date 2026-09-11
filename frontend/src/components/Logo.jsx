/**
 * The RideBuddy mark: two offset rounded bars (stacked cars) over two wheels,
 * on a teal gradient tile. Traced from the inline SVG on the live site.
 */
export default function Logo({ size = 36, iconSize = 20, radius = 'var(--radius-lg)' }) {
  return (
    <span
      className="gradient-primary"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="10" height="7" rx="2.5" fill="white" opacity="0.9" />
        <rect x="6" y="5" width="10" height="7" rx="2.5" fill="white" opacity="0.5" />
        <circle cx="5" cy="14" r="1.5" fill="white" opacity="0.8" />
        <circle cx="13" cy="14" r="1.5" fill="white" opacity="0.8" />
      </svg>
    </span>
  );
}
