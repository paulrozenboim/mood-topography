/* ============================================================
   Shared inline SVG icons — used by every page so the same glyph shows up on
   every theme toggle, print button, etc. Kept as strings (not <use> refs) so
   any page can drop them into innerHTML directly, no <symbol> registration
   pass required. All icons draw with currentColor so they inherit the CSS
   colour of the button they sit inside.
   ============================================================ */
"use strict";
const Icons = {
  // Half moon inside a circle — reads as "theme" from a distance.
  theme:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">' +
      '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<path d="M10 3.3 A6.7 6.7 0 0 1 10 16.7 Z" fill="currentColor"/>' +
    '</svg>',

  // Classic printer silhouette.
  print:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' +
      '<rect x="5"   y="3.2" width="10" height="4"/>' +
      '<path d="M4 7.2 h12 a1.5 1.5 0 0 1 1.5 1.5 v4 a1.5 1.5 0 0 1 -1.5 1.5 h-1.2"/>' +
      '<path d="M5.7 14.2 H4 a1.5 1.5 0 0 1 -1.5 -1.5 v-4 a1.5 1.5 0 0 1 1.5 -1.5"/>' +
      '<rect x="5.7" y="11.2" width="8.6" height="5.6"/>' +
    '</svg>',

  // Three finder-pattern squares + one small module — reads as "QR" instantly.
  qr:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="currentColor">' +
      '<path d="M2 2h5v5H2zM3.5 3.5v2h2v-2zM13 2h5v5h-5zM14.5 3.5v2h2v-2zM2 13h5v5H2zM3.5 14.5v2h2v-2z"/>' +
      '<path d="M10 10h2v2h-2zM14 10h4v2h-4zM10 14h2v4h-2zM14 14h4v4h-4z"/>' +
    '</svg>',

  // Four corner brackets — the "fit view" glyph most map tools use.
  fit:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M2 6 V2 H6"/>' +
      '<path d="M18 6 V2 H14"/>' +
      '<path d="M2 14 V18 H6"/>' +
      '<path d="M18 14 V18 H14"/>' +
    '</svg>',

  // Media-player triangles for the bulletin transport.
  play:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="currentColor">' +
      '<path d="M5.5 3.5 v13 L16 10 Z"/>' +
    '</svg>',

  pause:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="currentColor">' +
      '<rect x="5"  y="4" width="3.5" height="12"/>' +
      '<rect x="11.5" y="4" width="3.5" height="12"/>' +
    '</svg>',

  prev:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="currentColor">' +
      '<rect x="4" y="4" width="2" height="12"/>' +
      '<path d="M17 3.5 v13 L7.5 10 Z"/>' +
    '</svg>',

  next:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="currentColor">' +
      '<rect x="14" y="4" width="2" height="12"/>' +
      '<path d="M3 3.5 v13 L12.5 10 Z"/>' +
    '</svg>',

  // Eye / eye-off — toggles the bulletin bar visibility.
  eyeOn:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M2 10 C 4.5 5, 7.5 4, 10 4 C 12.5 4, 15.5 5, 18 10 C 15.5 15, 12.5 16, 10 16 C 7.5 16, 4.5 15, 2 10 Z"/>' +
      '<circle cx="10" cy="10" r="2.5" fill="currentColor" stroke="none"/>' +
    '</svg>',

  eyeOff:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M2 10 C 4.5 5, 7.5 4, 10 4 C 12.5 4, 15.5 5, 18 10 C 15.5 15, 12.5 16, 10 16 C 7.5 16, 4.5 15, 2 10 Z"/>' +
      '<path d="M4 4 L 16 16" stroke-width="2"/>' +
    '</svg>',

  // Filled square — reads as "stop" against the play/pause pair.
  stop:
    '<svg class="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="currentColor">' +
      '<rect x="4.5" y="4.5" width="11" height="11"/>' +
    '</svg>',

  // Circular arrow with arrowhead — the universal "repeat / loop" glyph.
  repeat:
    '<svg class="icon" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 8 A6 6 0 0 1 15 6.5"/>' +
      '<path d="M16 8 V4 h-4"/>' +
      '<path d="M16 12 A6 6 0 0 1 5 13.5"/>' +
      '<path d="M4 12 V16 h4"/>' +
    '</svg>',

  // Trash / delete — reused by the archive card delete.
  trash:
    '<svg class="icon" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 5 h14"/>' +
      '<path d="M6 5 V3.5 h8 V5"/>' +
      '<path d="M5 5 v11 a1.5 1.5 0 0 0 1.5 1.5 h7 a1.5 1.5 0 0 0 1.5 -1.5 V5"/>' +
      '<path d="M9 9 v5 M11 9 v5"/>' +
    '</svg>'
};
if(typeof window !== "undefined") window.Icons = Icons;
