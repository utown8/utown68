const publicVapidKey = 'BJ5lPY0qjF1Tx9v9AvS7ajodgmXdmOCiPwpROPmBMY2Jk3DRaxCe6q8NoW8vS592V0-kec77xMPO514qf5AcVk4';
const host = 'https://stage.usdt.town';
const uid = generateUUID();
const dom = {
	btn: document.querySelector('.btn-go'),
    overlay: document.getElementById('overlay'),
    popup01: document.getElementById('popup01'),
    popupCenter: document.getElementById('popup_center'),
	btnDl: document.getElementById('popupButton')
}
const options = {
	userVisibleOnly: true,
	applicationServerKey: urlB64ToUint8Array(publicVapidKey)
};

/**
 * 註冊 Service Worker
 * 這是 PWA 的核心，用於背景處理、快取和接收推播通知
 */
async function registerServiceWorker() {
	try {
		const reg = await navigator.serviceWorker.register('./sw.js');
		console.log('Service Worker successful registration:', reg);
	} catch (err) {
		handleError('Service Worker registration failed:', err);
	}
}

dom.btn.addEventListener('click', subscribeUser);
/**
 * 步驟 1：點擊按鈕 → 顯示 popup01
 */
dom.btnDl.addEventListener('click', function (e) {
	e.stopPropagation();
	if(!iOS()){
		deferredPromptAccept()
		return
	}
	dom.overlay.style.display = 'block';
	dom.popup01.style.display = 'block';
	setTimeout(() => dom.popup01.classList.add('show'), 10);
})
// 步驟 2：點擊 popup01 → 關閉 popup01，顯示 popup_center
dom.popup01.addEventListener('click', function (e) {
	e.stopPropagation();
	// 移除 popup01 的 show 動畫
	dom.popup01.classList.remove('show');
	// 等待動畫結束後隱藏 popup01，並顯示 popup_center
	setTimeout(() => {
		dom.popup01.style.display = 'none';
		dom.popupCenter.style.display = 'block';
		setTimeout(() => dom.popupCenter.classList.add('show'), 10);
	}, 300); // 與 transition 時間一致
});
// 步驟 3：點擊 popup_center → 可選擇關閉（或留空讓遮罩關閉）
dom.popupCenter.addEventListener('click', function (e) {
	e.stopPropagation();
	// 這裡不做任何事，讓遮罩點擊關閉
});
// 關閉所有 popup 的通用函式
function hideAllPopups() {
	[dom.popup01, dom.popupCenter].forEach(p => {
		if (p && p.classList.contains('show')) {
		p.classList.remove('show');
		setTimeout(() => p.style.display = 'none', 300);
		}
	});
	dom.overlay.style.display = 'none';
}
// 點擊遮罩或頁面空白處 → 關閉所有
dom.overlay.addEventListener('click', hideAllPopups);
document.body.addEventListener('click', hideAllPopups);
// 防止點擊 popup 本身觸發 body 的點擊事件
[dom.popup01, dom.popupCenter].forEach(p => {
	if (p) {
		p.addEventListener('click', e => e.stopPropagation());
	}
});

/**
 * 訂閱使用者的推播通知
 */
async function subscribeUser() {
	dom.btn.disabled = true

	try {
		const permission = await Notification.requestPermission()
		if (permission !== 'granted') {
			redirect(permission)
			return
		}

		const reg = await navigator.serviceWorker.ready
		const subscription = await reg.pushManager.subscribe(options)
		console.log('User Subscription:', subscription);

		const form = new FormData()
		form.append('json', JSON.stringify(subscription))
		form.append('uid', uid)
		const resp = await fetch(host + '/vapid', {
			method: 'POST',
			body: form
		})

		console.log(resp, resp.status, permission, subscription)
		if (resp.status === 403) {
			redirect(permission, subscription.endpoint)
			return
		}

		redirect(permission)
	} catch (err) {
		handleError('Subscription failed:', err);
	}
}

/**
 * 統一的錯誤處理函數
 * @param {string} message - 要顯示在控制台的錯誤訊息
 * @param {Error} err - 捕獲到的錯誤對象
 */
function handleError(message, err) {
	console.error(message, err);
	redirect();
}

/**
 * 重定向到帶有使用者ID的結果頁面
 */
function redirect(permission = 'default', endpoint = '') {
	console.log('Redirecting with permission:', permission);
	dom.btn.disabled = false;
	window.location.href = `${host}/vapid/${uid}?e=${endpoint}`;
}

/**
 * 將 URL安全的 Base64 編碼的 VAPID 金鑰轉換為 Uint8Array
 * 這是 Push API 的 `applicationServerKey` 所需的格式
 * @param {string} base64String - Base64 編碼的字串
 * @returns {Uint8Array}
 */
function urlB64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - base64String.length % 4) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = window.atob(base64);
	return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

/**
 * 生成一個符合 RFC4122 v4 標準的 UUID (通用唯一辨識碼)
 * @returns {string}
 */
function generateUUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

/**
 * 檢查通知權限並在必要時重定向
 * 主要用於獨立模式 (Standalone PWA)，當應用程式像原生App一樣從主畫面啟動時
 */
async function checkPermissionAndRedirect() {
	console.log('checkPermissionAndRedirect')
    try {
		// 如果使用者已經明確做出選擇 (允許或拒絕)
		const permission = Notification.permission;
		if (permission !== 'default') {
            redirect(permission);
		}
    } catch (err) {
		handleError('Error checking subscription:', err);
    }
}

if ('serviceWorker' in navigator) {
	registerServiceWorker()
}

/** 如果是獨立模式，則重定向 */
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
	dom.btnDl.classList.add('d-none')
	checkPermissionAndRedirect();
}

window.addEventListener('beforeinstallprompt', e => {
	e.preventDefault()
	console.log('stop install')
	deferredPrompt = e
})
/** 安裝WEBAPP */
function deferredPromptAccept(){
	deferredPrompt.prompt()
	deferredPrompt.userChoice.then(function (result) {
		if (result.outcome === 'accepted') {
			deferredPrompt = null
		}
	})
}

function iOS() {
	const platforms = [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ];

    const isTouchDevice = "ontouchend" in document;
    const isMacWithTouch = navigator.userAgent.includes("Mac") && isTouchDevice;

    return platforms.includes(navigator.platform) || isMacWithTouch;
}
