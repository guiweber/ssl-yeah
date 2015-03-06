var fs = require('fs');
var moment = require('moment');
var stream = false;
var logToConsole = false;

exports.init = function(path, enable, toConsole){
	
	try { fs.mkdirSync(path); } 
	catch(e) { if ( e.code != 'EEXIST' ) throw e }
	
	if(enable){
		stream = fs.createWriteStream(path + '/debug_log.txt');
		stream.on('error', function(e){console.log('error writing to file: ' + e)})
	}
	
	logToConsole = toConsole;
}

exports.write = function(data){
	if(stream){
	stream.write('[' + moment().format("HH:mm:ss.SSS") + '] ' + data+'\r\n');
	}
	
	if(logToConsole){
		console.log(data);
	}
	
}

exports.end = function(){
	if(stream){
		stream.end('Stream was closed');
	}
}