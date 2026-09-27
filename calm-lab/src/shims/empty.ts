// Stands in for `fs`/`path` in the browser bundle. The shared browser entry never calls into
// either at runtime, so an empty module is enough to satisfy the bundler.
export default {};
