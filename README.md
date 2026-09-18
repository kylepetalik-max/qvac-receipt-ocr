# qvac-receipt-ocr

**On-device receipt / form OCR** built with [Tether QVAC SDK](https://qvac.tether.io/) (`@qvac/sdk`).  
All inference runs locally — no cloud AI APIs, no API keys, no prompt logging after the model is cached.

Built for the Whop bounty: *Build a local AI app with Tether's QVAC SDK*.

## Features

- `loadModel()` + `ocr()` via QVAC (OCR_LATIN / ggml-ocr)
- CLI that accepts any receipt/form image (PNG, BMP, JPEG, …)
- Heuristic receipt summary (total / date / card tail) from OCR lines
- Sample receipt image included for a one-command demo

## Requirements

| Item | Version |
|------|---------|
| **Node.js** | `>= 22.17` |
| **npm** | `>= 10.9` |
| **@qvac/sdk** | `>= 0.19.0` (installed: **0.19.1** / `^0.19.0`) |
| OS | Linux / macOS / Windows (see [QVAC system requirements](https://docs.qvac.tether.io/system-requirements)) |
| RAM | ~2 GB+ free recommended for first model load |
| Disk | several GB free for the OCR model cache (`~/.qvac/models`) |

GPU (Vulkan / Metal) is optional; CPU fallback works.

## Install

```bash
git clone https://github.com/kylepetalik-max/qvac-receipt-ocr.git
cd qvac-receipt-ocr
npm install
```

## Run

```bash
# Demo with bundled sample receipt
npm run demo

# Or pass your own image
npm start -- /path/to/receipt.png
# equivalent:
QVAC_CONFIG_PATH=./qvac.config.json node src/index.js /path/to/receipt.png
```

First run downloads the OCR model from the QVAC distributed registry (needs network once). Later runs work offline from cache.

## SDK usage (what the bounty asks for)

```js
import { loadModel, ocr, OCR_LATIN, unloadModel } from '@qvac/sdk'

const modelId = await loadModel({
  modelSrc: OCR_LATIN,
  modelConfig: { langList: ['en'], magRatio: 1.5 }
})

const { blocks } = ocr({ modelId, image: './assets/sample-receipt.png' })
for (const block of await blocks) console.log(block.text)

await unloadModel({ modelId })
```

- **Model load:** `loadModel`
- **Capability used:** `ocr` (optical character recognition)
- **Inference:** entirely on-device via the QVAC Bare worker

## Project layout

```
qvac-receipt-ocr/
├── src/index.js          # CLI entry — loadModel + ocr
├── assets/
│   ├── sample-receipt.png
│   └── basic_test.bmp    # QVAC example image
├── qvac.config.json
├── package.json
├── LICENSE               # MIT
└── README.md
```

## License

MIT — see [LICENSE](./LICENSE).

## Links

- QVAC docs: https://docs.qvac.tether.io/
- SDK npm: https://www.npmjs.com/package/@qvac/sdk
- OCR guide: https://docs.qvac.tether.io/ai-capabilities/ocr/
