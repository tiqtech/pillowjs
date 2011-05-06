
// parent thing is always responsible for returning ids for any child thing,
//   even if it is a different type of thing
// if child thing specifies a mapTo thing then it gets an ref
//   link to base (/users/1/friends will have a set of links to /users/x)
// if a path doesn't specify a thing then it won't be automatically linked 
//   and its contents are the responsibility of the parent
// if a path is a collection, then the next part of the path must be the
//   id of a particular thing.  The type of id can be enforced with idFormat (Numeric, UUID, or Any [default])
// if a spec doesn't have a root path, it's not base addressable

// TODO
// - determine if spec that maps to a new thing (e.g list/owner -> /users/abc) should be callable and return the object (with a self ref to /users/abc), not callable because the link is to /users/abc, or both (or configurable ...)
// - thing expansion


RestfulThings = {};

RestfulThings.Methods = {
    Get: "GET",
    Post: "POST",
    Put: "PUT",
    Delete: "DELETE",
    All: ["GET", "POST", "PUT", "DELETE"]
}

RestfulThings.Thing = function(id, spec, handlers){
    this.id = id;
    this.spec = RestfulThings.ResSpec.parse(spec);
    this.handlers = {
        "get": (handlers && handlers.get) ? handlers.get.bind(this) : undefined,
        "post": (handlers && handlers.post) ? handlers.post.bind(this) : undefined,
        "put": (handlers && handlers.put) ? handlers.put.bind(this) : undefined,
        "del": (handlers && handlers.del) ? handlers.del.bind(this) : undefined
    }
}

RestfulThings.Thing.prototype = {
    isValid: function(id){
    },
    isAuthorized: function(action){
    }
}

RestfulThings.ResSpec = function(thingId, supports, isCollection){
    this.thing = thingId;
    this.path = null;
    this.methods = supports || RestfulThings.Methods.Get
    this.collection = isCollection || false;
    this.specs = [];
    this.parent = null;
    this.handlers = {};
    this.idFormat = RestfulThings.Format.Any;
    this.identifiedBy = "id";
}

RestfulThings.ResSpec.prototype = {
    isCollection: function(){
        return this.collection;
    },
    isSecured: function(){
        return true;
    },
    supports: function(method){
        if (!!this.methods) {
            for (var i = 0; i < this.methods.length; i++) {
                if (this.methods[i] === method) {
                    return true;
                }
            }
        }
        
        return false;
    },
    contains: function(path){
        return this.specs[path];
    }
}

RestfulThings.ResSpec.parse = function(o){
    var rs;
    
    try {
        rs = new RestfulThings.ResSpec();
        
        var copyTo = function(fromObj, toObj, fromKey, toKey){
            toKey = toKey || fromKey;
            if (!!fromObj[fromKey]) {
                toObj[toKey] = fromObj[fromKey];
            }
        }
        
        copyTo(o, rs, "thing");
        copyTo(o, rs, "methods", "supports");
        copyTo(o, rs, "collection");
        copyTo(o, rs, "idFormat");
        copyTo(o, rs, "path");
        copyTo(o, rs, "import");
        copyTo(o, rs, "mapTo");
        copyTo(o, rs, "identifiedBy");
                
        if (!!o.contains) {
            for (var index in o.contains) {
                var childSpec = RestfulThings.ResSpec.parse(o.contains[index]);
                if (!!childSpec) {
                    rs.specs[index] = childSpec;
                    rs.specs[index].parent = rs;
                }
            }
        }
    } 
    catch (e) {
        // log it ...
        throw e;
    }
    
    return rs;
}

RestfulThings.Dispatcher = function(){
	this.express = require('express');
    this.things = [];
    this.server = this.express.createServer(RestfulThings.Dispatcher.baseFilter.bind(this));
    this.server.use(this.express.bodyParser());
	this.server.use(this.express.methodOverride());
    
    if (arguments.length > 0) {
        this.things = arguments;
    }
    
    for (var i = 0; i < this.things.length; i++) {
        this.buildRoute(this.things[i], this.things[i].spec);
    }
}

RestfulThings.Dispatcher.prototype = {
    start: function(port){
        this.server.listen(port);
    },
	setStaticPath:function(path) {
		this.server.use(this.express.static(path));
	},
    getThing: function(id){
        for (var i = 0; i < this.things.length; i++) {
            if (this.things[i].id === id) {
                return this.things[i];
            }
        }
        
        return undefined;
    },
    buildRoute: function(t, rs, parents){
    
        // if any member doesn't have a path attribute, we can't build a route for it
        if (!rs.path) 
            return;
        
        // if parent path isn't provided, set it up
        if (!parents) {
            parents = ["^"];
        }
        
        // make a copy of the path for this branch so we don't make change the geneology for subsequent siblings
        var path = parents.slice(0, parents.length);
        
        // add this spec's path and bind its handlers
        path.push(rs.path);
        
        if (rs['import'] && rs.thing !== t.id) {
            var newThing = this.getThing(rs.thing);
            if (!!newThing) {
                // found it so override the current thing and spec with this one and continue
                t = newThing;
				
				// TODO: should probably clone the spec so it can be imported multiple times
				newThing.spec.parent = rs.parent;
				newThing.spec.path = rs.path;
                rs = newThing.spec;
            }
            else {
                // should probably be an error ...
                console.log("Unable to locate", rs.thing);
            }
        }
		
		this.bindMethods(new RegExp(path.join("/") + "/?$", "i"), rs, t, false);
        
        // if this spec is a collection, build its item path and handlers
        if (rs.isCollection()) {
            path.push(rs.idFormat);
            this.bindMethods(new RegExp(path.join("/") + "/?$", "i"), rs, t, true);
        }
        
        // do the same for each child of this spec
        for (var k in rs.specs) {
            this.buildRoute(t, rs.specs[k], path);
        }
    },
    bindMethods: function(path, spec, thing, isItem){
        var methods = ["get", "put", "post", "del"];
		
        var binder = {
            spec: spec,
            isItem: isItem,
            thing: thing,
            dispatcher: this
        };
        var context = RestfulThings.Dispatcher.contextFilter.bind(binder);
        var auth = RestfulThings.Dispatcher.authorizationFilter.bind(binder);
        
        for (var i = 0; i < methods.length; i++) {
            var method = methods[i];
            var f = thing.handlers[method];
            
            if (!!f) {
                console.log("binding", method, "for", path);
                this.server[method](path, context, auth, this.wrap(f));
            }
        }
    },
    wrap: function(handler){
        return function(req, res){
            try {
                handler(req.rt);
            } 
            catch (e) {
                req.rt.onError(RestfulThings.Errors.ServerError(e));
            }
        };
    },
    onComplete: function(req, res, o){
        try {
            var url = require("url").parse(req.url, true);
			
            if (o instanceof Object) {
                if (o.constructor === Array) {
                    for (var i = 0; i < o.length; i++) {
                        o[i].links = req.rt.dispatcher.buildLinks(req.rt.spec, url.pathname + "/" + o[i][req.rt.spec.identifiedBy], o[i])
                    }
                }
                else {
                    o.links = req.rt.dispatcher.buildLinks(req.rt.spec, url.pathname, o);
                }
				
				// this is rather bizarre but you have specify a file extension
				// and it determines the content type rather than just setting
				// application/json
				res.contentType(".json");
	            res.send(JSON.stringify(o));
            } else {
				res.send();
			}
        } 
        catch (e) {
            this.onError(req, res, e)
        }
    },
    onError: function(req, res, err){
		if(err.message && err.status) {
			var body = err.message;
			if(err.detail) {
				body += "\n" + JSON.stringify(err.detail);
			}
			
			res.send(body,err.status);			
		} else {
			res.send(err, 500);
		}        
    },
	redirect: function(req, res, id) {
		var path =  require('url').parse(req.url).pathname;
		if(id) {
			path += "/" + id;
		}
		
		res.redirect(path);
	},
    buildLinks: function(spec, url, obj){
    
        // if spec specifies a remap, build a new self url and override spec to referenced thing
        if (!!spec.mapTo) {
            var t = this.getThing(spec.mapTo);
            if (!!t && !!t.spec.path) {
                url = ["", t.spec.path, obj[spec.identifiedBy]].join("/");
                spec = t.spec;
            }
        }
        
        var links = {
            self: url
        }
        
        var u = url + "/";
        for (var i = 0; i < spec.specs.length; i++) {
            var s = spec.specs[i];
            var childUrl = u + s.path;
            
            // if child spec has a remap and the object has a member that
            // matches the spec path, remap the url to the root path
            if (!!s.mapTo && !!obj[s.path]) {
                var t = this.getThing(s.mapTo);
                if (!!t && !!t.spec.path) {
                    childUrl = "/" + t.spec.path + "/" + obj[s.path];
                }
            }
            
            links[s.path] = childUrl;
        }
        
        return links;
    }
}


RestfulThings.Dispatcher.baseFilter = function(req, res, next){
    // create rt context on request
    req.rt = {
        dispatcher: this
    };
    
    // strip optional trailing slash
    req.url = req.url.replace(/\/$/, "");
    
    next();
};

RestfulThings.Dispatcher.contextFilter = function(req, res, next){
    var formatId = function(spec, id){
        try {
            if (spec.idFormat === RestfulThings.Format.Numeric) {
                return parseInt(id);
            }
            else {
                return id;
            }
        } 
        catch (e) {
            throw RestfulThings.Error.ServerError(e);
        }
    };
    
    req.rt.id = (this.isItem) ? formatId(this.spec, req.params.pop()) : undefined;
    req.rt.spec = this.spec;
	
    if (req.body) {
		// remove links before passing on to handler
		if (req.body.links) {
			delete req.body.links;
		}
		
        req.rt.body = req.body;
    }
    
    // bind callbacks
    req.rt.onComplete = this.dispatcher.onComplete.bind(this.dispatcher, req, res);
    req.rt.onError = this.dispatcher.onError.bind(this.dispatcher, req, res);
	req.rt.redirect = this.dispatcher.redirect.bind(this.dispatcher, req, res);
    
    var p = this.spec.parent;
    var ancestors = [];
    
    while (!!p) {
        var pid = p.isCollection() ? formatId(p, req.params.pop()) : undefined;
        
        ancestors.push({
            spec: p,
            id: pid
        });
        
        p = p.parent;
    }
    
    req.rt.ancestors = ancestors;
    
    next();
};

RestfulThings.Dispatcher.authorizationFilter = function(req, res, next){
//    for (var i = 0; i < req.rt.ancestors.length; i++) {
//        var a = req.rt.ancestors[i];
//        if (a.spec.isSecured()) {
//
//        }
//    }
    
    next();
};

RestfulThings.Errors = {
    NotFound: function(message){
        return {
            status: 404,
            message: message || "Not Found"
        };
    },
    ServerError: function(err){
		var message = err.message || err;
		var detail = (err.detail) ? JSON.stringify(err.detail) : undefined;
        return {
            status: 500,
            message: message || "Server Error",
			detail: detail
        };
    },
	Unauthorized: function(message) {
		return {
			status:403,
			message: message || "Unauthorized"
		}
	}
};

RestfulThings.Format = {
    Numeric: "([0-9]+)",
    Any: "([^/]+)",
    UUID: "([a-f0-9]{32})"
};
