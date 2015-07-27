/* built-in modules */
var fs = require('fs');
var crypto = require('crypto');
var mime = require('mime');

/* third party modules */
var multiparty = require('multiparty');
var util = require('util');
var express = require('express');
var sqlite3 = require('sqlite3').verbose();

/* globals */
var db = new sqlite3.Database(':memory:');
var app = express();
var server = require('http').createServer(app);

server.listen(9000);

try{
	fs.mkdirSync(__dirname + '/fileVault');
}catch(e){
	
}

function encryptFile(file, key, cb){

	var algorithm = 'aes-256-ctr';
    var password = 'DEADBEEF';
    
	// input file
	var r = fs.createReadStream(file.path);
	
	// encrypt content
	var encrypt = crypto.createCipher(algorithm, password);
	
	var w = fs.createWriteStream(__dirname + '/fileVault/' + key);

	// start pipe
	r.pipe(encrypt).pipe(w);
	
	r.on('end', function(){
		console.log("encrytion finished");
	});
}

function createSHA1(str){
	return crypto.createHash('sha1').update(str).digest("hex");
}

function generateDownloadKey(origName){
	var t = new Date().getTime();
	console.log(t);
	return createSHA1(t + origName);
}

function saveFileName(key, origName, password, mimeType){
	var stmt = db.prepare("INSERT INTO FILES VALUES (?, ?, ?, ?)");
	stmt.run(key, origName, password, mimeType);
	//commit!
	stmt.finalize();
}

//create db table
db.run("CREATE TABLE IF NOT EXISTS FILES( ID CHAR(50) PRIMARY KEY NOT NULL, NAME TEXT NOT NULL, PASSWORD TEXT, MIME TEXT)");
	
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
		//res.writeHead(200, {'content-type': 'text/plain'});
		//res.write('received upload:\n\n');
		console.log(fields);
		var passwd;
		
		if(fields.password){
			passwd = fields.password[0];
		}
		
		var origName = theFile.originalFilename;
		var dlKey = generateDownloadKey(origName)
		console.log(dlKey);
		res.send({key: dlKey});
		
		var mimeType = mime.lookup(theFile.path);
		saveFileName(dlKey, origName, passwd, mimeType);
		console.log(theFile);
		encryptFile(theFile, dlKey);
  
	});
});//end upload

function downloadEncryptedFile(key, origName, mimetype, res){

	var algorithm = 'aes-256-ctr';
    var password = 'DEADBEEF';
    
	// input file
	var r = fs.createReadStream(__dirname + '/fileVault/' + key);
	
	// decrypt content
	var decrypt = crypto.createDecipher(algorithm, password)

	//set headers
	res.setHeader('Content-disposition', 'attachment; filename=' + origName);
	if(mimetype){
		res.setHeader('Content-type', mimetype);
	}
	// start pipe
	r.pipe(decrypt).pipe(res);
	
	r.on('end', function(){
		console.log("decryption finished");
	});
}

app.get('/dl', function(req, res){
	var key = req.query.key;
	if(!key){
		res.send(400, 'Missing key');
	}else{
		//lookup from db
		//db.each("SELECT * FROM FILES", function(err, row){
		//	console.log(row);
		//});
		db.get("SELECT * FROM FILES WHERE ID='" + key + "'", function(err, row){
			console.log(row);
			//check password here
			if(err){
				res.send(500, "Internal error");
			}
			if(!row){
				res.send(404, "File not found");
			}
			if(row.PASSWORD){
				var passwd = req.query.passwd;
				console.log(passwd);
				if(!passwd || row.PASSWORD != passwd){
					res.send(401, "Password required for this file");
				}else{
					downloadEncryptedFile(row.ID, row.NAME, row.MIME, res);
				}
			}else{
				downloadEncryptedFile(row.ID, row.NAME, row.MIME, res);
			}
			
		});
		
	}
});

//crash helper!
process.on('uncaughtException', function(err) {
	console.error(err.stack);
	//shutdown let forever restart it
	process.exit(1);
});
