var Methods = {
    Get: {verb: "GET", collection: false},
    Post: {verb: "POST", collection: true},
    Put: {verb: "PUT", collection: false},
    Delete: {verb: "DELETE", collection: false},
    Find: {verb: "GET", collection: true},
    DeleteAll: {verb: "DELETE", collection: true}
};

Methods.All = [Methods.Get, Methods.Post, Methods.Put, Methods.Delete, Methods.Find, Methods.DeleteAll];

module.exports = Methods;