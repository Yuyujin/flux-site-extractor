'use strict';

let highways = {motorway: 5, trunk: 4, primary: 3, secondary: 2, tertiary: 1, other: 0} 
let SyncTileSet = require('node-hgt').SyncTileSet;

// http://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters
let measure = (lat1, lng1, lat2, lng2) => {
  var R = 6378.137; // Radius of earth in KM
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
  Math.sin(dLng/2) * Math.sin(dLng/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;
  return d * 1000; // meters
}

module.exports = (data, features, cb) => {
  let out = {}, nodes = {};
  for (var k in features) { out[k] = [] };
  var bounds = data.bounds;
  var latDomain = Math.abs(bounds.latMax - bounds.latMin);
  var lngDomain = Math.abs(bounds.lngMax - bounds.lngMin);
  var xDomain = measure(bounds.latMin, bounds.lngMin, bounds.latMin, bounds.lngMax);
  var yDomain = measure(bounds.latMin, bounds.lngMin, bounds.latMax, bounds.lngMin);
  var topo = new SyncTileSet('./data/', [bounds.latMin, bounds.lngMin], [bounds.latMax, bounds.lngMax], function(err) {
    if (err) return console.log(err);

    //** TOPOGRAPHY
    var latDomain = bounds.latMax - bounds.latMin;
    var lngDomain = bounds.lngMax - bounds.lngMin;
    if (features.topography) {
      var verts = [], faces = [];
      var elevations = [];
      var coords = [];
      var res = 100;
      for (var i = 0; i <= res; i++) {
        for (var j = 0; j <= res; j++) {
          let nx = (j/res);
          let ny = (i/res);
          var lat = (ny * latDomain) + bounds.latMin;
          var lng = (nx * lngDomain) + bounds.lngMin;
          var z = topo.getElevation([lat, lng]);
          elevations.push(topo.getElevation([lat, lng]));
          verts.push([nx * xDomain, ny * yDomain, z]);
        }
      }
      var sorted = elevations.slice(0).sort();
      var lowest = sorted[0];
      for (var i = 0; i < elevations.length; i++) {
        verts[i][2] -= lowest;
      }
      for (var i = 0; i < res; i++) {
        for (var j = 0; j < res; j++) {
          faces.push([i + (res + 1) * j, i + (res + 1) * (j + 1), (i + 1) + (res + 1) * (j + 1), (i + 1) + (res + 1) * j]);
        }
      }
      out.topography = {primitive: 'mesh', faces: faces, vertices: verts, attributes: { materialProperties: { color: '#ffffff', opacity: 0.6 }}}
    }

    //** NODES
    let dataNodes = data.osm.node;
    for (let i = 0; i < dataNodes.length; i++) {
      let dataNode = dataNodes[i];
      let id = dataNode.$.id;
      let ny = (dataNode.$.lat - bounds.latMin) / latDomain; 
      let nx = (dataNode.$.lon - bounds.lngMin) / lngDomain;
      nodes[id] = { lat: dataNode.$.lat, lng: dataNode.$.lon, nx: nx, ny: ny, x: nx * xDomain, y: ny * yDomain, tags: {} };
    }

    //** WAYS
    let dataWays = data.osm.way;
    for (let i = 0; i < dataWays.length; i++) {
      let dataWay = dataWays[i];
      let id = dataWay.$.id;
      let way = { primitive: 'polyline', points: [] };
      if (dataWay.nd) {
        if (features.topography) {
          for (let j = 0, jl = dataWay.nd.length; j < jl; j++) {
            let nid = dataWay.nd[j].$.ref;
            way.points.push([nodes[nid].x, nodes[nid].y, topo.getElevation([nodes[nid].lat, nodes[nid].lng]) - lowest]);
          }
        } else {
          for (let j = 0, jl = dataWay.nd.length; j < jl; j++) {
            let nid = dataWay.nd[j].$.ref;
            way.points.push([nodes[nid].x, nodes[nid].y, 0]);
          }
        }
      }
      if (dataWay.tag) {
        for (let j = 0, jl = dataWay.tag.length; j < jl; j++) {
          let tag = dataWay.tag[j].$.k;
          if (features[tag]) {
            way.type = tag;
            switch (tag) {
              case 'highway':
                let value = dataWay.tag[j].$.v.split('_')[0];
                if (highways[value]) way.subtype = highways[value];
                else way.subtype = 0;
                way.attributes = { materialProperties: { color: '#0000ff', linewidth: 1 }}
                out.highway.push(way);
                break;
              case 'building':
                way.attributes = { materialProperties: { color: '#ff0000', linewidth: 2 }}
                out[tag].push(way);
                break;
              default:
                way.attributes = { materialProperties: { color: '#00ff00', linewidth: 1 }}
                out[tag].push(way);
                break;
            }
          }
        }
      }
    }
    cb(false, out);
  });
}
