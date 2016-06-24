var libUrl = require('url');

//TODO - Several functions seem to require full URLS (url.parse needs a full url with the protocol to work. This should be noted somewhere.)

exports.isSubHost = function (baseUrl, url){
	var regSub = new RegExp('^(?:(?:https?://)|(?://))?(?:[^/@\\.]+\\.)+'+baseUrl);
	return regSub.test(url);
}

exports.isSameHost = function(url1, url2){
	baseUrl1 = getHost(removeProtocol(url1));
	baseUrl2 = getHost(removeProtocol(url2));

	if(baseUrl1 == baseUrl2){
		return true;
	}
	return false;
}

exports.isSamePage = function(url1, url2){
	//TODO - Remove trailing dash if any before comparing.
	url1 = libUrl.parse(url1);
	url2 = libUrl.parse(url2);
	url1 = url1.hostname + url1.pathname;
	url2 = url2.hostname + url2.pathname;
	return url1 == url2;
}

exports.isRelative = function(url){
	var regRelative = new RegExp('^(?!(?:https?://)|(?://)|(?:mailto:)|(?:ftps?://))');
	return (regRelative.test(url));
}


exports.isNotIn = function(list, item, property){
	var notIn = true;
	if(typeof(property) == 'undefined'){
		list.forEach(function(listItem){
			if(listItem == item){
				notIn = false;
			}
		});
	}else{
		list.forEach(function(listItem){
			if(listItem[property] == item){
				notIn = false;
			}
		});
	}
	return notIn;
}

exports.fileFormatOk = function(url){
	var regFormats = new RegExp('(\.(asp|aspx|cgi|fcgi|php|home|htm|html|xhtml|js|jsp))|(^[^\.]+)$');
	url = libUrl.parse(url);
	return regFormats.test(url['pathname']);
}

exports.removeProtocol = removeProtocol;
function removeProtocol(url){
	return url.replace(/^(https?:)?\/\//, '');
}


exports.getHost = getHost;
function getHost(url){
	return url.replace(/^(?:https?:)?(?:\/*)([^\/\?]*)(?:[\/\?].*)?/, '$1');
}
