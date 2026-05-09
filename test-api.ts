import axios from 'axios';

async function test() {
  try {
    console.log("Testing /api/health...");
    const health = await axios.get('http://0.0.0.0:3000/api/health', { timeout: 2000 });
    console.log("Health:", health.data);
    
    console.log("Testing /api/feed?page=0...");
    const feed0 = await axios.get('http://0.0.0.0:3000/api/feed?page=0', { timeout: 10000 });
    console.log("Feed items count (page 0):", feed0.data.length);
    
    console.log("Testing /api/feed?page=1...");
    const feed1 = await axios.get('http://0.0.0.0:3000/api/feed?page=1', { timeout: 10000 });
    console.log("Feed items count (page 1):", feed1.data.length);
  } catch (e: any) {
    console.error("Test failed:", e.message);
    if (e.response) {
      console.error("Status:", e.response.status);
      console.error("Data:", e.response.data);
    }
  }
}

test();
