const OCIStorageService = require('../../src/services/ociStorageService');
const UserAnalyticsService = require('../../src/services/userAnalyticsService');
const { ulid } = require('ulid');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

describe('OCI Object Storage Integration', () => {
  let ociStorageService;
  let analyticsService;
  let mockObjectStorageClient;
  let mockRepository;

  beforeEach(() => {
    // Mock OCI Object Storage Client
    mockObjectStorageClient = {
      putObject: jest.fn(),
      getObject: jest.fn(),
      deleteObject: jest.fn(),
      copyObject: jest.fn(),
      listObjects: jest.fn(),
      headObject: jest.fn(),
      createBucket: jest.fn(),
      getBucket: jest.fn(),
      deleteBucket: jest.fn(),
      createPreauthenticatedRequest: jest.fn(),
      listPreauthenticatedRequests: jest.fn()
    };

    // Mock repository
    mockRepository = {
      getEventsOlderThan: jest.fn(),
      deleteEventsByDate: jest.fn(),
      createStorageTier: jest.fn(),
      updateStorageTier: jest.fn(),
      getStorageTiers: jest.fn(),
      getColdStorageOlderThan: jest.fn(),
      updateTierLastAccessed: jest.fn()
    };

    // OCI configuration
    const ociConfig = {
      namespace: 'test-namespace',
      region: 'us-phoenix-1',
      compartmentId: 'ocid1.compartment.oc1..test',
      hotBucket: 'analytics-hot-test',
      coldBucket: 'analytics-cold-test',
      archiveBucket: 'analytics-archive-test',
      provider: {
        getUser: jest.fn().mockResolvedValue({ id: 'test-user' })
      }
    };

    // Initialize services
    ociStorageService = new OCIStorageService(ociConfig, mockObjectStorageClient);
    analyticsService = new UserAnalyticsService(mockRepository, ociConfig);
    analyticsService.objectStorageClient = mockObjectStorageClient;
  });

  describe('Bucket Management', () => {
    it('should create storage buckets if they do not exist', async () => {
      mockObjectStorageClient.getBucket.mockRejectedValue({ statusCode: 404 });
      mockObjectStorageClient.createBucket.mockResolvedValue({ etag: 'created' });

      await ociStorageService.initializeBuckets();

      expect(mockObjectStorageClient.createBucket).toHaveBeenCalledTimes(3);
      expect(mockObjectStorageClient.createBucket).toHaveBeenCalledWith(
        expect.objectContaining({
          createBucketDetails: expect.objectContaining({
            name: 'analytics-hot-test',
            compartmentId: 'ocid1.compartment.oc1..test',
            storageTier: 'Standard'
          })
        })
      );
    });

    it('should configure lifecycle policies for buckets', async () => {
      await ociStorageService.configureLifecyclePolicies();

      // Verify lifecycle rules are set
      expect(mockObjectStorageClient.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          objectName: expect.stringContaining('lifecycle-policy'),
          putObjectBody: expect.stringContaining('lifecycle')
        })
      );
    });

    it('should handle bucket already exists error', async () => {
      mockObjectStorageClient.getBucket.mockResolvedValue({ name: 'analytics-hot-test' });

      await ociStorageService.initializeBuckets();

      expect(mockObjectStorageClient.createBucket).not.toHaveBeenCalled();
    });

    it('should verify bucket accessibility', async () => {
      mockObjectStorageClient.headObject.mockResolvedValue({ etag: 'exists' });

      const isAccessible = await ociStorageService.verifyBucketAccess('analytics-hot-test');

      expect(isAccessible).toBe(true);
    });
  });

  describe('Data Migration to Cold Storage', () => {
    const mockEvents = [
      {
        eventId: ulid(),
        userId: 'user-1',
        eventType: 'page_view',
        eventTimestamp: new Date('2024-10-01'),
        properties: { page: '/home' }
      },
      {
        eventId: ulid(),
        userId: 'user-2',
        eventType: 'click',
        eventTimestamp: new Date('2024-10-01'),
        properties: { button: 'submit' }
      },
      {
        eventId: ulid(),
        userId: 'user-1',
        eventType: 'page_view',
        eventTimestamp: new Date('2024-10-02'),
        properties: { page: '/products' }
      }
    ];

    beforeEach(() => {
      mockRepository.getEventsOlderThan.mockResolvedValue(mockEvents);
      mockObjectStorageClient.putObject.mockResolvedValue({ eTag: 'mock-etag' });
    });

    it('should migrate events older than 90 days to cold storage', async () => {
      await analyticsService.migrateToOCIColdStorage();

      // Should group by date and upload
      expect(mockObjectStorageClient.putObject).toHaveBeenCalledTimes(2); // 2 different dates

      // Verify object naming convention
      expect(mockObjectStorageClient.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          objectName: expect.stringMatching(/analytics\/daily\/2024-10-01\/events\.json\.gz/),
          bucketName: 'analytics-cold-test',
          namespaceName: 'test-namespace'
        })
      );
    });

    it('should compress data before uploading', async () => {
      await analyticsService.migrateToOCIColdStorage();

      const putCall = mockObjectStorageClient.putObject.mock.calls[0][0];
      const compressedData = putCall.putObjectBody;

      // Verify data is compressed
      expect(compressedData).toBeInstanceOf(Buffer);
      
      // Decompress and verify structure
      const decompressed = await gunzip(compressedData);
      const data = JSON.parse(decompressed.toString());
      expect(Array.isArray(data)).toBe(true);
    });

    it('should create storage tier metadata', async () => {
      await analyticsService.migrateToOCIColdStorage();

      expect(mockRepository.createStorageTier).toHaveBeenCalledWith(
        expect.objectContaining({
          tierName: 'cold',
          dateRangeStart: expect.any(Date),
          dateRangeEnd: expect.any(Date),
          storageLocation: expect.stringContaining('oci://'),
          ociBucket: 'analytics-cold-test',
          compressionType: 'gzip',
          encryptionEnabled: 'Y'
        })
      );
    });

    it('should delete events from hot storage after successful migration', async () => {
      await analyticsService.migrateToOCIColdStorage();

      expect(mockRepository.deleteEventsByDate).toHaveBeenCalledTimes(2);
      expect(mockRepository.deleteEventsByDate).toHaveBeenCalledWith(
        new Date('2024-10-01')
      );
    });

    it('should handle migration failures and rollback', async () => {
      mockObjectStorageClient.putObject.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(analyticsService.migrateToOCIColdStorage()).rejects.toThrow('Upload failed');

      // Should not delete from hot storage on failure
      expect(mockRepository.deleteEventsByDate).not.toHaveBeenCalled();
    });

    it('should batch large datasets efficiently', async () => {
      // Create 10000 events
      const largeEventSet = Array(10000).fill(null).map((_, i) => ({
        eventId: ulid(),
        userId: `user-${i % 100}`,
        eventType: 'test',
        eventTimestamp: new Date('2024-10-01'),
        properties: { index: i }
      }));

      mockRepository.getEventsOlderThan.mockResolvedValue(largeEventSet);

      await analyticsService.migrateToOCIColdStorage();

      // Should handle large dataset without memory issues
      expect(mockObjectStorageClient.putObject).toHaveBeenCalled();
      
      // Verify compression ratio
      const putCall = mockObjectStorageClient.putObject.mock.calls[0][0];
      const compressedSize = putCall.putObjectBody.length;
      const originalSize = JSON.stringify(largeEventSet).length;
      
      expect(compressedSize).toBeLessThan(originalSize * 0.3); // Expect >70% compression
    });

    it('should support incremental migration', async () => {
      // First migration
      await analyticsService.migrateToOCIColdStorage();
      
      // Second migration with new events
      const newEvents = [
        {
          eventId: ulid(),
          userId: 'user-3',
          eventTimestamp: new Date('2024-10-03'),
          eventType: 'new_event'
        }
      ];
      
      mockRepository.getEventsOlderThan.mockResolvedValue(newEvents);
      await analyticsService.migrateToOCIColdStorage();

      // Should only migrate new events
      expect(mockRepository.createStorageTier).toHaveBeenCalledTimes(3); // 2 from first + 1 from second
    });
  });

  describe('Data Migration to Archive Storage', () => {
    const coldStorageItems = [
      {
        tierId: 'tier-1',
        tierName: 'cold',
        dateRangeStart: new Date('2023-01-01'),
        dateRangeEnd: new Date('2023-01-31'),
        filePrefix: 'analytics/daily/2023-01-15/events.json.gz',
        ociBucket: 'analytics-cold-test',
        sizeBytes: 1024000
      }
    ];

    beforeEach(() => {
      mockRepository.getColdStorageOlderThan.mockResolvedValue(coldStorageItems);
      mockObjectStorageClient.copyObject.mockResolvedValue({ etag: 'copied' });
      mockObjectStorageClient.deleteObject.mockResolvedValue({});
    });

    it('should migrate cold storage items older than 1 year to archive', async () => {
      await analyticsService.migrateToOCIArchive();

      expect(mockObjectStorageClient.copyObject).toHaveBeenCalledWith(
        expect.objectContaining({
          namespaceName: 'test-namespace',
          bucketName: 'analytics-archive-test',
          copyObjectDetails: expect.objectContaining({
            sourceObjectName: 'analytics/daily/2023-01-15/events.json.gz',
            destinationBucket: 'analytics-cold-test',
            destinationObjectName: 'archive/daily/2023-01-15/events.json.gz'
          })
        })
      );
    });

    it('should update storage tier metadata after archiving', async () => {
      await analyticsService.migrateToOCIArchive();

      expect(mockRepository.updateStorageTier).toHaveBeenCalledWith(
        'tier-1',
        expect.objectContaining({
          tierName: 'archive',
          storageLocation: expect.stringContaining('analytics-archive-test'),
          ociBucket: 'analytics-archive-test'
        })
      );
    });

    it('should delete from cold storage after successful archive', async () => {
      await analyticsService.migrateToOCIArchive();

      expect(mockObjectStorageClient.deleteObject).toHaveBeenCalledWith(
        expect.objectContaining({
          namespaceName: 'test-namespace',
          bucketName: 'analytics-cold-test',
          objectName: 'analytics/daily/2023-01-15/events.json.gz'
        })
      );
    });

    it('should handle archive storage class properly', async () => {
      await analyticsService.migrateToOCIArchive();

      expect(mockObjectStorageClient.copyObject).toHaveBeenCalledWith(
        expect.objectContaining({
          copyObjectDetails: expect.objectContaining({
            destinationObjectStorageTier: 'Archive'
          })
        })
      );
    });
  });

  describe('Cross-Tier Query Operations', () => {
    it('should query data across all storage tiers', async () => {
      const userId = 'user-123';
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2025-01-31');

      // Mock hot storage data
      mockRepository.getUserEvents = jest.fn().mockResolvedValue([
        { eventId: '1', eventTimestamp: new Date('2025-01-15'), tier: 'hot' }
      ]);

      // Mock cold storage metadata
      mockRepository.getStorageTiers.mockResolvedValue([
        {
          tierId: 'cold-1',
          tierName: 'cold',
          filePrefix: 'analytics/daily/2024-06-15/events.json.gz',
          ociBucket: 'analytics-cold-test'
        }
      ]);

      // Mock cold storage data retrieval
      const coldData = await gzip(JSON.stringify([
        { eventId: '2', userId, eventTimestamp: new Date('2024-06-15'), tier: 'cold' }
      ]));
      mockObjectStorageClient.getObject.mockResolvedValue({ value: coldData });

      const results = await analyticsService.queryAnalytics(userId, startDate, endDate);

      expect(results).toHaveLength(2);
      expect(results[0].tier).toBe('cold'); // Older events first
      expect(results[1].tier).toBe('hot');
    });

    it('should handle missing data gracefully', async () => {
      mockObjectStorageClient.getObject.mockRejectedValue({ statusCode: 404 });

      const results = await analyticsService.queryOCIColdStorage(
        'user-123',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(results).toEqual([]);
    });

    it('should cache frequently accessed cold storage data', async () => {
      const cacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn()
      };

      analyticsService.cacheService = cacheService;

      await analyticsService.queryOCIColdStorage(
        'user-123',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('cold-storage'),
        expect.any(Object),
        expect.any(Number) // TTL
      );
    });

    it('should update last accessed timestamp for cold storage', async () => {
      mockRepository.getStorageTiers.mockResolvedValue([
        { tierId: 'tier-1', filePrefix: 'test.gz', ociBucket: 'cold' }
      ]);

      mockObjectStorageClient.getObject.mockResolvedValue({
        value: await gzip(JSON.stringify([]))
      });

      await analyticsService.queryOCIColdStorage(
        'user-123',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(mockRepository.updateTierLastAccessed).toHaveBeenCalledWith('tier-1');
    });
  });

  describe('Data Restoration from Archive', () => {
    it('should restore archived data when needed', async () => {
      const archiveObject = 'archive/daily/2023-01-15/events.json.gz';
      
      // Mock restore request
      mockObjectStorageClient.restoreObjects = jest.fn().mockResolvedValue({
        restoredObjects: [archiveObject]
      });

      await ociStorageService.restoreFromArchive(archiveObject);

      expect(mockObjectStorageClient.restoreObjects).toHaveBeenCalledWith(
        expect.objectContaining({
          namespaceName: 'test-namespace',
          bucketName: 'analytics-archive-test',
          restoreObjectsDetails: expect.objectContaining({
            objectName: archiveObject,
            hours: 24 // Default restoration period
          })
        })
      );
    });

    it('should check restoration status', async () => {
      mockObjectStorageClient.headObject.mockResolvedValue({
        archivalState: 'Restored',
        timeOfArchival: new Date('2023-01-15')
      });

      const status = await ociStorageService.getRestorationStatus(
        'archive/daily/2023-01-15/events.json.gz'
      );

      expect(status).toEqual({
        isRestored: true,
        archivalState: 'Restored',
        timeOfArchival: expect.any(Date)
      });
    });

    it('should handle restoration in progress', async () => {
      mockObjectStorageClient.headObject.mockResolvedValue({
        archivalState: 'Restoring'
      });

      const status = await ociStorageService.getRestorationStatus(
        'archive/daily/2023-01-15/events.json.gz'
      );

      expect(status.isRestored).toBe(false);
      expect(status.archivalState).toBe('Restoring');
    });
  });

  describe('Security and Encryption', () => {
    it('should encrypt data before uploading to OCI', async () => {
      const encryptionKey = 'test-encryption-key';
      ociStorageService.encryptionKey = encryptionKey;

      const data = { sensitive: 'information' };
      const encrypted = await ociStorageService.encryptData(data);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.toString()).not.toContain('information');
    });

    it('should use customer-managed encryption keys', async () => {
      const kmsKeyId = 'ocid1.key.oc1..test';
      ociStorageService.kmsKeyId = kmsKeyId;

      await analyticsService.migrateToOCIColdStorage();

      expect(mockObjectStorageClient.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          opcSseCustomerAlgorithm: 'AES256',
          opcSseKmsKeyId: kmsKeyId
        })
      );
    });

    it('should verify data integrity with checksums', async () => {
      const data = Buffer.from('test data');
      const checksum = ociStorageService.calculateChecksum(data);

      mockObjectStorageClient.putObject.mockResolvedValue({
        eTag: 'etag',
        opcContentMd5: checksum
      });

      await ociStorageService.uploadWithVerification('test.json', data);

      expect(mockObjectStorageClient.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          contentMD5: checksum
        })
      );
    });

    it('should implement access control for buckets', async () => {
      await ociStorageService.configureBucketPolicies();

      // Verify IAM policies are set
      expect(mockObjectStorageClient.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          objectName: expect.stringContaining('bucket-policy')
        })
      );
    });
  });

  describe('Performance and Optimization', () => {
    it('should use multipart upload for large files', async () => {
      const largeData = Buffer.alloc(100 * 1024 * 1024); // 100MB
      
      mockObjectStorageClient.createMultipartUpload = jest.fn()
        .mockResolvedValue({ uploadId: 'upload-123' });
      mockObjectStorageClient.uploadPart = jest.fn()
        .mockResolvedValue({ etag: 'part-etag' });
      mockObjectStorageClient.commitMultipartUpload = jest.fn()
        .mockResolvedValue({ etag: 'final-etag' });

      await ociStorageService.uploadLargeObject('large.json', largeData);

      expect(mockObjectStorageClient.createMultipartUpload).toHaveBeenCalled();
      expect(mockObjectStorageClient.uploadPart).toHaveBeenCalled();
      expect(mockObjectStorageClient.commitMultipartUpload).toHaveBeenCalled();
    });

    it('should implement parallel uploads for better performance', async () => {
      const files = Array(10).fill(null).map((_, i) => ({
        name: `file-${i}.json`,
        data: Buffer.from(`data-${i}`)
      }));

      const startTime = Date.now();
      await ociStorageService.uploadMultipleFiles(files);
      const duration = Date.now() - startTime;

      // All uploads should happen in parallel
      expect(mockObjectStorageClient.putObject).toHaveBeenCalledTimes(10);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });

    it('should use pre-authenticated requests for direct access', async () => {
      mockObjectStorageClient.createPreauthenticatedRequest.mockResolvedValue({
        id: 'par-123',
        accessUri: '/p/par-123/analytics/data.json'
      });

      const par = await ociStorageService.createPreAuthRequest(
        'analytics/data.json',
        'ObjectRead',
        new Date(Date.now() + 3600000) // 1 hour
      );

      expect(par).toHaveProperty('accessUri');
      expect(mockObjectStorageClient.createPreauthenticatedRequest).toHaveBeenCalled();
    });

    it('should implement request throttling to avoid rate limits', async () => {
      const requests = Array(100).fill(null).map(() => 
        ociStorageService.getObject('test.json')
      );

      mockObjectStorageClient.getObject.mockResolvedValue({ value: 'data' });

      await Promise.all(requests);

      // Should batch requests to avoid rate limiting
      expect(mockObjectStorageClient.getObject.mock.calls.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Monitoring and Alerts', () => {
    it('should track storage metrics', async () => {
      const metrics = await ociStorageService.getStorageMetrics();

      expect(metrics).toHaveProperty('hotStorage');
      expect(metrics).toHaveProperty('coldStorage');
      expect(metrics).toHaveProperty('archiveStorage');
      expect(metrics).toHaveProperty('totalSize');
      expect(metrics).toHaveProperty('objectCount');
    });

    it('should alert on storage quota approaching', async () => {
      const alertService = {
        sendAlert: jest.fn()
      };

      ociStorageService.alertService = alertService;
      ociStorageService.storageQuota = 1000000000; // 1GB

      // Mock storage usage at 90%
      mockObjectStorageClient.getBucket.mockResolvedValue({
        approximateSize: 900000000
      });

      await ociStorageService.checkStorageQuota();

      expect(alertService.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'storage_quota_warning',
          message: expect.stringContaining('90%')
        })
      );
    });

    it('should monitor migration job performance', async () => {
      const metricsCollector = {
        recordMetric: jest.fn()
      };

      analyticsService.metricsCollector = metricsCollector;

      await analyticsService.migrateToOCIColdStorage();

      expect(metricsCollector.recordMetric).toHaveBeenCalledWith(
        'migration_duration',
        expect.any(Number)
      );
      expect(metricsCollector.recordMetric).toHaveBeenCalledWith(
        'migration_object_count',
        expect.any(Number)
      );
    });
  });

  describe('Disaster Recovery', () => {
    it('should replicate data across regions', async () => {
      const replicationConfig = {
        targetRegion: 'us-ashburn-1',
        targetBucket: 'analytics-cold-replica'
      };

      await ociStorageService.configureReplication(replicationConfig);

      expect(mockObjectStorageClient.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          objectName: expect.stringContaining('replication-policy')
        })
      );
    });

    it('should perform backup verification', async () => {
      const backupVerification = await ociStorageService.verifyBackups();

      expect(backupVerification).toHaveProperty('verified');
      expect(backupVerification).toHaveProperty('missingObjects');
      expect(backupVerification).toHaveProperty('corruptedObjects');
    });

    it('should support point-in-time recovery', async () => {
      const recoveryPoint = new Date('2024-12-01');
      
      await ociStorageService.restoreToPointInTime(recoveryPoint);

      expect(mockObjectStorageClient.listObjects).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.stringContaining('timeCreated')
        })
      );
    });
  });
});