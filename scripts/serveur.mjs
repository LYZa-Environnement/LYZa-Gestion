#!/usr/bin/env node
/**
 * Petit serveur local, sans dépendance, pour travailler sur LYZa Gestion.
 *
 *   node scripts/serveur.mjs          sert src/  (sources, rechargées à chaque visite)
 *   node scripts/serveur.mjs --dist   sert dist/ (page assemblée par le build)
 *
 * Puis ouvrir http://localhost:8080/. Un serveur (plutôt que d'ouvrir le
 * fichier directement) est nécessaire : le navigateur réserve le stockage et
 * le chiffrement aux pages servies en http(s) ou depuis localhost.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dossier = path.join(racine, process.argv.includes('--dist') ? 'dist' : 'src')
const port = Number(process.env.PORT || 8080)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

createServer(async (req, res) => {
  try {
    const chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    let fichier = path.join(dossier, path.normalize(chemin))
    if (!fichier.startsWith(dossier)) throw new Error('interdit')
    if ((await stat(fichier)).isDirectory()) fichier = path.join(fichier, 'index.html')
    const corps = await readFile(fichier)
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    res.end(corps)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Introuvable')
  }
}).listen(port, 'localhost', () => {
  console.log(`LYZa Gestion : http://localhost:${port}/  (${path.relative(racine, dossier)}/)`)
})
