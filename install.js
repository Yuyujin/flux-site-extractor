var cheerio = require('cheerio');
var http = require('http');
var unzip = require('unzip');
var ct = 0;
var limit = 5;
var queue = [];

function runQueue(url) {
  if (url) queue.push(url);
  if (ct < limit && queue.length > 0) {
    ct++;
    download(queue.pop());
  }
}

function download(url) {
  console.log('downloading', url);
  http.get(url, function(res) {
    var extracted = unzip.Extract({path: './data'})
    extracted.on('finish', function() { ct--; runQueue() });
    res.pipe(extracted);
  }).on('error', function(e) { console.log('error', e) });
}

function downloadRegion(region) {
  var base = 'http://dds.cr.usgs.gov/srtm/version2_1/SRTM1/Region_0' + region + '/';
  http.get(base, function(response) {
    if (response.statusCode !== 200) return console.log('Error downloading.');
    var data = '';
    response.on("data", function(chunk) { data += chunk; });
    response.on('end', function() {
      var $ = cheerio.load(data);
      $('li a').each(function(i, element){
        var fullname = element.attribs.href;
        var split = fullname.split('.');
        var isZip = (split[split.length-1] === 'zip');
        var name = split.slice(0, split.length-1).join('.');
        // console.log('isZip', isZip, i < 5, region === 1)
        if (isZip) runQueue(base + fullname);
      });
    })
  }).on('error', function(e) {
    console.log("Got error: " + e.message);
  });
}

// for (var i = 1; i < 7; i++) { downloadRegion(i); }