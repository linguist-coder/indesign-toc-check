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
                var t = clean(raw);
                if (!t || (k === 0 && set.titles[t])) { continue; } // the TOC title
                // shown whole in the report, a tab as " ... ": "Cleaning ... 5"
                r.toc.push({ raw: raw, t: clean(raw.replace(/\t/g, " ... ")) });
            } else if (set.styles[stylePath(p.appliedParagraphStyle)]) {
                var mode = set.styles[stylePath(p.appliedParagraphStyle)];
                var h = clean(raw);
                if (!h) { continue; }
                var fr = p.characters[0].parentTextFrames[0];
                if (!fr || !fr.parentPage) { r.skipped++; continue; } // pasteboard or overset
                if (!set.hidden && !fr.itemLayer.visible) { r.hidden++; continue; }
                // a numbered heading appears in the TOC with its current number, e.g. "2. Cleaning"
                var keys = [h];
                if (p.bulletsAndNumberingListType == ListType.NUMBERED_LIST) {
                    keys.unshift(clean(p.bulletsAndNumberingResultText + " " + h));
                }
                r.heads.push({ t: h, keys: keys, mode: mode, pg: fr.parentPage.name, doc: d.name });
            }
        }
    }
}

// Page number the TOC line e gives for heading h: "" if the line has no page number,
// null if e is not that heading. h.mode is the TOC entry's page number setting:
// "page", "none", or "either" when combined TOC styles disagree.
function pageFor(e, h) {
    var tab = e.raw.lastIndexOf("\t"), whole = clean(e.raw);
    for (var i = 0; i < h.keys.length; i++) {
        var key = h.keys[i];
        if (h.mode !== "page" && whole === key) { return ""; } // TOC entry without page numbers
        if (h.mode === "none") { continue; }
        if (tab >= 0 && clean(e.raw.substring(0, tab)) === key) { return clean(e.raw.substring(tab + 1)); }
        if (whole.indexOf(key) === 0) { // no tab: the page number is glued to the entry
            var rest = clean(whole.substring(key.length).replace(/^[\s.]+/, ""));
            if (/^(\d+|[ivxlcdm]+)$/i.test(rest)) { return rest; } // digits only: a guess
        }
    }
    return null;
}

function checkTOC(doc) {
    var i, j, k, tocs = tocStories(doc);
    if (!tocs.length) { return "No table of contents found in this document."; }
    // paragraph styles of the TOC entries (not the title), to tell which TOC style made it
    var anyTitle = {}, inToc = {};
    for (i = 0; i < doc.tocStyles.length; i++) { if (doc.tocStyles[i].title) { anyTitle[clean(doc.tocStyles[i].title)] = true; } }
    for (i = 0; i < tocs.length; i++) {
        for (k = 0; k < tocs[i].paragraphs.length; k++) {
            var tp = tocs[i].paragraphs[k];
            if (k === 0 && anyTitle[clean(tp.contents)]) { continue; }
            inToc[stylePath(tp.appliedParagraphStyle)] = true;
        }
    }
    var used = [];
    for (i = 0; i < doc.tocStyles.length; i++) {
        var ts = doc.tocStyles[i];
        for (j = 0; j < ts.tocStyleEntries.length; j++) {
            var en = ts.tocStyleEntries[j], fs = en.formatStyle;
            var look = (typeof fs === "string" || !fs.name) ? en.name : stylePath(fs); // [Same Style]
            if (inToc[look]) { used.push(ts); break; }
        }
    }
    if (!used.length) {
        return "Could not tell which table of contents style made this table of contents: its lines use none of the entry styles in Layout > Table of Contents Styles. Nothing was checked.";
    }
    var set = { styles: {}, titles: {}, hidden: false }, wantBook = false;
    for (i = 0; i < used.length; i++) {
        if (used[i].title) { set.titles[clean(used[i].title)] = true; }
        if (used[i].includeBookDocuments) { wantBook = true; }
        if (used[i].includeHidden) { set.hidden = true; }
        for (j = 0; j < used[i].tocStyleEntries.length; j++) {
            var te = used[i].tocStyleEntries[j], m = te.pageNumberPosition == PageNumberPosition.NONE ? "none" : "page";
            set.styles[te.name] = (set.styles[te.name] && set.styles[te.name] !== m) ? "either" : m;
        }
    }
    var r = { toc: [], heads: [], skipped: 0, hidden: 0 }, notes = [];
    if (used.length > 1) {
        var names = [];
        for (i = 0; i < used.length; i++) { names.push(used[i].name); }
        notes.push("These TOC styles use the same entry styles, so their headings were combined: " + names.join(", ") + ".");
    }
    var me = pathOf(doc), book = null;
    if (wantBook && me) {
        for (i = 0; i < app.books.length && !book; i++) {
            for (j = 0; j < app.books[i].bookContents.length; j++) {
                if (app.books[i].bookContents[j].fullName.fsName === me) { book = app.books[i]; break; }
            }
        }
    }
    if (wantBook && !book) {
        return ["This TOC takes headings from a book. Open the book (.indb) that contains this document and run the script again."].concat(notes).join("\n");
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
        else if (pages[i] !== "" && pages[i] !== h.pg) { out.push("Page moved " + pages[i] + " -> " + h.pg + (book ? " (" + h.doc + ")" : "") + ": " + h.t); }
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
