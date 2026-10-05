# UI/UX vision

- Mood: refined twilight dojo—warm charcoal, parchment, cedar, restrained sakura accents.
- Team identity: readable red and blue; jade communicates valid interaction, gold communicates origin/important focus.
- Gameplay clarity comes before ornament. Every turn should state the next action; selected cards, active player, valid destinations, moves, captures, and check need distinct feedback.
- Motion should be short and purposeful: modal entrance, selection pulse, move confirmation, capture impact. Honor `prefers-reduced-motion`.
- Each turn must answer three questions without opening the rules: whose turn, what can I do now, and why did an attempted action fail.
- Transient turn banners can celebrate state changes, while persistent guidance stays compact and never intercepts board input.
- Local play must remain fully usable without the multiplayer service.
- Cards and card-editor cells must support keyboard focus and activation.
- Maintain responsive DOM controls around the Three.js board rather than hiding essential actions inside the canvas.
- Desktop gameplay uses three balanced zones: stacked hands, dominant central board, and isolated exchange card. Card names never compete horizontally with movement diagrams.
- Mobile keeps two cards per hand in a compact row, uses a full-width square board, preserves 44px touch targets and safe-area insets, and scrolls the match vertically rather than shrinking objects below legibility.
- Controls are grouped by purpose: board manipulation, match actions, and live status. On phones, match actions live in a thumb-reachable bottom dock and never cover playable content.
