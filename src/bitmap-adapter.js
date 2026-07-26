// upscale bitmapResolution:1 costumes and serialize edited bitmaps back to PNG
export class NodeBitmapAdapter {
  resize(imageOrCanvas, width, height) {
    const source = imageOrCanvas
    const data = new Uint8ClampedArray(width * height * 4)

    for (let y = 0; y < height; y++) {
      const sy = Math.min(source.height - 1, Math.floor((y / height) * source.height))
      for (let x = 0; x < width; x++) {
        const sx = Math.min(source.width - 1, Math.floor((x / width) * source.width))
        const srcOffset = (sy * source.width + sx) * 4
        const dstOffset = (y * width + x) * 4
        data[dstOffset] = source.data[srcOffset]
        data[dstOffset + 1] = source.data[srcOffset + 1]
        data[dstOffset + 2] = source.data[srcOffset + 2]
        data[dstOffset + 3] = source.data[srcOffset + 3]
      }
    }

    return { width, height, data }
  }

  convertDataURIToBinary(dataURI) {
    const base64 = dataURI.slice(dataURI.indexOf(',') + 1)
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
}
