# EzNihongo Student Visual Contract

This document defines the approved visual direction for the EzNihongo website and authenticated student experience. It is the contract for the incremental Deep Blue UI rollout. Repository behavior, routes, labels, data, and access rules remain authoritative.

This document is a normative contract. Token snippets, layout rules, motion budgets, and QA criteria define requirements; repository code and merged pull requests establish what has been implemented and validated.

The intended result is warm paper, EzNihongo red, deep blue learning surfaces, Japanese editorial typography, restrained motion, and clear hierarchy. Deep blue supports learning and intelligence. It does not replace the red brand identity.

## Scope

The rollout covers these existing surfaces:

- public landing, authentication, course detail, checkout, payment status, privacy, and terms pages;
- the authenticated student routes Dashboard, Belajar, Review, Live Class, and Progres;
- lesson content, quiz, flashcard, kana, vocabulary, kanji, grammar, tutor, discussion, and other learning UI already rendered by `welcome.html`;
- shared styles used by those surfaces, when the change is isolated from excluded products.

The rollout does not cover:

- `app/**`, including the separate Kanji application, its theme, navigation, authentication, service worker, FSRS UI, assets, and data;
- the admin panel or admin workflows;
- backend schema, migrations, seed data, APIs, business rules, learning logic, course content, payment logic, or access rules;
- new routes, menus, destinations, features, labels, or metrics copied from a visual reference.

Kana, vocabulary, and kanji exercises inside the main `welcome.html` learning surface remain in scope for visual integration. This does not bring the separate `app/**` product into scope.

## Product truth

The approved visual reference supplies composition and visual language only. The repository supplies product truth.

The student navigation remains in this order, with these labels and existing destinations:

1. Dashboard
2. Belajar
3. Review
4. Live Class
5. Progres

The Belajar route keeps its Materi control, lesson sidebar or drawer, module hierarchy, and deep links. Desktop and mobile may present the same navigation differently, but must preserve the information architecture, query parameters, authentication behavior, and current-route indication.

Existing route shapes are part of that contract: `dashboard.html?course=`, `welcome.html?course=&module=&lesson=`, `review.html?category=`, `live.html?course=&tab=recordings`, and `progress.html?course=`. Preserve applicable version parameters, hashes, return paths, and selected-course context rather than rebuilding destinations from display labels.

The following must not be introduced unless repository support already exists and a separate requirement approves the change: Kamus, Ujian & Sertifikat, search, notifications, a community destination in the student shell, additional bottom-navigation items, or mockup-only metrics.

## Design principles

### One visual focal point

Each page should have one clearly dominant learning surface or action. Hierarchy, typography, spacing, and dividers should carry most of the design. A card is justified when it groups one task, one state, or one decision. Metrics and short rows should not each become nested cards by default.

### Red acts, blue teaches

EzNihongo red marks the brand and the primary action. Deep blue marks learning context, review intelligence, progress, focus, and selected secondary actions. Success, warning, and danger retain their own semantic colors.

### Japanese editorial restraint

Shippori Mincho or the existing Japanese serif may be used for page titles and selected display moments. Japanese characters or patterns may appear as low-contrast, nonessential accents. They must not compete with Indonesian instructions, contain essential text, or become a repeated badge on every section.

### Warm, readable surfaces

Warm paper remains the canvas. White is used for working surfaces that need separation. Navy is reserved for a focal surface such as Continue Learning. Borders, whitespace, and type hierarchy take priority over shadow and radius.

### Motion communicates state

Motion confirms entry, hover, press, progress, or an answer. It must not delay content, clicking, saving, route changes, or feedback. Decorative motion never loops continuously.

## Color system

### Existing roles

| Role | Existing token | Contract |
| --- | --- | --- |
| Brand and primary action | `--brand-red` | Logo, primary CTA, active brand moment, and essential emphasis |
| Canvas | `--paper-50`, `--paper-100` | Main backgrounds and editorial warmth |
| Dividers and quiet structure | `--paper-200` to `--paper-400` | Borders, separators, and disabled structure when contrast permits |
| Text | `--ink-900` to `--ink-400` | Headings, body, secondary text, and placeholders; usage must pass contrast for its size |
| Success | `--success`, `--success-soft` | Mastered, completed, and correct states only |
| Warning | `--warning`, `--warning-soft` | Due, expiry, payment attention, and other time-sensitive states |
| Information | `--info`, `--info-soft` | Existing generic information semantics; remains separate from learning blue |
| Danger | `--danger`, `--danger-soft` | Errors, destructive actions, and incorrect states |

Brand red and danger are distinct roles even when both appear red. A visual rollout must not alias them or make an error look like a primary action.

### Learning blue family

The approved learning-blue family is:

```css
--learning-blue-900: #19345F;
--learning-blue-800: #244477;
--learning-blue-700: #334E8C;
--learning-blue-600: #4165A8;
--learning-blue-500: #5A7DB7;
--learning-blue-200: #DCE6F5;
--learning-blue-100: #EEF3FA;
--learning-blue-ring: rgba(51, 78, 140, 0.22);
```

`--learning-blue-700` is the approved anchor. Shades may be adjusted only when contrast testing shows that a role cannot meet the contract. Any adjustment must preserve a coherent family and be recorded here with updated contrast values.

### Contrast limits

The candidate palette was measured against the current surfaces using the WCAG relative-luminance formula. The decisions below use unrounded values even though the table is rounded for reading.

| Color | White | Paper 100 | Permitted foreground use |
| --- | ---: | ---: | --- |
| Blue 900 | 12.37:1 | 11.57:1 | Text, icons, and dark surface |
| Blue 800 | 9.69:1 | 9.06:1 | Text, icons, and dark surface |
| Blue 700 | 8.05:1 | 7.53:1 | Default learning foreground on light surfaces |
| Blue 600 | 5.75:1 | 5.38:1 | Normal text and interactive foreground on light surfaces |
| Blue 500 | 4.16:1 | 3.89:1 | Large text or non-text decoration only unless the final pairing independently passes |
| Blue 200 | 1.26:1 | 1.18:1 | Soft background only |
| Blue 100 | 1.11:1 | 1.04:1 | Soft background only |

Additional binding rules:

- Normal text requires at least 4.5:1. Large text requires at least 3:1.
- White on `--brand-red` is permitted at 5.88:1.
- Brand red text is not permitted directly on blue 900 or blue 700; those pairings are 2.10:1 and 1.37:1.
- Blue 700 on blue 100 is permitted at 7.22:1.
- Blue 500 must not be used for normal text on white, paper, or blue 100.
- Blue 100 and blue 200 must not be the only visible boundary for an interactive control.
- `--learning-blue-ring` is an aura, not a sufficient focus indicator by itself. Composited on white it is approximately 1.43:1, so focus must include a solid, high-contrast outline or border change.
- Existing `--ink-500` and `--ink-400` are too light for some small-text pairings. Student-facing secondary text must be tested in its final context and strengthened through student-scoped rules rather than a global token change that affects admin.

## Component roles

### Buttons and links

- Primary actions use brand red with a white label.
- Learning-context secondary actions may use blue 700 or blue 600 on a light surface.
- Neutral secondary actions may use ink and paper.
- Destructive actions use danger tokens.
- Disabled controls cannot rely on opacity alone if the label becomes unreadable.
- Hover and focus must preserve the meaning established at rest.
- A page should not contain multiple visually competing primary buttons in the same decision group.

### Surfaces

- Continue Learning is the principal navy surface on Dashboard.
- Review and Focus may use blue 100 or blue 200 as supporting surfaces with blue 700 foregrounds.
- Standard content surfaces use white or paper with a divider or low elevation.
- Payment, expiry, and live timing retain warning semantics where currently used.
- Mastered, completed, and correct remain green.
- Error and incorrect remain danger.
- Cards should normally have one border or one shadow, not both at a strong level.
- Nested surfaces use reduced radius and elevation, or a divider instead of another card.

### Typography

- `--font-body` is the default for Indonesian UI and prose.
- `--font-jp` is the default for Japanese instructional text where sans serif improves reading.
- `--font-display` is reserved for page titles and selected focal headings.
- `--font-mono` is reserved for compact metadata, eyebrow labels, and structured counts.
- Main body copy targets 16px or larger. Frequently used controls and labels target 14px or larger. Secondary metadata may use 12–13px. Text below 12px is not permitted in new student UI.
- Japanese and mixed-script text must have enough line height to prevent glyph overlap at every supported viewport and at 200% text enlargement.

### Focus

Every link, button, input, select, tab, drawer control, modal control, and custom keyboard target needs a visible `:focus-visible` state. Focus cannot be expressed by hue alone. It must remain visible on paper, white, blue, red, warning, success, and danger surfaces.

## Student AppShell

The current shell is a shared visual contract implemented through repeated HTML and shared CSS. This rollout does not require a framework component or a new route layer.

### Desktop

- Keep the EzNihongo logo, the five existing navigation destinations, and Keluar.
- Keep the existing sticky desktop navigation behavior.
- Active navigation remains a red brand moment.
- Deep blue may strengthen neutral structure, hover, or focus, but must not turn every navigation item blue.
- The shell must preserve the selected course and existing destination query parameters where the current renderer supplies them.
- Belajar keeps the Materi control and desktop lesson sidebar behavior.

### Mobile

- Keep the current five-item bottom navigation at the existing 760px transition and preserve safe-area handling. Check both 760px and 761px.
- Keep a visible top bar for brand, logout, and the Belajar Materi control where applicable.
- Preserve the Belajar sidebar-to-drawer transition at 860px and check both 860px and 861px.
- Interactive targets should be at least 44 by 44 CSS pixels unless an equivalent enlarged hit area is present.
- The mobile navigation row should remain at least 50px tall before the bottom safe-area inset.
- Labels must remain readable without requiring icons to identify destinations.
- The bottom navigation, lesson drawer, modals, sticky learning controls, and tutor UI must not cover one another or the final page content.
- Drawer open and close behavior, Escape handling, focus return, and page scroll locking remain functional.

### Layout widths

Unified shell styling does not require identical content widths. Dashboard and overview pages may remain wider than Review, and lesson content may retain a reading-focused measure. Changes must preserve the current task's readability rather than force a single maximum width.

## Dashboard hierarchy

Dashboard uses only data and actions already returned by the repository. The target order is:

1. actionable payment and expiry notices, when present;
2. greeting and active-course context;
3. Continue Learning as the dominant navy surface with one red CTA;
4. Review Today as the highest-priority supporting action;
5. Course Progress;
6. Upcoming Live Class;
7. Focus Today and current ability summary;
8. weekly activity or a long-term pathway only when backed by existing data;
9. the existing legal footer.

Moving existing Dashboard sections to express this hierarchy is permitted. Adding new metrics, dates, courses, recommendations, or pathways from a mockup is not permitted. Pending-order and access-expiry notices must remain reachable and visually distinct.

## Learning state presentation

Visual state is an adapter over decisions already made by the owning domain. It never recalculates access, due dates, mastery, completion, or scoring.

| Presentation state | Meaning | Visual role |
| --- | --- | --- |
| `new` | Accessible material without enough practice evidence | Neutral paper/ink with a quiet blue cue when needed |
| `learning` | Practice has begun and the domain reports active learning or progress | Blue 100/200 surface with blue 700 foreground |
| `review_due` | The domain explicitly reports a review is available or due | Warning treatment for due or attention; a surrounding Smart Review surface may remain blue as learning context |
| `weak` | The domain explicitly reports that material needs reinforcement | Warning treatment with a clear text label; never encoded by color alone |
| `mastered` | The owning domain reports mastered or completed | Existing success green |
| `locked` | The entitlement or prerequisite system denies access | Neutral locked treatment with text/icon; not error, not mastered, and not due |

Domain boundaries are binding:

- course completion percentage is not mastery;
- a null ability percentage means insufficient evidence, not zero;
- unknown or insufficient-data states must remain explicit and must not be coerced into `new`, `locked`, or a numeric zero;
- Smart Review due state is not the same as a lesson drill's “perlu diulang” summary;
- a CSS class named `.review` is not evidence that a state is `review_due`;
- grammar mastery and practice mastery may use different thresholds;
- locked state follows server-authoritative entitlement and must not be inferred from CSS classes or cached progress;
- labels already returned by backend services remain the source text unless a separate content change is approved.

## Motion and effects

### Allowed motion

| Effect | Contract |
| --- | --- |
| Section reveal | Opacity plus 8–12px translateY, 180–240ms, once |
| Interactive hover | Up to 2px translateY with a subtle shadow, important controls only |
| Button press | 2–4px press or arrow movement, 120–180ms |
| Progress reveal | Once when visible; the value and label are visible without waiting |
| Focus aura | Small shadow around a solid focus indicator; no glow-heavy treatment |
| Correct-answer feedback | Short functional motion may be more expressive, without delaying the next action |

### Prohibited defaults

- continuous decorative animation;
- motion that starts before content is readable or blocks clicks;
- large blur or backdrop-filter surfaces as default chrome;
- canvas particles, WebGL, Lottie, or a new animation dependency for routine UI;
- large parallax, floating blobs, neon glows, glassmorphism, or gradient-heavy SaaS styling;
- hidden-by-default essential content that depends on JavaScript or IntersectionObserver to become visible.

If IntersectionObserver is used, it progressively enhances content that is already visible by default. Parallax is optional, desktop-only, and deferred until all lower-cost options have been evaluated.

### Reduced motion

`prefers-reduced-motion: reduce` must disable nonessential transforms, reveals, parallax, pulsing, and continuous animation. Functional loading indicators may retain a minimal state change, but cannot rely on fast rotation. Literal transition durations must not bypass the shared reduced-motion behavior.

## Editorial imagery and texture

Texture is optional. The UI must feel complete without it.

If later approved, use one removable CSS pattern or one small compressed static asset, targeting at most 20 KiB, at low opacity. Reserve stable dimensions, do not preload it, lazy-load where applicable, and ensure failure leaves hierarchy intact. Do not place essential text inside raster imagery. Avoid sakura, torii, Fuji, flags, or repeated Japanese motifs unless a specific content need justifies them.

## Responsive and accessibility contract

Required viewport checks are 320, 375, 390, 430, 768, 1024, and 1440 CSS pixels. Tests must also cover both sides of relevant existing breakpoints, including 760/761 and 860/861 when navigation or the lesson drawer changes.

Every affected flow must be checked for:

- no unintended horizontal scrolling;
- 200% text enlargement without lost content or controls;
- mouse, touch, and keyboard use;
- visible focus and logical focus order;
- loading, empty, error, success, locked, review-due, mastered, and insufficient-data states as applicable;
- Indonesian, Japanese, mixed-script, and long-string content;
- normal motion and reduced motion;
- missing decorative assets;
- correct heading order, accessible names, and live-region behavior;
- tabs, dialogs, and drawers with their expected keyboard behavior.
- progress semantics expose a numeric `aria-valuenow` only when the value is known.

The main student website currently declares a light color scheme. The separate Kanji application's dark mode is outside this rollout. Do not copy its theme toggle, storage keys, or dark tokens into the main student shell. Adding a main-site dark theme requires a separately approved scope and a complete semantic-token and contrast pass.

QA covers themes the affected surface already supports. For the main student website, verify that an operating-system dark preference does not accidentally mutate the intentional light theme.

## Performance contract

- Prefer CSS color, opacity, and transform changes.
- Do not add a runtime dependency for the visual rollout unless existing CSS and JavaScript cannot reasonably implement a required behavior.
- Do not add requests on the critical learning path for optional decoration.
- Do not preload decorative imagery.
- Keep animation off route-transition, answer-submission, completion, audio, video, and payment critical paths.
- Compare representative before and after page weight and interaction responsiveness using the same data, viewport, cache state, and font availability.
- A visual PR must not materially regress Core Web Vitals. If a regression appears, remove or simplify the visual effect before release.

## CSS ownership and cascade

The existing stylesheet order is part of runtime behavior. A change must inspect the final computed result, not only the rule where a value was written.

| File | Ownership |
| --- | --- |
| `styles/tokens.css` | Additive design values only. It is loaded by admin and imported by the separate Kanji application, so existing tokens must not be retuned for this rollout |
| `styles/components.css` | Existing primitives shared by public, authentication, and admin surfaces plus global focus/reduced-motion fallback; it is not the student redesign layer and changes require an admin impact check |
| `styles/student-nav.css` | Shared student top and bottom navigation presentation |
| `styles/student-platform.css` | Shared student colors, controls, states, and cross-page surface language |
| `styles/student-layout.css` | Cross-page placement and hierarchy; it loads late and should not silently become a second color system |
| `dashboard.css`, `review.css`, `progress.css`, `live.css` | Page-specific component silhouette and behavior |
| `styles/dashboard-polish.css`, `styles/review-polish.css` | Existing narrow patches; do not add another polish layer by default |
| `styles/learning-placement.css` | Belajar overview and lesson placement |
| `welcome.html` inline styles | Legacy lesson and learning UI; change in small, selector-bounded slices |

Rules for future changes:

- use shared tokens instead of repeating blue literals;
- add learning-blue values without globally retuning existing `--ink-*` or `--focus-ring` values shared with admin and the Kanji application;
- prefer a custom property or an owning selector over specificity escalation;
- do not use `!important` for routine theming;
- do not add a new global stylesheet solely to override the current cascade;
- scope new generic selectors such as `.card`, `.btn`, `.hero`, `.state`, and `.review` under the owning page or student root;
- do not remove existing CSS until usage is proven across dynamic states and breakpoints;
- do not perform a mass class rename in the same PR as visual changes;
- verify computed styles after any change to shorthand properties such as `background` or `border`;
- scope student changes so that `admin.html` and `app/**` receive no visual change through shared imports.

## Protected behavior and files

The following are reference-only for this rollout and must not change for visual polish:

- `app/**`;
- `admin.html` and admin-related frontend or backend files;
- `backend/schema.sql`, `backend/migrations/**`, seed data, import scripts, and stored content;
- auth, middleware, entitlement, payment, order, profile, database, FSRS, practice, mastery, progress, quiz, dashboard, live-class, tutor, and content service logic;
- deployment, workflow, environment, dependency, and infrastructure files.

Frontend files that render the approved surfaces may receive class, semantic-markup, or accessibility changes in their designated PR. Within those files, preserve:

- API paths, request bodies, response handling, and error handling;
- auth guards, refresh, logout, redirect, and `next` handling;
- route names, query parameters, hashes, and selected-course behavior;
- lesson, module, question, answer, and content order;
- quiz checking, authoritative results, completion, saving, reconciliation, and timing;
- Smart Review selection, ordering, scheduling, and answer behavior;
- media, TTS, recording, upload, tutor, grammar, and discussion lifecycles;
- payment status, proof upload, consent, expiry, and access paths.

## Incremental delivery

Each change should address one reviewable concern and stop before the next concern begins.

1. Adopt this visual contract with no runtime change.
2. Add and verify the learning-blue tokens with no broad redesign.
3. Normalize student-scoped primitives and contrast without changing admin.
4. Align the existing desktop shell.
5. Align the existing mobile shell and lesson drawer.
6. Reorder existing Dashboard sections for task hierarchy.
7. Apply the Deep Blue Dashboard treatment.
8. Add presentation-only Learning State adapters.
9. Integrate course, module, lesson, Review, Progres, and Live Class in bounded PRs.
10. Add restrained motion, optional texture, public/auth continuity, and final regression passes separately.

No PR should combine a behavior rewrite, framework migration, dependency cleanup, or dead-CSS deletion with visual implementation.

## Review checklist

Before approving a visual PR, verify all applicable items:

- the diff stays inside its declared surface and does not touch `app/**` or admin;
- no new route, menu, feature, label, or data field was invented;
- red, learning blue, success, warning, information, and danger retain distinct meanings;
- every foreground/background and focus pairing meets its required contrast;
- the active navigation, primary CTA, and semantic states remain recognizable without color alone;
- responsive layout passes the required widths and relevant breakpoint boundaries;
- reduced motion removes nonessential movement;
- loading, empty, error, locked, due, mastered, and insufficient-data states remain honest;
- auth, entitlement, course context, payment, content, quiz, review, progress, live, and media invariants remain unchanged;
- computed styles match the intended cascade;
- performance measurements show no material regression;
- automated checks appropriate to the touched behavior pass, followed by browser inspection of the affected states.

## Definition of done

The rollout is complete when the main EzNihongo website and authenticated student pages read as one product; red remains the brand and primary-action color; deep blue has a clear learning role; Dashboard makes the next learning action obvious; learning states are consistent without changing their domain logic; Japanese editorial accents remain restrained; mobile is fast and readable; reduced-motion behavior is complete; and learning, access, commerce, content, progress, and live-class behavior are unchanged.
