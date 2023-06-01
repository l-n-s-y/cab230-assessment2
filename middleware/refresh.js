const jwt = require("jsonwebtoken");

module.exports = function(req,res,next) {
	const token = req.body.refreshToken;
	let token_data = {};
	try {
		token_data = jwt.verify(token, process.env.JWT_SECRET);
		if (!token_data) {
			res.status(400);
			res.json({error: true, message: "Request body incomplete, refresh token required"});
			return;
		}
		if (!token_data.r_exp) {
			res.status(401);
			res.json({error: true, message: "Invalid JWT token"});
			return;
		}

		if (Date.now()/1000 > token_data.r_exp) {
			throw {error:true, name:"TokenExpiredError"};
		}
	} catch (e) {
		if (e.name === "TokenExpiredError") {
			res.status(401).json({error: true, message: "JWT token has expired"});
		} else if (e.message === "jwt malformed") {
			res.status(401).json({error: true, message: "Invalid JWT token" });
		} else if (e.message === "jwt must be provided") {
			res.status(400);
			res.json({error:true, message:"Request body incomplete, refresh token required"});
		}
		return;
	}

	res.locals.refresh_data = token_data;
	next();
};
