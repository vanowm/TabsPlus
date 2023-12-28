importScripts(
	"include/common.js",
	"include/debug.js",
	"include/utils.js",
	"include/settings.js",
	"include/messenger.js",
	"include/tabsManager.js",
	"include/actionButton.js",
	"include/contextMenu.js",
	"include/favicons.js",
	"include/alarm.js",
);

const TABS = new TabsManager();

//wait for the settings initialization
const onWrapper = callback => (...args) => SETTINGS.$inited.then(() => callback.apply(callback, args));

Favicons.update();

// messaging
chrome.runtime.onMessage.addListener(messagesHandler.onMessage);

//broadcast message to reconnect to the service worker
chrome.runtime.sendMessage(null, "reconnect")?.catch(error => debug.debug("sendMessage reconnect %c" + error, "color: red;"));

for(const i in messagesHandler)
	messenger[i]?.(messagesHandler[i]);

for(const i in tabsHandler)
	chrome.tabs[i]?.addListener(onWrapper(tabsHandler[i]));

chrome.runtime.onSuspend.addListener(() =>
{
	chrome.action.setBadgeBackgroundColor({color: "red"});
	debug.debug("" + [...TABS.tabsData.keys()]);
	TABS.save();
});

chrome.contextMenus.onClicked.addListener(onWrapper((info, tab) =>
{
	const command = contextMenu.onClick[info.menuItemId];
	if (command instanceof Function)
		command(info, tab);
}));

chrome.action.onClicked.addListener(onWrapper(actionButton));
chrome.sessions.onChanged.addListener((...args) =>
{
	debug.debug("session.onChanged", args);

	//update favicons cache
	Favicons.update(true);
	contextMenu.createContextMenu();
});
