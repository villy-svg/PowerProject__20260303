# Phase 5 — App Icons & Splash Screen

## Context Block

### What You Are Building
You are generating proper Android app icons and a splash screen for the PowerProject mobile app. The production icon uses the PowerPod logo, while the staging icon gets a visual differentiator (orange "STG" banner) so users can tell them apart at a glance on their device.

### What You MUST Read First
1. `.agent/skills/ui-design-system/SKILL.md` — Color tokens (Midnight Black, Sophisticated Mint)
2. `.agent/skills/hybrid-mobile-deployment/SKILL.md` — Environment visual differentiation

### Key Architecture Facts
- **Source Logo**: `public/PowerPod Transparent Background.svg` (vector, transparent background)
- **Android Icon Densities**: mdpi (48px), hdpi (72px), xhdpi (96px), xxhdpi (144px), xxxhdpi (192px)
- **Adaptive Icons (Android 8+)**: Require separate foreground (icon) and background (color/image) layers
- **Splash Background**: `#050505` (Midnight Black)
- **Staging Differentiator**: Orange (#f97316, from `--priority-high`) diagonal banner with "STG" text
- **Android project path**: `android/app/src/main/res/`

---

## Prerequisites
- [ ] **Phase 2 completed** — `android/` project exists with Gradle flavors
- [ ] Image editing tool available (Figma, GIMP, Inkscape, or online tools like Canva)
- [ ] OR: access to an AI image generation tool for creating the icon variants
- [ ] Node.js and Capacitor installed

---

## Sub-Phase 5.1 — Prepare Source Icon Images

### Step 1: Export SVG to 1024x1024 PNG

You need a 1024×1024 PNG version of the logo for icon generation.

**Option A — Using Inkscape (CLI):**
```bash
inkscape "public/PowerPod Transparent Background.svg" --export-type=png --export-filename=resources/icon.png --export-width=1024 --export-height=1024
```

**Option B — Using an online converter:**
1. Go to https://svgtopng.com or similar
2. Upload `public/PowerPod Transparent Background.svg`
3. Set output size to 1024×1024
4. Save as `resources/icon.png`

**Option C — Using the `generate_image` tool:**
If you have access to an AI image generation tool, generate a clean 1024x1024 icon based on the existing logo design.

### Step 2: Create the resources directory

```bash
mkdir -p resources
```

### Step 3: Verify the source icon

- `resources/icon.png` exists
- Dimensions: 1024×1024
- Content: The PowerPod logo centered on transparent background

---

## Sub-Phase 5.2 — Generate Android Icon Variants

### Step 1: Install @capacitor/assets (if not already installed)

```bash
npm install -D @capacitor/assets
```

### Step 2: Create the icon source structure

The `@capacitor/assets` tool expects specific source files:

```
resources/
├── icon-only.png          ← 1024x1024, the logo foreground (transparent bg)
├── icon-background.png    ← 1024x1024, solid color background layer
├── icon-foreground.png    ← 1024x1024, same as icon-only (for adaptive icons)
├── splash.png             ← 2732x2732, splash screen image
└── splash-dark.png        ← 2732x2732, dark mode splash (optional)
```

### Step 3: Create the background image

Create a 1024×1024 solid `#050505` PNG for `resources/icon-background.png`.

**Using ImageMagick:**
```bash
convert -size 1024x1024 xc:"#050505" resources/icon-background.png
```

**Using Python:**
```python
from PIL import Image
img = Image.new('RGB', (1024, 1024), '#050505')
img.save('resources/icon-background.png')
```

Or create it in any image editor.

### Step 4: Create the splash screen image

Create a 2732×2732 PNG with:
- Background: `#050505` (Midnight Black)
- Center: The PowerPod logo, approximately 300-400px in size
- No text

Save as `resources/splash.png` and `resources/splash-dark.png` (same image for both since our theme is already dark).

### Step 5: Copy the icon-only and icon-foreground

```bash
cp resources/icon.png resources/icon-only.png
cp resources/icon.png resources/icon-foreground.png
```

### Step 6: Generate all density variants

```bash
npx @capacitor/assets generate --android
```

This auto-generates all required icon sizes into `android/app/src/main/res/`:
- `mipmap-mdpi/` through `mipmap-xxxhdpi/` — launcher icons
- `drawable/` and `drawable-*dpi/` — splash screen assets

### Step 7: Verify generated files

```
android/app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png            (48x48)
│   ├── ic_launcher_round.png      (48x48)
│   ├── ic_launcher_foreground.png
│   └── ic_launcher_background.png
├── mipmap-hdpi/
│   ├── ic_launcher.png            (72x72)
│   └── ...
├── mipmap-xhdpi/                  (96x96)
├── mipmap-xxhdpi/                 (144x144)
├── mipmap-xxxhdpi/                (192x192)
└── mipmap-anydpi-v26/
    └── ic_launcher.xml            (Adaptive icon definition)
```

---

## Sub-Phase 5.3 — Create Staging Icon Variant

### Step 1: Create staging-specific icon resources directory

```bash
mkdir -p android/app/src/staging/res/mipmap-mdpi
mkdir -p android/app/src/staging/res/mipmap-hdpi
mkdir -p android/app/src/staging/res/mipmap-xhdpi
mkdir -p android/app/src/staging/res/mipmap-xxhdpi
mkdir -p android/app/src/staging/res/mipmap-xxxhdpi
mkdir -p android/app/src/staging/res/mipmap-anydpi-v26
```

> [!NOTE]
> Android Gradle's flavor system uses `src/{flavorName}/res/` to override resources. Files in `src/staging/res/mipmap-*/` will override the equivalent files in `src/main/res/mipmap-*/` ONLY for the staging flavor.

### Step 2: Create staging icon with orange "STG" banner

For each density, create a modified version of the production icon that adds a diagonal orange banner in the top-right corner.

**Banner specifications:**
- Color: `#f97316` (matches `--priority-high`, the orange from the UI design system)
- Text: "STG" in white, bold
- Position: Diagonal banner across top-right corner
- Banner width: ~30% of icon width

**Method A — Using ImageMagick (per density):**

```bash
# Example for xxxhdpi (192x192)
convert android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png \
  -fill "#f97316" -draw "polygon 96,0 192,0 192,96" \
  -fill white -font Arial-Bold -pointsize 20 \
  -gravity NorthEast -annotate +10+25 "STG" \
  android/app/src/staging/res/mipmap-xxxhdpi/ic_launcher.png
```

Repeat for each density, scaling the banner and text proportionally:
- `mdpi` (48px): pointsize 7, offset +3+8
- `hdpi` (72px): pointsize 10, offset +5+12
- `xhdpi` (96px): pointsize 14, offset +7+16
- `xxhdpi` (144px): pointsize 17, offset +8+20
- `xxxhdpi` (192px): pointsize 20, offset +10+25

**Method B — Using image generation tool:**

Generate staging icon variants with the orange banner and save them to the appropriate directories.

### Step 3: Copy round icons for staging

Repeat the same process for `ic_launcher_round.png` in each density.

### Step 4: Copy adaptive icon foreground (if applicable)

If using adaptive icons, create a staging-specific foreground PNG with the banner overlay, and copy `ic_launcher_foreground.png` to each staging mipmap directory.

---

## Sub-Phase 5.4 — Verify Splash Screen Configuration

### Step 1: Verify `capacitor.config.ts` splash settings

Open `capacitor.config.ts` and confirm the SplashScreen plugin config (from Phase 2):

```typescript
plugins: {
  SplashScreen: {
    launchAutoHide: true,
    backgroundColor: '#050505',
    androidScaleType: 'CENTER_CROP',
    showSpinner: false,
    splashFullScreen: true,
    splashImmersive: true,
  },
}
```

### Step 2: Sync the updated resources

```bash
npx cap sync android
```

---

## Checkpoint — Phase 5 Complete

### Icon Generation Verification
- [ ] **PASS**: `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` exists (192×192)
- [ ] **PASS**: `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` exists (48×48)
- [ ] **PASS**: All 5 density directories have icons (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- [ ] **PASS**: `resources/icon.png` exists as the source (1024×1024)

### Staging Icon Verification
- [ ] **PASS**: `android/app/src/staging/res/mipmap-xxxhdpi/ic_launcher.png` exists
- [ ] **PASS**: Staging icon visually differs from production (orange "STG" banner visible)
- [ ] **PASS**: All 5 density directories have staging icon variants

### Splash Screen Verification
- [ ] **PASS**: Splash-related drawable resources exist in `android/app/src/main/res/`
- [ ] **PASS**: `capacitor.config.ts` has `backgroundColor: '#050505'` in SplashScreen config

### Build Verification
```bash
cd android
./gradlew assembleStagingDebug
./gradlew assembleProductionDebug
```
- [ ] **PASS**: Both flavors build successfully
- [ ] **PASS**: On device: Staging APK shows orange-bannered icon
- [ ] **PASS**: On device: Production APK shows clean icon
- [ ] **PASS**: On device: Both apps show Midnight Black splash on launch

### Web Regression
- [ ] **PASS**: `npm run dev` — web app loads with no changes to its appearance

---

## Rollback Plan

1. **Delete generated resources**: `rm -rf resources/`
2. **Delete staging icon overrides**: `rm -rf android/app/src/staging/`
3. **Uninstall plugin**: `npm uninstall @capacitor/assets`
4. **Re-sync**: `npx cap sync android` (resets to Capacitor defaults)
5. **Verify**: `npm run build` — no errors

---

## Files Modified Summary

| Action | File | Description |
|--------|------|-------------|
| **MODIFIED** | `package.json` | Added `@capacitor/assets` devDependency |
| **NEW** | `resources/` directory | Source icon and splash PNGs |
| **MODIFIED** | `android/app/src/main/res/mipmap-*/` | Production icon variants (all densities) |
| **NEW** | `android/app/src/staging/res/mipmap-*/` | Staging icon variants with orange banner |
| **MODIFIED** | `android/app/src/main/res/drawable*/` | Splash screen assets |
