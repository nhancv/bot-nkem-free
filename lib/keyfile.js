const fs = require('fs')
const print = require('chalk-printer')
const clear = require('clear')
const inquirer = require('inquirer')
const log = console.log

var queryKey = () => {
  var questions = [
    {
      name: 'publicKey',
      type: 'input',
      message: 'Enter public key:',
      filter: function (value) {
        return value.replace(/\s/g, '')
      },
      validate: function (value) {
        if (value.length) {
          return true
        } else {
          return 'Please enter public key.'
        }
      }
    },
    {
      name: 'secretKey',
      type: 'password',
      message: 'Enter secret key:',
      filter: function (value) {
        return value.replace(/\s/g, '')
      },
      validate: function (value) {
        if (value.length) {
          return true
        } else {
          return 'Please enter secret key.'
        }
      }
    }
  ]
  return inquirer.prompt(questions)
}
/**
 * Create .apikey.json file to dir. 
 * Usage: const {publicKey, secretKey} = require('./.apikey.json')
 */
const gen = (dir, force) => {
  return new Promise(function (resolve, reject) {
    //@nhancv: check keyfile
    var keyPath = `${dir}/.apikey.json`
    if (!fs.existsSync(keyPath) || force) {
      queryKey()
        .then(data => {
          return new Promise(function (resolve, reject) {
            fs.writeFile(`${dir}/.apikey.json`, JSON.stringify(data), (err) => {
              if (err) {
                console.error(err)
                reject()
              } else {
                print.ok('Key file has been created.')
                resolve()
              }
            })
          })
        })
        .then(resolve, reject)
    } else {
      resolve()
    }
  })
}

///////////////////
/**
 * EXPORT
 */
module.exports = {
  gen
}