#SSL-Yeah!
SSL-Yeah is a simple HTTPS verification tool for websites and ruleset creator for HTTPS Everywhere.

##Getting Started

1. Install NodeJS on your system (http://nodejs.org/)
2. Download SSL-Yeah
3. `npm install` from the SSL-Yeah Folder.
3. Run the script!

##Usage

###Settings
For the time being, the settings cannot be changed at runtime. You can configure SSL-Yeah prior to running the script in settings.js

###Launching
####Launching via CLI
You can call the script without arguments and follow the on-screen instructions.
```js
node ssl-yeah.js
```

####Launching with an argument
You can also pass a domain as argument when launching the program.
```js
node ssl-yeah.js mydomain.com
```

###Output
By default, a detailed test report and an HTTPS Everywhere ruleset will be output to /output

Make sure to test the ruleset thoroughly before publishing it. It is also a good idea to cross-reference the ruleset with the detailed report in order to manually fine-tune the rules.


##Limitations

- The input is not thoroughly checked for malformed or invalid urls
- No detection of servers that serve completely different pages for http and https
- No verification of secure cookies yet
- No verification of XMLHttpRequests yet

##Dependencies

The following dependencies are used in SSL-Yeah:
- Cheerio (https://github.com/cheeriojs/cheerio)
- Moment (https://github.com/moment/moment)
- A modified version of Robots-Parser (https://github.com/samclarke/robots-parser)
