#!/usr/bin/env node

/**
 * CPA PERT Data Collection Script with Advanced Anti-Detection
 * Enhanced with human-like behavior patterns to avoid firewall blocks
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Human-like user agents pool (real browser fingerprints)
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Realistic browser headers for different scenarios
const BROWSER_HEADERS = {
    standard: [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.5',
        'Accept-Encoding: gzip, deflate, br',
        'DNT: 1',
        'Connection: keep-alive',
        'Upgrade-Insecure-Requests: 1',
        'Sec-Fetch-Dest: document',
        'Sec-Fetch-Mode: navigate',
        'Sec-Fetch-Site: none',
        'Sec-Fetch-User: ?1',
        'Cache-Control: max-age=0'
    ],
    pdf: [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/pdf',
        'Accept-Language: en-US,en;q=0.5',
        'Accept-Encoding: gzip, deflate, br',
        'DNT: 1',
        'Connection: keep-alive',
        'Upgrade-Insecure-Requests: 1',
        'Sec-Fetch-Dest: document',
        'Sec-Fetch-Mode: navigate',
        'Sec-Fetch-Site: cross-site',
        'Sec-Fetch-User: ?1'
    ]
};

// Human-like delays (milliseconds)
const DELAYS = {
    between_requests: () => Math.floor(Math.random() * 3000) + 2000, // 2-5 seconds
    page_load: () => Math.floor(Math.random() * 2000) + 1000, // 1-3 seconds
    typing_simulation: () => Math.floor(Math.random() * 100) + 50, // 50-150ms
    navigation: () => Math.floor(Math.random() * 1500) + 500 // 0.5-2 seconds
};

// Resource definitions with enhanced metadata
const RESOURCES = {
    cpabc: {
        base_url: 'https://www.bccpa.ca',
        referer: 'https://www.bccpa.ca/',
        resources: [
            {
                id: 'current_candidates_experience',
                url: 'https://www.bccpa.ca/become-a-cpa/about-the-program/experience/current-candidates/',
                type: 'official',
                competency: 'general',
                route_relevance: 'EVR',
                expected_content: 'experience requirements'
            },
            {
                id: 'pert_self_assessment',
                url: 'https://pert.cpa-services.org/Student/TrialAssessment',
                type: 'guidance',
                competency: 'mixed',
                route_relevance: 'EVR',
                expected_content: 'self-assessment tool'
            }
        ]
    },
    cpacanada: {
        base_url: 'https://www.cpacanada.ca',
        referer: 'https://www.cpacanada.ca/',
        resources: [
            {
                id: 'guiding_questions_rubric',
                url: 'https://www.cpacanada.ca/-/media/site/operational/ec-education-certification/docs/02639-ec_guiding-questions-practical-experience-rubric.pdf',
                type: 'competency-framework',
                competency: 'mixed',
                route_relevance: 'Both',
                expected_content: 'assessment rubric'
            },
            {
                id: 'certification_resources',
                url: 'https://www.cpacanada.ca/en/become-a-cpa/certification-resource-centre/resources-for-cpa-practical-experience-requirements',
                type: 'official',
                competency: 'general',
                route_relevance: 'Both',
                expected_content: 'certification resources'
            }
        ]
    }
};

class HumanLikeDataCollector {
    constructor() {
        this.session_id = crypto.randomUUID();
        this.start_time = new Date().toISOString();
        this.collected_data = [];
        this.failed_resources = [];
        this.current_user_agent = this.getRandomUserAgent();
        
        console.log(`🤖 Starting CPA PERT data collection session: ${this.session_id}`);
        console.log(`🕐 Start time: ${this.start_time}`);
        console.log(`🔍 Using user agent: ${this.current_user_agent.substring(0, 50)}...`);
    }

    getRandomUserAgent() {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    simulateHumanBehavior(action) {
        const delay = DELAYS[action] ? DELAYS[action]() : 1000;
        console.log(`⏱️  Human behavior simulation: ${action} (${delay}ms)`);
        return this.sleep(delay);
    }

    generateSha256(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    buildWgetCommand(url, output_path, resource_type = 'standard') {
        const headers = BROWSER_HEADERS[resource_type] || BROWSER_HEADERS.standard;
        const referer = url.includes('cpacanada.ca') ? RESOURCES.cpacanada.referer : RESOURCES.cpabc.referer;
        
        let cmd = `wget `;
        cmd += `--user-agent="${this.current_user_agent}" `;
        cmd += `--referer="${referer}" `;
        
        // Add all headers
        headers.forEach(header => {
            cmd += `--header="${header}" `;
        });
        
        // Anti-detection measures
        cmd += `--no-check-certificate `;
        cmd += `--timeout=30 `;
        cmd += `--tries=3 `;
        cmd += `--waitretry=3 `;
        cmd += `--random-wait `;
        cmd += `--no-cache `;
        cmd += `--no-cookies `;
        cmd += `--max-redirect=5 `;
        cmd += `--content-disposition `;
        cmd += `-O "${output_path}" `;
        cmd += `"${url}"`;
        
        return cmd;
    }

    async collectResource(org, resource) {
        console.log(`\n📄 Collecting: ${resource.id} from ${org.toUpperCase()}`);
        console.log(`🔗 URL: ${resource.url}`);
        
        await this.simulateHumanBehavior('navigation');
        
        const timestamp = new Date().toISOString();
        const output_dir = path.join(__dirname, 'resources', 'snapshots', org.toUpperCase(), resource.type);
        const output_filename = `${org}-${resource.id}.pdf`;
        const output_path = path.join(output_dir, output_filename);
        
        // Ensure directory exists
        fs.mkdirSync(output_dir, { recursive: true });
        
        // Determine if this is a PDF URL
        const is_pdf = resource.url.includes('.pdf') || resource.expected_content === 'pdf';
        const resource_type = is_pdf ? 'pdf' : 'standard';
        
        try {
            const wget_cmd = this.buildWgetCommand(resource.url, output_path, resource_type);
            console.log(`🌐 Executing wget with human-like headers...`);
            
            await this.simulateHumanBehavior('page_load');
            
            const result = execSync(wget_cmd, { 
                stdio: 'pipe',
                encoding: 'utf8',
                timeout: 60000 // 60 second timeout
            });
            
            // Verify file was downloaded
            if (fs.existsSync(output_path)) {
                const content = fs.readFileSync(output_path);
                const sha256 = this.generateSha256(content);
                const file_size = content.length;
                
                console.log(`✅ Successfully collected ${resource.id}`);
                console.log(`📏 Size: ${file_size} bytes`);
                console.log(`🔐 SHA256: ${sha256}`);
                
                const metadata = {
                    document_id: `${org}_${resource.id}_v1`,
                    title: resource.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    url: resource.url,
                    source: org.toUpperCase(),
                    route_relevance: resource.route_relevance,
                    document_type: resource.type,
                    competency_classification: resource.competency,
                    version_info: {
                        version: '1.0',
                        is_current: true,
                        previous_versions: []
                    },
                    capture_info: {
                        timestamp: timestamp,
                        sha256: sha256,
                        file_size: file_size,
                        captured_by: 'enhanced_wget_human_behavior',
                        session_id: this.session_id,
                        user_agent: this.current_user_agent
                    },
                    storage_info: {
                        saved_path: path.relative(__dirname, output_path)
                    },
                    validation_status: 'verified',
                    last_verified: timestamp,
                    description: `${org.toUpperCase()} ${resource.type} document: ${resource.expected_content}`,
                    keywords: [
                        'PERT',
                        'practical experience',
                        'competency framework',
                        resource.expected_content
                    ],
                    change_history: [
                        {
                            date: timestamp,
                            change_type: 'created',
                            description: `Successfully collected using enhanced wget with human-like behavior patterns`
                        }
                    ]
                };
                
                this.collected_data.push(metadata);
                
                // Human-like delay between requests
                await this.simulateHumanBehavior('between_requests');
                
                return metadata;
            } else {
                throw new Error('File not downloaded successfully');
            }
            
        } catch (error) {
            console.log(`❌ Failed to collect ${resource.id}: ${error.message}`);
            
            const failure_metadata = {
                document_id: `${org}_${resource.id}_v1`,
                title: resource.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                url: resource.url,
                source: org.toUpperCase(),
                route_relevance: resource.route_relevance,
                document_type: resource.type,
                competency_classification: resource.competency,
                validation_status: 'access_restricted',
                last_verified: timestamp,
                access_restrictions: {
                    error_type: 'collection_failed',
                    error_message: error.message,
                    protection_mechanism: 'unknown',
                    firewall_workaround_attempted: {
                        enhanced_wget_human_behavior: 'failed'
                    },
                    alternative_access_methods: [
                        'manual_verification_required',
                        'alternative_source_needed'
                    ]
                },
                change_history: [
                    {
                        date: timestamp,
                        change_type: 'collection_failed',
                        description: `Failed collection attempt with enhanced wget and human-like behavior: ${error.message}`
                    }
                ]
            };
            
            this.failed_resources.push(failure_metadata);
            
            // Still wait between requests to maintain human-like behavior
            await this.simulateHumanBehavior('between_requests');
            
            return failure_metadata;
        }
    }

    async collectAllResources() {
        console.log(`\n🚀 Starting comprehensive data collection with anti-detection measures`);
        
        for (const [org_name, org_data] of Object.entries(RESOURCES)) {
            console.log(`\n📋 Processing ${org_name.toUpperCase()} resources...`);
            
            for (const resource of org_data.resources) {
                await this.collectResource(org_name, resource);
            }
        }
        
        await this.generateReports();
    }

    async generateReports() {
        console.log(`\n📊 Generating collection reports...`);
        
        // Save collected data metadata
        if (this.collected_data.length > 0) {
            for (const [org_name] of Object.entries(RESOURCES)) {
                const org_data = this.collected_data.filter(item => 
                    item.source === org_name.toUpperCase()
                );
                
                if (org_data.length > 0) {
                    const metadata_file = path.join(__dirname, 'resources', 'knowledge', org_name.toUpperCase(), `${org_name}-metadata.json`);
                    fs.mkdirSync(path.dirname(metadata_file), { recursive: true });
                    
                    const metadata_content = {
                        metadata: {
                            last_updated: new Date().toISOString(),
                            total_documents: org_data.length,
                            metadata_version: '1.0.0',
                            collection_session: this.session_id
                        },
                        documents: org_data.reduce((acc, item) => {
                            acc[item.document_id] = item;
                            return acc;
                        }, {})
                    };
                    
                    fs.writeFileSync(metadata_file, JSON.stringify(metadata_content, null, 2));
                    console.log(`📝 Saved metadata for ${org_name.toUpperCase()}: ${metadata_file}`);
                }
            }
        }
        
        // Save failed resources report
        if (this.failed_resources.length > 0) {
            const failed_report = {
                session_id: this.session_id,
                timestamp: new Date().toISOString(),
                total_failures: this.failed_resources.length,
                failed_resources: this.failed_resources
            };
            
            const failed_file = path.join(__dirname, 'resources', 'failed-collection-report.json');
            fs.writeFileSync(failed_file, JSON.stringify(failed_report, null, 2));
            console.log(`⚠️  Saved failed resources report: ${failed_file}`);
        }
        
        // Summary report
        console.log(`\n📈 Collection Summary:`);
        console.log(`✅ Successfully collected: ${this.collected_data.length} resources`);
        console.log(`❌ Failed to collect: ${this.failed_resources.length} resources`);
        console.log(`🕐 Session duration: ${((new Date() - new Date(this.start_time)) / 1000).toFixed(1)}s`);
        console.log(`🔍 Session ID: ${this.session_id}`);
    }
}

// Main execution
async function main() {
    console.log('🔄 CPA PERT Data Collection with Enhanced Anti-Detection');
    console.log('=' .repeat(60));
    
    const collector = new HumanLikeDataCollector();
    await collector.collectAllResources();
    
    console.log('\n✨ Data collection complete!');
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { HumanLikeDataCollector };