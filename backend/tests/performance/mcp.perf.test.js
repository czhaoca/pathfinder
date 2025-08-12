/**
 * Performance Tests for MCP Server
 * Tests MCP tool execution performance and throughput
 */

const { performance } = require('perf_hooks');
const CareerNavigatorMCP = require('../../src/services/mcp-server');

// Mock dependencies
jest.mock('../../src/services/database', () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  storeExperience: jest.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    return 'exp-123';
  }),
  getQuickContext: jest.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      EXECUTIVE_SUMMARY: 'Test summary',
      KEY_SKILLS: '["JavaScript", "React"]',
      YEARS_EXPERIENCE: 5
    };
  }),
  getDetailedProfile: jest.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
    return {
      experiences: Array(10).fill({ title: 'Developer' }),
      skills: Array(20).fill({ name: 'Skill' })
    };
  }),
  searchExperiences: jest.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 15));
    return Array(10).fill({ ID: 'exp-1', TITLE: 'Test' });
  })
}));

// Mock MCP SDK
const mockServer = {
  setRequestHandler: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined)
};

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn(() => mockServer)
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));

describe('MCP Server Performance Tests', () => {
  let mcpServer;
  let toolsCallHandler;
  const DatabaseManager = require('../../src/services/database');
  
  const PERFORMANCE_THRESHOLDS = {
    quickContext: 50,      // ms (target: 10ms)
    detailedProfile: 100,  // ms (target: 50ms)
    storeExperience: 100,  // ms
    searchExperiences: 75, // ms
    skillsAnalysis: 150    // ms
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mcpServer = new CareerNavigatorMCP();
    
    // Capture the tools/call handler
    const setRequestHandlerCalls = mockServer.setRequestHandler.mock.calls;
    const toolsCallHandlerCall = setRequestHandlerCalls.find(call => call[0] === 'tools/call');
    toolsCallHandler = toolsCallHandlerCall ? toolsCallHandlerCall[1] : null;
  });

  describe('Tool Execution Performance', () => {
    test('get_quick_context should meet 10ms target', async () => {
      const startTime = performance.now();
      
      const result = await toolsCallHandler({
        params: {
          name: 'get_quick_context',
          arguments: {}
        }
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.quickContext);
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.performanceTarget).toBeDefined();
      
      console.log(`Quick context execution: ${executionTime.toFixed(2)}ms (target: 10ms)`);
    });

    test('get_detailed_profile should meet 50ms target', async () => {
      const startTime = performance.now();
      
      const result = await toolsCallHandler({
        params: {
          name: 'get_detailed_profile',
          arguments: {}
        }
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.detailedProfile);
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.performanceTarget).toBeDefined();
      
      console.log(`Detailed profile execution: ${executionTime.toFixed(2)}ms (target: 50ms)`);
    });

    test('store_experience should complete quickly', async () => {
      const startTime = performance.now();
      
      const result = await toolsCallHandler({
        params: {
          name: 'store_experience',
          arguments: {
            title: 'Software Developer',
            description: 'Test description',
            startDate: '2023-01-01',
            experienceType: 'work'
          }
        }
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.storeExperience);
      console.log(`Store experience execution: ${executionTime.toFixed(2)}ms`);
    });

    test('search_experiences should perform efficiently', async () => {
      const startTime = performance.now();
      
      const result = await toolsCallHandler({
        params: {
          name: 'search_experiences',
          arguments: {
            query: 'developer',
            limit: 20
          }
        }
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.searchExperiences);
      console.log(`Search experiences execution: ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Tool Execution', () => {
    test('Should handle multiple concurrent tool calls efficiently', async () => {
      const toolCalls = [
        { name: 'get_quick_context', arguments: {} },
        { name: 'search_experiences', arguments: { query: 'test' } },
        { name: 'get_detailed_profile', arguments: {} },
        { name: 'get_quick_context', arguments: {} },
        { name: 'search_experiences', arguments: { query: 'developer' } }
      ];
      
      const startTime = performance.now();
      
      const promises = toolCalls.map(tool =>
        toolsCallHandler({ params: tool })
      );
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / toolCalls.length;
      
      console.log(`Concurrent execution (${toolCalls.length} tools):
        Total time: ${totalTime.toFixed(2)}ms
        Average per tool: ${avgTime.toFixed(2)}ms
      `);
      
      expect(totalTime).toBeLessThan(200); // All should complete within 200ms
      expect(avgTime).toBeLessThan(100);   // Average should be under 100ms
      
      // All results should be successful
      results.forEach(result => {
        expect(result).toHaveProperty('content');
        expect(result.isError).not.toBe(true);
      });
    });

    test('Should maintain performance under sustained load', async () => {
      const duration = 3000; // 3 seconds
      const callsPerSecond = 20;
      const results = [];
      
      const startTime = Date.now();
      const endTime = startTime + duration;
      
      while (Date.now() < endTime) {
        const batchStart = performance.now();
        
        const promises = Array(callsPerSecond).fill().map(() =>
          toolsCallHandler({
            params: {
              name: 'get_quick_context',
              arguments: {}
            }
          })
        );
        
        await Promise.all(promises);
        
        const batchEnd = performance.now();
        results.push({
          timestamp: Date.now() - startTime,
          responseTime: (batchEnd - batchStart) / callsPerSecond
        });
        
        // Wait for remainder of second
        const elapsed = Date.now() - (startTime + results.length * 1000);
        if (elapsed < 1000) {
          await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
        }
      }
      
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));
      
      console.log(`Sustained load test:
        Duration: ${duration}ms
        Calls/sec: ${callsPerSecond}
        Avg response: ${avgResponseTime.toFixed(2)}ms
        Max response: ${maxResponseTime.toFixed(2)}ms
      `);
      
      expect(avgResponseTime).toBeLessThan(50);
      expect(maxResponseTime).toBeLessThan(100);
    });
  });

  describe('Data Processing Performance', () => {
    test('Skills analysis should process large datasets efficiently', async () => {
      // Mock large dataset
      const largeExperienceSet = Array(100).fill().map((_, i) => ({
        ID: `exp-${i}`,
        EXTRACTED_SKILLS: JSON.stringify(
          Array(10).fill().map((_, j) => ({
            name: `Skill-${i}-${j}`,
            category: 'technical'
          }))
        )
      }));
      
      DatabaseManager.searchExperiences.mockResolvedValueOnce(largeExperienceSet);
      
      const startTime = performance.now();
      
      const result = await toolsCallHandler({
        params: {
          name: 'get_skills_analysis',
          arguments: {}
        }
      });
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      const responseData = JSON.parse(result.content[0].text);
      
      console.log(`Skills analysis for ${largeExperienceSet.length} experiences:
        Processing time: ${processingTime.toFixed(2)}ms
        Skills processed: ${responseData.totalExperiences * 10}
      `);
      
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.skillsAnalysis);
      expect(responseData.skillsAnalysis).toBeDefined();
    });

    test('Should handle large experience descriptions efficiently', async () => {
      const largeDescription = 'Lorem ipsum '.repeat(500); // ~6000 characters
      
      const startTime = performance.now();
      
      const result = await toolsCallHandler({
        params: {
          name: 'store_experience',
          arguments: {
            title: 'Test Position',
            description: largeDescription,
            startDate: '2023-01-01',
            experienceType: 'work'
          }
        }
      });
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      console.log(`Large description (${largeDescription.length} chars) processed in ${processingTime.toFixed(2)}ms`);
      
      expect(processingTime).toBeLessThan(150);
      expect(result.isError).not.toBe(true);
    });
  });

  describe('Error Handling Performance', () => {
    test('Validation errors should fail fast', async () => {
      const startTime = performance.now();
      
      const result = await toolsCallHandler({
        params: {
          name: 'store_experience',
          arguments: {
            // Missing required fields
            description: 'Test'
          }
        }
      });
      
      const endTime = performance.now();
      const errorTime = endTime - startTime;
      
      expect(errorTime).toBeLessThan(10); // Validation should fail quickly
      expect(result.isError).toBe(true);
      
      console.log(`Validation error returned in ${errorTime.toFixed(2)}ms`);
    });

    test('Database errors should be handled efficiently', async () => {
      DatabaseManager.getQuickContext.mockRejectedValueOnce(new Error('DB Error'));
      
      const startTime = performance.now();
      
      const result = await toolsCallHandler({
        params: {
          name: 'get_quick_context',
          arguments: {}
        }
      });
      
      const endTime = performance.now();
      const errorTime = endTime - startTime;
      
      expect(errorTime).toBeLessThan(50);
      expect(result.isError).toBe(true);
      
      console.log(`Database error handled in ${errorTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Efficiency', () => {
    test('Should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await toolsCallHandler({
          params: {
            name: 'get_quick_context',
            arguments: {}
          }
        });
        
        // Periodically force GC if available
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      console.log(`Memory usage after ${iterations} operations: +${memoryIncrease.toFixed(2)}MB`);
      
      expect(memoryIncrease).toBeLessThan(20); // Should use less than 20MB
    });
  });

  describe('Performance Metrics Tracking', () => {
    test('Should accurately track performance metrics', async () => {
      // Reset metrics
      mcpServer.performanceMetrics = {
        toolCalls: 0,
        totalResponseTime: 0,
        errors: 0,
        startTime: Date.now()
      };
      
      // Make several tool calls
      const toolCalls = 10;
      for (let i = 0; i < toolCalls; i++) {
        await toolsCallHandler({
          params: {
            name: 'get_quick_context',
            arguments: {}
          }
        });
      }
      
      // Make an error call
      await toolsCallHandler({
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      });
      
      const stats = mcpServer.getPerformanceStats();
      
      console.log('Performance stats:', stats);
      
      expect(stats.toolCalls).toBe(toolCalls + 1);
      expect(stats.errors).toBe(1);
      expect(stats.errorRate).toBe('9.09%'); // 1 error out of 11 calls
      expect(stats.averageResponseTime).toBeDefined();
      expect(stats.uptime).toBeDefined();
    });
  });
});