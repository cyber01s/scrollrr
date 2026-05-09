import http from 'http';

function fetchPage(page) {
    return new Promise((resolve) => {
        http.get('http://localhost:3000/api/feed?page=' + page, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            resolve(JSON.parse(data));
          });
        });
    });
}

(async () => {
    const p0 = await fetchPage(0);
    const p1 = await fetchPage(1);
    const p2 = await fetchPage(2);
    
    console.log("p0 size:", p0.length, "p0[0] id", p0[0].id);
    console.log("p1 size:", p1.length, "p1[0] id", p1[0].id);
    console.log("p2 size:", p2.length, p2.length > 0 ? ("p2[0] id", p2[0].id) : "");
    
    // overlap?
    const p0Ids = p0.map(x => x.id);
    const overlap1 = p1.filter(x => p0Ids.includes(x.id)).length;
    console.log("overlap 0 and 1:", overlap1);
    
    const p1Ids = p1.map(x => x.id);
    const overlap2 = p2.filter(x => p1Ids.includes(x.id) || p0Ids.includes(x.id)).length;
    console.log("overlap 2:", overlap2);
})();
