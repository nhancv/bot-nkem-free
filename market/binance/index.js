const print = require('chalk-printer')

const run = () => {
  print.ok('Hello')
}

/**
 * EXPORT
 */
module.exports = {
  main: function () {
    try {
      run()
    } catch (err) {
      print.error(err)
    }
  }
}
