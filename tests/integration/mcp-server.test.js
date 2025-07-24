/**
 * Integration Tests for MCP Server
 * Tests MCP tool functionality with mocked database responses
 */

const CareerNavigatorMCP = require('../../server/mcp-server');

// Mock the database manager
jest.mock('../../lib/database', () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue({ 
    status: 'healthy', 
    environment: 'test',
    responseTime: '5ms',
    poolStats: { connectionsInUse: 1, connectionsOpen: 2 },
    connectionStats: { totalConnections: 1, queries: 1, errors: 0, avgResponseTime: 5 }
  }),
  storeExperience: jest.fn(),
  getQuickContext: jest.fn(),
  getDetailedProfile: jest.fn(),
  searchExperiences: jest.fn(),
  updateProfileSummary: jest.fn(),
  updateQuickSummary: jest.fn()
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

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock config
jest.mock('../../config/mcp-config', () => ({
  environment: 'test',
  mcp: {
    server: {
      name: 'test-mcp-server',
      version: '1.0.0'
    },
    tools: ['store_experience', 'get_quick_context'],
    performance: {
      quickContextTimeout: 10,
      profileContextTimeout: 50,
      detailedContextTimeout: 200
    },
    limits: {
      maxExperiences: 100,
      maxDescriptionLength: 5000,
      maxSkillsPerExperience: 20,
      maxHighlightsPerExperience: 10
    }
  },
  logging: {
    level: 'error',
    enableQueryLogging: false,
    enablePerformanceLogging: false
  },
  monitoring: {
    performanceMetrics: {
      enabled: false
    }
  }
}));

describe('CareerNavigatorMCP', () => {
  let mcpServer;
  let mockToolsCallHandler;
  let mockToolsListHandler;
  let DatabaseManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the database manager mock
    DatabaseManager = require('../../lib/database');
    
    // Create new MCP server instance
    mcpServer = new CareerNavigatorMCP();
    
    // Capture the handlers that were registered
    const setRequestHandlerCalls = mockServer.setRequestHandler.mock.calls;
    
    // Find tools/call and tools/list handlers
    const toolsCallHandlerCall = setRequestHandlerCalls.find(call => call[0] === 'tools/call');
    const toolsListHandlerCall = setRequestHandlerCalls.find(call => call[0] === 'tools/list');
    
    mockToolsCallHandler = toolsCallHandlerCall ? toolsCallHandlerCall[1] : null;
    mockToolsListHandler = toolsListHandlerCall ? toolsListHandlerCall[1] : null;
  });

  describe('Server Initialization', () => {
    test('should create server with correct configuration', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith('tools/call', expect.any(Function));
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith('tools/list', expect.any(Function));
    });

    test('should start server successfully', async () => {
      // Note: We don't actually call start() in tests as it would try to connect stdio transport
      // But we can test that the components are properly configured
      expect(mcpServer).toBeInstanceOf(CareerNavigatorMCP);
    });
  });

  describe('Tools List Handler', () => {
    test('should return available tools', async () => {
      const result = await mockToolsListHandler();
      
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      
      // Check for required tools
      const toolNames = result.tools.map(tool => tool.name);
      expect(toolNames).toContain('store_experience');
      expect(toolNames).toContain('get_quick_context');
      expect(toolNames).toContain('get_detailed_profile');
      expect(toolNames).toContain('search_experiences');
    });

    test('should include proper tool schemas', async () => {
      const result = await mockToolsListHandler();
      
      const storeExperienceTool = result.tools.find(tool => tool.name === 'store_experience');
      expect(storeExperienceTool).toBeDefined();
      expect(storeExperienceTool.description).toBeDefined();
      expect(storeExperienceTool.inputSchema).toBeDefined();
      expect(storeExperienceTool.inputSchema.properties).toHaveProperty('title');
      expect(storeExperienceTool.inputSchema.properties).toHaveProperty('description');
      expect(storeExperienceTool.inputSchema.required).toContain('title');
    });
  });

  describe('Store Experience Tool', () => {
    test('should store experience successfully', async () => {
      const mockExperienceId = 'test-experience-123';
      DatabaseManager.storeExperience.mockResolvedValue(mockExperienceId);
      
      const request = {
        params: {
          name: 'store_experience',
          arguments: {
            title: 'Software Developer',
            description: 'Developed web applications using React and Node.js',
            startDate: '2023-01-01',
            experienceType: 'work',
            organization: 'Tech Company',
            isCurrent: false
          }
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      expect(DatabaseManager.storeExperience).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Software Developer',
          description: 'Developed web applications using React and Node.js',
          startDate: '2023-01-01',
          experienceType: 'work'
        })
      );
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.success).toBe(true);
      expect(responseData.experienceId).toBe(mockExperienceId);
    });

    test('should handle validation errors', async () => {
      const request = {
        params: {
          name: 'store_experience',
          arguments: {
            title: '', // Invalid: empty title
            description: 'Test description'
            // Missing required fields
          }
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      expect(result.content[0].text).toContain('Error:');
      expect(result.content[0].text).toContain('Validation error');
      expect(result.isError).toBe(true);
    });

    test('should handle database errors', async () => {
      DatabaseManager.storeExperience.mockRejectedValue(new Error('Database connection failed'));
      
      const request = {
        params: {
          name: 'store_experience',
          arguments: {
            title: 'Test Experience',
            description: 'Test description',
            startDate: '2023-01-01',
            experienceType: 'work'
          }
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      expect(result.content[0].text).toContain('Error:');
      expect(result.content[0].text).toContain('Failed to store experience');
      expect(result.isError).toBe(true);
    });
  });

  describe('Get Quick Context Tool', () => {
    test('should return quick context successfully', async () => {
      const mockContext = {
        EXECUTIVE_SUMMARY: 'Experienced software developer with 5 years in web development',
        KEY_SKILLS: '["JavaScript", "React", "Node.js", "Python"]',
        CAREER_GOALS: 'Seeking senior developer role with leadership opportunities',
        YEARS_EXPERIENCE: 5,
        CURRENT_ROLE: 'Software Developer',
        INDUSTRIES: '["Technology", "Fintech"]',
        EDUCATION_LEVEL: "Bachelor's Degree",
        LOCATION: 'San Francisco, CA',
        AVAILABILITY: 'Available',
        LAST_UPDATED: new Date('2024-01-01')
      };
      
      DatabaseManager.getQuickContext.mockResolvedValue(mockContext);
      
      const request = {
        params: {
          name: 'get_quick_context',
          arguments: {}
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      expect(DatabaseManager.getQuickContext).toHaveBeenCalled();
      expect(result.content).toBeDefined();
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.executiveSummary).toBe(mockContext.EXECUTIVE_SUMMARY);
      expect(responseData.keySkills).toEqual(['JavaScript', 'React', 'Node.js', 'Python']);
      expect(responseData.yearsExperience).toBe(5);
      expect(responseData.responseTime).toMatch(/\d+ms/);
    });

    test('should handle missing context data', async () => {
      DatabaseManager.getQuickContext.mockResolvedValue(null);
      
      const request = {
        params: {
          name: 'get_quick_context',
          arguments: {}
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.message).toContain('No quick context available');
      expect(responseData.suggestion).toContain('update_quick_summary');
    });

    test('should track performance metrics', async () => {
      DatabaseManager.getQuickContext.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(null), 15); // Simulate slow response
        });
      });
      
      const request = {
        params: {
          name: 'get_quick_context',
          arguments: {}
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.performanceTarget).toBe('EXCEEDED'); // Should exceed 10ms target
    });
  });

  describe('Search Experiences Tool', () => {
    test('should search experiences with filters', async () => {
      const mockExperiences = [
        {
          ID: 'exp1',
          TITLE: 'Senior Developer',
          ORGANIZATION: 'Tech Corp',
          DESCRIPTION: 'Led development team',
          START_DATE: new Date('2022-01-01'),
          END_DATE: new Date('2023-12-31'),
          IS_CURRENT: 0,
          EXPERIENCE_TYPE: 'work',
          EXTRACTED_SKILLS: '["Leadership", "JavaScript"]',
          KEY_HIGHLIGHTS: '["Managed team of 5", "Delivered 3 major projects"]',
          CREATED_AT: new Date('2024-01-01'),
          UPDATED_AT: new Date('2024-01-01')
        }
      ];
      
      DatabaseManager.searchExperiences.mockResolvedValue(mockExperiences);
      
      const request = {
        params: {
          name: 'search_experiences',
          arguments: {
            query: 'developer',
            experienceType: 'work',
            limit: 10
          }
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      expect(DatabaseManager.searchExperiences).toHaveBeenCalledWith({
        searchText: 'developer',
        experienceType: 'work',
        isCurrent: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        limit: 10
      });
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.results).toHaveLength(1);
      expect(responseData.results[0].title).toBe('Senior Developer');
      expect(responseData.results[0].extractedSkills).toEqual(['Leadership', 'JavaScript']);
      expect(responseData.totalFound).toBe(1);
    });

    test('should handle search validation errors', async () => {
      const request = {
        params: {
          name: 'search_experiences',
          arguments: {
            limit: 100 // Exceeds maximum limit
          }
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      expect(result.content[0].text).toContain('Error:');
      expect(result.content[0].text).toContain('Validation error');
    });
  });

  describe('Update Profile Tool', () => {
    test('should update profile successfully', async () => {
      DatabaseManager.updateProfileSummary.mockResolvedValue();
      
      const request = {
        params: {
          name: 'update_profile',
          arguments: {
            coreStrengths: {
              technical: ['JavaScript', 'React', 'Node.js'],
              leadership: ['Team Management', 'Project Planning']
            },
            careerInterests: {
              areas: ['Full Stack Development', 'Technical Leadership'],
              goals: ['Senior Developer Role', 'Team Lead Position']
            }
          }
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      expect(DatabaseManager.updateProfileSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          coreStrengths: request.params.arguments.coreStrengths,
          careerInterests: request.params.arguments.careerInterests
        })
      );
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.success).toBe(true);
      expect(responseData.updatedFields).toEqual(['coreStrengths', 'careerInterests']);
    });
  });

  describe('Skills Analysis Tool', () => {
    test('should analyze skills from experiences', async () => {
      const mockExperiences = [
        {
          ID: 'exp1',
          EXTRACTED_SKILLS: '[{"name": "JavaScript", "category": "technical"}, {"name": "Leadership", "category": "soft"}]'
        },
        {
          ID: 'exp2',
          EXTRACTED_SKILLS: '[{"name": "JavaScript", "category": "technical"}, {"name": "Python", "category": "technical"}]'
        }
      ];
      
      DatabaseManager.searchExperiences.mockResolvedValue(mockExperiences);
      
      const request = {
        params: {
          name: 'get_skills_analysis',
          arguments: {}
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.skillsAnalysis).toBeDefined();
      expect(responseData.skillsAnalysis.topSkills).toBeDefined();
      expect(responseData.skillsAnalysis.categorizedSkills).toBeDefined();
      expect(responseData.totalExperiences).toBe(2);
      
      // Check that JavaScript appears twice (frequency = 2)
      const jsSkill = responseData.skillsAnalysis.topSkills.find(s => s.skill === 'JavaScript');
      expect(jsSkill).toBeDefined();
      expect(jsSkill.frequency).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown tool names', async () => {
      const request = {
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      expect(result.content[0].text).toContain('Error:');
      expect(result.content[0].text).toContain('Unknown tool: unknown_tool');
      expect(result.isError).toBe(true);
    });

    test('should handle database connection failures', async () => {
      DatabaseManager.getQuickContext.mockRejectedValue(new Error('Connection timeout'));
      
      const request = {
        params: {
          name: 'get_quick_context',
          arguments: {}
        }
      };
      
      const result = await mockToolsCallHandler(request);
      
      expect(result.content[0].text).toContain('Error:');
      expect(result.content[0].text).toContain('Failed to retrieve quick context');
      expect(result.isError).toBe(true);
    });
  });

  describe('Performance Tracking', () => {
    test('should track tool call metrics', async () => {
      DatabaseManager.getQuickContext.mockResolvedValue(null);
      
      // Initial metrics
      expect(mcpServer.performanceMetrics.toolCalls).toBe(0);
      expect(mcpServer.performanceMetrics.errors).toBe(0);
      
      // Make successful call
      await mockToolsCallHandler({
        params: { name: 'get_quick_context', arguments: {} }
      });
      
      expect(mcpServer.performanceMetrics.toolCalls).toBe(1);
      expect(mcpServer.performanceMetrics.errors).toBe(0);
      
      // Make failing call
      DatabaseManager.getQuickContext.mockRejectedValue(new Error('Test error'));
      
      await mockToolsCallHandler({
        params: { name: 'get_quick_context', arguments: {} }
      });
      
      expect(mcpServer.performanceMetrics.toolCalls).toBe(2);
      expect(mcpServer.performanceMetrics.errors).toBe(1);
    });

    test('should calculate performance statistics', () => {
      // Simulate some metrics
      mcpServer.performanceMetrics.toolCalls = 10;
      mcpServer.performanceMetrics.totalResponseTime = 1000;
      mcpServer.performanceMetrics.errors = 2;
      
      const stats = mcpServer.getPerformanceStats();
      
      expect(stats.toolCalls).toBe(10);
      expect(stats.averageResponseTime).toBe('100ms');
      expect(stats.errorRate).toBe('20%');
      expect(stats.errors).toBe(2);
      expect(stats.uptime).toMatch(/\d+s/);
    });
  });
});