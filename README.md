# SSL-Yeah!
SSL-Yeah is a simple HTTPS verification tool for websites and ruleset creator for HTTPS Everywhere.

## Getting Started

1. Install NodeJS on your system (http://nodejs.org/)
2. Download SSL-Yeah
3. `npm install` from the SSL-Yeah Folder.
3. Run the script!

## Usage

#### Launching via command line
The easiest way to try out ssl-yeah is to launch it from the command line.
```js
node ssl-yeah myhost.com
```

#### Import ssl-yeah in your application
For more flexibility, you may also import ssl-yeah into your application.
```js
var SSLYeah = require('ssl-yeah');
var crawler = new SSLYeah();
crawler.on('crawlDone', function(){...});
crawler.startCrawl('myhost.com');
```

### Output
By default, all files are written to `./output`. In CLI mode,  detailed test report and an HTTPS Everywhere ruleset will be output by default. In library mode, no files are created by default.

Make sure to test the ruleset thoroughly before publishing it. It is also a good idea to cross-reference the ruleset with the detailed report in order to manually fine-tune the rules.


## Limitations

- The input is not thoroughly checked for malformed or invalid urls
- No detection of servers that serve completely different pages for http and https
- No verification of secure cookies yet
- No verification of XMLHttpRequests yet

## Dependencies

The following dependencies are included in SSL-Yeah:
- A modified version of Robots-Parser (https://github.com/samclarke/robots-parser)
