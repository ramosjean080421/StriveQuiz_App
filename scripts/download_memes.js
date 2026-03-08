const fs = require('fs');
const path = require('path');
const https = require('https');

const dir = path.join(__dirname, '../public/avatars');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const gifs = [
    "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif",
    "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif",
    "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif",
    "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif",
    "https://media.giphy.com/media/YRtLgsajXrz1FNJ6oy/giphy.gif",
    "https://media.giphy.com/media/l41lFw057lAJQMwg0/giphy.gif",
    "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif",
    "https://media.giphy.com/media/aZ3LDBs1ExsE8/giphy.gif",
    "https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif",
    "https://media.giphy.com/media/BPJmthQ3YRwD6QqcVD/giphy.gif",
    "https://media.giphy.com/media/12vTFiGztq55R6/giphy.gif",
    "https://media.giphy.com/media/3o85xGocUH8RYoDKKs/giphy.gif",
    "https://media.giphy.com/media/tFK8urY6XHj2w/giphy.gif",
    "https://media.giphy.com/media/10yXFkBJ0MwGQ0/giphy.gif",
    "https://media.giphy.com/media/13vJcS12NbG8qY/giphy.gif",
    "https://media.giphy.com/media/14sji1XEUEXXwY/giphy.gif",
    "https://media.giphy.com/media/sIIhZliB2McAo/giphy.gif",
    "https://media.giphy.com/media/HCTfYy1TuTLCU/giphy.gif",
    "https://media.giphy.com/media/NTur7XlVDUdqM/giphy.gif",
    "https://media.giphy.com/media/7T33BLlB7NQrM/giphy.gif",
    "https://media.giphy.com/media/xT0GqrW0l4L0pUaU9e/giphy.gif",
    "https://media.giphy.com/media/WRQBXCGjpe1tGL/giphy.gif",
    "https://media.giphy.com/media/H5C8e4Y6P1l6O/giphy.gif",
    "https://media.giphy.com/media/10bDoHxErGoT5C/giphy.gif",
    "https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif",
    "https://media.giphy.com/media/jGk0KItqWovC0/giphy.gif",
    "https://media.giphy.com/media/Jqg8hRCjENeOQ/giphy.gif",
    "https://media.giphy.com/media/8x8XigA5Coxpi/giphy.gif",
    "https://media.giphy.com/media/t1WG2R2XyZJ3w/giphy.gif",
    "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif"
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Status ${response.statusCode} for ${url}`));
            }
            const file = fs.createWriteStream(dest);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(true);
            });
            file.on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });
        }).on('error', reject);
    });
}

async function run() {
    for (let i = 0; i < gifs.length; i++) {
        const filename = `meme${i + 1}.gif`;
        const dest = path.join(dir, filename);
        try {
            await downloadFile(gifs[i], dest);
            console.log(`Downloaded ${filename}`);
        } catch (e) {
            console.error(`Error downloading ${filename}`, e);
        }
    }
}

run();
