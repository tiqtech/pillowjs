var Format = require("./format");

/*
	// GET on item
	get: function() {},

	// PUT on item
	put: function() {},

	// POST on collection
	post: function() {},

	// DELETE on item	
	del: function() {},

	// DELETE on collection
	delAll: function() {}

	// GET on collection
	find: function() {}
*/

function Resource(config) {
    this.name = config.name || "";
	this.idFormat = config.idFormat || Format.Any;
	
	var ctx = config.context || this;
	this.handlers = {};
    for(var h in config.handlers) {
        this.handlers[h] = config.handlers[h].bind(ctx);
    }
}

Resource.prototype = {
	// return a string identifier for the given object
	identify: function(object) {},
	handle: function(method, id, body, query, callback) {
        var handler = this.getHandler(method, id);

        if(handler && this.handlers[handler]) {
            this.handlers[handler]({
                id: id,
                body: body,
                query: query
            }, callback);
        } else {
            throw "Not Supported";
        }
	},
	supports: function(method) {
	    return this.handlers[this.getHandler(method.verb, !method.collection)];
	},
	// override point for retrieving handler method name
	getHandler: function(method, id) {
	    return  method === "GET" && id && "get" ||
                method === "GET" && "find" ||
                method === "POST" && !id && "post" ||
                method === "DELETE" && id && "del" ||
                method === "DELETE" && "delAll" ||
                method === "PUT" && id && "put" ||
                null;   // operation not supported
	}
};

module.exports = Resource;