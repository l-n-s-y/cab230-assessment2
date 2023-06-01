const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
	/*if (!("authorization" in req.headers)
		|| !req.headers.authorization.match(/^Bearer /)
	) {
		res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
		return;
	}*/

	const auth_header = req.headers.authorization || "";
	//const token = req.headers.authorization.replace(/^Bearer /, "");
	const token = auth_header.replace(/^Bearer /, "");
	let token_data = {};
	try {
		token_data = jwt.verify(token, process.env.JWT_SECRET);
		if (Date.now()/1000 > token_data.b_exp) {
			throw {error:true,name:"TokenExpiredError"};
		}
	} catch (e) {
		console.log(e.message);
		if (e.name === "TokenExpiredError") {
			res.status(401).json({ error: true, message: "JWT token has expired" });
			return;
		} else if (e.message !== "jwt must be provided") {
			res.status(401).json({ error: true, message: "Invalid JWT token" });
			return;
		}
	}

	res.locals.token_data = token_data;
	next();
};
