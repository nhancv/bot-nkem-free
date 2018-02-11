
/**
 * Return round as floor
 * precisionFloorRound(0.9999999999, 8)
 * => 0.99999999
 * @param {*} number 
 * @param {*} precision 
 */
function precisionFloorRound(number, precision) {
  var factor = Math.pow(10, precision)
  return Math.floor(number * factor) / factor
}

/**
 * Return round as floor
 * precisionCeilRound(0.9999999999, 8)
 * => 1
 * @param {*} number 
 * @param {*} precision 
 */
function precisionCeilRound(number, precision) {
  var factor = Math.pow(10, precision)
  return Math.ceil(number * factor) / factor
}

module.exports = {
  precisionFloorRound,
  precisionCeilRound
}