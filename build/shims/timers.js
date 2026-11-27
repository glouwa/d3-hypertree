// Browser stand-in for node:timers, used by xml2js (setImmediate).
export const setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args)
export const clearImmediate = id => clearTimeout(id)
export default { setImmediate, clearImmediate }
