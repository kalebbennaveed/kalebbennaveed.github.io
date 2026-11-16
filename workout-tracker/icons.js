const shapes = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M7.5 3v4m9-4v4M4 10h16m-12 4h1m5 0h1"/>',
  reports: '<path d="M4 3v17h17M8 16v-4m5 4V8m5 8V5"/>',
  dumbbell: '<g transform="rotate(-40 12 12)"><path d="M2 10v4m20-4v4M8 10.5h8m-8 3h8"/><rect x="4" y="6" width="4" height="12" rx="1.1"/><rect x="16" y="6" width="4" height="12" rx="1.1"/></g>',
  utensils: '<path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18m11 0V3c-3 1.6-4.2 5.4-4.2 10H18"/>',
  book: '<path d="M12 6.4C9.2 4.6 5.7 4.3 2.7 5.1v14c3.3-.7 6.6-.3 9.3 1.4 2.7-1.7 6-2.1 9.3-1.4v-14c-3-.8-6.5-.5-9.3 1.3Zm0 0v14"/>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M7.2 8.8a6 6 0 0 1 9.6 0l-2.3 3.1h-5L7.2 8.8Zm4.8 2.8 1.5-3"/>',
  arrowRight: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',chevronRight:'<path d="m9.5 6 6 6-6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
  cloud:'<path d="M6.5 18.5a4.8 4.8 0 0 1-.7-9.6 6.4 6.4 0 0 1 12.3-.7 5.1 5.1 0 0 1 .6 10.2Z"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',panel:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/>',
  activity:'<path d="M2 12h4l3-8 6 16 3-8h4"/>',journal:'<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18m3-13h4m-4 4h4M3 7h4M3 12h4M3 17h4"/>',
  sun:'<circle cx="12" cy="12" r="3.4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.1M4 12h.1M4 18h.1"/>',
  timeline:'<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><path d="M5 8v8m6-10h10m-10 5h6m-6 7h10"/>',
  edit:'<path d="m4 16 11.5-11.5 4 4L8 20l-5 1Zm10-10 4 4"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check:'<path d="m4.5 12 5 5L20 6.5"/>',
  flag:'<path d="M5 21V4c4-3 8 3 14 0v10c-6 3-10-3-14 0"/>',
  streak:'<path d="M13.2 2.5c1.2 5.6-3.3 6.1-2 10 1.6-.3 2.9-2.1 3.1-4.2 3.1 2.8 4.9 5 4.9 8a7.2 7.2 0 0 1-14.4 0c0-5.1 6-7.6 8.4-13.8Z"/>'
};
export function icon(name,size=20) {
  return '<svg aria-hidden="true" focusable="false" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+(shapes[name]||shapes.activity)+'</svg>';
}
