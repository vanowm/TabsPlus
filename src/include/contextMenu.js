/**
 * Represents a context menu object.
 * @typedef {Object} CONTEXTMENU
 * @property {Object} onClick - Object containing click event handlers for menu items.
 * @property {Map} _list - Map containing the menu items.
 * @property {function} add - Function to add a menu item to the context menu.
 * @property {function} remove - Function to remove a menu item from the context menu.
 * @property {function} update - Function to update a menu item in the context menu.
 * @property {function} iconActionChanged - Function to handle changes in icon actions.
 * @property {function} contextMenuCreate - Function to create the context menu.
 */
const CONTEXTMENU = (() =>
{
	const sClosedTabs = i18n.closedTabs;
	const sAllTabs = centerString(" [  " + i18n.contextMenu_window + "  ] ");
	const aContexts = ["action", "page", "frame"];
	const menuItemProperties = {
		checked: Boolean,
		contexts: [["all", "page", "frame", "selection", "link", "editable", "image", "video", "audio", "launcher", "browser_action", "page_action", "action", "tools_menu", "tab", "tools_panel", "devtools_page", "devtools", "app", "app_launcher", "search_provider", "context_menu", "reset", "bookmark"]],
		documentUrlPatterns: Array,
		enabled: Boolean,
		id: String,
		parentId: [String, Number],
		targetUrlPatterns: Array,
		title: String,
		type: ["normal", "checkbox", "radio", "separator"],
		visible: Boolean,
		onclick: Function
	};
	const aDefaultMenus = ["listAction", "lastUsed", "skip", "unload", "unloadWindow", "unloadAll", /*"freeze", "protect",*/ "separator", "options", /*"separator",*/ "listContext"];
	// const aDefaultMenus = ["unloadAll", /*"freeze", "protect",*/ "separator", "options", /*"separator", */ "listContext"];
	const mContextMenu = new Map();
	const onClick = {};
	const noError = () => chrome.runtime.lastError;
	const menuList = {
		lastUsed: {
			title: i18n.contextMenu_lastUsed,
			contexts: aContexts,
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
			title: i18n("iconAction_" + ACTION_UNDO),
			contexts: aContexts,
			onclick: (info, tab) =>
			{
				actionButton(tab, ACTION_UNDO);
			}
		},
		skip: {
			title: i18n("iconAction_" + ACTION_SKIP + "_1"),
			contexts: aContexts,
			onclick: (info, tab) =>
			{
				actionButton(tab, ACTION_SKIP);
			}
		},
		// freeze: {
		//   title: i18n("iconAction_" + ACTION_FREEZE),
		//   contexts,
		//   onclick: (info, tab) =>
		//   {
		//     actionButton(tab, ACTION_FREEZE);
		//   }
		// },
		// protect: {
		//   title: i18n("iconAction_" + ACTION_PROTECT),
		//   contexts,
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
			contexts: aContexts,
		},
		listAction: {
			title: sClosedTabs,
			contexts: ["action"],
			maxList: 999,
			type: "menu"
		},
		options: {
			title: i18n.options,
			contexts: ["page", "frame"],
			onclick: () =>
			{
				chrome.runtime.openOptionsPage();
			}
		},
		unload: {
			title: i18n("iconAction_" + ACTION_UNLOAD_TAB),
			contexts: aContexts,
			onclick: (info, tab) =>
			{
				actionButton(tab, ACTION_UNLOAD_TAB);
			}
		},
		unloadWindow: {
			title: i18n("iconAction_" + ACTION_UNLOAD_WINDOW),
			contexts: aContexts,
			onclick: (info, tab) =>
			{
				actionButton(tab, ACTION_UNLOAD_WINDOW);
			}
		},
		unloadAll: {
			title: i18n("iconAction_" + ACTION_UNLOAD_ALL),
			contexts: aContexts,
			onclick: (info, tab) =>
			{
				actionButton(tab, ACTION_UNLOAD_ALL);
			}
		},

	};

	const add = (menuItem, force) =>
	{
		debug.trace("contextMenu add", menuItem.id, mContextMenu.has(menuItem.id), {menuItem, force});
		if (mContextMenu.has(menuItem.id))
		{
			if (!force)
				return menuItem;

			remove(menuItem.id);
		}
		if (menuItem.contexts.length === 0)
			return menuItem;

		const menu = CLONE(menuItem);
		if (menuItem.onclick)
			onClick[menuItem.id] = menuItem.onclick;

		sanitize(menu);
		delete menu.onclick; //can't pass this to pages
		// delete menu.maxList;
		chrome.contextMenus.remove(menuItem.id, noError);

		const id = chrome.contextMenus.create(menu, noError);
		mContextMenu.set(id, menuItem);
		// const id = chrome.contextMenus.create(menu, () =>
		// {
		// 	//must read value from chrome.runtime.lastError in order to hide error in console
		// 	// eslint-disable-next-line no-unused-vars
		// 	const lastError = chrome.runtime.lastError;
		// 	// if (lastError)
		// 	// 	debug.trace("contextMenuAdd error:", chrome.runtime.lastError.message, menuItem);
		// 	// else
		// 	// 	debug.trace("contextMenuAdd:", menuItem);

		// });
		// debug.debug("contextMenuAdd", id, menuItem);
		return menuItem;
	};

	const remove = id =>
	{
		const menuItem = mContextMenu.get(id);
		debug.trace("contextMenu remove", id, CLONE(menuItem));
		if (id.slice(0, 4) === "list")
		{
			const length = id.length;
			for (const value of mContextMenu)
			{
				if (value[0] !== id && value[0].slice(0, length) === id)
					remove(value[0]);
			}
		}
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
			// 		// debug.trace("contextMenuRemove error:", chrome.runtime.lastError.message, menuItem);
			// 	// else
			// 	// 	debug.trace("contextMenuRemove:", menuItem);
			// });
		// }
		chrome.contextMenus.remove(id, noError);
		mContextMenu.delete(id);
	};

	const update = menuItemNew =>
	{
		debug.trace("contextMenu update", menuItemNew.id, CLONE(menuItemNew));
		const menuItem = mContextMenu.get(menuItemNew.id);
		if (!menuItem)
			return;

		for (const i in menuItem)
		{
			if (menuItemNew[i] !== undefined)
				menuItem[i] = menuItemNew[i];
		}
		const menu = CLONE(menuItemNew);
		if (menuItem.onclick)
			onClick[menuItemNew.id] = menuItem.onclick;

		sanitize(menu);
		delete menu.onclick;
		delete menu.id;
		chrome.contextMenus.update(menuItemNew.id, menu,noError);
	};

	const reset = () =>
	{
		debug.trace("contextMenu reset");
		chrome.contextMenus.removeAll(noError);
		mContextMenu.clear();
		// for(const id of mContextMenu)
		// {
		// 	const menuItem = mContextMenu.get(id[0]);
		// 	menuItem.contexts = menuItem.contexts.filter(item => item === "action");
		// 	remove(id[0]);
		// 	add(menuItem);
		// }
	};

	const removeContexts = item => item !== "page" && item !== "frame";
	// {
	// 	const contexts = CLONE(menuItem.contexts);
	// 	for(let i = 0; i < contexts.length; i++)
	// 	{
	// 		if (contexts[i] === "page" || contexts[i] === "frame")
	// 			contexts.splice(i--, 1);
	// 	}
	// 	return contexts;
	// };

	const create = (id, newValue = SETTINGS.contextMenu, oldValue, data) =>
	{
		debug.trace("contextMenu create", {id, newVal: newValue, oldVal: oldValue, data, list:[...mContextMenu.keys()], menuList});
		// if (!newValue)
		// 	reset();

		const menus = data === undefined
			? aDefaultMenus
			: Object.keys(data);

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
			const menuItem = CLONE(menuList[itemId]);
			const isUpdate = data?.[itemId];
			const force = data?.[itemId].force;

			if (menuItem === undefined)
				continue;

			menuItem.id = itemId;
			if (menuItem.type === "separator")
				menuItem.id += m;

			if (!SETTINGS.contextMenu)
				menuItem.contexts = menuItem.contexts.filter(removeContexts);

			const isList = itemId.slice(0, 4) === "list";
			const menuId = menuItem.type === "menu" && itemId;

			// if (menuId)
			// 	delete menuItem.type;

			// debug.debug({itemId, menuItem, isList});

			if (isUpdate)
			{
				update(menuItem);
				continue;
			}
			else
				remove(menuItem.id);

			add(menuItem, force);

			if (isList)
			{
				chrome.sessions.getRecentlyClosed(sessions => showRecentlyClosed({
					itemId,
					menuId,
					menuItem,
					previousMenuItem: menuList[menus[m - 1]]?.type === "separator" && menuList[menus[m - 1]],
					sessions
				}));
			}

		} //for (menus)
		// const list = {};
		// for(let i = 0, entries = [...mContextMenu.entries()]; i < entries.length; i++)
		// {
		// 	const entry = entries[i];
		// 	for(let i = 0; i < entry[1].contexts.length; i++)
		// 	{
		// 		if (!list[entry[1].contexts[i]])
		// 			list[entry[1].contexts[i]] = [];

		// 		list[entry[1].contexts[i]].push(entry);
		// 	}
		// }

		// for(const i in list)
		// {
		// 	list[i] = list[i].filter((a, i, ar) => a[1].type !== "separator" || (i && ar[i - 1][1].type !== a[1].type));
		// }
		// debug.log({list});
	}; //contextMenuCreate()

	const iconActionChanged = (id, newValue, oldValue) =>
	{
		debug.trace("contextMenu iconActionChanged", {id, newVal: newValue, oldVal: oldValue});
		chrome.tabs.query({})
			.then(tabs =>
			{
				for (let i = 0; i < tabs.length; i++)
					actionButton.setIcon(tabs[i]);
				return tabs;
			})
			.catch(error => debug.error("iconActionChanged", error));
	};

	const showRecentlyClosed = ({itemId, menuId, menuItem, previousMenuItem, sessions}) =>
	{
		debug.trace("contextMenu showRecentlyClosed", {itemId, menuItemId: menuItem.id, menuItem, sessions});
		if (sessions.length === 0 && menuItem.contexts.length > 0)
		{
			// debug.log({menuItem, previousMenuItem});
			if (previousMenuItem)
			{
				debug.trace("contextMenu showRecentlyClosed", previousMenuItem);
				remove(previousMenuItem.id);
			}

			for(const id of mContextMenu)
			{
				if (id[0].slice(0, 4) === "list")
					remove(id[0]);
			}
			return remove(menuItem.id);
		}

		let i = 0;
		const max = menuItem.maxList || 10;

		const menuItemContexts = menuId ? menuItem.contexts : ["page", "frame"];

		do
		{
			if (!sessions[i] || (itemId === "listContext" && !SETTINGS.contextMenu))
				break;

			i += addTabs(sessions[i], menuId, "", i, max, itemId, menuItemContexts);
		}
		while(i < max);
	}; //showRecentlyClosed()

	const addTabs = (object, parentId, _id, _i, max, itemId, menuItemContexts) =>
	{
		console.trace("contextMenu addTabs", {parentId, _id, _i, object});
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

			add(item, true);
			item = CLONE(item);
			item.id = itemId + _id + "_" + _i + "_" + 0;
			item.title = sAllTabs;
			// eslint-disable-next-line unicorn/prefer-add-event-listener
			item.onclick = () => chrome.sessions.restore(object.window.sessionId);
			item.parentId = _menuId;
			add(item, true);
			addTabs(object.window.tabs, _menuId, _id + "_" + _i++, 1, max, itemId, menuItemContexts);
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
			add(details, true);
			// debug.log(n, i, details, contextMenuAdd(details, true));
		}
		return tabs.length;
	};

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
		create(undefined, undefined, undefined, {skip: {title: i18n("iconAction_" + ACTION_SKIP + "_" + ~~!found.skip)}});

	};

	const isEqual = (a,b) => (b === String && typeof a === "string")
		|| (b === Number && typeof a === "number")
		|| (b === Boolean && typeof a === "boolean")
		|| (typeof b === "function" && a instanceof b);

	const sanitize = menuItem =>
	{
		for (const property in menuItem)
		{
			const value = menuItem[property];
			const properties = menuItemProperties[property];

			if (Array.isArray(properties))
			{
				const isDelete = properties.every(type =>
				{
					if (Array.isArray(type) && Array.isArray(value))
					{
						const typeSet = new Set(type);
						return value.some(value_ => !typeSet.has(value_));
					}
					return value !== type && !isEqual(value, type);
				});

				if (isDelete) delete menuItem[property];
			}
			else if (!isEqual(value, properties))
			{
				delete menuItem[property];
			}
		}
	};
	return {
		onClick,
		create,
		iconActionChanged,
		setContext
	};
})();//contextMenu

