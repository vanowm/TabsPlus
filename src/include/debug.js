chrome.management.getSelf().then(data=>debug.show=data.installType=="development");
const debug = new Proxy({show:true,void:()=>{}},
{
	get(target, prop)
	{
		return target.show ? console[prop].bind(console) : target.void;
	}
});
