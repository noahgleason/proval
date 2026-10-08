// Bone paper, ink, and one ultramarine signal. Approve/deny colors are the
// only other hues, so status always reads at a glance.
export const colors = {
  bg: '#F4F2EE',
  card: '#FFFFFF',
  ink: '#16141A',
  muted: '#86827C',
  line: '#E4E0D9',
  brand: '#3A2BF5',
  brandSoft: '#E8E6FE',
  approve: '#14995A',
  approveSoft: '#E1F3E9',
  deny: '#E0443F',
  denySoft: '#FBE6E5',
  pending: '#A8741A',
  pendingSoft: '#F6EDDB',
  scrim: 'rgba(22,20,26,0.55)',
};

export const radius = { sm: 10, md: 16, lg: 26, pill: 999 };

export const type = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -1.2 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
} as const;
