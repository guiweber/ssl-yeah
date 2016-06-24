const EventEmitter = require('events');
const constants = require('../modules/constants.js');

class Host extends EventEmitter {
	constructor(crawler, url) {
		super();
		this.activeTests =  0;
		this.url = url;
		this.assessment = 'PASS';
		this.pages = [];
		this.robots = '';
		this.robotsInitialized= false;
	}

	getFinalAssessment(){
		if(this.assessment == constants['mixedActive'] || this.assessment == constants['mixedPassive'] || this.assessment == constants['connectionError'] ){
			return this.assessment;
		}else{
			var statusCount = { 'pass': 0, 'noValidResponse': 0, 'redirect': 0};
			this.pages.forEach(function (page){
				if(page.httpStatus == 200){
					statusCount['pass'] ++;
				}else if(page.status == constants['noValidResponse']){
					statusCount['noValidResponse'] ++;
				}else if(page.status == constants['redirect']){
					statusCount['redirect'] ++;
				}
			});

			if(statusCount['pass']){
				return constants['pass'];
			}else if(statusCount['redirect'] == this.pages.length && this.pages.length !== 0){
				return constants['redirect'];
			}else if(statusCount['noValidResponse']){
				return constants['noValidResponse'];
			}else{
				return constants['undefined'];
			}
		}
	}
}

module.exports = Host;
