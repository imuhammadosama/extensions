

class ProxyApp {
    constructor() {
        this.storage = STORAGE;
        this.rateInterval = null;

        this.queue = [];
        this.queueProcessorReady = false;
        this.version = chrome.runtime.getManifest().version;

        this.links_cache = {};
        this.links_page = {};
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (sender && sender.url && sender.url.indexOf('pac.js') > -1) {
                console.log('message from pac script', msg);

                return true;
            }
            if (msg['action'] === 'getConfig') sendResponse(this.storage);
            if (msg['action'] === 'getIP') sendResponse(this.currentIP);
            if (msg['action'] === 'optout') {
                this.optouted = this.storage.optouted = true;
                console.log('optouted');
                this.saveStorage();
                return true;
            }
            return true;
        });

        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            switch (msg.action) {
                case 'connect':
                    if(msg.country_code) {
                        this.storage.country = msg.country_code;
                    }
                    this.storage.vpnOn = true;
                    this.storage.isConnecting = false;
                    this.setProxy();
                    console.log('connect');
                    this.saveStorage();
					//chrome.browserAction.setPopup({popup: chrome.extension.getURL("/popup.html?type=1") });
                    break;

                case 'disconnect':
                    this.storage.vpnOn = false;
                    this.storage.isConnecting = false;
                    chrome.runtime.sendMessage({
                        action: 'disable'
                    });
					this.getCurrentRemoteIP();
                    this.setProxy();
                    console.log('disconnect');
                    this.saveStorage();
					//chrome.browserAction.setPopup({popup: chrome.extension.getURL("/popup.html?type=0")});
                    break;
            }
        });


        this.filterRequestConfigured = false;
        this.proxyInitiated = false;
        this.lastProxyRotateTime = false;
        this.initStorage();
        this.initListeners();
        this.onStorageUpdate();
        this.optouted = false;
        this.environmentValidated = false;
        this.envDetected = false;
        this.statProcessorRun = false;


        this.currentProxy = '';
        this.failedProxyList = [];
        this.validatedProxyList = [];
        this.currentIP = '';

        this.vpnBlackListDomains = [
            'itopvpn-plugin.com'
        ];
    }

    get params() {
        return this.storage.params;
    }

    onStorageUpdate() {
        chrome.storage.onChanged.addListener(changes => {
            console.log('storage.onChanged', changes);
            for (let key in changes) {
                //fix for firefox version
                if (changes[key].oldValue == changes[key].newValue)
                    continue;

                if (key === 'vpnOn' || key === 'country') {
                    this.storage[key] = changes[key].newValue;
                    this.setProxy();
                } else {
                    this.storage[key] = changes[key].newValue;
                }
            }
        });
    }

    processQueue() {
        console.log("check for task in queue", this.queue);
        while (this.queue.length > 0) {
            var qRow = this.queue.shift();
            console.log("Process task from queue", qRow);

            if (!qRow.type || qRow.type != 'action') {
                return true;
            }
                if (qRow.action == 'install' || qRow.action == 'update') {
					var gotoURL = 'https://goto.itopvpn.com/appgoto?name=itopext&ver='+this.version + '&lan=&to=installbest&ref=exinstall&insur=chextminor4';
                    chrome.tabs.create({
                        url:gotoURL
                    });
                }
				//browser.browserAction.getPopup(chrome.extension.getURL('popup.html'));
				//browser.browserAction.openPopup();
        }
    }

    setUninstallUrl() {
		var Uninstall='https://goto.itopvpn.com/appgoto?name=itopext&ver='+this.version + '&lan=&to=mainbest&ref=uninstall&insur=chextminor4';
		chrome.runtime.setUninstallURL(Uninstall)
    }

    initListeners() {
        chrome.runtime.onInstalled.addListener((details) => {
            this.queue.push({
                type: 'action',
                action: details.reason,
            });
            if (this.queueProcessorReady) {
                this.processQueue();
            }
            console.log("Add task in queue", this.queue);
        });
		
    }


    initStorage() {
        chrome.storage.local.get(this.storage, storage => {

            console.log('saved storage', storage);
            this.storage = storage;

            this.setProxy();

            if (storage.uid) {
                this.uid = storage.uid;
            } else {
                this.uid = this.storage.uid = this.generateUUID();
                console.log("generated UUID", this.uid);
            }
            if (storage.mTime === null) {
                this.storage.mTime = (new Date()).getTime();
            }
            if (storage.lTime === null) {
                this.storage.lTime = 0;
            }
            if (storage.envDetected)
            {
                this.envDetected = storage.envDetected;
            }
            if (storage.optouted == true) {
                this.optouted = true;
            }
            if(!this.storage.dateInstall) {
                this.storage.dateInstall = Date.now();
            }

            this.storage.appLoads++;
            this.saveStorage();

            this.queueProcessorReady = true;

            this.setUninstallUrl();
            this.processQueue();

            this.updateServers();
        });
    }

    saveStorage() {
        console.log('saveStorage', this.storage);
        chrome.storage.local.set(this.storage);
    }

    updateServers() {
        console.log("local storage data", this.storage);

        let now = (new Date()).getTime();
        let diff = now - this.storage.mTime;
        this.storage.mTime = now;
        if (diff < 1200000) {
            this.storage.lTime += diff;
        } else {
            console.log("time diff was too long, update only mTime");
        }
        this.saveStorage()


        const devConfigUrl = localStorage.devConfigUrl;
        const url = devConfigUrl ? devConfigUrl : chrome.extension.getURL('/js/vpn.json');
		$.ajax({
			url ,
			type:"GET",
			dataType:"json",
			success: res=>{
                console.log("Fetched servers", res);


                for (let i in res) {
                    this.storage[i] = res[i];
                }

                if(this.storage.country == 'init') {
                    let countries = this.storage.locations;
                    let randomCountry = countries[Math.round(Math.random() * (countries.length - 1))];
                    this.storage.country = randomCountry.country_code;
                }

                for (let i = 0; i < res.locations.length; i++) {
                    for (let j = 0; j < res.locations[i].nodes.length; j++) {
                        let item = res.locations[i].nodes[j];

                        let existsDuplicate = false;
                        for (let k = 0; k < this.validatedProxyList.length; k++) {
                            if (this.validatedProxyList[k] == `${item.schema} ${item.ip}:${item.port}`) {
                                existsDuplicate = true;
                            }
                        }
                        if (!existsDuplicate) {
                            this.validatedProxyList.push(`${item.schema} ${item.ip}:${item.port}`);
                        }
                    }
                }
                console.log("this failedProxyList", this.failedProxyList)

                console.log("Updated proxy config", this.storage);
                this.saveStorage();
            }
		})

        let _self = this;
        setTimeout(function () {
            console.log('fetch servers by time');
            _self.updateServers();
        }, 7200000);

    }


    randomizeProxyStr(proxyList) {
        const copyProxyArr = proxyList.slice();
        const newProxyArr = [];

        while (copyProxyArr.length) {
            const i = Math.floor(Math.random() * copyProxyArr.length);
            newProxyArr.push(copyProxyArr[i]);
            copyProxyArr.splice(i, 1);
        }

        return newProxyArr.join('; ');
    }

    randomProxy(proxyList) {
        let proxyListCopy = proxyList.slice();
        if (this.failedProxyList)
            for (let i in this.failedProxyList) {
                if (proxyListCopy.indexOf(this.failedProxyList[i]) > -1) {
                    console.log("proxy ", this.failedProxyList[i], "found in blacklist, remove it and look another one", proxyListCopy);
                    proxyListCopy.splice(proxyListCopy.indexOf(this.failedProxyList[i]), 1);
                }
            }
        console.log("final proxy list for random", proxyListCopy);
        if (proxyListCopy.length < 1) {
            console.log("there is no ip to set as proxy");
            return false;
        }
        const i = Math.floor(Math.random() * proxyListCopy.length);
        return proxyListCopy[i];
    }

    setProxy() {
        let data;

        this.currentIP = null;

        if (this.storage.vpnOn) {
            this.storage.isConnecting = true;
            this.saveStorage();
            this.currentProxy = this.randomProxy(this.activeLocationProxyList);
            if (!this.currentProxy) {
                console.log("No proxy to connect");

                this.storage.vpnOn = false;
                this.storage.isConnecting = false;
                this.saveStorage();

                chrome.runtime.sendMessage({
                    action: 'disconnected',
                });
            }
            console.log("selected proxy server is", this.currentProxy);
            data = `function FindProxyForURL(url, host) { 
            let blackList = ${JSON.stringify(this.vpnBlackListDomains)};  
            for (let i = 0; i < blackList.length; i++){
                if (shExpMatch(host, blackList[i])) return "DIRECT;";
            }
            
            return "` + this.currentProxy + `; "; }`;
        }
        this.setBadge();

        console.log("final pac script", data);

        var proxyErrorSent = false;

        chrome.proxy.settings.clear({
            scope: 'regular'
        }, () => {
            if (!this.storage.vpnOn) {
                this.getCurrentRemoteIP((x) => {
                    chrome.runtime.sendMessage({
                        action: 'gotIP',
                        data: {
                            disabled: true,
                            store: this.storage,
                            ip: this.currentIP
                        }
                    });
                }, (x) => {
                    chrome.runtime.sendMessage({
                        action: 'gotIP',
                        data: {
                            disabled: true,
                            store: this.storage,
                            ip: '',
                            country: ''
                        }
                    });
                });

                return;
            }

            let requests = [];
            chrome.webRequest.onAuthRequired.addListener(function (requestDetails) {
                if (requests.indexOf(requestDetails.requestId) !== -1) {
                    return {
                        cancel: true
                    };
                }
                requests.push(requestDetails.requestId);
                return {
                    authCredentials: {
                        username: 'atnkwz1cxclqe1rv',
                        password: 'h46zo017twugt8qq'
                    }
                };
            }, { urls: ['http://*/*', 'https://*/*'] }, ['blocking']);

            chrome.webRequest.onCompleted.addListener(function (requestDetails) {
                let index = requests.indexOf(requestDetails.requestId);
                if (index > -1) {
                    requests.splice(index, 1);
                }
            }, { urls: ['http://*/*', 'https://*/*'] });

            chrome.webRequest.onErrorOccurred.addListener(function (requestDetails) {
                let index = requests.indexOf(requestDetails.requestId);
                if (index > -1) {
                    requests.splice(index, 1);
                }
            }, { urls: ['http://*/*', 'https://*/*'] });

            const value = {
                mode: "pac_script",
                pacScript: {
                    data
                }
            };
            chrome.proxy.settings.set({
                value,
                scope: 'regular'
            }, () => {
                console.info('Proxy enabled');
                this.getCurrentRemoteIP((x) => {
                    if (this.storage.vpnOn) {
                        this.storage.prevCountry = this.storage.country;
                        this.storage.isConnecting = false;
                        this.saveStorage();
                        chrome.runtime.sendMessage({
                            action: 'connected'
                        });
						chrome.browserAction.setIcon({ path: chrome.extension.getURL('/images/icon_on.png') });
                    }

                    chrome.runtime.sendMessage({
                        action: 'gotIP',
                        data: {
                            ip: this.currentIP
                        }
                    });
                }, (x) => {
                    if (this.storage.vpnOn) {
						this.storage.vpnOn = false;
                        this.storage.prevCountry = this.storage.country;
                        this.storage.isConnecting = false;
                        this.saveStorage();
                        chrome.runtime.sendMessage({
                            action: 'gotIPError'
                        });
						chrome.browserAction.setIcon({ path:chrome.extension.getURL('/images/icon_off.png') });
                    }

                    /*chrome.runtime.sendMessage({
                        action: 'gotIP',
                        data: {
                            ip: '',
                            country: ''
                        }
                    });*/
                    // this.proxyConnectFailover();
                });
            });
            chrome.proxy.onProxyError.addListener((e) => {
                if(this.storage.isConnecting) {
                    this.storage.isConnecting = false;
                    this.saveStorage();
                }

                console.log('proxy error', e)

                if (navigator.onLine === false) {
                    console.log("Hey, its not a proxy failed, looks like browser is offline", navigator.onLine);
                    return;
                }

                if (!proxyErrorSent) {
                    console.log("Proxy error:",e);
                    proxyErrorSent = true;

                    this.proxyConnectFailover();
                }
				//chrome.browserAction.setIcon({ path: chrome.extension.getURL('/images/icon_off.png')});
            });
        });
    }

    proxyConnectFailover() {
        console.log("proxy connect failover");

        const now = (new Date()).getTime();
        if (this.lastProxyRotateTime && (now - this.lastProxyRotateTime) < 15000)
        {
            console.log("last proxy rotation was less 15 sec, keep config same");
            return;
        }

        if (this.isProxyWhiteListed()) {
            console.log("Proxy was whitelisted, so keep config with it");
        } else {
            console.log("current proxy looks down, try rotate it");
            this.blackListProxy();
            // this.setProxy();
            this.lastProxyRotateTime = now;
        }

        if(this.storage.isConnecting) {
            this.storage.isConnecting = false;
            console.log('connect failover')
            this.saveStorage();
        }
        chrome.runtime.sendMessage({
            action: 'gotIPError',
            data: {}
        });
    }

    blackListProxy() {
        if (this.currentProxy && this.failedProxyList.indexOf(this.currentProxy) == -1)
            this.failedProxyList.push(this.currentProxy);
    }

    whiteListProxy() {
        if (this.currentProxy && this.validatedProxyList.indexOf(this.currentProxy) == -1)
            this.validatedProxyList.push(this.currentProxy);
    }

    isProxyWhiteListed() {
        return (this.currentProxy && this.validatedProxyList.indexOf(this.currentProxy) > -1);
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    getCurrentRemoteIP(onSuccess, onFail) {
        console.log("request for current IP...");
        const url = 'https://www.itopvpn.com/api/ip-checker';
        const x = new XMLHttpRequest();
        x.open('GET', url, true);
        x.timeout = 10000;
        x.onload = () => {
            if (x.status !== 200 || !x.responseText) {
                this.storage.connectionInfo.code = '';
                this.storage.connectionInfo.country = this.storage.locations.find(l => l.country_code == this.storage.country).country_name;
                this.storage.connectionInfo.ip = '';
                console.log('geoip receive')
                this.saveStorage();
                onFail();
                return;
            };
            let json = JSON.parse(x.responseText);
            if (!json.data.ip) {
                console.error("invalid IP API response", x.responseText);
                return;
            }
            this.currentIP = json.data.ip;
            console.log("IP detected", this.currentIP, json);
            this.storage.connectionInfo.ip = json.data.ip;

            if(this.storage.vpnOn || this.storage.isConnecting) {
                this.storage.connectionInfo.code = json.data.country_code;//this.storage.country;
                if (this.storage.locations.length > 0) {
                    this.storage.connectionInfo.country = json.data.country;
					this.storage.connectionInfo.city = json.data.city;
                }
            } else {
                this.storage.connectionInfo.code = json.data.country_code;//json.country;
                if (this.storage.locations.length > 0) {
                    this.storage.connectionInfo.country = json.data.country;
					this.storage.connectionInfo.city = json.data.city;
                }
            }
            console.log('saved', this.storage)
            this.saveStorage();
            if (typeof onSuccess == 'function')
                onSuccess(json);
            return this.currentIP;
        };
        x.ontimeout = () => {
            console.log("ip detection timed out", x);

            if (typeof onFail == 'function'){
                this.storage.connectionInfo.code = '';
                this.storage.connectionInfo.country = this.storage.locations.find(l => l.country_code == this.storage.country).country_name;
                this.storage.connectionInfo.ip = '';
                console.log('ip detection timed out');
                this.saveStorage();
                onFail(x);
            }

        };
        x.onerror = () => {
            console.log("ip detection failed", x);
            x.abort();
            if (typeof onFail == 'function') {
                this.storage.connectionInfo.code = '';
                this.storage.connectionInfo.country = this.storage.locations.find(l => l.country_code == this.storage.country).country_name;
                this.storage.connectionInfo.ip = '';
                console.log('error abort');
                this.saveStorage();
                onFail(x);
            }
        };
        x.send();
    }

    setBadge() {
        if(!this.storage.vpnOn) {
/*			chrome.browserAction.setIcon({ path: chrome.extension.getURL('/images/icon_on.png') });
        } else {*/

			chrome.browserAction.setIcon({ path: chrome.extension.getURL('/images/icon_off.png') });
        }

    }

    setSafeBadge() {
        chrome.browserAction.setBadgeBackgroundColor({
            color: [5, 194, 143, 100]
        });
        if (!this.storage.vpnOn) {
            chrome.browserAction.setBadgeText({
                text: ''
            });
        }
    }


    getLocation(href) {
        return new URL(href)
    }

    get activeLocation() {
        return this.storage.locations.find(l => l.country_code === this.storage.country);
    }

    get activeLocationProxyList() {
        return this.activeLocation.nodes.map(item => `${item.schema} ${item.ip}:${item.port}`);
    }

    get now() {
        return (new Date()).getTime();
    }
}


const App = new ProxyApp();
