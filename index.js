/* HTTP server */

var multiparty = require('multiparty');
var util = require('util');
var express = require('express');
var fs = require('fs');
var crypto = require('crypto');

var app = express();
var server = require('http').createServer(app);

server.listen(9000);

function encryptFile(file, cb){

	var algorithm = 'aes-256-ctr';
    var password = 'DEADBEEF';
    
	// input file
	var r = fs.createReadStream(file.path);
	
	// encrypt content
	var encrypt = crypto.createCipher(algorithm, password);
	// decrypt content
	//var decrypt = crypto.createDecipher(algorithm, password)

	var w = fs.createWriteStream(__dirname + '/fileVault/' + file.originalFilename);

	// start pipe
	r.pipe(encrypt).pipe(w);
	
	r.on('end', function(){
		console.log("encrytion finished");
	});
}

function createSHA1(str){
	return crypto.createHash('sha1').update('Apple').digest("hex");
}

//static stuffs
app.use('/static', express.static(__dirname + '/static'));

app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});

app.post('/upload', function (req, res) {

	var form = new multiparty.Form();

	var theFile;

	form.on('progress', function(bytesReceived, bytesExpected) {
		var curP = bytesReceived / bytesExpected;
		var data = {};
		data.rx = bytesReceived;
		data.total = bytesExpected;
		data.p = curP;
		console.log((curP * 100) + "% uploaded");
		
	});

	form.on('end', function() {
		console.log(req.files);
		res.send("well done");
	});

	form.on('file', function(field, file) {
		//console.log(field, file);
		theFile = file;
	});

	form.parse(req, function(err, fields, files) {
		res.writeHead(200, {'content-type': 'text/plain'});
		//res.write('received upload:\n\n');
		res.end('{success: true}');
		console.log(theFile);
		encryptFile(theFile);
  
	});
});//end upload

//crash helper!
process.on('uncaughtException', function(err) {
	console.error(err.stack);
});
