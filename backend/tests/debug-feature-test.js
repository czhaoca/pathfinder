const AnalyticsDashboardService = require('../src/services/analyticsDashboardService');

// Create mock repository
const mockAnalyticsRepository = {
  getFeatureUsage: async () => [
    {
      name: 'Feature A',
      uniqueUsers: 100,
      totalUsage: 500,
      adoptionRate: 50,
      trend: 'growing',
      firstUsed: new Date('2024-01-01'),
      lastUsed: new Date('2024-01-31')
    },
    {
      name: 'Feature B',
      uniqueUsers: 50,
      totalUsage: 150,
      adoptionRate: 25,
      trend: 'stable',
      firstUsed: new Date('2024-01-15'),
      lastUsed: new Date('2024-01-31')
    }
  ]
};

// Create mock cache service
const mockCacheService = {
  get: async () => null,
  set: async () => true
};

const service = new AnalyticsDashboardService(mockAnalyticsRepository, mockCacheService);

async function test() {
  const result = await service.getFeatureAdoption(new Date('2024-01-01'), new Date('2024-01-31'));
  console.log('Features:', JSON.stringify(result.features, null, 2));
  console.log('Feature A avg usage:', result.features[0].averageUsagePerUser);
  console.log('Feature B avg usage:', result.features[1].averageUsagePerUser);
}

test().catch(console.error);