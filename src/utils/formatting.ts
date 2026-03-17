// ─── Currency Formatting (Indian) ────────────────────────────────────────────

export const formatCurrency = (value: number): string => {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)}Cr`;
  }
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }
  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(0)}K`;
  }
  return `₹${value}`;
};

export const formatFullCurrency = (value: number): string => {
  return `₹${value.toLocaleString('en-IN')}`;
};

// ─── Date Formatting ──────────────────────────────────────────────────────────

export const formatRelativeDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
};

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const isOverdue = (lastActivityDate?: string, days: number = 5): boolean => {
  if (!lastActivityDate) return true;
  const date = new Date(lastActivityDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return diffMs > days * 24 * 60 * 60 * 1000;
};

export const getDaysRemaining = (endDate: string): number => {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const toISODate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Returns ISO 8601 timestamp in India Standard Time (IST, UTC+05:30)
// e.g. "2026-03-17T17:20:33.279+05:30"
export const toISTISOString = (date: Date = new Date()): string => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().replace('Z', '+05:30');
};
