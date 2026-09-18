#!/usr/bin/env node
/**
 * qvac-receipt-ocr — on-device receipt / form OCR with Tether QVAC SDK.
 *
 * Uses loadModel() + ocr() entirely on-device (no cloud AI).
 * First run downloads the OCR model from the QVAC registry; later runs are offline.
 *
 * Usage:
 *   npm start -- [path-to-image]
 *   npm run demo
 *   node src/index.js assets/sample-receipt.png
 */
import { close, loadModel, ocr, OCR_LATIN, unloadModel } from '@qvac/sdk'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function usage() {
  console.log(`
qvac-receipt-ocr — local receipt OCR (QVAC SDK)

Usage:
  node src/index.js [image-path]

Defaults to assets/sample-receipt.png if no path is given.

Requires Node.js >= 22.17 and @qvac/sdk >= 0.19.0.
All inference runs on-device after the first model download.
`)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.includes('-h') || args.includes('--help')) {
    usage()
    process.exit(0)
  }
  const imageArg = args.find((a) => !a.startsWith('-'))
  return {
    imagePath: path.resolve(
      imageArg || path.join(root, 'assets', 'sample-receipt.png')
    )
  }
}

function printProgress(p) {
  const mb = (n) => (n / 1e6).toFixed(1)
  const line = `▸ Downloading ${p.percentage.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)`
  process.stderr.write(process.stderr.isTTY ? `\r${line}` : `${line}\n`)
  if (p.percentage >= 100) process.stderr.write('\n')
}

/** Heuristic parse of common receipt fields from OCR lines. */
function summarizeReceipt(lines) {
  const text = lines.join('\n')
  const money = [...text.matchAll(/\$?\s*(\d+[.,]\d{2})\b/g)].map((m) => m[1])
  const totalMatch =
    text.match(/total[^0-9$]*\$?\s*(\d+[.,]\d{2})/i) ||
    (money.length ? [null, money[money.length - 1]] : null)
  const dateMatch = text.match(
    /\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/
  )
  const cardMatch = text.match(/\*{2,}\s*\d{3,4}|\bxxxx[-\s]?\d{4}\b/i)
  return {
    lineCount: lines.length,
    suspectedTotal: totalMatch ? totalMatch[1] : null,
    suspectedDate: dateMatch ? dateMatch[1] : null,
    suspectedCardTail: cardMatch ? cardMatch[0] : null
  }
}

async function main() {
  const { imagePath } = parseArgs(process.argv)

  if (!fs.existsSync(imagePath)) {
    console.error(`✖ Image not found: ${imagePath}`)
    usage()
    process.exit(1)
  }

  console.log('▸ qvac-receipt-ocr — on-device OCR (Tether QVAC)')
  console.log(`▸ Image: ${imagePath}`)
  console.log(`▸ SDK model: OCR_LATIN (ggml-ocr)`)
  console.log('▸ Inference: local only (no cloud AI)\n')

  let modelId
  try {
    console.log('▸ Loading OCR model (download on first run)...')
    modelId = await loadModel({
      modelSrc: OCR_LATIN,
      modelConfig: {
        langList: ['en'],
        magRatio: 1.5,
        defaultRotationAngles: [90, 180, 270],
        contrastRetry: false,
        lowConfidenceThreshold: 0.5,
        recognizerBatchSize: 1
      },
      onProgress: printProgress
    })
    console.log(`▸ Model loaded. id=${modelId}`)

    console.log(`\n▸ Running OCR...`)
    const { blocks, stats } = ocr({
      modelId,
      image: imagePath,
      options: { paragraph: false }
    })

    const result = await blocks
    const lines = result.map((b) => b.text).filter(Boolean)

    console.log('\n▸ OCR Results')
    console.log('▸ ================================')
    for (const block of result) {
      const conf =
        block.confidence !== undefined
          ? `  (conf ${Number(block.confidence).toFixed(3)})`
          : ''
      console.log(`  ${block.text}${conf}`)
      if (block.bbox) {
        console.log(`    bbox: [${block.bbox.join(', ')}]`)
      }
    }
    console.log('▸ ================================')

    const summary = summarizeReceipt(lines)
    console.log('\n▸ Receipt summary (heuristic)')
    console.log(`  lines: ${summary.lineCount}`)
    console.log(`  total?: ${summary.suspectedTotal ?? '(not detected)'}`)
    console.log(`  date?:  ${summary.suspectedDate ?? '(not detected)'}`)
    console.log(`  card?:  ${summary.suspectedCardTail ?? '(not detected)'}`)

    if (stats) {
      const s = await stats
      if (s) {
        console.log('\n▸ Timing')
        if (s.detectionTime != null) console.log(`  detection: ${s.detectionTime} ms`)
        if (s.recognitionTime != null)
          console.log(`  recognition: ${s.recognitionTime} ms`)
        if (s.totalTime != null) console.log(`  total: ${s.totalTime} ms`)
      }
    }

    console.log('\n▸ Unloading model...')
    await unloadModel({ modelId, clearStorage: false })
    console.log('▸ Done. All inference was on-device.')
    process.exit(0)
  } catch (error) {
    console.error('✖', error)
    try {
      if (modelId) await unloadModel({ modelId, clearStorage: false })
    } catch {
      /* ignore */
    }
    try {
      await close()
    } catch {
      /* ignore */
    }
    process.exit(1)
  }
}

main()
