importScripts(
	"include/common.js",
	"include/debug.js",
	"include/utils.js",
	"include/settings.js",
	"include/messenger.js",
	"include/tabsManager.js",
	"include/actionButton.js",
	"include/contextMenu.js",
	"include/alarm.js",
);

const TABS = new TabsManager();

//wait for the settings initialization
const onWrapper = callback => (...args) => SETTINGS.$inited.then(() => callback.apply(callback, args));

// messaging
chrome.runtime.onMessage.addListener(MESSENGER.handler.onMessage);

//broadcast message to reconnect to the service worker
chrome.runtime.sendMessage(null, "reconnect")?.catch(error => debug.debug("sendMessage reconnect %c" + error, "color: red;"));

//init message listeners
for(const i in MESSENGER.handler)
	MESSENGER[i]?.(MESSENGER.handler[i]);

chrome.runtime.onSuspend.addListener(() =>
{
	chrome.action.setBadgeBackgroundColor({color: "red"});
	debug.debug("" + [...TABS.tabsData.keys()]);
	TABS.save();
});

chrome.contextMenus.onClicked.addListener(onWrapper((info, tab) =>
{
	CONTEXTMENU.onClick[info.menuItemId]?.(info, tab);
	// const command = CONTEXTMENU.onClick[info.menuItemId];
	// if (command instanceof Function)
	// 	command(info, tab);
}));

chrome.action.onClicked.addListener(onWrapper(actionButton));
chrome.sessions.onChanged.addListener((...args) =>
{
	debug.debug("session.onChanged", args);

	CONTEXTMENU.create();
});
