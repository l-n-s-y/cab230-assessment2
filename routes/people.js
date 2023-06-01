const express = require('express');
const router = express.Router();
//const jwt = require("jsonwebtoken");
const authorization = require("../middleware/authorization");

/* GET person page. */
router.get("/:id",authorization, (req, res) => {
	let person_id = req.params.id;

	let query_keys = Object.keys(req.query).toString();
	if (query_keys !== "") {
		res.status(400);
		res.json({error: true, message: `Invalid query parameters: ${query_keys}. Query parameters are not permitted.`});
		return;
	}

	let person_data = {};
	let role_data = [];
	
	req.db
		.from("names")
		.select("primaryName","birthYear","deathYear")
		.where("nconst","=",person_id)
		.then((rows) => {
			if (rows.length === 0) {
				res.status(404);
				res.json({error: true, message: "No record exists of a person with this ID"});
				person_data = [];
			}

			person_data = rows;
		})
		.catch((err) => {
			console.log(err);
			res.json({error: true, message: "Error in MySQL query"});
		});

	req.db
		.from("basics")
		.join("principals", function() {
			this.on("basics.tconst","=","principals.tconst")
		}, "left")
		.select("primaryTitle","basics.tconst","category","characters","imdbRating")
		.where("principals.nconst","=",person_id)
		.then((rows) => {
			role_data = rows.map((row) => {
				return {
				movieName: row.primaryTitle,
				movieId: row.tconst,
				category: row.category,
				characters: eval(row.characters) ? eval(row.characters) : [],
				imdbRating: parseFloat(row.imdbRating)
				}
			});

			let final_data = person_data.map((row) => {
				return {
					name: row.primaryName,
					birthYear: row.birthYear,
					deathYear: row.deathYear,
					roles: role_data
				};
			});

			res.status(200);
			res.send(final_data[0]);
		})
		.catch((err) => {
			console.log(err);
			res.json({error: true, message: "Error in MySQL query"});
		});
});

module.exports = router;
