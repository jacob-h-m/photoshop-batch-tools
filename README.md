# Photoshop Batch Tools

Photoshop ExtendScript tools for batch mockup export and transparent trim.

## Contents
- **Batch Smart Objecter Replacer.jsx**: opens one or more mockup PSD or PSB files, replaces a smart object named `DESIGN_SMART` with each selected design, fits and centers, then exports PNG files.
- **Whitespace Trimmer.jsx**: trims transparent edges from many images in one go while keeping the original format.

Tested in Photoshop 2025. Older versions may work but are not guaranteed. Always run on copies.

## Install

Option A, quick run
1) In Photoshop go to File > Scripts > Browse
2) Pick one of the `.jsx` files from the `scripts` folder

Option B, add to the Scripts menu
1) Copy the `.jsx` files into the Photoshop Presets/Scripts folder  
   Windows: `C:\Program Files\Adobe\Adobe Photoshop <version>\Presets\Scripts`  
   macOS: `/Applications/Adobe Photoshop <version>/Presets/Scripts`
2) Restart Photoshop
3) Find them under File > Scripts

## Usage

### Batch Smart Objecter Replacer
1) Run the script
2) Select your design files, for example PNG, JPG, or PSD
3) Select your mockup files, PSD or PSB
4) Choose an output folder
5) The script replaces the smart object named `DESIGN_SMART`, fits and centers the design into the placeholder box, and exports PNG files

Script settings inside the file
- `TARGET_LAYER`: smart object layer name to replace. Default is `DESIGN_SMART`
- `PNG_COMPRESSION`: 0 to 9. Higher is smaller and slower
- `USE_SAVE_FOR_WEB`: true for PNG 24 via Save for Web, false for native PNG save

Notes
- Save for Web strips metadata and profiles. Native PNG save keeps profiles
- The script resets transforms for consistent sizing, then recenters inside the original box
- The script disables redraw and uses a small history to improve speed

### Whitespace Trimmer
1) Run the script
2) Choose an input folder, then an output folder
3) The script trims transparent pixels from the edges of every supported image and saves to the output folder in the original format

Supported extensions
- JPG, JPEG, PNG, TIF, TIFF, PSD

Defaults
- JPEG quality 12 with profile
- PNG compression 9, no interlace
- TIFF no compression
- PSD with embedded color profile

## Troubleshooting and logs
- Per file errors are skipped and printed to the JavaScript console with `$.writeln`
- The script alerts on major errors like missing input or output folders

## License
MIT License. See `LICENSE` for details.

## Credits
Scripts and docs by Jacob Mollan.
