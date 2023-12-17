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
