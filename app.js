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

var parseJob = (name) => {
  return new Promise((fulfill, reject) => {
    var bestMatch = stringCheck.findBestMatch(name, JOB_NAMES);
    fulfill(bestMatch.bestMatch);
  });
}

var jobApp = new alexa.app('jobs');
jobApp.launch(function(request,response) {
  response.say("You can ask me for information about jobs. Try saying, how much do Web Developers earn, or tell me about Medical Workers.").reprompt("You can ask now.");
  response.send();
});
jobApp.intent("JobDescription",
  {
    "slots": {"JobName": "JOB_NAMES"},
  },
  function(request,response) {
    parseJob(request.slot('JobName')).then((jobTitle) => {
      getCareer(jobTitle.target).then((data) => {
        response.say('Here is some info about ' + jobTitle.target + '. ' + data.description);
        response.card(jobTitle.target, data.description)
        response.send();
      });
      return false;
    });
    return false;
  }
);
jobApp.intent("JobIncome",
  {
    "slots": {"JobName": "JOB_NAMES"},
  },
  function(request, response) {
    parseJob(request.slot('JobName')).then((jobTitle) => {
      getCareer(jobTitle.target).then((data) => {
        response.say(jobTitle.target + ' earn about $' + data.meanAnnualWage + ' a year');
        response.send();
      });
      return false;
    });
    return false;
  }
);
jobApp.intent("JobEmployment",
  {
    "slots": {"JobName": "JOB_NAMES"},
  },
  function(request, response) {
    parseJob(request.slot('JobName')).then((jobTitle) => {
      getCareer(jobTitle.target).then((data) => {
        response.say('There are about ' + data.employment + ' ' + jobTitle.target + ' in the US.');
        response.send();
      });
      return false;
    });
    return false;
  }
);
jobApp.intent("JobRandom",
  {
    "slots": [],
  },
  function(request, response) {
    var item = Math.floor(Math.random() * JOB_NAMES.length);
    getCareer(JOB_NAMES[item]).then((data) => {
      response.say('Rolling the dice... And ' + JOB_NAMES[item] + ' has been selected. Here is some info. ' + data.description);
      response.send();
    });
    return false;
  }
);

// Built-in intents
jobApp.intent("AMAZON.HelpIntent",
  {
    "slots": [],
  },
  function(request, response) {
    response.say("This skill helps you learn about careers and sources its data from the Life Triage API. Try asking how much web developers earn or to define wellhead pumpers.").reprompt("I'm ready for your questions.");
  }
);
jobApp.intent("AMAZON.StopIntent",
  {
    "slots": [],
  },
  function(request, response) {
    response.say("Goodbye.");
  }
);

jobApp.express(app, "/echo/");

// Launch /echo/test in your browser with a GET request!
app.listen(PORT);
console.log("Listening on port "+PORT);
