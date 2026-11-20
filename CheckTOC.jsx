// CheckTOC.jsx - compare the TOC in the active document with its headings.
// Lists headings missing from the TOC, page numbers that moved,
// and TOC lines whose heading no longer exists. Changes nothing.
// If the TOC style uses "Include Book Documents", open the book first:
// the script then reads the headings in every chapter of that book.

var JUNK = new RegExp("[\\r\\n\\t\\x03\\uFFFC\\uFEFF]", "g");

function clean(s) {
    return String(s).replace(JUNK, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function pathOf(d) {
    try { return d.fullName.fsName; } catch (e) { return ""; } // unsaved document
}

// Reads TOC lines (only from the TOC document) and headings from document d.
function readDoc(d, styles, titles, readToc, r) {
    for (var i = 0; i < d.stories.length; i++) {
        var st = d.stories[i];
        var isToc = st.storyType == StoryTypes.TOC_STORY;
        if (isToc && !readToc) { continue; }
        if (isToc) { r.hasToc = true; }
        for (var k = 0; k < st.paragraphs.length; k++) {
            var p = st.paragraphs[k];
            var raw = String(p.contents).replace(/\r$/, "");
            if (isToc) {
                var tab = raw.lastIndexOf("\t");
                var t = clean(tab >= 0 ? raw.substring(0, tab) : raw);
                // no tab: page number glued to the entry, split it later
                if (t && !titles[t]) { r.toc.push({ t: t, pg: tab >= 0 ? clean(raw.substring(tab + 1)) : null }); }
            } else if (styles[p.appliedParagraphStyle.name]) {
                var h = clean(raw);
                if (!h) { continue; }
                var fr = p.characters[0].parentTextFrames[0];
                // InDesign leaves pasteboard and overset text out of the TOC too
                if (!fr || !fr.parentPage) { r.skipped++; continue; }
                r.heads.push({ t: h, pg: fr.parentPage.name, doc: d.name });
            }
        }
    }
}

function checkTOC(doc) {
    var styles = {}, titles = {}, wantBook = false, i, j;
    for (i = 0; i < doc.tocStyles.length; i++) {
        var ts = doc.tocStyles[i];
        if (ts.title) { titles[clean(ts.title)] = true; }
        if (ts.includeBookDocuments && ts.tocStyleEntries.length) { wantBook = true; }
        for (j = 0; j < ts.tocStyleEntries.length; j++) {
            var n = ts.tocStyleEntries[j].name;
            styles[n] = true;
            styles[n.split(":").pop()] = true; // styles inside a group
        }
    }
    var r = { toc: [], heads: [], hasToc: false, skipped: 0 }, notes = [];
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
    if (!book) {
        readDoc(doc, styles, titles, true, r);
    } else {
        for (j = 0; j < book.bookContents.length; j++) {
            var bc = book.bookContents[j], f = bc.fullName, d = null, opened = false;
            if (!f.exists) { notes.push("Missing chapter file: " + bc.name); continue; }
            for (i = 0; i < app.documents.length; i++) {
                if (pathOf(app.documents[i]) === f.fsName) { d = app.documents[i]; break; }
            }
            if (!d) { d = app.open(f, false); opened = true; }
            try { readDoc(d, styles, titles, pathOf(d) === me, r); }
            finally { if (opened) { d.close(SaveOptions.NO); } }
        }
    }
    if (!r.hasToc) { return "No table of contents found in this document."; }
    var out = [], used = [], toc = r.toc, heads = r.heads;
    for (i = 0; i < heads.length; i++) {
        var hit = -1, tp = null, h = heads[i].t;
        for (j = 0; j < toc.length && hit < 0; j++) {
            if (used[j]) { continue; }
            var e = toc[j];
            if (e.pg !== null && e.t === h) { hit = j; tp = e.pg; }
            else if (e.pg === null && e.t.indexOf(h) === 0) {
                var rest = clean(e.t.substring(h.length).replace(/^[\s.]+/, ""));
                if (!/\s/.test(rest)) { hit = j; tp = rest; }
            }
        }
        var where = (book ? heads[i].doc + " " : "") + "p." + heads[i].pg;
        if (hit < 0) {
            out.push("Not in TOC (" + where + "): " + h);
        } else {
            used[hit] = true;
            if (tp && tp !== heads[i].pg) { out.push("Page moved " + tp + " -> " + heads[i].pg + (book ? " (" + heads[i].doc + ")" : "") + ": " + h); }
        }
    }
    for (j = 0; j < toc.length; j++) {
        if (!used[j]) { out.push("No matching heading: " + toc[j].t); }
    }
    if (!out.length) { out.push("TOC matches the headings (" + heads.length + " checked" + (book ? " in " + book.name : "") + ")."); }
    if (r.skipped) { out.push("(" + r.skipped + " heading(s) on the pasteboard or overset were skipped.)"); }
    return out.concat(notes).join("\n");
}

if (app.documents.length) { alert(checkTOC(app.activeDocument)); }
