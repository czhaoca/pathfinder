/**
 * CPA BC Web Scraper
 * Collects PERT resources from CPA BC website
 */

import puppeteer, { Browser, Page } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { CPACollectorConfig } from '../config/cpa-collector-config';
import { ResourceMetadata, DocumentType, CompetencyClassification } from '../utils/resource-metadata';
import { ensureDirectory, calculateSHA256, generateFilename } from '../utils/file-utils';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export class CPAWebScraper {
  private config: CPACollectorConfig;
  private browser: Browser | null = null;
  private resourceMetadata: ResourceMetadata[] = [];

  constructor(config: CPACollectorConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        `--user-agent=${this.config.userAgent}`
      ]
    });
  }

  async scrapeCPABC(): Promise<ResourceMetadata[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const page = await this.browser.newPage();
    
    // Set additional headers to bypass detection
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    });

    try {
      // Navigate to CPA BC experience page
      console.log('Navigating to CPA BC experience page...');
      await page.goto(
        'https://www.bccpa.ca/become-a-cpa/about-the-program/experience/current-candidates/',
        {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        }
      );

      // Extract all PDF links related to PERT
      console.log('Extracting PDF links...');
      const pdfLinks = await page.evaluate(() => {
        const links: Array<{ url: string; text: string; context: string }> = [];
        const anchorElements = document.querySelectorAll('a[href$=".pdf"]');
        
        anchorElements.forEach(anchor => {
          const href = (anchor as HTMLAnchorElement).href;
          const text = anchor.textContent?.trim() || '';
          
          // Filter for PERT-related content
          const pertKeywords = ['PERT', 'experience', 'competenc', 'EVR', 'guide', 'practical', 'verification'];
          const isRelevant = pertKeywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase()) ||
            href.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (isRelevant) {
            links.push({
              url: href,
              text: text,
              context: anchor.closest('p')?.textContent || ''
            });
          }
        });
        
        return links;
      });

      console.log(`Found ${pdfLinks.length} PERT-related PDF links`);

      // Process each PDF
      for (const link of pdfLinks) {
        try {
          await this.downloadAndProcessPDF(link);
        } catch (error) {
          console.error(`Failed to process ${link.url}:`, error);
        }
      }

    } finally {
      await page.close();
    }

    return this.resourceMetadata;
  }

  private async downloadAndProcessPDF(linkInfo: { url: string; text: string; context: string }): Promise<void> {
    const { url, text, context } = linkInfo;
    
    // Generate filename from URL
    const filename = generateFilename(url);
    const dirPath = path.join(this.config.snapshotDir, 'CPABC');
    const filepath = path.join(dirPath, filename);
    
    // Ensure directory exists
    await ensureDirectory(dirPath);
    
    console.log(`Downloading: ${filename}`);
    
    // Download PDF
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'application/pdf,*/*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    
    // Save PDF
    await fs.writeFile(filepath, buffer);
    
    // Calculate checksum
    const sha256 = await calculateSHA256(filepath);
    
    // Create metadata
    const metadata: ResourceMetadata = {
      id: `cpabc_${filename.replace('.pdf', '')}`,
      url: url,
      filename: filename,
      title: text,
      context: context,
      sha256: sha256,
      timestamp: new Date().toISOString(),
      fileSize: buffer.length,
      source: 'CPABC',
      documentType: this.classifyDocument(filename, text),
      competencyClassification: this.classifyCompetency(text, context),
      routeRelevance: 'EVR',
      validationStatus: 'verified'
    };
    
    this.resourceMetadata.push(metadata);
    console.log(`Successfully downloaded and processed: ${filename}`);
  }

  private classifyDocument(filename: string, title: string): DocumentType {
    const lowerTitle = title.toLowerCase();
    const lowerFilename = filename.toLowerCase();
    
    if (lowerTitle.includes('guide') || lowerFilename.includes('guide')) return 'guidance';
    if (lowerTitle.includes('form') || lowerFilename.includes('form')) return 'form';
    if (lowerTitle.includes('checklist') || lowerFilename.includes('checklist')) return 'checklist';
    if (lowerTitle.includes('handbook') || lowerFilename.includes('handbook')) return 'handbook';
    if (lowerTitle.includes('policy') || lowerFilename.includes('policy')) return 'policy';
    if (lowerTitle.includes('example') || lowerFilename.includes('example')) return 'example';
    return 'official';
  }

  private classifyCompetency(title: string, context: string): CompetencyClassification {
    const text = (title + ' ' + context).toLowerCase();
    if (text.includes('technical')) return 'technical';
    if (text.includes('enabling')) return 'enabling';
    if (text.includes('both') || text.includes('all')) return 'mixed';
    return 'general';
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getMetadata(): ResourceMetadata[] {
    return this.resourceMetadata;
  }
}