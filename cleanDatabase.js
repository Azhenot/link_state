const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/linkState');
var moment = require('moment');

const Lsp = mongoose.model('Lsp', { leftRouter: String, rightRouter: String, cost: Number, lspSequence: Number });
const Router = mongoose.model('Router', { number: String, ip: String, port: String, neighbour: Number });
const LspSent =  mongoose.model('LspSent', {lspSequence: Number, routerNumber: String, date: Date});

createRouterNoNeighbour = function(routerNumber)  {
    Router.findOne({'number': routerNumber}, function (err, router) {
        if (err){
        }
        else if(router == null){
            const router = new Router({ number: routerNumber, neighbour: 0 });
            router.save();
        }
        else{	
        }
    });
    
},

handleCreateLsp = function(routerNumber, routerId, cost, lspSequence){
    Lsp.findOneAndUpdate({'leftRouter': routerNumber, 'rightRouter': routerId, 'lspSequence':{$lt: lspSequence}},
    { $set: { 'lspSequence': lspSequence,
        'cost': cost}},
            {new: true}, function(err, lsp) {     
                if (err){
                }else if(lsp == null){
                    Lsp.findOne({'leftRouter': routerNumber, 'rightRouter': routerId, 'lspSequence':{$gte: lspSequence}},
                                    function(err, lsp) {               
                                    if (err){
                                    }else if(lsp == null){
                                        const newLsp = new Lsp({ leftRouter: routerNumber, rightRouter: routerId, cost: cost, lspSequence: lspSequence });
                                        newLsp.save();
                                    }else{
                                    }
                    });	     
                }else{
                }
    });	
}

module.exports = {

    getRouter: function(routerNumber, callback) {
        Router.findOne({'number': routerNumber}, function(err, router){
            if (err){
            }
            else if(router == null){
            }
            else{	
                callback(router);
            }
        });
    },


    getRouterNeighbour: function(callback) {

        Router.find({'neighbour': 1}, function (err, routers) {
            if (err){
            }
            else{	
                callback(routers);
            }
        });
    },

    getRouters: function(callback) {

        Router.find({}, function (err, routers) {
            if (err){
            }
            else{	
                callback(routers);
            }
        });
    },

    createRouter: function(routerNumber, ip, port, neighbour)  {
        Router.findOne({'number': routerNumber}, function (err, router) {
            if (err){
            }
            else if(router == null){
                const router = new Router({ number: routerNumber, ip: ip, port: port, neighbour: neighbour });
                router.save();
            }
            else{	
            }
        });
        
    },

    createRouterNoNeighbour: createRouterNoNeighbour,

    addLspPacket: function(routerNumber, lspSequence, res, callback) {
        Router.findOne({'number': routerNumber}, function (err, router) {
            if (err){
            }
            else{	
                if(router == null){
                    this.createRouterNoNeighbour(routerNumber);
                }
                while(res.length > 0){
                    var routerId = res[0];
                    this.createRouterNoNeighbour(routerId);
                    res.shift();
                    var cost = res[0];
                    res.shift();
                    this.handleCreateLsp(routerNumber, routerId, cost, lspSequence)
                }
                return callback();
            }
        });
    },

    addLspSent: function(lspSequence, routerNumber)  {
        LspSent.findOne({'lspSequence': lspSequence, 'routerNumber': routerNumber}, function (err, lsp) {
            if (err){
            }
            else if(lsp == null){
                var lspSent = new LspSent({ lspSequence: lspSequence, routerNumber: routerNumber, date: moment() });
                lspSent.save();
            }
            else{	
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
            }
            else{	
                callback(lspSent);
            }
        });
    },

    removeRouter: function(routerNumber)  {
        Router.findOne({'number': routerNumber}).remove().exec();
    },

    removeAllLsp: function(){
        Lsp.remove({}).exec();
    },

    removeLspSent: function(){
        LspSent.remove({}).exec();
    },

    getAllLspToResend : function(callback){
        LspSent.find(function (err, lsps) {
            if (err){
            }
            else{	
                var j = 0;
                var toSend = [];
                while(j < lsps.length){
                    if(moment().diff(lsps[j].date, 'seconds') > 5){
                        toSend.push(lsps[j]);
                        LspSent.findOne({'lspSequence': lsps[j].lspSequence, 'routerNumber': lsps[j].routerNumber}).remove().exec();
                    }
                    ++j;
                }
                callback(toSend);
            }
        });
    },

    getAllLsp: function(callback){
        Lsp.find(function (err, lsps) {
            if (err){
            }
            else{	
                callback(lsps);
            }
        });
    },

    addLsp(leftRouter, rightRouter, cost, lspSequence){
        const newLsp = new Lsp({ leftRouter: leftRouter, rightRouter: rightRouter, cost: cost, lspSequence: lspSequence });
        Lsp.findOne({'leftRouter': leftRouter, 'rightRouter': rightRouter, 'lspSequence': lspSequence}, function(err, lsp) {   
            if(lsp != null){
                if(lsp.cost == cost){
                }else{
                    lsp.remove();
                    newLsp.save();
                }
            }else{
                newLsp.save();
            }     
        });
    },

    removeRouters: function()  {
        Router.remove({}).exec();
    },
};