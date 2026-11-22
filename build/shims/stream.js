// Browser stand-in for node:stream. sax only uses it for its stream API, which
// xml2js's parseString doesn't use (sax itself guards the require).
export class Stream {}
export default { Stream }
