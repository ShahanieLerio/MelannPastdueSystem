const jwt = require('jsonwebtoken');
const fetch = require('node-fetch'); // Wait, node-fetch might not be installed. Node 18 has fetch.
// If fetch not available, use http
const http = require('http');

const secret = 'super_secret_key_change_me';
const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000', role: 'admin' }, secret, { expiresIn: '1h' });

console.log("Token:", token);

// Make request
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/reports/aging',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`
    }
};

const req = http.request(options, res => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log('BODY:', data);
    });
});

req.on('error', e => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
