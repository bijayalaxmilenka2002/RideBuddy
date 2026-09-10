export const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatTime = (value) =>
  new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export const formatFare = (amount) =>
  amount === null || amount === undefined ? '—' : `₹${Number(amount).toFixed(2)}`;

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
