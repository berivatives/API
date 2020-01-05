//npm install crypto request
const request = require("request"),
  crypto = require("crypto"),
  satoshi = 100000000,
  key = '',
  secret = '';

function send(json) {
  const time = String(Date.now()); // time in milliseconds
  const message = crypto
    .createHmac("sha512", secret)
    .update(time)
    .digest("hex");
  json["time"] = time;
  json["message"] = message;
  json["window"] = 5000; //default = 5000 milliseconds = 5 seconds - if the server receives the message after time + window, the operation is cancelled
  request.post(
    {
      url: "https://www.berivatives.com/api",
      body: json,
      json: true
    },
    function(error, response, body) {
      console.log(body);
    }
  );
}

/*
action    : 's' for sell - 'b' for buy
execution : optional - default GTC - 'GTC' (Good 'Til Cancelled) or 'MKT' (Market) or 'STOP' (Stop Market) or 'IOC' (Immediate Or Cancel) or 'FOK' (Fill Or Kill)
hidden 		: optional - true or false
post-only : optional - true or false
reduce		: optional - true or false
*/
function openOrder(symbol, quantity, price, execution, action, hidden, post_only, reduce) {
  send({
    m: "o",
    a: action,
    s: symbol,
    q: quantity * satoshi,
    p: price * satoshi,
    e: execution,
    h: hidden,
    po: post_only,
    r: reduce
  });
}

/*
p  :  optional - new price or former
q  :  optional - new quantity or former
e  :  optional - boolean to execute the order @ market price
*/
function replaceOrder(id, newPrice, newQteOrFormer, isMarket) {
  send({
    m: "r",
    id: id,
    p: newPriceOrFormer * satoshi,
    q: newQteOrFormer * satoshi,
    e: isMarket
  });
}

function cancelOrder(id) {
  send({
    m: "c",
    id: id
  });
}

//type : optional - address type - default is legacy
function getNewAddress() {
  send({
    m: "a"
    type: "legacy" | "bech32"
  });
}

function withdraw(quantity, address) {
  send({
    m: "w",
    q: quantity * satoshi,
    ad: address
  });
}

//Stop automatic lending renewal
function stopRenewal() {
	send({
		m: 'sr'
	});
}

//Transfer from a wallet to another one if from == 'margin' transfer from margin wallet to funding wallet
function transfer(quantity) {
	send({
		m: 't'
		from: 'margin' | 'funding'
		q: quantity * satoshi
	});
}
