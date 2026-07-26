import { PNG } from 'pngjs'
import jpeg from 'jpeg-js'

if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'Node.js' }
}

function decodeDataUri(dataUri) {
  const comma = dataUri.indexOf(',')
  const meta = dataUri.slice(5, comma)
  const contentType = meta.split(';')[0]
  const buffer = Buffer.from(dataUri.slice(comma + 1), 'base64')

  if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
    const { width, height, data } = jpeg.decode(buffer, { useTArray: true })
    return {
      width,
      height,
      data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    }
  }

  // Default to PNG
  const png = PNG.sync.read(buffer)
  return {
    width: png.width,
    height: png.height,
    data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength),
  }
}

class NodeImage {
  constructor() {
    this.onload = null
    this.onerror = null
    this.width = 0
    this.height = 0
    this.data = null
    this._src = ''
  }

  set src(dataUri) {
    this._src = dataUri
    queueMicrotask(() => {
      try {
        const decoded = decodeDataUri(dataUri)
        this.width = decoded.width
        this.height = decoded.height
        this.data = decoded.data
        if (this.onload) this.onload()
      } catch (error) {
        if (this.onerror) this.onerror(error)
      }
    })
  }

  get src() {
    return this._src
  }
}

if (typeof globalThis.Image === 'undefined') {
  globalThis.Image = NodeImage
}

// HTMLCanvasElement shim
class NodeCanvas {
  constructor() {
    this.width = 0
    this.height = 0
    this._data = null
  }

  #ensureBuffer() {
    const size = this.width * this.height * 4
    if (!this._data || this._data.length !== size) {
      this._data = new Uint8ClampedArray(size)
    }
    return this._data
  }

  getContext() {
    const canvas = this
    return {
      drawImage(image) {
        const data = canvas.#ensureBuffer()
        data.set(image.data.subarray(0, data.length))
      },
      putImageData(imageData) {
        const data = canvas.#ensureBuffer()
        data.set(imageData.data.subarray(0, data.length))
      },
      getImageData(_x, _y, width, height) {
        return { width, height, data: canvas.#ensureBuffer() }
      },
    }
  }

  toDataURL() {
    const png = new PNG({ width: this.width, height: this.height })
    png.data = Buffer.from(this._data.buffer, this._data.byteOffset, this._data.byteLength)
    const buffer = PNG.sync.write(png)
    return `data:image/png;base64,${buffer.toString('base64')}`
  }
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    hidden: false,
    createElement(tagName) {
      if (tagName === 'canvas') return new NodeCanvas()
      return {}
    },
    body: { addEventListener() {}, removeEventListener() {} },
  }
}

// shims
if (typeof globalThis.NodeList === 'undefined') {
  globalThis.NodeList = class NodeList {}
}
if (typeof globalThis.Element === 'undefined') {
  globalThis.Element = class Element {}
}
