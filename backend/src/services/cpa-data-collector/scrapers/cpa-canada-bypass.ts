/**
 * CPA Canada Bypass Strategies
 * Implements multiple methods to collect resources despite Cloudflare protection
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CPACollectorConfig } from '../config/cpa-collector-config';
import { ensureDirectory, fileExists } from '../utils/file-utils';

const execPromise = promisify(exec);

// Configure stealth plugin
puppeteer.use(StealthPlugin());

export interface BypassResult {
  success: boolean;
  method?: string;
  content?: Buffer;
  size?: number;
  url: string;
  error?: string;
  attemptedMethods?: Array<{ method: string; error: string }>;
  recommendation?: string;
}

export class CPACanadaBypass {
  private config: CPACollectorConfig;
  private successfulMethods: string[] = [];
  private failedMethods: Array<{ method: string; error: string }> = [];

  constructor(config: CPACollectorConfig) {
    this.config = config;
  }

  async fetchResource(url: string): Promise<BypassResult> {
    const strategies = [
      { name: 'wget', fn: () => this.tryWgetMethod(url) },
      { name: 'curl', fn: () => this.tryCurlMethod(url) },
      { name: 'puppeteer-stealth', fn: () => this.tryPuppeteerWithStealth(url) },
      { name: 'node-fetch', fn: () => this.tryNodeFetch(url) },
      { name: 'direct-api', fn: () => this.tryDirectAPI(url) }
    ];
    
    this.failedMethods = [];
    
    for (const strategy of strategies) {
      try {
        console.log(`Trying ${strategy.name} method for ${url}...`);
        const result = await strategy.fn();
        if (result.success) {
          this.successfulMethods.push(result.method!);
          console.log(`Success with ${strategy.name} method!`);
          return result;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.failedMethods.push({
          method: strategy.name,
          error: errorMessage
        });
        console.error(`${strategy.name} failed:`, errorMessage);
      }
    }
    
    return {
      success: false,
      url: url,
      attemptedMethods: this.failedMethods,
      recommendation: 'Manual download required. Please download the file manually and place it in the snapshots/CPACanada directory.'
    };
  }

  private async tryWgetMethod(url: string): Promise<BypassResult> {
    const tempDir = path.join(this.config.tempDir, 'wget');
    await ensureDirectory(tempDir);
    const outputFile = path.join(tempDir, 'download.pdf');
    
    // Remove existing file if present
    try {
      await fs.unlink(outputFile);
    } catch {}
    
    const wgetCommand = `
      wget --user-agent="${this.config.userAgent}" \
           --header="Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" \
           --header="Accept-Language: en-US,en;q=0.5" \
           --header="Accept-Encoding: gzip, deflate, br" \
           --header="Cache-Control: no-cache" \
           --header="Pragma: no-cache" \
           --header="DNT: 1" \
           --header="Connection: keep-alive" \
           --header="Upgrade-Insecure-Requests: 1" \
           --header="Sec-Fetch-Dest: document" \
           --header="Sec-Fetch-Mode: navigate" \
           --header="Sec-Fetch-Site: none" \
           --header="Sec-Fetch-User: ?1" \
           --no-check-certificate \
           --timeout=30 \
           --tries=3 \
           --wait=2 \
           --random-wait \
           -O "${outputFile}" \
           "${url}"
    `.replace(/\n/g, ' ').trim();
    
    try {
      const { stdout, stderr } = await execPromise(wgetCommand);
      
      // Check if file was downloaded
      if (await fileExists(outputFile)) {
        const stats = await fs.stat(outputFile);
        if (stats.size > 0) {
          const content = await fs.readFile(outputFile);
          
          // Check if it's a valid PDF
          if (content.toString('utf-8', 0, 4) === '%PDF') {
            return {
              success: true,
              method: 'wget',
              content: content,
              size: stats.size,
              url: url
            };
          }
        }
      }
    } catch (error) {
      throw new Error(`Wget failed: ${error}`);
    }
    
    throw new Error('Wget download failed or invalid PDF');
  }

  private async tryCurlMethod(url: string): Promise<BypassResult> {
    const tempDir = path.join(this.config.tempDir, 'curl');
    await ensureDirectory(tempDir);
    const outputFile = path.join(tempDir, 'download.pdf');
    
    const curlCommand = `
      curl -L \
           -H "User-Agent: ${this.config.userAgent}" \
           -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" \
           -H "Accept-Language: en-US,en;q=0.9" \
           -H "Accept-Encoding: gzip, deflate, br" \
           -H "DNT: 1" \
           -H "Connection: keep-alive" \
           -H "Upgrade-Insecure-Requests: 1" \
           --compressed \
           --max-time 30 \
           --retry 3 \
           --retry-delay 2 \
           -o "${outputFile}" \
           "${url}"
    `.replace(/\n/g, ' ').trim();
    
    try {
      await execPromise(curlCommand);
      
      if (await fileExists(outputFile)) {
        const content = await fs.readFile(outputFile);
        if (content.length > 0 && content.toString('utf-8', 0, 4) === '%PDF') {
          return {
            success: true,
            method: 'curl',
            content: content,
            size: content.length,
            url: url
          };
        }
      }
    } catch (error) {
      throw new Error(`Curl failed: ${error}`);
    }
    
    throw new Error('Curl download failed or invalid PDF');
  }

  private async tryPuppeteerWithStealth(url: string): Promise<BypassResult> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    
    try {
      const page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(this.config.userAgent);
      
      // Set additional headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });
      
      // Enable request interception to handle PDF downloads
      await page.setRequestInterception(true);
      
      let pdfBuffer: Buffer | null = null;
      
      page.on('request', (request) => {
        request.continue();
      });
      
      page.on('response', async (response) => {
        const contentType = response.headers()['content-type'];
        if (contentType && contentType.includes('application/pdf')) {
          pdfBuffer = await response.buffer();
        }
      });
      
      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // Wait a bit for any redirects
      await page.waitForTimeout(5000);
      
      if (pdfBuffer && pdfBuffer.toString('utf-8', 0, 4) === '%PDF') {
        return {
          success: true,
          method: 'puppeteer-stealth',
          content: pdfBuffer,
          size: pdfBuffer.length,
          url: url
        };
      }
      
      // If no PDF in response, check if there's a download link
      const downloadLink = await page.$('a[href$=".pdf"]');
      if (downloadLink) {
        const href = await page.evaluate(el => el.href, downloadLink);
        // Recursively try to fetch the direct PDF link
        return this.fetchResource(href);
      }
      
    } finally {
      await browser.close();
    }
    
    throw new Error('Puppeteer stealth method failed to retrieve PDF');
  }

  private async tryNodeFetch(url: string): Promise<BypassResult> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      follow: 20, // Follow up to 20 redirects
      compress: true
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const buffer = await response.buffer();
    
    // Check if it's a valid PDF
    if (buffer.length > 0 && buffer.toString('utf-8', 0, 4) === '%PDF') {
      return {
        success: true,
        method: 'node-fetch',
        content: buffer,
        size: buffer.length,
        url: url
      };
    }
    
    throw new Error('Node-fetch failed to retrieve valid PDF');
  }

  private async tryDirectAPI(url: string): Promise<BypassResult> {
    // Check if CPA Canada has any public API endpoints
    // This is a placeholder for potential future API access
    
    // For now, we'll check if there are alternative URLs or patterns
    const alternativePatterns = [
      // Try without https
      url.replace('https://', 'http://'),
      // Try with www if not present
      url.includes('www.') ? url : url.replace('://', '://www.'),
      // Try direct media subdomain
      url.replace('www.cpacanada.ca', 'media.cpacanada.ca'),
      // Try CDN pattern
      url.replace('www.cpacanada.ca', 'cdn.cpacanada.ca')
    ];
    
    for (const altUrl of alternativePatterns) {
      if (altUrl !== url) {
        try {
          const result = await this.tryNodeFetch(altUrl);
          if (result.success) {
            result.method = 'direct-api-alternative';
            return result;
          }
        } catch {}
      }
    }
    
    throw new Error('No alternative API endpoints found');
  }

  getSuccessfulMethods(): string[] {
    return this.successfulMethods;
  }

  getFailedMethods(): Array<{ method: string; error: string }> {
    return this.failedMethods;
  }
}