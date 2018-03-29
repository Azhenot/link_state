const myRouter = 'R1';
const splitMessage = ' ';
var PORT = 33333;
var HOST = '127.0.0.1';

var dgram = require('dgram');
var server = dgram.createSocket('udp4');

var services = require('./services');

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
}

// Gestion des paquets LSP
lspPacket = function(res) {
}

// Gestion des paquets LSACK
lsackPacket = function(res) {
}
const spawn = require('threads').spawn;
// Gestion des paquets DATA
dataPacket = function(res) {
	var source = res[0];	
	res.shift();
	var destination = res[0];
	res.shift();
	var msg = res.join(" ");

	

	if(destination != myRouter){
		//transferMessage(source,destination,msg);

	}else{
		console.log('MESSAGE RECEIVED:')
		console.log('Source :'+source);
		console.log('Destination :'+destination);
		console.log('Message :'+msg);
	}
}

// Creation d'un thread pour transférer un message
threadTransferMessage = function(res) {

	const thread = spawn(function([source , destination, msg]) {
		console.log('ici');
		console.log('Source :'+source);
		console.log('Destination :'+destination);
		console.log('Message :'+msg);

		// RECEPTION DES COORDONNEES DU ROUTEUR DESTINATION
		// ACCES BD
		var PORT = 33333;
		var HOST = '127.0.0.1';
		//////////////////////////////////////////////////////

		var newMessage = new Buffer('DATA '+source+' '+' '+destination+' '+msg);

		var client = dgram.createSocket('udp4');
		client.send(newMessage, 0, newMessage.length, PORT, HOST, function(err, bytes) {
				if (err) throw err;
				console.log('Message UDP transféré à: ' + HOST +':'+ PORT);
				client.close();
			});
		});		
		thread.send([source, destination, msg])
		.on('error', function(error) {
			console.error('Worker errored:', error);
		})
		.on('exit', function() {
			console.log('Worker has been terminated.');
		});
}











