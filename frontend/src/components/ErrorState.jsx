export default function ErrorState({ message, onRetry }) {
  return (
    <div className="state state--error">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary" style={{ marginTop: 'var(--space-4)' }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
