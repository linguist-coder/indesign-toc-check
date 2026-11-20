# InDesign TOC Check

An ExtendScript for Adobe InDesign that compares the table of contents with the headings it was built from. It lists headings that are missing from the table of contents, page numbers that moved, and table of contents lines whose heading no longer exists. It changes nothing in the document.

If you have not edited the table of contents by hand, Layout > Update Table of Contents before export is enough. This script is for seeing what is out of date first.

- Video: https://youtu.be/fau60vtewbc
- Written guide: https://www.linguist-coder.com/2026/11/check-indesign-toc-against-headings.html

## Install

1. Download `CheckTOC.jsx` from the [latest release](https://github.com/linguist-coder/indesign-toc-check/releases/latest).
2. In InDesign, open the Scripts panel (Window > Utilities > Scripts).
3. Right-click the User folder and choose Reveal in Explorer (Reveal in Finder on macOS).
4. Copy the file into that folder. It appears in the Scripts panel under User.

## Use

Make the document that holds the table of contents active, then double-click `CheckTOC.jsx` in the Scripts panel. An alert lists what does not match:

```text
Not in TOC (p.3): Loading roll paper
Page moved 4 -> 6: Printing labels
No matching heading: Cleaning ... 5
```

If the table of contents style uses Include Book Documents, open the book (.indb) first. The script then reads the headings in every chapter. Chapters that are not open are opened without a window and closed without saving.

How it matches:

- The script infers which table of contents style made the table of contents by comparing the paragraph styles of its lines (not the title) with each style's entry styles, and reads only the styles that match. If two styles use the same entry styles, they are combined and the alert names them. If none match, the script stops and checks nothing.
- Styles in a style group are matched with the group name (Heads:Section and Sidebar:Section are different).
- The script reads each entry's page number setting. If the entry shows no page number, the whole contents line must be the heading and the page is not checked. If it shows page numbers, the text before the last tab must be the heading (the rest is the page number), or the line must start with the heading followed by digits or a roman numeral. The last one is a guess for entries with no tab, so use a tab as the separator if you can.
- Contents lines with no matching heading are shown whole, with " ... " for a tab.
- Numbered headings match with their current number in front ("1. Getting started") or without it. A line with an old number does not match.
- Headings with the same text are first paired with the line that has their own page number.
- Text is compared after line breaks, tabs and repeated spaces become one space, so a contents line that was shortened on purpose is reported as a mismatch.
- Headings on the pasteboard or in overset text are skipped and counted. Headings on hidden layers are skipped unless the style has Include Text on Hidden Layers on.
- If a book chapter file is missing, the alert lists it and does not say the book matches.

## Tested with

Adobe InDesign 2026 (21.6) on Windows, on test documents built by the scripts in [tests](tests) (run through COM with pywin32). Their output is in [tests/test-log.txt](tests/test-log.txt). Not tested on macOS, other InDesign versions, page numbers with section prefixes, page numbers before the entry, run-in entries, documents with more than one table of contents, chapters with unsaved changes, headings in overset text, or numbered headings with numbering settings changed in the TOC style.

## Custom scripts

Need a script for your own InDesign or Illustrator task? See [Work with me](https://www.linguist-coder.com/work-with-me.html).

## License

MIT. See [LICENSE](LICENSE).
