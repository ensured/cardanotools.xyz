const https = require('https');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

const files = [
  {
    url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon.png',
    filename: 'marker-icon.png'
  },
  {
    url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
    filename: 'marker-shadow.png'
  }
];

files.forEach(file => {
  https.get(file.url, (response) => {
    const fileStream = fs.createWriteStream(path.join(publicDir, file.filename));
    response.pipe(fileStream);
    fileStream.on('finish', () => {
      fileStream.close();
      console.log(`Downloaded ${file.filename}`);
    });
  }).on('error', (err) => {
    console.error(`Error downloading ${file.filename}:`, err.message);
  });
}); 