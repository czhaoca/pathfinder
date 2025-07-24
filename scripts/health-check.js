#!/usr/bin/env node

/**
 * Health Check Script for Docker Container
 * Used by Docker HEALTHCHECK to verify service is running correctly
 */

const http = require('http');
const process = require('process');

const options = {
  hostname: 'localhost',
  port: process.env.MCP_PORT || 3000,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('Health check passed');
    process.exit(0);
  } else {
    console.error(`Health check failed with status: ${res.statusCode}`);
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.error('Health check timed out');
  request.destroy();
  process.exit(1);
});

request.end();