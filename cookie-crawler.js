const {Builder, By, Key, until} = require('selenium-webdriver');
const ChromeDriver = require('selenium-webdriver/chrome');
const UrlQueueManager = require('./url-queue-manager');

class CookieCrawler {

    constructor(startUrl, maxCrawlDepth) {
        this._startUrl = startUrl;
        this._maxCrawlDepth = maxCrawlDepth || 0;
        this._domain = this._getDomainOf(startUrl);
        this._urlQueue = new UrlQueueManager(this._domain, maxCrawlDepth);
        this._foundCookies = {};
        this._onUrlVisit = [];
        this._afterUrlVisit = [];
    }

    /**
     * Start the crawl, using the startUrl and maxCrawlDepth set in constructor
     * @returns a dictioniary of cookies when done
     */
    async startCrawl() {
        this._urlQueue.enqueue(this._startUrl, 0);


        let driver = await new Builder().forBrowser('chrome')
            .setChromeOptions(new ChromeDriver.Options().headless().addArguments('--log-level=3'))
            .build();
        driver.manage().deleteAllCookies();

        try {
            while(this._urlQueue.hasNext()) {
                let nextUrlData = this._urlQueue.next();
                await this._visitUrl(driver, nextUrlData.url, nextUrlData.crawlDepth);
            }
            return this._foundCookies;
        } finally {
            await driver.quit();
        }
    }

    /**
     * Calls callbackFn before the URL is being visited/scraped
     * @param {(url, crawlDepth) => void} callbackFn
     */
    onUrlVisit(callbackFn) {
        this._onUrlVisit.push(callbackFn);
    }

    /**
     * Calls callbackFn after the url has been scraped, with a dictionary of cookies that have been found so far
     * @param {(url, crawldepth, cookies) => void} callbackFn 
     */
    afterUrlVisit(callbackFn) {
        this._afterUrlVisit.push(callbackFn);
    }

    async _visitUrl(driver, url, currentCrawlDepth) {
        // Notify onUrlVisit subscribers
        this._onUrlVisit.forEach(fn => fn(url, currentCrawlDepth));

        // Go to url
        await driver.get(url);

        // Gather cookie data
        let cookies = await driver.manage().getCookies();
        for(let cookie of cookies) {
            if(!(cookie.name in this._foundCookies)) {
                this._foundCookies[cookie.name] = {
                    sourceUrl: url,
                    domain: cookie.domain,
                    expiry: cookie.expiry,
                    value: cookie.value };
            }
        }

        // Extract and enqueue URLs
        if(currentCrawlDepth < this._maxCrawlDepth) {
            let urls = await this._extractUrls(driver);
            urls.forEach(url => this._urlQueue.enqueue(url, currentCrawlDepth + 1));
        }

        // Notify afterUrlVisit Subscribers
        this._afterUrlVisit.forEach(fn => fn(url, currentCrawlDepth, this._foundCookies));
    }

    async _extractUrls(driver) {
        // Extract all url strings
        let hrefElements = await driver.findElements(By.css("a[href]"));
        return Promise.all(hrefElements.map(e => e.getAttribute('href')));
    }

    _getDomainOf(url) {
        // Get everything from 'http://' or 'https://' until the next '/'
        let domain = '';
        for(let prefix of ['http://', 'https://']) {
            if(url.startsWith(prefix)) {
                domain += prefix;
                url = url.replace(prefix, '');
                break;
            }
        }
        domain += url.substring(0, url.indexOf('/') + 1);
        return domain;
    }
}

module.exports = CookieCrawler