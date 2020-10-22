const CookieCrawler = require('./cookie-crawler');

let myCrawler = new CookieCrawler('https://www.also-international.eu/ec/cms5/en_2420/2420/index.jsp', 2);
myCrawler.startCrawl();