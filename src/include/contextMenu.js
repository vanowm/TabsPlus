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
		debug.trace("contextMenu.add", menuItem.id, {menuItem, force});
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
		const id = chrome.contextMenus.create(menu, () => chrome.runtime.lastError);
		// const id = chrome.contextMenus.create(menu, () =>
		// {
		// 	//must read value from chrome.runtime.lastError in order to hide error in console
		// 	// eslint-disable-next-line no-unused-vars
		// 	const lastError = chrome.runtime.lastError;
		// 	// if (lastError)
		// 	// 	debug.trace("contextMenu.add error:", chrome.runtime.lastError.message, menuItem);
		// 	// else
		// 	// 	debug.trace("contextMenu.add:", menuItem);

		// });
		contextMenu._list.set(id, menuItem);
		// debug.debug("contextMenu.add", id, menuItem);
		return menuItem;
	},

	remove: id =>
	{
		// const menuItem = contextMenu._list.get(id);
		// debug.trace("contextMenu.remove", {id, menuItem});
		// if (menuItem)
		// {
			// debug.trace("contextMenu.removing:", menuItem);
			// chrome.contextMenus.remove(id, () =>
			// {
			// 	//must read value from chrome.runtime.lastError in order to hide error in console
			// 	// eslint-disable-next-line no-unused-vars
			// 	const lastError = chrome.runtime.lastError;
			// 	// if (lastError)
			// 		// if (chrome.runtime.lastError)
			// 		// debug.trace("contextMenu.remove error:", chrome.runtime.lastError.message, menuItem);
			// 	// else
			// 	// 	debug.trace("contextMenu.remove:", menuItem);
			// });
		// }
		chrome.contextMenus.remove(id, () => chrome.runtime.lastError);
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
					actionButton.setIcon(tabs[i]);
				return tabs;
			})
			.catch(error => debug.error("iconActionChanged", error));
	},

	createContextMenu: (id, newValue = SETTINGS.contextMenu, oldValue, data) =>
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
			? ["listAction", "lastUsed", "skip", "unload", "unloadWindow", "unloadAll", /*"freeze", "protect",*/ "separator", "options", "separator", "listContext"]
			: Object.keys(data);

		const sClosedTabs = chrome.i18n.getMessage("closedTabs");
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
			listContext: {
				title: centerString(" [  " + sClosedTabs + "  ] "),
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
				title: sClosedTabs,
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

			if (!SETTINGS.contextMenu)
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

	sAllTabs: centerString(" [  " + chrome.i18n.getMessage("contextMenu_window") + "  ] "),
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
			console.trace({parentId, _id, _i, object});
			if (object?.window?.tabs)
			{
				const _menuId = itemId + _id + "_" + _i;
				let item = {
					title: `Window (${object.window.tabs.length})`,
					id: _menuId,
					onclick: () => debug.log(object.sessionId),
					contexts: menuItemContexts
				};
				if (parentId)
					item.parentId = parentId;

				contextMenu.add(item, true);
				item = CLONE(item);
				item.id = itemId + _id + "_" + _i + "_" + 0;
				item.title = contextMenu.sAllTabs;
				// eslint-disable-next-line unicorn/prefer-add-event-listener
				item.onclick = () => chrome.sessions.restore(object.window.sessionId);
				item.parentId = _menuId;
				contextMenu.add(item, true);
				addTabs(object.window.tabs, _menuId, _id + "_" + _i++, 1);
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
			if (!sessions[i] || (itemId === "listContext" && !SETTINGS.contextMenu))
				break;

			i += addTabs(sessions[i], menuId, "", i);
		}
		while(i < max);
	} //showRecentlyClosed()
};//contextMenu

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

