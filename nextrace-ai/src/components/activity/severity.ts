// Severity palette shared by activity components (kept out of .tsx so fast refresh stays intact).
import type { AlertSeverity } from '@/types/alert';

export const SEVERITY_STYLE: Record<AlertSeverity, { color: string; bg: string }> = {
  CRITICAL: { color: '#b91c1c', bg: '#fee2e2' },
  HIGH:     { color: '#c2410c', bg: '#ffedd5' },
  MEDIUM:   { color: '#b45309', bg: '#fef3c7' },
  LOW:      { color: '#047857', bg: '#d1fae5' },
};
