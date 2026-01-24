# PWA Icons

## TODO: Replace Placeholder Icons

The icons in this directory (`icon-192.png` and `icon-512.png`) are currently placeholders.

**Required icon sizes:**
- `icon-192.png` - 192x192 pixels
- `icon-512.png` - 512x512 pixels

## Generating Icons

To generate proper icons from `favicon.png`:

1. Install sharp (if not already installed):
   ```bash
   npm install --save-dev sharp
   ```

2. Run the icon generation script:
   ```bash
   tsx scripts/generateIcons.ts
   ```

This will create properly sized icons from `public/favicon.png` and save them to this directory.

## Manual Creation

Alternatively, you can manually create these icons:
- Use an image editor to resize `public/favicon.png` to 192x192 and 512x512 pixels
- Save as `icon-192.png` and `icon-512.png` respectively
- Ensure icons have transparent backgrounds or white backgrounds
- Icons should be square and properly centered
