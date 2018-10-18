
var axios = require('axios');
var querystring = require('querystring');
var crypto = require('crypto');
var iconv = require('iconv-lite');

var boxURL = 'http://192.168.3.1';
var username = '';
var password = process.argv[2] || '';
var devices = [];

var checkDevices = async url => {
  try {
    console.log('Checking the state of network devices...');
    var challengeURL = `${boxURL}/login_sid.lua?username=${username}`;
    var resp = await axios.get(challengeURL);
    var data = resp.data;
    var sid = extractSID(data);
    if (sid !== '0000000000000000') {
      console.log('We are still have a valid session, which we can use:', sid);
    }

    var challenge = extractChallenge(data);
    var str = `${challenge}-${password}`;
    // convert encoding to UTF-16LE
    var strBuffer = iconv.encode(str, 'utf16-le');
    var md5 = crypto.createHash('md5').update(strBuffer).digest('hex');
    var challengeResponse = `${challenge}-${md5}`;

    var sidURL = `${boxURL}/login_sid.lua?username=${username}&response=${challengeResponse}`;
    resp = await axios.get(sidURL);
    sid = extractSID(resp.data);
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': boxURL,
        'Pragma' : 'no-cache',
        'User-Agent': 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.8,de;q=0.6',
        'Accept-Encoding': 'gzip, deflate, sdch',
        'Connection': 'keep-alive',
	      'Cache-Control': 'no-cache',
      }
    }
    var body = {
      xhr: 1,
      sid: sid,
      lang: 'en',
      page: 'netDev',
      type: 'cleanup',
    };
    // By default, axios serializes JavaScript objects to JSON. Use querystring!
    resp = await axios.post(`${boxURL}/data.lua`, querystring.stringify(body), config);
    var rr = resp.data;
    var allDevices = rr.data.active.concat(rr.data.passive);
    allDevices.forEach(active => {
      var device = devices.find(function(d) {
        return d.mac === active.mac;
      })
      if (device === undefined) {
        device = {
          mac: active.mac,
        }
        devices.push(device);
      }
      var now = new Date().toISOString();
      device.fritzState = active.state; // globe_online=connected to internet, led_green=connected but not using internet, ""=offline
      device.ipv4 = active.ipv4;
      device.name = active.name;
      device.lastUpdated = now;
      var newState = active.state === '' ? 0 : 1;
      if (device.state !== newState) {
        console.log(now, device.ipv4, newState === 1 ? 'connected' : 'disconnected');
        if (newState === 1) {
          console.log(now, 'Welcome back', device.name);
        } else {
          console.log(now, 'Have a nice day', device.name);
        }
        device.state = newState;
      }
    });
  } catch(e) {
    console.error(e);
  }
}

checkDevices();
setInterval(checkDevices, 3000);

function extractSID(xmlString) {
  var posStart = xmlString.indexOf('<SID>') + '<SID>'.length;
  var posEnd = xmlString.indexOf('</SID>');
  return xmlString.substr(posStart, posEnd - posStart);
}

function extractChallenge(xmlString) {
  var posStart = xmlString.indexOf('<Challenge>') + '<Challenge>'.length;
  var posEnd = xmlString.indexOf('</Challenge>');
  return xmlString.substr(posStart, posEnd - posStart);
}
