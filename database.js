const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/linkState');
var moment = require('moment');

const Lsp = mongoose.model('Lsp', { leftRouter: String, rightRouter: String, cost: Number, lspSequence: Number });
const Router = mongoose.model('Router', { number: String, ip: String, port: String, neighbour: Number });
const LspSent =  mongoose.model('LspSent', {lspSequence: Number, routerNumber: String, date: Date});

module.exports = {

    getRouter: function(routerNumber, callback) {
        Router.findOne({'number': routerNumber}, function(err, router){
            if (err){
                console.log("erreur get router");
            }
            else if(router == null){
                console.log("Routeur n'existe pas");
            }
            else{	
                console.log('got router');
                callback(router);
            }
        });
    },


    getRouterNeighbour: function(callback) {

        Router.find({'neighbour': 1}, function (err, routers) {
            if (err){
                console.log("erreur get router");
            }
            else{	
                callback(routers);
            }
        });
    },

    getRouters: function(callback) {

        Router.find({}, function (err, routers) {
            if (err){
                console.log("erreur get router");
            }
            else{	
                callback(routers);
            }
        });
    },

    createRouter: function(routerNumber, ip, port, neighbour)  {
        Router.findOne({'number': routerNumber}, function (err, router) {
            if (err){
                console.log("erreur create router");
            }
            else if(router == null){
                const router = new Router({ number: routerNumber, ip: ip, port: port, neighbour: neighbour });
                router.save().then(() => console.log('doneSaving Router'));
            }
            else{	
                console.log("Routeur existe déjà");
            }
        });
        
    },

    addLspPacket: function(routerNumber, lspSequence, res) {
        Router.findOne({'number': routerNumber}, function (err, router) {
            if (err){
                console.log("erreur");
            }
            else if(router == null){
                // Creation du routeur?
                console.log("Routeur n'existe pas");
            }
            else{	
                while(res.length > 0){
                    var routerId = res[0];
                    res.shift();
                    var cost = res[0];
                    res.shift();
                    Lsp.findOneAndUpdate({'leftRouter': routerNumber, 'rightRouter': routerId, 'lspSequence':{$lt: lspSequence}},
                        { $set: { 'lspSequence': lspSequence,
                            'cost': cost}},
                                {new: true}, function(err, lsp) {               
                                    if (err){
                                        console.log('erreur update lsp')
                                    }else if(lsp == null){
                                        Lsp.findOne({'leftRouter': routerNumber, 'rightRouter': routerId, 'lspSequence':{$gte: lspSequence}},
                                                        function(err, lsp) {               
                                                        if (err){
                                                            console.log('erreur update lsp')
                                                        }else if(lsp == null){
                                                            const newLsp = new Lsp({ leftRouter: routerNumber, rightRouter: routerId, cost: cost, lspSequence: lspSequence });
                                                            newLsp.save().then(() => console.log('done Saving Lsp'));
                                                        }else{
                                                            console.log('lsp identique ou plus récent déjà ajouté');
                                                        }
                                        });	     
                                    }else{
                                        console.log('LSP mis à jour')
                                    }
                    });	
                }
            }
        });
    },

    addLsp(leftRouter, rightRouter, cost, lspSequence){
        const newLsp = new Lsp({ leftRouter: leftRouter, rightRouter: rightRouter, cost: cost, lspSequence: lspSequence });
        newLsp.save().then(() => console.log('done Saving Lsp'));
    },



    lspUpdateOrCreate(routerOne, routerTwo, lspSequence, cost)  {
        console.log(routerOne, RouterTwo, lspSequence, cost);
        Lsp.findOneAndUpdate({'leftRouter': routerOne, 'rightRouter': routerTwo, 'lspSequence':{$lt: lspSequence}},
            { $set: { 'lspSequence': lspSequence,
                'cost': cost}},
                    {new: true}, function(err, lsp) {               
                        if (err){
                            console.log('erreur update lsp')
                        }else if(lsp == null){
                            Lsp.findOne({'leftRouter': routerOne, 'rightRouter': routerTwo, 'lspSequence':{$gte: lspSequence}},
                                            function(err, lsp) {               
                                            if (err){
                                                console.log('erreur update lsp')
                                            }else if(lsp == null){
                                                const newLsp = new Lsp({ leftRouter: routerOne, rightRouter: routerTwo, cost: cost, lspSequence });
                                                newLsp.save().then(() => console.log('done Saving Lsp'));
                                            }else{
                                                console.log('lsp identique ou plus récent déjà ajouté');
                                            }
                            });	     
                        }else{
                            console.log('LSP mis à jour')
                        }
        });	         
    },

    addLspSent: function(lspSequence, routerNumber)  {
        LspSent.findOne({'lspSequence': lspSequence, 'routerNumber': routerNumber}, function (err, lsp) {
            if (err){
                console.log("erreur create lspSent");
            }
            else if(lsp == null){
                var lspSent = new LspSent({ lspSequence: lspSequence, routerNumber: routerNumber, date: moment() });
                lspSent.save().then(() => console.log('done Saving lspSent'));
            }
            else{	
                console.log("LspSent existe déjà");
            }
        });  
    },

    //Renvoi LSP si pas de retour dans 5 secondes, mais je dois supprimer l'ancien
    removeLspSent: function(lspSequence, routerNumber)  {
        LspSent.findOne({'lspSequence': lspSequence, 'routerNumber': routerNumber}).remove().exec();
    },

    getLspSent: function(lspSequence, callback) {

        LspSent.find({'lspSequence': lspSequence}, function (err, lspSent) {
            if (err){
                console.log("erreur get router");
            }
            else{	
                callback(lspSent);
            }
        });
    },

    removeRouter: function(routerNumber)  {
        Router.findOne({'number': routerNumber}).remove().exec();
    },

    removeLsp: function(){
        Lsp.remove({}).exec();
    },

    getAllLspToResend : function(callback){
        Lsp.find(function (err, lsps) {
            if (err){
                console.log("erreur get Lsp");
            }
            else{	
                var j = 0;
                var toSend = [];
                while(j < lsps.length){
                    if(moment().diff(lsps[j].date) > 5){
                        toSend.push(lsps[j]);
                    }
                }
                callback(toSend);
            }
        });
    },

    getAllLsp: function(callback){
        Lsp.find(function (err, lsps) {
            if (err){
                console.log("erreur get Lsp");
            }
            else{	
                callback(lsps);
            }
        });
    }
};