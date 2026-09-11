const sharp = require("sharp");
const fs = require("fs");

const outputDir = "public/icons";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function createIcon(size, filename) {
  const margin = Math.round(size * 0.08);
  const radius = Math.round(size * 0.18);
  const fontSize = Math.round(size * 0.58);

  const svg = `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
       xmlns="http://www.w3.org/2000/svg">

    <rect
      x="${margin}"
      y="${margin}"
      width="${size - margin * 2}"
      height="${size - margin * 2}"
      rx="${radius}"
      fill="#2563eb"
    />

    <text
      x="50%"
      y="52%"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${fontSize}px"
      font-weight="700"
      fill="#ffffff"
    >M</text>

  </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .resize(size, size)
    .toFile(`${outputDir}/${filename}`);

  console.log(`Created ${filename} - ${size}x${size}`);
}

async function main() {
  await createIcon(192, "icon-192.png");
  await createIcon(512, "icon-512.png");

  console.log("");
  console.log("MANVI ERP PWA icons created successfully.");
}

main().catch((error) => {
  console.error("Icon creation failed:", error);
  process.exit(1);
});