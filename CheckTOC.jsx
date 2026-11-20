// CheckTOC.jsx - compare the TOC in the active document with its headings.
// Lists headings missing from the TOC, page numbers that moved,
// and TOC lines whose heading no longer exists. Changes nothing.
// If the TOC style uses "Include Book Documents", open the book first:
// the script then reads the headings in every chapter of that book.

var JUNK = new RegExp("[\\r\\n\\t\\x03\\uFFFC\\uFEFF]", "g");
// a page number: 12, xiv, or a short prefix such as A-12
var PAGE = /^(([A-Za-z]{1,3}[-.:]?)?\d+|[ivxlcdm]+)$/i;

function clean(s) {
    return String(s).replace(JUNK, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function pathOf(d) {
    try { return d.fullName.fsName; } catch (e) { return ""; } // unsaved document
}

// "Heads:Section" for a style inside the group Heads, like TOC style entries
function stylePath(s) {
    var parts = [s.name], p = s.parent;
    while (p && p.constructor.name === "ParagraphStyleGroup") { parts.unshift(p.name); p = p.parent; }
    return parts.join(":");
}

function tocStories(d) {
    var a = [];
    for (var i = 0; i < d.stories.length; i++) {
        if (d.stories[i].storyType == StoryTypes.TOC_STORY) { a.push(d.stories[i]); }
    }
    return a;
}

// Reads TOC lines (only from the TOC document) and headings from document d.
function readDoc(d, set, readToc, r) {
    for (var i = 0; i < d.stories.length; i++) {
        var st = d.stories[i];
        var isToc = st.storyType == StoryTypes.TOC_STORY;
        if (isToc && !readToc) { continue; }
        for (var k = 0; k < st.paragraphs.length; k++) {
            var p = st.paragraphs[k];
            var raw = String(p.contents).replace(/\r$/, "");
            if (isToc) {
                var tab = raw.lastIndexOf("\t"), pg = null;
                if (tab >= 0 && PAGE.test(clean(raw.substring(tab + 1)))) { pg = clean(raw.substring(tab + 1)); raw = raw.substring(0, tab); }
                var t = clean(raw);
                if (!t || (k === 0 && set.titles[t])) { continue; } // the TOC title
                // pg null: no tab, the page number is glued to the entry
                r.toc.push({ t: t, pg: pg || null });
            } else if (set.styles[stylePath(p.appliedParagraphStyle)]) {
                var h = clean(raw);
                if (!h) { continue; }
                var fr = p.characters[0].parentTextFrames[0];
                if (!fr || !fr.parentPage) { r.skipped++; continue; } // pasteboard or overset
                if (!set.hidden && !fr.itemLayer.visible) { r.hidden++; continue; }
                r.heads.push({ t: h, pg: fr.parentPage.name, doc: d.name,
                    num: p.bulletsAndNumberingListType == ListType.NUMBERED_LIST });
            }
        }
    }
}

// Page number the TOC line e gives for heading h, or null if e is not that heading.
function pageFor(e, h) {
    var texts = [e.t];
    if (h.num) { texts.push(e.t.replace(/^\S+\s+/, "")); } // "1. Heading" from list numbering
    for (var i = 0; i < texts.length; i++) {
        var t = texts[i];
        if (e.pg !== null) { if (t === h.t) { return e.pg; } }
        else if (t.indexOf(h.t) === 0) {
            var rest = clean(t.substring(h.t.length).replace(/^[\s.]+/, ""));
            if (/^(\d+|[ivxlcdm]+)$/i.test(rest)) { return rest; } // digits only: a guess
        }
    }
    return null;
}

function checkTOC(doc) {
    var i, j, k, tocs = tocStories(doc);
    if (!tocs.length) { return "No table of contents found in this document."; }
    // paragraph styles used in the TOC, to tell which TOC style made it
    var inToc = {};
    for (i = 0; i < tocs.length; i++) {
        for (k = 0; k < tocs[i].paragraphs.length; k++) { inToc[stylePath(tocs[i].paragraphs[k].appliedParagraphStyle)] = true; }
    }
    var cands = [], used = [];
    for (i = 0; i < doc.tocStyles.length; i++) {
        var ts = doc.tocStyles[i];
        if (!ts.tocStyleEntries.length) { continue; }
        cands.push(ts);
        for (j = 0; j < ts.tocStyleEntries.length; j++) {
            var en = ts.tocStyleEntries[j], fs = en.formatStyle;
            var look = (typeof fs === "string" || !fs.name) ? en.name : stylePath(fs); // [Same Style]
            if (inToc[look]) { used.push(ts); break; }
        }
    }
    if (!used.length) { used = cands; }
    var set = { styles: {}, titles: {}, hidden: false }, wantBook = false;
    for (i = 0; i < used.length; i++) {
        if (used[i].title) { set.titles[clean(used[i].title)] = true; }
        if (used[i].includeBookDocuments) { wantBook = true; }
        if (used[i].includeHidden) { set.hidden = true; }
        for (j = 0; j < used[i].tocStyleEntries.length; j++) { set.styles[used[i].tocStyleEntries[j].name] = true; }
    }
    var r = { toc: [], heads: [], skipped: 0, hidden: 0 }, notes = [];
    if (used.length > 1) { notes.push("Headings from " + used.length + " TOC styles were combined."); }
    var me = pathOf(doc), book = null;
    if (wantBook && me) {
        for (i = 0; i < app.books.length && !book; i++) {
            for (j = 0; j < app.books[i].bookContents.length; j++) {
                if (app.books[i].bookContents[j].fullName.fsName === me) { book = app.books[i]; break; }
            }
        }
    }
    if (wantBook && !book) {
        return "This TOC takes headings from a book. Open the book (.indb) that contains this document and run the script again.";
    }
    var missing = 0;
    if (!book) {
        readDoc(doc, set, true, r);
    } else {
        for (j = 0; j < book.bookContents.length; j++) {
            var bc = book.bookContents[j], f = bc.fullName, d = null, opened = false;
            if (!f.exists) { notes.push("Missing chapter file: " + bc.name); missing++; continue; }
            for (i = 0; i < app.documents.length; i++) {
                if (pathOf(app.documents[i]) === f.fsName) { d = app.documents[i]; break; }
            }
            if (!d) { d = app.open(f, false); opened = true; }
            try { readDoc(d, set, pathOf(d) === me, r); }
            finally { if (opened) { d.close(SaveOptions.NO); } }
        }
    }
    var out = [], taken = [], toc = r.toc, heads = r.heads, pages = [];
    // first pass: same text on the same page; second pass: same text anywhere
    for (var pass = 0; pass < 2; pass++) {
        for (i = 0; i < heads.length; i++) {
            if (pages[i] !== undefined) { continue; }
            for (j = 0; j < toc.length; j++) {
                if (taken[j]) { continue; }
                var pg = pageFor(toc[j], heads[i]);
                if (pg !== null && (pass === 1 || pg === heads[i].pg)) { taken[j] = true; pages[i] = pg; break; }
            }
        }
    }
    for (i = 0; i < heads.length; i++) {
        var h = heads[i], where = (book ? h.doc + " " : "") + "p." + h.pg;
        if (pages[i] === undefined) { out.push("Not in TOC (" + where + "): " + h.t); }
        else if (pages[i] !== h.pg) { out.push("Page moved " + pages[i] + " -> " + h.pg + (book ? " (" + h.doc + ")" : "") + ": " + h.t); }
    }
    for (j = 0; j < toc.length; j++) {
        if (!taken[j]) { out.push("No matching heading: " + toc[j].t); }
    }
    if (!out.length) {
        out.push(missing ? "No differences in the chapters that could be read. The book was not fully checked."
            : "TOC matches the headings (" + heads.length + " checked" + (book ? " in " + book.name : "") + ").");
    }
    if (r.skipped) { out.push("(" + r.skipped + " heading(s) on the pasteboard or overset were skipped.)"); }
    if (r.hidden) { out.push("(" + r.hidden + " heading(s) on hidden layers were skipped.)"); }
    return out.concat(notes).join("\n");
}

if (app.documents.length) { alert(checkTOC(app.activeDocument)); }
