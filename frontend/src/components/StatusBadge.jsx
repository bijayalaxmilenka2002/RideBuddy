const CLASS_BY_STATUS = {
  OPEN: 'badge--open',
  LOCKED: 'badge--locked',
  COMPLETED: 'badge--completed',
  CANCELLED: 'badge--cancelled',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${CLASS_BY_STATUS[status] || ''}`}>{status}</span>;
}
