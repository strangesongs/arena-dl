#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const makeDir = require('make-dir');
const mime = require('mime');
const parameterize = require('parameterize');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const PER_PAGE = 100;
const CONCURRENT_DOWNLOADS = 5;

// Load config from ~/.arena-dlrc
function loadConfig() {
  const configPath = path.join(process.env.HOME, '.arena-dlrc');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      // Expand ~ in paths
      if (config.outputDir) {
        config.outputDir = config.outputDir.replace(/^~/, process.env.HOME);
      }
      return config;
    }
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Warning: Could not load config from ${configPath}`));
  }
  return {};
}

// Browser-like headers to avoid WAF blocks
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.are.na/',
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Mode': 'no-cors',
  'Sec-Fetch-Site': 'cross-site'
};

class ArenaDownloader {
  constructor(slug, outputDir, options = {}) {
    this.slug = slug;
    this.outputDir = outputDir;
    this.saveMetadata = false;
    this.skipExisting = options.skipExisting !== false;
    this.dryRun = options.dryRun || false;
    this.exportFormat = options.exportFormat;
    this.stats = {
      total: 0,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      noImage: 0
    };
    this.failedBlocks = [];
    this.downloadedBlocks = [];
    this.logPath = path.join(outputDir, `.arena-dl-${slug}.log`);
  }

  logFailure(blockId, title, error) {
    this.failedBlocks.push({ blockId, title, error });
  }

  writefailedLog() {
    if (this.failedBlocks.length > 0) {
      const logContent = this.failedBlocks
        .map(b => `${b.blockId} - ${b.title}: ${b.error}`)
        .join('\n');
      fs.writeFileSync(this.logPath, logContent);
    }
  }

  exportList() {
    if (!this.exportFormat) return;

    const exportDir = path.join(this.outputDir, this.slug);
    const exportPath = path.join(exportDir, `${this.slug}-list.${this.exportFormat}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    if (this.exportFormat === 'json') {
      const data = this.downloadedBlocks.map(block => ({
        id: block.id,
        title: block.title,
        url: block.image.original.url,
        downloaded_at: new Date().toISOString()
      }));
      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
    } else if (this.exportFormat === 'csv') {
      const header = 'ID,Title,URL,Downloaded\n';
      const rows = this.downloadedBlocks.map(block => 
        `${block.id},"${block.title}",${block.image.original.url},${new Date().toISOString()}`
      ).join('\n');
      fs.writeFileSync(exportPath, header + rows);
    }

    console.log(chalk.green(`✓ List exported to: ${exportPath}`));
  }

  async fetchChannelInfo() {
    try {
      const response = await axios.get(`https://api.are.na/v2/channels/${this.slug}/thumb`);
      return response.data;
    } catch (error) {
      const msg = error.response?.status === 404 
        ? `Channel "${this.slug}" not found. Check the name and try again.` 
        : `Could not connect to Are.na. Check your internet connection.`;
      throw new Error(msg);
    }
  }

  async fetchPage(page) {
    try {
      const response = await axios.get(
        `https://api.are.na/v2/channels/${this.slug}/contents`,
        { params: { page, per: PER_PAGE } }
      );
      return response.data.contents || [];
    } catch (error) {
      console.error(chalk.yellow(`⚠ Unable to retrieve page ${page}: ${error.message}`));
      return [];
    }
  }

  async fetchAllBlocks(totalBlocks) {
    const totalPages = Math.ceil(totalBlocks / PER_PAGE);
    console.log(chalk.blue(`📥 Loading channel content (${totalPages} page${totalPages > 1 ? 's' : ''})...`));
    
    const allBlocks = [];
    for (let page = 1; page <= totalPages; page++) {
      process.stdout.write(chalk.gray(`  Reading page ${page} of ${totalPages}...\r`));
      const blocks = await this.fetchPage(page);
      allBlocks.push(...blocks);
      // Small delay between pages to be polite
      if (page < totalPages) await new Promise(r => setTimeout(r, 100));
    }
    process.stdout.write('\n');
    
    return allBlocks;
  }

  getFilename(block) {
    const title = block.title ? parameterize(block.title) : block.id.toString();
    const ext = mime.getExtension(block.image.content_type) || 'jpg';
    return `${block.id}_${title}.${ext}`;
  }

  async downloadBlock(block, channelDir) {
    // Skip blocks without images
    if (!block.image) {
      this.stats.noImage++;
      return { success: true, skipped: true, reason: 'no-image' };
    }

    const filename = this.getFilename(block);
    const filepath = path.join(channelDir, filename);

    // Skip if file exists and is not empty
    if (this.skipExisting && fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      if (stats.size > 0) {
        this.stats.skipped++;
        return { success: true, skipped: true, reason: 'exists' };
      }
    }

    try {
      // In dry-run mode, just count and don't download
      if (this.dryRun) {
        this.stats.downloaded++;
        this.downloadedBlocks.push(block);
        return { success: true, skipped: false };
      }

      const response = await axios.get(block.image.original.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: BROWSER_HEADERS,
        maxRedirects: 5
      });

      // Check if we actually got data
      if (!response.data || response.data.length === 0) {
        throw new Error('Received empty response');
      }

      fs.writeFileSync(filepath, response.data);
      this.stats.downloaded++;
      this.downloadedBlocks.push(block);

      // Small delay between downloads to be polite
      await new Promise(r => setTimeout(r, 200));

      return { success: true, skipped: false };
    } catch (error) {
      this.stats.failed++;
      this.logFailure(block.id, block.title, error.message);
      const msg = error.message.includes('empty') 
        ? `Image ${block.id} returned empty (CDN issue?)`
        : error.message;
      console.error(chalk.red(`\n  ✗ ${msg}`));
      return { success: false, error: error.message };
    }
  }

  async downloadInChunks(blocks, channelDir) {
    const startTime = Date.now();
    let downloadedBytes = 0;
    
    for (let i = 0; i < blocks.length; i += CONCURRENT_DOWNLOADS) {
      const chunk = blocks.slice(i, i + CONCURRENT_DOWNLOADS);
      const promises = chunk.map(block => this.downloadBlock(block, channelDir));
      
      await Promise.all(promises);
      
      const progress = Math.min(i + CONCURRENT_DOWNLOADS, blocks.length);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (downloadedBytes / 1024 / 1024 / elapsed).toFixed(2);
      const remaining = blocks.length - progress;
      const eta = remaining > 0 ? Math.round((elapsed / progress) * remaining) : 0;
      
      process.stdout.write(
        chalk.cyan(`  [${progress}/${blocks.length}] `) +
        chalk.green(`✓ ${this.stats.downloaded} | `) +
        chalk.yellow(`⊘ ${this.stats.skipped} | `) +
        chalk.red(`✗ ${this.stats.failed} | `) +
        chalk.gray(`${rate} MB/s | ETA ${eta}s\r`)
      );
    }
    process.stdout.write('\n');
  }

  async download() {
    try {
      // Fetch channel info
      console.log(chalk.blue(`\n🔍 Looking up Are.na channel: "${this.slug}"`));
      const channelInfo = await this.fetchChannelInfo();
      
      console.log(chalk.blue(`📂 Channel name: "${channelInfo.title}"`));
      console.log(chalk.blue(`📊 Total items in channel: ${channelInfo.length}`));
      
      this.stats.total = channelInfo.length;

      // Create output directory
      const channelDir = path.join(this.outputDir, this.slug);
      if (!this.dryRun) {
        await makeDir(channelDir);
      }
      console.log(chalk.gray(`💾 ${this.dryRun ? 'Would save' : 'Saving'} to: ${channelDir}\n`));

      // Fetch all blocks
      const blocks = await this.fetchAllBlocks(channelInfo.length);
      
      // Filter for blocks with images
      const imageBlocks = blocks.filter(b => b.image);
      console.log(chalk.blue(`🖼️  Found ${imageBlocks.length} image${imageBlocks.length !== 1 ? 's' : ''} ${this.dryRun ? 'to be downloaded' : 'to download'}\n`));

      // Download
      console.log(chalk.blue(`${this.dryRun ? '🔍' : '⬇️'}  ${this.dryRun ? 'Previewing' : 'Starting'} download...`));
      await this.downloadInChunks(imageBlocks, channelDir);

      // Summary
      console.log(chalk.green(`\n✅ ${this.dryRun ? 'Dry-run' : 'Download'} complete!`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white(`Total items:       ${this.stats.total}`));
      console.log(chalk.green(`Would download:    ${this.stats.downloaded}`));
      console.log(chalk.yellow(`Already saved:     ${this.stats.skipped}`));
      console.log(chalk.gray(`Non-images:        ${this.stats.noImage}`));
      console.log(chalk.red(`Failed:            ${this.stats.failed}`));
      console.log(chalk.gray('─'.repeat(50)));

      if (this.stats.failed > 0) {
        console.log(chalk.yellow('\n⚠️  Some downloads failed. Run the same command again to retry failed downloads.'));
        console.log(chalk.gray(`Failed downloads logged to: ${this.logPath}`));
        this.writefailedLog();
      }

      // Export if requested
      this.exportList();

    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      console.error(chalk.gray(`📖 See docs: https://github.com/strangesongs/arena-chan-dl#error-handling\n`));
      process.exit(1);
    }
  }
}

// CLI
const config = loadConfig();

yargs(hideBin(process.argv))
  .scriptName('arena-dl')
  .usage('$0 [channel] [options]')
  .version(false)
  .command(
    '$0 [slug] [dir]',
    'Download images from an Are.na channel',
    (yargs) => {
      return yargs
        .positional('slug', {
          describe: 'Are.na channel name or full URL',
          type: 'string'
        })
        .positional('dir', {
          describe: 'Where to save downloaded images',
          type: 'string',
          default: config.outputDir || './downloads'
        })
        .option('force', {
          describe: 'Re-download images that already exist',
          type: 'boolean',
          default: false
        })
        .option('dry-run', {
          describe: 'Show what would be downloaded without downloading',
          type: 'boolean',
          default: false
        })
        .option('watch', {
          describe: 'Check for new images every N minutes',
          type: 'number'
        })
        .option('format', {
          describe: 'Export download list (csv, json)',
          type: 'string',
          choices: ['csv', 'json']
        });
    },
    async (argv) => {
      if (!argv.slug) {
        console.log(chalk.blue('\n🎯 Interactive Mode\n'));
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
        
        try {
          const slug = await question(chalk.cyan('Channel name or URL: '));
          const dir = await question(chalk.cyan(`Output directory (${config.outputDir || './downloads'}): `));
          
          rl.close();
          
          argv.slug = slug;
          argv.dir = dir || config.outputDir || './downloads';
        } catch (err) {
          rl.close();
          return;
        }
      }

      // Extract slug from URL if provided
      let slug = argv.slug;
      const urlMatch = slug.match(/are\.na\/[^/]+\/([^/]+)/);
      if (urlMatch) {
        slug = urlMatch[1];
        console.log(chalk.gray(`📎 Extracted channel name from URL: ${slug}`));
      }

      if (argv.dryRun) {
        console.log(chalk.yellow('\n🔍 Dry-run mode: showing what would be downloaded\n'));
      }

      const downloader = new ArenaDownloader(slug, argv.dir, {
        skipExisting: !argv.force,
        dryRun: argv.dryRun,
        exportFormat: argv.format
      });

      if (argv.watch) {
        console.log(chalk.blue(`⏱️  Watch mode: checking every ${argv.watch} minute(s)\n`));
        await downloader.download();
        
        const intervalMs = argv.watch * 60 * 1000;
        setInterval(async () => {
          console.log(chalk.gray(`\n[${new Date().toLocaleTimeString()}] Checking for updates...\n`));
          await downloader.download();
        }, intervalMs);
      } else {
        await downloader.download();
      }
    }
  )
  .example('$0 architecture-portfolio', 'Download the "architecture-portfolio" channel')
  .example('$0 design-inspiration ~/archives', 'Download to a specific folder')
  .example('$0 https://www.are.na/user/channel-slug', 'Download using full URL')
  .example('$0 research --force', 'Re-download everything')
  .example('$0 gallery --dry-run', 'Preview what would download')
  .example('$0 inspiration --watch 30', 'Check for updates every 30 minutes')
  .example('$0 collection --format json', 'Export list as JSON')
  .option('help', {
    alias: 'h',
    describe: 'Show help'
  })
  .option('version', {
    alias: 'v',
    describe: 'Show version'
  })
  .parse();
