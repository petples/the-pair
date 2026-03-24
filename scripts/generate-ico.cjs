/* global require, console */
/* eslint-disable @typescript-eslint/no-require-imports */
const { default: pngToIco } = require('png-to-ico')
const fs = require('fs')

;(async () => {
  const buf = await pngToIco(['build/icon.png'])
  fs.writeFileSync('build/icon.ico', buf)
  console.log('✓ Windows icon generated')
})()
