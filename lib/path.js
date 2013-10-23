function Path(config) {
    if(!config.name) throw "Path name is required";
    
    this.name = config.name || "";
    this.resource = config.resource || "";
    this.collection = config.hasOwnProperty("collection") ? config.collection : this.collection;
    this.methods = config.methods;
    this.paths = [];
    
    config.paths && config.paths.forEach(function(p) {
        this.addPath(p);
    }.bind(this));
}

Path.prototype = {
    name: "",
    resource: null,
    collection: false,
    paths: null,
    addPath: function(path) {
        if(this.paths[path.name]) {
            console.warn("A path in this context already exists with that name");
            return;
        }
        
        var p = new Path(path);
        p.parent = this;
        this.paths.push(p);
    },
    getResource: function() {
        // bubble up resource search if this path doesn't declare one
        return this.resource || this.parent && this.parent.getResource();
    },
    isCollection: function() {
        return this.collection;
    }
};

module.exports = Path;