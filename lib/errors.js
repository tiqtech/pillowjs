module.exports = {
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
		};
	}
};