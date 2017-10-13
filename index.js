const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

const defaultStreamId = '6?';
const directories = ['screenshots', 'short', 'slowmo', 'timelapse'];

const liveJsonUrl = process.env.LIVEJSONURL;
const APIUrl = process.env.APIURL;

generateLiveScreenshots = () => {
  const channels = ['een', 'canvas', 'ketnet', 'stubru', 'mnm'];

  fetch(liveJsonUrl)
    .then(response => {
      response.text().then(responseText => {
        return JSON.parse(responseText.replace(/parseLiveJson\(/, '').replace(/\)\s?/g, ''));
      })
      .then(json => {
        Object.keys(json).forEach(key => {
          if(channels.indexOf(key.substr(7)) > -1) {
            getScreenshotFromVideo(json[key].hls, key, 5);
          }
        })
      });
    })
    .catch(error => {
      console.error(error);
    });
}

generateVODScreenshot = (streamData, name, timestamps) => {
  getScreenshotFromVideo(streamData.format.filename, name, defaultStreamId, timestamps);
}

getScreenshotFromVideo = (videoUrl, name, streamId, timemarks) => {
  var startTime;

  const proc = new ffmpeg(videoUrl)
    .outputOptions('-map 0:' + streamId)
    .screenshots({
        size: '960x540',
        filename: name + (timemarks ? '-%s.png' : '.png'),
        folder: process.cwd() + '/screenshots/',
        timestamps: timemarks || [ 0 ]
      }
    )
    .on('start', function() {
        startTime = new Date();
    })
    .on('end', function(err, stdout, stderr) {
        const endTime = new Date();
        console.log('Finished processing Screenshots (' + msToTime(endTime - startTime) + ') ' + name + '.');
    });
}

getTimeLapseFromVideo = (streamData, name) => {
  var startTime;
  const duration = streamData.format.duration;

  const proc = new ffmpeg(streamData.format.filename)
    .outputOptions('-an')
    .outputOptions('-map 0:' + defaultStreamId)
    .videoFilters('setpts=' + (5/duration) + '*PTS')
    .output(process.cwd() + '/timelapse/' + name + '.mp4')
    .fps(2)
    .on('start', function() {
        startTime = new Date();
    })
    .on('error', function(e) {
      console.log(e);
    })
    .on('end', function(err, stdout, stderr) {
        const endTime = new Date();
        console.log('Finished processing Timelapse (' + msToTime(endTime - startTime) + ') ' + name + '.');
    })
    .run();
}

generateMovingThumbFromVideo = (streamData, name) => {
  var startTime;

  const duration = streamData.format.duration;
  const width = streamData.streams[streamData.streams.length - 1].width;
  const height = streamData.streams[streamData.streams.length - 1].height;

  const proc = new ffmpeg(streamData.format.filename)
    .outputOptions('-an')
    .outputOptions('-map 0:' + defaultStreamId)
    .setStartTime((duration/2))
    .setDuration(10)
    .output(process.cwd() + '/short/' + name + '_' + width + 'x' + height + '.mp4')
    .on('start', function() {
        startTime = new Date();
    })
    .on('error', function(e) {
      console.log(e);
    })
    .on('end', function(err, stdout, stderr) {
        const endTime = new Date();
        console.log('Finished processing Moving Thumbnail (' + msToTime(endTime - startTime) + ') ' + name + ' (' + width + 'x' + height + ')');
    })
    .run();
}


getCenterSlowMoVideo = (streamData, name) => {
  var startTime;
  const duration = streamData.format.duration;

  const proc = new ffmpeg(streamData.format.filename)
    .outputOptions('-an')
    .outputOptions('-map 0:' + defaultStreamId)
    .outputOptions('-framerate 0.25')
    .videoFilters('setpts=10*PTS')
    .videoFilters('framerate=fps=30:interp_start=64:interp_end=192:scene=100')
    .setStartTime((duration/2))
    .setDuration(10)
    .output(process.cwd() + '/slowmo/' + name + '.mp4')
    .on('start', function() {
        startTime = new Date();
    })
    .on('error', function(e) {
      console.log(e);
    })
    .on('end', function(err, stdout, stderr) {
        const endTime = new Date();
        console.log('Finished processing Slow Motion (' + msToTime(endTime - startTime) + ') ' + name + '.');
    })
    .run();

}

msToTime = (duration) => {
  var milliseconds = parseInt((duration%1000)/100)
      , seconds = parseInt((duration/1000)%60)
      , minutes = parseInt((duration/(1000*60))%60)
      , hours = parseInt((duration/(1000*60*60))%24);

  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}

generate = (url) => {

  getVideoUrl(url, function(data) {
    const name = data.title;
    const videoUrl = data.targetUrls[0].url;

    ffmpeg.ffprobe(videoUrl, function(err, metadata) {
      generateVODScreenshot(metadata, name, ['50%']);
      getCenterSlowMoVideo(metadata, name);
      generateMovingThumbFromVideo(metadata, name);
      // getTimeLapseFromVideo(metadata, name);
    });
  })
}

getVideoUrl = (url, callback) => {
  var videoUrl = url.replace(/\/(?=[^\/]*$)/, '.content.json')

  fetch(videoUrl)
    .then(response => {
      return response.json();
    })
    .then(json => {
      getMediaZoneData(json.publicationId + '$' + json.videoId, callback);
    })
    .catch(error => {
      console.error(error);
    });
}

getMediaZoneData = (id, callback) => {
  fetch(APIUrl + id)
    .then(response => {
      return response.json();
    })
    .then(json => {
      callback(json);
    })
    .catch(error => {
      console.error(error);
    });
}

init = () => {
  directories.map(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  })

  if (process.argv.length > 2) {
    switch(url = process.argv[2]) {
      case "live":
        generateLiveScreenshots();
        break;
      default:
        generate(url);
        break;
    }
  }
}

init();
