var util    = require("util");
var request = require("request");

var discovery = new (require("sonos-discovery"))();

var currentlyPlaying = {};
var currentState = {};

function _dump(label) {
    return function() {
        console.log(">> " + label, util.inspect(arguments, { depth: null, colors: true }));
    };
}

function publish(event, body) {
    request(
        {
            url: "http://example.com:7000/publish/78f0e717-429e-4c92-8ade-4c3b3698c4a7",
            method: "POST",
            json: {
                event: event,
                body: body,
            },
        },
        function (err, resp) {
            // console.log(err, resp, body);
            if (err) {
                console.log(["error publishing", event, body]);
                
                if (resp) {
                    console.log(resp.statusCode);
                }
                
                console.error(err);
            }
        }
    );
}

// discovery.on("group-volume",    _dump("group-volume")); // not useful
// discovery.on("group-mute",      _dump("group-mute")); // probably not useful
// discovery.on("volume",          _dump("volume")); // not useful
// discovery.on("mute",            _dump("mute")); // probably not useful

// discovery.on("favorites", function(favorites) { // not useful
//     console.log(">> favorites");
//     
//     favorites.forEach(function(favorite) {
//         console.log("    %s %s -- %s", favorite.type, favorite.title, favorite.description);
//     });
// });

discovery.on("topology-change", function(topologies) {
    console.log(">> topology-change");
    
    topologies.forEach(function(msg) {
        console.log(">>>> topology-change: %s", discovery.players[msg.uuid].roomName);
        
        console.log("coordinator: %s (%s)", msg.coordinator.uuid, msg.coordinator.roomName);
        
        msg.members.forEach(function(member) {
            console.log("     member %s (%s)", member.uuid, member.roomName);
        });
    });
});

discovery.on("queue-changed", function(msg) {
    var player = discovery.players[msg.uuid];

    console.log(">> queue-changed event for %s", player.roomName);
    
    player.getQueue(0, undefined, function(succeeded, result) {
        var pubBody = {
            queue_items: [],
        };
        
        result.items.forEach(function(item) {
            console.log("queue item: “%s” by “%s” on “%s”", item.title, item.artist, item.album);
            
            pubBody.queue_items.push({
                title: item.title,
                artist: item.artist,
                album: item.album,
            });
        });
        
        publish("queue-changed", pubBody);
    });
});

// discovery.on("notify", function(msg) { // doesn't seem to be useful
//     /*
//     { sid: 'uuid:RINCON_000E58F2480601400_sub0000014069',
//       nts: 'upnp:propchange',
//       type: 'SystemUpdateID',
//       body: '1037' }
//     */
//     
//     console.log(">> notify event for %s: %s", msg.sid, msg.type);
// });

discovery.on("transport-state", function(msg) {
    /*
    { uuid: 'RINCON_000E58F2480601400',
      state: 
       { currentTrack: 
          { artist: 'Mr. Mister',
            title: 'Is It Love',
            album: 'The Best of Mr. Mister',
            albumArtURI: '/getaa?s=1&u=x-sonos-spotify%3aspotify%253atrack%253a5xRsa73keXCiK4cuIpWVQ3%3fsid%3d12%26flags%3d32',
            duration: 220,
            uri: '',
            Uri: 'x-sonos-spotify:spotify%3atrack%3a5xRsa73keXCiK4cuIpWVQ3?sid=12&flags=32' },
         nextTrack: 
          { artist: 'Mr. Mister',
            title: 'Kyrie',
            album: 'The Best of Mr. Mister',
            albumArtURI: '/getaa?s=1&u=x-sonos-spotify%3aspotify%253atrack%253a5BXj1QDRU77J1ngVavG1tI%3fsid%3d12%26flags%3d32',
            duration: 254,
            uri: 'x-sonos-spotify:spotify%3atrack%3a5BXj1QDRU77J1ngVavG1tI?sid=12&flags=32' },
         volume: 30,
         mute: false,
         trackNo: 2,
         elapsedTime: 2,
         elapsedTimeFormatted: '00:02',
         zoneState: 'PLAYING',
         playerState: 'PLAYING' },
      playMode: 
       { shuffle: false,
         repeat: false,
         crossfade: true },
      crossfade: undefined,
      roomName: 'Front of Office',
      coordinator: 'RINCON_000E58F2480601400',
      groupState: { volume: 29, mute: false } }
    */
    console.log(">> transport-state change on %s [%s/%s]", msg.roomName, msg.state.zoneState, msg.state.playerState);
    // console.log(msg);
    // these events are emitted more frequently than just on track and state change
    var doEmit = false;

    if (currentState[msg.uuid] !== msg.state.playerState) {
        currentState[msg.uuid] = msg.state.playerState;
        
        doEmit = true;
    }
    
    var currentTrackUri = (msg.state.currentTrack.Uri || msg.state.currentTrack.uri);
    
    if (! currentlyPlaying[msg.uuid] || currentlyPlaying[msg.uuid] !== currentTrackUri) {
        currentlyPlaying[msg.uuid] = currentTrackUri;
        
        doEmit = true;
    }
    
    if (doEmit) {
        console.log("now playing: “%s” by “%s” on “%s” [%s]", msg.state.currentTrack.title, msg.state.currentTrack.artist, msg.state.currentTrack.album, msg.state.trackNo);
        console.log("    up next: “%s” by “%s” on “%s”", msg.state.nextTrack.title, msg.state.nextTrack.artist, msg.state.nextTrack.album);
        console.log("elapsed: %s", msg.state.elapsedTimeFormatted);
        
        publish("transport-state", {
            room:      msg.roomName,
            zoneState: msg.state.zoneState,
            trackNo:   msg.state.trackNo,
            
            currentTrack: {
                title:  msg.state.currentTrack.title,
                artist: msg.state.currentTrack.artist,
                album:  msg.state.currentTrack.album,
            },
            nextTrack: {
                title:  msg.state.nextTrack.title,
                artist: msg.state.nextTrack.artist,
                album:  msg.state.nextTrack.album,
            },
        });
    }
});

module.exports = discovery;
