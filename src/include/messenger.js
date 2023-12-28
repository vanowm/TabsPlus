// eslint-disable-next-line no-unused-vars
const messenger = (() =>
{
	const ports = new Map();
	const onConnect = new Map();
	const onDisconnect = new Map();
	const onMessage = new Map();

	chrome.runtime.onConnect.addListener(port =>
	{
		if (port.sender.id !== chrome.runtime.id)
			return;

		for (const [callback] of onConnect)
			callback(port);

		ports.set(port, port);
		port.onMessage.addListener((...args) =>
		{
			for (const [callback] of onMessage)
				callback(...args);
		});
		port.onDisconnect.addListener(p =>
		{
			for (const [callback] of onDisconnect)
				callback(p);

			ports.delete(p);
		});
	});

	return Object.assign(message =>
	{
		for (const [port] of ports)
			port.postMessage(message);
	},
	{
		onConnect: callback => onConnect.set(callback, callback),
		onDisconnect: callback => onDisconnect.set(callback, callback),
		onMessage: callback => onMessage.set(callback, callback),
		offConnect: callback => onConnect.delete(callback),
		offDisconnect: callback => onDisconnect.delete(callback),
		offMessage: callback => onMessage.delete(callback)
	});
})();

/**
 * Object representing the message handler for the service worker.
 * @type {Object}
 */
const messagesHandler = {
	_tabs: new Map(),
	_ports: new Map(),

	onMessage: (message, sender, _sendResponse) =>
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
					messagesHandler._ports.set(port, message.data);
					messagesHandler._tabs.set(message.data.id, message.data);
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
	}, //onMessage();

	onConnect: port =>
	{
		messagesHandler._ports.set(port, null);
		debug.debug("onConnect", port);
	},

	onDisconnect: port =>
	{
		const tab = messagesHandler._ports.get(port);
		messagesHandler._ports.delete(port);
		messagesHandler._tabs.delete(tab.id);
		actionButton.setIcon(tab);
	}

};// messengerHandler
