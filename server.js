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
	var res = message.toString().split(" ");
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

// Gestion des paquets DATA
dataPacket = function(res) {
	var source = res[0];	
	res.shift();
	var destination = res[0];
	res.shift();
	var msg = res.join(" ");
	console.log('Source :'+source);
	console.log('Destination :'+destination);
	console.log('Message :'+msg);

	//Lancer un thread ici
}











