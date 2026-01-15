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
    this.stats = {
      total: 0,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      noImage: 0
    };
    this.failedBlocks = [];
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

  async fetchChannelInfo() {
    try {
      const response = await axios.get(`https://api.are.na/v2/channels/${this.slug}/thumb`);
      return response.data;
    } catch (error) {
      throw new Error(`Could not connect to Are.na channel "${this.slug}". Please check the channel name and try again.`);
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

      // Small delay between downloads to be polite
      await new Promise(r => setTimeout(r, 200));

      return { success: true, skipped: false };
    } catch (error) {
      this.stats.failed++;
      this.logFailure(block.id, block.title, error.message);
      console.error(chalk.red(`\n  ✗ Could not download image ${block.id}: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  async downloadInChunks(blocks, channelDir) {
    for (let i = 0; i < blocks.length; i += CONCURRENT_DOWNLOADS) {
      const chunk = blocks.slice(i, i + CONCURRENT_DOWNLOADS);
      const promises = chunk.map(block => this.downloadBlock(block, channelDir));
      
      await Promise.all(promises);
      
      const progress = Math.min(i + CONCURRENT_DOWNLOADS, blocks.length);
      process.stdout.write(
        chalk.cyan(`  Downloading: ${progress}/${blocks.length} images `) +
        chalk.green(`(✓ ${this.stats.downloaded} saved, ⊘ ${this.stats.skipped} skipped, ✗ ${this.stats.failed} failed)\r`)
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
      await makeDir(channelDir);
      console.log(chalk.gray(`💾 Saving to: ${channelDir}\n`));

      // Fetch all blocks
      const blocks = await this.fetchAllBlocks(channelInfo.length);
      
      // Filter for blocks with images
      const imageBlocks = blocks.filter(b => b.image);
      console.log(chalk.blue(`🖼️  Found ${imageBlocks.length} image${imageBlocks.length !== 1 ? 's' : ''} to download\n`));

      // Download
      console.log(chalk.blue('⬇️  Starting download...'));
      await this.downloadInChunks(imageBlocks, channelDir);

      // Summary
      console.log(chalk.green('\n✅ Download complete!'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white(`Total items:       ${this.stats.total}`));
      console.log(chalk.green(`Downloaded:        ${this.stats.downloaded}`));
      console.log(chalk.yellow(`Already saved:     ${this.stats.skipped}`));
      console.log(chalk.gray(`Non-images:        ${this.stats.noImage}`));
      console.log(chalk.red(`Failed:            ${this.stats.failed}`));
      console.log(chalk.gray('─'.repeat(50)));

      if (this.stats.failed > 0) {
        console.log(chalk.yellow('\n⚠️  Some downloads failed. Run the same command again to retry failed downloads.'));
        console.log(chalk.gray(`Failed downloads logged to: ${this.logPath}`));
        this.writefailedLog();
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  }
}

// CLI
yargs(hideBin(process.argv))
  .scriptName('arena-dl')
  .usage('$0 <command> [options]')
  .command(
    'get <slug> [dir]',
    'Download all images from an Are.na channel',
    (yargs) => {
      const config = loadConfig();
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
        });
    },
    async (argv) => {
      // Extract slug from URL if provided
      let slug = argv.slug;
      const urlMatch = slug.match(/are\.na\/[^/]+\/([^/]+)/);
      if (urlMatch) {
        slug = urlMatch[1];
        console.log(chalk.gray(`📎 Extracted channel name from URL: ${slug}`));
      }

      const downloader = new ArenaDownloader(slug, argv.dir, {
        skipExisting: !argv.force
      });

      await downloader.download();
    }
  )
  .example('$0 get frog', 'Download the "frog" channel')
  .example('$0 get frog ~/Pictures/arena', 'Download to a specific folder')
  .example('$0 get https://www.are.na/user/channel-slug', 'Download using full URL')
  .example('$0 get frog --force', 'Re-download everything, even existing files')
  .demandCommand(1, 'Please specify a command (try: get <channel-name>)')
  .help()
  .alias('h', 'help')
  .alias('v', 'version')
  .parse();
