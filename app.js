var express = require('express');
var nunjucks = require('nunjucks');

var Genius = require("node-genius");
var geniusClient = new Genius("NnQ25Wn1Tc0Lmpz2eRvInOqjGOPLuJzZGtNSFE6yr1EypL_CowwC9SfkvVtZCWj7");
const fetch = require('node-fetch');
var cheerio = require('cheerio');
const translate = require('@k3rn31p4nic/google-translate-api');

var bodyParser = require('body-parser');


var app = express();
var port = 3000

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

app.get('/song/:id', async (req, res) => {
    geniusClient.getSong(req.params.id, function (error, song) {
        if(error) return res.send(error)
        song = JSON.parse(song);
        fetch(`https://genius.com${song.response.song.path}`, {
            method: 'GET',
        }).then(response => {
            if (response.ok) return response.text()
            throw new Error('Could not get song url ...')
        }).then(parseSongHTML).then(async(data) => {
            var lang = "fr"
            var queue = ["en",lang,"en"];
            var results = [];
            var init = {
                conv:data.lyrics,
                lang:"en",
                text:data.lyrics.replace(/(?:\r\n|\r|\n)/g, '<br>')
            }
            results.push(init);
            for(var i=1;i<queue.length;i++){
                try{
                    let newTranslation = await translate(results[i-1].conv,{from:queue[i-1],to:queue[i]});
                    var conversion = {
                        conv:newTranslation.text,
                        lang:results[i-1].lang+"->"+queue[i],
                        text:newTranslation.text.replace(/(?:\r\n|\r|\n)/g, '<br>')
                    }
                    results.push(conversion);
                }catch(error){
                    console.error(error);
                    return res.send(error);
                }
            }
            var rendererData = {
                title:song.response.song.title_with_featured,
                img:song.response.song.song_art_image_thumbnail_url,
                artist:song.response.song.album.full_title,
                results:results.reverse()
            }
            return res.render("lyrics.html",rendererData);
            // res.send(data.lyrics);
        }).catch(err => {
            res.send(err);
            console.error(err);
        });
    });
    //return res.render('lyrics.html');
});

app.get("/test/",async (req,res) => {
    fetch(`https://genius.com/King-gizzard-and-the-lizard-wizard-self-immolate-lyrics`, {
        method: 'GET',
    }).then(response => {
        if (response.ok) return response.text()
        throw new Error('Could not get song url ...')
    }).then(parseSongHTML).then(data => {
        var lyr = data.lyrics.replace(/(?:\r\n|\r|\n)/g, '<br>');
        var renderer={
            lyrics : lyr
        }
        return res.render('lyrics.html',renderer) ;
    });
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))
