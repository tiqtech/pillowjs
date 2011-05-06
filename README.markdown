Very simple template engine for node.js.  Can be used for HTML or pretty much anything else you might want.  Here's a quick sample:

```javascript
var s = require("simplate");
console.log(s.add("basic", "${template:header}\n<div>${name.first}</div>").add("header", "<!-- header -->").render("basic", {name:{first:"abc"}}));
```

Which would render:

```html
<!-- header -->
<div>abc</div>
```
