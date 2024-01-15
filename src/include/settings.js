let STORAGE = chrome.storage.sync;
const SETTINGS = (() =>
{
	const settings = {
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
		showIcon:
		{
			default: 1,
			group: "iconAction",
			next: ["showTitle", "showUrl"], //list of other checkboxes. First item will be forced checked if all are unchecked
		},
		showTitle:
		{
			default: 1,
			group: "iconAction",
			next: ["showUrl", "showIcon"],
		},
		showUrl:
		{
			default: 1,
			group: "iconAction",
			next: ["showTitle", "showIcon"],
		},
		showDate:
		{
			default: 1,
			group: "iconAction"
		},

		contextMenu:
		{
			default: 0,
			onChange: "create",
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
	};

	const settingsSave = (o, callback) =>
	{
		debug.trace("settingsSave", STORAGE === chrome.storage.local, o, trace());
		if (STORAGE === chrome.storage.local)
			return STORAGE.set(o, callback);

		const local = {};
		const sync = {};
		for(const i in o)
		{
			if (settings[i].noSync || i === "syncSettings")
				local[i] = o[i];
			else
				sync[i] = o[i];
		}
		debug.debug("local", local);
		debug.debug("sync", sync);
		if (!isEmpty(local))
			chrome.storage.local.set(local, callback);

		if (!isEmpty(sync))
			chrome.storage.sync.set(sync, callback);
	};

	const settingsOnChange = (changes, type) =>
	{
		debug.debug("settingsOnChanged", {changes, type});
		// STORAGE.get(null, (...args) => debug.log("settings", args));
		if (type === "sync" && STORAGE !== chrome.storage.sync)
			return;

		for (const o in changes)
		{
			if (!settings[o])
				continue;

			if (CONTEXTMENU[settings[o].onChange] instanceof Function)
				CONTEXTMENU[settings[o].onChange](o, changes[o].newValue, changes[o].oldValue);

			MESSENGER({
				type: "settingChanged",
				name: o,
				newValue: changes[o].newValue,
				oldValue: changes[o].oldValue
			});
		}
	};

	const settingsInit = (options, type, resolve) =>
	{
		const save = {};
		for (const i in settings)
		{

			const label = i18n(i);
			const description = i18n(i + "_desc");
			const valid = settings[i].valid || [];

			if (label)
				settings[i].label = label;

			if (description)
				settings[i].description = description;

			if (valid.length === 0)
			{
				let n = 0;
				let validValue;
				do
				{
					validValue = i18n(i + "_" + n);
					if (validValue)
						valid[valid.length] = validValue;

					n++;
				}
				while(validValue);
			}
			const map = settings[i].map;
			for(let j = 0; j < valid.length; j++)
			{
				const name = i18n(i + "_" + j);
				if (!name)
					continue;

				if (!settings[i].options)
					settings[i].options = [];

				const index = map ? map.indexOf(j) : j;
				settings[i].options[index] = {id: j, name, description: i18n(i + "_" + j + "_desc")};
			}
		}
		const remove = [];
		for (const id in options)
		{
			if (settings[id] && typeof settings[id].default === typeof options[id])
				settings[id].value = options[id];
			else
				remove.push(id);
		}
		if (remove.length > 0)
			STORAGE.remove(remove);

		const local = [];
		for (const id in settings)
		{
			if (settings[id].noSync && type === "sync")
			{
				//      delete _default[i];
				local[local.length] = id;
				continue;
			}
			if (settings[id].value === undefined)
			{
				save[id] = settings[id].default;
				settings[id].value = save[id];
			}

		}
		// debug.debug(JSON.stringify(_default, null, 2), type);
		//alert("startup settings with sync off are overwritten by sync.");

		if (type === undefined && settings.syncSettings?.value && STORAGE !== chrome.storage.sync)
		{
			STORAGE = chrome.storage.sync;
			chrome.storage.local.set({syncSettings: 1}, result => result && debug.debug(result));
			return STORAGE.get(null, data => settingsInit(data, "sync", resolve));
		}
		else if (type === undefined && !settings.syncSettings?.value && STORAGE !== chrome.storage.local)
		{
			chrome.storage.local.set({syncSettings: 0}, result => result && debug.debug(result));
			STORAGE = chrome.storage.local;
			return STORAGE.get(null, data => settingsInit(data, "local", resolve));
		}
		debug.debug("settings", {type, local, options});

		if (local.length > 0)
		{
			chrome.storage.local.get(local, data => settingsInit(data, "local", resolve));
			return;
		}
		if (APP.version !== settings.version.value)
		{
			// eslint-disable-next-line sonarjs/no-collapsible-if
			if (compareVersions(settings.version.value, "0.1.1.16") < 0)
			{
				// eslint-disable-next-line unicorn/no-lonely-if
				if (settings.tabsScrollFix.value === 1)
					settings.tabsScrollFix.value = 5; //300ms
			}
			settings.version.value = APP.version;
			save.version = APP.version;
		}

		// debug.debug(JSON.stringify(_default, null, 2),save, type);
		if (Object.keys(save).length > 0)
			settingsSave(save, er => debug.debug("init settings", save, er));

		// context menu
		CONTEXTMENU.create();
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
			debug.debug("settings sorting tabs", [...TABS.tabsData.values()].map(a => new Object({url: a.url, id: a.id, tabUUID: a.tabUUID, windowUUID: a.windowUUID, uuidList, a})));
			for(let i = 0, length = savedTabsList.length; i < length; i++)
			{
				let tab = savedTabsList[i];
				const savedTabData = uuidList.get(tab.tabUUID);
				if (savedTabData)
				{

					// const tabOld = CLONE(tab);
					const tabSaved = CLONE(savedTabData);
					tab = TABS.updateData(savedTabData, tab, true);
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

			debug.debug("settings FINISHED	sorting tabs", [...TABS.tabsData.values()].map(a => new Object({url: a.url, id: a.id, tabUUID: a.tabUUID, windowUUID: a.windowUUID, a})));
			TABS.save();
			for (const tab of TABS.tabsData)
				actionButton.setIcon(tab[1]);

			resolve(settings);
			const [tab] = await _currentTab;
			return CONTEXTMENU.setContext(tab);
		}).catch(error => debug.error("settingsInit", error));
	}; //settingsInit();

	const settingsInited = new Promise(resolve =>
	{
		//options
		STORAGE.get(null, (options, type) => settingsInit(options, type, resolve));

		// storage change listener
		chrome.storage.onChanged.addListener( settingsOnChange );
	});

	/**
	 * Returns a read-only proxy object that retrieves the value of a specific key from the default settings object.
	 *
	 * @param {string} key - The key to retrieve from the default settings object.
	 * @returns {Object} - A read-only proxy object that retrieves the value of the specified key from the default settings object.
	 */
	const settingsGetData = key => new Proxy(settings, {
		get: (target, name) => (console.log(name, target[name]), Reflect.get(target[name], key)),
		set: () => true, //read-only
	});

	/**
	 * Resets all settings to their default values, except for the version number.
	 * @function
	 * @name settingsReset
	 */
	const settingsReset = () =>
	{
		for(const i in settings)
		{
			if (i !== "version")
				settings[i].value = settings[i].default;
		}

		settingsSave();
	};

	/**
	 * Object containing various settings commands.
	 * @typedef {Object} settingsCommands
	 * @property {string[]} $keys - Array of keys in the settings object.
	 * @property {Object} $data - The settings object.
	 * @property {Function} $save - Function to save the settings.
	 * @property {boolean} $inited - Flag indicating if the settings have been initialized.
	 * @property {Function} $reset - Function to reset the settings.
	 */
	const settingsCommands = {
		$keys: Object.keys(settings),
		$data: settings,
		$save: (...args) => settingsSave.apply(null, args),
		$inited: settingsInited,
		$reset: () => settingsReset()
	};

	return new Proxy((name, value) =>
	{
		if (settings[name] === undefined)
			return;

		if (value === undefined)
			return settings[name].value;

		const save = settings[name].value;
		settings[name].value = value;
		if (save !== value || (typeof save === "object"))
		{
			const o = {};
			o[name] = value;
			settingsSave(o, er => debug.debug("settingsSave result", {o, er, lastError: chrome.runtime.lastError}));
		}
		return save;
	},
	{
		get: (target, name) =>
		{
			if (Object.prototype.hasOwnProperty.call(settingsCommands, name))
				return settingsCommands[name];

			if (name[0] === "$")
				return settingsGetData(name.slice(1));

			return target(name);
		},
		set: (target, name, value) => target(name, value)
	});
})();

