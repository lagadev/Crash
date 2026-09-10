// Minimal stroke-icon set (24x24, currentColor) - no emoji, per the premium/minimalist UI spec.
// Shared by both the Mini App and the Admin Panel.
const ICONS = {
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2c3 2 5 6 5 10 0 2-1 4-2 5l-1 3-1-2-2 2-1-3-3-1 2-2-2-1 3-1c1-1 3-3 5-2z"/><circle cx="12" cy="9" r="1.6"/></svg>',
  task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l2 2 4-4"/><rect x="3" y="4" width="18" height="17" rx="3"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="8" r="2.5"/><path d="M17 12.2c2.6.4 4.5 2.4 4.5 5.8"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 9.5h19"/><circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4 3.5-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="2.4"/><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="19" r="2.4"/><path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5"/><path d="M12 13v3M9 20h6M10 16.5h4v3.5h-4z"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="6" rx="1.6"/><rect x="3" y="14" width="18" height="6" rx="1.6"/><circle cx="7" cy="7" r=".9" fill="currentColor" stroke="none"/><circle cx="7" cy="17" r=".9" fill="currentColor" stroke="none"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 13l4 4L19 7"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1.6"/><rect x="13" y="3" width="8" height="5" rx="1.6"/><rect x="13" y="10" width="8" height="11" rx="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.6"/></svg>',
  withdraw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 4v4M9 13v1M15 13v1"/><path d="M2 12h2M20 12h2"/></svg>',
  game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M8 10v4M6 12h4"/><circle cx="16" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="18.5" cy="13.5" r="1" fill="currentColor" stroke="none"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 8.2 2.6l.1.1a1.7 1.7 0 0 0 1.9.3H10.3a1.7 1.7 0 0 0 1-1.6V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V6.5a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  ton: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9.5"/><path d="M7 8h10l-5 9-5-9zM8.8 8l3.2 5.7L15.2 8"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 15l6-6"/><path d="M8 12l-2.3 2.3a3.2 3.2 0 0 0 4.5 4.5L13 16"/><path d="M16 12l2.3-2.3a3.2 3.2 0 1 0-4.5-4.5L11 8"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="9" width="18" height="12" rx="1.6"/><path d="M3 13h18M12 9v12"/><path d="M12 9c-1.5 0-4-1-4-3.2A2.3 2.3 0 0 1 10.3 3.5C12 3.5 12 6.5 12 9zm0 0c1.5 0 4-1 4-3.2A2.3 2.3 0 0 0 13.7 3.5C12 3.5 12 6.5 12 9z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><defs><linearGradient id="starGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe27a"/><stop offset="55%" stop-color="#ffc94a"/><stop offset="100%" stop-color="#ff9f43"/></linearGradient></defs><path fill="url(#starGrad)" stroke="#d9861f" stroke-width="0.6" stroke-linejoin="round" d="M12 2.4l2.95 6.05 6.65.75-4.9 4.55 1.3 6.6L12 17.05l-5.95 3.3 1.3-6.6-4.9-4.55 6.65-.75z"/></svg>',
  walletcheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 9.5h19"/><path d="M9.5 14.2l1.6 1.6 3.4-3.6"/></svg>',
};

function icon(name, cls = "") {
  return `<span class="icon ${cls}">${ICONS[name] || ""}</span>`;
}

/**
 * Renders the Stars currency icon. Tries a real PNG at /assets/star.png
 * first (drop your own official asset there - same fallback pattern as
 * flying.gif/crashed.gif); if it 404s, swaps to a crafted gold-gradient
 * vector star instead of a platform-dependent emoji glyph.
 */
function starTag(cls = "") {
  return `<span class="star-ic ${cls}"><img src="/assets/star.png" alt="" draggable="false" oncontextmenu="return false" onerror="this.parentNode.innerHTML=ICONS.star"/></span>`;
}


// Classic (non-module) <script> tags share one global scope, but a top-level
// `const`/`function` does NOT become a property of `window` the way `var` does.
// Earlier code read `window.ICONS`, which was always undefined - silently
// leaving every icon slot empty. Export explicitly so both the Mini App and
// the Admin Panel resolve icons correctly.
window.ICONS = ICONS;
window.icon = icon;
window.starTag = starTag;
