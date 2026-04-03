const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const server = http.createServer((req, res) => {
  // Parse the URL
  const parsedUrl = url.parse(req.url, true);
  let pathname;
  try {
    pathname = `.${decodeURIComponent(parsedUrl.pathname)}`;
  } catch (_error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>400 Bad Request</h1><p>Invalid URL encoding.</p>', 'utf-8');
    return;
  }
  if (pathname === './') {
    pathname = './index.html';
  }

  // Get the file extension
  const extname = String(path.extname(pathname)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);

  fs.readFile(pathname, (error, content) => {
    if (error) {
      if(error.code === 'ENOENT') {
        // Try with .html extension if no extension is provided
        if (!extname) {
          const newPath = `${pathname}.html`;
          return fs.readFile(newPath, (err, content) => {
            if (err) {
              res.writeHead(404, { 'Content-Type': 'text/html' });
              res.end('<h1>404 Not Found</h1><p>The page you requested was not found.</p>', 'utf-8');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content, 'utf-8');
            }
          });
        }
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1><p>The page you requested was not found.</p>', 'utf-8');
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const port = 5500;
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log(`Main page: http://localhost:${port}/index.html`);
  console.log(`Admin panel: http://localhost:${port}/admin.html`);
  const nets = os.networkInterfaces();
  const lan = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) lan.push(net.address);
    }
  }
  if (lan.length) {
    console.log(`LAN access:`);
    lan.forEach(addr => {
      console.log(`  http://${addr}:${port}/`);
    });
  }
});
