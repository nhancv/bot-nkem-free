function isBlank(str) {
  return (!str || /^\s*$/.test(str))
}

///////////////////
/**
 * EXPORT
 */
module.exports = {
  isBlank
}