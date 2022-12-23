	var _popup = document.getElementById("itopfast");
//	var selectList = document.getElementsByClassName("_selectlist");
	var storage = STORAGE;
	var CanConnect = true;
	var _lindex = -1;
	var _CountryCode ='';
	var SensitiveCountry = false;
	function SetLiFail(){
		
		$("#itopfast  ._selectlist li").eq(_lindex).removeClass("on");
		$("#itopfast").removeClass("fastSuccess"); // success ui
		$("#itopfast .note.n-close").addClass("nshow"); // hide note
		$("#itopfast .note.n-open").removeClass("nshow"); // show rate
		$("#itopfast .switch").find("._connect").html("NOT CONNECTED!");  // connected word
		$("#itopfast .protxt").html("Your ISP can slow down your network!");   // disconnected word
		$("#itopfast ._iptxt").html("Exposed IP: "); // ip word
		$("#itopfast .switch").find(".s-off").html("OFF");  // switch note
				
		_popup.getElementsByClassName("_ipbox")[0].style.visibility = 'Hidden'; 
		
		
	}

	function dialogShow() {
		$("#itopfast .fast-dialog,#itopfast .fast-bg").removeClass("on").addClass("on");
	}
	
	function  connect(country_code) {
		if(SensitiveCountry)
		{
			dialogShow();
			SetLiFail();
			CanConnect = true;
		}else
		{
			storage.vpnOn = true;
			chrome.runtime.sendMessage({
				action: 'connect',
				from: 'popup',
				country_code: country_code
			})
		}
    }

class Popup {
		
    constructor() {	
		//console.log('constructor: ',new Date().getTime());
		CanConnect = true;
		this.IsSwitch = false;
		//this.VPNindex = -1;
        //this.storage = STORAGE;
		this.initStorage();
        this.initHandlers();
        this.initListeners();
    }


    initListeners() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (this.storage) {
                for (let key in changes) {
                    if (key == 'country' || key == 'connectionInfo') {
                        storage[key] = changes[key].newValue;
                    }
                }
            }
        });

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action == 'gotIP'){
                if (storage.vpnOn && !document.body.classList.contains('error')) {
                    if(!request.data.disabled) {
                        chrome.runtime.sendMessage({
                            'action': 'getConfig'
                        }, (res) => {
							storage = res;
							this.successFast();
							//this.resultFast();
							//_popup.style.display = "none";
							//_popupSuccess.style.display = "block";
							this.UpdtURL();
                        });
                    }
                }
            }
            else if (request.action == 'gotIPError')
            {

				SetLiFail();
				/*fetch("https://www.itopvpn.com/api/ip-checker").then((resp) => resp.json()).then(function (data) {
					console.log("disconnect action response", data);
					
					_popup.getElementsByClassName("_ip")[0].textContent = data.data.ip;
					_popup.getElementsByClassName("_city")[0].textContent = data.data.city;
					_popup.getElementsByClassName("_ipbox")[0].style.visibility = 'visible';
				})*/
				this.UpdtURL();
				CanConnect = true
				storage.vpnOn = false;
				dialogShow();

            }
            else if (request.action == 'connected')
            {

				//this.SetLiSuccess();
				this.resultFast(_lindex);
				//_popup.style.display = "none";
				//_popupSuccess.style.display = "block";
				this.UpdtURL();
				CanConnect = true;
            }
            else if (request.action == 'disable')
            {
				SetLiFail();
				CanConnect = true;
                console.log('disable')
				//fetch("https://www.itopvpn.com/api/ip-checker").then((resp)=>{if(resp.status ==404){SensitiveCountry = true;}});
				var requst = fetch("https://www.itopvpn.com/api/ip-checker").then((resp) => {
					if(resp.status ==404){
						SensitiveCountry = true;}
					else{
					//console.log('resp json');
						return	resp.json();
					}
				});
				requst.then(function (data) {
					console.log("disconnect action response", data);
					_popup.getElementsByClassName("_ipbox")[0].style.visibility = 'visible'; 
					_popup.getElementsByClassName("_ip")[0].textContent = data.data.ip;
					_popup.getElementsByClassName("_city")[0].textContent = data.data.city;
					if(data.data.country_code == "CN")
					{
						SensitiveCountry = true;
					}
				});
			//_popup.style.display = "block";
			//_popupSuccess.style.display = "none";
			this.UpdtURL();
            }
        });
    }

    initHandlers() {
        const $b = $(document.body);
		
		$("#itopfast ._selectlist li").click(function(e) {
			if(CanConnect){
				if ($(this).hasClass('on')) {
					return;
				}
				CanConnect = false;
				//e.stopPropagation();
				$(this).find("._icon").addClass("_loading");
				$(this).addClass('on').siblings().removeClass('on');
				
				_lindex = $(this).attr('rel');
				_CountryCode = $(this).attr('data-code')
				$("#itopfast ._ipbox").attr("rel", _lindex);
				connect(_CountryCode);
			}
		});

		//switch off and on
		$b.on('click','#switchBtn',()=>{
			if(CanConnect){
					if(!storage.vpnOn){
						
					if(storage.country != ""){
						$("#itopfast ._selectlist li").find("._icon").addClass("_loading");
						switch(storage.country){
							case "USN": 
								_lindex = 0;break;
							case "USC": 
								_lindex = 1;break;
							case "GB" : 
								_lindex = 2;break;
							case "CA" : 
								_lindex = 3;break;
						}
						$("#itopfast ._selectlist li").eq(_lindex).addClass('on').siblings().removeClass('on');
						CanConnect = false;
						connect(storage.country);	
					}else{
						this.connectAutoPick();
					}
				}else{
					$("#itopfast ._selectlist li").removeClass("on");
					_popup.getElementsByClassName("_ipbox")[0].style.visibility = 'Hidden'
					this.disconnect();	
				}
			}
		});
		$b.on('click',"#fastbtn",()=>{
			$("#itopfast .fast-dialog,#itopfast .fast-bg").removeClass("on");
		});

    }

    initStorage() {
		//_popup.getElementsByClassName("_ipbox")[0].style.visibility = 'Hidden';
		_popup.getElementsByClassName("_ipbox")[0].style.visibility = 'Hidden';
		chrome.runtime.sendMessage({
            'action': 'getConfig'
        }, (res) => {
			console.log('init storage dataTime: ',new Date().getTime());
            storage = res;
			console.log('storage2',storage);
			switch(storage.country){
				case "USN": _lindex = 0;break;
				case "USC": _lindex = 1;break;
				case "GB" : _lindex = 2;break;
				case "CA" : _lindex = 3;break;
			}
            
			if(storage.vpnOn){
				//this.successFast();
				this.resultFast(_lindex);
				//_popup.style.display = "none";
				//_popupSuccess.style.display = "block";
			}else
			{
				SetLiFail();
				//_popup.style.display = "block";
				//_popupSuccess.style.display = "none";
			}
			this.initPopup();
        })

		//console.log("init storage end: ",new Date().getTime());
    }

    initPopup() {
        this.initCountries();
		document.querySelector('.f-slink').href ="https://goto.itopvpn.com/appgoto?name=itopext&ver="+ chrome.runtime.getManifest().version +"&lan=&to=ratefast&insur=chextminor4";		

    }
	UpdtURL(){
		if(!storage.vpnOn){
			//check ip
			console.log("disconnect Link");
			_popup.querySelector('._check').href = "https://goto.itopvpn.com/appgoto?name=itopext&ver="+chrome.runtime.getManifest().version+"&lan=&to=cip&ref=exmip&insur=chextminor4";
			//update
			_popup.querySelector('._buy').href = "https://goto.itopvpn.com/appgoto?name=itopext&ver="+ chrome.runtime.getManifest().version +"&lan=&to=upgrade&ref=unupgrade&insur=chextminor4"	
		}else{
			console.log("connect Link");
			//check ip
			_popup.querySelector('._check').href = "https://goto.itopvpn.com/appgoto?name=itopext&ver="+chrome.runtime.getManifest().version+"&lan=&to=cip&ref=exvip&insur=chextminor4";
			//update
			_popup.querySelector('._buy').href = "https://goto.itopvpn.com/appgoto?name=itopext&ver="+ chrome.runtime.getManifest().version +"&lan=&to=upgrade&ref=cupgrade&insur=chextminor4"	
		}
		
	}

	successFast() {
			$("#itopfast").addClass("fastSuccess"); // success ui
			$("#itopfast .note.n-close").removeClass("nshow"); // hide note
			$("#itopfast .note.n-open").addClass("nshow"); // show rate
			$("#itopfast .switch").find("._connect").html("CONNECTED!");  // connected word
			$("#itopfast .protxt").html("Your internet speed & privacy is now under protection!");  // connected word
			$("#itopfast ._iptxt").html("Virtual IP: ");// ip word
			$("#itopfast .switch").find(".s-off").html("ON");  // switch note
	}
	
	resultFast(index) {
		var IPInfo = [
			{code: 'USN',
			city: 'New York'}, 
			{code: 'USC',
			city: 'California'},
			{code: 'GB',
			city: 'United Kingdom'},
			{code: 'CA',
			city: 'Canada'}
		]
		
			// remove loading icon
			$("#itopfast  ._selectlist li").eq(index).addClass("on");
			$("#itopfast  ._selectlist li").eq(index).find("._icon").removeClass("_loading");
			
			// change ip
			$("#itopfast .protect ._ip").html(storage.connectionInfo.ip);
			// show place
			$("#itopfast .protect ._city").html(IPInfo[index].city);
			$("#itopfast ._selectlist").removeClass("on");
			this.successFast();
			_popup.getElementsByClassName("_ipbox")[0].style.visibility = 'visible';
	}

    initCountries() {
			//this.SetLiSuccess();  //add suc flag behind vpn
			console.log("init Lindex: ", _lindex);
			this.resultFast(_lindex);
			
			//console.log('init Time2:',new Date().getTime());
			if(!storage.vpnOn)
			{
				//this.IsSwitch = true;
				//_popup.getElementsByClassName("_ipbox")[0].style.visibility = 'Hidden'; 
				console.log('show disconnect');
				//_popup.style.display = "block";
				//_popupSuccess.style.display = "none";
				SetLiFail();
				//fetch("https://www.itopvpn.com/api/ip-checker").then((resp)=>{if(resp.status ==404){SensitiveCountry = true;}});
				var requst = fetch("https://www.itopvpn.com/api/ip-checker").then((resp) => {
					if(resp.status ==404){
						SensitiveCountry = true;}
					else{
					//console.log('resp json');
						return	resp.json();
					}
				});
				requst.then(function (data) {
					console.log("disconnect action response", data);
					
					_popup.getElementsByClassName("_ip")[0].textContent = data.data.ip;
					_popup.getElementsByClassName("_city")[0].textContent = data.data.city;
					_popup.getElementsByClassName("_ipbox")[0].style.visibility = 'visible';
					if(data.data.country_code == "CN")
					{
						SensitiveCountry = true;
					}					
				});

				//console.log('updt URL');
				
			}
			this.UpdtURL();


    }



    connect(country_code) {
        storage.vpnOn = true;
        chrome.runtime.sendMessage({
            action: 'connect',
            from: 'popup',
            country_code: country_code
        })
    }

    disconnect() {
        storage.vpnOn = false;
        chrome.runtime.sendMessage({
            action: 'disconnect',
            from: 'popup',
        })
    }

    connectAutoPick() {
        let countries = storage.locations.filter(i => i.premium);
        let randomCountry = countries[Math.round(Math.random() * (countries.length - 1))];
        storage.country = randomCountry.country_code;
		
		$("#itopfast ._selectlist li").find("._icon").addClass("_loading");
		switch(storage.country){
			case "USN": 
				_lindex = 0;break;
			case "USC": 
				_lindex = 1;break;
			case "GB" : 
				_lindex = 2;break;
			case "CA" : 
				_lindex = 3;break;
		}
		$("#itopfast ._selectlist li").eq(_lindex).addClass('on').siblings().removeClass('on');
		CanConnect = false;
        connect(storage.country);
    }

}

const p = new Popup();

