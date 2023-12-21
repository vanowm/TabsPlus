let STORAGE = chrome.storage.sync;
const prefs = Object.defineProperties((name, value) =>
{
	if (value === undefined)
		return prefs[name];

	if (prefs[name] === undefined)
		return;

	const save = prefs[name];
	prefs.data[name].value = value;
	if (save !== value || (typeof save === "object"))
	{
		const o = {};
		o[name] = value;
		prefsSave(o, er => debug.debug("prefsSave", o, er, chrome.runtime.lastError));
	}
	return save;
},
{
	data:
	{
		configurable: false,
		enumerable: false,
		// writable: false,
		value:
		{
			newTabPosition:
			{
				default: 0,
			},
			newTabActivate:
			{
				default: 1,
				group: "newTabActivate",
				onChange: "newTabActivate"
			},
			newTabPageOnly:
			{
				default: 0,
				group: "newTabActivate"
			},
			newTabPageSkip: //when new tab created move it to the front of the list
			{
				default: 0,
				group: "newTabActivate"
			},
			tabsScrollFix:
			{
				default: 0,
				group: "newTabActivate",
				map: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
				valid: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
			},
			afterClose:
			{
				default: 1,
			},
			iconAction:
			{
				default: ACTION_LIST,
				onChange: "iconActionChanged",
				group: "iconAction",
				map: [0, ACTION_LIST, ACTION_UNDO, ACTION_SKIP, ACTION_UNLOAD_TAB, ACTION_UNLOAD_WINDOW, ACTION_UNLOAD_ALL],
				valid: [0, ACTION_UNDO, ACTION_SKIP, ACTION_LIST, ACTION_UNLOAD_TAB, ACTION_UNLOAD_WINDOW, ACTION_UNLOAD_ALL]
			},
			expandWindow:
			{
				default: 0,
				group: "iconAction"
			},
			showUrl:
			{
				default: 1,
				group: "iconAction"
			},
			showDate:
			{
				default: 1,
				group: "iconAction"
			},

			contextMenu:
			{
				default: 0,
				onChange: "createContextMenu",
			},

			// syncSettings:
			// {
			//   default: 1,
			// },
			optWin:
			{
				internal: true,
				noSync: true,
				default: []
			},
			favicons:
			{
				internal: true,
				noSync: true,
				default: {}
			},
			tabsList:
			{
				internal: true,
				noSync: true,
				default: []
			},
			tabsOrder:
			{
				internal: true,
				noSync: true,
				default: []
			},
			version:
			{
				noSync: true,
				default: ""
			}
		}
	}
});

function prefsOnChanged (changes, area)
{
	debug.debug("prefsOnChanged", arguments);
	// STORAGE.get(null, (...args) => debug.log("prefs", args));
	if (area === "sync" && STORAGE !== chrome.storage.sync)
		return;

	for (const o in changes)
	{
		if (!prefs.data[o])
			continue;

		if (contextMenu[prefs.data[o].onChange] instanceof Function)
			contextMenu[prefs.data[o].onChange](o, changes[o].newValue, changes[o].oldValue);

		messenger({
			type: "prefChanged",
			name: o,
			newValue: changes[o].newValue,
			oldValue: changes[o].oldValue
		});
	}
}

const prefsSave = (o, callback) =>
{
	debug.debug("prefsSave", STORAGE === chrome.storage.local, o);
	if (STORAGE === chrome.storage.local)
		return STORAGE.set(o, callback);

	const local = {};
	const sync = {};

	for(const i in o)
	{
		if (prefs.data[i].noSync || i === "syncSettings")
			local[i] = o[i];
		else
			sync[i] = o[i];
	}
	debug.debug("local", local);
	debug.debug("sync", sync);
	if (Object.keys(local).length > 0)
		chrome.storage.local.set(local, callback);

	if (Object.keys(sync).length > 0)
		chrome.storage.sync.set(sync, callback);
};

// eslint-disable-next-line no-unused-vars
const prefsInited = new Promise(resolve =>
{
	//options

	const prefsInit = (options, type) =>
	{
		const save = {};

		for (const i in prefs.data)
		{

			const label = chrome.i18n.getMessage(i);
			const description = chrome.i18n.getMessage(i + "_desc");
			const valid = prefs.data[i].valid || [];

			if (label)
				prefs.data[i].label = label;

			if (description)
				prefs.data[i].description = description;

			if (valid.length === 0)
			{
				let n = 0;
				let validValue;
				do
				{
					validValue = chrome.i18n.getMessage(i + "_" + n);
					if (validValue)
						valid[valid.length] = validValue;

					n++;
				}
				while(validValue);
			}
			const map = prefs.data[i].map;
			for(let j = 0; j < valid.length; j++)
			{
				const name = chrome.i18n.getMessage(i + "_" + j);
				if (!name)
					continue;

				if (!prefs.data[i].options)
					prefs.data[i].options = [];

				const index = map ? map.indexOf(j) : j;
				prefs.data[i].options[index] = {id: j, name, description: chrome.i18n.getMessage(i + "_" + j + "_desc")};
			}
		}
		const remove = [];
		for (const id in options)
		{
			if (prefs.data[id] && typeof prefs.data[id].default === typeof options[id])
				prefs.data[id].value = options[id];
			else
				remove[remove.length] = id;
		}

		if (remove.length > 0)
			STORAGE.remove(remove);

		const local = [];
		for (const id in prefs.data)
		{
			if (prefs.data[id].noSync && type === "sync")
			{
				//      delete prefs.data[i];
				local[local.length] = id;
				continue;
			}
			if (prefs.data[id].value === undefined)
			{
				save[id] = prefs.data[id].default;
				prefs.data[id].value = save[id];
			}

			try
			{
				const n = id;
				Object.defineProperty(prefs, id,
					{
						enumerable: true,
						configurable: false,
						get ()
						{
							return this.data[n].value;
						},
						set (value)
						{
							this(n, value);
						}
					});
			}
			catch{}
		}

		// debug.debug(JSON.stringify(prefs.data, null, 2), type);
		//alert("startup prefs with sync off are overwritten by sync.");

		if (type === undefined && prefs.syncSettings && STORAGE !== chrome.storage.sync)
		{
			STORAGE = chrome.storage.sync;
			chrome.storage.local.set({syncSettings: 1}, result => result && debug.debug(result));
			return STORAGE.get(null, data => prefsInit(data, "sync"));
		}
		else if (type === undefined && !prefs.syncSettings && STORAGE !== chrome.storage.local)
		{
			chrome.storage.local.set({syncSettings: 0}, result => result && debug.debug(result));
			STORAGE = chrome.storage.local;
			return STORAGE.get(null, data => prefsInit(data, "local"));
		}
		debug.debug(type, local, options);

		if (local.length > 0)
		{
			chrome.storage.local.get(local, data => prefsInit(data, "local"));
			return;
		}
		if (APP.version !== prefs.version)
		{
			// eslint-disable-next-line sonarjs/no-collapsible-if
			if (compareVersions(prefs.version, "0.1.1.16") < 0)
			{
				// eslint-disable-next-line unicorn/no-lonely-if
				if (prefs.tabsScrollFix === 1)
					prefs.tabsScrollFix = 5; //300ms
			}
			prefs.version = APP.version;
			save.version = APP.version;
		}

		// debug.debug(JSON.stringify(prefs.data, null, 2),save, type);
		if (Object.keys(save).length > 0)
			prefsSave(save, er => debug.debug("init prefs", save, er));

		// context menu
		contextMenu.createContextMenu();
		const _allTabs = chrome.tabs.query({});
		const _activeTabs = chrome.tabs.query({active: true});
		const _currentTab = chrome.tabs.query({active: true, currentWindow: true});
		TABS.loaded.then(async data =>
		{
			const savedTabsList = data.tabsList || [];
			const allTabs = await _allTabs;
			debug.trace(data);
			debug.debug("TABS.loaded", data.tabsList?.map(a => CLONE(a)), CLONE(data.tabsOrder), data, allTabs);
			const uuidList = new Map();
			for(let i = 0; i < allTabs.length; i++)
			{
				let tab = TABS.add(allTabs[i], false);
				const uuidTab = uuidList.get(tab.tabUUID) || [];
				uuidTab.push(tab);
				uuidList.set(tab.tabUUID, uuidTab);
				tab = TABS.find(allTabs[i]);
				if (tab)
					TABS.setWinUUID(tab);
			}
			for(let i = 0, length = savedTabsList.length; i < length; i++)
			{
				const tab = savedTabsList[i];
				const uuidTabs = uuidList.get(tab.tabUUID);
				if (!uuidTabs)
					continue;

				for(let index = 0; index < uuidTabs.length; index++)
				{
					const uuidTab = uuidTabs[index];
					if (uuidTab.windowUUID === tab.windowUUID)
					{
						tab.id = uuidTab.id;
						tab.windowId = uuidTab.windowId;
					}

				}
			}
			debug.trace("wtf", [...TABS.tabsData]);
			debug.debug("prefs sorting tabs", [...TABS.tabsData.values()].map(a =>
			{
				return {url: a.url, id: a.id, tabUUID: a.tabUUID, windowUUID: a.windowUUID, uuidList, a};
			}));
			for(let i = 0, length = savedTabsList.length; i < length; i++)
			{
				let tab = savedTabsList[i];
				const savedTabData = uuidList.get(tab.tabUUID);
				if (savedTabData)
				{

					// const tabOld = CLONE(tab);
					const tabSaved = CLONE(savedTabData);
					tab = TABS.update(savedTabData, tab, true);
					// TABS.setUUID(tab);
					// TABS.setWinUUID(tab);
					TABS.add(tab, false);
					if (tab.id !== tabSaved.id)
						TABS.remove(tabSaved, false);

					// debug.log(tabOld.tabUUID, tabOld.id, tab.id, {tabOld, tab: CLONE(tab), tabSaved});
				}

				// const opened = messengerHandler.onConnect.tab && messengerHandler.onConnect.tab.id === tab.id;
				// setIcon(tab, opened);
			}
			const activeTabs = await _activeTabs;
			for(let i = 0; i < activeTabs.length; i++)
				TABS.add(activeTabs[i], false);

			debug.debug("prefs FINISHED	sorting tabs", [...TABS.tabsData.values()].map(a =>
			{
				return {url: a.url, id: a.id, tabUUID: a.tabUUID, windowUUID: a.windowUUID, a};
			}));
			TABS.save();
			for (const tab of TABS.tabsData)
				setIcon(tab[1]);

			resolve();
			const [tab] = await _currentTab;
			return setContext(tab);
		}).catch(error => debug.error("prefsInit", error));
	}; //prefsInit();

	STORAGE.get(null, prefsInit);

	// storage change listener
	chrome.storage.onChanged.addListener( prefsOnChanged );
});
