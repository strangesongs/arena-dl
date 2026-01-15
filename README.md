# arena-dl

A CLI tool for downloading images from [Are.na](https://are.na) channels.

## Requirements

- Node.js >= 14.0.0
- npm

## Features

- Browser-like headers bypass CDN blocks
- Progress tracking with speed and ETA
- Resume on re-run (skips existing files)
- Rate limiting
- Full URL support
- Interactive mode
- Watch mode for periodic updates
- Export to CSV or JSON
- Dry-run preview
- Config file support
- Failed download logging
- Block type filtering (images, links, embeds, attachments, text)
- Metadata archival with descriptions and sources
- Handles 500+ item galleries with pagination

## Installation

```bash
git clone https://github.com/strangesongs/arena-chan-dl
cd arena-chan-dl
npm install
npm link
```

## Usage

```bash
# Simplest: just the channel name
arena-dl architecture-portfolio

# Specify output directory
arena-dl design-inspiration ~/archives

# Use full Are.na URL
arena-dl https://www.are.na/user/channel-slug

# Re-download everything
arena-dl research --force

# Preview what would download
arena-dl gallery --dry-run

# Check for updates every 30 minutes
arena-dl inspiration --watch 30

# Export list as JSON or CSV
arena-dl collection --format json
arena-dl collection --format csv

# Interactive mode (no args)
arena-dl
```

## Examples

```bash
arena-dl architecture-portfolio
arena-dl design-inspiration ~/Documents/arena-archive
arena-dl https://www.are.na/period-6wkfhxbqle8/we-take-care-of-each-other-xr-skwcd1ta
arena-dl research --force
arena-dl gallery --dry-run
arena-dl inspiration --watch 30
arena-dl collection --format json
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

## Watch Mode

Continuously check a channel for new content:

```bash
arena-dl inspiration --watch 30
```

Updates every 30 minutes. Useful for archiving channels that get regularly updated.

## Export

Save a list of downloaded images:

```bash
# JSON format
arena-dl collection --format json
# Creates: downloads/collection/collection-list.json

# CSV format
arena-dl collection --format csv
# Creates: downloads/collection/collection-list.csv
```

## Block Type Filtering

Filter downloads by content type:

```bash
# Images only (default)
arena-dl gallery

# Images and links
arena-dl gallery --block-types image,link

# All types (images, links, embeds, attachments, text)
arena-dl gallery --block-types image,link,embed,attachment,text

# Links only
arena-dl gallery --block-types link
```

Supported types: `image`, `link`, `embed`, `attachment`, `text`

## Metadata Archival

Save metadata alongside downloads for research/preservation:

```bash
# Save descriptions and timestamps
arena-dl research --include-metadata

# Also track original source URLs
arena-dl research --include-metadata --with-sources
```

Each downloaded file gets a `.json` metadata file:

```json
{
  "id": 21652327,
  "title": "Image title",
  "description": "Research notes or captions",
  "type": "Image",
  "created_at": "2023-05-02T18:04:53.953Z",
  "updated_at": "2025-10-07T18:54:22.752Z",
  "source": {
    "title": "Original source",
    "url": "https://example.com"
  },
  "image_url": "https://d2w9rnfcy7mm78.cloudfront.net/...",
  "content_type": "image/png"
}
```

## Archival Workflow Example

Complete research archival with all metadata:

```bash
# Download everything with full context
arena-dl my-research \
  --block-types image,link,embed,attachment,text \
  --include-metadata \
  --with-sources \
  --format json

# Result structure:
# downloads/my-research/
# ├── 12345_title.jpg
# ├── 12345_title.json          (metadata)
# ├── 67890_another.png
# ├── 67890_another.json        (metadata)
# ├── my-research-list.json     (inventory)
# └── my-research.log           (failed items)
```

This creates a complete archive with:
- All content types
- Metadata for each item (descriptions, dates, sources)
- Inventory file for easy reference
- Failed download log for follow-up

## Dry-Run

Preview what would be downloaded without actually downloading:

```bash
arena-dl gallery --dry-run
```

## Interactive Mode

Run without arguments for interactive prompts:

```bash
arena-dl
? Channel name or URL: architecture-portfolio
? Output directory (./downloads): 
```

## What's New

- Simplified command: `arena-dl channel-name` (no "get")
- Interactive mode for beginners
- Watch mode for continuous archiving
- Export to JSON or CSV
- Dry-run preview mode
- Improved progress with speed and ETA
- Better error messages with doc links

## Credits

Inspired by [aredotna/download-arena-channel](https://github.com/aredotna/download-arena-channel) and [tg-z/arena-chan-dl](https://github.com/tg-z/arena-chan-dl).

MIT License
