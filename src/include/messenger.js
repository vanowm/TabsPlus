// eslint-disable-next-line no-unused-vars
const MESSENGER = (() =>
{
	const mTabs = new Map();
	const mPorts = new Map();
	const mOnConnect = new Map();
	const mOnDisconnect = new Map();
	const mOnMessage = new Map();

	chrome.runtime.onConnect.addListener(port =>
	{
		if (port.sender.id !== chrome.runtime.id)
			return;

		for (const callback of mOnConnect)
			callback[0](port);

		mPorts.set(port, port);
		port.onMessage.addListener((...args) =>
		{
			for (const callback of mOnMessage)
				callback[0](...args);
		});
		port.onDisconnect.addListener(p =>
		{
			for (const callback of mOnDisconnect)
				callback[0](p);

			mPorts.delete(p);
		});
	});

	const onMessage = (message, sender, _sendResponse) =>
	{
		const isPort = _sendResponse === undefined;
		const port = sender;
		if (isPort)
		{
			_sendResponse = port.postMessage.bind(port);
			sender = sender.sender;
		}
		debug.debug("messageHandler", {message, port, sender, _sendResponse});
		if (sender.id !== chrome.runtime.id)
			return;

		const sendResponse = (...args) => (debug.debug("messageHandler sendResponse", sender.url, args), _sendResponse.apply(_sendResponse, args));
		switch (message.type)
		{
			case "tab": {
				if (isPort)
				{
					mPorts.set(port, message.data);
					mTabs.set(message.data.id, message.data);
					actionButton.setIcon(message.data);
				}

				break;
			}

			case "settings": {
				SETTINGS.$inited.then(data =>
				{
					sendResponse({type: "settings", data});
					return data;
				}).catch(error => debug.error("settingsInited", error));
				break;
			}

			case "setting": {
				sendResponse(SETTINGS(message.name, message.value));

				if (message.name === "syncSettings")
				{
					STORAGE = chrome.storage[message.value ? "sync" : "local"];
					const o = {};
					o[message.name] = message.value;
					SETTINGS.$save(o, Void);
				}
				break;
			}

		}
		return true;
	}; //onMessage();

	const onConnect = port =>
	{
		mPorts.set(port, null);
		debug.debug("onConnect", port);
	};

	const onDisconnect = port =>
	{
		const tab = mPorts.get(port);
		mPorts.delete(port);
		mTabs.delete(tab.id);
		actionButton.setIcon(tab);
	};

	return Object.assign(message =>
	{
		for (const port of mPorts)
			port[0].postMessage(message);
	},
	{
		tabs: mTabs,
		ports: mPorts,
		handler:
		{
			onMessage,
			onConnect,
			onDisconnect,
		},

		onConnect: callback => mOnConnect.set(callback, callback),
		onDisconnect: callback => mOnDisconnect.set(callback, callback),
		onMessage: callback => mOnMessage.set(callback, callback),
		offConnect: callback => mOnConnect.delete(callback),
		offDisconnect: callback => mOnDisconnect.delete(callback),
		offMessage: callback => mOnMessage.delete(callback),
	});
})();
