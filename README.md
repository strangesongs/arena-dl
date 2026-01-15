# arena-dl v2.0

**Rebuilt for reliability** - A CLI tool for downloading and archiving images from [Are.na](https://are.na) channels.

> A maintained fork of [tg-z/arena-chan-dl](https://github.com/tg-z/arena-chan-dl) with improved UX, global installation, and simplified workflow.

## Features

✅ **Reliable downloads** - Browser-like headers bypass CDN blocks  
✅ **Progress tracking** - Real-time progress with detailed statistics  
✅ **Descriptive filenames** - Images saved with block ID and title  
✅ **Resume capability** - Automatically skips already downloaded files  
✅ **Error recovery** - Continues on failures, shows summary at end  
✅ **Rate limiting** - Polite delays between requests  
✅ **Global installation** - Install once, run from anywhere  

## Installation

```bash
# Clone the repository
git clone https://github.com/strangesongs/arena-chan-dl
cd arena-chan-dl

# Install dependencies
npm install

# Install globally (so you can run from anywhere)
npm link
```

Now you can use `arena-dl` from any directory on your system!

## Usage

```bash
# Basic usage - download to ./downloads
arena-dl get <channel-slug>

# Specify output directory
arena-dl get <channel-slug> /path/to/output

# Use full URL (slug will be extracted)
arena-dl get https://www.are.na/user/channel-slug

# Force re-download existing files
arena-dl get <channel-slug> --force
```

## Examples

```bash
# Download "frog" channel to current directory's downloads folder
arena-dl get frog

# Download to specific directory
arena-dl get frog ~/Documents/arena-archive

# Download with full URL
arena-dl get https://www.are.na/period-6wkfhxbqle8/we-take-care-of-each-other-xr-skwcd1ta

# Re-download everything (ignore existing files)
arena-dl get frog --force
```

## Output Structure

```
downloads/
└── channel-slug/
    ├── 12345_image-title.jpg
    ├── 67890_another-image.png
    └── ...
```

Image files are named with their block ID and title for easy identification.

## What Changed in v2.0

- ✅ Fixed yargs integration (works with modern versions)
- ✅ Fixed chalk compatibility (v4 instead of v5 ESM)
- ✅ Added browser headers to bypass CloudFront WAF
- ✅ Modern async/await (no more promise chains)
- ✅ Proper error handling and recovery
- ✅ Real-time progress tracking
- ✅ Resume capability (skip existing files)
- ✅ Rate limiting to be CDN-friendly
- ✅ File size validation (detects empty downloads)
- ✅ Support for full URL input

## License

MIT

## Credits

Rebuilt from [tg-z/arena-chan-dl](https://github.com/tg-z/arena-chan-dl)  
Original fork of [aredotna/download-arena-channel](https://github.com/aredotna/download-arena-channel)
