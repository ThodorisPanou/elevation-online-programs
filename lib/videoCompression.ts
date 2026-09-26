// lib/videoCompression.ts
// Shrinks a video in the browser before upload: H.264 MP4, shorter side ≤ 720px,
// faststart so playback begins before the whole file downloads.
// ffmpeg.wasm (~31 MB core) is fetched from the CDN on first use, then reused.

import type { FFmpeg } from '@ffmpeg/ffmpeg'

const CORE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'

// Clips already this small and in MP4 aren't worth the processing time
const SKIP_BELOW_BYTES = 5 * 1024 * 1024
// Give up and upload the original if encoding runs longer than this
const TIMEOUT_MS = 10 * 60 * 1000

let ffmpegPromise: Promise<FFmpeg> | null = null

function loadFFmpeg(): Promise<FFmpeg> {
  ffmpegPromise ??= (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')])
    const ffmpeg = new FFmpeg()
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    return ffmpeg
  })()
  // Let a failed load be retried on the next upload
  ffmpegPromise.catch(() => { ffmpegPromise = null })
  return ffmpegPromise
}

/**
 * Returns a compressed MP4, or the original file when compression isn't worth it
 * or fails — an upload should never be blocked by this step.
 */
export async function compressVideo(file: File, onProgress?: (pct: number) => void): Promise<File> {
  if (file.type === 'video/mp4' && file.size < SKIP_BELOW_BYTES) return file

  let ffmpeg: FFmpeg | null = null
  const onFFmpegProgress = ({ progress }: { progress: number }) => {
    // ffmpeg reports 0..1, occasionally out of range for odd containers
    onProgress?.(Math.max(0, Math.min(100, Math.round(progress * 100))))
  }

  try {
    ffmpeg = await loadFFmpeg()
    ffmpeg.on('progress', onFFmpegProgress)

    const { fetchFile } = await import('@ffmpeg/util')
    await ffmpeg.writeFile('input', await fetchFile(file))

    const code = await ffmpeg.exec([
      '-i', 'input',
      // Shorter side capped at 720px (portrait or landscape), never upscaled; -2 keeps dimensions even
      '-vf', "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart',
      'output.mp4',
    ], TIMEOUT_MS)
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`)

    const data = await ffmpeg.readFile('output.mp4') as Uint8Array
    if (data.byteLength === 0 || data.byteLength >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.mp4'
    return new File([data.slice()], name, { type: 'video/mp4' })
  } catch (err) {
    console.warn('Video compression failed, uploading original:', err)
    // A timed-out or crashed instance can be left in a bad state — start fresh next time
    ffmpeg?.terminate()
    ffmpegPromise = null
    ffmpeg = null
    return file
  } finally {
    if (ffmpeg) {
      ffmpeg.off('progress', onFFmpegProgress)
      await ffmpeg.deleteFile('input').catch(() => {})
      await ffmpeg.deleteFile('output.mp4').catch(() => {})
    }
  }
}
