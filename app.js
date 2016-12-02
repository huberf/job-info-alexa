// Start up the server
var express = require('express');
var stringCheck = require('string-similarity');
var hamming = require('compute-hamming');
var alexa = require('alexa-app');
var verifier = require('alexa-verifier');
var bodyParser = require('body-parser');
var request = require('request');

var app = express();
var PORT = process.env.PORT || 8080;
app.use(function(req, res, next) {
  if (!req.headers.signaturecertchainurl) {
    return next();
  }

  // mark the request body as already having been parsed so it's ignored by
  // other body parser middlewares
  req._body = true;
  req.rawBody = '';
  req.on('data', (data) => {
    return req.rawBody += data;
  });
  req.on('end', () => {
    var cert_url, er, error, requestBody, signature;
    try {
      req.body = JSON.parse(req.rawBody);
    } catch (error) {
      er = error;
      req.body = {};
    }
    cert_url = req.headers.signaturecertchainurl;
    signature = req.headers.signature;
    requestBody = req.rawBody;
    verifier(cert_url, signature, requestBody, function(er) {
      if (er) {
        console.error('error validating the alexa cert:', er);
        res.status(401).json({ status: 'failure', reason: er });
      } else {
        next();
      }
    });
  });
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine','ejs');

var JOB_NAMES = require('./jobNames.json');

var getCareer = (name) => {
  return new Promise((fulfill, reject) => {
    request.get('https://ctips.lifetriage.com/api/v1/jobs/name/' + name, (err, response, body) => {
        console.log('Received career data for ' + name);
        fulfill(JSON.parse(body));
    });
  });
}


var jobApp = new alexa.app('jobs');
jobApp.launch(function(request,response) {
  response.say("You can ask me for information about jobs. Try saying, how much do Web Developers earn, or tell me about Medical Workers.");
});
jobApp.intent("JobDescription",
  {
    "slots": {"JobName": "JOB_NAMES"},
  },
  function(request,response) {
    /*
    // Finish making Hamming work
    var maxHamming = ['None', 0]
    for (var i = 0; i < JOB_NAMES.length; i++) {
      if (hamming(request.slot('JobName'), JOB_NAMES[i]) > maxHamming[1]) {
        maxHamming[0] == JOB_NAMES[i];
        maxHamming[1] == hamming(request.slot('JobName'), JOB_NAMES[i]);
      }
    }
    response.say('We heard ' + maxHamming[0]);
    */
    var bestMatch = stringCheck.findBestMatch(request.slot('JobName'), JOB_NAMES);
    getCareer(bestMatch.bestMatch.target).then((data) => {
      response.say('We heard ' + bestMatch.bestMatch.target + '. ' + data.description);
    });
    // response.say('We heard ' + bestMatch.bestMatch.target + ' with a certainty of ' + bestMatch.bestMatch.rating);
  }
);
jobApp.intent("JobIncome",
    {
      "slots": {"JobName": "JOB_NAMES"},
    },
    function(request, response) {
      response.say(request.slot('JobName') + ' earn about $2000 a year');
    }
);
jobApp.express(app, "/echo/");

// Launch /echo/test in your browser with a GET request!
app.listen(PORT);
console.log("Listening on port "+PORT);
