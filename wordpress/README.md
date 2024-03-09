# Wordpress Plugin

## How to release

```bash
cd ../web && yarn build
cd ../wordpress && cp ../web/dist/index.js ./js/web-embed-pdf.js
rm simplepdf.zip || true && zip -r simplepdf.zip . -x "README.md" -x ".DS_Store"
```
