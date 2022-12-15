//JSON FORMAT - SATOSHI UNIT
//npm install ws
//npm install request if using the rest api
const WebSocket = require('ws'),
    request = require('request'),
    useRestAPI = false,
    crypto = require('crypto'),
    key = '',
    secret = '',
    satoshi = 1e8,
    account = {}, //map to store some data such as free, locked, positions...
    results = {}; //to handle the failures

let ws, time, message;

time = String(Date.now());
message = crypto.createHmac('sha512', secret).update(time).digest('hex');
const uri = 'wss://www.berivatives.com/account?key=' + key + '&message=' + message + '&time=' + time;
ws = new WebSocket(uri + '&noQueue=You can add the noQueue param if you DO NOT want to queue your message otherwise you can do it by your own because if you send lot of messages at the same time then they might not be processed');

ws.on('open', function open() {
    console.log('open');
});

ws.on('message', function incoming(data) {
    const json = JSON.parse(data);

    if (json['id'] !== undefined) {
        if (json['error'] && results[json['id']]) {
            results[json['id']](json['error'], json['data']);
        }
    }

    if (json['error']) {
        console.log(json['message']);
        return;
    }

    // don't use else if because you can receive different fields at the same time

    if (json['free'] !== undefined) {
        account['free'] = json['free'];
        getClaimPrices(); // claim prices can be updated if you add equity to the margin wallet (transfer or bitcoin deposit)
    }

    if (json['locked'] !== undefined) {
        account['locked'] = json['locked'];
    }

    if (json['margin'] !== undefined) {
        account['margin'] = json['margin']; // you can trade (account['free'] + account['locked']) * 10 - account['locked'] - account['margin']
    }

    if (json['fundingFree'] !== undefined) {
        account['fundingFree'] = json['fundingFree'];
    }

    if (json['fundingLocked'] !== undefined) {
        account['fundingLocked'] = json['fundingLocked'];
    }

    if (json['op'] !== undefined) { // positions messages
        if (json['t'] === 's') { // snapshot - map of your current positions
            json['op'] = {
                'BLX':
                    {
                        p: 1025487, //entry price in SATOSHI
                        pnl: 2000000, //realized pnl in SATOSHI
                        q: 100000000 //if q < 0 -> SHORT else LONG in SATOSHI
                    },
                'ETH':
                    {
                        p: 2000000, //entry price in SATOSHI
                        pnl: 1000000, //realized pnl in SATOSHI
                        q: -100000000 //if q < 0 -> SHORT else LONG in SATOSHI
                    },
                'BTC': //only when borrow
                    {
                        p: 5000000, //daily rate = 5000000 -> 5000000 / satoshi = 0.05 = 5%
                        pnl: -1000000, //interests
                        q: 10000000 //0.1BTC Borrowed
                    }
            };
            account['op'] = json['op'];
        } else {
            //It is a single object organized like previously
            if (json['op'] == null) delete account['op'][json['s']]; // null means the position is closed
            else account['op'][json['s']] = json['op']; // new or updated position
        }

        getClaimPrices();
    }

    if (json['o'] !== undefined) { //event when an order is placed, filled or canceled
        json['o'] = {
            id: 'id',
            s: 'symbol',
            a: "'b'(buy / borrow) | 's'(sell / lend)",
            e: 'GTC' | 'MKT' | 'STOP' | 'IOC' | 'FOK',
            q: 'quantity',
            p: 'price',
            st: "'O'(opened) | 'F'(filled) | 'C'(canceled) | 'K'(killed) | 'SF'(stop failed) | 'L'(cancel liquidation) | 'CM'(not enough funds to borrow)",
            f: 'quantity filled',
            fe: 'fees',
            t: 'timestamp in milli',
            h: 'hidden',
            r: 'reduce_only',
            po: 'post_only'
        }
    }

    if (json['oo'] !== undefined) { // list of all open orders
        json['oo'] = [
            {
                id: 'id',
                s: 'symbol',
                a: 'b | s',
                ...
            },
            {
                id: 'id',
                s: 'symbol',
                a: 'b | s',
                ...
            },
        ]
    }

    if (json['co'] !== undefined) { // last closed orders
        json['co'] = [
            {
                id: 'id',
                s: 'symbol',
                a: 'b | s',
                ...
            },
            {
                id: 'id',
                s: 'symbol',
                a: 'b | s',
                ...
            },
        ]
    }

    if (json['ba'] !== undefined) { // balance messages for deposits, withdraws, PNL
        if (json['t'] === 's') { // snapshot of the last balance events
            json['ba'] = [
                ["timestamp (integer)", 'Label', 'amount (integer)'],
                ["timestamp (integer)", 'Label', 'amount (integer)'],
            ]
        } else { // new event
            json['ba'] = ["timestamp (integer)", 'Label', 'amount (integer)']
        }
    }

    if (json['legacy'] !== undefined) { // legacy address

    }

    if (json['bech32'] !== undefined) { // segwit address

    }

});

ws.on('error', function error() {
    console.log('error');
});

ws.on('close', function close() {
    console.log('close');
});

/*
action: 's' for sell - 'b' for buy
execution: optional - default GTC - 'GTC' (Good 'Til Cancelled) or 'MKT' (Market) or 'STOP' (Stop Market) or 'IOC' (Immediate Or Cancel) or 'FOK' (Fill Or Kill)
hidden: optional - true or false
post-only: optional - true or false
reduce: optional - true or false
oco: optional the price to trigger a stop order
lp: optional the limit price of your STOP order or OCO order
myId: optional - if (!myId.match(/^[0-9a-z]+$/) || myId === 'undefined' || myId.length > 50) myId = null;
*/
function openOrder(symbol, quantity, price, execution, action, hidden, post_only, reduce) {
    const id = Date.now();
    results[id] = function (error, data) {
        if (error) console.log("fail to place the order");
        else console.log("order is placed", data);
    };
    send({
        m: 'o',
        a: action,
        s: symbol,
        q: quantity * satoshi,
        p: price * satoshi,
        e: execution,
        h: hidden,
        po: post_only,
        r: reduce,
        myId: "my optional Id",
        id: "you can provide an id to get the result of your message if you use the websocket api"
    });
}

/*
p: optional - new price or former
q: optional - new quantity or former
e: optional - new execution type or former
*/
function replaceOrder(id, newPriceOrFormer, newQteOrFormer) {
    results[id] = function (error, why) {
        if (error) console.log("fail to replace the order", id, why);
        else console.log("order has been replaced");
    };
    send({
        m: 'r',
        id: id,
        p: newPriceOrFormer * satoshi,
        q: newQteOrFormer * satoshi,
    });
}

function cancelOrder(id) {
    results[id] = function (error, why) {
        if (error) console.log("fail to cancel the order", id, why);
        else console.log("order has been cancelled");
    };
    send({
        m: 'c',
        id: id
    });
}

//type: optional - address type - default is legacy
function getNewAddress() {
    send({
        m: 'a',
        type: 'legacy' | 'bech32'
    });
}

function withdraw(quantity, address) {
    send({
        m: 'w',
        q: quantity * satoshi,
        ad: address
    });
}

//Stop automatic lending renewal
//id: optional only if you want to stop the renewal for a specific order
function stopRenewal() {
    send({
        m: 'sr',
        id: "orderId"
    });
}

//Transfer from a wallet to another one. If from == 'margin' transfer from margin to funding wallet
//to: optional
function transfer(quantity) {
    send({
        m: 't',
        from: 'margin' | 'funding',
        q: quantity * satoshi,
        to: 'if not sent then internal transfer - email of the subAccount or the word "parent" if subAccount wants to transfer to the parent account - funds are always transferred to the margin wallet'
    });
}

function getClaimPrices() {
    if (account['op'] === undefined) return;
    account['exposure'] = 0;
    if (account['op']['BTC'] !== undefined) { // undefined means no Bitcoin borrowed
        for (let s in account['op']) {
            if (s === 'BTC' || account['op'][s] == null || account['op'][s] === undefined) continue;
            account['exposure'] += Math.abs(account['op'][s]['q']) * account['op'][s]['p'] / satoshi;
        }
        account['leverage'] = (account['exposure'] - account['op']['BTC']['pnl']) / (account['free'] + account['locked']);
        if (account['leverage'] < 1) return;
        for (let s in account['op']) {
            if (s === 'BTC' || account['op'][s] == null || account['op'][s] === undefined) continue;
            if (account['op'][s]['q'] > 0) { //long
                account['op'][s]['lp'] = account['op'][s]['p'] * (1 - 1 / account['leverage']);
            } else { // short
                account['op'][s]['lp'] = account['op'][s]['p'] * (1 + 1 / account['leverage']);
            }
        }
    }
}

function send(json) {
    if (!useRestAPI) return ws.send(JSON.stringify(json));
    const time = String(Date.now());
    const message = crypto.createHmac("sha512", secret).update(time).digest("hex");
    json["key"] = key;
    json["message"] = message;
    json["time"] = time;
    request.post(
        {
            url: "https://www.berivatives.com/" + json["m"],
            body: json,
            json: true
        },
        function (error, response, body) {
            console.log(body);
        }
    );
}
