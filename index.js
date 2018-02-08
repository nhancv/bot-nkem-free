const request = require('request')
const crypto = require('crypto')
const apiKey = require('./.apikey.json')
const log = console.log

var host = "https://api.kucoin.com"
var userEndpoint = "/v1/user/info"


var kucoinSymbols = [
    "KCS-ETH",
    "KCS-BTC",
    "ETH-BTC",
]
var symbolActive = kucoinSymbols[0]
var orderBooksEndpoint = "/v1/" + symbolActive + "/open/orders" //public
var tickEndpoint = "/v1/" + symbolActive + "/open/tick" //public
var marketFavouriteSymbols = "/v1/market/fav-symbols" //["KCS-BTC","ETH-BTC","NEO-BTC","KCS-ETH","NEO-ETH"]

var endpoint = tickEndpoint  // API endpoint

//================
//MAKE REST API
function requestPrivateApi(host, endpoint, callback) {
    var url = host + endpoint
    log("Request public api: " + url)
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
    var queryString = ""
    //splice string for signing
    var strForSign = endpoint + "/" + nonce + "/" + queryString
    //Make a base64 encoding of the completed string
    var signatureStr = new Buffer(strForSign).toString('base64')
    //KC-API-SIGNATURE in header
    const signatureResult = crypto.createHmac('sha256', secret)
        .update(signatureStr)
        .digest('hex')

    request({
        method: 'GET',
        url: url,
        headers: {
            "KC-API-KEY": publicKey,
            "KC-API-NONCE": nonce,   //Client timestamp (exact to milliseconds), before using the calibration time, the server does not accept calls with a time difference of more than 3 seconds
            "KC-API-SIGNATURE": signatureResult   //signature after client encryption
        }
    }, function (error, response, body) {
        log('Status:', response.statusCode)
        log('Headers:', JSON.stringify(response.headers))
        log('Response:', body)
        if (callback) callback(error, response, body)
    })
}

function requestPublicApi(host, endpoint, callback) {
    return new Promise(function (resolve, reject) {
        var url = host + endpoint
        log("Request public api: " + url)
        request({
            method: 'GET',
            url: url,
        }, function (error, response, body) {
            // log('Status:', response.statusCode)
            // log('Headers:', JSON.stringify(response.headers))
            // log('Response:', body)
            if (callback) callback(error, response, body)
            if (error) reject(error)
            else resolve(response)

        })
    })
}

// requestPrivateApi(host, userEndpoint)
var fee = 0.001 //0.1%
var getZ = requestPublicApi(host, "/v1/KCS-ETH/open/tick").then(function (response) {
    var body = JSON.parse(response.body)
    return Promise.resolve(body.data.sell) //Buy KCS from ETH
})
var getY = requestPublicApi(host, "/v1/KCS-BTC/open/tick").then(function (response) {
    var body = JSON.parse(response.body)
    return Promise.resolve(body.data.buy) //Sell KCS to BTC
})
var getL = requestPublicApi(host, "/v1/ETH-BTC/open/tick").then(function (response) {
    var body = JSON.parse(response.body)
    return Promise.resolve(body.data.sell) //Buy ETH from BTC
})

Promise.all([getZ, getY, getL]).then(function (values) {
    console.log(values);
    var Z = values[0]
    var Y = values[1]
    var L = values[2]

    var left = Y
    var right = Z * L * (1 - fee)
    var change = (right / left - 1) * 100
    log(`Condition 'Y < Z x L x (1-fee)' is ${left < right} [Left: ${left}; Right: ${right}]; Change: ${change}%`)
});

