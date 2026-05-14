// Test script to verify the feed endpoint works
// Run with: node test-feed.js

import fetch from 'node-fetch';

async function testFeedEndpoint() {
  console.log('Testing /api/feed endpoint...');

  try {
    const response = await fetch('http://localhost:3000/api/feed?page=0');
    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok && Array.isArray(data) && data.length > 0) {
      console.log('✅ Feed endpoint working correctly!');
    } else {
      console.log('❌ Feed endpoint returned unexpected data');
    }
  } catch (error) {
    console.error('❌ Error testing feed endpoint:', error.message);
  }
}

testFeedEndpoint();