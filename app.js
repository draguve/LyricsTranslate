var express = require('express');
var nunjucks = require('nunjucks');
var Genius = require("node-genius");
var geniusClient = new Genius("NnQ25Wn1Tc0Lmpz2eRvInOqjGOPLuJzZGtNSFE6yr1EypL_CowwC9SfkvVtZCWj7");
const fetch = require('node-fetch');
var cheerio = require('cheerio');
const translate = require('@k3rn31p4nic/google-translate-api');

var bodyParser = require('body-parser');


var app = express();
var port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

var PATH_TO_TEMPLATES = './Templates';
nunjucks.configure(PATH_TO_TEMPLATES, {
    autoescape: true,
    express: app
});

app.get('/', function (req, res) {
    return res.render('search.html');
});

app.post('/', function(req, res) {
    var search = req.body.query;
    geniusClient.search(search, function (error, results) {
        if(error) return res.send(error);
        results = JSON.parse(results);
        var hits = [];
        results.response.hits.forEach(element => {
            if(element.type==="song"){
                var song={
                    title:element.result.title_with_featured,
                    image:element.result.song_art_image_thumbnail_url,
                    artist:element.result.primary_artist.name,
                    id:element.result.id
                }
                hits.push(song);
            }
        });
        var data = {
            results: hits,
            query: search
        } ;
        return res.render( 'search.html', data ) ;
        //return res.send(JSON.stringify(hits));
    });
});

function parseSongHTML(htmlText) {
    const $ = cheerio.load(htmlText)
    const lyrics = $('.lyrics').text()
    const releaseDate = $('release-date .song_info-info').text()
    return {
        lyrics,
        releaseDate,
    }
}

app.get('/song/:id', function (req, res) {
    geniusClient.getSong(req.params.id, function (error, song) {
        if(error) return res.send(error)
        song = JSON.parse(song);
        fetch(`https://genius.com${song.response.song.path}`, {
            method: 'GET',
        }).then(response => {
            if (response.ok) return response.text()
            throw new Error('Could not get song url ...')
        }).then(parseSongHTML).then(data => {
            translate(data.lyrics, { from: 'en', to: 'fr' }).then(returnResult => {
                // console.log(res.text); // OUTPUT: Je vous remercie
                // console.log(res.from.autoCorrected); // OUTPUT: true
                // console.log(res.from.text.value); // OUTPUT: [Thank] you
                // console.log(res.from.text.didYouMean); // OUTPUT: false
                translate(returnResult.text, { from: 'fr', to: 'en' }).then(second => {
                    return res.send(second.text);
                }).catch(err => {
                    res.send(err);
                    console.error(err);
                });
            }).catch(err => {
                res.send(err);
                console.error(err);
            });
            // res.send(data.lyrics);
        }).catch(err => {
            res.send(err);
            console.error(err);
        });;
    })
    //return res.render('index.html');
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))
