const express = require('express');
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authorization = require("../middleware/authorization");
const profile_authorization = require("../middleware/profile_authorization");
const refresh = require("../middleware/refresh");

/* POST user listing. */
router.post('/register', function(req, res, next) {
	let email = req.body.email;
	let password = req.body.password;

	if (!email || !password) {
		res.status(400);
		res.json({error:true, message:"Request body incomplete, both email and password are required"});
		return;
	}

	req.db("users")
		.select("*")
		.where("email","=",email)
		.then((rows) => {
			if (rows.length > 0) {
				res.status(409);
				res.json({error: true, message: "User already exists"});
				return;
			}

			const salt_rounds = 10;
			const hash = bcrypt.hashSync(password, salt_rounds);
			return req.db("users").insert({email,hash});
		})
		.then(() => {
			res.status(201);
			res.json({message: "User created"});
		})
		.catch((err) => {
			console.log(err);
			res.json({error: true, message: "Error in MySQL query"});
		});
});

router.post('/login', function(req, res, next) {
	let email = req.body.email;
	let password = req.body.password;
	let long_expiry = req.body.longExpiry;

	let bearer_exp_in = parseInt(req.body.bearerExpiresInSeconds);
	let refresh_exp_in = parseInt(req.body.refreshExpiresInSeconds);

	if (!email || !password) {
		res.status(400);
		res.json({error:true,message:"Request body incomplete, both email and password are required"});
		return;
	}

	req.db("users")
		.select("*")
		.where("email","=",email)
		.then((rows) => {
			if (rows.length === 0) {
				return false;
			}

			return bcrypt.compare(password,rows[0].hash).then((match) => match);
		})
		.then((match) => {
			if (!match) {
				res.status(401);
				res.json({error:true,message: "Incorrect email or password"});
				return;
			}

			const b_expires_in = bearer_exp_in ? bearer_exp_in : 60*10; // DEFAULT: 10 minutes
			const b_exp = Math.floor(Date.now() / 1000) + b_expires_in;
			const b_token = jwt.sign({email,b_exp}, process.env.JWT_SECRET);

			const r_expires_in = refresh_exp_in ? refresh_exp_in : 60*60*24; // DEFAULT: 24 hours
			const r_exp = Math.floor(Date.now() / 1000) + r_expires_in;
			const r_token = jwt.sign({email,r_exp}, process.env.JWT_SECRET);

			// Store refresh token
			req.db("users")
				.where("email","=",email)
				.update({
					refreshToken: r_token
				})
				.then(() => req.db("users").where("email","=",email))
				.catch((err) => {
					console.log(err);
					res.json({error: true, message: "Error in MySQL query"});
				});

			res.status(200);
			res.json({
				"bearerToken": {
					"token": b_token,
					"token_type": "Bearer",
					"expires_in": b_expires_in
				},
				"refreshToken": {
					"token": r_token,
					"token_type": "Refresh",
					"expires_in": r_expires_in
				}
			});
		})
		.catch((err) => {
			console.log(err);
			res.json({error:true,message:"Error in MySQL query"});
		});
});

router.post("/refresh", refresh, (req, res) => {

	let token_data = res.locals.refresh_data;

	let email = token_data.email;
	const b_expires_in = 60*10; // DEFAULT: 10 minutes
	const b_exp = Math.floor(Date.now() / 1000) + b_expires_in;
	const b_token = jwt.sign({email,b_exp}, process.env.JWT_SECRET);

	const r_expires_in = 60*60*24; // DEFAULT: 24 hours
	const r_exp = Math.floor(Date.now() / 1000) + r_expires_in;
	const r_token = jwt.sign({email,r_exp}, process.env.JWT_SECRET);

	// Store refresh token
	req.db("users")
		.where("email","=",token_data.email)
		.update({
			refreshToken: r_token
		})
		.then(() => req.db("users").where("email","=",token_data.email))
		.catch((err) => {
			console.log(err);
			res.json({error:true, message: "Error in MySQL query"});
		});

	res.status(200);
	res.json({
		"bearerToken": {
			"token": b_token,
			"token_type": "Bearer",
			"expires_in": b_expires_in
		},
		"refreshToken": {
			"token": r_token,
			"token_type": "Refresh",
			"expires_in": r_expires_in
		}
	});


});

router.post("/logout", refresh, (req, res) => {
	let token_data = res.locals.refresh_data;

	// Remove token from DB
	req.db("users")
		.where("email","=",token_data.email)
		.update({
			refreshToken: null
		})
		.then(() => req.db("users").where("email","=",token_data.email))
		.catch((err) => {
			console.log(err);
			res.json({error:true,message:"Error in MySQL query"});
			return;
		});

	res.status(200);
	res.json({error: false, message: "Token successfully invalidated"});
});


//router.get('/:email/profile', function(req, res, next) {
router.get('/:email/profile', profile_authorization, (req,res) => {
	let email = req.params.email;

	req.db("users")
		.select("firstName","lastName","dob","address")
		.where("email","=",email)
		.then((rows) => {
			let user_data = rows[0];

			// User not found
			if (!user_data) {
				res.status(404);
				res.json({error: true, message: "User not found"});
				return;
			}

			let token_data = res.locals.token_data;
			if (token_data.email !== email) {
				res.status(200);
				res.json({
					email: email,
					firstName: user_data.firstName,
					lastName: user_data.lastName
				});
				return;
			}

			res.status(200);
			res.json({
				email: email,
				firstName: user_data.firstName,
				lastName: user_data.lastName,
				dob: user_data.dob,
				address: user_data.address
			});
		})
		.catch((err) => {
			console.log(err);
			res.json({error: true, message: "Error in MySQL query"});
		});

	
});

//router.put('/:email/profile', function(req, res, next) {
router.put('/:email/profile', authorization, (req, res) => {
	let email = req.params.email;
	//let b_token = req.get("Authorization");
	let update_data = req.body;

	const user_check = req.db("users").select("*").where("email","=",email);
	if (!user_check.then((rows) => {
		if (rows.length === 0) {
			return false;
		}

		return true;
	})) {
		res.status(404);
		res.json({error: true, message: "User not found"});
		return;
	}

	let token_data = res.locals.token_data;

	// Compare profile and token emails
	if (token_data.email !== email) {
		res.status(403);
		res.json({error: true, message: "Forbidden"});
		return;
	}

	// Check for required input data
	if (!update_data.firstName || !update_data.lastName || !update_data.dob || !update_data.address) {
		res.status(400);
		res.json({
			error: true, 
			message: "Request body incomplete: firstName, lastName, dob and address are required."
		});
		return;
	}

	// Check all input data is strings
	let invalid_param = false;
	for (let field in update_data) {
		if (typeof(update_data[field]) !== "string") {
			invalid_param = true;
		}
	}

	if (invalid_param) {
		res.status(400);
		res.json({
			error: true, 
			message: "Request body invalid: firstName, lastName, dob and address must be strings only."
		});
		return;
	}


	// Validate DOB format (YYYY-MM-DD
	const re = /(?:[1-9]\d{3}\-(?:(?:0[1-9]|1[0-2])\-(?:0[1-9]|1\d|2[0-8])|(?:0[13-9]|1[0-2])\-(?:29|30)|(?:0[13578]|1[02])\-31)|(?:[1-9]\d(?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)\-02\-29)/g;

	let re_result = re.exec(update_data.dob);
	if (!re_result || re_result[0] !== re_result.input) {
		//res.status(400);
		res.status(400);
		res.json({
			error: true,
			message: "Invalid input: dob must be a real date in format YYYY-MM-DD."
		});
		return;
	}

	// Check DOB is past date
	let dob_raw = re_result[0];
	let dob_ymd = dob_raw.split("-").map((a) => parseInt(a));
	let dob = new Date(dob_ymd[0],dob_ymd[1]-1,dob_ymd[2]);
	if (dob > Date.now()) {
		res.status(400);
		res.json({error: true, message: "Invalid input: dob must be a date in the past."});
		return;
	}

	


	// TODO: Update 'users' table and reselect updated columns
	req.db("users")
		.where("email","=",email)
		.update({
			firstName: update_data.firstName,
			lastName: update_data.lastName,
			dob: update_data.dob,
			address: update_data.address
		})
		.then(() => {
			// Return updated content
			req.db("users")
				.select("email","firstName","lastName","dob","address")
				.where("email","=",email)
				.then((rows) => {
					let user_data = rows[0];
					res.status(200);
					res.json({
						email: user_data.email,
						firstName: user_data.firstName,
						lastName: user_data.lastName,
						dob: user_data.dob,
						address: user_data.address
					});
					return;
				})
				.catch((err) => {
					console.log(err);
					res.json({error: true, message: "Error in MySQL query"});
				});
				
		})
		.catch((err) => {
			console.log(err);
			res.json({error: true, message: "Error in MySQL query"});
		});
});

module.exports = router;
