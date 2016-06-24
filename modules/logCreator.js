var fs = require('fs');
var moment = require('moment');
var stream = false;
var logToConsole = false;

exports.init = function(path, toConsole){

	try { fs.mkdirSync(path); }
	catch(e) { if ( e.code != 'EEXIST' ) throw e }

	stream = fs.createWriteStream(path + '/debug_log.txt');
	stream.on('error', function(e){console.log('error writing to file: ' + e)})

	logToConsole = toConsole;
}

exports.write = function(data){
	if(stream){
		stream.write(now() + data + '\r\n');
	}

	if(logToConsole){
		console.log(data);
	}

}

exports.end = function(){
	if(stream){
		stream.end(now() + 'Stream was closed');
		stream = undefined;
	}
}

function now(){
	return '[' + moment().format("HH:mm:ss.SSS") + '] ';
}
