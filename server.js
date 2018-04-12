const splitMessage = ' ';
var PORT;
var HOST = '127.0.0.1';
var HELLO_DELAY = 5000;
var MAX_LSP_DELAY = 10000;
var MY_ROUTER = '';
var PATH_FINDER;
var LSP_SEQUENCE = 0;
var MY_LSP_HEADER = 'LSP '+LSP_SEQUENCE+' '+MY_ROUTER+ ' 00 ';
var MY_LSP_MESSAGE = '';


const readline = require('readline');
var dgram = require('dgram');
var server = dgram.createSocket('udp4');
var database = require('./database');
var prompt = require('prompt');
const Graph = require('node-dijkstra')



readConfigFile = function(){

	const fs = require('fs');

	const rl = readline.createInterface({
	  input: fs.createReadStream('config.txt')
	});

	var cpt = 0;
	rl.on('line', function (line) {
		if(cpt == 0){
			MY_ROUTER = line;
		}else if(cpt == 1){
			PORT = line;
			server.bind(PORT, HOST);
		}else if (cpt > 1){
			var ligne = line.toString().split(splitMessage);
			database.createRouter(ligne[0], ligne[1], ligne[2], 1);
			database.addLsp(MY_ROUTER, ligne[0], ligne[3], 0);
			database.addLsp(ligne[0], MY_ROUTER , ligne[3], 0); // Je peux faire ca?
			MY_LSP_MESSAGE = MY_LSP_MESSAGE + ' '+ligne[0] + ' ' + ligne[3];
		}
		++cpt;
	});

}

readConfigFile();

generateLspString = function(callback){
	var lspMessage = 'LSP '+LSP_SEQUENCE+' '+MY_ROUTER+ ' 00' + MY_LSP_MESSAGE;
	return callback(lspMessage);
}

// Message au démarrage du serveur
server.on('listening', function () {
    var address = server.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

// Lorsqu'un message est recu
server.on('message', function (message, remote) {
    console.log(remote.address + ':' + remote.port +' - ' + message);
	handlePacket(message);
	
});


// Extraction du type de paquet, le première partie du paquet
handlePacket = function(message) {
	var res = message.toString().split(splitMessage);
	var packetType = res[0];
	res.shift();
	checkPacket(packetType, res);
}

// Identification du type de paquet
checkPacket = function(packetType, res) {
	if(packetType === 'HELLO'){
		helloPacket(res);
	}else if(packetType === 'LSP'){
		lspPacket(res);
	}
	else if(packetType === 'LSACK'){
		lsackPacket(res);
	}else if(packetType === 'DATA'){
		dataPacket(res);
	}else{
		console.log('Type de paquet inconnu');
	}
},

// Gestion des paquets HELLO
helloPacket = function(res) {
	var source = res[0];	
	res.shift();
	var destination = res[0];
	res.shift();


	if(destination != MY_ROUTER){
		// Pas normal?
	}else{
		console.log('HELLO RECEIVED from '+source);
	}
}

// Gestion des paquets LSP
lspPacket = function(res) {
	var sequenceNumber = res[0];
	res.shift();
	var source = res[0];	
	res.shift();
	var noCost = res[0];	
	res.shift();
	database.addLspPacket(source, sequenceNumber, res, function(){
		this.generateLspGraph();
	});
	threadSendLspToNeighbours(sequenceNumber, source, res.join(" ")); //LSACK envoyé aussi
}

// Gestion des paquets LSACK
lsackPacket = function(res) {
	var source = res[0];	
	res.shift();
	var lspSequence = res[0];
	res.shift();


	if(source != MY_ROUTER){
		// Pas normal?
	}else{
		console.log('LSACK RECEIVED from '+source+' SequenceNumber: '+lspSequence)
		threadRemoveLspSent(lspSequence, source);
	}
}

// Gestion des paquets DATA
dataPacket = function(res) {
	var source = res[0];	
	res.shift();
	var destination = res[0];
	res.shift();
	var msg = res.join(" ");

	

	if(destination != MY_ROUTER){
		console.log('MESSAGE TO TRANSFER:')
		console.log('Source :'+source);
		console.log('Destination :'+destination);
		console.log('Message :'+msg);
		threadTransferMessage(source,destination,msg);
	}else{
		console.log('MESSAGE RECEIVED:')
		console.log('Source :'+source);
		console.log('Destination :'+destination);
		console.log('Message :'+msg);
	}
}

// Creation d'un thread pour transférer un message
// Obtention du routeur via le graphe
threadTransferMessage = function(source, destination, msg) {
	var cptTable = 0;
	while(cptTable < destinationArray.length){
		console.log(destinationArray[cptTable]+': via '+stepArray[cptTable]);
		if(destinationArray[cptTable] === destination){
			database.getRouter(stepArray[cptTable], function(router){
				console.log('DATA à destination de '+destination+' transféré à '+router.number+' Message: '+msg);
				sendUdpMessage(new Buffer('DATA '+source+' '+destination+' '+msg), router.ip, router.port);
			});
			
		}
		++cptTable;
	}
}

sendDataMessage = function(destination, msg) {
	console.log('Destination :'+destination);
	console.log('Message :'+msg);

	var cptTable = 0;
	while(cptTable < destinationArray.length){
		console.log(destinationArray[cptTable]+': via '+stepArray[cptTable]);
		if(destinationArray[cptTable] === destination){
			database.getRouter(stepArray[cptTable], function(router){
				if(router != null){
					console.log('DATA envoyé destination: '+destination+' via: '+router.number+' Message: '+msg);
					sendUdpMessage(new Buffer('DATA '+MY_ROUTER+' '+destination+' '+msg), router.ip, router.port);
				}else{
					console.log('Routeur inexistant');
				}			});
			
		}
		++cptTable;
	}
}

// Creation d'un thread qui renvoie le LSP recu à nos voisins sauf au voisin source, il recoit un LSACK
//Renvoie à ses voisins sauf de la source et voisins de la source
threadSendLspToNeighbours = function(lspSequence, source, res){
	var newMessage = new Buffer('LSP '+lspSequence+' '+source+' 00 '+res);
	var resSplit = res.split(' ');
	database.getRouterNeighbour(function(routers){
		var i = 0;
		while(i < routers.length){
			var j = 0;
			var ok = 1;
			while(j < resSplit.length){
				if(resSplit[j] === routers[i].number){
					ok = 0;
				}
				++j;
				++j;
			}
			if(ok == 1){
				var portDest = routers[i].port;
				var hostDest = routers[i].ip;
				if(routers[i].number === source){
					console.log('envoi à la source '+routers[i].number)
					database.addLspSent(lspSequence, routers[i].number);
					sendUdpMessage(new Buffer('LSACK '+MY_ROUTER+' '+lspSequence), hostDest, portDest);
				}else{
					console.log('envoi au voisin '+routers[i].number)
					database.addLspSent(lspSequence, routers[i].number);
					sendUdpMessage(newMessage, hostDest, portDest);
				}
			}else{
				console.log('LSP pas transféré à '+routers[i].number);
			}		
			++i;
		}
	});
}

// Lorsqu'un LSACK est recu, suppression du LSP en question
threadRemoveLspSent = function(lspSequence, source){
	database.removeLspSent(lspSequence, source);		
}

// Envoi message UDP
sendUdpMessage = function(newMessage, hostDest, portDest){
	var client = dgram.createSocket('udp4');
	client.send(newMessage, 0, newMessage.length, portDest, hostDest, function(err, bytes) {
		if (err) throw err;
		console.log('Message UDP envoyé à: ' + hostDest +':'+ portDest);
		client.close();
	});
}

var destinationArray = [];
var stepArray = [];

generateLspGraph = function(){
	console.log('generating graph...');
	const graph = new Map()
	var lspTwoWay = [];
	database.getAllLsp(function(lsps){
		console.log('LSPS: '+lsps);
		lspTwoWay = [];
		var i = 0;
		while(i < lsps.length){
			var j = 1;
			var router1 = lsps[i].leftRouter;
			var router2 = lsps[i].rightRouter;
	
			while(j < lsps.length){
				if(lsps[i].leftRouter === lsps[j].rightRouter && lsps[i].rightRouter === lsps[j].leftRouter){
					lspTwoWay.push({leftRouter: lsps[i].leftRouter, rightRouter: lsps[i].rightRouter, cost: lsps[i].cost});
					lsps.splice(j,1);
					--j;
				}
				++j;
			}
			lsps.splice(0,1);
		}

		database.getRouters(function(routers){
			var i = 0;
			while(i < routers.length){
				var number = routers[i].number;
				var res = [];
				lspTwoWay.forEach(function(element){
					if(element.leftRouter === number || element.rightRouter === number){
						res.push(element);
					}
				});
					if(res.length > 0){
						var j = 0;
						const a = new Map();
						while (j < res.length){
							if(res[j].leftRouter === number){
								a.set(res[j].rightRouter, res[j].cost);
							}else{
								a.set(res[j].leftRouter, res[j].cost);
							}
							++j;
						}
						graph.set(number, a);
					}
				++i;
			}
			var numberOne = MY_ROUTER;
				var res = [];
				lspTwoWay.forEach(function(element){
					if(element.leftRouter === numberOne || element.rightRouter === numberOne){
						res.push(element);
					}
				});
				var p = 0;
				const b = new Map();
				while (p < res.length){
					if(res[p].leftRouter === numberOne){
						b.set(res[p].rightRouter, res[p].cost);
					}else{
						b.set(res[p].leftRouter, res[p].cost);
					}
					++p;
				}
				graph.set(numberOne, b);
				PATH_FINDER = new Graph(graph)
				var destinationArrayTemp = [];
				var stepArrayTemp = [];
				routers.forEach(function(element){
					if(element.number != MY_ROUTER){
						destinationArrayTemp.push(element.number);
						var path = PATH_FINDER.path(MY_ROUTER, element.number);
						stepArrayTemp.push(PATH_FINDER.path(MY_ROUTER, element.number).toString().split(',')[1]);
					}		
				});
				destinationArray = destinationArrayTemp;
				stepArray = stepArrayTemp;
				var cptTable = 0;
				console.log(PATH_FINDER);
				while(cptTable < destinationArray.length){
					console.log(destinationArray[cptTable]+': via '+stepArray[cptTable]);
					++cptTable;
				}
		})		
	})	
}
prompt.start();
handleCommand = function(command){
	var ligne = command.toString().split(splitMessage);
	if(ligne[0] === 'send'){
		ligne.shift();
		var routerDestination = ligne[0];
		ligne.shift();
		var msg = ligne.join(splitMessage);
		if(routerDestination != null){
			sendDataMessage(routerDestination, msg);
		}else{
			console.log('Routeur de destination invalide');
		}
	}else if(ligne[0] === 'maxlspdelay'){
		ligne.shift();
		var maxlspdelay = ligne[0];
		if(maxlspdelay != null){
			if(!isNaN(maxlspdelay) && maxlspdelay > 0){
				clearInterval(intervalLspId);
				MAX_LSP_DELAY = maxlspdelay;
				startIntervalLSP(Number(maxlspdelay));
			}else{
				console.log('maxlspdelay NaN');
			}
		}else{
			console.log('maxlspdelay needed');
		}
	}else if(ligne[0] === 'hellodelay'){
		ligne.shift();
		var hellodelay = ligne[0];
		if(hellodelay != null){
			if(!isNaN(hellodelay) && hellodelay > 0){
				clearInterval(intervalHelloId);
				HELLO_DELAY = hellodelay;
				startIntervalHello(Number(hellodelay));
				console.log('hello delay updated to '+hellodelay)
			}else{
				console.log('hellodelay NaN')
			}
		}else{
			console.log('hellodelay needed');
		}
	}else if(ligne[0] === 'routetable'){
		var cptTable = 0;
		while(cptTable < destinationArray.length){
			console.log(destinationArray[cptTable]+': via '+stepArray[cptTable]);
			++cptTable;
		}
	}else{
		console.log('commande inconnue');
	}
}
showPrompt = function(){
	prompt.get(['command'], function (err, result) {

		console.log('Command-line input received:');
		console.log('  command: ' + result.command);
		handleCommand(result.command);
		
		showPrompt();
	});
}
showPrompt();

//génération du graphe une fois que tout est configuré
//un timeout c'est moche, mais pas trouvé mieux sans changer tout le code :/
setTimeout(function(){ 
	generateLspGraph();
}, 5000);

var intervalHelloId;
function startIntervalHello(_interval) {
	intervalHelloId = setInterval(function(){ 
		database.getRouterNeighbour(function(routers){
			var i = 0;
			console.log('HELLO PACKETS SENDING: ')
			while(i < routers.length){
				var portDest = routers[i].port;
				var hostDest = routers[i].ip;
				sendUdpMessage(new Buffer('HELLO '+MY_ROUTER+' '+routers[i].number), hostDest, portDest);
				++i;
			}
		});
	}, _interval);
}

var intervalLspId;
function startIntervalLSP(_interval) {
	// Generation et envoi d'un paquet LSP à tous les voisins
	intervalLspId = setInterval(function(){ 
		generateLspString(function(lspMessage){
			database.getRouterNeighbour(function(routers){
				console.log('LSP PACKETS SENDING: ')
				var i = 0;
				while(i < routers.length){
					var portDest = routers[i].port;
					var hostDest = routers[i].ip;
					sendUdpMessage(new Buffer(lspMessage), hostDest, portDest);
					++i;
				}
			});
		})
	}, _interval);
	
}

//on va garder la date du dernier lsp envoyé et envoyer ceux > 5 secondes
//et puis update le temps envoyé
setInterval(function(){ 

	generateLspString(function(lspMessage){
		database.getAllLspToResend(function(lspNoAck){
		var i = 0;
		while(i < lspNoAck.length){	
			database.getRouter(lspNoAck[i].routerNumber, function(router){
				console.log('RESEND LSP, NO ACK: ')
				sendUdpMessage(new Buffer(lspMessage), router.host, router.port);
				
			});
			++i;
		}
		});
	});
}, 5000);

startIntervalLSP(MAX_LSP_DELAY);
startIntervalHello(HELLO_DELAY);

 
  















