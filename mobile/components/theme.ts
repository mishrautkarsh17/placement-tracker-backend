// ─────────────────────────────────────────────────────────────
//  MOCKUP THEME  ·  Inter  ·  Gold & Soft White
// ─────────────────────────────────────────────────────────────

export const C = {
  // ── Base layers ──────────────────────────────────────────
  bg:       '#FAFAFB',   // Faint off-white background
  s1:       '#FFFFFF',   // Pure white card surface
  
  // ── Accents ──────────────────────────────────────────────
  gold:     '#F5A623',   // Primary accent color
  goldDim:  'rgba(245, 166, 35, 0.1)',
  goldMuted:'#FCEFD9',
  
  navy:     '#162847',
  
  // ── Status ───────────────────────────────────────────────
  green:    '#34C759',   // Success/Placed
  greenDim: 'rgba(52, 199, 89, 0.1)',
  red:      '#FF3B30',   // Rejected
  redDim:   'rgba(255, 59, 48, 0.1)',
  blue:     '#007AFF',   // Upcoming/Info
  blueDim:  'rgba(0, 122, 255, 0.1)',
  
  // ── Text ─────────────────────────────────────────────────
  t1: '#1C1C1E',   // Almost Black (Headings)
  t2: '#8E8E93',   // Muted Gray (Secondary)
  t3: '#C7C7CC',   // Light Gray (Disabled/Borders)
};

export const F = {
  r: 'Inter_400Regular',
  m: 'Inter_500Medium',
  sb: 'Inter_600SemiBold',
  b: 'Inter_700Bold',
};

export const R = { sm:8, md:12, lg:16, xl:24, xxl:32, full:9999 };
export const S = { xs:4, sm:8, md:16, lg:24, xl:32, xxl: 40 };

// ── Shadows ────────────────────────────────────────────────
export const softShadow = {
  shadowColor: '#D0D5DD',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.25,
  shadowRadius: 30,
  elevation: 8,
};

export const card = {
  backgroundColor: C.s1,
  borderRadius: R.xl,
  ...softShadow,
};
