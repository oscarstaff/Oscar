/* ═══════════════════════════════════════════════════════════════
   DialTRAC — Call Log module for Nexus
   Extracted from index.html so the call logger can grow without
   overcrowding the main file. Still renders as the Call Log TAB
   inside Nexus — same session, same helpers (sbGet, me, myTeam,
   showToast), same #page-calllog mount point.

   Load AFTER the main Nexus script:  <script src="dialtrac.js?v=N">
   Bump ?v= on every deploy (hard-refresh discipline now covers
   two files).
   ═══════════════════════════════════════════════════════════════ */

/* ── Inject styles + markup into the #page-calllog shell ── */
(function(){
  const CL_CSS = `/* ══════════════ CALL LOG · OPERATIONS CONSOLE ══════════════

   TYPOGRAPHY — a deliberate pair, both already loaded by Nexus:
     Fraunces  display serif, optical-size aware. Used only for the two
               places that should feel authored: the page title and the
               big stat figures. Its high stroke contrast is what stops
               this reading as another all-Inter dashboard.
     Inter     everything functional — labels, body, controls.
     ui-monospace  numbers, where digit alignment does real work.
   (TT Neoris was requested but is a licensed TypeType face with no CDN.
    Fraunces gives the same editorial weight and is already in the page.)

   COLOUR — 60/30/10 against the theme tokens, so it re-skins with the
   user's chosen theme rather than hardcoding a palette:
     60%  --m-canvas   the field the console sits on
     30%  --m-card     raised surfaces: rail, cards, controls
     10%  --accent     one high-contrast voice, plus amber for waiting
   No pure #000 or #fff anywhere — the darkest ink is --m-ink.

   SPACING — 4px base. Every padding, gap and radius is a multiple.

   NOT-GENERIC, deliberately:
     · Asymmetric split — a 336px fixed capture rail against a fluid
       queue, not the usual centred column or 3-up card grid.
     · The queue is a LIST of cards with day separators, not a data
       table. Calls are events in time, so the layout reads as a feed.
     · Notes render inline in the card. No accordion, no modal — the
       thing you need to read is already on screen.
     · Actions reveal on hover and collapse to an icon at rest, so the
       list stays quiet until you reach for it.
     · The scope switch has a gliding indicator that animates between
       positions rather than two buttons swapping a background.
     · Stat figures are display-serif and clickable — the header is a
       control surface, not a decorative banner.
   ─────────────────────────────────────────────────────────────────── */

#page-calllog{max-width:none;width:100%;padding:0;margin:0;}
#page-calllog.active{display:block;position:absolute;inset:0;overflow:hidden;}
.main:has(#page-calllog.active),
.main.cl-fixed{overflow:hidden;position:relative;}

.cl-console{
  --cl-ease:cubic-bezier(.2,.8,.2,1);
  --cl-spring:cubic-bezier(.34,1.4,.64,1);
  --cl-t:200ms;
  --cl-rail:336px;
  --amber:#d97706; --amber-bg:rgba(217,119,6,.11); --amber-bd:rgba(217,119,6,.22);
  display:flex;flex-direction:column;height:100%;min-height:0;
  background:var(--m-canvas);
  font-family:'Inter',system-ui,sans-serif;}

/* ══════ COMMAND BAR ══════
   Gradient rather than flat fill, and a hairline highlight along the top
   edge — the surface reads as lit rather than painted. */
.cl-ribbon{flex-shrink:0;display:flex;align-items:center;gap:24px;
  padding:0 20px;height:60px;position:relative;
  background:linear-gradient(180deg,
    color-mix(in srgb,var(--m-card) 100%,transparent),
    color-mix(in srgb,var(--m-card) 92%,var(--m-canvas)));
  border-bottom:1px solid var(--m-border);}
.cl-ribbon::after{content:'';position:absolute;inset:0 0 auto 0;height:1px;
  background:linear-gradient(90deg,transparent,
    color-mix(in srgb,var(--accent) 22%,transparent) 30%,
    color-mix(in srgb,var(--accent) 22%,transparent) 70%,transparent);}

.cl-rb-brand{display:flex;align-items:center;gap:10px;flex-shrink:0;}
.cl-mark{width:30px;height:30px;border-radius:9px;display:flex;
  align-items:center;justify-content:center;flex-shrink:0;color:#fff;
  background:linear-gradient(145deg,var(--accent),
    color-mix(in srgb,var(--accent) 72%,#000));
  box-shadow:0 2px 6px var(--accent-dim),
             inset 0 1px 0 rgba(255,255,255,.22);}
.cl-rb-txt{display:flex;flex-direction:column;line-height:1.15;}
.cl-rb-title{font-family:'Fraunces',Georgia,serif;font-size:17px;font-weight:600;
  font-optical-sizing:auto;letter-spacing:-.01em;color:var(--m-ink);}
.cl-rb-sub{font-size:10.5px;font-weight:600;color:var(--m-ink-3);
  letter-spacing:.04em;text-transform:lowercase;}

/* Stats are buttons — the header filters the list. */
.cl-rb-stats{display:flex;align-items:center;gap:14px;flex:1;min-width:0;}
.cl-stat{display:flex;align-items:baseline;gap:6px;border:none;background:none;
  padding:4px 8px;border-radius:8px;cursor:pointer;font-family:inherit;
  transition:background var(--cl-t) var(--cl-ease);}
.cl-stat:hover{background:var(--m-card-2);}
.cl-stat:focus-visible{outline:2px solid var(--accent);outline-offset:1px;}
.cl-stat-n{font-family:'Fraunces',Georgia,serif;font-size:21px;font-weight:600;
  font-optical-sizing:auto;color:var(--m-ink);line-height:1;
  font-variant-numeric:tabular-nums;letter-spacing:-.01em;}
.cl-stat-l{font-size:11px;font-weight:600;color:var(--m-ink-3);
  letter-spacing:.03em;}
.cl-stat-alert.hot .cl-stat-n{color:var(--amber);}
.cl-stat-alert.hot .cl-stat-l{color:var(--amber);}
/* Something has been waiting 2+ days — a different state from "busy". */
.cl-stat-alert.overdue .cl-stat-n,
.cl-stat-alert.overdue .cl-stat-l{color:#dc2626;}
.cl-stat-sel{background:var(--m-card-2);box-shadow:inset 0 0 0 1px var(--m-border);}
.cl-rule{width:1px;height:16px;background:var(--m-border);flex-shrink:0;}

.cl-rb-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}

/* Gliding segmented control — the indicator travels between positions
   instead of a background jumping between two buttons. */
.cl-rb-scope{position:relative;display:flex;padding:3px;border-radius:10px;
  background:var(--m-card-2);border:1px solid var(--m-border);}
.cl-sc-glide{position:absolute;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);
  border-radius:8px;background:var(--m-card);box-shadow:var(--m-sh-1);
  transition:transform 320ms var(--cl-spring);pointer-events:none;}
.cl-rb-scope.at-all .cl-sc-glide{transform:translateX(100%);}
.cl-sc{position:relative;z-index:1;border:none;background:none;
  font-family:inherit;font-size:12.5px;font-weight:600;padding:6px 14px;
  border-radius:8px;cursor:pointer;color:var(--m-ink-3);white-space:nowrap;
  transition:color var(--cl-t) var(--cl-ease);}
.cl-sc-on{color:var(--m-ink);}
.cl-sc:hover:not(.cl-sc-on){color:var(--m-ink-2);}
.cl-sc:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

/* ══════ SPLIT ══════ */
.cl-body{flex:1;min-height:0;display:grid;grid-template-columns:var(--cl-rail) 1fr;}

/* ── capture rail ── */
.cl-pane-form{background:var(--m-card);border-right:1px solid var(--m-border);
  padding:20px;overflow-y:auto;min-height:0;
  display:flex;flex-direction:column;gap:0;position:relative;}
/* Accent hairline down the inner edge, brightening on focus — the rail
   signals it's the active surface without moving anything. */
.cl-pane-form::after{content:'';position:absolute;top:0;bottom:0;right:-1px;width:2px;
  background:var(--accent);opacity:0;
  transition:opacity var(--cl-t) var(--cl-ease);}
.cl-pane-form:focus-within::after{opacity:.5;}

.cl-form-hd{display:flex;align-items:center;justify-content:space-between;
  margin-bottom:18px;}
.cl-form-title{font-family:'Fraunces',Georgia,serif;font-size:16px;font-weight:600;
  font-optical-sizing:auto;color:var(--m-ink);margin:0;letter-spacing:-.01em;}
.cl-keyhint{display:flex;gap:3px;}
.cl-keyhint kbd{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;
  font-weight:600;padding:2px 5px;border-radius:5px;background:var(--m-card-2);
  border:1px solid var(--m-border);color:var(--m-ink-3);line-height:1.3;}

.cl-field{margin-bottom:14px;}
.cl-label{display:block;font-size:11.5px;font-weight:600;margin-bottom:6px;
  color:var(--m-ink-2);letter-spacing:.01em;}
.cl-req{color:#dc2626;}
.cl-hint{font-size:11px;color:var(--m-ink-3);margin-top:5px;min-height:14px;
  line-height:1.35;transition:color var(--cl-t) var(--cl-ease);}
.cl-hint-warn{color:var(--amber);font-weight:600;}

.cl-in{width:100%;background:var(--m-card-2);border:1.5px solid var(--m-border);
  border-radius:10px;color:var(--m-ink);padding:10px 12px;font-size:13.5px;
  font-weight:500;outline:none;font-family:inherit;-webkit-appearance:none;
  box-sizing:border-box;
  transition:border-color var(--cl-t) var(--cl-ease),
             background var(--cl-t) var(--cl-ease),
             box-shadow var(--cl-t) var(--cl-ease);}
.cl-in:hover:not(:focus){border-color:var(--m-border-hi);}
.cl-in:focus{border-color:var(--accent);background:var(--m-card);
  box-shadow:0 0 0 3px var(--accent-dim);}
.cl-in::placeholder{color:var(--m-ink-3);font-weight:400;}
.cl-in.error{border-color:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,.1);}
textarea.cl-in{min-height:64px;resize:vertical;line-height:1.5;}
select.cl-in{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:32px;
  background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath d='M5.5 8l4.5 4.5L14.5 8z'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 10px center;background-size:14px;}

/* Country prefix sits inside the field — the +61 is never typed, so it
   shouldn't look like an empty input waiting for it. */
.cl-in-wrap{position:relative;display:flex;align-items:center;}
.cl-in-pre{position:absolute;left:12px;font-family:ui-monospace,'SF Mono',Menlo,monospace;
  font-size:12px;font-weight:600;color:var(--m-ink-3);pointer-events:none;
  letter-spacing:.02em;}
.cl-in-tel{padding-left:44px;font-family:ui-monospace,'SF Mono',Menlo,monospace;
  font-variant-numeric:tabular-nums;letter-spacing:.02em;}

/* Four reasons cover most calls — one tap instead of typing. */
.cl-quick{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;}
.cl-quick button{font-family:inherit;font-size:11px;font-weight:600;
  padding:4px 9px;border-radius:999px;cursor:pointer;
  border:1px solid var(--m-border);background:var(--m-card-2);color:var(--m-ink-3);
  transition:all var(--cl-t) var(--cl-ease);}
.cl-quick button:hover{border-color:var(--accent-bd);color:var(--accent-text);
  transform:translateY(-1px);}
.cl-quick button.on{background:var(--accent);border-color:var(--accent);color:#fff;}

.cl-check{display:flex;align-items:flex-start;gap:10px;padding:12px;
  border:1.5px solid var(--m-border);border-radius:12px;background:var(--m-card-2);
  cursor:pointer;user-select:none;margin-top:2px;
  transition:all var(--cl-t) var(--cl-ease);}
.cl-check:hover{border-color:var(--amber-bd);background:var(--amber-bg);}
.cl-check input{position:absolute;opacity:0;width:0;height:0;}
.cl-check-box{width:18px;height:18px;border-radius:6px;
  border:1.5px solid var(--m-border-hi);background:var(--m-card);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  margin-top:1px;color:transparent;
  transition:all var(--cl-t) var(--cl-spring);}
.cl-check input:checked ~ .cl-check-box{background:var(--amber);
  border-color:var(--amber);color:#fff;transform:scale(1.08);}
.cl-check input:focus-visible ~ .cl-check-box{outline:2px solid var(--accent);outline-offset:2px;}
.cl-check-text{display:flex;flex-direction:column;gap:1px;}
.cl-check-main{font-size:12.5px;font-weight:600;color:var(--m-ink);line-height:1.35;}
.cl-check-sub{font-size:11px;color:var(--m-ink-3);}
.cl-check.on{border-color:var(--amber);background:var(--amber-bg);}
.cl-check.on .cl-check-main{color:var(--amber);}

.cl-actions{display:flex;gap:8px;margin-top:auto;padding-top:16px;}
.cl-btn-ghost,.cl-btn-go{min-height:42px;border-radius:11px;cursor:pointer;
  font-family:inherit;font-size:13.5px;font-weight:600;border:none;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  transition:all var(--cl-t) var(--cl-ease);}
.cl-btn-ghost{flex:1;background:var(--m-card-2);color:var(--m-ink-2);
  border:1px solid var(--m-border);}
.cl-btn-ghost:hover{background:var(--m-border);color:var(--m-ink);}
.cl-btn-go{flex:2;color:#fff;
  background:linear-gradient(145deg,var(--accent),
    color-mix(in srgb,var(--accent) 80%,#000));
  box-shadow:0 2px 8px var(--accent-dim),inset 0 1px 0 rgba(255,255,255,.18);}
.cl-btn-go:hover{filter:brightness(1.06);transform:translateY(-1px);
  box-shadow:0 5px 16px var(--accent-dim),inset 0 1px 0 rgba(255,255,255,.2);}
.cl-btn-go:active{transform:translateY(0);}
.cl-btn-go:disabled{opacity:.5;cursor:not-allowed;transform:none;filter:none;}
.cl-btn-ghost:focus-visible,.cl-btn-go:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

/* ── queue ── */
.cl-pane-queue{display:flex;flex-direction:column;min-height:0;min-width:0;
  background:var(--m-canvas);}
.cl-qbar{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;
  gap:12px;padding:12px 18px;border-bottom:1px solid var(--m-border);
  background:var(--m-canvas);flex-wrap:wrap;}
.cl-filters{display:flex;gap:5px;flex-wrap:wrap;}
/* The right cluster must WRAP when tight, never crush. Without wrap, adding
   the Today chip (or the search growing on focus) squeezed the date inputs
   and search into an overlapped mess at mid widths. Each control keeps its
   size (shrink:0 below) and drops to the next line as a unit instead. */
.cl-bar-right{display:flex;gap:7px;align-items:center;flex-wrap:wrap;
  justify-content:flex-end;min-width:0;}
#clChipToday{flex-shrink:0;}
.cl-chip{border:1px solid var(--m-border);background:var(--m-card);
  color:var(--m-ink-2);font-family:inherit;font-size:12.5px;font-weight:600;
  padding:7px 14px;border-radius:999px;cursor:pointer;
  display:inline-flex;align-items:center;gap:7px;min-height:34px;
  transition:all var(--cl-t) var(--cl-ease);}
.cl-chip:hover{border-color:var(--m-border-hi);color:var(--m-ink);
  transform:translateY(-1px);}
.cl-chip-on,.cl-chip-on:hover{color:#fff;border-color:transparent;
  background:linear-gradient(145deg,var(--accent),
    color-mix(in srgb,var(--accent) 78%,#000));
  box-shadow:0 2px 8px var(--accent-dim);}
.cl-chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.cl-cnt{font-variant-numeric:tabular-nums;font-size:11px;font-weight:700;opacity:.6;}

.cl-search-wrap{position:relative;display:flex;align-items:center;flex-shrink:0;}
/* The two date inputs are the widest thing in the bar and rarely used, so
   they stay tucked away until the calendar chip opens them (or a range is
   actually active). This is what un-crowds the toolbar. */
.cl-daterange{display:none;align-items:center;gap:5px;flex-shrink:0;}
.cl-daterange.show,.cl-daterange.cl-dr-active{display:flex;}
.cl-chip-ico{padding:7px 10px;}
.cl-daterange{
  border:1px solid var(--m-border);background:var(--m-card);
  border-radius:999px;padding:3px 8px;min-height:34px;
  transition:border-color var(--cl-t) var(--cl-ease);}
.cl-daterange:hover{border-color:var(--m-border-hi);}
.cl-daterange.cl-dr-active{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim);}
.cl-date{border:none;background:transparent;font-family:inherit;
  font-size:12px;color:var(--m-ink);outline:none;padding:2px 3px;
  color-scheme:light;width:118px;cursor:pointer;}
:is([data-theme="dark"],[data-theme="midnight"]) .cl-date{color-scheme:dark;}
.cl-date::-webkit-calendar-picker-indicator{opacity:.5;cursor:pointer;}
.cl-date::-webkit-calendar-picker-indicator:hover{opacity:.9;}
.cl-date-dash{color:var(--m-ink-3);font-size:12px;flex-shrink:0;}
.cl-date-clear{border:none;background:transparent;color:var(--m-ink-3);
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  padding:3px;border-radius:6px;flex-shrink:0;
  transition:color var(--cl-t),background var(--cl-t);}
.cl-date-clear:hover{color:var(--warn,#dc2626);background:var(--m-card-2);}
.cl-search-ico{position:absolute;left:11px;color:var(--m-ink-3);pointer-events:none;}
.cl-search{border:1px solid var(--m-border);background:var(--m-card);
  border-radius:999px;padding:7px 34px 7px 32px;font-size:12.5px;
  font-family:inherit;color:var(--m-ink);width:180px;outline:none;min-height:34px;
  transition:all var(--cl-t) var(--cl-ease);}
.cl-search:hover:not(:focus){border-color:var(--m-border-hi);}
.cl-search:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim);width:min(236px,36vw);}
.cl-search::placeholder{color:var(--m-ink-3);}
.cl-search-kbd{position:absolute;right:10px;font-family:ui-monospace,Menlo,monospace;
  font-size:10px;font-weight:600;color:var(--m-ink-3);pointer-events:none;
  padding:1px 5px;border-radius:4px;background:var(--m-card-2);
  border:1px solid var(--m-border);}
.cl-search:focus ~ .cl-search-kbd{opacity:0;}
.cl-refresh{border:1px solid var(--m-border);background:var(--m-card);
  color:var(--m-ink-2);width:34px;height:34px;border-radius:50%;cursor:pointer;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  transition:all var(--cl-t) var(--cl-ease);}
.cl-refresh:hover{border-color:var(--m-border-hi);color:var(--m-ink);
  transform:rotate(90deg);}
.cl-refresh:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

/* Sub-filters live one level below the main chips, so they read as a
   refinement of Mine rather than a fourth peer filter. Hidden entirely
   unless Mine is selected — an empty row of dead controls is worse than
   no row at all. */
.cl-subbar{display:none;align-items:center;gap:6px;
  padding:9px 18px;border-bottom:1px solid var(--m-border);
  background:var(--m-card-2);}
.cl-subbar.on{display:flex;}
.cl-sub-lbl{font-size:10.5px;font-weight:700;letter-spacing:.07em;
  text-transform:uppercase;color:var(--m-ink-3);margin-right:2px;}
.cl-sub{border:1px solid transparent;background:transparent;color:var(--m-ink-2);
  font-family:inherit;font-size:12px;font-weight:600;padding:5px 11px;
  border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;
  gap:6px;transition:all var(--cl-t) var(--cl-ease);}
.cl-sub:hover{background:var(--m-card);color:var(--m-ink);}
.cl-sub-on,.cl-sub-on:hover{background:var(--m-card);color:var(--m-ink);
  border-color:var(--m-border);box-shadow:var(--m-sh-1);}
.cl-sub:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

.cl-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  padding:14px 18px 24px;}
.cl-list{display:flex;flex-direction:column;gap:6px;}

/* Day separator — gives the feed rhythm and makes time scannable
   without spending a column on it. */
.cl-day{display:flex;align-items:center;gap:10px;margin:14px 0 6px;}
.cl-day:first-child{margin-top:0;}
.cl-day span{font-size:10.5px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;color:var(--m-ink-3);flex-shrink:0;}
.cl-day::after{content:'';flex:1;height:1px;background:var(--m-border);}

/* ══════ CARD ══════
   Layered: hairline border, gentle gradient, and a coloured left rail
   for anything still waiting. Lifts and warms on hover. */
.cl-card{position:relative;display:flex;align-items:flex-start;gap:12px;
  padding:13px 14px 13px 16px;border-radius:14px;
  background:linear-gradient(160deg,var(--m-card),
    color-mix(in srgb,var(--m-card) 88%,var(--m-canvas)));
  border:1px solid var(--m-border);
  transition:border-color var(--cl-t) var(--cl-ease),
             box-shadow var(--cl-t) var(--cl-ease),
             transform var(--cl-t) var(--cl-ease);}
.cl-card::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;
  border-radius:0 3px 3px 0;background:var(--amber);opacity:0;
  transition:opacity var(--cl-t) var(--cl-ease);}
.cl-card:not(.done)::before{opacity:1;}
.cl-card:hover{border-color:var(--accent-bd);box-shadow:var(--m-sh-2);
  transform:translateY(-1px);}
.cl-card.done{background:var(--m-card);}
.cl-card.done .cl-nm{color:var(--m-ink-2);font-weight:600;}

.cl-card-main{display:flex;align-items:flex-start;gap:11px;flex:1;min-width:0;}
.cl-ava{width:34px;height:34px;border-radius:11px;display:flex;align-items:center;
  justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;line-height:1;
  color:hsl(var(--h),46%,32%);
  background:linear-gradient(145deg,hsl(var(--h),58%,93%),hsl(var(--h),52%,87%));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.5);letter-spacing:.02em;}
.cl-card-body{flex:1;min-width:0;}

.cl-line1{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:5px;}
.cl-nm{font-size:14.5px;font-weight:700;color:var(--m-ink);letter-spacing:-.012em;}
.cl-att{font-size:10px;font-weight:700;font-variant-numeric:tabular-nums;
  color:var(--amber);background:var(--amber-bg);border:1px solid var(--amber-bd);
  padding:1px 6px;border-radius:5px;}
/* When the badge doubles as the day-group expander it's a real button. */
.cl-att-btn{font-family:inherit;cursor:pointer;display:inline-flex;
  align-items:center;gap:3px;line-height:1.5;
  transition:background var(--cl-t),transform var(--cl-t);}
.cl-att-btn:hover{transform:translateY(-1px);filter:brightness(.97);}
.cl-att-ch{transition:transform var(--cl-t) var(--cl-ease);opacity:.75;}
.cl-att-btn.on .cl-att-ch{transform:rotate(180deg);}
/* Earlier same-day attempts, hidden until the ×N badge is clicked. */
.cl-stack{display:none;flex-direction:column;gap:5px;margin-top:9px;
  padding-top:9px;border-top:1px dashed var(--m-border);}
.cl-stack.on{display:flex;}
.cl-stack-row{display:flex;align-items:center;gap:8px;font-size:12px;
  flex-wrap:wrap;min-width:0;}
.cl-stack-t{font-variant-numeric:tabular-nums;font-weight:700;
  color:var(--m-ink-2);flex-shrink:0;}
.cl-stack-by{color:var(--m-ink-2);font-weight:600;flex-shrink:0;}
.cl-stack-rs{color:var(--m-ink-3);}
.cl-stack-note{color:var(--m-ink-3);flex:1;min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
.cl-stack-row .cl-hist-pill{margin-left:auto;}

.cl-line2{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.cl-num{font-family:ui-monospace,'SF Mono','JetBrains Mono',Menlo,monospace;
  font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;
  color:var(--m-ink-2);background:var(--m-card-2);border:1px solid var(--m-border);
  padding:3px 8px;border-radius:7px;cursor:pointer;white-space:nowrap;
  letter-spacing:.01em;transition:all var(--cl-t) var(--cl-ease);}
.cl-num:hover{border-color:var(--accent);color:var(--accent-text);
  background:var(--accent-dim);}
.cl-num.copied{background:var(--accent);border-color:var(--accent);color:#fff;}
.cl-num:focus-visible{outline:2px solid var(--accent);outline-offset:1px;}
.cl-dash{font-size:12px;color:var(--m-ink-3);font-style:italic;}
.cl-tag{font-size:11.5px;font-weight:600;color:var(--m-ink-2);
  background:var(--m-card-2);border:1px solid var(--m-border);
  padding:3px 9px;border-radius:7px;white-space:nowrap;}
.cl-meta{font-size:11.5px;color:var(--m-ink-3);white-space:nowrap;}

/* The note is the point of taking one — it reads inline, no click. */
.cl-note{font-size:12.5px;line-height:1.5;color:var(--m-ink-2);margin:7px 0 0;
  padding:8px 11px;border-radius:9px;background:var(--m-card-2);
  border-left:2px solid var(--m-border-hi);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;transition:all var(--cl-t) var(--cl-ease);}
.cl-card:hover .cl-note{-webkit-line-clamp:8;border-left-color:var(--accent);}

/* ── AGE TIERS ──
   A callback waiting three days looked identical to one from an hour ago,
   which is how a queue gets filled but never worked. The left rail deepens
   amber → red as it ages, and anything past a day carries an explicit
   "waiting 2d" badge. Colour alone isn't the signal — the badge text is,
   so this still reads for colour-blind staff and in greyscale. */
.cl-card.cl-age-fresh::before{background:var(--amber);opacity:.55;}
.cl-card.cl-age-today::before{background:var(--amber);}
.cl-card.cl-age-aging::before{background:#ea580c;}
.cl-card.cl-age-stale::before{background:#dc2626;}
.cl-card.cl-age-cold::before{background:#b91c1c;width:4px;}

.cl-card.cl-age-stale{border-color:rgba(220,38,38,.28);}
.cl-card.cl-age-cold{border-color:rgba(185,28,28,.42);
  background:linear-gradient(160deg,var(--m-card),rgba(220,38,38,.045));}

.cl-wait-age{font-size:10px;font-weight:700;letter-spacing:.03em;
  padding:2px 7px;border-radius:5px;white-space:nowrap;text-transform:lowercase;}
.cl-wait-aging{color:#c2410c;background:rgba(234,88,12,.11);
  border:1px solid rgba(234,88,12,.24);}
.cl-wait-stale{color:#dc2626;background:rgba(220,38,38,.1);
  border:1px solid rgba(220,38,38,.24);}
.cl-wait-cold{color:#fff;background:#dc2626;border:1px solid #b91c1c;}

.cl-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;
  font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;
  letter-spacing:.02em;vertical-align:middle;}
.cl-pill.wait{color:var(--amber);background:var(--amber-bg);
  box-shadow:inset 0 0 0 1px var(--amber-bd);}
.cl-pill.ok{color:var(--m-ink-3);background:var(--m-card-2);
  box-shadow:inset 0 0 0 1px var(--m-border);}
.cl-pill.back{color:#047857;background:rgba(16,185,129,.1);
  box-shadow:inset 0 0 0 1px rgba(16,185,129,.2);}
.cl-pip{width:5px;height:5px;border-radius:50%;background:currentColor;
  flex-shrink:0;animation:clPulse 2.4s ease-in-out infinite;}
@keyframes clPulse{0%,100%{opacity:1;}50%{opacity:.35;}}

.cl-help{font-size:10px;font-weight:700;letter-spacing:.03em;color:#047857;
  background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);
  padding:2px 7px;border-radius:5px;white-space:nowrap;}
.cl-team-x{font-size:10px;font-weight:700;color:var(--accent-text);
  background:var(--accent-dim);border:1px solid var(--accent-bd);
  padding:2px 7px;border-radius:5px;white-space:nowrap;}

/* Actions rest as a quiet icon and expand on hover — the list stays calm
   until you reach for it. */
.cl-card-act{display:flex;align-items:center;gap:5px;flex-shrink:0;}
.cl-act{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  height:32px;width:32px;padding:0;border-radius:10px;cursor:pointer;flex-shrink:0;
  border:1px solid var(--m-border);background:var(--m-card-2);color:var(--m-ink-2);
  font-family:inherit;font-size:12px;font-weight:600;
  transition:border-color var(--cl-t) var(--cl-ease),
             color var(--cl-t) var(--cl-ease),
             background var(--cl-t) var(--cl-ease);}
.cl-act:hover{border-color:var(--m-border-hi);color:var(--m-ink);}
.cl-act:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

/* Relog is always a full labelled button — no hover-expand. The animated
   width transition looked laboured on lower-end laptops, and a static
   button is clearer anyway: you can see the primary action at rest. */
.cl-act-relog{width:auto;padding:0 13px 0 11px;border-color:transparent;color:#fff;
  background:var(--accent);}
.cl-act-relog:hover{border-color:transparent;color:#fff;
  background:color-mix(in srgb,var(--accent) 88%,#000);}
.cl-act-relog:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

/* Edit and Remove are conditional: edit shows only inside your own
   15-minute window, remove only for admins. Both stay quiet at rest and
   pick up their colour on hover, so they never compete with Relog. */
.cl-act-edit:hover{border-color:var(--accent);color:var(--accent-text);
  background:var(--accent-dim);}
.cl-act-del:hover{border-color:#dc2626;color:#dc2626;
  background:rgba(220,38,38,.08);}
.cl-act-del:focus-visible{outline-color:#dc2626;}

.cl-empty{text-align:center;padding:56px 20px;}
.cl-empty-mark{width:52px;height:52px;border-radius:16px;margin:0 auto 14px;
  display:flex;align-items:center;justify-content:center;
  background:var(--m-card);border:1px solid var(--m-border);
  color:var(--m-ink-3);box-shadow:var(--m-sh-1);}
.cl-empty-t{font-size:13.5px;color:var(--m-ink-3);font-weight:500;}

/* ══════ SKELETON ══════ */
.cl-skel{display:flex;align-items:flex-start;gap:11px;padding:13px 14px 13px 16px;
  border-radius:14px;background:var(--m-card);border:1px solid var(--m-border);
  margin-bottom:6px;}
.cl-skel-bar{display:inline-block;border-radius:6px;
  background:linear-gradient(90deg,var(--m-card-2) 0%,var(--m-border) 40%,
    var(--m-border) 60%,var(--m-card-2) 100%);
  background-size:220% 100%;animation:clShimmer 1.2s ease-in-out infinite;}
@keyframes clShimmer{0%{background-position:130% 0;}100%{background-position:-130% 0;}}
.cl-skel-ava{width:34px;height:34px;border-radius:11px;flex-shrink:0;}
.cl-skel-body{flex:1;display:flex;flex-direction:column;gap:7px;}
.cl-skel:nth-child(2) .cl-skel-bar{animation-delay:.08s;}
.cl-skel:nth-child(3) .cl-skel-bar{animation-delay:.16s;}
.cl-skel:nth-child(4) .cl-skel-bar{animation-delay:.24s;}
.cl-skel:nth-child(5) .cl-skel-bar{animation-delay:.32s;}
.cl-skel:nth-child(6) .cl-skel-bar{animation-delay:.40s;}

@supports not (background:color-mix(in srgb,red 50%,transparent)){
  .cl-ribbon{background:var(--m-card);}
  .cl-mark,.cl-btn-go,.cl-chip-on{background:var(--accent);}
  .cl-card{background:var(--m-card);}
}

/* ══════════════ RESPONSIVE ══════════════
   Three self-contained layouts. Wider rules are undone explicitly rather
   than left to leak downward.
     >1080  pinned console, rail + queue side by side
     680–1080  stacked, page scrolls
     <680   stacked, compact cards
   ─────────────────────────────────────────────────────── */
@media(max-width:1080px){
  #page-calllog.active{position:static;overflow:visible;min-height:100%;}
  .main:has(#page-calllog.active),
  .main.cl-fixed{overflow-y:auto;}
  .cl-console{height:auto;min-height:100%;}
  .cl-body{grid-template-columns:1fr;grid-template-rows:auto auto;}
  .cl-pane-form{border-right:none;border-bottom:1px solid var(--m-border);
    overflow:visible;max-height:none;}
  .cl-pane-form::after{display:none;}
  .cl-actions{margin-top:0;padding-top:14px;}
  .cl-scroll{overflow:visible;}
  .cl-ribbon{height:auto;padding:12px 16px;flex-wrap:wrap;gap:14px;}
  .cl-rb-stats{order:3;width:100%;}
  .cl-note{-webkit-line-clamp:4;}
}

@media(max-width:680px){
  .cl-scroll{padding:12px;}
  .cl-card{flex-direction:column;gap:10px;padding:12px 12px 12px 15px;}
  .cl-card-act{width:100%;justify-content:flex-start;
    padding-top:10px;border-top:1px solid var(--m-border);}
  .cl-act-relog{flex:1;}
  .cl-line1,.cl-line2{gap:6px;}
  .cl-nm{font-size:14px;}
  .cl-search{width:100%;}
  .cl-search:focus{width:100%;}
  .cl-search-wrap{flex:1;}
  .cl-bar-right{width:100%;flex-wrap:wrap;}
  .cl-daterange{width:100%;justify-content:space-between;min-height:40px;}
  .cl-date{flex:1;width:auto;min-width:0;}
  .cl-filters{width:100%;}
  .cl-chip{flex:1;justify-content:center;min-height:40px;}
  .cl-subbar{padding:8px 12px;flex-wrap:wrap;}
  .cl-sub{flex:1;justify-content:center;min-height:36px;}
  .cl-sub-lbl{width:100%;margin-bottom:2px;}
  .cl-in{min-height:42px;}
  .cl-stat{padding:4px 6px;}
  .cl-stat-n{font-size:19px;}
}

@media(prefers-reduced-motion:reduce){
  .cl-pip,.cl-skel-bar{animation:none;}
  .cl-card:hover,.cl-chip:hover,.cl-btn-go:hover,.cl-quick button:hover{transform:none;}
  .cl-refresh:hover{transform:none;}
  .cl-sc-glide{transition:none;}
}

/* ── Caller history card (form pane) ── */
.cl-hist{margin-top:8px;border:1px solid var(--m-border);border-radius:10px;
  background:var(--m-surface,#fff);overflow:hidden;}
.cl-hist-t{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:var(--m-mut,#8a8f98);padding:8px 11px 6px;border-bottom:1px solid var(--m-border);}
.cl-hist-row{display:flex;align-items:center;gap:9px;padding:7px 11px;
  border-bottom:1px solid var(--m-border);font-size:12px;}
.cl-hist-row:last-child{border-bottom:none;}
.cl-hist-row.open{background:color-mix(in srgb, var(--m-accent,#ff6b47) 5%, transparent);}
.cl-hist-l{display:flex;flex-direction:column;gap:1px;min-width:74px;flex-shrink:0;}
.cl-hist-day{font-weight:700;color:var(--m-ink,#1a1d21);font-size:12px;}
.cl-hist-att{font-size:10.5px;font-weight:700;color:var(--m-accent,#ff6b47);}
.cl-hist-m{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.cl-hist-nm{font-weight:600;color:var(--m-ink,#1a1d21);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cl-hist-rs{color:var(--m-mut,#6b7280);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cl-hist-by{font-size:10.5px;color:var(--m-mut,#9ca3af);}
.cl-hist-pill{flex-shrink:0;font-size:10px;font-weight:700;letter-spacing:.04em;
  padding:3px 8px;border-radius:999px;text-transform:uppercase;}
.cl-hist-pill.wait{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;}
.cl-hist-pill.done{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;}

/* Waiting view toggle bar reuses subbar chrome; hidden unless Waiting tab on */
#clWaitViewBar{display:none;}
#clWaitViewBar.on{display:flex;}
`;
  const CL_HTML = `      <div class="cl-console">

        <!-- ── COMMAND BAR ── -->
        <header class="cl-ribbon">
          <div class="cl-rb-brand">
            <span class="cl-mark" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
            </span>
            <div class="cl-rb-txt">
              <span class="cl-rb-title">Call Log</span>
              <span class="cl-rb-sub" id="clScopeLbl">my team</span>
            </div>
          </div>

          <div class="cl-rb-stats">
            <button class="cl-stat" id="clStatToday" onclick="clSetFilter('done')">
              <span class="cl-stat-n" id="clStToday">0</span>
              <span class="cl-stat-l">today</span>
            </button>
            <span class="cl-rule" aria-hidden="true"></span>
            <button class="cl-stat cl-stat-alert" id="clStWaitWrap" onclick="clSetFilter('open')">
              <span class="cl-stat-n" id="clStWait">0</span>
              <span class="cl-stat-l">waiting</span>
            </button>
            <span class="cl-rule" aria-hidden="true"></span>
            <button class="cl-stat" id="clStatMine" onclick="clSetFilter('mine')">
              <span class="cl-stat-n" id="clStMine">0</span>
              <span class="cl-stat-l">mine</span>
            </button>
          </div>

          <div class="cl-rb-right">
            <div class="cl-rb-scope" role="group" aria-label="Scope">
              <span class="cl-sc-glide" id="clScGlide" aria-hidden="true"></span>
              <button class="cl-sc cl-sc-on" id="clScTeam" onclick="clSetScope('team')">
                <span id="clScTeamLbl">My team</span>
              </button>
              <button class="cl-sc" id="clScAll" onclick="clSetScope('all')">Everyone</button>
            </div>
          </div>
        </header>

        <!-- ── SPLIT BODY ── -->
        <div class="cl-body">

          <!-- LEFT · capture -->
          <aside class="cl-pane-form" id="clPaneForm">
            <div class="cl-form-hd">
              <h3 class="cl-form-title">New call</h3>
              <span class="cl-keyhint"><kbd>⌥</kbd><kbd>S</kbd></span>
            </div>

            <div class="cl-field">
              <label class="cl-label" for="clName">Caller <span class="cl-req">*</span></label>
              <input id="clName" class="cl-in" type="text" placeholder="Who called?" autocomplete="off" />
            </div>

            <div class="cl-field">
              <label class="cl-label" for="clPhone">Number <span class="cl-req">*</span></label>
              <div class="cl-in-wrap">
                <span class="cl-in-pre">+61</span>
                <input id="clPhone" class="cl-in cl-in-tel" type="tel" placeholder="0412 345 678" autocomplete="off" />
              </div>
              <div class="cl-hint" id="clPhoneHint"></div>
              <div class="cl-hist" id="clHist" style="display:none;"></div>
            </div>

            <div class="cl-field">
              <label class="cl-label" for="clReason">Reason <span class="cl-req">*</span></label>
              <input id="clReason" class="cl-in" type="text" placeholder="What was it about?" autocomplete="off" list="clReasonList" />
              <datalist id="clReasonList">
                <option value="New enquiry"></option>
                <option value="Checklist / documents"></option>
                <option value="Class booking"></option>
                <option value="Placement"></option>
                <option value="Certificate"></option>
                <option value="Payment"></option>
                <option value="First Aid / CPR"></option>
                <option value="Education / migration"></option>
                <option value="Follow-up"></option>
                <option value="Other"></option>
              </datalist>
              <div class="cl-quick" id="clQuick">
                <button type="button" onclick="clQuickReason('New enquiry')">New enquiry</button>
                <button type="button" onclick="clQuickReason('Certificate')">Certificate</button>
                <button type="button" onclick="clQuickReason('Placement')">Placement</button>
                <button type="button" onclick="clQuickReason('Payment')">Payment</button>
              </div>
            </div>

            <div class="cl-field" id="clForField">
              <label class="cl-label" for="clForTeam">Handled by</label>
              <select id="clForTeam" class="cl-in">
                <option value="">My team</option>
                <option value="Enrolment">Enrolment</option>
                <option value="Processing">Processing</option>
                <option value="Placement">Placement</option>
                <option value="Education">Education</option>
                <option value="Accounts">Accounts</option>
                <option value="Evershine">Evershine</option>
              </select>
              <div class="cl-hint" id="clForHint"></div>
            </div>

            <div class="cl-field">
              <label class="cl-label" for="clNote">Note</label>
              <textarea id="clNote" class="cl-in" maxlength="600" placeholder="Any extra detail"></textarea>
            </div>

            <label class="cl-check" id="clCbWrap" for="clCallback">
              <input type="checkbox" id="clCallback" />
              <span class="cl-check-box" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              </span>
              <span class="cl-check-text">
                <span class="cl-check-main">Needs a call back</span>
                <span class="cl-check-sub">Couldn't reach them</span>
              </span>
            </label>

            <div class="cl-actions">
              <button class="cl-btn-ghost" type="button" onclick="clClearForm()">Clear</button>
              <button class="cl-btn-go" id="clSave" type="button" onclick="clSaveCall()">Log call</button>
            </div>
          </aside>

          <!-- RIGHT · queue -->
          <section class="cl-pane-queue">
            <div class="cl-qbar">
              <div class="cl-filters" role="group" aria-label="Filter">
                <button class="cl-chip cl-chip-on" id="clFiltOpen" onclick="clSetFilter('open')">
                  Waiting <span class="cl-cnt" id="clCntOpen">0</span>
                </button>
                <button class="cl-chip" id="clFiltMine" onclick="clSetFilter('mine')">
                  Mine <span class="cl-cnt" id="clCntMine">0</span>
                </button>
                <button class="cl-chip" id="clFiltDone" onclick="clSetFilter('done')">
                  All <span class="cl-cnt" id="clCntAll">0</span>
                </button>
              </div>
              <div class="cl-bar-right">
                <button class="cl-chip" id="clChipToday" onclick="clToggleToday()" title="Show only today's calls">Today</button>
                <button class="cl-chip cl-chip-ico" id="clDateBtn" onclick="clToggleDatePicker()" title="Filter by date range" aria-label="Toggle date range filter">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
                </button>
                <div class="cl-daterange" id="clDateRange" role="group" aria-label="Date range">
                  <input type="date" id="clFrom" class="cl-date" aria-label="From date" onchange="clSetDateRange()" />
                  <span class="cl-date-dash">–</span>
                  <input type="date" id="clTo" class="cl-date" aria-label="To date" onchange="clSetDateRange()" />
                  <button class="cl-date-clear" id="clDateClear" onclick="clClearDateRange()" title="Clear date range" aria-label="Clear date range" style="display:none;">
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8.586 5.05 3.636 3.636 5.05 8.586 10l-4.95 4.95 1.414 1.414L10 11.414l4.95 4.95 1.414-1.414L11.414 10l4.95-4.95L14.95 3.636 10 8.586z"/></svg>
                  </button>
                </div>
                <div class="cl-search-wrap">
                  <svg class="cl-search-ico" width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
                  <input id="clSearch" class="cl-search" type="search" placeholder="Search" autocomplete="off" />
                  <kbd class="cl-search-kbd">/</kbd>
                </div>
                <button class="cl-refresh" onclick="clLoadQueue()" title="Refresh" aria-label="Refresh">
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
                </button>
              </div>
            </div>

            <div class="cl-subbar" id="clSubBar">
              <span class="cl-sub-lbl">Show</span>
              <button class="cl-sub cl-sub-on" id="clSubAll" onclick="clSetSub('all')">
                All <span class="cl-cnt" id="clSubCntAll">0</span>
              </button>
              <button class="cl-sub" id="clSubWaiting" onclick="clSetSub('waiting')">
                Waiting <span class="cl-cnt" id="clSubCntWaiting">0</span>
              </button>
              <button class="cl-sub" id="clSubHandled" onclick="clSetSub('handled')">
                Handled <span class="cl-cnt" id="clSubCntHandled">0</span>
              </button>
            </div>
            <div class="cl-subbar" id="clWaitViewBar">
              <span class="cl-sub-lbl">Group by</span>
              <button class="cl-sub cl-sub-on" id="clWvWeek" onclick="clSetWaitView('week')">Weeks</button>
              <button class="cl-sub" id="clWvDay" onclick="clSetWaitView('day')">Days</button>
            </div>

            <div class="cl-scroll">
              <div id="clQueueBody" class="cl-list"></div>
              <div id="clQueueEmpty"></div>
            </div>
          </section>

        </div>
      </div>`;
  function mount(){
    if(!document.getElementById('dialtrac-css')){
      const st=document.createElement('style');
      st.id='dialtrac-css';
      st.textContent=CL_CSS;
      document.head.appendChild(st);
    }
    const page=document.getElementById('page-calllog');
    if(page && !page.dataset.dtMounted){
      page.innerHTML=CL_HTML;
      page.dataset.dtMounted='1';
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();

/* ══════════════════ CALL LOG ══════════════════
   Writes to public.call_log. Append-only: every call is a new row,
   nothing is overwritten, so a caller's full history stays intact.
   Resolving a row stamps resolved_at/resolved_by rather than deleting.
   ─────────────────────────────────────────────── */
/* ── Permissions ──────────────────────────────────────────────────
   Nobody hard-deletes from the UI. A log whose rows can disappear stops
   being a record — "no entry means no call" has to stay true, and a
   deleted row that was still waiting means a caller is silently dropped.

   Instead: you may correct your own row for a short window (typos happen
   immediately, not three days later), and an admin may soft-delete junk,
   which hides it everywhere but keeps it recoverable.
   ───────────────────────────────────────────────────────────────── */
const CL_EDIT_WINDOW_MS = 15 * 60 * 1000;   // 15 minutes

function clIsAdmin(){
  return !!(typeof myIsAdmin !== 'undefined' && myIsAdmin);
}
function clCanEdit(r){
  if(!r || r.deleted_at) return false;
  const mine = r.logged_by === (window.me || me);
  if(!mine) return false;
  return (Date.now() - new Date(r.created_at).getTime()) < CL_EDIT_WINDOW_MS;
}
function clCanDelete(r){
  return !!r && !r.deleted_at && clIsAdmin();
}
/** Minutes left in the edit window, for the button tooltip. */
function clEditLeft(r){
  const ms = CL_EDIT_WINDOW_MS - (Date.now() - new Date(r.created_at).getTime());
  return Math.max(0, Math.ceil(ms/60000));
}

let _clSession = [];
let _clQueue = [];
let _clFilter = 'open';
let _clToday  = false;   // "Today" quick filter — Sydney calendar day
let _clWaitView = 'week'; // Waiting tab grouping: 'week' (default) | 'day'
let _clSub    = 'all';   // within Mine: all | waiting | handled
let _clScope = 'team';   // 'team' = my team's calls only, 'all' = everyone
// How far back the queue loads when no date range is chosen. Raise if you
// routinely look further back without setting a range.
const CL_RECENT_DAYS = 60;
let _clFrom = null;      // date-range filter, inclusive local-day bounds (ms) or null
let _clTo   = null;

/**
 * The rows in scope. Everything downstream — table, chips, ribbon — reads
 * this rather than _clQueue directly, so the two scopes stay consistent.
 */
function clScoped(){
  // Soft-deleted rows are excluded from every view and every count. They
  // stay in _clQueue so a restore doesn't need a refetch.
  const live = _clQueue.filter(r => !r.deleted_at);
  if(_clScope === 'all') return live;
  const t = (typeof myTeam !== 'undefined' && myTeam) ? myTeam : null;
  if(!t) return live;               // team unknown — don't hide everything
  // Scope on for_team, not team: what matters is which team has to deal
  // with the call, not which team happened to answer the phone.
  return live.filter(r => (r.for_team || r.team) === t);
}

/**
 * Placeholder rows shown while a scope switch settles. Column widths match
 * the real table so nothing shifts when the data lands. Bar widths vary a
 * little so it reads as content rather than a progress bar.
 */
function clSkeleton(n){
  let out='';
  for(let i=0;i<n;i++){
    const w1=88+((i*23)%54), w2=132+((i*31)%70);
    out += '<div class="cl-skel">'+
      '<span class="cl-skel-bar cl-skel-ava"></span>'+
      '<div class="cl-skel-body">'+
        '<span class="cl-skel-bar" style="height:13px;width:'+w1+'px;"></span>'+
        '<span class="cl-skel-bar" style="height:11px;width:'+w2+'px;"></span>'+
      '</div>'+
      '<span class="cl-skel-bar" style="height:32px;width:32px;border-radius:10px;"></span>'+
    '</div>';
  }
  return out;
}

/**
 * Switch scope. The table and the ribbon figures both change wholesale, so
 * both go to skeletons — dimming the old data would read as "disabled"
 * rather than "loading", and a blurred number still looks like a number.
 */
function clSetScope(s){
  if(_clScope === s) return;
  _clScope = s;
  document.getElementById('clScTeam').classList.toggle('cl-sc-on', s==='team');
  document.getElementById('clScAll').classList.toggle('cl-sc-on', s==='all');
  const seg=document.querySelector('.cl-rb-scope');
  if(seg) seg.classList.toggle('at-all', s==='all');
  const sub=document.getElementById('clScopeLbl');
  if(sub) sub.textContent = s==='all' ? 'everyone'
        : ((typeof myTeam!=='undefined' && myTeam) ? myTeam.toLowerCase() : 'my team');

  const body=document.getElementById('clQueueBody');
  const empty=document.getElementById('clQueueEmpty');
  // Roughly as many skeleton rows as the scope is likely to return, capped
  // so the pane doesn't fill with placeholders on a big switch.
  const likely = (s==='all' ? _clQueue.length
                : _clQueue.filter(r=>r.team===myTeam).length) || 3;
  if(body) body.innerHTML = clSkeleton(Math.max(3, Math.min(8, likely)));
  if(empty) empty.innerHTML='';
  ['clStToday','clStWait','clStMine','clStAll'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.innerHTML='<span class="cl-skel-bar"></span>';
  });

  setTimeout(()=>{
    clRenderQueue();
    clRefreshOpenCount();
  }, 620);
}

// Normalise to E.164 so one caller is one key, not four spellings.
/**
 * Australian numbers only: 0 followed by exactly 9 digits.
 * Returns E.164 (+61…) when valid, null when not — so a junk entry can
 * never reach the table. Accepts the usual spellings on the way in:
 * 0412345678, 0412 345 678, (02) 9876 5432, +61412345678, 61412345678.
 */
function clToE164(raw){
  let d = String(raw||'').replace(/\D/g,'');
  if(!d) return null;
  // Strip country code so everything is compared in national form.
  if(d.length===11 && d.slice(0,2)==='61') d = '0'+d.slice(2);
  else if(d.length===10 && d.slice(0,2)==='61') d = '0'+d.slice(2);
  else if(d.length===9 && d[0]!=='0') d = '0'+d;   // leading zero omitted
  if(!/^0\d{9}$/.test(d)) return null;      // 0 + exactly 9 digits
  return '+61'+d.slice(1);
}
/** Why a number was rejected, for the hint under the field. */
function clPhoneProblem(raw){
  const d = String(raw||'').replace(/\D/g,'');
  if(!d) return 'Required';
  const n = (d.length===11 && d.slice(0,2)==='61') ? '0'+d.slice(2)
          : (d.length===9 && d[0]!=='0') ? '0'+d : d;
  if(n[0] !== '0')       return 'Must start with 0';
  if(n.length < 10)      return 'Too short — needs 0 plus 9 digits ('+(10-n.length)+' more)';
  if(n.length > 10)      return 'Too long — needs 0 plus 9 digits';
  return 'Not a valid number';
}
function clFmtPhone(e164){
  if(!e164) return '';
  if(/^\+614\d{8}$/.test(e164)) return '0'+e164.slice(3,6)+' '+e164.slice(6,9)+' '+e164.slice(9);
  if(/^\+612\d{8}$/.test(e164)) return '(0'+e164.slice(3,4)+') '+e164.slice(4,8)+' '+e164.slice(8);
  return e164;
}
function clEsc(s){
  return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
/**
 * How stale a waiting callback is. Returns a tier the card styles against —
 * a three-day-old callback and an hour-old one currently look identical,
 * which is why the queue gets logged but not worked.
 *   fresh  <  4h
 *   today  <  24h
 *   aging  1–2 days
 *   stale  2–4 days
 *   cold   4+ days
 */
function clAgeTier(iso){
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if(h < 4)  return 'fresh';
  if(h < 24) return 'today';
  if(h < 48) return 'aging';
  if(h < 96) return 'stale';
  return 'cold';
}
/** Plain-language wait, for the badge on stale rows. */
function clWaitLabel(iso){
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if(h < 24) return Math.max(1, Math.floor(h)) + 'h';
  return Math.floor(h / 24) + 'd';
}

/** A gap in ms as a short human duration, for "rung back 3d later". */
function clDur(ms){
  const m = Math.round(ms/60000);
  if(m < 60)   return m+'m';
  const h = Math.round(m/60);
  if(h < 24)   return h+'h';
  return Math.round(h/24)+'d';
}

function clAgo(iso){
  const then=new Date(iso), diff=(Date.now()-then.getTime())/1000;
  if(diff<60) return 'just now';
  if(diff<3600) return Math.floor(diff/60)+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago';
  const d=Math.floor(diff/86400);
  if(d===1) return 'yesterday';
  if(d<7) return d+'d ago';
  return then.toLocaleDateString('en-AU',{day:'numeric',month:'short'});
}

function clClearForm(){
  ['clName','clPhone','clReason','clNote'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.value=''; el.classList.remove('error'); }
  });
  document.querySelectorAll('#clQuick button').forEach(b=>b.classList.remove('on'));
  const ft=document.getElementById('clForTeam');
  if(ft) ft.value='';
  const fh=document.getElementById('clForHint');
  if(fh){ fh.textContent=''; fh.classList.remove('cl-hint-warn'); }
  const cb=document.getElementById('clCallback');
  if(cb) cb.checked=false;
  const w=document.getElementById('clCbWrap');
  if(w) w.classList.remove('on');
  const h=document.getElementById('clPhoneHint');
  if(h){ h.textContent=''; h.classList.remove('cl-hint-warn'); }
  clHistLookup(null);
  const n=document.getElementById('clName');
  if(n) n.focus();
}

async function clSaveCall(){
  const nameEl=document.getElementById('clName');
  const reasonEl=document.getElementById('clReason');
  const name=(nameEl.value||'').trim();
  const reason=(reasonEl.value||'').trim();
  const phone=clToE164(document.getElementById('clPhone').value);
  const note=(document.getElementById('clNote').value||'').trim();

  let bad=false;
  nameEl.classList.toggle('error', !name);   if(!name) bad=true;
  reasonEl.classList.toggle('error', !reason); if(!reason) bad=true;
  if(bad){ showToast('Name and reason are required','error'); return; }

  const cbEl = document.getElementById('clCallback');
  const needsCallback = !!(cbEl && cbEl.checked);
  const who = (window.me || me || 'Unknown');

  // The number is the key that links repeat attempts to the same caller, so a
  // call without one can't auto-resolve anything and can't be called back.
  const phoneEl = document.getElementById('clPhone');
  phoneEl.classList.toggle('error', !phone);
  if(!phone){
    showToast('Phone number is required','error');
    phoneEl.focus();
    return;
  }

  const btn=document.getElementById('clSave');
  btn.disabled=true; btn.textContent='Logging…';

  try{
    const now = new Date().toISOString();

    // ── Auto-resolve prior attempts ────────────────────────────────────
    // Any call to this number is a fresh attempt, so every row still waiting
    // on it closes and is credited to whoever made this call — including the
    // logger's own earlier attempts. If this attempt ALSO failed to reach
    // them, the new row below reopens the number, so there's never more than
    // one open row per number. Nothing is deleted: each attempt stays as its
    // own line in the log.
    let closedCount = 0;
    try{
      const open = await sbGet('call_log',
        '?select=id&phone_e164=eq.'+encodeURIComponent(phone)+
        '&resolved_at=is.null&deleted_at=is.null');
      if(open.length){
        const rc = await fetch(SB+'/rest/v1/call_log?phone_e164=eq.'+encodeURIComponent(phone)+
                               '&resolved_at=is.null&deleted_at=is.null',{
          method:'PATCH',
          headers:{'apikey':KEY,'Authorization':'Bearer '+_sbBearer(),
                   'Content-Type':'application/json','Prefer':'return=minimal'},
          body: JSON.stringify({ resolved_at: now, resolved_by: who })
        });
        if(rc.ok) closedCount = open.length;
        else console.warn('auto-resolve failed', rc.status);
      }
    }catch(e){ console.warn('auto-resolve',e); }

    // Only calls that actually need ringing back stay open. Everything else is
    // closed on the spot, so the Callbacks list is a real worklist rather than
    // a dumping ground that nobody trusts.
    const r = await sbPost('call_log', {
      caller_name: name,
      phone_e164: phone,
      reason: reason,
      note: note || null,
      logged_by: who,
      team: (typeof myTeam !== 'undefined' && myTeam) ? myTeam : null,
      for_team: (document.getElementById('clForTeam')||{}).value ||
                ((typeof myTeam !== 'undefined' && myTeam) ? myTeam : null),
      resolved_at: needsCallback ? null : now,
      resolved_by: needsCallback ? null : who
    });
    // Real status code — a failed write is visible, unlike the old
    // no-cors Sheets POST which always looked like it succeeded.
    if(!r.ok){
      const t = await r.text().catch(()=> '');
      console.warn('call_log insert failed', r.status, t);
      showToast('Could not save — call not logged','error');
      return;
    }
    let msg = needsCallback ? 'Logged — still waiting on a callback' : 'Call logged';
    if(closedCount) msg += ' · cleared '+closedCount+' earlier callback'+(closedCount>1?'s':'');
    showToast(msg,'success');
    clAddRecent({ name, phone, reason, callback: needsCallback, cleared: closedCount });
    clClearForm();
    clLoadQueue();
  }catch(e){
    console.warn('clSaveCall', e);
    showToast('Network error — call not logged','error');
  }finally{
    btn.disabled=false; btn.textContent='Log call';
  }
}

function clAddRecent(entry){
  _clSession.unshift(Object.assign({}, entry, {
    time: new Date().toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'})
  }));
  const wrap=document.getElementById('clRecentWrap');
  const list=document.getElementById('clRecentList');
  if(!wrap||!list) return;
  wrap.style.display='block';
  list.innerHTML=_clSession.slice(0,8).map(e=>{
    const meta=[clFmtPhone(e.phone), e.reason].filter(Boolean).join(' · ');
    const flag = e.callback
      ? '<span class="cl-flag">Callback</span>'
      : '';
    return '<div class="cl-row"><div class="cl-tick">'+
      '<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></div>'+
      '<div class="cl-row-body"><div class="cl-row-top">'+
      '<span class="cl-row-name">'+clEsc(e.name)+'</span>'+flag+'</div>'+
      '<div class="cl-row-meta">'+clEsc(meta)+'</div></div>'+
      '<div class="cl-row-meta">'+e.time+'</div></div>';
  }).join('');
}

/**
 * Date-range filter — applies to every tab (Waiting, Mine, All). Bounds are
 * inclusive whole local days: From is start-of-day, To is end-of-day, so a
 * single day picked in both fields captures everything logged that day.
 */
function clToggleToday(){
  _clToday=!_clToday;
  if(_clToday){
    // Mutually exclusive with the custom range — both at once is confusing.
    _clFrom=null; _clTo=null;
    const f=document.getElementById('clFrom'), t=document.getElementById('clTo');
    if(f) f.value=''; if(t) t.value='';
    const dr=document.getElementById('clDateRange');
    if(dr){ dr.classList.remove('cl-dr-active'); dr.classList.remove('show'); }
    const x=document.getElementById('clDateClear');
    if(x) x.style.display='none';
    const db=document.getElementById('clDateBtn');
    if(db) db.classList.remove('cl-chip-on');
  }
  const b=document.getElementById('clChipToday');
  if(b) b.classList.toggle('cl-chip-on', _clToday);
  clRenderQueue(); clRefreshOpenCount();
}

/** Show/hide the date-range inputs. The calendar chip stays lit while a
 *  range is active even when the inputs are tucked away again. */
function clToggleDatePicker(){
  const dr=document.getElementById('clDateRange');
  if(!dr) return;
  const on=dr.classList.toggle('show');
  const b=document.getElementById('clDateBtn');
  if(b) b.classList.toggle('cl-chip-on', on || !!(_clFrom||_clTo));
  if(on){ const f=document.getElementById('clFrom'); if(f) f.focus(); }
}

function clSetDateRange(){
  // Picking a custom range switches the Today quick-filter off.
  if(_clToday){
    _clToday=false;
    const b=document.getElementById('clChipToday');
    if(b) b.classList.remove('cl-chip-on');
  }
  const fromEl=document.getElementById('clFrom');
  const toEl=document.getElementById('clTo');
  const fv=(fromEl&&fromEl.value)||'';
  const tv=(toEl&&toEl.value)||'';
  // Guard against an inverted range — if From is after To, snap the empty/other
  // field so the picker can't silently return nothing.
  if(fv && tv && fv > tv){
    if(document.activeElement===fromEl){ toEl.value=fv; }
    else { fromEl.value=tv; }
  }
  const f=(document.getElementById('clFrom').value)||'';
  const t=(document.getElementById('clTo').value)||'';
  _clFrom = f ? new Date(f+'T00:00:00').getTime() : null;
  _clTo   = t ? new Date(t+'T23:59:59.999').getTime() : null;
  const active = !!(_clFrom || _clTo);
  const wrap=document.getElementById('clDateRange');
  if(wrap) wrap.classList.toggle('cl-dr-active', active);
  const clr=document.getElementById('clDateClear');
  if(clr) clr.style.display = active ? '' : 'none';
  const db=document.getElementById('clDateBtn');
  if(db) db.classList.toggle('cl-chip-on', active || (wrap&&wrap.classList.contains('show')));
  // Refetch — the chosen range may be older than what's currently loaded.
  clLoadQueue();
}
function clClearDateRange(){
  _clFrom=_clTo=null;
  const f=document.getElementById('clFrom'); if(f) f.value='';
  const t=document.getElementById('clTo');   if(t) t.value='';
  const wrap=document.getElementById('clDateRange');
  if(wrap){ wrap.classList.remove('cl-dr-active'); wrap.classList.remove('show'); }
  const clr=document.getElementById('clDateClear'); if(clr) clr.style.display='none';
  const db=document.getElementById('clDateBtn'); if(db) db.classList.remove('cl-chip-on');
  clLoadQueue();
  clRefreshOpenCount();
}
/** A row is in the active date window (by when the call came in). */
function clInDateRange(r){
  // "Today" quick filter trumps the range — Sydney calendar day, so late-night
  // use doesn't leak yesterday's calls in via the viewer's local timezone.
  if(_clToday) return clSydDate(r.created_at)===clSydDate(new Date().toISOString());
  if(!_clFrom && !_clTo) return true;
  const ts=new Date(r.created_at).getTime();
  if(_clFrom && ts < _clFrom) return false;
  if(_clTo && ts > _clTo) return false;
  return true;
}

function clSetFilter(f){
  _clFilter=f;
  ['clStatToday','clStWaitWrap','clStatMine'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.remove('cl-stat-sel');
  });
  const map={done:'clStatToday', open:'clStWaitWrap', mine:'clStatMine'};
  const sel=document.getElementById(map[f]); if(sel) sel.classList.add('cl-stat-sel');
  ['open','mine','done'].forEach(k=>{
    const b=document.getElementById('clFilt'+k[0].toUpperCase()+k.slice(1));
    if(b) b.classList.toggle('cl-chip-on', k===f);
  });
  // Sub-filters only make sense inside Mine, and shouldn't persist when
  // you leave it — coming back to a silently pre-filtered list is worse
  // than starting from everything.
  if(f!=='mine') _clSub='all';
  const sub=document.getElementById('clSubBar');
  if(sub) sub.classList.toggle('on', f==='mine');
  const wv=document.getElementById('clWaitViewBar');
  if(wv) wv.classList.toggle('on', f==='open');
  clSyncSub();
  clRenderQueue();
}

/** Waiting tab grouping: calendar weeks (default) or individual days. */
function clSetWaitView(v){
  _clWaitView = v==='day' ? 'day' : 'week';
  const w=document.getElementById('clWvWeek'), d=document.getElementById('clWvDay');
  if(w) w.classList.toggle('cl-sub-on', _clWaitView==='week');
  if(d) d.classList.toggle('cl-sub-on', _clWaitView==='day');
  clRenderQueue();
}

/** Narrow the Mine list. */
function clSetSub(s){
  _clSub = s;
  clSyncSub();
  clRenderQueue();
}
function clSyncSub(){
  ['all','waiting','handled'].forEach(k=>{
    const b=document.getElementById('clSub'+k[0].toUpperCase()+k.slice(1));
    if(b) b.classList.toggle('cl-sub-on', k===_clSub);
  });
}

async function clLoadQueue(){
  const empty=document.getElementById('clQueueEmpty');
  const body=document.getElementById('clQueueBody');
  // Skeletons on first load; on a refresh the existing rows stay put so the
  // table doesn't flash for what is usually a sub-second fetch.
  if(body && !(_clQueue && _clQueue.length)){
    body.innerHTML = clSkeleton(6);
    if(empty) empty.innerHTML='';
  }
  // The team scope is meaningless without knowing the team, and gateCallLog
  // may not have run yet if the page was reached directly.
  try{
    if(typeof myTeam==='undefined' || !myTeam){
      const creds=await sbGet('staff_credentials',
        '?staff_name=eq.'+encodeURIComponent(window.me||me)+'&select=team');
      if(creds.length && creds[0] && creds[0].team) myTeam=creds[0].team;
    }
  }catch(e){ console.warn('clLoadQueue team',e); }
  try{
    // The fetch now follows the DATE FILTER rather than always grabbing the
    // newest 500. With ~400 calls a week, a flat top-500 meant anything older
    // than about ten days was never loaded — so filtering to an earlier range
    // searched rows the browser didn't have and returned nothing.
    //
    // No range set → a recent window (fast, covers normal use).
    // Range set     → exactly that range from the server, however far back.
    let _q = '?select=*&order=created_at.desc';
    if(_clFrom || _clTo){
      if(_clFrom) _q += '&created_at=gte.'+new Date(_clFrom).toISOString();
      if(_clTo)   _q += '&created_at=lte.'+new Date(_clTo).toISOString();
      _q += '&limit=5000';
    }else{
      const _since = new Date(Date.now() - CL_RECENT_DAYS*86400000);
      _q += '&created_at=gte.'+_since.toISOString()+'&limit=5000';
    }
    _clQueue = await sbGet('call_log', _q);
  }catch(e){
    console.warn('clLoadQueue',e);
    if(body) body.innerHTML='';
    if(empty) empty.innerHTML='<div class="cl-empty">Could not load calls.</div>';
    return;
  }
  clRenderQueue();
  clRefreshOpenCount();
}

function clRefreshOpenCount(){
  const myName = window.me || me || '';
  const rows = clScoped().filter(clInDateRange);
  const open = rows.filter(r=>!r.resolved_at).length;
  const mine = rows.filter(r=>r.logged_by===myName).length;
  const today = rows.filter(r=>
    new Date(r.created_at).toDateString()===new Date().toDateString()).length;

  const set=(id,v)=>{const el=document.getElementById(id); if(el) el.textContent=v;};

  // Sub-filter counts: the split within my own calls, so the numbers are
  // visible before you click rather than after.
  const minish  = rows.filter(r=>r.logged_by===myName);
  const mineOpen= minish.filter(r=>!r.resolved_at).length;
  set('clSubCntAll', minish.length);
  set('clSubCntWaiting', mineOpen);
  set('clSubCntHandled', minish.length - mineOpen);
  set('clStToday',today); set('clStWait',open);
  set('clStMine',mine);   set('clStAll',rows.length);
  set('clCntOpen',open);  set('clCntMine',mine); set('clCntAll',rows.length);

  // Label the scope button with the actual team name once it's known.
  const lbl=document.getElementById('clScTeamLbl');
  if(lbl && typeof myTeam!=='undefined' && myTeam) lbl.textContent=myTeam;
  const sub=document.getElementById('clScopeLbl');
  if(sub) sub.textContent = _clScope==='all' ? 'everyone'
        : ((typeof myTeam!=='undefined' && myTeam) ? myTeam.toLowerCase() : 'my team');

  // The ribbon goes amber when anything is waiting, and red once something
  // has been waiting two days or more — the state worth acting on.
  const overdue = rows.filter(r=>!r.resolved_at &&
    (Date.now()-new Date(r.created_at).getTime()) > 48*3600000).length;
  const w=document.getElementById('clStWaitWrap');
  if(w){
    w.classList.toggle('hot', open>0);
    w.classList.toggle('overdue', overdue>0);
    w.title = overdue>0
      ? overdue+' waiting more than 2 days'
      : (open>0 ? open+' waiting' : 'Nothing waiting');
  }
  const d=document.getElementById('clDot');
  if(d) d.classList.toggle('live', open>0);
}

function clInitials(name){
  const parts=String(name||'?').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  return (parts[0][0]+(parts[1]?parts[1][0]:'')).toUpperCase();
}
/**
 * The team a staff member belongs to, inferred from rows they logged.
 * call_log doesn't store the resolver's team — but anyone who resolved a
 * call has almost certainly logged one too, and that row carries it.
 */
function clTeamOf(name){
  if(!name) return '';
  if(typeof myTeam!=='undefined' && myTeam && name===(window.me||me)) return myTeam;
  const row=_clQueue.find(r=>r.logged_by===name && r.team);
  return row ? row.team : '';
}

/** Day heading for the list separators. */
function clDayLabel(iso){
  const d=new Date(iso), now=new Date();
  const sameDay=(a,b)=>a.toDateString()===b.toDateString();
  if(sameDay(d,now)) return 'Today';
  const y=new Date(now); y.setDate(y.getDate()-1);
  if(sameDay(d,y)) return 'Yesterday';
  return d.toLocaleDateString('en-AU',{weekday:'long', day:'numeric', month:'long'});
}

/** Sydney calendar date (YYYY-MM-DD) for an ISO timestamp. All day-reset
 *  logic keys off this so every viewer groups identically, regardless of
 *  their own device timezone. */
function clSydDate(iso){
  try{ return new Date(iso).toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'}); }
  catch(e){ return String(iso||'').slice(0,10); }
}
/** Monday (YYYY-MM-DD) of the Sydney calendar week containing the timestamp. */
function clWeekKey(iso){
  const p=clSydDate(iso).split('-').map(Number);
  const dt=new Date(Date.UTC(p[0],p[1]-1,p[2]));
  const dow=(dt.getUTCDay()+6)%7;            // Mon=0 … Sun=6
  dt.setUTCDate(dt.getUTCDate()-dow);
  return dt.toISOString().slice(0,10);
}
/** "This week · 28 Jul – 3 Aug" / "Last week · …" / "Week of 14 Jul". */
function clWeekLabel(monKey){
  const p=monKey.split('-').map(Number);
  const mon=new Date(Date.UTC(p[0],p[1]-1,p[2]));
  const sun=new Date(mon); sun.setUTCDate(sun.getUTCDate()+6);
  const fmt=d=>d.toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
  const range=fmt(mon)+' \u2013 '+fmt(sun);
  const thisKey=clWeekKey(new Date().toISOString());
  const lw=new Date(); lw.setDate(lw.getDate()-7);
  const lastKey=clWeekKey(lw.toISOString());
  if(monKey===thisKey) return 'This week \u00b7 '+range;
  if(monKey===lastKey) return 'Last week \u00b7 '+range;
  const yr = mon.getUTCFullYear()!==new Date().getFullYear() ? ' '+mon.getUTCFullYear() : '';
  return 'Week of '+fmt(mon)+yr;
}

/** One-tap reason, for the four that come up constantly. */
function clQuickReason(v){
  const el=document.getElementById('clReason');
  if(!el) return;
  el.value=v;
  el.classList.remove('error');
  document.querySelectorAll('#clQuick button').forEach(b=>
    b.classList.toggle('on', b.textContent.trim()===v));
  const n=document.getElementById('clNote');
  if(n) n.focus();
}

// Stable colour per person so the same caller keeps the same avatar tint.
function clHue(s){
  let h=0; s=String(s||'');
  for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0;
  return Math.abs(h)%360;
}

/**
 * Match a phone search however the person types it. A number stored as
 * +61455000111 should be found by "+61455000111", "0455000111",
 * "455000111", "0455 000 111" or a fragment like "5000111".
 *
 * Both sides are reduced to their national form — country code and
 * leading trunk zero stripped — then compared as a substring.
 */
function clPhoneMatch(stored, queryDigits){
  if(!stored || !queryDigits) return false;
  const strip = d => {
    d = String(d||'').replace(/\D/g,'');
    if(d.startsWith('61') && d.length > 9) d = d.slice(2);  // country code
    if(d.startsWith('0')) d = d.slice(1);                   // trunk zero
    return d;
  };
  const s = strip(stored);
  const q = strip(queryDigits);
  if(!s || !q) return false;
  // Also try the raw query: a fragment from the middle ("5000111") has no
  // prefix to strip and shouldn't be mangled by the rules above.
  return s.includes(q) || s.includes(String(queryDigits).replace(/\D/g,''));
}

/**
 * Correct your own row within the edit window. Only the fields people
 * mistype are editable — who logged it, when, and its resolved state are
 * not, since those are the parts that make the log evidence rather than
 * a scratchpad.
 */
async function clEditRow(id){
  const r=_clQueue.find(x=>x.id===id);
  if(!r) return;
  if(!clCanEdit(r)){
    showToast('The 15-minute edit window has passed','error');
    return;
  }
  const name=prompt('Caller name', r.caller_name);
  if(name===null) return;
  const phoneIn=prompt('Phone number', clFmtPhone(r.phone_e164)||r.phone_e164||'');
  if(phoneIn===null) return;
  const reason=prompt('Reason', r.reason);
  if(reason===null) return;
  const note=prompt('Note', r.note||'');
  if(note===null) return;

  const phone=clToE164(phoneIn);
  if(!name.trim() || !reason.trim() || !phone){
    showToast('Name, number and reason are all required','error');
    return;
  }
  try{
    const res=await fetch(SB+'/rest/v1/call_log?id=eq.'+encodeURIComponent(id),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+_sbBearer(),
               'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({caller_name:name.trim(), phone_e164:phone,
        reason:reason.trim(), note:note.trim()||null,
        edited_at:new Date().toISOString()})
    });
    if(!res.ok){ showToast('Could not save the edit','error'); return; }
    Object.assign(r,{caller_name:name.trim(), phone_e164:phone,
      reason:reason.trim(), note:note.trim()||null,
      edited_at:new Date().toISOString()});
    showToast('Call updated','success');
    clRenderQueue(); clRefreshOpenCount();
  }catch(e){ console.warn('clEditRow',e); showToast('Network error','error'); }
}

/**
 * Soft delete — admin only. Sets deleted_at rather than removing the row,
 * so a mistake is recoverable and the record stays complete. Warns first
 * if the row is still waiting, because deleting one drops a caller.
 */
async function clDeleteRow(id){
  const r=_clQueue.find(x=>x.id===id);
  if(!r) return;
  if(!clCanDelete(r)){ showToast('Only admins can remove calls','error'); return; }
  const waiting = !r.resolved_at;
  const msg = 'Remove this call from the log?\n\n'+
    r.caller_name+' · '+(clFmtPhone(r.phone_e164)||'no number')+'\n'+
    (waiting ? '\n⚠ This call is still WAITING on a callback. Removing it '+
               'means nobody will ring them back.\n' : '')+
    '\nIt stays in the database and can be restored.';
  if(!confirm(msg)) return;

  try{
    const res=await fetch(SB+'/rest/v1/call_log?id=eq.'+encodeURIComponent(id),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+_sbBearer(),
               'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({deleted_at:new Date().toISOString(),
                           deleted_by:(window.me||me||'Unknown')})
    });
    if(!res.ok){ showToast('Could not remove the call','error'); return; }
    r.deleted_at=new Date().toISOString();
    r.deleted_by=(window.me||me||'Unknown');
    clRenderQueue(); clRefreshOpenCount();
    showUndoToast
      ? showUndoToast('Call removed', ()=>clRestoreRow(id))
      : showToast('Call removed','success');
  }catch(e){ console.warn('clDeleteRow',e); showToast('Network error','error'); }
}

/** Undo a soft delete. */
async function clRestoreRow(id){
  const r=_clQueue.find(x=>x.id===id);
  if(!r) return;
  try{
    const res=await fetch(SB+'/rest/v1/call_log?id=eq.'+encodeURIComponent(id),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+_sbBearer(),
               'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({deleted_at:null, deleted_by:null})
    });
    if(!res.ok){ showToast('Could not restore','error'); return; }
    r.deleted_at=null; r.deleted_by=null;
    clRenderQueue(); clRefreshOpenCount();
    showToast('Call restored','success');
  }catch(e){ console.warn('clRestoreRow',e); showToast('Network error','error'); }
}

function clRenderQueue(){
  const body=document.getElementById('clQueueBody');
  const empty=document.getElementById('clQueueEmpty');
  if(!body) return;
  const myName = window.me || me || '';
  const scoped = clScoped().filter(clInDateRange);

  let rows;
  if(_clFilter==='open'){
    rows=scoped.filter(r=>!r.resolved_at);
  } else if(_clFilter==='mine'){
    // Everything I logged, not just what's still open — the chip says
    // "Mine", so it should mean mine. The sub-filter narrows it.
    rows=scoped.filter(r=>r.logged_by===myName);
    if(_clSub==='waiting')      rows=rows.filter(r=>!r.resolved_at);
    else if(_clSub==='handled') rows=rows.filter(r=>!!r.resolved_at);
  } else {
    rows=scoped.slice();
  }

  const q=(document.getElementById('clSearch')||{}).value||'';
  if(q.trim()){
    const t=q.trim().toLowerCase();
    const digits=t.replace(/\D/g,'');
    rows=rows.filter(r=>
      (r.caller_name||'').toLowerCase().includes(t) ||
      (r.reason||'').toLowerCase().includes(t) ||
      (r.note||'').toLowerCase().includes(t) ||
      (r.logged_by||'').toLowerCase().includes(t) ||
      (digits.length>=3 && clPhoneMatch(r.phone_e164, digits))
    );
  }

  // Newest on top everywhere — the waiting queue and the full log both read
  // most-recent-first. Sorting by created_at rather than reversing the fetch
  // order means an edited or relogged row can't jump the queue.
  rows=rows.slice().sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));

  // ── Same number + same Sydney day = ONE card ──────────────────────────
  // Grouped in the RENDER only; the DB stays append-only and every call is
  // still its own row. The newest row of each number+day is the card face;
  // that day's earlier calls stack inside it, expandable from the ×N badge.
  // The stack is built from the full queue (not the filtered rows), so in
  // the Waiting tab the face is the one open row and the stack shows the
  // day's earlier — by then resolved — attempts. Rows without a number
  // never group.
  const _gSeen=new Set();
  window._clStacks={};
  const faces=[];
  rows.forEach(r=>{
    const key=r.phone_e164 ? (r.phone_e164+'|'+clSydDate(r.created_at)) : ('solo|'+r.id);
    if(_gSeen.has(key)) return;          // stacked under an earlier (newer) face
    _gSeen.add(key);
    if(r.phone_e164){
      const day=clSydDate(r.created_at);
      window._clStacks[r.id]=_clQueue.filter(x=>
        x.id!==r.id && !x.deleted_at && x.phone_e164===r.phone_e164 &&
        clSydDate(x.created_at)===day
      ).sort((a,b)=> new Date(b.created_at)-new Date(a.created_at));
    }else window._clStacks[r.id]=[];
    faces.push(r);
  });
  rows=faces;

  if(!rows.length){
    body.innerHTML='';
    const where = _clScope==='team' && typeof myTeam!=='undefined' && myTeam ? ' in '+myTeam : '';
    const dated = !!(_clFrom || _clTo);
    const msg = q.trim() ? 'Nothing matches that search.'
              : dated ? 'Nothing in that date range.'
              : _clFilter==='done' ? 'No calls logged'+where+' yet.'
              : _clFilter==='mine'
                ? (_clSub==='waiting' ? 'None of your calls are waiting.'
                 : _clSub==='handled' ? 'None of your calls are closed yet.'
                 : 'You haven\u2019t logged any calls'+where+' yet.')
              : 'No callbacks waiting'+where+'.';
    empty.innerHTML='<div class="cl-empty">'+
      '<div class="cl-empty-mark"><svg width="26" height="26" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></div>'+
      '<div class="cl-empty-t">'+msg+'</div></div>';
    return;
  }
  empty.innerHTML='';

  // Day separators give the list a rhythm and make "when" scannable
  // without a dedicated column.
  let lastDay='';

  body.innerHTML=rows.map(r=>{
    const done=!!r.resolved_at;
    const pretty=clFmtPhone(r.phone_e164);
    // Attempts reset daily: the day-group IS the ticket, so the count is
    // simply this card's stack + its face. New Sydney day = fresh ticket.
    const stack=(window._clStacks&&window._clStacks[r.id])||[];
    const attempts=1+stack.length;
    // "Handled on the spot" = closed by the logger at log time. resolved_at is
    // stamped client-side while created_at is the DB insert default, so the two
    // can differ by 15-20s (and resolved_at can even precede created_at). A tight
    // 5s window mislabelled these as "Called back"; 60s absolute covers the skew
    // while still excluding rows that genuinely sat in the queue and were rung
    // back later.
    const onCall = done && r.resolved_by===r.logged_by &&
      Math.abs(new Date(r.resolved_at)-new Date(r.created_at)) < 60000;
    const owner = r.for_team || r.team || '';
    const helperTeam = (done && r.resolved_by && !onCall) ? clTeamOf(r.resolved_by) : '';
    const helped = !!(helperTeam && owner && helperTeam !== owner);
    const handoff = !!(r.for_team && r.team && r.for_team !== r.team);
    // A row's date is ALWAYS when the call came in (created_at). For a callback
    // that sat waiting and was later rung back, showing resolved_at instead made
    // a 3-day-old ticket read as "today" and erased how long the caller waited.
    // The resolution time is shown separately as "· rung back <duration> later".
    const stamp = r.created_at;
    // How long a called-back row waited between the call coming in and being
    // rung back. Only meaningful for genuine callbacks (not handled-on-the-spot),
    // and only worth showing once it's more than a couple of minutes.
    const backGapMs = (done && !onCall)
      ? (new Date(r.resolved_at) - new Date(r.created_at)) : 0;
    const backLabel = backGapMs > 120000 ? clDur(backGapMs) : '';

    let sep='';
    // Waiting defaults to calendar-week groups (Mon\u2013Sun, Sydney) so a
    // backlog reads as "this week / last week" instead of a wall of days.
    // The Days toggle restores per-day separators. All other tabs stay daily.
    if(_clFilter==='open' && _clWaitView==='week'){
      const wk=clWeekKey(r.created_at);
      if(wk!==lastDay){ lastDay=wk; sep='<div class="cl-day"><span>'+clWeekLabel(wk)+'</span></div>'; }
    }else{
      const day=clDayLabel(r.created_at);
      if(day!==lastDay){ lastDay=day; sep='<div class="cl-day"><span>'+day+'</span></div>'; }
    }

    const hue=clHue(r.caller_name);
    const ava='<span class="cl-ava" style="--h:'+hue+';">'+clEsc(clInitials(r.caller_name))+'</span>';

    const status = !done
      ? '<span class="cl-pill wait"><span class="cl-pip"></span>Waiting</span>'
      : onCall ? '<span class="cl-pill ok">Handled</span>'
               : '<span class="cl-pill back">Called back</span>';

    // Direct buttons, not a ⋯ menu. Both are conditional anyway, so the
    // menu only ever held one or two items and appeared or vanished per
    // row — which reads as random rather than as a consistent control.
    const canEd = clCanEdit(r), canDel = clCanDelete(r);
    const edit = canEd
      ? '<button class="cl-act cl-act-edit" aria-label="Edit" '+
        'title="Fix a mistake — '+clEditLeft(r)+' min left" '+
        'onclick="event.stopPropagation();clEditRow(\''+r.id+'\')">'+
        '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>'+
        '</button>'
      : '';
    const del = canDel
      ? '<button class="cl-act cl-act-del" aria-label="Remove" '+
        'title="Remove from the log (admin only)" '+
        'onclick="event.stopPropagation();clDeleteRow(\''+r.id+'\')">'+
        '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>'+
        '</button>'
      : '';

    // Waiting rows carry an age tier so a three-day-old callback doesn't
    // look like an hour-old one.
    const tier = done ? '' : clAgeTier(r.created_at);
    const oldish = !done && (tier==='aging' || tier==='stale' || tier==='cold');

    return sep+
    '<article class="cl-card'+(done?' done':' cl-age-'+tier)+'" id="clc-'+r.id+'">'+
      '<div class="cl-card-main">'+
        ava+
        '<div class="cl-card-body">'+
          '<div class="cl-line1">'+
            '<span class="cl-nm">'+clEsc(r.caller_name)+'</span>'+
            (attempts>1?'<button class="cl-att cl-att-btn" id="clatt-'+r.id+'" '+
              'title="'+attempts+' calls to this number today — click for earlier attempts" '+
              'onclick="event.stopPropagation();clToggleStack(\''+r.id+'\')">\u00d7'+attempts+
              '<svg class="cl-att-ch" width="9" height="9" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>'+
              '</button>':'')+
            (oldish?'<span class="cl-wait-age cl-wait-'+tier+'" title="Waiting since '+
              clEsc(new Date(r.created_at).toLocaleString('en-AU',
                {weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}))+
              '">waiting '+clWaitLabel(r.created_at)+'</span>':'')+
            status+
            (helped?'<span class="cl-help" title="Cleared by '+clEsc(r.resolved_by)+' from '+clEsc(helperTeam)+'">'+clEsc(helperTeam)+' helped</span>':'')+
            (handoff?'<span class="cl-team-x">'+clEsc(r.team)+' \u2192 '+clEsc(r.for_team)+'</span>':'')+
          '</div>'+
          '<div class="cl-line2">'+
            (pretty?'<button class="cl-num" onclick="event.stopPropagation();clCopy(this,\''+clEsc(r.phone_e164)+'\')" title="Copy">'+
              clEsc(pretty)+'</button>':'<span class="cl-dash">no number</span>')+
            '<span class="cl-tag">'+clEsc(r.reason)+'</span>'+
            '<span class="cl-meta">'+clEsc(r.logged_by.split(' ')[0])+
              (_clScope==='all' && r.team && !handoff?' · '+clEsc(r.team):'')+
              ' · '+clAgo(stamp)+
              (backLabel?' · rung back '+backLabel+' later':'')+'</span>'+
          '</div>'+
          (r.note?'<p class="cl-note">'+clEsc(r.note)+'</p>':'')+
          (stack.length?'<div class="cl-stack" id="clstk-'+r.id+'">'+
            stack.map(function(s){
              const sd=!!s.resolved_at;
              const sOn=sd && s.resolved_by===s.logged_by &&
                Math.abs(new Date(s.resolved_at)-new Date(s.created_at))<60000;
              const sPill=!sd?'<span class="cl-hist-pill wait">Waiting</span>'
                : sOn?'<span class="cl-hist-pill done">Handled</span>'
                     :'<span class="cl-hist-pill done">Called back</span>';
              const t=new Date(s.created_at).toLocaleTimeString('en-AU',
                {hour:'numeric',minute:'2-digit',timeZone:'Australia/Sydney'});
              const naRe=/^n\/?a$/i;
              return '<div class="cl-stack-row">'+
                '<span class="cl-stack-t">'+t+'</span>'+
                '<span class="cl-stack-by">'+clEsc((s.logged_by||'').split(' ')[0])+'</span>'+
                (s.reason && !naRe.test(String(s.reason).trim())
                  ?'<span class="cl-stack-rs">'+clEsc(s.reason)+'</span>':'')+
                (s.note?'<span class="cl-stack-note">'+clEsc(s.note)+'</span>':'')+
                sPill+'</div>';
            }).join('')+'</div>':'')+
        '</div>'+
      '</div>'+
      '<div class="cl-card-act">'+
        '<button class="cl-act cl-act-relog" title="Log a follow-up" aria-label="Relog" '+
          'onclick="event.stopPropagation();clPullToForm(\''+r.id+'\')">'+
          '<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>'+
          '<span>Relog</span></button>'+
        edit+del+
      '</div>'+
    '</article>';
  }).join('');
}

/**
 * Copy a number to the clipboard. Replaces the old tel: link — reception
 * works from laptops, where a tel: link opens nothing useful.
 */
function clCopy(btn, e164){
  const done = ()=>{
    btn.classList.add('copied');
    const orig = btn.innerHTML;
    btn.innerHTML = 'Copied';
    setTimeout(()=>{ btn.innerHTML = orig; btn.classList.remove('copied'); }, 1100);
  };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(e164).then(done).catch(()=>clCopyFallback(e164,done));
    }else{
      clCopyFallback(e164, done);
    }
  }catch(e){ clCopyFallback(e164, done); }
}
function clCopyFallback(text, cb){
  try{
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    cb();
  }catch(e){ showToast('Could not copy','error'); }
}

/**
 * Clicking a waiting row loads that caller into the form, so logging the
 * follow-up is one click instead of retyping the number. Saving then
 * auto-resolves the original via the phone-number match.
 */
function clPullToForm(id){
  const r=_clQueue.find(x=>x.id===id);
  if(!r) return;
  const set=(el,v)=>{const e=document.getElementById(el); if(e) e.value=v||'';};
  set('clName', r.caller_name==='N/A' ? '' : r.caller_name);
  set('clPhone', clFmtPhone(r.phone_e164) || r.phone_e164);
  set('clReason', r.reason);
  set('clNote','');

  // Inherit the owning team, not the relogger's. Someone from Processing
  // clearing an Enrolment callback is helping, not taking ownership — the
  // follow-up belongs to the same thread as the call it continues, or the
  // caller's history ends up split across two teams' lists.
  const owner = r.for_team || r.team || '';
  const ft=document.getElementById('clForTeam');
  const fh=document.getElementById('clForHint');
  if(ft){
    ft.value = owner;
    // A blank value means "my team", so only set it when the owner really
    // is another team; otherwise leave the default.
    if(owner && owner === myTeam) ft.value = '';
  }
  const crossTeam = !!(owner && owner !== myTeam);
  if(fh){
    if(crossTeam){
      fh.textContent = 'Staying with '+owner+' — you\u2019re helping, not taking it over.';
      fh.classList.add('cl-hint-warn');
    }else{
      fh.textContent=''; fh.classList.remove('cl-hint-warn');
    }
  }

  const cb=document.getElementById('clCallback');
  if(cb){ cb.checked=false; }
  const w=document.getElementById('clCbWrap');
  if(w) w.classList.remove('on');
  const p=document.getElementById('clPhone');
  if(p) p.dispatchEvent(new Event('input'));
  const n=document.getElementById('clName');
  if(n) n.focus();
  showToast('Loaded '+(r.caller_name==='N/A'?'caller':r.caller_name)+
    (crossTeam ? ' ('+owner+' call)' : '')+' — log the follow-up','success');
}

/**
 * Keyboard-first: operational tools are slowed down by reaching for a
 * mouse. Alt+N clears and focuses, Alt+S logs, "/" jumps to search.
 */
function clBindKeys(){
  if(window._clKeysBound) return;
  window._clKeysBound = true;
  document.addEventListener('keydown', ev=>{
    const page=document.getElementById('page-calllog');
    if(!page || !page.classList.contains('active')) return;
    const tag=(ev.target.tagName||'').toLowerCase();
    const typing = tag==='input' || tag==='textarea' || tag==='select';

    if(ev.altKey && (ev.key==='n' || ev.key==='N')){
      ev.preventDefault(); clClearForm(); return;
    }
    if(ev.altKey && (ev.key==='s' || ev.key==='S')){
      ev.preventDefault(); clSaveCall(); return;
    }
    if(ev.key==='/' && !typing){
      ev.preventDefault();
      const s=document.getElementById('clSearch');
      if(s) s.focus();
      return;
    }
    if(ev.key==='Escape' && ev.target.id==='clSearch'){
      ev.target.value=''; clRenderQueue(); ev.target.blur();
    }
  });
}

/* ══════════════ HOUSEKEEPING DUTY ══════════════
   ShiftOps builds the roster; Nexus is where staff actually live, so this
   surfaces their own duty and lets them tick it off. Read-only apart from
   the done flag — reassignment stays an admin action in ShiftOps.
   ────────────────────────────────────────────────────────────────── */

let _hkDuty = null;   // the row for today/next class day, or null

// Mirrors HK_TASKS in ShiftOps. Plain labels only — Nexus displays the job,
// it never assigns one.
const HK_TASK_LABEL = {
  chairs:    'Chairs, boards, papers & pens',
  equipment: "Bed lifter & trainer's table",
  waterbin:  'Water & lollies \u2014 and bring the bin back from Evershine',
  water:     'Water & lollies',
  speak:     'Speak to the class'
};

/** Sydney date as yyyy-mm-dd, built from local parts (never toISOString). */
function _hkToday(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

async function loadHousekeepingDuty(){
  const card=document.getElementById('hkCard');
  if(!card) return;
  const who = window.me || me;
  if(!who){ card.style.display='none'; return; }

  let rows=[];
  try{
    // Today and the next few class days. Past duties aren't shown — a card
    // for something that has already been and gone is just noise.
    rows = await sbGet('housekeeping_roster',
      '?select=*&staff_name=eq.'+encodeURIComponent(who)+
      '&duty_date=gte.'+_hkToday()+'&order=duty_date.asc&limit=3');
  }catch(e){ console.warn('hk duty', e); card.style.display='none'; return; }

  if(!rows.length){ _hkDuty=null; card.style.display='none'; return; }

  // Only show days the manager has PUBLISHED in ShiftOps. Housekeeping is
  // auto-generated and then corrected by hand, so an unpublished day is still
  // being shuffled — showing it means someone is told they're on chairs, then
  // told they aren't. Fails OPEN: if the publish table can't be read we show
  // the duty rather than silently hiding a real one.
  try{
    const dates = rows.map(r => r.duty_date);
    const pub = await sbGet('housekeeping_published',
      '?select=duty_date&duty_date=in.('+dates.join(',')+')');
    if(pub){
      const ok = new Set(pub.map(p => p.duty_date));
      rows = rows.filter(r => ok.has(r.duty_date));
      if(!rows.length){ _hkDuty=null; card.style.display='none'; return; }
    }
  }catch(e){ console.warn('hk publish gate — showing anyway', e); }

  const duty=rows.find(r=>!r.done) || rows[0];
  _hkDuty=duty;

  const isToday = duty.duty_date === _hkToday();
  const when = isToday ? 'today'
             : new Date(duty.duty_date+'T00:00:00')
                 .toLocaleDateString('en-AU',{weekday:'long', day:'numeric', month:'short'});

  const icon=document.getElementById('hkIcon');
  const title=document.getElementById('hkTitle');
  const sub=document.getElementById('hkSub');

  const taskBox=document.getElementById('hkTask');
  const isHead = duty.team === 'Head';

  if(duty.done){
    icon.style.background='rgba(16,185,129,.12)';
    icon.style.color='#047857';
    title.textContent='Housekeeping done';
    title.style.color='#047857';
    sub.textContent='Thanks — your turn is recorded.';
    if(taskBox) taskBox.style.display='none';   // nothing left to read
  }else{
    icon.style.background = isToday ? 'rgba(217,119,6,.13)' : 'var(--accent-dim)';
    icon.style.color      = isToday ? '#b45309' : 'var(--accent-text)';
    title.textContent = isToday ? 'Housekeeping — your turn today'
                                : 'Housekeeping — '+when;
    title.style.color='';
    // The head oversees; everyone else gets a specific job below.
    sub.textContent = isHead
      ? ('You\u2019re overseeing this session'+(isToday?'.':' — you\u2019ll be reminded on the day.'))
      : ('Be around for the students during the session, then cleanup at the end. '+
         (isToday ? 'Your turn is recorded once it\u2019s signed off.'
                  : 'You\u2019ll be reminded on the day.'));

    // Show the ONE job they've been given, not the whole list. A roster row
    // created before task assignment existed has no task, so the box stays
    // hidden rather than rendering an empty panel.
    if(taskBox){
      const label = HK_TASK_LABEL[duty.task];
      if(label && !isHead){
        taskBox.textContent = 'Your job: ' + label;
        taskBox.style.background = 'var(--accent-dim)';
        taskBox.style.color = 'var(--accent-text)';
        taskBox.style.display = '';
      }else{
        taskBox.style.display = 'none';
      }
    }
  }
  card.style.display='';

  // Notify once per duty, not on every page load.
  if(!duty.done && isToday && typeof NotifManager !== 'undefined'){
    const key='hk_notified_'+duty.id;
    if(!localStorage.getItem(key)){
      localStorage.setItem(key,'1');
      NotifManager.push({
        id:'hk-'+duty.id,
        type:'housekeeping',
        title:'Housekeeping duty today',
        body:'You\u2019re on the class housekeeping roster. Tick it off once done.',
        ts:Date.now(),
        link:'home'
      });
    }
  }
}

function initCallLog(){
  const n=document.getElementById('clName');
  if(n && !n.dataset.clBound){
    ['clName','clPhone','clReason'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.addEventListener('keydown',ev=>{
        if(ev.key==='Enter'){ ev.preventDefault(); clSaveCall(); }
      });
    });
    const p=document.getElementById('clPhone');
    if(p) p.addEventListener('input',()=>{
      const h=document.getElementById('clPhoneHint');
      const e=clToE164(p.value);
      p.classList.remove('error');
      if(!h) return;
      if(!e){
        // Say what's wrong rather than going silent — "0 plus 9 digits"
        // is only obvious once you already know the rule.
        const raw=(p.value||'').replace(/\D/g,'');
        h.textContent = raw ? clPhoneProblem(p.value) : '';
        h.classList.toggle('cl-hint-warn', !!raw);
        clHistLookup(null);
        return;
      }
      // Flag an existing open callback so the person knows this is a repeat
      // attempt before they save, not after.
      const waiting=_clQueue.filter(r=>!r.resolved_at && r.phone_e164===e);
      if(waiting.length){
        const w=waiting[waiting.length-1];
        h.textContent='Already waiting on a callback — logged by '+w.logged_by+'. Saving will clear it.';
        h.classList.add('cl-hint-warn');
      }else{
        h.textContent='Saved as '+e;
        h.classList.remove('cl-hint-warn');
      }
      clHistLookup(e);
    });
    const ft=document.getElementById('clForTeam');
    if(ft) ft.addEventListener('change',()=>{
      const fh=document.getElementById('clForHint');
      if(!fh) return;
      if(ft.value && ft.value!==myTeam){
        fh.textContent='This call will appear in '+ft.value+"'s list, not yours.";
        fh.classList.add('cl-hint-warn');
      }else{ fh.textContent=''; fh.classList.remove('cl-hint-warn'); }
    });
    // Highlight the row when ticked so it's obvious this call will come back
    const cb=document.getElementById('clCallback');
    if(cb) cb.addEventListener('change',()=>{
      const w=document.getElementById('clCbWrap');
      if(w) w.classList.toggle('on', cb.checked);
    });
    // If a live update arrived while the form had focus, apply it once the
    // person moves away rather than leaving them on a stale queue.
    const pane=document.getElementById('clPaneForm');
    if(pane && !pane.dataset.blurBound){
      pane.addEventListener('focusout', function(){
        setTimeout(function(){
          if(_clQueueDirty && !pane.contains(document.activeElement)){
            _clQueueDirty=false; clLoadQueue();
          }
        }, 300);
      });
      pane.dataset.blurBound='1';
    }
    const sq=document.getElementById('clSearch');
    if(sq && !sq.dataset.bound){
      sq.addEventListener('input', ()=>clRenderQueue());
      sq.dataset.bound='1';
    }
    n.dataset.clBound='1';
  }
  clBindKeys();
  _clQueueDirty = false;   // a full load supersedes anything deferred
  clLoadQueue();
  if(n) setTimeout(()=>n.focus(),80);
}

function switchAccessApp(app){
  _accessCurrentApp=app;
  ['formcraft','slip','dialtrac','shiftops'].forEach(a=>{var t=document.getElementById('acctab-'+a);if(t)t.className='acc-app-tab'+(app===a?' acc-tab-active':'');});
  // restyle tabs
  ['formcraft','slip','dialtrac','shiftops'].forEach(a=>{
    const el=document.getElementById('acctab-'+a);
    if(a===app){el.style.background='var(--accent)';el.style.color='#fff';el.style.borderColor='var(--accent)';}
    else{el.style.background='transparent';el.style.color='var(--text,#333)';el.style.borderColor='var(--border-color,#ddd)';}
  });
  document.getElementById('accSearch').value='';
  renderAccessList('');
}
function renderAccessList(filter){
  const c=document.getElementById('accStaffList');
  const f=(filter||'').toLowerCase();
  const sel=_accessWorking[_accessCurrentApp];
  const list=_accessAllStaff.filter(n=>n.toLowerCase().includes(f));
  if(!list.length){ c.innerHTML='<div style="text-align:center;color:var(--text-dim,#888);padding:30px;">No staff found</div>'; return; }
  c.innerHTML='';
  list.forEach(n=>{
    const on=sel.has(n);
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:9px;cursor:pointer;border:1px solid '+(on?'var(--accent)':'var(--border-color,#eee)')+';margin-bottom:6px;background:'+(on?'rgba(45,157,148,.08)':'transparent')+';';
    row.innerHTML='<span style="font-size:14px;font-weight:'+(on?'600':'400')+';">'+n+'</span><span style="font-size:18px;">'+(on?'✅':'⬜')+'</span>';
    row.onclick=()=>{ if(sel.has(n))sel.delete(n); else sel.add(n); renderAccessList(filter); };
    c.appendChild(row);
  });
}
function filterAccessList(v){ renderAccessList(v); }
function accSelectAll(){ _accessAllStaff.forEach(n=>_accessWorking[_accessCurrentApp].add(n)); renderAccessList(document.getElementById('accSearch').value); }
function accClearAll(){ _accessWorking[_accessCurrentApp].clear(); renderAccessList(document.getElementById('accSearch').value); }
async function accSelectTeam(team){
  try{
    const rows=await sbGet('staff_credentials','?select=staff_name&team=eq.'+encodeURIComponent(team));
    (rows||[]).forEach(r=>{ if(r.staff_name) _accessWorking[_accessCurrentApp].add(r.staff_name); });
  }catch(e){}
  renderAccessList(document.getElementById('accSearch').value);
}
async function buildTeamButtons(){
  const wrap=document.getElementById('accTeamButtons');
  let teams=[];
  try{
    const rows=await sbGet('staff_credentials','?select=team&team=not.is.null');
    teams=[...new Set((rows||[]).map(r=>r.team).filter(Boolean))];
  }catch(e){}
  wrap.innerHTML='<span style="font-size:12px;color:var(--text-dim,#888);align-self:center;margin-right:4px;">Quick add:</span>';
  wrap.innerHTML+='<button onclick="accSelectAll()" style="padding:6px 12px;border-radius:8px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;">Everyone</button>';
  teams.forEach(t=>{
    wrap.innerHTML+='<button onclick="accSelectTeam(\''+t.replace(/'/g,"\\'")+'\')" style="padding:6px 12px;border-radius:8px;border:1.5px solid var(--border-color,#ddd);background:transparent;color:var(--text,#333);font-size:12px;font-weight:600;cursor:pointer;">'+t+'</button>';
  });
  wrap.innerHTML+='<button onclick="accClearAll()" style="padding:6px 12px;border-radius:8px;border:1.5px solid #f5c2c2;background:transparent;color:#c0392b;font-size:12px;font-weight:600;cursor:pointer;">Clear all</button>';
}

// ── Globals restored (were removed with the discussions cut) ──
const APP_GATE_SECRET='oscars_nexus_gate_v1_8f3a2c91';
let _accessCache={formcraft:[],slip:[],dialtrac:[],shiftops:[]};
let _accessCurrentApp='formcraft';
let _accessWorking={formcraft:new Set(),slip:new Set(),dialtrac:new Set(),shiftops:new Set()};
let _accessAllStaff=[];
// Cross-file flag: Nexus's realtime hook sets window._clQueueDirty, so this
// must be a window property, NOT a let — a top-level let would shadow the
// property and the dirty signal from realtime would never be seen here.
window._clQueueDirty = window._clQueueDirty || false;
let _clRefreshTimer = null;

/**
 * Debounced live refresh, driven by the realtime subscription.
 *
 * Deliberately conservative about WHEN it redraws:
 *  - Only while the Call Log tab is actually open. A background refresh is
 *    wasted work and would fight whatever page the person is really using.
 *  - Not while the form has focus. Someone is mid-call typing a caller's
 *    details; re-rendering the queue under them is startling and can drop
 *    an expanded note they were reading.
 *  - Debounced ~2.5s. Reception logs in bursts — 34 calls in one morning,
 *    clustered — and a naive subscription refetches all 89 rows per insert.
 *
 * The dirty flag survives a skipped tick, so anything deferred is picked up
 * as soon as the form is released or the tab is reopened.
 */
function clScheduleQueueRefresh(){
  if(_clRefreshTimer) clearTimeout(_clRefreshTimer);
  _clRefreshTimer = setTimeout(function(){
    _clRefreshTimer = null;
    const page = document.getElementById('page-calllog');
    if(!page || !page.classList.contains('active')) return;   // stays dirty

    const pane = document.getElementById('clPaneForm');
    if(pane && pane.contains(document.activeElement)) return;  // mid-entry

    _clQueueDirty = false;
    clLoadQueue();
  }, 2500);
}


/** Expand/collapse a day-group's earlier attempts. */
function clToggleStack(id){
  const el=document.getElementById('clstk-'+id);
  const b=document.getElementById('clatt-'+id);
  if(!el) return;
  const on=el.classList.toggle('on');
  if(b) b.classList.toggle('on',on);
}

/* ── Caller history card ──────────────────────────────────────────
   When a valid number is typed, show that number's last 14 days,
   grouped by Sydney calendar day. Day-reset rule: each day is its own
   ticket; multiple calls the same day are attempts on that ticket.
   Open tickets lead; resolved days sit below, dimmed, for context. */
let _clHistTimer=null, _clHistLast='';
function clHistLookup(e164){
  const box=document.getElementById('clHist');
  if(!box) return;
  if(!e164){
    box.innerHTML=''; box.style.display='none'; _clHistLast='';
    if(_clHistTimer){ clearTimeout(_clHistTimer); _clHistTimer=null; }
    return;
  }
  if(e164===_clHistLast) return;   // same number, card already up
  _clHistLast=e164;
  if(_clHistTimer) clearTimeout(_clHistTimer);
  _clHistTimer=setTimeout(async ()=>{
    _clHistTimer=null;
    try{
      const since=new Date(Date.now()-14*86400000).toISOString();
      const rows=await sbGet('call_log',
        '?phone_e164=eq.'+encodeURIComponent(e164)+
        '&deleted_at=is.null'+
        '&created_at=gte.'+encodeURIComponent(since)+
        '&select=caller_name,reason,logged_by,resolved_at,created_at'+
        '&order=created_at.desc&limit=80');
      // The number may have changed while the fetch was in flight.
      if(_clHistLast===e164) clRenderHist(rows||[]);
    }catch(err){ console.warn('clHistLookup',err); }
  },350);
}

function clRenderHist(rows){
  const box=document.getElementById('clHist');
  if(!box) return;
  if(!rows.length){ box.innerHTML=''; box.style.display='none'; return; }

  // Group by Sydney day → one ticket per day, rows are its attempts.
  const groups={};
  rows.forEach(r=>{
    const k=clSydDate(r.created_at);
    (groups[k]=groups[k]||[]).push(r);
  });
  const keys=Object.keys(groups).sort().reverse();   // newest day first

  const isNA=v=>!v||/^n\/?a$/i.test(String(v).trim());
  const items=keys.slice(0,6).map(k=>{
    const g=groups[k];                     // already newest-first
    const open=g.some(r=>!r.resolved_at);
    const nm=(g.find(r=>!isNA(r.caller_name))||{}).caller_name||'';
    const reason=(g.find(r=>!isNA(r.reason))||{}).reason||'';
    const who=(g[0]&&g[0].logged_by)||'';
    const att=g.length;
    const day=clDayLabel(g[0].created_at);
    const pill=open
      ? '<span class="cl-hist-pill wait">Waiting</span>'
      : '<span class="cl-hist-pill done">Resolved</span>';
    return '<div class="cl-hist-row'+(open?' open':'')+'">'+
      '<div class="cl-hist-l">'+
        '<span class="cl-hist-day">'+clEsc(day)+'</span>'+
        (att>1?'<span class="cl-hist-att">'+att+' attempts</span>':'')+
      '</div>'+
      '<div class="cl-hist-m">'+
        (nm?'<span class="cl-hist-nm">'+clEsc(nm)+'</span>':'')+
        (reason?'<span class="cl-hist-rs">'+clEsc(reason)+'</span>':'')+
        (who?'<span class="cl-hist-by">'+clEsc(who)+'</span>':'')+
      '</div>'+pill+'</div>';
  }).join('');

  box.innerHTML='<div class="cl-hist-t">This number \u00b7 last 14 days</div>'+items;
  box.style.display='block';
}

