const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const swaggerUI = require("swagger-ui-express");
const fs = require("fs");
const https = require("https");
const helmet = require("helmet");
const cors = require("cors");

require('dotenv').config();

const options = require("./knexfile.js");
const knex = require("knex")(options);

const swaggerDoc = require("./docs/openapi.json");

const moviesRouter = require('./routes/movies');
const userRouter = require('./routes/user');
const peopleRouter = require('./routes/people');

const private_key = fs.readFileSync('sslcert/server.key', 'utf8');
const certificate = fs.readFileSync('sslcert/server.crt', 'utf8');

const credentials = {key: private_key, cert: certificate};
const app = express();

// Enable security middlewares
app.use(helmet());

// Setup HTTPS
const server = https.createServer(credentials,app);
server.listen(3000); // Listen on 3000

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use((req, res, next) => {
	req.db = knex;
	next();
});

// Swagger API Documentation
app.use("/", swaggerUI.serve);
app.get("/", swaggerUI.setup(swaggerDoc));

app.use('/movies',moviesRouter);
app.use('/people',peopleRouter);
app.use('/user',userRouter);
/*app.use("/knex", function (req, res, next) {
	req.db.raw("SELECT VERSION()")
	.then((version) => console.log(version[0][0]))
	.catch((err) => {
		console.log(err);
		throw err;
	});
	res.send("Version Logged successfully");
});*/

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	res.status(404).json({status:"error",message:"Page not found!"});
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	//res.render('error');
	res.json({error: true, message: err.message});
});

module.exports = app;
