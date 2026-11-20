import sys
from pathlib import Path
import pythoncom, win32com.client

SRC = Path(__file__).resolve().parent.parent / "CheckTOC.jsx"
body = SRC.read_text(encoding="ascii")
lib = body[: body.rindex("if (app.documents.length)")]

TEST = r"""
var log = [];
var doc = app.documents.add(false);
try {
    doc.documentPreferences.facingPages = false;
    doc.documentPreferences.pagesPerDocument = 6;
    var grp = doc.paragraphStyleGroups.add({name: "Heads"});
    var h1 = doc.paragraphStyles.add({name: "Chapter", pointSize: 24});
    var h2 = grp.paragraphStyles.add({name: "Section", pointSize: 16});
    var body = doc.paragraphStyles.add({name: "Body"});
    var tocP = doc.paragraphStyles.add({name: "TOC Line"});
    var heads = [["Getting\nstarted", h1, 1], ["Loading paper", h2, 2], ["Printing labels", h2, 3], ["Cleaning", h1, 4]];
    var frames = [];
    for (var i = 0; i < heads.length; i++) {
        var f = doc.pages[heads[i][2]].textFrames.add({geometricBounds: [36, 36, 300, 400]});
        f.contents = heads[i][0] + "\rBody text here.";
        f.paragraphs[0].appliedParagraphStyle = heads[i][1];
        f.paragraphs[1].appliedParagraphStyle = body;
        frames.push(f);
    }
    var ts = doc.tocStyles.add({name: "Main"});
    ts.title = "Contents";
    var e1 = ts.tocStyleEntries.add({name: "Chapter"}); e1.formatStyle = tocP; e1.level = 1; e1.separator = "^t";
    var e2 = ts.tocStyleEntries.add({name: "Heads:Section"}); e2.formatStyle = tocP; e2.level = 2;
    log.push("units: " + doc.viewPreferences.verticalMeasurementUnits + " h=" + doc.documentPreferences.pageHeight); log.push("entry names: " + e1.name + " / " + e2.name);
    var b = doc.pages[0].bounds;
    doc.createTOC(ts, true, undefined, [b[1] + 36, b[0] + 36], false);
    var tocStory = null;
    for (var s = 0; s < doc.stories.length; s++) { if (doc.stories[s].storyType == StoryTypes.TOC_STORY) tocStory = doc.stories[s]; }
    log.push("TOC story: " + (tocStory ? tocStory.contents.replace(/\r/g, " | ").replace(/\t/g, "<TAB>").replace(/\n/g, "<LB>") : "NONE"));
    log.push("[0 fresh] " + checkTOC(doc));
    frames[1].paragraphs[0].contents = "Loading roll paper\r";
    log.push("[1 edited heading] " + checkTOC(doc));
    frames[2].move(doc.pages[5]);
    log.push("[2 + moved frame] " + checkTOC(doc));
    var nf = doc.pages[4].textFrames.add({geometricBounds: [40, 3, 46, 30]});
    nf.contents = "Troubleshooting"; nf.paragraphs[0].appliedParagraphStyle = h1;
    var pb = doc.pages[4].textFrames.add({geometricBounds: [80, 3, 86, 30]});
    pb.contents = "Draft note heading"; pb.paragraphs[0].appliedParagraphStyle = h1;
    log.push("[3 + new heading] " + checkTOC(doc));
    frames[3].remove();
    log.push("[4 + deleted heading] " + checkTOC(doc));
    doc.createTOC(ts, true, undefined, [b[1] + 36, b[0] + 36], false);
    log.push("[5 regenerated] " + checkTOC(doc));
} catch (err) {
    log.push("ERROR " + err + " line " + err.line);
}
doc.close(SaveOptions.NO);
log.join("\n");
"""

pythoncom.CoInitialize()
app = win32com.client.Dispatch("InDesign.Application")
print(app.Name, app.Version)
print(app.DoScript(lib + TEST, 1246973031))
