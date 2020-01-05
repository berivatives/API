//JSON FORMAT - SATOSHI UNIT

//npm install ws 
var WebSocket = require('ws'),
		ws = new WebSocket('wss://www.berivatives.com/markets'),
		satoshi = 100000000,
		events = {
			'chat', 'c',
			'liquidations', 'l',
			'candle1second', '1S',
			'candle5seconds', '5S',
			'candle15seconds', '15S',
			'candle30seconds', '30S',
			'candle1minute', '1',
			'candle5minutes', '5',
			'candle15minutes', '15',
			'candle30minutes', '30',
			'candle1hour', '60',
			'candle2hours', '120',
			'candle4hours', '240',
			'candle12hours', '720',
			'candle1day', '1D',
			'historic', 'h',
			'orderbook', 'ob',
			'fullorderbook', 'obf'
		};


let bids, asks, bidsobf, asksobf;

//max 50 events / websocket
//max 100 subs / minute
function subscribe(symbol, events){
	ws.send(JSON.stringify({symbol:symbol, message:'subscribe', events:events}));
}

function unsubscribe(symbol, events){
	ws.send(JSON.stringify({symbol:symbol, message:'unsubscribe', events:events}));
}

//interval -> see the events map
//begin and end -> milliseconds
function getCandles(symbol, interval, begin, end){
	//GET "https://www.berivatives.com/candles?symbol="+symbol+"&interval="+interval+"&begin="+begin+"&end="+end
	//HTTP CODE: 200 = OK || 429 = Too Many Requests || 500 = Internal Server Error
	//[
	//	[beginDate, open, high, low, close, volume, bitcoinVolume , endDate],
	//	[beginDate, open, high, low, close, volume, bitcoinVolume, endDate],
	//	...
	//]
}

ws.on('open', function open() {
		
	subscribe("ETH", [events['chat'], events['historic'], events['candle1hour'], events['orderbook']]);
	
	setTimeout(function(){
		unsubscribe("ETH", [events['chat'], events['orderbook']]); //stop receiving events for theses channels in 60 seconds
	}, 60000);
	
});

ws.on('message', function incoming(data) {
	try{
		
		const json = JSON.parse(data);
		
		if(json['error'] == true){
			console.log(json['message']);
			return;
		}
			
		if(json['c'] === 'ob'){ // orderbook every sec
			bids = json['d'][0]; // first 25 bids [[price, quantity], ...] sorted in descending order
			asks = json['d'][1]; // first 25 asks [[price, quantity], ...] sorted in ascending order
		}
		
		else if(json['c'] === 'obf'){ // fullorderbook event
			if(json[''] == 's'){ // snapshot
				//2 dictionnaries which are NOT SORTED where key = price and value = quantities
				//you should use a skip list if you want to sort the orderbook and keep a good complexity -> log(n)
				bidsobf = json['d'][0];
				asksobf = json['d'][1];
			}else{ // update
				updateFullOrderBook(bidsobf, asksobf, json['d']); //function at the bottom of the file
			}
		}
		
		else if(json['c'] == 't'){ // tickers every sec
			/***
			 l = lastPrice ; va = 24H variation in % ; v = 24H volume
			 json['d'] =
					{
							"ETH": {n:"Ethereum", l:0, va:'0.00', v:0},
					}
			****/
		}
		
		else if(json['c'] == 'h'){ // historic
			//if json['t'] == 's' -> snapshot of the last 30 trades else new trades executed
			//json['d'] = [[price, quantity, time, side],...] if side == 0 -> sell else buy
		}
		
		else if(json['c'] == 'l'){ // liquidations
			//if side == 0 -> short else long
			//if json['t'] == 's' -> [[price, quantity, time, side, symbol],...] snapshot of the last 30 liquidations else new liquidations
			//json['d'] = [price, quantity, time, side, symbol]
		}
		
		else if(json['c'] == 'c'){ // chat message
			//if json['t'] == 's' -> snapshot of the last 15 messages else new message
			//if json['t'] == 's' -> json['d'] = [[time, pseudo, message],...]
			//else json['d'] = [time, pseudo, message]
		}
		
		else{ // candles
			//json['d'] = [beginDate, open, high, low, close, volume, bitcoinVolume , endDate] //every 500ms
		}
	}catch(e){
		console.log(e);
	}
});

ws.on('error', function error() {});

ws.on('close', function close() {});

function updateFullOrderBook(bids, asks, orderbook_update){
	// orderbook_update is an array of events like this [[Price, '-' | '+', Quantity, 'a' | 'b'], []...]
	for(let x in orderbook_update){
		if(orderbook_update[x][3] == 'b'){ //bids update
			if(bids[orderbook_update[x][0]] ==	undefined){ //price not in the book yet
				if(orderbook_update[x][1] == '+'){
					bids[orderbook_update[x][0]] = Number(orderbook_update[x][2]);
				}else { //some events are missing - ask to remove quantity that were not in the book
					unsubscribe('ETH', 'obf');
					subscribe('ETH', 'obf');
				}
			}else{
				if(orderbook_update[x][1] == '-'){
					bids[orderbook_update[x][0]] -= Number(orderbook_update[x][2]);
				}else{
					bids[orderbook_update[x][0]] += Number(orderbook_update[x][2]);
				}
				if(bids[orderbook_update[x][0]] <= 0){
					if(bids[orderbook_update[x][0]] == 0){
						delete bids[orderbook_update[x][0]];
					}else{ //some events are missing because negative quantity is impossible
						unsubscribe('ETH', 'obf');
						subscribe('ETH', 'obf');
					}
				}
			}
		}else{ //asks update
			if(asks[orderbook_update[x][0]] ==	undefined){
				if(orderbook_update[x][1] == '+'){
					asks[orderbook_update[x][0]] = Number(orderbook_update[x][2]);
				}else{ //some events are missing - ask to remove quantity that were not in the book
					unsubscribe('ETH', 'obf');
					subscribe('ETH', 'obf');
				}
			}else{
				if(orderbook_update[x][1] == '-'){
					asks[orderbook_update[x][0]] -= Number(orderbook_update[x][2]);
				}
				else{
					asks[orderbook_update[x][0]] += Number(orderbook_update[x][2]);
				}
				if(asks[orderbook_update[x][0]] <= 0){
					if(asks[orderbook_update[x][0]] == 0){
						delete asks[orderbook_update[x][0]];
					}else{ //some events are missing because negative quantity is impossible
						unsubscribe('ETH', 'obf');
						subscribe('ETH', 'obf');
					}
				}
			}				
		}
}
