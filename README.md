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

Headings on the pasteboard or in overset text are skipped and counted, because InDesign leaves them out of the table of contents too. Text is compared after line breaks, tabs and repeated spaces become one space, so a contents line that was shortened on purpose is reported as a mismatch.

## Tested with

Adobe InDesign 2026 (21.6) on Windows, on test documents built by the scripts in [tests](tests) (run through COM with pywin32). Their output is in [tests/test-log.txt](tests/test-log.txt). Not tested on macOS, other InDesign versions, page numbers with section prefixes, page numbers before the entry, run-in entries, or documents with more than one table of contents.

## Custom scripts

Need a script for your own InDesign or Illustrator task? See [Work with me](https://www.linguist-coder.com/work-with-me.html).

## License

MIT. See [LICENSE](LICENSE).
