# FluencyJet Sentence Master - Design Guidelines

## Design Approach: Reference-Based (Duolingo + Supernova Inspired)

**Primary References:** Duolingo's playful learning experience + Supernova's clean minimalism
**Key Principles:** 
- Encourage through positive reinforcement and delightful micro-interactions
- Clarity and readability for bilingual content (Tamil + English)
- Gamification elements that feel rewarding, not overwhelming
- Progressive disclosure - show complexity gradually

---

## Core Design Elements

### A. Color Palette

**Light Mode (Primary):**
- Primary Brand: 142 71% 45% (vibrant teal-green, energetic yet calm)
- Success/Correct: 142 76% 36% (deeper green for achievements)
- Accent: 25 95% 53% (warm orange for CTAs and highlights)
- Error/Wrong: 0 84% 60% (soft red for mistakes)
- Background: 0 0% 98% (off-white, gentle on eyes)
- Surface: 0 0% 100% (pure white for cards/containers)
- Text Primary: 220 13% 18% (dark blue-gray)
- Text Secondary: 220 9% 46% (medium gray)

**Supporting Colors:**
- XP/Streak indicator: 45 93% 47% (golden yellow)
- Badge highlights: 280 67% 55% (purple for achievements)
- Disabled/Inactive: 220 9% 70% (light gray)

### B. Typography

**Font Families:**
- Primary (English): 'DM Sans', sans-serif (Google Fonts)
- Tamil Support: 'Noto Sans Tamil', sans-serif (Google Fonts)
- Display/Numbers: 'Poppins', sans-serif (for XP, scores)

**Scale:**
- Display: 3xl-4xl font size, 700 weight (hero headings)
- H1: 2xl-3xl, 700 weight (page titles)
- H2: xl-2xl, 600 weight (section headers)
- H3: lg-xl, 600 weight (card titles)
- Body: base, 400 weight (main content)
- Small: sm, 400-500 weight (labels, hints)
- Tamil text: Increase base size by 0.125rem for better readability

### C. Layout System

**Spacing Units:** Tailwind units of 2, 4, 6, 8, 12, 16
- Micro spacing (gaps, padding): 2, 4
- Component spacing: 6, 8
- Section spacing: 12, 16
- Page margins: 4 (mobile), 8-12 (desktop)

**Grid System:**
- Mobile: Single column, max-w-md mx-auto
- Tablet: 2-column for cards (md:grid-cols-2)
- Desktop: 3-column max for lesson cards (lg:grid-cols-3)

### D. Component Library

**Word Tiles (Core Interaction):**
- Rounded-2xl containers with shadow-md
- Active state: Scale-105 transform, ring-2 ring-primary
- Tamil words: Larger text, bold weight
- English words: Medium weight, primary color
- Drag indicators with subtle border-dashed

**Progress Indicators:**
- Circular XP rings (stroke-dasharray animation)
- Linear progress bars (h-2, rounded-full)
- Streak flame icons (Font Awesome fire icon)
- Daily calendar grid with checkmarks

**Cards & Containers:**
- Rounded-2xl for primary cards
- Rounded-xl for nested components
- Shadow-sm for subtle elevation
- Shadow-lg for modals/overlays
- Border: 1px solid with 10% opacity of primary color

**Buttons:**
- Primary: bg-primary, text-white, rounded-xl, py-3 px-6
- Secondary: bg-surface, border-2 border-primary, text-primary
- Success: bg-success with white text
- Ghost: Transparent with hover:bg-primary/10
- When on images: backdrop-blur-md, bg-white/20, border border-white/40

**Badges & Achievements:**
- Hexagonal or shield shapes (clip-path or custom SVG)
- Gradient fills from primary to accent
- Metallic shimmer effect for locked badges (grayscale with opacity-40)
- Glow effect for newly unlocked (shadow-2xl with primary color)

**Navigation:**
- Bottom tab bar (mobile): 5 icons max, active state with primary color
- Top bar: Logo left, user avatar/XP right
- Hamburger menu: Slide-in from left, overlay with backdrop-blur

**Forms & Inputs:**
- Rounded-lg input fields
- Focus: ring-2 ring-primary
- Tamil input: Larger text size, specific font family
- Label above input, helper text below in text-secondary

**Modals & Overlays:**
- Centered with max-w-lg
- Backdrop: bg-black/50 with backdrop-blur-sm
- Content: bg-surface, rounded-2xl, p-8
- Close button: top-right, ghost style

### E. Animations

**Essential Only:**
- Success celebration: Confetti burst on correct answer (canvas-confetti library)
- XP gain: Number count-up animation (200ms duration)
- Streak increment: Flame flicker effect (subtle scale pulse)
- Badge unlock: Scale from 0.8 to 1 with bounce (300ms)
- Page transitions: Fade-in only (150ms)

**NO continuous animations** - keep interface calm for learning focus

---

## Page-Specific Guidelines

**Free Quiz Flow (Landing):**
- Immediate word tile interaction (no lengthy intro)
- Sentence building area: Large, centered, drag-and-drop target
- Feedback: Full-screen celebration for correct, gentle shake for wrong
- Progress: Top bar showing question X of Y

**Dashboard:**
- Hero section: User greeting + XP circle + streak counter (horizontal layout)
- Stats grid: 2x2 on mobile, 4-column on desktop (total XP, streak days, lessons completed, accuracy %)
- Recent activity timeline below stats
- Quick action cards: "Continue Learning", "Daily Challenge"

**Practice Lessons:**
- Card grid layout (masonry on desktop for visual interest)
- Each card: Lesson title, difficulty badge, completion percentage, thumbnail icon
- Filter tabs: All, Beginner, Intermediate, Advanced
- Lock icon with blur effect for premium lessons

**Paywall:**
- Centered modal or full page
- Feature comparison: Free vs Premium (2-column table)
- Pricing card with "Contact Admin" CTA
- Testimonial section with user success stories

**Admin Panel:**
- Table layout for user list (searchable)
- Action column with "Activate Premium" button
- Filters: All Users, Free, Premium, Pending
- Bulk actions toolbar

**Rewards & Badges:**
- Gallery grid (3-4 columns desktop, 2 mobile)
- Locked badges in grayscale with lock overlay
- Badge detail modal on click (description, unlock criteria, date earned)
- Progress toward next badge

---

## Images

**Hero Image:** Yes - Landing page quiz flow
- Location: Background of initial quiz interface
- Description: Soft gradient with abstract learning-themed illustrations (books, lightbulbs, Tamil/English alphabet letters floating subtly)
- Treatment: Opacity 20%, positioned behind word tiles for depth

**Additional Images:**
- Badge icons: Use Font Awesome icons for achievements (trophy, star, flame, medal)
- Lesson thumbnails: Simple geometric patterns in brand colors
- Empty states: Friendly illustrations (person with question mark for no lessons)
- Success screens: Celebration graphics (checkmark with confetti burst)

**No large hero images** for utility pages (dashboard, admin) - focus on data and functionality

---

## Responsive Behavior

**Mobile First (< 768px):**
- Single column layouts throughout
- Bottom navigation bar (fixed)
- Word tiles: Full width with generous tap targets (min-h-12)
- Modals: Full screen on small devices

**Tablet (768px - 1024px):**
- 2-column grids for cards
- Side navigation option (collapsible)
- Larger word tiles with 2-3 per row

**Desktop (> 1024px):**
- Max container width: 1280px
- 3-4 column card grids
- Persistent side navigation
- Hover states for all interactive elements