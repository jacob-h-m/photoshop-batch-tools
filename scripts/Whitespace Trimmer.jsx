/**
 * Fast batch transparent trim script for Photoshop 2025
 * ----------------------------------------------------
 * 1. Prompts for input and output folders.
 * 2. For each supported image in the input folder:
 *      a. Opens the file silently.
 *      b. Trims transparent whitespace on all four sides.
 *      c. Saves to the output folder in the original format.
 * 3. Restores user prefs.
 *
 * Supported extensions: JPG, JPEG, PNG, TIF, TIFF, PSD.
 */

(function () {
    // Utility: quick message and quit
    function bail(msg) {
        alert(msg);
        throw new Error(msg);
    }

    // Ask user for folders
    var inputFolder  = Folder.selectDialog("Choose the input folder with images");
    if (!inputFolder) bail("No input folder selected");

    var outputFolder = Folder.selectDialog("Choose an output folder for the results");
    if (!outputFolder) bail("No output folder selected");

    // Create output folder if it does not exist
    if (!outputFolder.exists) outputFolder.create();

    // File filter
    var files = inputFolder.getFiles(function (f) {
        if (f instanceof File) {
            return /\.(jpg|jpeg|png|tif|tiff|psd)$/i.test(f.name);
        }
        return false;
    });

    if (files.length === 0) bail("No supported images found in the input folder");

    // Speed tweaks: suppress dialogs and protect prefs
    var originalDialogMode = app.displayDialogs;
    var originalRulerUnits = app.preferences.rulerUnits;
    app.displayDialogs      = DialogModes.NO;
    app.preferences.rulerUnits = Units.PIXELS;

    // Main loop
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        try {
            var doc = app.open(file);

            // Trim transparent pixels on every edge
            doc.trim(TrimType.TRANSPARENT, true, true, true, true);

            // Prepare save path
            var saveFile = File(outputFolder.fsName + "/" + file.name);

            // Save in original format
            var lowerName = file.name.toLowerCase();
            if (lowerName.match(/\.(jpg|jpeg)$/)) {
                var jpgOpts = new JPEGSaveOptions();
                jpgOpts.quality = 12;
                jpgOpts.embedColorProfile = true;
                doc.saveAs(saveFile, jpgOpts, true, Extension.LOWERCASE);
            } else if (lowerName.match(/\.png$/)) {
                var pngOpts = new PNGSaveOptions();
                pngOpts.compression = 9;
                pngOpts.interlaced  = false;
                doc.saveAs(saveFile, pngOpts, true, Extension.LOWERCASE);
            } else if (lowerName.match(/\.(tif|tiff)$/)) {
                var tifOpts = new TiffSaveOptions();
                tifOpts.imageCompression = TIFFEncoding.NONE;
                doc.saveAs(saveFile, tifOpts, true, Extension.LOWERCASE);
            } else if (lowerName.match(/\.psd$/)) {
                var psdOpts = new PhotoshopSaveOptions();
                psdOpts.embedColorProfile = true;
                doc.saveAs(saveFile, psdOpts, true, Extension.LOWERCASE);
            }

        } catch (e) {
            // Log any per-file error and continue
            $.writeln("Error processing " + file.fsName + ": " + e.message);
        } finally {
            // Close without saving changes to the original
            if (app.documents.length) {
                app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
            }
        }
    }

    // Restore prefs
    app.displayDialogs = originalDialogMode;
    app.preferences.rulerUnits = originalRulerUnits;

    alert("Finished processing " + files.length + " image(s).");
})();
