// Run once, then serve the repository and visit /tests/manual-preview.html.
const fs=require('node:fs');
fs.writeFileSync('tests/manual-preview.html',fs.readFileSync('index.html','utf8').replace('<head>','<head><base href="../">').replace('</body>','<script src="tests/visual-fixture.js?v=4"></script></body>'));
console.log('Generated local-only visual fixture.');
