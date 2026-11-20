# Cases from review round 1 (2026-11-20). Each case builds its own throwaway document.
from pathlib import Path
import pythoncom, win32com.client

SRC = Path(__file__).resolve().parent.parent / "CheckTOC.jsx"
body = SRC.read_text(encoding="ascii")
lib = body[: body.rindex("if (app.documents.length)")]

TEST = r"""
var log = [];
function newDoc(pages) {
    var d = app.documents.add(false);
    d.documentPreferences.facingPages = false;
    d.documentPreferences.pagesPerDocument = pages;
    return d;
}
function put(d, page, text, style, layer) {
    var f = d.pages[page].textFrames.add({geometricBounds: [36, 36, 300, 400]});
    if (layer) { f.itemLayer = layer; }
    f.contents = text; f.paragraphs[0].appliedParagraphStyle = style;
    return f;
}
function toc(d, ts) { var b = d.pages[0].bounds; d.createTOC(ts, true, undefined, [b[1] + 36, b[0] + 36], false); }
function tocText(d) {
    var s = tocStories(d);
    return s.length ? s[0].contents.replace(/\r/g, " | ").replace(/\t/g, "<TAB>") : "NONE";
}
function run(name, fn) {
    var d = null;
    try { d = fn(); } catch (err) { log.push("[" + name + "] ERROR " + err + " line " + err.line); }
    if (d && d.isValid) { d.close(SaveOptions.NO); }
}

// A: the same heading text on two pages, read page 6 first
run("A duplicate headings", function () {
    var d = newDoc(7), h = d.paragraphStyles.add({name: "Head"});
    put(d, 6, "Summary", h); put(d, 2, "Summary", h);
    var ts = d.tocStyles.add({name: "Main"}); var e = ts.tocStyleEntries.add({name: "Head"}); e.separator = "^t";
    toc(d, ts);
    log.push("[A fresh] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    return d;
});

// B: an unused figure-list TOC style with Include Book Documents on
run("B unused TOC style", function () {
    var d = newDoc(3), h = d.paragraphStyles.add({name: "Head"}), cap = d.paragraphStyles.add({name: "Caption"});
    put(d, 1, "Getting started", h); put(d, 2, "Figure 1 Paper path", cap);
    var ts = d.tocStyles.add({name: "Main"}); var e = ts.tocStyleEntries.add({name: "Head"}); e.separator = "^t";
    var fig = d.tocStyles.add({name: "Figures"}); var fe = fig.tocStyleEntries.add({name: "Caption"});
    fe.formatStyle = d.paragraphStyles.add({name: "Figure List"}); fig.includeBookDocuments = true;
    toc(d, ts);
    log.push("[B fresh] " + checkTOC(d));
    return d;
});

// C: Heads:Section is in the TOC, Sidebar:Section is not
run("C same name in two groups", function () {
    var d = newDoc(3);
    var hs = d.paragraphStyleGroups.add({name: "Heads"}).paragraphStyles.add({name: "Section"});
    var ss = d.paragraphStyleGroups.add({name: "Sidebar"}).paragraphStyles.add({name: "Section"});
    put(d, 1, "Loading paper", hs); put(d, 2, "Tip: use thick paper", ss);
    var ts = d.tocStyles.add({name: "Main"}); var e = ts.tocStyleEntries.add({name: "Heads:Section"}); e.separator = "^t";
    toc(d, ts);
    log.push("[C fresh] " + checkTOC(d));
    return d;
});

// D: a heading on a hidden layer, TOC style without Include Text on Hidden Layers
run("D hidden layer", function () {
    var d = newDoc(3), h = d.paragraphStyles.add({name: "Head"});
    put(d, 1, "Getting started", h);
    var main = d.layers[0], notes = d.layers.add({name: "Notes"});
    put(d, 2, "Editor note", h, notes);
    notes.visible = false; d.activeLayer = main;
    var ts = d.tocStyles.add({name: "Main"}); var e = ts.tocStyleEntries.add({name: "Head"}); e.separator = "^t";
    toc(d, ts);
    log.push("[D fresh] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    return d;
});

// E: numbered headings, TOC with default numbering setting, no separator
run("E numbered headings", function () {
    var d = newDoc(4);
    var n = d.paragraphStyles.add({name: "NumHead", bulletsAndNumberingListType: ListType.NUMBERED_LIST});
    put(d, 1, "Getting started", n); put(d, 3, "Cleaning", n);
    var ts = d.tocStyles.add({name: "Main"}); ts.tocStyleEntries.add({name: "NumHead"});
    toc(d, ts);
    log.push("[E fresh] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    return d;
});

// F: a heading with the same text as the TOC title
run("F heading equals TOC title", function () {
    var d = newDoc(3), h = d.paragraphStyles.add({name: "Head"});
    put(d, 1, "Contents", h); put(d, 2, "Cleaning", h);
    var ts = d.tocStyles.add({name: "Main"}); ts.title = "Contents";
    var e = ts.tocStyleEntries.add({name: "Head"}); e.separator = "^t";
    toc(d, ts);
    log.push("[F fresh] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    return d;
});

// G: no separator, heading shortened after generating (review: PrintingLabels4)
run("G no tab, heading shortened", function () {
    var d = newDoc(5), h = d.paragraphStyles.add({name: "Head"});
    var f = put(d, 4, "PrintingLabels", h);
    var ts = d.tocStyles.add({name: "Main"}); ts.tocStyleEntries.add({name: "Head"});
    toc(d, ts);
    f.paragraphs[0].contents = "Printing";
    log.push("[G edited] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    return d;
});

// --- Cases from review round 2 ---
function setLine(d, k, text) { // replace the text of TOC line k, keep its paragraph return
    var p = tocStories(d)[0].paragraphs[k], last = p.characters[-1].contents == "\r";
    p.contents = text + (last ? "\r" : "");
}
function pageOf(d, k) { var c = String(tocStories(d)[0].paragraphs[k].contents).replace(/\r$/, ""); return c.substring(c.lastIndexOf("\t") + 1); }

// H: the TOC title uses the entry style of an unused figure list style that has Include Book Documents on
run("H title style shared with unused style", function () {
    var d = newDoc(3), h = d.paragraphStyles.add({name: "Head"}), cap = d.paragraphStyles.add({name: "Caption"});
    var figList = d.paragraphStyles.add({name: "Figure List"});
    put(d, 1, "Getting started", h); put(d, 2, "Figure 1 Paper path", cap);
    var ts = d.tocStyles.add({name: "Main"}); ts.title = "Contents"; ts.titleStyle = figList;
    var e = ts.tocStyleEntries.add({name: "Head"}); e.separator = "^t";
    var fig = d.tocStyles.add({name: "Figures"}); fig.title = "Figures";
    var fe = fig.tocStyleEntries.add({name: "Caption"}); fe.formatStyle = figList; fig.includeBookDocuments = true;
    toc(d, ts);
    log.push("[H fresh] " + checkTOC(d));
    return d;
});

// I: the TOC lines were restyled by hand, so no TOC style matches
run("I restyled TOC lines", function () {
    var d = newDoc(3), h = d.paragraphStyles.add({name: "Head"}), body = d.paragraphStyles.add({name: "Body"});
    put(d, 1, "Getting started", h);
    var ts = d.tocStyles.add({name: "Main"}); var e = ts.tocStyleEntries.add({name: "Head"}); e.separator = "^t";
    toc(d, ts);
    var ps = tocStories(d)[0].paragraphs;
    for (var k = 0; k < ps.length; k++) { ps[k].appliedParagraphStyle = body; }
    log.push("[I restyled] " + checkTOC(d));
    return d;
});

// J: short numbered headings, no tab before the page number (review: 1.<TAB>API2)
run("J short numbered headings", function () {
    var d = newDoc(4);
    var n = d.paragraphStyles.add({name: "NumHead", bulletsAndNumberingListType: ListType.NUMBERED_LIST});
    put(d, 1, "API", n); put(d, 3, "UI", n);
    var ts = d.tocStyles.add({name: "Main"}); ts.tocStyleEntries.add({name: "NumHead"});
    toc(d, ts);
    log.push("[J fresh] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    return d;
});

// K: a numbered heading whose TOC line has the wrong number or an extra word
run("K wrong number in TOC line", function () {
    var d = newDoc(4);
    var n = d.paragraphStyles.add({name: "NumHead", bulletsAndNumberingListType: ListType.NUMBERED_LIST});
    put(d, 2, "Cleaning", n);
    var ts = d.tocStyles.add({name: "Main"}); var e = ts.tocStyleEntries.add({name: "NumHead"}); e.separator = "^t";
    toc(d, ts);
    log.push("[K fresh] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    var pg = pageOf(d, 0);
    setLine(d, 0, "99.\tCleaning\t" + pg);
    log.push("[K number 99] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    setLine(d, 0, "Wrong Cleaning\t" + pg);
    log.push("[K extra word] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    return d;
});

// L: TOC entries without page numbers, then the heading frame moves
run("L no page numbers", function () {
    var d = newDoc(4), h = d.paragraphStyles.add({name: "Head"});
    var f = put(d, 1, "Introduction", h);
    var ts = d.tocStyles.add({name: "Main"}); var e = ts.tocStyleEntries.add({name: "Head"});
    e.pageNumberPosition = PageNumberPosition.NONE;
    toc(d, ts);
    log.push("[L fresh] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    f.move(d.pages[3]);
    log.push("[L moved] " + checkTOC(d));
    return d;
});

// M: chapter entries without page numbers, section entries with them
run("M mixed page numbers", function () {
    var d = newDoc(5), c = d.paragraphStyles.add({name: "Chapter"}), s = d.paragraphStyles.add({name: "Section"});
    var fc = put(d, 1, "Basics", c), fs = put(d, 2, "Loading paper", s);
    var ts = d.tocStyles.add({name: "Main"});
    var e1 = ts.tocStyleEntries.add({name: "Chapter"}); e1.pageNumberPosition = PageNumberPosition.NONE;
    var e2 = ts.tocStyleEntries.add({name: "Section"}); e2.separator = "^t";
    toc(d, ts);
    log.push("[M fresh] TOC: " + tocText(d) + "\n  " + checkTOC(d));
    fc.move(d.pages[3]); fs.move(d.pages[4]);
    log.push("[M both moved] " + checkTOC(d));
    return d;
});

// N: two TOC styles with the same entry style, one of them with Include Book Documents on
run("N two styles, one wants a book", function () {
    var d = newDoc(3), h = d.paragraphStyles.add({name: "Head"});
    put(d, 1, "Getting started", h);
    var ts = d.tocStyles.add({name: "Main"}); var e = ts.tocStyleEntries.add({name: "Head"}); e.separator = "^t";
    var old = d.tocStyles.add({name: "Old book TOC"}); old.tocStyleEntries.add({name: "Head"}); old.includeBookDocuments = true;
    toc(d, ts);
    log.push("[N fresh] " + checkTOC(d));
    return d;
});

log.join("\n");
"""

pythoncom.CoInitialize()
app = win32com.client.Dispatch("InDesign.Application")
print(app.Name, app.Version)
print("docs open before test:", app.Documents.Count)
print(app.DoScript(lib + TEST, 1246973031))
print("docs open after test:", app.Documents.Count)
