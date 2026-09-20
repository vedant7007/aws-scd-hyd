// WCAG contrast for every concept palette, so the numbers in CONCEPTS.md are computed, not guessed.
const lum = (hex) => {
  const c = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2) }

const concepts = {
  'Line 30 (transit)': { light: { bg: '#F4F1EA', text: '#111318', muted: '#5B5F6B', accent: '#FF9900', focus: '#0047AB', l1: '#0047AB', l2: '#C8102E', l3: '#00875A' }, dark: { bg: '#0F1115', text: '#F2F0EA', muted: '#9AA0AB', accent: '#FF9900', focus: '#7FB2FF', l1: '#4C8DFF', l2: '#FF4D6D', l3: '#2DD4A0' } },
  'Admit One (ticket)': { light: { bg: '#FFFDF7', text: '#1A1A1A', muted: '#6B6660', accent: '#FF9900', focus: '#1A1A1A', stamp: '#C8102E' }, dark: { bg: '#141210', text: '#F5EFE0', muted: '#A39C90', accent: '#FF9900', focus: '#F5EFE0', stamp: '#FF4D6D' } },
  'Blueprint': { light: { bg: '#F7F5EE', text: '#1B2A6B', muted: '#5C6693', accent: '#FF9900', focus: '#1B2A6B', line: '#2F4BC7' }, dark: { bg: '#0B1F5C', text: '#EDF1FF', muted: '#A9B6E8', accent: '#FF9900', focus: '#9DC1FF', line: '#7FA3FF' } },
  'Front Page (broadsheet)': { light: { bg: '#F5F1E8', text: '#121212', muted: '#5A5650', accent: '#FF9900', focus: '#121212', rule: '#121212' }, dark: { bg: '#121212', text: '#EDE8DD', muted: '#9C968A', accent: '#FF9900', focus: '#EDE8DD', rule: '#EDE8DD' } },
  'Root (terminal)': { light: { bg: '#F2F4F1', text: '#101410', muted: '#5A6358', accent: '#FF9900', focus: '#0B6E3A', ok: '#0B6E3A' }, dark: { bg: '#0B0F0C', text: '#D9F0DC', muted: '#7E9A83', accent: '#FF9900', focus: '#5EF28A', ok: '#5EF28A' } },
  'Loud (poster)': { light: { bg: '#F2EFE6', text: '#0A0A0A', muted: '#57544D', accent: '#FF9900', focus: '#0A0A0A', acid: '#C9FF00' }, dark: { bg: '#0A0A0A', text: '#F2EFE6', muted: '#A09C93', accent: '#FF9900', focus: '#C9FF00', acid: '#C9FF00' } },
  'The Gate (arch)': { light: { bg: '#F8F3EA', text: '#1C1A17', muted: '#6A6258', accent: '#FF9900', focus: '#7A1F1F', stone: '#D9CDB8', deep: '#7A1F1F' }, dark: { bg: '#161310', text: '#F3EBDD', muted: '#A79E90', accent: '#FF9900', focus: '#FFB84D', stone: '#2A241D', deep: '#E0525A' } },
  'Two-Colour (riso)': { light: { bg: '#FBF7EE', text: '#1A1A1A', muted: '#5F5A52', accent: '#FF9900', focus: '#0038A8', ink2: '#0038A8' }, dark: { bg: '#141414', text: '#F4EEE2', muted: '#A39D92', accent: '#FF9900', focus: '#7FB2FF', ink2: '#7FB2FF' } },
  'Exhibit A (museum)': { light: { bg: '#FAF8F3', text: '#161616', muted: '#6C6862', accent: '#FF9900', focus: '#161616' }, dark: { bg: '#111111', text: '#F1EEE7', muted: '#9A968E', accent: '#FF9900', focus: '#F1EEE7' } },
  'Canvas (workbench)': { light: { bg: '#F5F5F5', text: '#141414', muted: '#666666', accent: '#FF9900', focus: '#0D6EFD', sel: '#0D6EFD' }, dark: { bg: '#111111', text: '#F0F0F0', muted: '#9A9A9A', accent: '#FF9900', focus: '#5AA2FF', sel: '#5AA2FF' } },
  'Foil (holographic)': { light: { bg: '#F6F6F8', text: '#121218', muted: '#61616E', accent: '#FF9900', focus: '#4F2ED6' }, dark: { bg: '#0A0A10', text: '#F4F4FA', muted: '#9C9CB0', accent: '#FF9900', focus: '#B9A6FF' } },
  'Issue #1 (comic)': { light: { bg: '#FFF8E7', text: '#111111', muted: '#5C5850', accent: '#FF9900', focus: '#0057B8', cyan: '#00A7E1' }, dark: { bg: '#101010', text: '#FFF4DC', muted: '#A39B8B', accent: '#FF9900', focus: '#7FD3FF', cyan: '#7FD3FF' } },
  'Orbit (launch)': { light: { bg: '#F3F4F8', text: '#0E1220', muted: '#5D6478', accent: '#FF9900', focus: '#0E1220' }, dark: { bg: '#070A14', text: '#EEF1FA', muted: '#8F97AD', accent: '#FF9900', focus: '#FFB84D' } },
  'Aksharam (Telugu type)': { light: { bg: '#FBF6EE', text: '#1A1612', muted: '#6B6259', accent: '#FF9900', focus: '#7B1E3C', deep: '#7B1E3C' }, dark: { bg: '#15110E', text: '#F6EEE2', muted: '#AB9F92', accent: '#FF9900', focus: '#FF8FAF', deep: '#FF8FAF' } },
}

for (const [name, modes] of Object.entries(concepts)) {
  console.log('\n' + name)
  for (const [mode, p] of Object.entries(modes)) {
    const out = [`  ${mode}: text ${ratio(p.text, p.bg)}:1, muted ${ratio(p.muted, p.bg)}:1, accent-on-bg ${ratio(p.accent, p.bg)}:1, FOCUS ${ratio(p.focus, p.bg)}:1${ratio(p.focus, p.bg) < 3 ? ' FAIL' : ''}, ink-on-accent ${ratio('#0A0A0A', p.accent)}:1`]
    for (const k of Object.keys(p)) if (!['bg', 'text', 'muted', 'accent', 'focus'].includes(k)) out.push(`${k} ${ratio(p[k], p.bg)}:1`)
    console.log(out.join(' | '))
  }
}
