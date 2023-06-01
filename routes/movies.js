const express = require("express");
const router = express.Router();

router.get("/search",function(req,res,next) {
	const RESULTS_LIMIT = 100;

	let title = req.query.title ? req.query.title : "";
	let year = req.query.year ? req.query.year : "";
	let page = req.query.page ? parseInt(req.query.page) : 1;

	if (!page) {
		res.status(400);
		res.json({error: true, message: "Invalid page format. page must be a number."});
		return;
	}

	// Validate year parameter if present.
	if ((year > 999 && year < 10000) === false && year !== "") {
		res.status(400);
		res.json({error: true, message: "Invalid year format. Format must be yyyy."});
		return;
	}

	req.db
		.from("basics")
		.select("primaryTitle","year","tconst","imdbRating","rottentomatoesRating","metacriticRating","rated")
		.where("primaryTitle","LIKE","%"+title+"%")
		.where("year","LIKE","%"+year+"%")
		.then((rows) => {
			// Page selection
			endRow = (page*RESULTS_LIMIT);
			if (page*RESULTS_LIMIT > rows.length) {
				endRow = rows.length;
			}

			startRow = (page-1)*RESULTS_LIMIT;
			
			if (page > 1) {
				row_array = rows.slice(startRow,endRow);
			} else {
				row_array = rows.slice(0,RESULTS_LIMIT);
			}

			row_data = row_array.map((row) => {
				return {
					"title": row.primaryTitle,
					"year": row.year,
					"imdbID": row.tconst,
					"imdbRating": parseFloat(row.imdbRating),
					"rottenTomatoesRating": parseInt(row.rottentomatoesRating),
					"metacriticRating": parseInt(row.metacriticRating),
					"classification": row.rated
				}
			});

			//pageNum = page ? page : 1;
			lastPage = Math.ceil(rows.length/RESULTS_LIMIT);

			prevPage = (page > 1) ? page - 1 : null;
			nextPage = (page < lastPage) ? page + 1 : null;

			pagination_data = {
				total: rows.length,
				lastPage: lastPage,
				prevPage: prevPage,
				nextPage: nextPage,
				perPage: RESULTS_LIMIT,
				currentPage: page,
				from: startRow,
				to: startRow + row_array.length
			};

			res.status(200);
			res.json({data: row_data, pagination: pagination_data});
		})
		.catch((err) => {
			console.log(err);
			res.json({error: true, message: "Error in MySQL query"});
		});
});

router.get("/data/:imdbID",function(req,res,next) {
	let imdbID = req.params.imdbID;
	/*if (imdbID === undefined) {		You must supply an imdbID! Error
		res.status(400);
		res.json({error: true, message: "You must supply an imdbID!"});
		return;
	}*/

	let query_keys = Object.keys(req.query).toString();
	if (query_keys !== "") {

		res.status(400);
		res.json({error: true, message: `Invalid query parameters: ${query_keys}. Query parameters are not permitted.`});
		return;
	}

	let movie_data = [];
	let principal_data = [];

	const format_principals = (data) => {
		return data.map((row) => {
			return {
				id: row.nconst,
				category: row.category,
				name: row.name,
				characters: eval(row.characters) ? eval(row.characters) : []
			};
		});
	};

	const format_ratings = (data) => {
		return [
			{
				"source":"Internet Movie Database",
				"value":parseFloat(data.imdbRating)
			},
			{
				"source":"Rotten Tomatoes",
				"value":parseInt(data.rottentomatoesRating)
			},
			{
				"source":"Metacritic",
				"value":parseInt(data.metacriticRating)
			}
		];
	};

	req.db
		.from("basics")
		.select("primaryTitle","year","runtimeMinutes","genres","country","imdbRating","rottentomatoesRating","metacriticRating","boxoffice","poster","plot")
		.where("tconst","=",imdbID)
		.then((rows) => {
			movie_data = rows[0];

			if (movie_data === undefined) {
				res.status(404);
				res.json({error: true, message: "No record exists of a movie with this ID"});
				return;
			}
			
			req.db
			.from("principals")
			.select("nconst","category","name","characters")
			.where("tconst","=",imdbID)
			.then((rows) => {
				principal_data = rows;

				/*let data = {
					title: movie_data.primaryTitle,
					year: movie_data.year,
					runtime: movie_data.runtimeMinutes,
					genres: movie_data.genres.split(","),
					country: movie_data.country,
					principals: format_principals(principal_data),
					ratings: format_ratings(movie_data),
					boxoffice: movie_data.boxoffice,
					poster: movie_data.poster,
					plot: movie_data.plot
				};*/

				res.status(200);
				res.json({
					title: movie_data.primaryTitle,
					year: movie_data.year,
					runtime: movie_data.runtimeMinutes,
					genres: movie_data.genres.split(","),
					country: movie_data.country,
					principals: format_principals(principal_data),
					ratings: format_ratings(movie_data),
					boxoffice: movie_data.boxoffice,
					poster: movie_data.poster,
					plot: movie_data.plot
				});
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

module.exports = router
