# Goal
Turn the board into a vibrant Decadence × Sakura centerpiece with unmistakably Japanese dojo pieces.

# Scope
- Refresh the Three.js board, stage, lighting, temples, and procedural Master/Disciple models.
- Preserve team ownership, legal-move contrast, camera behavior, performance, offline play, and rules.
- Refine the surrounding board-stage treatment without adding gameplay chrome.

# Approach
- Use a bright woven tatami field inside oxblood lacquer, with amber registration marks, coral blossoms, jade accents, and branded edge lighting.
- Strengthen piece silhouettes with haori/hakama layers, obi, mon crests, hachimaki, training staffs, topknots, and katana details.
- Keep red versus indigo as the primary gameplay signal and use pale material highlights for legibility.

# Risks
- Added geometry must remain lightweight enough for mobile GPUs.
- Decorative marks must not resemble legal destinations or obscure hit targets.
- Brighter materials must retain clear ownership and selection/capture feedback.

# Verification
- Check both teams, Master/Disciple rank recognition, temples, selection rings, legal highlights, 2D/3D views, and mobile framing.
- Run lint, tests, typechecks, build/bundle checks, and the prescribed browser game client.
