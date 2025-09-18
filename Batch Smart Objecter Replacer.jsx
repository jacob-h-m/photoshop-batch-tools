// #target photoshop
// -----------------------------------------------------------------------------
// BATCH MOCK-UP EXPORTER - PNG-24, FIT INSIDE, CENTER
// Speed ups:
// - Open each mockup once, loop all designs, then revert to a saved history state
// - Disable redraw and keep tiny history to reduce overhead
// - Export directly from the working doc, no duplicate or flatten
// - Reset smart object transforms before scaling for consistent sizing
// -----------------------------------------------------------------------------

app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

(function () {
  /* ===== USER SETTINGS ===== */
  var TARGET_LAYER     = "DESIGN_SMART";   // smart object layer name, case-insensitive
  var PNG_COMPRESSION  = 5;                // 0 to 9, higher is smaller and slower
  var USE_SAVE_FOR_WEB = true;             // true uses Save For Web PNG-24, false uses PNGSaveOptions

  /* ===== SPEED PREFS ===== */
  var oldRedraw = app.preferences.enableRedraw;
  var oldHist   = app.preferences.numberOfHistoryStates;
  app.preferences.enableRedraw = false;
  app.preferences.numberOfHistoryStates = 2;

  /* ===== PICK FILES ===== */
  var designs = File.openDialog("Select design PNG/JPG/PSD", "Images:*.png;*.jpg;*.jpeg;*.psd", true);
  if (!designs) { alert("No designs selected."); return; }
  if (designs instanceof File) designs = [designs];

  var mockups = File.openDialog("Select mock-up PSD/PSB", "Mock-ups:*.psd;*.psb", true);
  if (!mockups) { alert("No mock-ups selected."); return; }
  if (mockups instanceof File) mockups = [mockups];

  var outFolder = Folder.selectDialog("Choose output folder");
  if (!outFolder) { alert("No output folder selected."); return; }

  /* ===== READ DESIGN DIMS ONCE ===== */
  var dimCache = {};
  for (var i = 0; i < designs.length; i++) {
    var f = designs[i];
    try {
      var t = app.open(f);
      dimCache[f.fsName] = { w: t.width.as("px"), h: t.height.as("px") };
      t.close(SaveOptions.DONOTSAVECHANGES);
    } catch (e) {
      // Skip unreadable files, but continue the batch
      $.writeln("Skip design: " + f.fsName + " - " + e);
    }
  }

  /* ===== HELPERS ===== */
  function sanitizeName(s) {
    return s.replace(/[\/\\:\*\?"<>\|]/g, "_");
  }

  function findSO(group, name) {
    var key = name.replace(/\s+/g, "").toLowerCase();
    for (var i = 0; i < group.layers.length; i++) {
      var l = group.layers[i];
      var nm = l.name.replace(/\s+/g, "").toLowerCase();
      if (l.kind === LayerKind.SMARTOBJECT && nm === key) return l;
      if (l.typename === "LayerSet") {
        var hit = findSO(l, name);
        if (hit) return hit;
      }
    }
    return null;
  }

  function pxBoundsNoFx(layer) {
    var b = layer.boundsNoEffects ? layer.boundsNoEffects : layer.bounds;
    return {
      x: b[0].as("px"),
      y: b[1].as("px"),
      w: b[2].as("px") - b[0].as("px"),
      h: b[3].as("px") - b[1].as("px")
    };
  }

  function resetSOTransforms() {
    try {
      executeAction(stringIDToTypeID("placedLayerResetTransforms"), new ActionDescriptor(), DialogModes.NO);
    } catch (e) {
      // Older docs can throw if the active layer is not a placed layer yet
    }
  }

  function replaceSOContents(fileObj) {
    var d = new ActionDescriptor();
    d.putPath(charIDToTypeID("null"), fileObj);
    d.putBoolean(charIDToTypeID("Lnkd"), false); // embed, not linked
    executeAction(stringIDToTypeID("placedLayerReplaceContents"), d, DialogModes.NO);
  }

  function savePNG24(doc, fileObj) {
    if (USE_SAVE_FOR_WEB) {
      // Save For Web - PNG-24 transparency, no metadata
      var opt = new ExportOptionsSaveForWeb();
      opt.format         = SaveDocumentType.PNG;
      opt.PNG8           = false;
      opt.transparency   = true;
      opt.interlaced     = false;
      opt.includeProfile = false;
      opt.optimized      = true;
      opt.metadata       = SaveMetadata.NONE;
      doc.exportDocument(fileObj, ExportType.SAVEFORWEB, opt);
    } else {
      // Native PNG save (also lossless). Usually a bit faster at low compression levels.
      var p = new PNGSaveOptions();
      p.compression = PNG_COMPRESSION; // 0 to 9
      p.interlaced  = false;
      doc.saveAs(fileObj, p, true, Extension.LOWERCASE);
    }
  }

  function fitAndCenterSO(soLayer, box, designW, designH) {
    // Reset any old transforms so percent scaling is predictable
    resetSOTransforms();

    // Scale to fit inside the placeholder box, preserve aspect
    var scalePct = Math.min(box.w / designW, box.h / designH) * 100;
    if (Math.abs(scalePct - 100) > 0.01) {
      soLayer.resize(scalePct, scalePct, AnchorPosition.MIDDLECENTER);
    }

    // Center inside the original box
    var after = pxBoundsNoFx(soLayer);
    var dx = (box.x + box.w * 0.5) - (after.x + after.w * 0.5);
    var dy = (box.y + box.h * 0.5) - (after.y + after.h * 0.5);
    if (dx !== 0 || dy !== 0) {
      soLayer.translate(dx, dy);
    }
  }

  /* ===== MAIN ===== */
  try {
    for (var m = 0; m < mockups.length; m++) {
      var mockFile = mockups[m];
      var doc = app.open(mockFile);
      doc.changeMode(ChangeMode.RGB);
      if (doc.bitsPerChannel === BitsPerChannelType.SIXTEEN) {
        doc.bitsPerChannel = BitsPerChannelType.EIGHT;
      }

      var so = findSO(doc, TARGET_LAYER);
      if (!so) {
        alert('Layer "' + TARGET_LAYER + '" not found in ' + mockFile.name);
        doc.close(SaveOptions.DONOTSAVECHANGES);
        continue;
      }

      // Record the placeholder rectangle once, before any replacements
      var box = pxBoundsNoFx(so);

      // Save a baseline history state so we can revert instantly
      var baseState = doc.activeHistoryState;

      for (var d = 0; d < designs.length; d++) {
        var designFile = designs[d];
        var dim = dimCache[designFile.fsName];
        if (!dim) {
          $.writeln("Skip design with no cached dims: " + designFile.fsName);
          continue;
        }

        try {
          // Activate the smart object layer each time, in case history reset changed the selection
          doc.activeLayer = so;

          // Replace contents, then fit and center
          replaceSOContents(new File(designFile));

          fitAndCenterSO(so, box, dim.w, dim.h);

          // Build output name
          var designBase = decodeURI(designFile.name).replace(/\.[^.]+$/, "");
          var mockBase   = mockFile.name.replace(/\.(psd|psb)$/i, "");
          var outName    = sanitizeName(designBase + "_" + mockBase + ".png");

          // Export from the live doc, no duplicate or flatten required
          savePNG24(doc, new File(outFolder.fsName + "/" + outName));

        } catch (eInner) {
          $.writeln("Error with design " + designFile.fsName + " on mock " + mockFile.fsName + " - " + eInner);
        } finally {
          // Instant revert to the clean mockup
          doc.activeHistoryState = baseState;
        }
      }

      doc.close(SaveOptions.DONOTSAVECHANGES);
    }
  } catch (e) {
    alert("Batch stopped: " + e);
  } finally {
    // Restore prefs
    app.preferences.enableRedraw = oldRedraw;
    app.preferences.numberOfHistoryStates = oldHist;
  }

  alert("All exports finished.\nSaved to: " + outFolder.fsName);
})();
