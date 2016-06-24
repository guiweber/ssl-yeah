class Settings{
  constructor(){
    //**** Crawler Settings ****//
    this.recursionLimit = 1; //recursion limit for crawling pages - If set to 0, the main page will be analysed but links will not be loaded.
    this.redirectLimit = 3;  //recursion limit for redirects. If set to 0 redirects will not be loaded.
    this.bypassRobotsTxt = false; //set to true if you want to ignore robots.txt files. WARNING: Setting this to true may get your IP blocked by the host.
    this.rateLimit = 1000; //limits the rate at which pages are requested from the server (in milliseconds). Set to 0 for no limit. WARNING: Requesting pages to quickly may get your IP blocked by the host; although most websites won't complain if you select a faster setting than the default of 1000ms.
    this.ignoreSubDomains = false; //if set to true, sub domains will not be crawled.
    this.checkWWW = false; //is set to true, www and non www variants of a domain will be automatically checked.

    //TODO - Add a setting to ignore Robots.txt rate limit for domains where the rate limit is too high

    //**** Output Settings ****//
    this.outputFolder = 'output'; //This folder will be created at runtime and all output (logs, rules, reports) will be stored there.
    this.outputReport = true; //toggle the creation of a the detailed report.
    this.outputRule = true; //toggle the creation of the HttpsEverywhere rule.

    //**** Debug Settings ****//
    this.outputDebugToConsole = false; //Disables the CLI and outputs debug info to the console
  }
}
module.exports = Settings;
