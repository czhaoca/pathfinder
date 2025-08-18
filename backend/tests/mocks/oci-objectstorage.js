// Mock for oci-objectstorage module
class ObjectStorageClient {
  constructor(config) {
    this.config = config;
  }

  async putObject(request) {
    return Promise.resolve({
      eTag: 'mock-etag-' + Date.now(),
      opcRequestId: 'mock-request-id',
      opcContentMd5: 'mock-md5'
    });
  }

  async getObject(request) {
    return Promise.resolve({
      value: Buffer.from('mock-data'),
      eTag: 'mock-etag',
      opcRequestId: 'mock-request-id'
    });
  }

  async deleteObject(request) {
    return Promise.resolve({
      opcRequestId: 'mock-request-id'
    });
  }

  async listObjects(request) {
    return Promise.resolve({
      objects: [],
      prefixes: []
    });
  }

  async copyObject(request) {
    return Promise.resolve({
      eTag: 'mock-etag-copy',
      opcRequestId: 'mock-request-id'
    });
  }
}

module.exports = {
  ObjectStorageClient
};