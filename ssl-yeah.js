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
const EventEmitter = require('events');
var http = require('http');
var https = require('https');
var util = require('util');
var urlLib = require('url');

//Third Party Libs
var cheerio = require('cheerio');
var robotsParser = require('./modules/robots-parser/');

//Other libs
var log = require('./modules/logCreator.js');
var rule = require('./modules/ruleCreator.js');
var report = require('./modules/reportCreator.js');
var urlTools = require('./modules/urlTools.js');
const constants = require('./modules/constants.js');

//CLASSES
var Settings = require('./classes/Settings.js');
var Page = require('./classes/Page.js');
var Host = require('./classes/Host.js');

class SSLYeah extends EventEmitter{
	constructor() {
		super();
		this.hosts = [];
		this.settings = new Settings();
		this.previousCrawlTime = 0;
		this.writingRule = false;
		this.writingReport = false;
		this.baseHost = '';
		this.on('hostDone', this.isCrawlDone);
	}

	//TODO - Improve exception handling --> Need to finish writing the debug log before closing if possible.
	static logStart(outputFolder = 'output', toConsole = false){
		log.init(outputFolder, toConsole);
		log.write('Log Start');
	}

	static logEnd(){
		log.end();
	}

	static logWrite(msg){
		log.write(msg);
	}

	isCrawlDone(){
		var allDone = true;
		for(var i in this.hosts){
			if(this.hosts[i].activeTests > 0){
				allDone = false;
				break;
			}
		}
		if(allDone){
			this.emit('crawlDone');
		}
	}

	startCrawl(url, redirectCount = 0){
		//TODO - Should probably switch to using the native URL module of NodeJS to parse the URL
		url = urlTools.removeProtocol(url);
		var baseUrl = urlTools.getHost(url.replace(/^(www\d?\.)/, ''));

		if(this.hosts.length == 0){
			this.baseHost = baseUrl;
		}

		var matchedHost = false;
		var wwwNewVariant = false;
		this.hosts.forEach(function(existingHost){
			if(existingHost.url == urlTools.getHost(url)){
				matchedHost = existingHost;
			}else{
				if(existingHost.url == baseUrl){
					wwwNewVariant = true;
				}
			}
		});

		if(matchedHost){
			if(urlTools.isNotIn(matchedHost.pages, url, 'url')){
				log.write('Host already in list and page is new. Host: '+matchedHost.url+' Page URL: '+ url);
				scheduleCrawl(this, matchedHost, url, 0, redirectCount);
			}else{
				log.write('Host already in list and page is not new. Skipping. Host: '+matchedHost.url+' Page URL: '+ url);
			}
		}else{
			var newHosts = [];
			if(this.settings.checkWWW){
				if(wwwNewVariant == false){
					newHosts.push(baseUrl);
					newHosts.push('www.' + baseUrl);
				}

				if(url.match(/^(www\d\.)/)){
					newHosts.push(urlTools.getHost(url));
				}
			}else{
				newHosts.push(urlTools.getHost(url));
			}

			for(var i in newHosts){
				var host = new Host(this, newHosts[i], log);
				this.hosts.push(host);
				log.write('starting crawl of ' + host.url);
				var callback = function(){
					scheduleCrawl(this, host, newHosts[i], 0, redirectCount);
					if(url.match(new RegExp('^' + newHosts[i])) && ! url.match(new RegExp('^' + newHosts[i] + '/?$'))){
						log.write('matched sample page ' + url + ' to host ' + host.url);
						scheduleCrawl(this, host, url, 0, redirectCount);
					}
				}.bind(this);
				if(this.settings.bypassRobotsTxt){
					host.robotsInitialized = true;
					callback();
				}else{
					getRobotsTxt(host, 'https', callback);
				}
			};
			//TODO - Discover subhosts from search engines and call crawlpage on them
		}
	}

	writeRule(callback){
		log.write('Writing Rule');
		rule.write(this.settings.outputFolder, this, function(){
				log.write('Rule written');
				callback();
			});
	}

	writeReport(callback){
		log.write('Writing Report');
		report.write(this.settings.outputFolder, this, function(){
				log.write('Report written');
				callback();
			});
	}
}

module.exports = SSLYeah;

if(require.main === module){
	require('./modules/cli.js');
}

function getRobotsTxt(host, protocol, callback){
	var initialize = function(callback){
		host.robotsInitialized = true;
		host.activeTests --;
		callback();
		host.emit('robotsInitialized');
	};

	var retryHTTP = function(){
		if(protocol == 'https'){
			host.activeTests --;
			getRobotsTxt(host, 'http', callback);
		}else{
			initialize(callback);
		}
	};

	var response = function(res){
		if(res.statusCode == 200){
			log.write('Robots.txt found for ' + host.url);
			res.on('data', function(body){
				host.robots = host.robots + body;
			});
			res.on('end', function(){
				host.robots = robotsParser(robotsUrl, host.robots);
				log.write('Parsed robots.txt for ' + host.url);
				initialize(callback);
			});
		}else{
			log.write('Robots.txt NOT found at '+ robotsUrl +'- Status code: ' + res.statusCode);
			retryHTTP();
		}
	};

	var robotsUrl = protocol + '://' + host.url + '/robots.txt';
	host.activeTests ++;

	if(protocol == 'https'){
		https.get(robotsUrl, function(res) {
			response(res);
		}).on('error', function(e) {
			log.write('Error while fetching robots.txt over HTTPS: ' + e.message + ' for host : ' + host.url);
			retryHTTP();
		});
	}else{
		http.get(robotsUrl, function(res) {
			response(res);
		}).on('error', function(e) {
			log.write('Error while fetching robots.txt over HTTP: ' + e.message + ' for host : ' + host.url);
			initialize(callback);
		});
	}
}


function scheduleCrawl(crawler, host, url, depth, redirectCount){
	if(host.robotsInitialized == false){
		host.on('robotsInitialized', function() { scheduleCrawl(crawler, host, url, depth, redirectCount); });
	}else{
		url = urlTools.removeProtocol(url);
		if(crawler.settings.bypassRobotsTxt == false && host.robots && host.robots.isDisallowed('https://' + url)){
			log.write('Rejected disallowed page : ' + url);
			//TODO - Keep track of rejected pages and include the total number of unique pages in report summary
		}else{
			if(urlTools.fileFormatOk('https://' +url) == false){
				log.write('Rejected disallowed file format for link: '+ url);
			}else{
				var isNewPage = true;
				host.pages.forEach(function(alreadyDone){
					if(urlTools.isSamePage('https://' + alreadyDone.url, 'https://' + url)){
						isNewPage = false;
					}
				});
				if(!isNewPage){
					log.write('skipping page - already done: '+ url);
				}else{
					host.activeTests ++;
					var page = new Page(url);
					host.pages.push(page);
					if(crawler.settings.rateLimit > 0){
						var now = Date.now();
						if(now - crawler.previousCrawlTime > crawler.settings.rateLimit){
							crawler.previousCrawlTime = now;
							crawl(crawler, host, page, depth, redirectCount);
						}else {
							var delay = crawler.previousCrawlTime - now + crawler.settings.rateLimit;
							log.write('delaying crawl by '+delay+'ms for ' + url);
							crawler.previousCrawlTime = crawler.previousCrawlTime + crawler.settings.rateLimit;
							setTimeout(function () { crawl(crawler, host, page, depth, redirectCount) }, delay);
						}
					}else{
						crawl(crawler, host, page, depth, redirectCount);
					}
				}
			}
		}
	}
}

function crawl(crawler, host, page, depth, redirectCount){
//TODO - Need to check for cookies and write that in the rule (can we check programatically if the cookies work over https? if not let the user test them, but tell him on which hosts cookies are used)
//TODO - Check if content is in <Noscript> tag... many sites have http icons in noscript but everything else https... so we should probably treat them differently.

	log.write('starting crawl (depth: '+depth+' Redirects: '+ redirectCount + ') for ' + page.url);
	if(depth == crawler.settings.recursionLimit){
		log.write('max depth reached - <a> links on page will be ignored');
	}

	https.get('https://'+page.url, function(res) {
		log.write('Got response ' + res.statusCode + ' from ' + page.url);
		page.httpStatus = res.statusCode;

		if(res.statusCode == 200){
			res.on('data', function(body){ scrape(crawler, host, page, body, depth); });
			res.on('end', function(){
				log.write('Finished url ' + page.url);
				host.activeTests --;
				crawler.emit('pageDone', page);
				if(host.activeTests == 0){
					log.write('Finished host ' + host.url + '. Final Assessment is ' + host.getFinalAssessment() );
					crawler.emit('hostDone', host);
				}
			});
		}else if(res.statusCode > 300 && res.statusCode < 400){
			host.activeTests --;
			page.status = constants['redirect'];
			if(redirectCount < crawler.settings.redirectLimit){
				if(typeof(res.headers['location'] != 'undefined') && res.headers['location'] != ''){
					log.write('Redirecting from '+ page.url + ' to ' + res.headers['location']);
					page.redirectedTo = res.headers['location'];
					if(urlTools.isRelative(res.headers['location'])){
						var link = host.url + '/' + res.headers['location'].replace(/^\//, '');
						scheduleCrawl(crawler, host, link, depth, ++redirectCount);
					}else if(urlTools.isSameHost(res.headers['location'], page.url)){
						scheduleCrawl(crawler, host, res.headers['location'], depth, ++redirectCount);
					}else if(crawler.settings.ignoreSubDomains == false && urlTools.isSubHost(crawler.baseHost, res.headers['location'])){
						crawler.startCrawl(res.headers['location'], ++redirectCount);
					}else{
						log.write('Redirect did not match any redirect case and was ignored');
					}
				}else{
					log.write('Redirect requested but no location found in headers for page: '+ page.url);
				}
			}else {
				log.write('Too many redirects (' + crawler.settings.redirectLimit +') for page: '+ page.url);
			}
			crawler.emit('pageDone', page);
		}else{
			log.write('HTTP Status code ' + res.statusCode + ' is not supported');
			host.activeTests --;
			page.status = constants['noValidResponse'];
			crawler.emit('pageDone', page);
		}

	}).on('error', function(e) {
		//should we catch certificate errors specifically?
		page.status = constants['connectionError'];
		log.write('Error in https.get() : ' + e.message + ' for page : ' + page.url);
		page.httpStatus = 'Error';
		page.message = e.message;
		crawler.emit('pageDone', page);
		host.activeTests --;
		if(depth == 0){
			host.assessment = constants['connectionError'];
			crawler.emit('hostDone', host);
		}
	});
}

function scrape (crawler, host, page, body, depth){

		var $ = cheerio.load(body.toString());

		if(depth < crawler.settings.recursionLimit){
			$('a').each(function(i, elem) {
				var link = $(this).attr('href');
				var match = false;
				if(typeof(link) != 'undefined' && link != ''){
					if(urlTools.isSameHost(host.url, link)){
						match = true;
					}else if(urlTools.isRelative(link)){
						link = host.url + '/' + link.replace(/^\//, '');
						match = true;
					}
					if(match){
						scheduleCrawl(crawler, host, link, depth+1, 0);
					}else if(urlTools.isSubHost(crawler.baseHost, link)){
						if(crawler.settings.ignoreSubDomains == false){
							log.write('Found Subhost ' + link + ' of base host ' + crawler.baseHost);
							crawler.startCrawl(link);
						}
					}else{
						log.write('Link does not match host or is not valid; skipping. Link: ' + link + ' In page: ' + page.url);
					}
				}
			});
		}

		//references - https://developer.mozilla.org/en-US/docs/Security/MixedContent
		testElements($, 'base', 'href', host, page); //<base> needs to be tested first as all relative links depend on it
		testElements($, 'img', 'src', host, page);
		testElements($, 'audio', 'src', host, page);
		testElements($, 'video', 'src', host, page);
		testElements($, 'link', 'href', host, page);
		testElements($, 'script', 'src', host, page);
		testElements($, 'iframe', 'src', host, page);
		testElements($, 'object', 'archive', host, page);
		testElements($, 'object', 'codebase', host, page);
		testElements($, 'object', 'data', host, page);
		testElements($, 'object', 'classid', host, page);
		testElements($, 'object', 'usemap', host, page);
		//object element is used for java appelets & shockwave & others
		//Doc: http://www.htmlquick.com/reference/tags/object.html

	}

function testElements($, selector, attribute, host, page){
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
						newAssessment = constants['mixedPassive'];
						break;
					case 'link':
						//https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types
						var rel = $(this).attr('rel');
						if(typeof(rel) != 'undefined'){
							if(rel.match(/icon|apple-touch-icon|apple-touch-icon-precomposed|image_src/)){
								if(urlTools.isNotIn(page.passiveMixedContent, link)){page.passiveMixedContent.push(link)};
								newAssessment = constants['mixedPassive'];
							}else if(rel.match(/stylesheet/)){
								if(urlTools.isNotIn(page.activeMixedContent, link)){page.activeMixedContent.push(link)};
								newAssessment = constants['mixedActive'];
							}
						}
						break;
					case 'script':
					case 'iframe':
					case 'object':
						if(urlTools.isNotIn(page.activeMixedContent, link)){page.activeMixedContent.push(link)};
						newAssessment = constants['mixedActive'];
						break;
					case 'base':
						page.hasUnsecureBase = true;
						break;
				}

				if(host.assessment == constants['pass'] && newAssessment == constants['mixedPassive']){
					host.assessment = constants['mixedPassive'];
				}else if((host.assessment == constants['pass'] || host.assessment == constants['mixedPassive']) && newAssessment == constants['mixedActive']){
					host.assessment = constants['mixedActive'];
				}
			}else if(selector == 'script'){
				//TODO - Could also check if scripts do XMLHttpRequest through http
				//TODO - Need to scan the content of CSS files for http urls (background-image, @font-face, etc...)
			}
		}
	});
}
