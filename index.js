const request = require('request')
const crypto = require('crypto')
const apiKey = require('./.apikey.json')
const log = console.log

var host = "https://api.kucoin.com"
var endpoint = "/v1/user/info"  // API endpoint
var publicKey = apiKey.Key
var secret = apiKey.Secret //The secret assigned when the API created
var nonce = Date.now()
/** 
 *  POST parameters：
 *    type: BUY
 *    amount: 10
 *    price: 1.1
 *    Arrange the parameters in ascending alphabetical order (lower cases first), then combine them with & (don't urlencode them, don't add ?, don't add extra &), e.g. amount=10&price=1.1&type=BUY    
 */
var queryString=""
//splice string for signing
var strForSign = endpoint + "/" + nonce + "/" + queryString
//Make a base64 encoding of the completed string
var signatureStr = new Buffer(strForSign).toString('base64')
//KC-API-SIGNATURE in header
const signatureResult = crypto.createHmac('sha256', secret)
    .update(signatureStr)
    .digest('hex')

//================
//MAKE REST API
request({
    method: 'GET',
    url: host + endpoint,
    headers: {
        "KC-API-KEY": publicKey,
        "KC-API-NONCE": nonce,   //Client timestamp (exact to milliseconds), before using the calibration time, the server does not accept calls with a time difference of more than 3 seconds
        "KC-API-SIGNATURE": signatureResult   //signature after client encryption
    }
}, function (error, response, body) {
    log('Status:', response.statusCode)
    log('Headers:', JSON.stringify(response.headers))
    log('Response:', body)
})
