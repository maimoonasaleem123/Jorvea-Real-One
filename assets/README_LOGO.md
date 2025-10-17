# Jorvea Logo Assets

## Files Added
- `logo-concept.svg`: Editable vector concept.
- (You must add) `logo-source.png`: Export a 1024x1024 PNG of the final logo and place it here.

## Generate Platform Icons
After placing `logo-source.png` (1024x1024):

```
npm install
npm run generate:icons
```

This will output:
- Android mipmap icons (ic_launcher.png + ic_launcher_round.png) in each density folder.
- iOS icon variants inside `AppIcon.appiconset`.

## Customization Tips
- Keep important graphic elements within a 840x840 safe zone (centered) to avoid corner clipping in adaptive masks.
- Use flat colors or subtle gradients for best scaling.
- Ensure good contrast on both light and dark backgrounds.

## Adaptive Icon (Android)
Currently using plain PNGs. For a full adaptive icon:
1. Create `ic_launcher_foreground.png` (transparent background) and `ic_launcher_background.xml` with a solid/gradient.
2. Reference them in `mipmap-anydpi-v26/ic_launcher.xml`.

## Updating iOS Contents.json
If you want Xcode to recognize generated filenames automatically, update `Contents.json` entries with the generated file names. The current file uses size+scale pairs; you can also rename generated files to match that structure if preferred.

## Suggested Brand Colors
Primary Gradient: #FF6A3D → #FF2E63 → #845EC2
Accent Neutral: #FFFFFF
Dark Background: #121212

## License
Ensure any font or asset you incorporate is licensed for distribution.
