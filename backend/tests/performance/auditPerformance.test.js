const { AuditService } = require('../../src/services/auditService');

describe('Audit Service Performance Impact', () => {
  let auditService;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      execute: jest.fn().mockResolvedValue({ rows: [] })
    };

    auditService = new AuditService(mockDb, {
      auditFlushInterval: 5000,
      bufferSize: 1000
    });

    // Clear intervals to prevent interference
    clearInterval(auditService.flushInterval);
  });

  afterEach(() => {
    if (auditService) {
      auditService.shutdown();
    }
  });

  test('should process events with < 5% performance impact', async () => {
    const iterations = 1000;
    const baselineIterations = 1000;
    
    // Baseline: Measure time without audit logging
    const baselineStart = process.hrtime.bigint();
    for (let i = 0; i < baselineIterations; i++) {
      // Simulate typical operations
      const data = {
        id: i,
        value: Math.random(),
        timestamp: new Date()
      };
      JSON.stringify(data);
    }
    const baselineEnd = process.hrtime.bigint();
    const baselineTime = Number(baselineEnd - baselineStart) / 1e6; // Convert to ms

    // Test: Measure time with audit logging
    const testStart = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      await auditService.log({
        event_type: 'data_access',
        event_category: 'performance',
        event_severity: 'info',
        event_name: `Event ${i}`,
        action: 'read',
        action_result: 'success',
        actor_id: `user${i % 10}`,
        target_id: `resource${i}`
      });
    }
    const testEnd = process.hrtime.bigint();
    const testTime = Number(testEnd - testStart) / 1e6; // Convert to ms

    // Calculate overhead
    const overhead = ((testTime - baselineTime) / baselineTime) * 100;
    
    console.log(`Baseline time: ${baselineTime.toFixed(2)}ms`);
    console.log(`Test time: ${testTime.toFixed(2)}ms`);
    console.log(`Overhead: ${overhead.toFixed(2)}%`);

    // Assert that overhead is less than 5%
    expect(overhead).toBeLessThan(5);
  });

  test('should handle burst traffic efficiently', async () => {
    const burstSize = 100;
    const bursts = 10;
    const timings = [];

    for (let burst = 0; burst < bursts; burst++) {
      const burstStart = process.hrtime.bigint();
      
      // Send burst of events
      const promises = [];
      for (let i = 0; i < burstSize; i++) {
        promises.push(auditService.log({
          event_type: 'authentication',
          event_category: 'security',
          event_severity: 'info',
          event_name: 'Login',
          action: 'login',
          action_result: 'success',
          actor_id: `user${i}`
        }));
      }
      
      await Promise.all(promises);
      
      const burstEnd = process.hrtime.bigint();
      const burstTime = Number(burstEnd - burstStart) / 1e6;
      timings.push(burstTime);
    }

    // Calculate average and variance
    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const variance = timings.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);

    console.log(`Average burst time: ${avgTime.toFixed(2)}ms`);
    console.log(`Standard deviation: ${stdDev.toFixed(2)}ms`);

    // Performance should be consistent (low variance)
    expect(stdDev / avgTime).toBeLessThan(0.5); // Coefficient of variation < 50%
    
    // Average time should be reasonable for 100 events
    expect(avgTime).toBeLessThan(100); // Less than 1ms per event
  });

  test('should maintain buffer efficiency', async () => {
    const eventCount = 5000;
    let flushCount = 0;
    
    // Monitor flush operations
    const originalFlush = auditService.flush;
    auditService.flush = jest.fn(async function() {
      flushCount++;
      return originalFlush.call(this);
    });

    // Generate events
    for (let i = 0; i < eventCount; i++) {
      await auditService.log({
        event_type: 'test',
        event_category: 'buffer',
        event_severity: 'info',
        event_name: `Event ${i}`,
        action: 'test',
        action_result: 'success'
      });
    }

    // Force final flush
    await auditService.flush();

    // Calculate efficiency
    const expectedFlushes = Math.ceil(eventCount / auditService.config.bufferSize);
    const efficiency = (expectedFlushes / flushCount) * 100;

    console.log(`Events: ${eventCount}`);
    console.log(`Buffer size: ${auditService.config.bufferSize}`);
    console.log(`Actual flushes: ${flushCount}`);
    console.log(`Expected flushes: ${expectedFlushes}`);
    console.log(`Buffer efficiency: ${efficiency.toFixed(2)}%`);

    // Should not flush more than necessary (allowing for some critical events)
    expect(flushCount).toBeLessThanOrEqual(expectedFlushes + 2);
  });

  test('should handle concurrent access efficiently', async () => {
    const concurrentUsers = 50;
    const eventsPerUser = 20;
    
    const start = process.hrtime.bigint();
    
    // Simulate concurrent users
    const userPromises = [];
    for (let user = 0; user < concurrentUsers; user++) {
      const userEvents = async () => {
        for (let event = 0; event < eventsPerUser; event++) {
          await auditService.log({
            event_type: 'data_modification',
            event_category: 'data',
            event_severity: 'info',
            event_name: 'Update',
            action: 'update',
            action_result: 'success',
            actor_id: `user${user}`,
            target_id: `record${event}`
          });
        }
      };
      userPromises.push(userEvents());
    }
    
    await Promise.all(userPromises);
    
    const end = process.hrtime.bigint();
    const totalTime = Number(end - start) / 1e6;
    const totalEvents = concurrentUsers * eventsPerUser;
    const throughput = totalEvents / (totalTime / 1000); // Events per second

    console.log(`Concurrent users: ${concurrentUsers}`);
    console.log(`Total events: ${totalEvents}`);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`Throughput: ${throughput.toFixed(0)} events/second`);

    // Should handle at least 1000 events per second
    expect(throughput).toBeGreaterThan(1000);
  });

  test('should not impact memory significantly', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create large number of events in buffer
    for (let i = 0; i < auditService.config.bufferSize; i++) {
      auditService.buffer.push({
        event_type: 'memory_test',
        event_category: 'test',
        event_severity: 'info',
        event_name: `Event ${i}`,
        action: 'test',
        action_result: 'success',
        large_data: 'x'.repeat(1000) // 1KB of data per event
      });
    }
    
    const afterBufferMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (afterBufferMemory - initialMemory) / (1024 * 1024); // Convert to MB
    const memoryPerEvent = memoryIncrease / auditService.config.bufferSize * 1000; // KB per event

    console.log(`Buffer size: ${auditService.config.bufferSize} events`);
    console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);
    console.log(`Memory per event: ${memoryPerEvent.toFixed(2)} KB`);

    // Each event with 1KB data should not use more than 2KB total memory
    expect(memoryPerEvent).toBeLessThan(2);
    
    // Total buffer should not exceed reasonable limits
    expect(memoryIncrease).toBeLessThan(10); // Less than 10MB for full buffer
  });
});