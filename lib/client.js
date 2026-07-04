'use client';

import { toast } from 'sonner';

export async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// Thin wrapper over sonner so all existing showToast(message, type) call sites keep working.
export function showToast(message, type = 'success') {
  if (type === 'error') return toast.error(message);
  if (type === 'warning') return toast.warning(message);
  return toast.success(message);
}

// Re-exported from lib/format so existing client imports keep working.
export { formatDate, capitalize, formatMoney } from './format';
