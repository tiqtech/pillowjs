var Errors = require("./errors");
var Format = require("./format");
var Methods = require("./methods");

var Dispatcher = function(config) {
	var express = this.express = require('express');

    this.resources = config.resources || [];
    this.paths = config.paths || [];
    this.filters = [];

    this.server = new express();
    this.server.use(express.bodyParser());
	this.server.use(express.methodOverride());
	this.server.use(this.baseFilter.bind(this));

    this.paths.forEach(function(path) {
        this.buildRoute(path, null, 0);
    }.bind(this));
};

Dispatcher.prototype = {
    filter: function(fn) {
        this.filters.push(fn);
    },
    baseFilter: function(req, res, next){
        // create rt context on request
        req.pillow = {
            dispatcher: this
        };

        // strip optional trailing slash
        req.url = req.url.replace(/\/$/, "");

        next();
    },
    start: function(port) {
        this.server.listen(port);
    },
	setStaticPath: function(path) {
		this.server.use(this.express.static(path));
	},
    getResource: function(path) {
        var name = path.getResource();
        var resource;
        this.resources.forEach(function(r) {
            if(r.name === name) {
                resource = r;
            }
        });

        return resource;
    },
    buildRoute: function(path, parents, depth) {

        // if parent path isn't provided, set it up
        if (!parents) {
            parents = [""];
        }

        // make a copy of the path for this branch so we don't make change the geneology for subsequent siblings
        var uri = parents.slice(0, parents.length);

        // add this spec's path and bind its handlers
        uri.push(path.name);

    //     if (rs['import'] && rs.thing !== t.id) {
    //         var newThing = this.getThing(rs.thing);
    //         if (!!newThing) {
    //             // found it so override the current thing and spec with this one and continue
    //             t = newThing;

				// var _rs = t.spec.clone();
				// _rs.parent = rs.parent;
				// _rs.path = rs.path;
    //             rs = _rs;
    //         }
    //         else {
    //             // should probably be an error ...
    //             console.log("Unable to locate", rs.thing);
    //         }
    //     }

		this.bindMethods(uri, path, true);

        // if this spec is a collection, build its item path and handlers
        if (path.isCollection()) {
            uri.push(":"+depth);
            this.bindMethods(uri, path, false);
        }

        // do the same for each child of this spec
        path.paths.forEach(function(p) {
            this.buildRoute(p, uri, depth+1);
        }.bind(this));
    },
    bindMethods: function(uriParts, path, collection){
        var uri = uriParts.join("/");
        var methods = this.getSupportedMethods(path);
        var verbMap = {
            "GET": "get",
            "PUT": "put",
            "POST": "post",
            "DELETE": "del"
        };

		// filters are bound to a unique object representing this path
        var filters = this.bindFilters({
            path: path,
            collection: collection,
            dispatcher: this
        });

        var resource = this.getResource(path);
        methods.forEach(function(method) {
            var f = resource.supports(method);

            // if the handler exists and both the method and this binding
            // is for a collection (or both not for a collection)
            if (!!f && method.collection === collection) {
                console.log("binding", method.verb, "for", uri);

                // append handler and prepend path to arguments
                filters.push(this.wrap(f));
                filters.unshift(uri);

                this.server[verbMap[method.verb]].apply(this.server, filters);
            }
        }.bind(this));
    },
    getSupportedMethods: function(path) {
        // if given the supported methods, use those
        var methods = path.methods;

        // if not, check the resource for supported methods
        if(!methods) {
            var resource = this.getResource(path);

            methods = [];
            Methods.All.forEach(function(m) {
                if(resource.supports(m)) {
                    methods.push(m);
                }
            });
        }

        // note we're assuming that path.methods only includes methods supported
        // by the resource. we're not checking that here but will be caught in
        // the path binding logic
        return methods;
    },
    bindFilters: function(binder) {
        var f = [];

        // context filter is required add it first
        f.push(contextFilter.bind(binder));
        
        for(var i=0, l=this.filters.length; i<l; i++) {
            f.push(this.filters[i].bind(binder));
        }

        return f;
    },
    wrap: function(handler){
        return function(req, res){
            try {
                handler(req.pillow);
            } catch (e) {
                req.pillow.onError(Errors.ServerError(e));
            }
        };
    },
    onComplete: function(req, res, o){
        try {
            var url = require("url").parse(req.url, true);
			var p = req.pillow;
			var d = p.dispatcher;
			var r = this.getResource(p.path);

            if (o instanceof Object) {
                if (o.constructor === Array) {
                    for (var i = 0; i < o.length; i++) {
                        var id = r.identify(o[i]);
                        o[i]["$links"] = d.buildLinks(p.path, url.pathname + "/" + id, o[i]);
                    }
                } else {
                    o["$links"] = d.buildLinks(p.path, url.pathname, o);
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
            this.onError(req, res, e);
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
    buildLinks: function(path, url, obj){
        var links = {
            self: url
        };

        var u = url + "/";
        path.paths.forEach(function(p) {
            var childUrl = u + p.name;

            // if child spec has a remap and the object has a member that
            // matches the spec path, remap the url to the root path
            // if (!!s.mapTo && !!obj[s.path]) {
            //     var t = this.getThing(s.mapTo);
            //     if (!!t && !!t.spec.path) {
            //         childUrl = "/" + t.spec.path + "/" + obj[s.path];
            //     }
            // }

            links[p.name] = childUrl;
        });

        return links;
    },
    validateId: function(path, id) {
        var resource = this.getResource(path);

        if(new RegExp(resource.idFormat).test(id)) {
            try {
                return resource.idFormat === Format.Numeric ? parseInt(id, 10) : id;
            } catch (e) {
                throw Errors.ServerError(e);
            }
        } else {
            throw Errors.NotFound();
        }        
    }
};

// this will be bound to the "binder" object at request time
var contextFilter = function(req, res, next) {

    try {
        var p = req.pillow;
        p.id = (this.collection) ? null : this.dispatcher.validateId(this.path, req.params.pop());
        p.path = this.path;

        if (req.body) {
    		// remove links before passing on to handler
    		if (req.body["$links"]) {
    			delete req.body["$links"];
    		}

            p.body = req.body;
        }

        // bind callbacks
        p.onComplete = this.dispatcher.onComplete.bind(this.dispatcher, req, res);
        p.onError = this.dispatcher.onError.bind(this.dispatcher, req, res);
    	p.redirect = this.dispatcher.redirect.bind(this.dispatcher, req, res);

        var path = this.path.parent;
        var ancestors = [];

        while (!!path) {
            var pid = path.isCollection() ? this.dispatcher.validateId(path, req.params.pop()) : undefined;

            ancestors.push({
                resource: this.dispatcher.getResource(path),
                id: pid
            });

            path = path.parent;
        }

        p.ancestors = ancestors;

        next();
    } catch(e) {
        this.dispatcher.onError(req, res, e);
    }
};

module.exports = Dispatcher;
