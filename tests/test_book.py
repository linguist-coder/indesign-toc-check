import os, shutil
from pathlib import Path
import pythoncom, win32com.client

SRC = Path(__file__).resolve().parent.parent / "CheckTOC.jsx"
body = SRC.read_text(encoding="ascii")
lib = body[: body.rindex("if (app.documents.length)")]
ROOT = Path(os.environ["TEMP"]) / "toc-check-book-test"  # throwaway folder, deleted and recreated each run
shutil.rmtree(ROOT, ignore_errors=True)
ROOT.mkdir(parents=True)

TEST = r"""
var ROOT = "%s/";
var log = [];
function mk(name, pages, heads) {
    var d = app.documents.add(false);
    d.documentPreferences.facingPages = false;
    d.documentPreferences.pagesPerDocument = pages;
    var g = d.paragraphStyleGroups.add({name: "Heads"});
    var st = {Chapter: d.paragraphStyles.add({name: "Chapter", pointSize: 24}), Section: g.paragraphStyles.add({name: "Section"})};
    d.paragraphStyles.add({name: "TOC Line"});
    for (var i = 0; i < heads.length; i++) {
        var f = d.pages[heads[i][2]].textFrames.add({geometricBounds: [3, 3, 20, 30]});
        f.contents = heads[i][0];
        f.paragraphs[0].appliedParagraphStyle = st[heads[i][1]];
    }
    d.save(new File(ROOT + name));
    return d;
}
var front = null, book = null;
try {
    front = mk("front.indd", 1, []);
    mk("ch1.indd", 3, [["Getting started", "Chapter", 0], ["Loading paper", "Section", 1]]).close(SaveOptions.NO);
    mk("ch2.indd", 2, [["Printing labels", "Chapter", 0], ["Cleaning", "Section", 1]]).close(SaveOptions.NO);
    book = app.books.add(new File(ROOT + "t.indb"));
    var names = ["front.indd", "ch1.indd", "ch2.indd"];
    for (var n = 0; n < names.length; n++) { book.bookContents.add(new File(ROOT + names[n])); }
    book.repaginate(); book.save();
    var ts = front.tocStyles.add({name: "Main"});
    ts.title = "Contents";
    var e1 = ts.tocStyleEntries.add({name: "Chapter"}); e1.formatStyle = front.paragraphStyles.itemByName("TOC Line"); e1.separator = "^t";
    var e2 = ts.tocStyleEntries.add({name: "Heads:Section"}); e2.formatStyle = front.paragraphStyles.itemByName("TOC Line"); e2.separator = "^t";
    ts.includeBookDocuments = true;
    var b = front.pages[0].bounds;
    front.createTOC(ts, true, book, [b[1] + 3, b[0] + 3], false);
    front.save();
    var tocs = "";
    for (var s = 0; s < front.stories.length; s++) { if (front.stories[s].storyType == StoryTypes.TOC_STORY) tocs = front.stories[s].contents; }
    log.push("TOC: " + tocs.replace(/\r/g, " | ").replace(/\t/g, "<TAB>"));
    log.push("open docs before: " + app.documents.length);
    log.push("[0 fresh] " + checkTOC(front));
    log.push("open docs after: " + app.documents.length);
    // user has ch2 open and edits a heading
    var ch2 = app.open(new File(ROOT + "ch2.indd"), false);
    for (var q = 0; q < ch2.textFrames.length; q++) { if (ch2.textFrames[q].contents === "Cleaning") ch2.textFrames[q].contents = "Cleaning the head"; }
    ch2.save();
    log.push("[1 edited in open ch2] " + checkTOC(front));
    log.push("ch2 still open: " + ch2.isValid);
    ch2.close(SaveOptions.NO);
    // a page is inserted before everything in ch1
    var ch1 = app.open(new File(ROOT + "ch1.indd"), false);
    ch1.pages.add(LocationOptions.AT_BEGINNING);
    ch1.save(); ch1.close(SaveOptions.NO);
    book.repaginate();
    log.push("[2 + page added in ch1] " + checkTOC(front));
    front.createTOC(ts, true, book, [b[1] + 3, b[0] + 3], false);
    log.push("[3 regenerated] " + checkTOC(front));
    log.push("open docs at end: " + app.documents.length);
    // ch2 is moved away while the book is open
    new File(ROOT + "ch2.indd").rename("ch2-moved.indd");
    log.push("[3b ch2 file missing] " + checkTOC(front));
    new File(ROOT + "ch2-moved.indd").rename("ch2.indd");
    book.close(SaveOptions.YES); book = null;
    log.push("[4 book closed] " + checkTOC(front));
} catch (err) {
    log.push("ERROR " + err + " line " + err.line);
}
if (book && book.isValid) { book.close(SaveOptions.NO); }
if (front && front.isValid) { front.close(SaveOptions.NO); }
log.join("\n");
""" % ROOT.as_posix()

pythoncom.CoInitialize()
app = win32com.client.Dispatch("InDesign.Application")
print("docs open before test:", app.Documents.Count)
print(app.DoScript(lib + TEST, 1246973031))
print("docs open after test:", app.Documents.Count)
