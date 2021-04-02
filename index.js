'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');
const { prependOnceListener } = require('superagent');

const app = express();
app.use(cors());
const PORT = process.env.PORT;
const client = new pg.Client(process.env.DATABASE_URL);
client.on('error', err => console.log('PG Error'));

app.get('/location', handleLocation);
app.get('/weather', handleWeather);
app.get('/parks', handleParks);
app.get('/movies', handleMovies);
app.get('/yelp', handleYelp);


// app.use('*', noExist);
// app.use(errorHandler);
// function noExist(request, response) {
//   response.status(404).send('Error 404, Page Not Found!');
// }
// function errorHandler(err, request, response) {
//   response.status(500).send('Error 500, Server Internal Error');
// }

function handleParks (request, response) {
  let key = process.env.PARK_API_KEY;
  let city = request.query.search_query;

  let url = `https://developer.nps.gov/api/v1/parks?api_key=${key}&q=${city}`;

  superagent.get(url).then(res => {
    let info = res.body.data;
    info.forEach(element => {
      let url = element.url;
      let name = element.fullName;
      let description = element.description;
      let fee = '0.0';
      let address = element.addresses[0].line1 + ', ' + element.addresses[0].city + ', ' + element.addresses[0].stateCode + ' ' + element.addresses[0].postalCode;
      new Park(name, address, fee, description, url);

    });
    response.send(allArr);
  });

}

function handleYelp (request, response) {
  let city=request.query.search_query;
  const key = process.env.YELP_API_KEY;
  let url = `https://api.yelp.com/v3/businesses/search?location=${city}`;
  superagent.get(url)
    .set('Authorization', `Bearer ${key}`)
    .then( data => {
      let resultArr =[];
      let yelpData = data.body.businesses;
      yelpData.forEach(element => {
        let localYelp = new Yelp(element);
        resultArr.push(localYelp);
      });
      response.status(200).json(resultArr);
    });

}

function Yelp (data) {
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.url = data.url;
}

function handleMovies(request, response) {
  let key = process.env.MOVIE_API_KEY;
  let city = request.query.search_query;
  let URL = `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${city}`;
  superagent.get(URL).then(res => {
    let resultArr=[];
    res.body.results.forEach( item => {
      resultArr.push(new Movie(item));
    });
    response.send(resultArr);
  });
}

function Movie (result) {
  this.title = result.title;
  this.overview = result.overview;
  this.average_votes=result.vote_average;
  this.total_votes=result.vote_count;
  this.image_url=`https://image.tmdb.org/t/p/w500${result.poster_path}`;
  this.popularity=result.popularity;
  this.released_on=result.release_date;
}


let allArr = [];
function Park(name,address,fee,description,url){
  this.name = name;
  this.address = address;
  this.fee = fee;
  this.description = description;
  this.url = url;
  allArr.push(this);
}


function handleLocation(request, response) {
  let city = request.query.city;
  const SQL ='SELECT * FROM location where search_query=$1';

  client.query(SQL, [city]).then(result=> {
    if (result.rowCount>0) {
        response.send(result.rows[0]);
    } else {
      let key = process.env.GEO_API_KEY;
      const url = `https://us1.locationiq.com/v1/search.php?key=${key}&q=${city}&format=json`;
      superagent.get(url).then(res=> {
        const locationData = res.body[0];
        const location = new Location(city, locationData);
        let lat=locationData.lat;
        let lon=locationData.lon;
        const SQL = 'INSERT INTO location (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4) RETURNING *';
        let values = [city, locationData.display_name, lat, lon];
        client.query(SQL, values).then(result=> {
          response.send(location);
        });
      }).catch((err)=> {
        console.log('ERROR IN LOCATION API');
        console.log(err);
      });
    }
  });


}
function Location(city, geoData) {
  this.search_query = city;
  this.formatted_query = geoData.display_name;
  this.latitude = geoData.lat;
  this.longitude = geoData.lon;
}


function handleWeather(request, response) {

  let key = process.env.WETH_API_KEY;
  let lat = request.query.latitude;
  let lon = request.query.longitude;
  const url = `https://api.weatherbit.io/v2.0/forecast/daily?lat=${lat}&lon=${lon}&key=${key}&days=8`;
  superagent.get(url).then(res => {
    let data = res.body.data;
    let resultArr =[];
    data.forEach(item => {
      resultArr.push(new Weather(item));
    });

    response.send(resultArr);
  });
}

function Weather(item) {
  this.time = item.datetime;
  this.forecast = item.weather.description;
}
client.connect().then(
  app.listen(PORT, () => console.log('App is running'))

);

