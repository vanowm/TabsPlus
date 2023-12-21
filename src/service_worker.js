importScripts(
	"include/debug.js",
	"include/utils.js",
	"include/messenger.js",
	"include/common.js",
	"include/tabsManager.js",
	"include/prefs.js"
);

const TABS = new TabsManager();

//wait for the prefs initialization
const onWrapper = callback => (...args) => prefsInited.then(() => callback.apply(callback, args));

/**
 * A function that sets an alarm using Chrome's alarms API as a backup plan in case the extension was suspended.
 * @function
 * @returns {Promise} A promise that resolves when the alarm is executed.
 */
const setAlarm = (() =>
{
	//using alarms as a backup plan in case extension was suspended
	const list = new Map();
	const listener = alarm =>
	{
	// if (list.get(alarm.name).timer)
	//   debug.log("alarm", alarm.name, new Date().toISOString(), new Date(alarm.scheduledTime).toISOString(), alarm);
		alarmHandler.exec(alarm.name);
	};

	/**
	 * A function that returns a time string HH:MM:SS.mmm
	 * @function
	 * @param {Date} d - The date object to convert to a string.
	 * @param {boolean} [ms=true] - Whether to include milliseconds in the string.
	 * @returns {string} A string representation of the date object.
	 */
	const timeString = (d, ms = true) => (d > 3_600_000 ? pad(d.getHours()) + ":" : "") + (d > 60_000 ? pad(d.getMinutes()) + ":" : "") + pad(d.getSeconds()) + (ms ? "." + pad(d.getMilliseconds(),3) : "");

	/**
	 * A function that handles setting an alarm.
	 * @function
	 * @param {Function} callback - The function to execute when the alarm is triggered.
	 * @param {number} time - The time in milliseconds to wait before triggering the alarm.
	 * @param {string} [name=function_.toString()] - The name of the alarm.
	 * @param {boolean} [clear=true] - Whether to clear any existing alarms with the same name.
	 * @returns {Promise} A promise that resolves when the alarm is executed.
	 */
	const alarmHandler = (callback, time, name, clear = true) =>
	{
		if (name === undefined)
			name = callback.toString();

		const when = Date.now() + time;
		// debug.log("alarm set", name, new Date().toISOString(), new Date(when).toISOString());
		let alarm = list.get(name);
		if (!alarm)
		{
			alarm = {name};
			alarm.promise = new Promise(resolve =>
			{
				alarm.resolve = resolve;
			});
		}
		alarm.func = callback;
		alarm.time = time;
		alarm.when = timeString(new Date(when));

		list.set(name, alarm);
		if (clear)
		{
			chrome.alarms.clear(name);
			clearTimeout(alarm.timer);
		}
		alarm.timer = setTimeout(() => listener({name, scheduledTime: when}), time);
		chrome.alarms.create(name, {when});
		debug.trace("alarm added", alarm);
		return alarm.promise;
	};

	/**
	 * An object that contains methods for deleting and executing alarms.
	 * @namespace
	 */
	Object.assign(alarmHandler, {
		/**
		 * A method that deletes an alarm by name or function.
		 * @function
		 * @param {string|Function} name - The name or function of the alarm to delete.
		 */
		delete: name =>
		{
			if (name instanceof Function)
				name = name.toString();

			chrome.alarms.clear(name);
			list.delete(name);
		},

		/**
		 * A method that executes an alarm by name.
		 * @function
		 * @param {string} name - The name of the alarm to execute.
		 */
		exec: name =>
		{
			const alarm = list.get(name);
			debug.debug("alarm.exec", name, Boolean(alarm.timer), alarm);
			if (!alarm)
				return;

			chrome.alarms.clear(name);
			clearTimeout(alarm.timer);
			if (alarm.timer)
				alarm.resolve(alarm.func instanceof Function && alarm.func());

			delete alarm.timer;
		}
	});
	chrome.alarms.onAlarm.addListener(listener);
	return alarmHandler;
})();

/**
 * Toolbar button action handler.
 * @param {Object} tab - The tab object.
 * @param {string} iconAction - The action to be performed.
 */
const actionButton = (tab, iconAction) =>
{
	if (iconAction === undefined)
		iconAction = prefs.iconAction;

	const found = TABS.find(tab) || tab;
	debug.debug("actionButton", iconAction, tab.skip, found.skip, tab === found, tab, found);
	switch (iconAction)
	{
		case ACTION_UNDO: {
			chrome.sessions.getRecentlyClosed(sessions =>
			{
				debug.debug(sessions);
				const sessionId = sessions[0]?.tab?.sessionId || sessions[0]?.window?.tabs[0]?.sessionId || null;
				debug.debug(sessionId);
				chrome.sessions.restore(sessionId);
			});
			break;
		}

		case ACTION_SKIP: {
			found.skip = !found.skip;
			TABS.save();
			setIcon(found);
			setContext(found);
			break;
		}

		// case ACTION_FREEZE:
		//   found.freeze = !found.freeze;
		//   setIcon(found);
		//   break;

		// case ACTION_PROTECT:
		//   found.protect = !found.protect;
		//   setIcon(found);
		//   break;

		case ACTION_LIST: {
			const winOptions = {
				url: "ui/actionPopup.html",
				type: "panel",
				focused: true,
				width: 335,
				height: 640
			};

			setIcon(tab);
		//get current window screen location
			chrome.windows.getCurrent(null, currentWin =>
			{
				if (currentWin)
				{
					winOptions.left = currentWin.left + Math.round((currentWin.width - winOptions.width) / 2);
					winOptions.top = currentWin.top + Math.round((currentWin.height - winOptions.height) / 2);
				}

				chrome.windows.create(winOptions, win =>
				{
					debug.debug(win);
				});
			});
			break;
		}

		case ACTION_UNLOAD_TAB: {
			chrome.tabs.query({currentWindow: true, active: true})
				.then(tabs => unloadTabs(tabs, ACTION_UNLOAD_TAB))
				.catch(error => debug.error("actionButton", ACTION_UNLOAD_TAB, error));
			break;
		}

		case ACTION_UNLOAD_WINDOW: {
			chrome.tabs.query({currentWindow: true, active: false})
				.then(tabs => unloadTabs(tabs, ACTION_UNLOAD_WINDOW))
				.catch(error => debug.error("actionButton", ACTION_UNLOAD_WINDOW, error));
			break;
		}

		case ACTION_UNLOAD_ALL: {
			chrome.tabs.query({active: false})
				.then(tabs => unloadTabs(tabs, ACTION_UNLOAD_ALL))
				.catch(error => debug.error("actionButton", ACTION_UNLOAD_ALL, error));
			break;
		}
	}//switch
};

/**
 * Represents a context menu object.
 * @typedef {Object} ContextMenu
 * @property {Object} onClick - Object containing click event handlers for menu items.
 * @property {Map} _list - Map containing the menu items.
 * @property {function} add - Function to add a menu item to the context menu.
 * @property {function} remove - Function to remove a menu item from the context menu.
 * @property {function} update - Function to update a menu item in the context menu.
 * @property {function} iconActionChanged - Function to handle changes in icon actions.
 * @property {function} createContextMenu - Function to create the context menu.
 */
const contextMenu = {
	onClick: {},
	_list: new Map(),
	add: (menuItem, force) =>
	{
		// debug.trace("contextMenu.add", menuItem.id, {menuItem, force});
		if (contextMenu._list.has(menuItem.id))
		{
			if (!force)
				return menuItem;

			contextMenu.remove(menuItem.id);
		}
		if (menuItem.contexts.length === 0)
			return menuItem;

		const menu = CLONE(menuItem);
		if (menuItem.onclick)
			contextMenu.onClick[menuItem.id] = menuItem.onclick;

		delete menu.onclick;
		delete menu.maxList;
		chrome.contextMenus.remove(menuItem.id, () => chrome.runtime.lastError);
		const id = chrome.contextMenus.create(menu, () =>
		{
			if (chrome.runtime.lastError)
				debug.trace("contextMenu.add error:", chrome.runtime.lastError.message, menuItem);
			else
				debug.trace("contextMenu.add:", menuItem);

		});
		contextMenu._list.set(id, menuItem);
		// debug.debug("contextMenu.add", id, menuItem);
		return menuItem;
	},

	remove: id =>
	{
		const menuItem = contextMenu._list.get(id);
		// debug.trace("contextMenu.remove", {id, menuItem});
		if (menuItem)
		{
			debug.trace("contextMenu.removing:", menuItem);
			chrome.contextMenus.remove(id, () =>
			{
				if (chrome.runtime.lastError)
					debug.trace("contextMenu.remove error:", chrome.runtime.lastError.message, menuItem);
				else
					debug.trace("contextMenu.remove:", menuItem);
			});
		}
		contextMenu._list.delete(id);
	},

	update: menuItemNew =>
	{
		const menuItem = contextMenu._list.get(menuItemNew.id);
		if (!menuItem)
			return;

		for (const i in menuItem)
		{
			if (menuItemNew[i] !== undefined)
				menuItem[i] = menuItemNew[i];
		}
		const menu = CLONE(menuItemNew);
		if (menuItem.onclick)
			contextMenu.onClick[menuItemNew.id] = menuItem.onclick;

		delete menu.onclick;
		delete menu.id;
		chrome.contextMenus.update(menuItemNew.id, menu);
	},

	iconActionChanged: (id, newValue, oldValue) =>
	{
		debug.debug("iconActionChanged", {id, newVal: newValue, oldVal: oldValue});
		chrome.tabs.query({})
			.then(tabs =>
			{
				for (let i = 0; i < tabs.length; i++)
					setIcon(tabs[i]);
				return tabs;
			})
			.catch(error => debug.error("iconActionChanged", error));
	},

	createContextMenu: (id, newValue = prefs.contextMenu, oldValue, data) =>
	{
		debug.trace("createContextMenu", {id, newVal: newValue, oldVal: oldValue, data, list:[...contextMenu._list.keys()]});
		if (!newValue)
		{
			const list = [...contextMenu._list.keys()];
			for(const key of list)
			{
				const menuItem = contextMenu._list.get(key);
				menuItem.contexts = menuItem.contexts.filter(item => item === "action");
				contextMenu.remove(key);
				contextMenu.add(menuItem);
			}
		}
		const menus = data === undefined
			? ["listAction", "lastUsed", "skip", "unload", "unloadWindow", "unloadAll", /*"freeze", "protect",*/ "separator", "options", "separator", "list"]
			: Object.keys(data);

		const contexts = ["action", "page", "frame"];
		const menuList = {
			lastUsed: {
				title: chrome.i18n.getMessage("contextMenu_lastUsed"),
				contexts: contexts,
				onclick: (info, tab) =>
				{
					const lastTab = TABS.last(tab.windowId, true, [tab.id]);
					if (!lastTab)
						return;
						// noChange = TABS.noChange;
						// TABS.noChange = true;
						// const callback = (...args) => {
						//   setTimeout(() => TABS.noChange = noChange);
						//   TABS.removeListener("activated", callback);
						//   debug.debug("noChange", TABS.noChange, args);
						// };
						// TABS.addListener("activated", callback);
					TABS.activate(lastTab.id);

				}
			},
			undo: {
				title: chrome.i18n.getMessage("iconAction_" + ACTION_UNDO),
				contexts: contexts,
				onclick: (info, tab) =>
				{
					actionButton(tab, ACTION_UNDO);
				}
			},
			skip: {
				title: chrome.i18n.getMessage("iconAction_" + ACTION_SKIP + "_1"),
				contexts: contexts,
				onclick: (info, tab) =>
				{
					actionButton(tab, ACTION_SKIP);
				}
			},
			// freeze: {
			//   title: chrome.i18n.getMessage("iconAction_" + ACTION_FREEZE),
			//   contexts: contexts,
			//   onclick: (info, tab) =>
			//   {
			//     actionButton(tab, ACTION_FREEZE);
			//   }
			// },
			// protect: {
			//   title: chrome.i18n.getMessage("iconAction_" + ACTION_PROTECT),
			//   contexts: contexts,
			//   onclick: (info, tab) =>
			//   {
			//     actionButton(tab, ACTION_PROTECT);
			//   }
			// },
			list: {
				title: "----- [ " + chrome.i18n.getMessage("contextMenu_closedTabs") + " ] -----",
				contexts: ["page", "frame"],
				enabled: false,
				maxList: 999,
				onclick: (info, tab) =>
				{
					actionButton(tab, ACTION_LIST);
				}
			},
			separator: {
				type: "separator",
				contexts: contexts,
			},
			listAction: {
				title: chrome.i18n.getMessage("contextMenu_closedTabs"),
				contexts: ["action"],
				maxList: 999,
				type: "menu"
			},
			options: {
				title: chrome.i18n.getMessage("options"),
				contexts: ["page", "frame"],
				onclick: () =>
				{
					chrome.runtime.openOptionsPage();
				}
			},
			unload: {
				title: chrome.i18n.getMessage("iconAction_" + ACTION_UNLOAD_TAB),
				contexts: contexts,
				onclick: (info, tab) =>
				{
					actionButton(tab, ACTION_UNLOAD_TAB);
				}
			},
			unloadWindow: {
				title: chrome.i18n.getMessage("iconAction_" + ACTION_UNLOAD_WINDOW),
				contexts: contexts,
				onclick: (info, tab) =>
				{
					actionButton(tab, ACTION_UNLOAD_WINDOW);
				}
			},
			unloadAll: {
				title: chrome.i18n.getMessage("iconAction_" + ACTION_UNLOAD_ALL),
				contexts: contexts,
				onclick: (info, tab) =>
				{
					actionButton(tab, ACTION_UNLOAD_ALL);
				}
			},

		};
		if (data !== undefined)
		{
			for(const i in data)
			{
				menuList[i] = Object.assign(menuList[i], data[i]);
			}
		}
		for (let m = 0; m < menus.length; m++)
		{
			const itemId = menus[m];
			const menuItem = menuList[itemId];
			const isUpdate = data?.[itemId];
			const force = data?.[itemId].force;

			if (menuItem === undefined)
				continue;

			menuItem.id = itemId;
			if (menuItem.type === "separator")
				menuItem.id += m;

			if (!prefs.contextMenu)
			{
				for(let i = 0; i < menuItem.contexts.length; i++)
				{
					if (menuItem.contexts[i] === "page" || menuItem.contexts[i] === "frame")
						menuItem.contexts.splice(i--, 1);
				}
			}
			const isList = itemId.slice(0, 4) === "list";
			const menuId = menuItem.type === "menu" && itemId;

			if (menuId)
				delete menuItem.type;

			// debug.debug({itemId, menuItem, isList});

			if (isUpdate)
			{
				contextMenu.update(menuItem);
				continue;
			}
			else
				contextMenu.remove(menuItem.id);

			contextMenu.add(menuItem, force);

			if (isList)
			{
				chrome.sessions.getRecentlyClosed(sessions => contextMenu.showRecentlyClosed({
					itemId,
					menuId,
					menuItem,
					previousMenuItem: menuList[menus[m - 1]],
					sessions
				}));
			}

		} //for (menus)
		const list = {};
		for(let i = 0, entries = [...contextMenu._list.entries()]; i < entries.length; i++)
		{
			const entry = entries[i];
			for(let i = 0; i < entry[1].contexts.length; i++)
			{
				if (!list[entry[1].contexts[i]])
					list[entry[1].contexts[i]] = [];

				list[entry[1].contexts[i]].push(entry);
			}
		}

		for(const i in list)
		{
			list[i] = list[i].filter((a, i, ar) => a[1].type !== "separator" || (i && ar[i - 1][1].type !== a[1].type));
		}
		// debug.log({list});
	}, //createContextMenu()

	showRecentlyClosed: ({itemId, menuId, menuItem, previousMenuItem, sessions}) =>
	{
		debug.debug("showRecentlyClosed", {itemId, menuItemId: menuItem.id, menuItem, sessions});
		if (sessions.length === 0 && menuItem.contexts.length > 0)
		{
			// debug.log({menuItem, previousMenuItem});
			if (previousMenuItem)
				contextMenu.remove(previousMenuItem.id);

			const menuListItems = [...contextMenu._list.keys()];
			for(const id of menuListItems)
			{
				if (id.slice(0, 4) === "list")
					contextMenu.remove(id);
			}
			return contextMenu.remove(menuItem.id);
		}

		let i = 0;
		const max = menuItem.maxList || 10;

		const menuItemContexts = menuId ? menuItem.contexts : ["page", "frame"];

		const addTabs = (object, parentId, _id, _i) =>
		{
			if (object?.window?.tabs)
			{
				const _menuId = itemId + _id + "_" + _i;
				const item = {
					title: `Window (${object.window.tabs.length})`,
					id: _menuId,
					// onclick: () => debug.log(object.sessionId),
					contexts: menuItemContexts
				};
				if (parentId)
					item.parentId = parentId;

				contextMenu.add(item, true);
				addTabs(object.window.tabs, _menuId, _id + "_" + _i++, 0);
				return 1;
			}

			const tabs = object.tab && [object.tab] || object;
			for(let n = 0; _i < max && n < tabs.length; n++, _i++)
			{
				const tab = tabs[n];
				const details = {
					title: truncate(tab.title),
					id: itemId + _id + "_" + _i,
					contexts: menuItemContexts,
					onclick: () => chrome.sessions.restore(tab.sessionId)
				};
				if (parentId)
				{
					details.parentId = parentId;
				}
				contextMenu.add(details, true);
				// debug.log(n, i, details, contextMenu.add(details, true));
			}
			return tabs.length;
		};
		do
		{
			if (!sessions[i] || (itemId === "list" && !prefs.contextMenu))
				break;

			i += addTabs(sessions[i], menuId, "", i);
		}
		while(i < max);
	} //showRecentlyClosed()
};//contextMenu

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
		debug.debug("messageHandler", message, sender, _sendResponse);
		const port = sender;
		if (isPort)
		{
			_sendResponse = port.postMessage.bind(port);
			sender = sender.sender;
		}
		debug.debug("messageHandler2", message, port, sender, _sendResponse);
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
					setIcon(message.data);
				}

				break;
			}

			case "prefs": {
				prefsInited.then(() => sendResponse({type: "prefs", data: prefs.data})).catch(error => debug.error("prefsInited", error));
				break;
			}

			case "pref": {
				sendResponse(prefs(message.name, message.value));

				if (message.name === "syncSettings")
				{
					STORAGE = chrome.storage[message.value ? "sync" : "local"];
					const o = {};
					o[message.name] = message.value;
					prefsSave(o, Void);
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
		setIcon(tab);
	}

};// messengerHandler

/**
 * Event handler functions for various tab-related events.
 * @type {Object}
 */
const tabsHandler = {
	onActivated: activeInfo =>
	{
		const noChange = TABS.noChange;
		debug.trace("onActivated", {activeInfo, noChange, "TABS.noChange": TABS.noChange, "prefs.tabsScrollFix": prefs.tabsScrollFix});
		// setAlarm(() =>
		// {
		debug.debug("onActivated onAlarm", {activeInfo, noChange, "TABS.noChange": TABS.noChange});
		if (noChange)
			return noChange instanceof Function && noChange();

		TABS.notifyListeners("activated", activeInfo);
		tabsGet(activeInfo.tabId, tab =>
		{
			tab = TABS.add(tab);
			debug.debug("activated", activeInfo.tabId, TABS.win(), tab);
			setContext(tab);
		});
		//    }, prefs.newTabActivate == 1 && prefs.tabsScrollFix ? noChange ? 200 : 300 : 0, "onActivated");
	}, //onActivated()

	onCreated: async tab =>
	{
		const isRestored = (tab.pendingUrl && tab.pendingUrl === tab.url)
							|| (!tab.pendingUrl && tab.status === "unloaded");

		debug.debug("onCreated", isRestored, CLONE(tab));
		//  TABS.add({id: tabId, windowId: attachInfo.newWindowId});
		if (isRestored) //tab restored?
			return;

		let previousTab = TABS.last(tab.windowId);
		TABS.add(tab);
		if (!previousTab)
			previousTab = tab;

		const url = tab.url || tab.pendingUrl || "";
		const match = url.match(/^(chrome|edge):\/\/(newtab)?/i) || [];
		const isOptions = new RegExp("^chrome-extension://" + chrome.runtime.id + "/.*", "i").exec(url);
		const isChrome = match[1];
		const isNewPage = match[2];
		const isForeground = (prefs.newTabActivate === 1 && (!prefs.newTabPageOnly || (prefs.newTabPageOnly && isNewPage))) || isOptions;
		const isBackground = prefs.newTabActivate === 2 && !isOptions;

		if (previousTab.id !== tab.id)
		{

			let index = tab.index;

			const first = await chrome.tabs.query({pinned: true, currentWindow: true});
			const last = await chrome.tabs.query({currentWindow: true});

			try
			{
				previousTab = await chrome.tabs.get(previousTab.id);
			}
			catch(error)
			{
				debug.error("onCreated tabs.get", previousTab.id, error);
			}
			switch(prefs.newTabPosition)
			{
				case 1: { //first
					index = first.length;
					break;
				}
				case 2: { //next left
					index = Math.max(first.length, previousTab.index);
					break;
				}
				case 3: { //next right
					index = Math.min(previousTab.index + 1, last.length - 1);
					break;
				}
				case 4: { //last
					index = last.length - 1;
					break;
				}
			}
			// eslint-disable-next-line unicorn/no-await-expression-member
			debug.debug("onCreated position", {prefNewTabPosition: prefs.newTabPosition, tabIndex: tab.index, prevTabIndex: previousTab.index,index, first: (await first).length, last: (await last).length - 1, prevTabId: previousTab.id, tabId: tab.id, prevTab: previousTab, tab});

			// without setTimeout it scrolls page down when link opens a new tab (and AutoControl installed https://chrome.google.com/webstore/detail/autocontrol-custom-shortc/lkaihdpfpifdlgoapbfocpmekbokmcfd )
			// looks like it's fixed now
			// setTimeout(() => {
			if (isForeground || isBackground)
			{
				await new Promise(resolve =>
				{
					if (!prefs.newTabPosition || tab.index === index)
						return resolve();

					chrome.tabs.move(tab.id, {index})
						.then(result =>
						{
							resolve(true);
							return result;
						})
						.catch(error => (resolve(), debug.error("onCreated.move", error)));
				});

				const wait = new Promise(resolve => (TABS.noChange = resolve));
				debug.debug("noChange", "true", {noChange: TABS.noChange, prevTabId: previousTab.id, tabId: tab.id, prevTab: previousTab, tab});
				TABS.activate(previousTab.id);
				if (previousTab.active)
					TABS.noChange();

				await wait;
				TABS.noChange = false;
			}
		}
		// }, 35);

		// fix for EDGE vertical tabs don't scroll to the new tab https://github.com/MicrosoftDocs/edge-developer/issues/1276
		setAlarm(() =>
		{

			debug.debug("noChange", "false", {noChange: TABS.noChange, isChrome, isNewPage, isForeground, isBackground, newTabPageOnly: prefs.newTabPageOnly, tab});
			if (isForeground || isBackground)
			{
				// //move new tab to the front of the list
				// const t = TABS.tabsData.get(tab.id);
				// TABS.tabsData.delete(tab.id);
				// TABS.tabsData.set(tab.id, t);

				//remove this block to skip to new tab when delete
			}
			if (prefs.newTabPageSkip && !isForeground)
			{
				for(let i = 0, list = [...TABS.tabsData.values()]; i < list.length; i++)
				{
					if (list[i].id === tab.id)
						continue;

					TABS.tabsData.delete(list[i].id);
					TABS.tabsData.set(list[i].id, list[i]);
				}
			}

			//move previous tab to the end
			if (isForeground)
				TABS.activate(tab.id); // foreground
			else if (isBackground)
			{
				TABS.tabsData.delete(previousTab.id);
				TABS.tabsData.set(previousTab.id, previousTab);
				TABS.activate(previousTab.id); // background

			}

			setIcon(tab);
			TABS.updateAll(tab.windowId);
		}, prefs.newTabActivate === 1 && prefs.tabsScrollFix ? 250 : 0, "onCreated");

		debug.debug("created", TABS.win(tab.windowId), previousTab, tab);
	}, //onCreated()

	onRemoved: (tabId, removeInfo) =>
	{
		debug.debug("onRemoved", {tabId, removeInfo});
		TABS.noChange = true;
		tabsQuery({active: true, windowId: removeInfo.windowId}, tabs =>
		{
			const removedTab = TABS.remove({id: tabId, windowId: removeInfo.windowId});
			const currentTab = tabs[0];
			const last = TABS.last(removeInfo.windowId, true);

			debug.debug("onRemoved currentTab", tabId, currentTab?.id, last, removeInfo, removedTab);

			if (!currentTab) //last tab in window
			{
				TABS.noChange = false;
				return;
			}

			if (last.id === tabs[0].id)
			{
				TABS.noChange = false;
				return;
			}

			TABS.noChange = true;
			const windowId = removedTab.windowId;

			let index = removedTab.index;
			let previousTab = TABS.last(windowId, true);

			debug.debug("remove", tabId, "prev", previousTab?.id, "cur", currentTab.id, previousTab && (previousTab.id !== tabId && currentTab.id === previousTab.id));
			//  if ((prevTab && prevTab.id != tabId) || !prefs.afterClose)
			if (!prefs.afterClose || (prefs.afterClose === 1 && previousTab?.id !== tabId && currentTab.id === previousTab?.id))
			{
				TABS.noChange = false;
				return debug.debug("noChange", "exit remove", TABS.noChange);
			}

			previousTab = TABS.last(windowId, true);
			if (!previousTab)
				previousTab = TABS.last(windowId);

			if (!previousTab)
				return;

			debug.debug("removing", tabId, previousTab.id, currentTab.id, "removed ind ", index, "cur ind", currentTab.index);
			const result = _tabs =>
			{
				TABS.noChange = false;
				TABS.activate(_tabs[0].id)
					.catch(error => debug.error("onRemoved callback", error));
			};

			if (prefs.afterClose === 1)
			{
				chrome.tabs.get(previousTab.id)
					.then(tab => result([tab]))
					.catch(error => debug.error("onRemoved afterClose", error)); //previous active
			}
			else
			{
				chrome.tabs.query({
					index: [
						index && --index || 0, // left
						index // right
					][prefs.afterClose - 2],
					windowId: windowId
				})
					.then(result)
					.catch(error => debug.error("onRemoved query", error)); //previous active
				debug.debug([
					(index && --index) || 0, // left
					index // right
				][prefs.afterClose - 2], prefs.afterClose - 2, (index && --index) || 0, index);
			}
			/*
	switch (prefs.afterClose)
	{
		case 1: // last used tab
		chrome.tabs.update(tabsArray[0], {active: true});
		break;
		case 2: // left
		chrome.tabs.query({windowId: currentWindowId}, tabs =>
		{
			if (currentTabIndex > 0)
			currentTabIndex = currentTabIndex - 1;

			chrome.tabs.update(tabs[currentTabIndex].id, {active: true});
		});
		break;
		case 3: // right
		chrome.tabs.query({windowId: currentWindowId}, tabs =>
		{
			if (currentTabIndex >= TABS.length)
			currentTabIndex = TABS.length - 1;

			chrome.tabs.update(tabs[currentTabIndex].id, {active: true});
		});
		break;
		}
	*/
			TABS.updateAll(windowId);
			debug.debug("remove win", TABS.win(windowId));
		});
	}, //onRemoved()

	onAttached: (tabId, attachInfo) =>
	{
		debug.debug("onAttached", {tabId, attachInfo, data: CLONE(TABS.find({id: tabId, windowId: attachInfo.newWindowId}) || {})});
		TABS.updateAll(attachInfo.windowId);
		// TABS.update(TABS.find({id: tabId, windowId: attachInfo.newWindowId}), {id: tabId, windowId: attachInfo.newWindowId}, true);
		// TABS.save();
		debug.debug("onAttached after", CLONE(TABS.find({id: tabId, windowId: attachInfo.newWindowId}) || {}));
	}, //onAttached()

	onDetached: (tabId, detachInfo) =>
	{
		debug.debug("onDetached", {tabId, detachInfo, data: CLONE(TABS.find({id: tabId, windowId: detachInfo.oldWindowId}) || {})});
		TABS.updateAll(detachInfo.windowId);
		// TABS.update(TABS.find({id: tabId, windowId: detachInfo.oldWindowId}), {id: tabId, windowId: detachInfo.oldWindowId}, true);
		// TABS.save();
		debug.debug("onDetached after", CLONE(TABS.find({id: tabId, windowId: detachInfo.oldWindowId}) || {}));
	}, //onDetached()

	// onMoved: (tabId, moveInfo) =>
	// {
	// debug.debug("moved", tabId, moveInfo, clone(TABS.find(tabId)));
	//   TABS.update({id: tabId, windowId: moveInfo.windowId, index: moveInfo.toIndex});
	// debug.debug("moved end", TABS.find(tabId));
	// }, //onMoved()

	_onReplacedCallback: [],
	onReplaced: (addedTabId, removedTabId) =>
	{
		debug.debug("onReplaced", {addedTabId, removedTabId});
		chrome.tabs.get(addedTabId)
			.then(tab =>
			{
				const removedTab = TABS.remove({id: removedTabId});
				TABS.update(tab, removedTab);
				TABS.add(tab, false, false);
				const callback = tabsHandler._onReplacedCallback;
				while(callback.length > 0)
					callback.shift()({tab, oldTab: removedTab || TABS.find({id: removedTabId})});

				return tab;
			})
			.catch(error => debug.error("onReplaced", error));
	}, //onReplaced()

	onUpdated: (tabId, changeInfo, origTab) =>
	{
		let tab = TABS.find(origTab);
		if (tab)
		{
			const tabUUID = tab.tabUUID;
			const windowUUID = tab.windowUUID;

			tab = TABS.update(tab, origTab);
			TABS.setUUID(tab);
			TABS.setWinUUID(tab);
			if (tabUUID !== tab.tabUUID || windowUUID !== tab.windowUUID)
				TABS.save();
		}
		else
			tab = origTab;

		debug.debug("onUpdated", tabId, {changeInfo, changeInfoCloned: CLONE(changeInfo)});
		if (changeInfo.status === "loading")
		{
			setIcon(tab);
		}

	//   debug.debug("onUpdated", {tabId, changeInfoStatus: changeInfo.status, tabStatus: tab.status, changeInfo, tab: JSON.parse(JSON.stringify(tab)), tabStored: TABS.find(tabId)});
	// //debug.debug("onUpdated", tabId, changeInfo, changeInfo.status === "loading", clone(tab));
	//   TABS.update(Object.assign(changeInfo, {id: tabId, windowId: tab.windowId}));
	// debug.debug("onUpdated end", TABS.find(tabId,tab.windowId));
	}, //onUpdated()

	onMoved: (tabId, changeInfo, tab) =>
	{
		tab = tab || {id: tabId, windowId: changeInfo.windowId, index: changeInfo.toIndex};
		debug.debug("onMoved", {tabId, changeInfo, tab: CLONE(tab), found: CLONE(TABS.find(tab))});
		TABS.updateAll(changeInfo.windowId);
	},

};//tabsEventHandler

/**
 * Sets the context menu for a given tab.
 * @param {Object} tab - The tab object.
 */
const setContext = tab =>
{
	// debug.log("setContext", tab);
	if (!tab)
		return;

	const found = TABS.find(tab) || {};
	contextMenu.createContextMenu(undefined, undefined, undefined, {skip: {title: chrome.i18n.getMessage("iconAction_" + ACTION_SKIP + "_" + ~~!found.skip)}});

};

/**
 * Retrieves information about a tab with the given ID.
 * @param {number} id - The ID of the tab to retrieve information for.
 * @param {function} callback - The callback function to be called with the tab information.
 * @see: https://stackoverflow.com/questions/67887896
 */
const tabsGet = (id, callback) =>
{
	const callback_ = tabs => (chrome.runtime.lastError ? setTimeout(() => chrome.tabs.get(id, callback_)) : callback(tabs));
	chrome.tabs.get(id)
		.then(callback_)
		.catch(error => debug.error("tabsGet", error));
};

/**
 * Queries the Chrome tabs based on the given query object and invokes the callback function with the result.
 *
 * @param {Object} query - The query object used to filter the tabs.
 * @param {Function} callback - The callback function to be invoked with the tabs result.
 * @returns {Promise} A promise that resolves with the tabs result.
 */
const tabsQuery = (query, callback) =>
{
	const callback_ = tabs => ((chrome.runtime.lastError) ? setTimeout(() => chrome.tabs.query(query, callback_)) : callback(tabs)); //https://stackoverflow.com/questions/67887896
	return chrome.tabs.query(query)
		.then(callback_)
		.catch(error => debug.error("tabsQuery", error));
};

/**
 * Unloads tabs by discarding them.
 * @param {Array} tabs - The array of tabs to unload.
 * @param {string} [type=ACTION_UNLOAD_TAB] - The type of action to perform on the tabs.
 */
const unloadTabs = (tabs, type = ACTION_UNLOAD_TAB) =>
{
	for(let i = 0; i < tabs.length; i++)
	{
		const tab = tabs[i];
		if (!tab.discarded)
		{
			const result = () => chrome.tabs.discard(tab.id).catch(error => debug.error("unloadTabs", error));
			debug.debug("unloadTab", {id: tab.id, type, tab});
			if (type === ACTION_UNLOAD_TAB || type === ACTION_UNLOAD_WINDOW)
			{
				const previousTab = TABS.last(tab.windowId, true, [tab.id]);
				if (!previousTab)
					continue;

				TABS.activate(previousTab.id)
					.then(result)
					.catch(error => debug.error("unloadTabs", error));
			}
			else
			{
				result();
			}
		}
	}
};

/**
 * Sets the icon, badge, title, and popup for a given tab.
 *
 * @param {Object} tab - The tab object.
 * @returns {void}
 */
const setIcon = tab =>
{
	if (!tab)
		return debug.trace("setIcon error tab", tab);

	let title = APP.name;
	let popup = "";
	const open = ~~messagesHandler._tabs.has(tab.id);
	const action = prefs.iconAction ? "enable" : "disable";
	const skipped = TABS.find(tab) || tab;
	const property = ACTIONPROPS[prefs.iconAction];
	const color = ["#8AB4F8", "#F88AAF", "#74839C", "#9B7783"][~~skipped[ACTIONPROPS[ACTION_SKIP]] + open * 2];
	let badge = skipped[ACTIONPROPS[ACTION_SKIP]] ? "☐" : "🗹";

	if (prefs.iconAction === ACTION_LIST)
	{
		popup = "ui/actionPopup.html";
		badge += open ? " ▲" : " ▼";
	}
	else if (prefs.iconAction)
	{
		badge = badge + "" + chrome.i18n.getMessage("iconAction_" + prefs.iconAction + "_badge").padStart(2, " ");
	}

	debug.trace("setIcon", {id: tab.id, badge, iconAction: prefs.iconAction, prop: property, open, tab, skipped, tabConnect: messagesHandler._tabs});
	if (badge.length < 3)
		badge = "  " + badge + "  ";

	if (prefs.iconAction === ACTION_SKIP)
	{
		title += "\n" + chrome.i18n.getMessage("iconAction_" + ACTION_SKIP + "_" + (skipped.skip ? "N" : "Y"));
	}
	else if (prefs.iconAction)
	{
		title += "\n" + chrome.i18n.getMessage("iconAction_" + prefs.iconAction);
	}
	chrome.action[action](tab.id).catch(Void);
	if (color)
		chrome.action.setBadgeBackgroundColor({color, tabId: tab.id}).catch(Void);

	chrome.action.setBadgeText({text: badge, tabId: tab.id}).catch(Void);
	chrome.action.setPopup({tabId: tab.id, popup: popup}).catch(Void);
	chrome.action.setTitle({tabId: tab.id, title: title}).catch(Void);
	debug.debug({action, title, badge, popup});
	// abandon dynamic icons, icons are too small to show useful information
	// ICON.set(
	//   {
	//     skip: pinned[prop],
	//     action: prefs.iconAction,
	//     color
	//   }
	// );
	// ICON.setIcon(tab.id);
/*
	chrome.action.setIcon(
	{
	tabId: tab.id,
	path: {
		128: icon + "128.png",
		64: icon + "64.png",
		48: icon + "48.png",
		32: icon + "32.png",
		24: icon + "24.png",
		16: icon + "16.png",
	}
	});
*/
};

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

const updateFavicons = (sessions, newFavicons, oldFavicons) =>
{
	for(let i = 0; i < sessions.length; i++)
	{
		const session = sessions[i].tab || sessions[i];
		if (session?.window?.tabs)
			updateFavicons(session.window.tabs, newFavicons, oldFavicons);

		if (session.favIconUrl)
		{
			newFavicons[session.url] = session.favIconUrl;
			delete oldFavicons[session.url];
		}
	}
};

chrome.sessions.onChanged.addListener((...args) =>
{
	debug.debug("session.onChanged", args);
	chrome.sessions.getRecentlyClosed(sessions =>
	{
		const favicons = prefs("favicons");
		const newFavicons = {};
		const oldFavicons = Object.assign({}, favicons);
		updateFavicons(sessions, newFavicons, oldFavicons);
		for(const i in oldFavicons)
			delete favicons[i];

		Object.assign(favicons, newFavicons);
		prefs("favicons", favicons);
	});
	contextMenu.createContextMenu();
});
