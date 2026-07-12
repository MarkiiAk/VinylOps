// Genera los PNG de iconos PWA a partir de los SVG fuente en scripts/.
//
// Uso: node scripts/generate-icons.mjs
//
// Por que un script y no assets estaticos dibujados a mano: el diseno del
// icono (cuchilla de plotter en gradiente neon cian/violeta sobre fondo
// oscuro) esta definido una sola vez en SVG y se re-rasteriza a los tamanos
// que exige cada plataforma. Si cambia el branding, se edita el SVG y se
// vuelve a correr este script; no hay que retocar PNGs a mano.
//
// Ver ARCHITECTURE.md, seccion "PWA / Iconos".

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SOURCE = path.join(__dirname, "icon-source.svg");
const SOURCE_MASKABLE = path.join(__dirname, "icon-source-maskable.svg");
const OUT_DIR = path.join(root, "public", "icons");

// Color de fondo solido para apple-touch-icon: iOS no soporta canal alfa en
// este icono (lo compone sobre un fondo propio y cualquier transparencia se
// ve rara), asi que se aplana sobre el mismo tono de fondo del manifest.
const APPLE_BG = "#050507";

async function generate() {
  await mkdir(OUT_DIR, { recursive: true });

  await sharp(SOURCE)
    .resize(192, 192)
    .png()
    .toFile(path.join(OUT_DIR, "icon-192.png"));

  await sharp(SOURCE)
    .resize(512, 512)
    .png()
    .toFile(path.join(OUT_DIR, "icon-512.png"));

  await sharp(SOURCE_MASKABLE)
    .resize(512, 512)
    .png()
    .toFile(path.join(OUT_DIR, "icon-maskable-512.png"));

  await sharp(SOURCE)
    .resize(180, 180)
    .flatten({ background: APPLE_BG })
    .png()
    .toFile(path.join(OUT_DIR, "apple-touch-icon.png"));

  console.log("Iconos generados en", OUT_DIR);
}

generate().catch((err) => {
  console.error("Fallo la generacion de iconos:", err);
  process.exit(1);
});
