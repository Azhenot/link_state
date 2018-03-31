const splitMessage = ' ';
var PORT = 33333;
var HOST = '127.0.0.1';
const HELLO_DELAY = 5000;
const MAX_LSP_DELAY = 60000;
const MY_ROUTER = 'R1';


var dgram = require('dgram');
var server = dgram.createSocket('udp4');

var services = require('./services');
var database = require('./database');

//database.createRouter('R1','127.0.0.1','33333',2)
//database.createRouter('R2','127.0.0.1','33333',1)


const spawn = require('threads').spawn;

const Graph = require('node-dijkstra')




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

server.bind(PORT, HOST);

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
	database.addLspPacket(source, sequenceNumber, res);
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

	// A MODIFIER, OBTENTION DU GRAPHE
	database.getRouter(destination, function(router){
		var newMessage = new Buffer('DATA '+source+' '+' '+destination+' '+msg);
		var client = dgram.createSocket('udp4');
		sendUdpMessage(newMessage, router.ip, router.port);
	});
	
}

// Creation d'un thread qui renvoie le LSP recu à nos voisins sauf au voisin source, il recoit un LSACK
threadSendLspToNeighbours = function(lspSequence, source, res){

	var i = 0;
	var newMessage = new Buffer('LSP '+lspSequence+' '+source+' 00 '+res);
	database.getRouterNeighbour(function(routers){
		while(i < routers.length){
			var PORT = routers[i].port;
			var HOST = routers[i].ip;
			if(routers[i].number === source){
				database.addLspSent(lspSequence, routers[i].number);
				console.log('LSP enregistre2');
				sendUdpMessage(new Buffer('LSACK '+source+' '+lspSequence), HOST, PORT);
			}else{
				database.addLspSent(lspSequence, routers[i].number);
				console.log('LSP enregistre');
				sendUdpMessage(newMessage, HOST, PORT);
			}
			++i;
		}
		//Pas de timeout, un setInterval on va garder la date du dernier lsp envoyé et envoyer ceux > 5 secondes
		setTimeout(function(lspSequence){ 
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
		}, 5000);
	});
}

// Lorsqu'un LSACK est recu, suppression un LSP en question
threadRemoveLspSent = function(lspSequence, source){
	database.removeLspSent(lspSequence, source);		
}

// Envoi message UDP
sendUdpMessage = function(newMessage, HOST, PORT){
	var client = dgram.createSocket('udp4');
	client.send(newMessage, 0, newMessage.length, PORT, HOST, function(err, bytes) {
		if (err) throw err;
		console.log('Message UDP envoyé à: ' + HOST +':'+ PORT);
		client.close();
	});
}

// ENVOI toutes les HELLO_DELAY un paquet HELLO aux routeurs voisins
setInterval(function(){ 
	database.getRouterNeighbour(function(routers){
		var i = 0;
		while(i < routers.length){
			var PORT = routers[i].port;
			var HOST = routers[i].ip;
			sendUdpMessage('HELLO '+MY_ROUTER+' '+routers[i].number, HOST, PORT);
			++i;
		}
	});
}, HELLO_DELAY);

// Generation et envoi d'un paquet LSP à tous les voisins
setInterval(function(){ 
	generateLSP(function(lspMessage){
		database.getRouterNeighbour(function(routers){
			var i = 0;
			while(i < routers.length){
				var PORT = routers[i].port;
				var HOST = routers[i].ip;
				generateLSP();
				sendUdpMessage(lspMessage, HOST, PORT);
				++i;
			}
		});
	});	
}, MAX_LSP_DELAY);

//on va garder la date du dernier lsp envoyé et envoyer ceux > 5 secondes
//et puis update le temps envoyé
setInterval(function(lspSequence){ 
	database.getAllLspToResend(function(lspNoAck){
		var i = 0;
		console.log(lspNoAck);
		while(i < lspNoAck.length){	
			database.getRouter(lspNoAck[i].routerNumber, function(router){
				sendUdpMessage(newMessage, router.host, router.port);
				
			});
			++i;
		}
	});
}, 5000);
const graph = new Map()

generateLspGraph = function(){
	database.getAllLsp(function(lsps){
		console.log(lsps)
		var i = 0;

		while(i < lsps.length){
			var j = 1;
			var router1 = lsps[i].leftRouter;
			var router2 = lsps[i].rightRouter;
	
			while(j < lsps.length){
				if(lsps[i].leftRouter === lsps[j].rightRouter && lsps[i].rightRouter === lsps[j].leftRouter){
					database.addLspTwoWay(lsps[i].leftRouter, lsps[i].rightRouter, lsps[i].cost);
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
				database.getLspTwoWay(number, function(res){
					console.log(res);
					if(res.length > 0){
						console.log('la1')

						var j = 0;
						const a = new Map();
						while (j < res.length){
							console.log('la2')
							if(res[j].leftRouter === number){
								a.set(res[j].rightRouter, res[j].cost);
							}else{
								a.set(res[j].leftRouter, res[j].cost);
							}
							++j;
						}
						console.log('Map: '+number+' => '+a);
						graph.set(number, a);
					}
				})
				++i;
			}
			var numberOne = MY_ROUTER;
			database.getLspTwoWay(numberOne, function(res){
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
				console.log('Map: '+numberOne+' => '+b);
				const route = new Graph(graph)
				console.log(route.path('R1', 'R2'));
				database.removeLspTwoWay();
			});

		})
		
	})	
}
//database.removeLsp();
//database.removeLspTwoWay();
generateLspGraph();
/*database.addLsp('R1','R2', 1, 12);
database.addLsp('R2','R3', 1, 12);
database.addLsp('R2','R1', 1, 12);
database.addLsp('R3','R2', 1, 12);
database.addLsp('R3','R1', 9, 12);
database.addLsp('R1','R3', 9, 12);*/
//database.addLsp('R1','R3', 9, 12);
//database.addLsp('R3','R4', 9, 12);













