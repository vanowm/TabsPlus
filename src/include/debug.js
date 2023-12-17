
const debug = new Proxy({show:true,void:() => {}},
	{
		get: (target, property) => (target.show ? console[property].bind(console) : target.void)
	});

chrome.management.getSelf()
	.then(data =>
	{
		debug.show = data.installType === "development";
		console.log("debug.js", data);
		return data;
	})
	.catch(error => console.error("debug.js error", error));
