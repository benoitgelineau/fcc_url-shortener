'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var dns = require('dns');
const url = require('url');
var mongo = require('mongodb');
var mongoose = require('mongoose');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

// process.env.MONGOLAB_URI=mongodb://<dbuser>:<dbpassword>@ds125181.mlab.com:25181/fcc_url-shortener
mongoose.connect(process.env.MONGOLAB_URI, { useMongoClient: true });

const Schema = mongoose.Schema;
const schema = new Schema({
  id: {
    type: String,
    unique: true
  },
  url: {
    type: String,
    unique: true
  }
});

const Address = mongoose.model('Address', schema);

const createAddress = (id, url) => {
  Address.create(
    { id: id, url: url },
    (err, address) => {
      if (err) console.log(err);
      console.log(
        `${address} has been successfully added to the db`
      );
    }
  );
};

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Parse URL middleware
const parseUrl = (req, res, next) => {
  
  req.url = req.body.url;
  req.myUrl = url.parse(req.url);

  next();
};

// Check valid URL middleware
const isValid = (req, res, next) => {
  
  const reg = /^https?:\/\/www/;
  req.valid = reg.test(req.url);
  
  next();
}

// Send responses
const requestHandler = (req, res) => {
  Address.findOne({ url: req.url }, (err, result) => {
    if (err) console.log(`No URL found: ${err}`);

    if (result) {

      // Return url found in db
      res.json({
        original_url: result.url,
        short_url: result.id
      });

    } else {
      if (req.valid) {

        // Check hostname validity
        dns.lookup(req.myUrl.hostname, err => {

          if (err) {
            res.json({ error: "invalid Hostname" });

          } else {

            // Create new address
            Address.find().count((err, count) => {
              const id = count + 1;
              if (err) console.log(`Could not count db: ${err}`);

              createAddress(id, req.url);

              res.json({ original_url: req.url, short_url: id });
            });
          }
        });

      } else {
        // Return invalid URL if input != 'http(s)://www'
        res.json({ error: "invalid URL" });
      }
    }
  });
};

// API endpoint
app.post('/api/shorturl/new', parseUrl, isValid, requestHandler);

// Redirect to new url
app.get('/api/shorturl/:id', (req, res) => {

  Address.findOne({ id: req.params.id }, (err, result) => {

    if (err) console.log('Could not find short url: ' + err);
    result ? res.redirect(result.url) : res.json({ error: "short url doesn't exist" });

  });
});

app.listen(port, () => {
  console.log('Node.js listening ...');
});
