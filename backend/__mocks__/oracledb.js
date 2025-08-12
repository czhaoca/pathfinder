// Mock for oracledb module

// DbObject mock class needs to be defined first
class DbObject {
  constructor() {
    this._attributes = {};
  }
  
  get attributes() { return this._attributes; }
  set attributes(val) { this._attributes = val; }
  
  get isCollection() { return false; }
  get elementTypeClass() { return null; }
  get elementTypeName() { return null; }
  get fqn() { return 'MOCK.DBOBJECT'; }
  get length() { return 0; }
  get name() { return 'DBOBJECT'; }
  get schema() { return 'MOCK'; }
  
  // Methods
  append() {}
  deleteElement() {}
  getElement() { return null; }
  getFirstIndex() { return null; }
  getKeys() { return []; }
  getLastIndex() { return null; }
  getNextIndex() { return null; }
  getPrevIndex() { return null; }
  getValues() { return []; }
  hasElement() { return false; }
  setElement() {}
  trim() {}
}

// Create the mock pool object
const mockPool = {
  status: 6000, // POOL_STATUS_OPEN
  connectionsOpen: 0,
  connectionsInUse: 0,
  
  getConnection: jest.fn().mockResolvedValue({
    execute: jest.fn().mockResolvedValue({ 
      rows: [], 
      outBinds: {},
      rowsAffected: 0,
      metaData: []
    }),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue(undefined),
    queryStream: jest.fn().mockReturnValue({
      on: jest.fn(),
      destroy: jest.fn()
    })
  }),
  
  close: jest.fn().mockResolvedValue(undefined),
  terminate: jest.fn().mockResolvedValue(undefined),
  reconfigure: jest.fn().mockResolvedValue(undefined),
  logStatistics: jest.fn()
};

const oracledb = {
  // Connection pool constants
  POOL_STATUS_OPEN: 6000,
  POOL_STATUS_CLOSED: 6002,
  POOL_STATUS_DRAINING: 6001,
  
  // Data type constants
  STRING: 2001,
  NUMBER: 2002,
  DATE: 2003,
  CURSOR: 2004,
  BUFFER: 2005,
  CLOB: 2006,
  BLOB: 2007,
  
  // Binding constants
  BIND_IN: 3001,
  BIND_OUT: 3002,
  BIND_INOUT: 3003,
  
  // Other constants
  OUT_FORMAT_OBJECT: 4002,
  OUT_FORMAT_ARRAY: 4001,
  SYSDBA: 2,
  SYSOPER: 4,
  
  // Expose the mock pool
  mockPool: mockPool,
  
  // Main methods
  createPool: jest.fn().mockResolvedValue(mockPool),
  getPool: jest.fn().mockReturnValue(mockPool),
  getConnection: jest.fn().mockResolvedValue({
    execute: jest.fn().mockResolvedValue({ 
      rows: [], 
      outBinds: {},
      rowsAffected: 0,
      metaData: []
    }),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue(undefined)
  }),
  
  // Configuration
  outFormat: 4002,
  fetchAsString: [2006, 2002],
  autoCommit: false,
  poolMin: 10,
  poolMax: 10,
  poolIncrement: 0,
  poolTimeout: 60,
  maxRows: 0,
  fetchArraySize: 100,
  
  // Utility methods
  initOracleClient: jest.fn(),
  shutdown: jest.fn().mockResolvedValue(undefined),
  startup: jest.fn().mockResolvedValue(undefined),
  
  // Version info
  versionString: '5.5.0',
  versionSuffix: '',
  oracleClientVersionString: '19.8.0.0.0',
  
  // DbObject class
  DbObject: DbObject,
  
  // Reset mock function for tests
  __resetMocks: () => {
    oracledb.createPool.mockClear();
    oracledb.getPool.mockClear();
    oracledb.getConnection.mockClear();
    mockPool.getConnection.mockClear();
    mockPool.close.mockClear();
  }
};

module.exports = oracledb;