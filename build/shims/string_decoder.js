// Browser stand-in for node:string_decoder. sax only needs it for Buffer input,
// parseString passes strings.
export class StringDecoder { write(b) { return String(b) } end() { return '' } }
export default { StringDecoder }
