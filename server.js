const splitMessage = ' ';
var PORT;
var HOST = '127.0.0.1';
const HELLO_DELAY = 5000;
const MAX_LSP_DELAY = 10000;
var MY_ROUTER = 'R1';
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
			MY_LSP_MESSAGE = MY_LSP_MESSAGE + ligne[0] + ' ' + ligne[3] +' ';
			console.log(MY_LSP_MESSAGE)
		}
		++cpt;
	});

}

readConfigFile();

generateLspString = function(callback){
	var lspMessage = 'LSP '+LSP_SEQUENCE+' '+MY_ROUTER+ ' 00 ' + MY_LSP_MESSAGE;
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
	console.log('source: '+source);
	database.addLspPacket(source, sequenceNumber, res, function(){
		this.generateLspGraph();
	});
	threadSendLspToNeighbours(source, sequenceNumber, res); //LSACK envoyé aussi
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
	console.log('ici');
	console.log('Source :'+source);
	console.log('Destination :'+destination);
	console.log('Message :'+msg);

	var path = PATH_FINDER.path(MY_ROUTER, destination);
	var routes = path.split(',');

	database.getRouter(routes[1], function(router){
		var client = dgram.createSocket('udp4');
		sendUdpMessage(new Buffer('DATA '+source+' '+' '+destination+' '+msg), router.ip, router.port);
	});
	
}

// Creation d'un thread qui renvoie le LSP recu à nos voisins sauf au voisin source, il recoit un LSACK
threadSendLspToNeighbours = function(lspSequence, source, res){

	var i = 0;
	var newMessage = new Buffer('LSP '+lspSequence+' '+source+' 00 '+res);
	database.getRouterNeighbour(function(routers){
		while(i < routers.length){
			var portDest = routers[i].port;
			var hostDest = routers[i].ip;
			if(routers[i].number === source){
				database.addLspSent(lspSequence, routers[i].number);
				console.log('LSP enregistre2');
				sendUdpMessage(new Buffer('LSACK '+source+' '+lspSequence), hostDest, portDest);
			}else{
				database.addLspSent(lspSequence, routers[i].number);
				console.log('LSP enregistre');
				sendUdpMessage(newMessage, hostDest, portDest);
			}
			++i;
		}
		//Pas de timeout, un setInterval on va garder la date du dernier lsp envoyé et envoyer ceux > 5 secondes
		/*setTimeout(function(lspSequence){ 
			database.getLspSent(lspSequence, function(lspNoAck){
				var i = 0;
				console.log(lspNoAck);
				while(i < lspNoAck.length){	
					database.getRouter(lspNoAck[i].routerNumber, function(router){
						sendUdpMessage(newMessage, router.host, router.port);
					});
					++i;
				}
			});
		}, 5000);*/
	});
}

// Lorsqu'un LSACK est recu, suppression un LSP en question
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

// ENVOI toutes les HELLO_DELAY un paquet HELLO aux routeurs voisins
setInterval(function(){ 
	database.getRouterNeighbour(function(routers){
		var i = 0;
		while(i < routers.length){
			var portDest = routers[i].port;
			var hostDest = routers[i].ip;
			sendUdpMessage(new Buffer('HELLO '+MY_ROUTER+' '+routers[i].number), hostDest, portDest);
			++i;
		}
	});
}, HELLO_DELAY);

// Generation et envoi d'un paquet LSP à tous les voisins
setInterval(function(){ 
	generateLspString(function(lspMessage){
		database.getRouterNeighbour(function(routers){
			var i = 0;
			while(i < routers.length){
				var portDest = routers[i].port;
				var hostDest = routers[i].ip;
				sendUdpMessage(new Buffer(lspMessage), hostDest, portDest);
				++i;
			}
		});
	})
}, MAX_LSP_DELAY);

//on va garder la date du dernier lsp envoyé et envoyer ceux > 5 secondes
//et puis update le temps envoyé
setInterval(function(){ 
	generateLspString(function(lspMessage){
		database.getAllLspToResend(function(lspNoAck){
		var i = 0;
		console.log(lspNoAck);
		while(i < lspNoAck.length){	
			database.getRouter(lspNoAck[i].routerNumber, function(router){
				sendUdpMessage(new Buffer(lspMessage), router.host, router.port);
				
			});
			++i;
		}
		});
	});
}, 5000);

generateLspGraph = function(){
	console.log('generating graph...');
	const graph = new Map()
	var lspTwoWay = [];
	database.getAllLsp(function(lsps){
		lspTwoWay = [];
		var i = 0;
		console.log('LSPS'+lsps)

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
				console.log('Best path: '+PATH_FINDER.path('R1', 'R3'));
		})		
	})	
}
prompt.start();
handleCommand = function(command){
	var ligne = command.toString().split(splitMessage);
	if(ligne[0] === 'send'){
		console.log('ok');
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

setTimeout(function(){ 
	generateLspGraph();

}, 5000);

 
  















