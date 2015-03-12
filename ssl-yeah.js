/* SSL -Yeah - An HTTPS verification tool and ruleset creator for HTTPS Everywhere
    Copyright (C) 2015 Guillaume Weber

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

//NodeJS Libs
var events = require('events');
var http = require('http');
var https = require('https');
var util = require('util');

//Third Party Libs
var cheerio = require('cheerio');
var robotsParser = require('./src/robots-parser/');

//Other libs
var settings = require('./settings.js');
var log = require('./src/logCreator.js');
var rule = require('./src/ruleCreator.js');
var report = require('./src/reportCreator.js');
var urlTools = require('./src/urlTools.js');

var progressRefreshInterval = '';
var testing = false;
var domains = [];
	domains.constants = {
		'pass':					'PASS',
		'mixedPassive': 		'WARN (Passive Mixed Content)',
		'mixedActive': 		'FAIL (Active Mixed Content)',
		'connectionError': 	'FAIL (Connection Error)',
		'noValidResponse': 'N/A (No Valid Response)',
		'redirect': 				'N/A (Redirects All)',
		'undefined': 			'N/A (No Results)'
	};
  
//*************CLASSES**********//
var DomainConstructor = function(url) {
	this.activeTests =  0;
	this.url = url;
	this.assessment = 'PASS';
	this.pages = [];
	this.robots = '';
	this.robotsInitialized= false;
	
	this.getFinalAssessment = function(){
		
		if(this.assessment == domains.constants['mixedActive'] || this.assessment == domains.constants['mixedPassive'] || this.assessment == domains.constants['connectionError'] ){
			return this.assessment;
		}else{
			var statusCount = { 'pass': 0, 'noValidResponse': 0, 'redirect': 0};
			this.pages.forEach(function (page){
				if(page.httpStatus == 200){
					statusCount['pass'] ++;
				}else if(page.status == domains.constants['noValidResponse']){
					statusCount['noValidResponse'] ++;
				}else if(page.status == domains.constants['redirect']){
					statusCount['redirect'] ++;
				}
			});
			
			if(statusCount['pass']){
				return domains.constants['pass'];
			}else if(statusCount['redirect'] == this.pages.length && this.pages.length !== 0){
				return domains.constants['redirect'];
			}else if(statusCount['noValidResponse']){
				return domains.constants['noValidResponse'];
			}else{
				return domains.constants['undefined'];
			}
			
		}
	}

};
util.inherits(DomainConstructor, events.EventEmitter);


var PageConstructor= function(url) {
	this.url = url;
	this.httpStatus = '';
	this.hasUnsecureBase = false;
	this.redirectedTo = '';
	this.message = '';
	this.status = false;
	this.passiveMixedContent = [];
	this.activeMixedContent = [];
};


//*************INIT**************//
process.stdin.setEncoding('utf8');
log.init(settings.outputFolder, settings.outputDebugLog, settings.outputDebugToConsole);
log.write('Log Start');



//*************MAIN*************//
if(process.argv[2]){
	startDomain(process.argv[2]);
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
				startDomain(command.substr(3, command.length-3));
				progressRefreshInterval = setInterval(trackProgress, 500);
			}
		}else{
			switch (command){
				case 'exit':
					log.end();
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

//TODO - Improve exception handling --> Need to finish writing the debug log before closing if possible.


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

function startDomain(url, redirectCount){
	
	if(typeof(redirectCount) == 'undefined'){redirectCount = 0;}

	//TODO - Should probably switch to using the native URL module of NodeJS to parse the URL
	url = urlTools.removeProtocol(url);
	var baseUrl = urlTools.getDomain(url.replace(/^(www\d?\.)/, ''));
	
	if(domains.length == 0){
		domains.baseUrl = baseUrl;
	}
	
	var matchedDomain = false;
	var wwwNewVariant = false;
	domains.forEach(function(existingDomain){
		if(existingDomain.url == urlTools.getDomain(url)){
			matchedDomain = existingDomain;
		}else{
			if(existingDomain.url == baseUrl){
				wwwNewVariant = true;
			}
		}
	});
	
	if(matchedDomain){
		if(urlTools.isNotIn(matchedDomain.pages, url, 'url')){
			log.write('Domain already in list and page is new. Domain: '+matchedDomain.url+' Page URL: '+ url);
			scheduleCrawl(matchedDomain, url, 0, redirectCount); 
		}else{
			log.write('Domain already in list and page is not new. Skipping. Domain: '+matchedDomain.url+' Page URL: '+ url);
		}
	}else{
		var newDomains = [];
		if(settings.checkWWW){
			if(wwwNewVariant == false){
				newDomains.push(baseUrl);
				newDomains.push('www.' + baseUrl);
			}
			
			if(url.match(/^(www\d\.)/)){ 
				newDomains.push(urlTools.getDomain(url));
			}
		}else{
			newDomains.push(urlTools.getDomain(url));
		}
		
		newDomains.forEach(function(newDomainUrl){
			
			var domain = new DomainConstructor(newDomainUrl);
			domains.push(domain);
			log.write('starting domain ' + domain.url);
			getRobotsTxt(domain, 'https', function(){
				scheduleCrawl(domain, newDomainUrl, 0, redirectCount);
				if(url.match(new RegExp('^'+newDomainUrl)) && ! url.match(new RegExp('^'+newDomainUrl+'/?$'))){ 
					log.write('matched sample page '+url+ ' to domain ' + domain.url);
					scheduleCrawl(domain, url, 0, redirectCount); 
				}
			});
		});

		//TODO - Discover subdomains from search engines and call crawlpage on them
	}
}

function getRobotsTxt(domain, protocol, callback){
	
	if(settings.bypassRobotsTxt){
		domain.robotsInitialized = true;
		callback();
	}else{
		var initialize = function(){
			domain.robotsInitialized = true;
			domain.activeTests --;
			callback();
			domain.emit('robotsInitialized');
		}
		var retryHTTP = function(){
			if(protocol == 'https'){
				domain.activeTests --;
				getRobotsTxt(domain, 'http', callback);
			}else{
				initialize();
			}
		}
		var processResponse = function(res){
			if(res.statusCode == 200){
				log.write('Robots.txt found for ' + domain.url);
				res.on('data', function(body){ 
					domain.robots = domain.robots + body; 
				});
				res.on('end', function(){
					domain.robots = robotsParser(robotsUrl, domain.robots);
					log.write('Parsed robots.txt for ' + domain.url);
					initialize();
				});
			}else{
				log.write('Robots.txt NOT found at '+ robotsUrl +'- Status code: ' + res.statusCode);
				retryHTTP();
			}
		}
		
		var robotsUrl = protocol + '://' + domain.url + '/robots.txt';
		domain.activeTests ++;
		
		if(protocol == 'https'){
			https.get(robotsUrl , function(res) {
				processResponse(res);
			}).on('error', function(e) {
				log.write('Error while fetching robots.txt over HTTPS: ' + e.message + ' for domain : ' + domain.url);
				retryHTTP();
			});
		}else{
			http.get(robotsUrl , function(res) {
				processResponse(res);
			}).on('error', function(e) {
				log.write('Error while fetching robots.txt over HTTP: ' + e.message + ' for domain : ' + domain.url);
				initialize();
			});
		}
	}
	
}


function scheduleCrawl(domain, url, depth, redirectCount){

	if(domain.robotsInitialized == false){
		domain.on('robotsInitialized', function() { scheduleCrawl(domain, url, depth, redirectCount); });
	}else{
		url = urlTools.removeProtocol(url);
		if(settings.bypassRobotsTxt == false && domain.robots && domain.robots.isDisallowed('https://' + url)){
			log.write('Rejected disallowed page : ' + url);
			//TODO - Keep track of rejected pages and include the total number of unique pages in report summary
		}else{
			if(urlTools.fileFormatOk('https://' +url) == false){
				log.write('Rejected disallowed file format for link: '+ url);
			}else{
				if(typeof(scheduleCrawl.previousCrawlTime) == 'undefined'){
					scheduleCrawl.previousCrawlTime = 0;
				}

				var isNewPage = true;
				domain.pages.forEach(function(alreadyDone){
					if(alreadyDone.url == url){
						isNewPage = false;
					}
				});
				if(!isNewPage){
					log.write('skipping page - already done: '+ url);
				}else{
					domain.activeTests ++;
					var page = new PageConstructor(url);
					domain.pages.push(page);
					if(settings.rateLimit > 0){
						var now = Date.now();
						if(now - scheduleCrawl.previousCrawlTime > settings.rateLimit){
							scheduleCrawl.previousCrawlTime = now;
							crawl(domain, page, depth, redirectCount);
						}else {
							var delay = scheduleCrawl.previousCrawlTime - now + settings.rateLimit;
							log.write('delaying crawl by '+delay+'ms for ' + url);
							scheduleCrawl.previousCrawlTime = scheduleCrawl.previousCrawlTime + settings.rateLimit;
							setTimeout(function () { crawl(domain, page, depth, redirectCount) }, delay);
						}
					}else{
						crawl(domain, page, depth, redirectCount);
					}
				}
			}
		}
	}
}

function crawl(domain, page, depth, redirectCount){
//TODO - Need to check for cookies and write that in the rule (can we check programatically if the cookies work over https? if not let the user test them, but tell him on which domains cookies are used)
//TODO - Check if content is in <Noscript> tag... many sites have http icons in noscript but everything else https... so we should probably treat them differently.
	
	log.write('starting crawl (depth: '+depth+' Redirects: '+ redirectCount + ') for ' + page.url);
	if(depth == settings.recursionLimit){
		log.write('max depth reached - <a> links on page will be ignored');
	}

	https.get('https://'+page.url, function(res) {
		log.write('Got response ' + res.statusCode + ' from ' + page.url);
		page.httpStatus = res.statusCode;

		if(res.statusCode == 200){
			res.on('data', function(body){ scrape(domain, page, body, depth); });
			res.on('end', function(){
				log.write('Finished url ' + page.url);
				domain.activeTests --;
				if(domain.activeTests == 0){
					log.write('Finished domain ' + domain.url + '. Final Assessment is ' + domain.getFinalAssessment() );
				}
			});
		}else if(res.statusCode > 300 && res.statusCode < 400){
			domain.activeTests --;
			page.status = domains.constants['redirect'];
			if(redirectCount < settings.redirectLimit){
				if(typeof(res.headers['location'] != 'undefined') && res.headers['location'] != ''){
					log.write('Redirecting from '+ page.url + ' to ' + res.headers['location']);
					page.redirectedTo = res.headers['location'];
					if(urlTools.isRelative(res.headers['location'])){
						var link = domain.url + '/' + res.headers['location'].replace(/^\//, '');
						scheduleCrawl(domain, link, depth, ++redirectCount);
					}else if(urlTools.isSameDomain(res.headers['location'], page.url)){
						scheduleCrawl(domain, res.headers['location'], depth, ++redirectCount);
					}else if(settings.ignoreSubDomains == false && urlTools.isSubDomain(domains.baseUrl, res.headers['location'])){
						startDomain(res.headers['location'], ++redirectCount);
					}
				}else{
					log.write('Redirect requested but no location found in headers for page: '+ page.url);
				}
			}else {
				log.write('Too many redirects (' + settings.redirectLimit +') for page: '+ page.url);
			}
		}else{
			log.write('HTTP Status code ' + res.statusCode + ' is not supported');
			domain.activeTests --;
			page.status = domains.constants['noValidResponse'];
		}
		
	}).on('error', function(e) {
		//should we catch certificate errors specifically?
		page.status = domains.constants['connectionError'];
		domain.activeTests --;
		if(depth == 0){
			domain.assessment = domains.constants['connectionError'];
		}
		log.write('Error in https.get() : ' + e.message + ' for page : ' + page.url);
		page.httpStatus = 'Error';
		page.message = e.message;
	});
}

function scrape (domain, page, body, depth){
		
		var $ = cheerio.load(body.toString());
		
		if(depth < settings.recursionLimit){
			$('a').each(function(i, elem) {
				var link = $(this).attr('href');
				var match = false;
				if(typeof(link) != 'undefined' && link != ''){
					if(urlTools.isSameDomain(domain.url, link)){
						match = true;
					}else if(urlTools.isRelative(link)){
						link = domain.url + '/' + link.replace(/^\//, '');
						match = true;
					}
					if(match){
						scheduleCrawl(domain, link, depth+1, 0);
					}else if(urlTools.isSubDomain(domains.baseUrl, link)){
						if(settings.ignoreSubDomains == false){
							log.write('Found Subdomain ' + link + ' of base domain ' + domains.baseUrl);
							startDomain(link);
						}
					}else{
						log.write('Link does not match domain or is not valid; skipping. Link: ' + link + ' In page: ' + page.url);
					}
				}
			});
		}
		
		//references - https://developer.mozilla.org/en-US/docs/Security/MixedContent
		testElements($, 'base', 'href', domain, page); //<base> needs to be tested first as all relative links depend on it
		testElements($, 'img', 'src', domain, page);
		testElements($, 'audio', 'src', domain, page);
		testElements($, 'video', 'src', domain, page);
		testElements($, 'link', 'href', domain, page);
		testElements($, 'script', 'src', domain, page);
		testElements($, 'iframe', 'src', domain, page);
		testElements($, 'object', 'archive', domain, page);
		testElements($, 'object', 'codebase', domain, page);
		testElements($, 'object', 'data', domain, page);
		testElements($, 'object', 'classid', domain, page);
		testElements($, 'object', 'usemap', domain, page);
		//object element is used for java appelets & shockwave & others
		//Doc: http://www.htmlquick.com/reference/tags/object.html
		
	}
	
function testElements($, selector, attribute, domain, page){
	var link = '';
	var httpMatch = false;
	$(selector).each(function(i, elem) {
		link = $(this).attr(attribute);
		if(typeof(link) != 'undefined' && link != ''){
			if(link.match(/^http:\/\//) || (page.hasUnsecureBase && urlTools.isRelative(link))){
				var newAssessment = '';
				switch(selector){
					case 'img':
					case 'audio':
					case 'video':
						if(urlTools.isNotIn(page.passiveMixedContent, link)){page.passiveMixedContent.push(link)};
						newAssessment = domains.constants['mixedPassive'];
						break;
					case 'link':
						//https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types
						var rel = $(this).attr('rel');
						if(typeof(rel) != 'undefined'){
							if(rel.match(/icon|apple-touch-icon|apple-touch-icon-precomposed|image_src/)){
								if(urlTools.isNotIn(page.passiveMixedContent, link)){page.passiveMixedContent.push(link)};
								newAssessment = domains.constants['mixedPassive'];
							}else if(rel.match(/stylesheet/)){
								if(urlTools.isNotIn(page.activeMixedContent, link)){page.activeMixedContent.push(link)};
								newAssessment = domains.constants['mixedActive'];
							}
						}
						break;
					case 'script':
					case 'iframe':
					case 'object':
						if(urlTools.isNotIn(page.activeMixedContent, link)){page.activeMixedContent.push(link)};
						newAssessment = domains.constants['mixedActive'];
						break;
					case 'base':
						page.hasUnsecureBase = true;
						break;
				}
				
				if(domain.assessment == domains.constants['pass'] && newAssessment == domains.constants['mixedPassive']){
					domain.assessment = domains.constants['mixedPassive'];
				}else if((domain.assessment == domains.constants['pass'] || domain.assessment == domains.constants['mixedPassive']) && newAssessment == domains.constants['mixedActive']){
					domain.assessment = domains.constants['mixedActive'];
				}
			}else if(selector == 'script'){
				//TODO - Could also check if scripts do XMLHttpRequest through http
				//TODO - Need to scan the content of CSS files for http urls (background-image, @font-face, etc...) 
			}
		}
	});
}

function trackProgress(){
	var showMaxDomains = 17;
	var activeTestsCount = 0;
	var activeDomainsCount = 0;
	var doneDomainsCount = 0;
	var pagesDone = 0;
	var pass = 0;
	var fail = 0;
	
	domains.forEach(function(domain){
		pagesDone = pagesDone + domain.pages.length;
		activeTestsCount = activeTestsCount + domain.activeTests;
		if(domain.activeTests == 0){
			doneDomainsCount ++;
		}else{
			activeDomainsCount  ++;
		}
		if(domain.assessment == domains.constants['pass'] || domain.assessment == domains.constants['mixedPassive']){
			pass ++;
		}else{
			fail ++;
		}
	});

	if(settings.outputDebugToConsole == false){
		
		if(typeof(trackProgress.blink) == 'undefined' || trackProgress.blink == ''){
			trackProgress.blink = 'Still working...';
		}else{
			trackProgress.blink = '';
		}
		
		clearConsole();
		console.log('SSL-Yeah - Progress - ' + pagesDone + ' pages requested so far. ' + trackProgress.blink);
		console.log('----------------------------------------------------------------------------');
		if(domains.length < showMaxDomains){
			domains.forEach(function(domain){
				console.log(domain.url + ' - ' + domain.activeTests + ' pages in queue - ' + domain.getFinalAssessment());
			});
		}else{
			var shownCount = 0;
			domains.forEach(function(domain){
				if(domain.activeTests > 0 && shownCount  < showMaxDomains){
					shownCount  ++;
					console.log(domain.url + ' - ' + domain.activeTests + ' pages in queue - ' + domain.getFinalAssessment());
				}
			});
			console.log('');
			console.log('+ ' + (activeDomainsCount - shownCount) + ' other domains in test');
			console.log('+ ' + doneDomainsCount + ' domains done');
			console.log('Results so far ==> Pass, Warn, N/A: ' + pass + ' Fail: ' + fail);
		}
	}
	
	if(activeTestsCount == 0){
		clearInterval(progressRefreshInterval);
		console.log('');
		console.log('Crawl done... Writing to file...');
		log.write('Crawl Done');
		if(settings.outputReport){
			log.write('Writing Report');
			report.write(settings.outputFolder, domains, 
				function(){
					log.write('Report written');
					if(rule.writing == false){ allDone(); }
				});
		}
		if(settings.outputRule){
			log.write('Writing Rule');
			rule.write(settings.outputFolder, domains, 
				function(){
					log.write('Rule written');
					if(report.writing == false){ allDone(); }
				});
		}
	}
	//TODO - Add blinking progress indicator for when no info is updated (can be long when a site is timing out)
}

function clearConsole(){
	if (process.platform == 'win32'){
		process.stdout.write('\033c'); 
	}else{
		process.stdout.write('\033[2J'); //needs testing on linux
	}
}

function allDone(){
	log.write('All Done');
	console.log('All Done');
	log.end();
	process.exit(0);
}