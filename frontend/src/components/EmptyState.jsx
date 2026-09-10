export default function EmptyState({ title, description, action }) {
  return (
    <div className="state">
      <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>{title}</p>
      {description && <p style={{ marginTop: 'var(--space-2)' }}>{description}</p>}
      {action && <div style={{ marginTop: 'var(--space-4)' }}>{action}</div>}
    </div>
  );
}
