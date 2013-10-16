
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


var pillow = module.exports = {};

pillow.Methods = require("./methods");
pillow.Resource = require("./resource");
pillow.Path = require("./path");
pillow.Format = require("./format");
pillow.Errors = require("./errors");
pillow.Dispatcher = require("./dispatcher");