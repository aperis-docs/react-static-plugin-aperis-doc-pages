declare module 'probe-image-size' {
  import { ReadStream } from 'fs'

  const probeFunc: (stream: ReadStream) => { width: string, height: string }
  export default probeFunc
}
