
var SSLYeah = require('../ssl-yeah.js');
const constants = require('../modules/constants.js');
var progressRefreshInterval = '';

//*************INIT**************//
process.stdin.setEncoding('utf8');

var crawler = new SSLYeah();
crawler.on('crawlDone', conclude);

//*************MAIN*************//
if(process.argv[2]){
	crawler.startCrawl(process.argv[2]);
	progressRefreshInterval = setInterval(trackProgress, 500);
	testing = true;
}else{
	help();
}

process.stdin.on('readable', function() {
	var chunk = process.stdin.read();
	if (chunk !== null) {
		var command = chunk.toString().replace(/\r?\n$/, '');
		if(command.match(/^do\s(?:.*\.)*.{1,}$/)){
			//TODO -- could queue additional commands instead of blocking them...
			//then we'd have to clear all data after each request is done... or export as a new instance every time?
			if(testing == false){
				testing = true;
				crawler.startCrawl(command.substr(3, command.length-3));
				progressRefreshInterval = setInterval(trackProgress, 500);
			}
		}else{
			switch (command){
				case 'exit':
					sslyeah.logEnd();
					process.exit(0);
					break;
				case 'help':
				case '?':
					help();
					break;
				default:
					console.log('unrecognised command: ' + command);
			}
		}
	}
});

process.on('exit', function(code) {
  console.log('Goodbye - Exiting with code:', code);
});

//***********FUNCTIONS***********//
function help(){

	clearConsole();
	console.log('----------------------  Welcome to SSL-Yeah  ------------------------');
	console.log('- ');
	console.log('- Settings can be changed in the config file under config/config.js');
	console.log('- ');
	console.log('- Commands:');
	console.log('- "do **domain name**" to create a rule');
	console.log('- "exit" to quit');
	console.log('- "help" or "?" to display this');
	console.log('- ');
	console.log('---------------------------------------------------------------------- ');
}


function clearConsole(){
	if (process.platform == 'win32'){
		process.stdout.write('\033c');
	}else{
		process.stdout.write('\033[2J'); //needs testing on linux
	}
}


function trackProgress(){
	var showMaxHosts = 17;
	var activeTestsCount = 0;
	var activeHostsCount = 0;
	var doneHostsCount = 0;
	var pagesDone = 0;
	var pass = 0;
	var fail = 0;

	crawler.hosts.forEach(function(host){
		pagesDone = pagesDone + host.pages.length;
		activeTestsCount = activeTestsCount + host.activeTests;
		if(host.activeTests == 0){
			doneHostsCount ++;
		}else{
			activeHostsCount  ++;
		}
		if(host.assessment == constants['pass'] || host.assessment == constants['mixedPassive']){
			pass ++;
		}else{
			fail ++;
		}
	});

	if(crawler.settings.outputDebugToConsole == false){

		if(typeof(trackProgress.blink) == 'undefined' || trackProgress.blink == ''){
			trackProgress.blink = 'Still working...';
		}else{
			trackProgress.blink = '';
		}

		clearConsole();
		console.log('SSL-Yeah - Progress - ' + pagesDone + ' pages requested so far. ' + trackProgress.blink);
		console.log('----------------------------------------------------------------------------');
		if(crawler.hosts.length < showMaxHosts){
			crawler.hosts.forEach(function(host){
				console.log(host.url + ' - ' + host.activeTests + ' pages in queue - ' + host.getFinalAssessment());
			});
		}else{
			var shownCount = 0;
			crawler.hosts.forEach(function(domain){
				if(host.activeTests > 0 && shownCount  < showMaxHosts){
					shownCount  ++;
					console.log(host.url + ' - ' + host.activeTests + ' pages in queue - ' + host.getFinalAssessment());
				}
			});
			console.log('');
			console.log('+ ' + (activeHostsCount - shownCount) + ' other domains in test');
			console.log('+ ' + doneHostsCount + ' domains done');
			console.log('Results so far ==> Pass, Warn, N/A: ' + pass + ' Fail: ' + fail);
		}
	}
}

function conclude(){
	clearInterval(progressRefreshInterval);
	console.log('');
	console.log('Crawl done... Writing to file...');
	if(crawler.settings.outputReport){
		crawler.writeReport(end);
	}
	if(crawler.settings.outputRule){
		crawler.writeRule(end);
	}
}

function end(){
	if(crawler.writingRule == false && crawler.writingReport == false){
		SSLYeah.logWrite('All Done');
		console.log('All Done');
		SSLYeah.logEnd();
		process.exit(0);
	}
}
