# InDesign TOC Check

An ExtendScript for Adobe InDesign that compares the table of contents with the headings it was built from. It lists headings that are missing from the table of contents, page numbers that moved, and table of contents lines whose heading no longer exists. It changes nothing in the document.

If you have not edited the table of contents by hand, Layout > Update Table of Contents before export is enough. This script is for seeing what is out of date first.

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
No matching heading: Cleaning
```

If the table of contents style uses Include Book Documents, open the book (.indb) first. The script then reads the headings in every chapter. Chapters that are not open are opened without a window and closed without saving.

How it matches:

- The script reads only the table of contents style that made the table of contents, judged by the paragraph styles in it. If two styles use the same entry styles, they are combined and the alert says so.
- Styles in a style group are matched with the group name (Heads:Section and Sidebar:Section are different).
- The page number is what follows the last tab. Without a tab, the script takes trailing digits or a roman numeral after the heading text. That is a guess, so use a tab as the separator if you can.
- Headings with the same text are first paired with the line that has their own page number.
- Text is compared after line breaks, tabs and repeated spaces become one space, so a contents line that was shortened on purpose is reported as a mismatch.
- Headings on the pasteboard or in overset text are skipped and counted. Headings on hidden layers are skipped unless the style has Include Text on Hidden Layers on.
- If a book chapter file is missing, the alert lists it and does not say the book matches.

## Tested with

Adobe InDesign 2026 (21.6) on Windows, on test documents built by the scripts in [tests](tests) (run through COM with pywin32). Their output is in [tests/test-log.txt](tests/test-log.txt). Not tested on macOS, other InDesign versions, page numbers with section prefixes, page numbers before the entry, run-in entries, documents with more than one table of contents, chapters with unsaved changes, headings in overset text, or numbering settings other than the default.

## Custom scripts

Need a script for your own InDesign or Illustrator task? See [Work with me](https://www.linguist-coder.com/work-with-me.html).

## License

MIT. See [LICENSE](LICENSE).
