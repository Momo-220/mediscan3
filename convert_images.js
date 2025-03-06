const sharp = require('sharp');
const fs = require('fs');

// Conversion du logo
const logoSvg = fs.readFileSync('icons/logo.svg');

// Créer le logo principal
sharp(logoSvg)
    .resize(512, 512)
    .png()
    .toFile('icons/logo.png');

// Créer les icônes PWA
sharp(logoSvg)
    .resize(192, 192)
    .png()
    .toFile('icons/icon-192x192.png');

sharp(logoSvg)
    .resize(512, 512)
    .png()
    .toFile('icons/icon-512x512.png');

// Créer le favicon
sharp(logoSvg)
    .resize(32, 32)
    .png()
    .toFile('icons/favicon.png'); 