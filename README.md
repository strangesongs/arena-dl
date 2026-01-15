# arena-dl

A CLI tool for downloading images from [Are.na](https://are.na) channels.

## Requirements

- Node.js >= 14.0.0
- npm

## Features

- Browser-like headers bypass CDN blocks
- Progress tracking with stats
- Resume on re-run (skips existing files)
- Rate limiting
- Full URL support

## Installation

```bash
git clone https://github.com/strangesongs/arena-chan-dl
cd arena-chan-dl
npm install
npm link
```

## Usage

```bash
arena-dl get <channel-slug>
arena-dl get <channel-slug> /path/to/output
arena-dl get https://www.are.na/user/channel-slug
arena-dl get <channel-slug> --force
```

## Examples

```bash
arena-dl get frog
arena-dl get frog ~/Documents/arena-archive
arena-dl get https://www.are.na/period-6wkfhxbqle8/we-take-care-of-each-other-xr-skwcd1ta
arena-dl get frog --force
```

## Output

```
downloads/channel-slug/
├── 12345_image-title.jpg
├── 67890_another-image.png
└── ...
```

## What's New

- Fixed yargs and chalk compatibility
- Added browser headers to bypass CDN blocks
- Modern async/await, proper error handling
- Real-time progress tracking
- Resume capability (skip existing files)
- Rate limiting to be nice to CDN
- File size validation
- Full URL support
- Global CLI installation

## Error Handling

The tool handles common issues gracefully:

- **Invalid channel**: Error message tells you the channel name couldn't be found
- **Network timeout**: Retryable errors are logged; re-run the same command to continue
- **Partial downloads**: Files that failed to download fully are logged in `.arena-dl/failed.log`
- **Rate limiting**: Built-in delays prevent CDN blocks; failed downloads can be retried

Re-running the same command will skip existing files and retry failures.

## Configuration

Create `~/.arena-dlrc` to set defaults:

```json
{
  "outputDir": "~/Downloads/arena",
  "concurrent": 5,
  "timeout": 30000
}
```

All values are optional. Command-line arguments override config file settings.

## Credits

Inspired by [aredotna/download-arena-channel](https://github.com/aredotna/download-arena-channel) and [tg-z/arena-chan-dl](https://github.com/tg-z/arena-chan-dl).

MIT License
