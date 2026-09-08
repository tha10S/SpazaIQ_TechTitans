export const lightColors = {
  primary: '#16A34A',       
  primaryLight: '#DCFCE7', 
  primaryDark: '#0F7A3D',

  background: '#F3F4F6',    
  card: '#FFFFFF',
  border: '#E5E7EB',

  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  success: '#16A34A',
  successBg: '#DCFCE7',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  warningBorder: '#FDE68A',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  pending: '#D97706',
  pendingBg: '#FEF3C7',
};

export const darkColors = {
  primary: '#22C55E',
  primaryLight: '#14532D',
  primaryDark: '#4ADE80',

  background: '#0F1115',
  card: '#1B1F27',
  border: '#2D323C',

  textPrimary: '#F3F4F6',
  textSecondary: '#B0B6C0',
  textMuted: '#7C8291',

  success: '#22C55E',
  successBg: '#0F3D26',
  warning: '#FBBF24',
  warningBg: '#4A3607',
  warningBorder: '#7A5A0E',
  danger: '#F87171',
  dangerBg: '#4C1616',
  pending: '#FBBF24',
  pendingBg: '#4A3607',
};


export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export function buildTypography(c) {
  return {
    h1: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
    h2: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    label: { fontSize: 13, fontWeight: '500', color: c.textSecondary },
    statValue: { fontSize: 24, fontWeight: '700', color: c.textPrimary },
    body: { fontSize: 14, color: c.textPrimary },
    small: { fontSize: 12, color: c.textSecondary },
  };
}
export const typography = buildTypography(lightColors);