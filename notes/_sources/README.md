# Notes Source

This directory contains the source files for the Notes section.
To build the notes and update the website, run the following from the root of the repository (`kalebbennaveed.github.io`):

```bash
jupyter-book build notes_src/
rm -rf notes
mv notes_src/_build/html notes
```
