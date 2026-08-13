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
