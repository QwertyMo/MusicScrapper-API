const express = require("express");
const config = require("./config.json")

const SoundCloud = require("./SCClient");
const yts = require( 'yt-search' )
const client = new SoundCloud();

const app = express();

app.get(config.path, function(req, res){
    var url = req.query.url

    if(url == undefined) {
        res.sendStatus(400).send({
            message: "No url"   
        })
    }

    if(url.includes("soundcloud.com")){
        res.status(404).send({message: "SoundCloud disabled now. Maybe it back in next updates"})
        return
        url = url.split("?")[0]
        getSoundCloudPlaylist(url,(dataPlaylist)=>{
            if((typeof dataPlaylist) == "number") getSoundCloudTrack(url, (dataTrack)=>{
                if((typeof dataTrack) == "number") 
                    res.status(dataTrack).send({message: "Url is not valid"})
                else res.send(dataTrack)
            })
            else res.send(dataPlaylist)
        })
    }
    
    else if(url.includes("youtube.com") || url.includes("youtu.be")){
        url = url.replace("shorts/", "watch?v=")
        if(url.includes("/playlist?list=")){
            getYTPlaylist(url, (dataTrack)=>{
                if((typeof dataTrack) == "number") 
                    res.status(dataTrack).send({message: "Url is not valid"})
                else res.send(dataTrack)
            })
        }else {
            getYTTrack(url, (dataTrack)=>{
                if((typeof dataTrack) == "number") 
                    res.status(dataTrack).send({message: "Url is not valid"})
                else res.send(dataTrack)
            })
        }
    }
    else 
        searchYT(url, (dataTrack)=>{
            if((typeof dataTrack) == "number") 
                res.status(dataTrack).send({message: "Some error"})
            else res.send(dataTrack)
    })

  });

function getYTTrack(url, callback){
    var id = url.split("/watch?v=")[1]
    if(id.includes("?")) id = id.split("?")[0]

    var opts = { videoId: id }
    yts( opts,async function ( err, song ) {
        if ( err ) {
            callback(404)
            return
        }
        
        callback(
            {
                isPlaylist: false,
                title: song.title,
                url: "https://www.youtube.com/watch?v=" + song.videoId,
                duration: song.duration.seconds,
                thumbnail: song.thumbnail
            }
        )

    } )
}

function searchYT(title, callback){
    yts( title,async function ( err, videos ) {
        if ( err ) {
            callback(404)
            return
        }
        
        const song = videos.all[0]
        callback(
            {
                isPlaylist: false,
                title: song.title,
                url: "https://www.youtube.com/watch?v=" + song.videoId,
                duration: song.duration.seconds,
                thumbnail: song.thumbnail
            }
        )
    })
}

function getYTPlaylist(url, callback){
    var id = url.split("/playlist?list=")[1]
    if(id.includes("?")) id = id.split("?")[0]

    var opts = { listId: id }
    yts( opts,async function ( err, playlist ) {
        if ( err ) {
            callback(404)
            return
        }

        var tracks = []
        await playlist.videos.forEach((i)=>{tracks[tracks.length]= {
            isPlaylist: false,
            title: i.title,
            url: "https://www.youtube.com/watch?v=" + i.videoId,
            duration: i.duration.seconds,
            thumbnail: i.thumbnail
        }})
        
        callback(
            {
                isPlaylist: true,
                title: playlist.title,
                url: playlist.url,
                thumbnail: playlist.thumbnail,
                tracks: tracks,
            }
        )

    } )
}



function getSoundCloudPlaylist(url, callback){

        client.getPlaylist(url)
        .then(async song => {

            var tracks = []
            await song.tracks.forEach((i)=>{
                var track = {
                    isPlaylist: false,
                    title: i.title,
                    url: i.url,
                    duration: Math.round(i.duration/1000)
                }
                if(i.thumbnail!=null) track.thumbnail = i.thumbnail
                tracks[tracks.length]=track

            })

            var thumb = song.thumbnail
            if(thumb == null) thumb = tracks[0].thumbnail

            var p = {
                isPlaylist: true,
                title: song.title,
                url: song.url,
                tracks: tracks
            }
            if(thumb!=null) p.thumbnail = thumb

            callback(p)
            
        })
       .catch(()=>{callback(404)})
}

function getSoundCloudTrack(url, callback){
        client.getSongInfo(url)
            .then(async song => {
                var t = {
                    isPlaylist: false,
                    title: song.title,
                    url: song.url,
                    duration: Math.round(song.duration/1000)
                }
                if(song.thumbnail!=null) t.thumbnail = song.thumbnail
                callback(t)
            
        })
            .catch(()=>{callback(404)})
}

app.listen(config.port);